/**
 * documentPipeline.ts — Wave 47: Zero-Manual-Lift Document Intelligence
 *
 * Ingestion pipeline for uploaded medical licenses, certifications, and IDs.
 * Reads the document through a configured OCR provider and extracts
 * structured fields with confidence scores.
 *
 * Fail-closed contract: reading either returns text a configured provider
 * actually produced, or it throws DocumentReadingUnavailableError. There is
 * no fixture fallback outside NODE_ENV=test.
 */

import { randomUUID } from 'node:crypto';
import { log } from '../../obs/logger';

// ── Types ──────────────────────────────────────────────────────────

export interface ExtractedField {
  field: string;
  value: string;
  confidence: number; // 0.0 to 1.0
}

export type DocumentType =
  | 'MEDICAL_LICENSE'
  | 'DEA_CERTIFICATE'
  | 'BOARD_CERTIFICATION'
  | 'GOVERNMENT_ID'
  | 'UNKNOWN';

export interface DocumentExtractionResult {
  documentId: string;
  documentType: DocumentType;
  extractedFields: ExtractedField[];
  overallConfidence: number;
  rawOcrText: string;
  processingTimeMs: number;
}

export interface PipelineConfig {
  confidenceThreshold: number;
  maxRetries: number;
  ocrProvider: 'vision_model' | 'tesseract';
}

const DEFAULT_CONFIG: PipelineConfig = {
  confidenceThreshold: 0.95,
  maxRetries: 2,
  ocrProvider: 'vision_model',
};

// ── Classification ─────────────────────────────────────────────────

const DOCUMENT_TYPE_KEYWORDS: Record<DocumentType, string[]> = {
  MEDICAL_LICENSE: ['medical license', 'license to practice', 'physician license', 'state medical board'],
  DEA_CERTIFICATE: ['dea registration', 'drug enforcement', 'controlled substance', 'dea number'],
  BOARD_CERTIFICATION: ['board certified', 'board certification', 'diplomate', 'specialty board'],
  GOVERNMENT_ID: ['driver license', 'passport', 'identification card', 'department of motor'],
  UNKNOWN: [],
};

function classifyDocumentType(ocrText: string): DocumentType {
  const lowerText = ocrText.toLowerCase();

  for (const [docType, keywords] of Object.entries(DOCUMENT_TYPE_KEYWORDS)) {
    if (docType === 'UNKNOWN') continue;
    if (keywords.some((kw) => lowerText.includes(kw))) {
      return docType as DocumentType;
    }
  }

  return 'UNKNOWN';
}

// ── Field Extraction ───────────────────────────────────────────────

interface FieldPattern {
  field: string;
  patterns: RegExp[];
  baseConfidence: number;
}

const FIELD_PATTERNS: FieldPattern[] = [
  {
    field: 'fullName',
    patterns: [/name[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i, /(?:dr\.?\s+)?([A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?),?\s*M\.?D\.?/i],
    baseConfidence: 0.85,
  },
  {
    field: 'licenseNumber',
    patterns: [/license\s*(?:#|number|no\.?)[:\s]*([A-Z]?\d{4,10})/i, /(?:lic|license)[:\s]*([A-Z]{1,3}\d{4,8})/i],
    baseConfidence: 0.90,
  },
  {
    field: 'licenseState',
    patterns: [/state\s*(?:of)?\s*:?\s*(Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New\s+Hampshire|New\s+Jersey|New\s+Mexico|New\s+York|North\s+Carolina|North\s+Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode\s+Island|South\s+Carolina|South\s+Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West\s+Virginia|Wisconsin|Wyoming)/i, /\b(CA|NY|TX|FL|PA|OH|IL|GA|NC|NJ|VA|WA|AZ|MA|TN|IN|MO|MD|WI|CO|MN|SC|AL|LA|KY|OR|OK|CT|UT|IA|NV|AR|MS|KS|NM|NE|ID|WV|HI|NH|ME|MT|RI|DE|SD|ND|AK|VT|WY|DC)\b/],
    baseConfidence: 0.88,
  },
  {
    field: 'expirationDate',
    patterns: [/expir(?:es|ation)[:\s]*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i, /valid\s+(?:through|until)[:\s]*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i],
    baseConfidence: 0.87,
  },
  {
    field: 'licenseType',
    patterns: [/type[:\s]*(MD|DO|DPM|DDS|DMD|PharmD|RN|NP|PA|DC)/i, /(?:doctor of\s+)?(medicine|osteopathy|podiatry|dental)/i],
    baseConfidence: 0.82,
  },
];

function extractFieldsFromText(ocrText: string): ExtractedField[] {
  const fields: ExtractedField[] = [];

  for (const fp of FIELD_PATTERNS) {
    let matched = false;
    for (const pattern of fp.patterns) {
      const match = ocrText.match(pattern);
      if (match?.[1]) {
        fields.push({
          field: fp.field,
          value: match[1].trim(),
          confidence: fp.baseConfidence,
        });
        matched = true;
        break;
      }
    }
    if (!matched) {
      fields.push({ field: fp.field, value: '', confidence: 0 });
    }
  }

  return fields;
}

// ── OCR Providers ──────────────────────────────────────────────────
//
// Providers:
//   OCR_PROVIDER=openai  — uses OPENAI_API_KEY + gpt-4o vision.
//     Set in .env: OCR_PROVIDER=openai  OPENAI_API_KEY=sk-...
//   (unset)              — no reading is possible; the dispatcher throws and
//     the route answers 503. Under NODE_ENV=test only, a fixture answers so
//     the extraction stages can be exercised without a network.
//
// Future providers: google_vision (GOOGLE_CLOUD_VISION_API_KEY),
//   aws_textract, azure_form_recognizer — add adapters below and wire
//   them via OCR_PROVIDER env var.

// ── OpenAI Vision OCR ──────────────────────────────────────────────

interface OpenAIChatMessage {
  role: 'user';
  content: Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string; detail: 'high' } }>;
}

interface OpenAIResponse {
  choices: Array<{ message: { content: string } }>;
  error?: { message: string };
}

async function performOcrOpenAI(fileBuffer: Buffer, mimeType: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not set');

  const base64 = fileBuffer.toString('base64');
  const dataUrl = `data:${mimeType};base64,${base64}`;

  const messages: OpenAIChatMessage[] = [
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: 'You are a medical document OCR system. Extract ALL text from this document image verbatim, preserving line breaks. Do not add commentary — return only the raw text content.',
        },
        {
          type: 'image_url',
          image_url: { url: dataUrl, detail: 'high' },
        },
      ],
    },
  ];

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages,
      max_tokens: 1024,
      temperature: 0,
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${errText}`);
  }

  const data = (await response.json()) as OpenAIResponse;
  if (data.error) throw new Error(`OpenAI error: ${data.error.message}`);

  return data.choices[0]?.message?.content ?? '';
}

// ── Fail-closed contract ───────────────────────────────────────────
//
// The previous dispatcher substituted a fixed California medical-licence
// fixture on EVERY fault — no provider configured, missing key, HTTP error,
// timeout — and the route stored that text as a durable artifact under a
// real account with a 200. A stub that answers on every fault is not a
// fallback; it is a document the clinician never uploaded. Reading now
// either returns what a configured provider produced, or it throws.

/** Thrown when no reading could be produced. Routes map this to 503. */
export class DocumentReadingUnavailableError extends Error {
  readonly code = 'document_reading_unavailable' as const;

  constructor(reason: string) {
    super(`Document reading is unavailable: ${reason}`);
    this.name = 'DocumentReadingUnavailableError';
  }
}

// ── Stub OCR (NODE_ENV=test only) ──────────────────────────────────

function performOcrStub(): string {
  log('info', 'document_pipeline_ocr_stub', {
    note: 'Fixture OCR active (NODE_ENV=test). Set OCR_PROVIDER=openai + OPENAI_API_KEY for real extraction.',
  });

  return [
    'STATE OF CALIFORNIA',
    'Medical Board of California',
    'License to Practice Medicine',
    '',
    'Name: Jane A. Smith, M.D.',
    'License Number: A123456',
    'License Type: MD',
    'State: CA',
    'Issued: 01/15/2020',
    'Expiration: 01/15/2026',
    '',
    'This license is valid through the expiration date above.',
  ].join('\n');
}

// ── OCR Dispatcher ─────────────────────────────────────────────────

async function performOcr(
  fileBuffer: Buffer,
  mimeType: string,
  _config: PipelineConfig,
): Promise<string> {
  const provider = (process.env.OCR_PROVIDER ?? '').trim().toLowerCase();

  if (provider === 'openai') {
    try {
      log('info', 'document_pipeline_ocr_start', { provider: 'openai' });
      const text = await performOcrOpenAI(fileBuffer, mimeType);
      log('info', 'document_pipeline_ocr_complete', { provider: 'openai', chars: text.length });
      return text;
    } catch (err) {
      // Logged in full; the thrown reason is deliberately generic so a
      // provider's response body never reaches a client.
      log('warn', 'document_pipeline_ocr_provider_failed', {
        provider: 'openai',
        error: err instanceof Error ? err.message : String(err),
      });
      throw new DocumentReadingUnavailableError('the configured provider did not return a reading');
    }
  }

  // No real provider selected. The fixture is a test convenience and may
  // answer ONLY under NODE_ENV=test; everywhere else this is a fault.
  const noProvider = provider === '' || provider === 'stub';
  if (noProvider && process.env.NODE_ENV === 'test') {
    return performOcrStub();
  }

  log('warn', 'document_pipeline_ocr_unavailable', {
    provider: provider || '(unset)',
    nodeEnv: process.env.NODE_ENV ?? '(unset)',
  });
  throw new DocumentReadingUnavailableError(
    noProvider ? 'no document provider is configured' : `unsupported document provider "${provider}"`,
  );
}

// ── Public API ─────────────────────────────────────────────────────

async function extractFromDocument(
  fileBuffer: Buffer,
  mimeType: string,
  config?: Partial<PipelineConfig>,
): Promise<DocumentExtractionResult> {
  const merged: PipelineConfig = { ...DEFAULT_CONFIG, ...config };
  const startMs = Date.now();

  const rawOcrText = await performOcr(fileBuffer, mimeType, merged);
  const documentType = classifyDocumentType(rawOcrText);
  const extractedFields = extractFieldsFromText(rawOcrText);

  const fieldsWithValues = extractedFields.filter((f) => f.value !== '');
  const overallConfidence =
    fieldsWithValues.length > 0
      ? fieldsWithValues.reduce((sum, f) => sum + f.confidence, 0) / fieldsWithValues.length
      : 0;

  const result: DocumentExtractionResult = {
    documentId: randomUUID(),
    documentType,
    extractedFields,
    overallConfidence,
    rawOcrText,
    processingTimeMs: Date.now() - startMs,
  };

  log('info', 'document_pipeline_extraction_complete', {
    documentId: result.documentId,
    documentType: result.documentType,
    fieldCount: fieldsWithValues.length,
    overallConfidence: result.overallConfidence,
    processingTimeMs: result.processingTimeMs,
  });

  return result;
}

export const documentPipeline = { extractFromDocument, classifyDocumentType };
