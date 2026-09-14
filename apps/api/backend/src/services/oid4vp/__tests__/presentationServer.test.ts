import { parseVerifiablePresentationPayload } from '../presentationServer';

describe('parseVerifiablePresentationPayload', () => {
  const legacyJsonVp = {
    '@context': ['https://www.w3.org/2018/credentials/v1'],
    type: ['VerifiablePresentation'],
    id: 'urn:uuid:presentation-1',
    holder: 'did:key:holder-1',
    verifiableCredential: [
      {
        credentialId: 'credential-1',
        issuer: 'did:web:issuer.example',
      },
    ],
  };

  it('accepts the legacy JSON VerifiablePresentation representation', () => {
    expect(parseVerifiablePresentationPayload(legacyJsonVp)).toEqual(legacyJsonVp);
  });

  it('accepts the same representation serialized as JSON', () => {
    expect(parseVerifiablePresentationPayload(JSON.stringify(legacyJsonVp))).toEqual(legacyJsonVp);
  });

  it('rejects an OpenID4VP DCQL result object instead of treating it as a legacy JSON VP', () => {
    expect(() =>
      parseVerifiablePresentationPayload({
        user_info_query: ['issuer~disclosure~key-binding'],
      }),
    ).toThrow('presentation payload type must include VerifiablePresentation');
  });

  it('rejects a VP with no credentials so an empty presentation cannot verify successfully', () => {
    expect(() =>
      parseVerifiablePresentationPayload({
        ...legacyJsonVp,
        verifiableCredential: [],
      }),
    ).toThrow('presentation payload must contain at least one verifiableCredential');
  });

  it('rejects malformed credential members before cryptographic verification', () => {
    expect(() =>
      parseVerifiablePresentationPayload({
        ...legacyJsonVp,
        verifiableCredential: [null],
      }),
    ).toThrow('presentation payload contains an invalid verifiableCredential');
  });

  it('rejects malformed JSON strings', () => {
    expect(() => parseVerifiablePresentationPayload('{not-json')).toThrow(
      'presentation payload is not valid JSON',
    );
  });
});
