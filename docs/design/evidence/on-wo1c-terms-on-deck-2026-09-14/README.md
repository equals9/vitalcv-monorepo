# ON-WO-1c evidence — the clinician's terms on the Discover deck

Captured 2026-09-14 from a local **production** build (`next build` + `next start` with
`DEV_PREVIEW=1 MATCHA_DECK_PREVIEW=1`, the documented non-canonical preview flags) of
`feat/whats-next-terms-on-deck`, rendering the deck's **visibly-labeled fixture preview** at
`/dev/matcha-deck` with the clinician's terms held in the device-scope browser store (`TX`
non-negotiable, `$300,000/year` minimum, sponsorship needed). The backend URL pointed at a dead
port; no service was contacted.

**Why fixtures, stated plainly:** the live deck needs an NPI-bound clinician, and the match
service builds that clinician's profile from NPPES, so a sanctioned synthetic identity cannot
produce a live deck locally. The fixture deck is the same mounted consumer surface with sample
data; the record pass-through that feeds the live deck is covered by the loader test
(`matcha-deck-live-feed-records.test.ts`), not by these frames.

| File | What it shows |
|---|---|
| `terms-on-deck-card-desktop-1440x900.png` | Card face summary: the hard-miss sentence and each term inline — location **not met**, minimum pay **met**, sponsorship **unknown** — under the match block, above the card foot. |
| `terms-on-deck-sheet-desktop-1440x900.png` | Detail sheet: the full strip beside the role facts, with the reason and the question. Pass / Interested / Priority untouched. |
| `terms-on-deck-record-unavailable-1440x900.png` | A card whose canonical record was not read says the check was unavailable — no per-term unknowns. |
| `terms-on-deck-card-mobile-390x844.png` | The face summary at 390×844 under reduced motion; `scrollWidth − clientWidth = 0`. |
| `terms-on-deck-no-terms-1440x900.png` | A fresh browser with no terms: one deck-level line pointing to where terms are set; nothing on any card. |
