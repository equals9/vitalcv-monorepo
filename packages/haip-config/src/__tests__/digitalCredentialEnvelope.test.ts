import {
  DigitalCredentialEnvelopeError,
  normalizeOID4VPPresentationEnvelope,
  OID4VP_DIGITAL_CREDENTIAL_PROTOCOLS,
} from '../oid4vp/digitalCredentialEnvelope';

describe('normalizeOID4VPPresentationEnvelope', () => {
  const presentationSubmission = {
    id: 'submission-1',
    definition_id: 'definition-1',
    descriptor_map: [
      {
        id: 'medical_license',
        format: 'jwt_vp_json',
        path: '$',
      },
    ],
  };

  const canonicalPath = {
    recognition: { status: 'recognized' },
    acceptance: { status: 'pending' },
    start: { status: 'not_started' },
  };

  const legacyEnvelope = {
    vp_token: 'header.payload.signature',
    presentation_submission: presentationSubmission,
    state: 'state-1',
    nonce: 'nonce-1',
    canonicalPath,
  };

  const currentEnvelope = {
    protocol: 'openid4vp-v1-unsigned',
    data: {
      vp_token: 'header.payload.signature',
      presentation_submission: presentationSubmission,
      state: 'state-1',
    },
    nonce: 'nonce-1',
    canonicalPath,
  };

  it('normalizes legacy and W3C-aligned Android envelopes to identical verifier input', () => {
    const legacy = normalizeOID4VPPresentationEnvelope(legacyEnvelope);
    const current = normalizeOID4VPPresentationEnvelope(currentEnvelope);

    expect(current).toEqual(legacy);
    expect(current).toEqual({
      presentationPayload: 'header.payload.signature',
      presentationSubmission,
      state: 'state-1',
      nonce: 'nonce-1',
      canonicalPath,
    });
  });

  it.each(OID4VP_DIGITAL_CREDENTIAL_PROTOCOLS)(
    'accepts W3C Digital Credentials API protocol %s',
    (protocol) => {
      expect(
        normalizeOID4VPPresentationEnvelope({
          protocol,
          data: { vp_token: 'header.payload.signature' },
        }),
      ).toEqual({
        presentationPayload: 'header.payload.signature',
        presentationSubmission: undefined,
        state: undefined,
        nonce: undefined,
        canonicalPath: undefined,
      });
    },
  );

  it('allows VitalCV HTTP context to remain outside the Digital Credentials API data object', () => {
    const normalized = normalizeOID4VPPresentationEnvelope({
      protocol: 'openid4vp-v1-unsigned',
      data: {
        vp_token: 'header.payload.signature',
        nonce: 'inner-nonce',
      },
      nonce: 'outer-nonce',
      canonicalPath,
    });

    expect(normalized.nonce).toBe('inner-nonce');
    expect(normalized.canonicalPath).toEqual(canonicalPath);
  });

  it('rejects unsupported protocol identifiers before verification', () => {
    expect(() =>
      normalizeOID4VPPresentationEnvelope({
        protocol: 'openid4vp-v2-unsigned',
        data: { vp_token: 'header.payload.signature' },
      }),
    ).toThrowError(DigitalCredentialEnvelopeError);

    try {
      normalizeOID4VPPresentationEnvelope({
        protocol: 'openid4vp-v2-unsigned',
        data: { vp_token: 'header.payload.signature' },
      });
    } catch (error) {
      expect(error).toBeInstanceOf(DigitalCredentialEnvelopeError);
      expect((error as DigitalCredentialEnvelopeError).code).toBe('UNSUPPORTED_PROTOCOL');
    }
  });

  it('rejects a malformed W3C envelope without object-valued data', () => {
    expect(() =>
      normalizeOID4VPPresentationEnvelope({
        protocol: 'openid4vp-v1-unsigned',
        data: 'not-an-object',
      }),
    ).toThrowError(DigitalCredentialEnvelopeError);
  });

  it('rejects envelopes with no presentation payload', () => {
    expect(() => normalizeOID4VPPresentationEnvelope({ state: 'state-1' })).toThrowError(
      DigitalCredentialEnvelopeError,
    );

    expect(() =>
      normalizeOID4VPPresentationEnvelope({
        protocol: 'openid4vp-v1-unsigned',
        data: {},
      }),
    ).toThrowError(DigitalCredentialEnvelopeError);
  });
});
