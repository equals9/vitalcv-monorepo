export const OID4VP_DIGITAL_CREDENTIAL_PROTOCOLS = Object.freeze([
  'openid4vp-v1-unsigned',
  'openid4vp-v1-signed',
  'openid4vp-v1-multisigned',
] as const);

export type OID4VPDigitalCredentialProtocol =
  (typeof OID4VP_DIGITAL_CREDENTIAL_PROTOCOLS)[number];

/**
 * Protocol-neutral ingress consumed by VitalCV verifier services.
 *
 * Browser / Android Digital Credentials API wire names stop at the
 * normalizer. Downstream verifier and trust-computing code receives these
 * semantic fields and never needs to know whether the caller used the legacy
 * top-level OID4VP form or the W3C-aligned { protocol, data } envelope.
 */
export interface NormalizedOID4VPPresentationInput {
  presentationPayload: unknown;
  presentationSubmission?: unknown;
  state?: unknown;
  nonce?: unknown;
  canonicalPath?: unknown;
}

export type DigitalCredentialEnvelopeErrorCode =
  | 'INVALID_ENVELOPE'
  | 'UNSUPPORTED_PROTOCOL'
  | 'INVALID_DATA'
  | 'MISSING_PRESENTATION_PAYLOAD';

export class DigitalCredentialEnvelopeError extends Error {
  readonly code: DigitalCredentialEnvelopeErrorCode;

  constructor(message: string, code: DigitalCredentialEnvelopeErrorCode) {
    super(message);
    this.name = 'DigitalCredentialEnvelopeError';
    this.code = code;
    Object.setPrototypeOf(this, DigitalCredentialEnvelopeError.prototype);
  }
}

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSupportedProtocol(value: string): value is OID4VPDigitalCredentialProtocol {
  return (OID4VP_DIGITAL_CREDENTIAL_PROTOCOLS as readonly string[]).includes(value);
}

function firstDefined(primary: unknown, fallback: unknown): unknown {
  return primary === undefined ? fallback : primary;
}

/**
 * Normalize both supported OID4VP ingress shapes:
 *
 * Legacy / direct OID4VP:
 *   { vp_token, presentation_submission?, state?, nonce?, canonicalPath? }
 *
 * W3C Digital Credentials API / Android August-2026 shape:
 *   {
 *     protocol: 'openid4vp-v1-unsigned' | '...-signed' | '...-multisigned',
 *     data: { vp_token, presentation_submission?, state? },
 *     nonce?,
 *     canonicalPath?
 *   }
 *
 * VitalCV-specific context (nonce/canonicalPath) may remain at the outer HTTP
 * boundary while OID4VP response members live inside `data`. The normalized
 * result intentionally drops transport metadata so equivalent presentations
 * become deep-equal verifier inputs.
 */
export function normalizeOID4VPPresentationEnvelope(
  envelope: unknown,
): NormalizedOID4VPPresentationInput {
  if (!isRecord(envelope)) {
    throw new DigitalCredentialEnvelopeError(
      'OID4VP presentation envelope must be an object.',
      'INVALID_ENVELOPE',
    );
  }

  let payloadRecord: JsonRecord = envelope;

  if (envelope.protocol !== undefined) {
    if (typeof envelope.protocol !== 'string' || !isSupportedProtocol(envelope.protocol)) {
      throw new DigitalCredentialEnvelopeError(
        `Unsupported Digital Credentials API protocol '${String(envelope.protocol)}'.`,
        'UNSUPPORTED_PROTOCOL',
      );
    }

    if (!isRecord(envelope.data)) {
      throw new DigitalCredentialEnvelopeError(
        'Digital Credentials API OID4VP envelope requires an object-valued data field.',
        'INVALID_DATA',
      );
    }

    payloadRecord = envelope.data;
  }

  const presentationPayload = payloadRecord.vp_token;
  if (
    presentationPayload === undefined ||
    presentationPayload === null ||
    presentationPayload === ''
  ) {
    throw new DigitalCredentialEnvelopeError(
      'OID4VP presentation payload is required.',
      'MISSING_PRESENTATION_PAYLOAD',
    );
  }

  return {
    presentationPayload,
    presentationSubmission: firstDefined(
      payloadRecord.presentation_submission,
      envelope.presentation_submission,
    ),
    state: firstDefined(payloadRecord.state, envelope.state),
    nonce: firstDefined(payloadRecord.nonce, envelope.nonce),
    canonicalPath: firstDefined(payloadRecord.canonicalPath, envelope.canonicalPath),
  };
}
