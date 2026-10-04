# Wallet / Browser OID4VC Integration Kit

## OID4VCI Pre-Authorized Code Flow
```text
1. GET /.well-known/openid-credential-issuer  → metadata
2. POST /api/oid4vci/credential-offer         → { pre_authorized_code, credential_offer_uri }
3. POST /api/oid4vci/credential               → { compact_sd_jwt }
4. Store in wallet, present via OID4VP
```

## OID4VP Presentation

### W3C Digital Credentials API / Android (August 2026+)

Treat the browser / Credential Manager response as a transport envelope. Send the
complete response to the verifier; do not extract claims client-side and treat
them as verified.

```json
{
  "protocol": "openid4vp-v1-unsigned",
  "data": {
    "vp_token": "<presentation payload>",
    "presentation_submission": {
      "id": "<submission id>",
      "definition_id": "<definition id>",
      "descriptor_map": []
    },
    "state": "<state when applicable>"
  }
}
```

VitalCV accepts the W3C OpenID4VP v1 Digital Credentials API identifiers used by
the platform boundary:

- `openid4vp-v1-unsigned`
- `openid4vp-v1-signed`
- `openid4vp-v1-multisigned`

### Legacy / direct OID4VP transition form

Existing integrations may continue to submit the legacy direct shape during the
platform migration:

```json
{
  "vp_token": "<presentation payload>",
  "presentation_submission": {
    "id": "<submission id>",
    "definition_id": "<definition id>",
    "descriptor_map": []
  },
  "state": "<state when applicable>"
}
```

Both forms are normalized at the protocol boundary into the same semantic
presentation input before verification. Browser, Android, `protocol`, `data`,
and `vp_token` representations must not enter TrustIR / Trust Compiler domain
semantics.

The legacy SD-JWT validation convenience endpoint remains supported:

```text
POST /api/validate/presentation { compact, disclosures }
→ { valid: true, claims: { ... } }
```

## JWKS

`GET /api/.well-known/jwks.json` — always available, no feature flag required.
