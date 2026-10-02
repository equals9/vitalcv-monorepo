/**
 * `/holder` evidence upload panel switch.
 *
 * The upload lane behind the panel (parse → ingest → confirm) is being made
 * honest in stages. The API now fails closed instead of answering every
 * provider fault with a fixture licence, and stores what it does read as
 * self-attested rather than as a source-verified artifact. Until the lane is
 * confirmed working end to end on production, the panel stays off `/holder`
 * by default, and a founder flips one Railway variable to show it — the same
 * staging this repo uses for its other consequential switches
 * (DIRECTORY_SITEMAP, CLERK_JWT_VERIFICATION, VERIFIER_RBAC_MODE).
 *
 * Only the literal `enabled` counts. `true`, `1`, `on` and `ENABLED` are all
 * "off", so a half-remembered value cannot switch it on by accident.
 *
 * Read per request, never frozen into the bundle: `/holder` is
 * force-dynamic, and a build-time read would bake whatever the CI
 * environment happened to have.
 */
export function evidenceUploadEnabled(): boolean {
  return process.env.EVIDENCE_UPLOAD_ENABLED === 'enabled';
}
