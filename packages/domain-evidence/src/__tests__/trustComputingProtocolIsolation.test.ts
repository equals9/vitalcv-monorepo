import fs from 'node:fs';
import path from 'node:path';

const FORBIDDEN_PROTOCOL_TERMS: ReadonlyArray<{ label: string; pattern: RegExp }> = [
  { label: 'OID4VP vp_token wire member', pattern: /\bvp_token\b/i },
  { label: 'W3C DigitalCredential API type', pattern: /\bDigitalCredential\b/i },
  { label: 'Digital Credentials API transport alias', pattern: /\bdc_api\b/i },
  { label: 'W3C OID4VP protocol identifier', pattern: /openid4vp-v1-/i },
  { label: 'Android Credential Manager transport', pattern: /Credential Manager/i },
];

function listSourceFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return listSourceFiles(absolute);
    if (!entry.isFile() || !entry.name.endsWith('.ts') || entry.name.endsWith('.test.ts')) return [];
    return [absolute];
  });
}

describe('trust-computing protocol isolation', () => {
  it('keeps browser, Android, and OID4VP wire representations out of TrustIR / Trust Compiler source', () => {
    const trustComputingRoot = path.resolve(__dirname, '../trust-computing');
    const violations: string[] = [];

    for (const file of listSourceFiles(trustComputingRoot)) {
      const source = fs.readFileSync(file, 'utf8');
      for (const forbidden of FORBIDDEN_PROTOCOL_TERMS) {
        if (forbidden.pattern.test(source)) {
          violations.push(`${path.relative(trustComputingRoot, file)}: ${forbidden.label}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
