# ON-WO-1a evidence — "Your terms" on the signed-in role detail

Captured 2026-09-14 from a local **production** build (`next build` + `next start`) of
`feat/whats-next-intent-fit`, signed in through the real Clerk development-instance gate,
against a disposable database holding one synthetic feed row (`Synthetic feed placeholder org`,
state TX, no pay, schedule not stated). No real clinician, employer, or posting is shown.

| File | What it shows |
|---|---|
| `your-terms-desktop-1440x900.png` | Terms `CA, WA` (non-negotiable), `$150,000/year` minimum (non-negotiable), `part time`. Location **not met** is the heading; pay and arrangement **unknown** with the question to ask; "View original listing" still available. |
| `your-terms-mobile-390x844.png` | Same state at 390×844; no horizontal overflow (measured `scrollWidth − clientWidth ≤ 0`). |
| `your-terms-no-terms-1440x900.png` | Terms cleared on a fresh device: the section reports no terms and points to where they are set. |

Persistence was exercised through the authed `PUT` and `GET` on `/api/matcha/preferences`
before the page was loaded; the stored `hardConstraints` came back as written.
