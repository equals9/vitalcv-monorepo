# ON-WO-1b evidence — the clinician's terms on every row of the signed-in Roles list

Captured 2026-09-14 from a local **production** build (`next build` + `next start`) of
`feat/whats-next-terms-on-list` (stacked on `feat/whats-next-intent-fit`, #1478), signed in
through the real Clerk development-instance gate as the synthetic e2e clinician, against a
disposable database holding one synthetic feed row (`Synthetic feed placeholder org`, state
TX, no pay published, schedule not stated). The web server read the local backend
(`/api/health` reported `backend.url: http://127.0.0.1:4000`); no production service was
contacted. No real clinician, employer, or posting is shown.

| File | What it shows |
|---|---|
| `terms-on-list-desktop-1440x900.png` | Terms `CA, WA` (non-negotiable), `$150,000/year` minimum (non-negotiable), `part time` (advisory). On the row: location **not met** with the reason, pay **unknown** with the question to ask, arrangement **unknown**; the hard-miss heading; "Apply now" and "Role details" untouched. |
| `terms-on-list-mobile-390x844.png` | Same state at 390×844; `scrollWidth − clientWidth = 0`. |
| `terms-on-list-no-terms-1440x900.png` | Terms cleared through the account store on a fresh device: one line for the list saying no terms are set, pointing to where they are set; no verdict on any row. |

Persistence was exercised through the authed `PUT` then `GET` on `/api/matcha/preferences`
before the page loaded; `hardConstraints: ["location","compensation"]` came back as written and
the store row was cleared to `{}` at the end. Reduced motion was emulated on the mobile pass
with the same result. The "Set your terms" link took keyboard focus.
