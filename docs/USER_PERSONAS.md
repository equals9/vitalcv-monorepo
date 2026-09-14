# VitalCV User Personas

**Status:** Working reference, not founder-approved doctrine. Serves three jobs — surface
prioritisation and honest-state UX, pilot objection handling, and copy validation.
**Stage assumption:** pre-revenue foundation/pilot. These personas are built for pilot
conversion and product design, **not** scale-stage growth marketing.

## How to read this document

Every number and behaviour below that is not publicly verifiable is tagged
`[assumption — validate in pilot]`. There is no survey data, no analytics, and no
formalised interview set behind this document. Treat untagged claims as either public
record (the NPPES registry holds 8M+ provider records) or as structural facts about the
product read from the codebase.

**These personas have been burned before.** Every one of them has sat through a pitch that
promised the credentialing problem would disappear. Their scepticism is written in on
purpose — it is the most useful thing about them. A persona that nods along to the deck is
not a persona, it is a mirror.

### The single line every persona must survive

> VitalCV assembles a source-backed record, shows what is ready and what is missing, and
> lets a clinician carry it. The institution still decides.

If a piece of copy, a surface, or a pilot answer cannot be reconciled with that sentence,
it is wrong regardless of how well it converts.

---

## Vocabulary correction (affects copy and design work)

The brief for this document named the coverage states as *checked / stale / gated / access
required*. The codebase does not agree, and the disagreement matters for anyone writing
copy against these personas.

**Canonical evidence vocabulary** — `apps/web/lib/vital/evidenceState.ts`, seven states:

| State | Label shown | Meaning (as written in code) | Check glyph allowed |
|---|---|---|---|
| `source_backed` | Source-backed | A primary source returned this value. | Yes |
| `checked` | Checked | A check ran against the source and returned no adverse result. | Yes |
| `self_attested` | Self-attested | Entered by the clinician; not yet confirmed by a source. | No |
| `needs_review` | Needs review | Flagged for human or employer review before it can be relied on. | No |
| `access_required` | Access required | A source exists but VitalCV does not have access to it yet. | No |
| `unavailable` | Unavailable | The source is temporarily unreachable; nothing was returned. | No |
| `employer_decision` | Employer decision | Only an employer or institution can decide this. | No |

Three things follow:

1. **There is no `stale` evidence state.** `stale` is a *lane* status in
   `apps/web/lib/verify/laneSnapshots.ts`, a different vocabulary describing freshness
   against a source's refresh SLA. Designing a persona moment around "does Marisol
   understand *stale*?" points at a state the canonical set does not contain.
2. **`gated` is a tone, not a state.** It is the colour treatment `access_required`
   resolves to. Copy must never surface the word "gated" to a clinician or a reviewer.
3. **`not_found` is a finding, not an absence.** The lane map exists specifically to stop
   "a source answered and had no active record" from drifting toward the source-backed
   tier. This is the single most important honesty moment for the buyer-side personas, and
   it is where a competitor's demo would quietly cheat.

Everywhere below, state names are quoted as the labels a user actually sees.

---

# Part 1 — Persona cards

## Card 1 · Marisol Reyes, RN — the travel nurse (PRIMARY)

| | |
|---|---|
| **Age / pronouns** | 34 · she/her |
| **Role** | Travel RN, med-surg / step-down, 13-week contracts |
| **Location** | Home base Phoenix AZ; placements across the Southwest and Pacific Northwest |
| **Licensure footprint** | Compact multistate licence plus two single-state licences `[assumption — validate in pilot]` |
| **Income** | Typical public band for travel RN total compensation, ~$95k–$140k depending on contract mix and stipends — *typical band, not researched* |
| **Tech comfort** | High, mobile-first. Does everything on a phone between shifts. Will not open a laptop for an employer's form. |
| **Current stack** | Google Drive folder of PDFs, camera roll screenshots, a Notes file of expiration dates, recruiter texts |
| **Wants** | Never re-type the same history again. See what is missing *before* it costs her a contract. |
| **Fears** | A lapsed cert she forgot about; a start date that slips because of paperwork she thought was done |
| **Killer objection** | "Who else sees this?" |
| **Adoption = ** | Enters her NPI, and comes back to keep the record alive |

---

## Card 2 · Denise Kowalski, CPCS — the credentialing specialist (PRIMARY)

| | |
|---|---|
| **Age / pronouns** | 47 · she/her |
| **Role** | Senior Credentialing Specialist, Medical Staff Services, 400-bed regional health system |
| **Location** | Suburban Ohio |
| **Volume** | ~35–50 active files at any time; a mix of initial appointments and reappointments `[assumption — validate in pilot]` |
| **Income** | Typical public band for a certified credentialing specialist, ~$58k–$82k — *typical band, not researched* |
| **Tech comfort** | Deep expertise in *her* legacy credentialing software; low tolerance for new tools. Excel is her real workbench. Still receives faxes. |
| **Current stack** | Credentialing platform + a personal tracking spreadsheet + email + fax |
| **Wants** | Defensible files. Fewer chase emails. Something an auditor cannot poke a hole in. |
| **Fears** | Being the name on a file that failed an audit or a survey |
| **Killer objection** | "Does this replace primary source verification?" — **the answer is no, and saying so is what wins her** |
| **Buying power** | No budget. **Absolute veto.** |

---

## Card 3 · Trey Alvarez — the staffing recruiter (PRIMARY)

| | |
|---|---|
| **Age / pronouns** | 29 · he/him |
| **Role** | Senior Recruiter, allied + nursing desk, mid-size travel staffing firm |
| **Location** | Dallas TX, hybrid |
| **Volume** | 60–90 active candidates; quota carried on starts, not submissions `[assumption — validate in pilot]` |
| **Income** | Typical public band, ~$55k base + commission, $85k–$130k OTE — *typical band, not researched* |
| **Tech comfort** | Fluent in his ATS because he has to be; lives on the phone and LinkedIn. Will not adopt a second system that does not feed the first. |
| **Current stack** | ATS + a personal spreadsheet + hope |
| **Wants** | Know what is outstanding on a candidate **before** he submits, not three weeks later |
| **Fears** | The candidate ghosts during the credentialing lag and takes a competitor's offer |
| **Killer objection** | "Does this plug into my ATS or is it another tab?" |
| **Buying power** | Influencer. Loud one. |

---

## Card 4 · Dr. Anand Rao, MD — the locum physician (SECONDARY)

| | |
|---|---|
| **Age / pronouns** | 52 · he/him |
| **Role** | Hospitalist, locum tenens, 6–10 assignments a year across three states |
| **Location** | Nashville TN base |
| **Licensure footprint** | Three active state licences, two he keeps current "just in case" `[assumption — validate in pilot]` |
| **Income** | Typical public band for locum hospitalist, ~$250k–$350k annualised — *typical band, not researched* |
| **Tech comfort** | Moderate. Delegates admin where possible. Impatient with anything that takes more than one sitting. |
| **Current stack** | A credentialing coordinator at the agency does it *for* him, badly, repeatedly |
| **Wants** | To stop being asked for the same malpractice history and the same reference list every four months |
| **Fears** | Losing billable weeks to a privileging queue |
| **Killer objection** | "My agency already does this. Why would I do it myself?" |
| **Note** | His time is the most expensive in the persona set. Every screen must justify itself in seconds. |

---

## Card 5 · Pam Whitfield — the office manager who *is* credentialing (SECONDARY)

| | |
|---|---|
| **Age / pronouns** | 44 · she/her |
| **Role** | Practice Manager, 4-provider independent specialty clinic |
| **Location** | Rural Georgia |
| **Volume** | 4 providers, plus payer enrollment for each — perhaps 6–10 credentialing events a year `[assumption — validate in pilot]` |
| **Income** | Typical public band for practice manager, ~$52k–$75k — *typical band, not researched* |
| **Tech comfort** | Capable generalist. No specialist credentialing software — she uses payer portals, PDFs, and a wall calendar. |
| **Current stack** | Payer portals + a binder + a wall calendar + her own memory |
| **Wants** | To not be the single point of failure when a provider's enrollment lapses |
| **Fears** | A revenue hole because someone fell off a payer panel and nobody noticed |
| **Killer objection** | "I can't add another subscription and I can't add another login." |
| **Note** | She is the clearest case for the free clinician side doing the work *for* her. |

---

# Part 2 — Detailed profiles

## 2.1 Marisol Reyes, RN — travel nurse

### Background and context

Marisol has been a nurse for eleven years and a traveller for five. She left staff work
because the money was better and the politics were worse; she has stayed because she likes
choosing her own geography. She is mid-career, confident clinically, and has learned that
the actual job of travel nursing is 80% bedside and 20% document logistics.

Her licensure footprint is the thing that makes her the sharpest test case for VitalCV: a
compact multistate licence covers a lot of her work, but two states she likes working in
require their own, and each renewal cycle runs on a different clock. Add BLS, ACLS, a
speciality certification, an annual competency, a respirator fit test, and two employer-
specific modules, and she is tracking roughly a dozen expiring things across four systems
none of which talk to each other. `[assumption — validate in pilot: the count and the mix]`

She has taken the same pre-employment packet — same licence copies, same immunisation
record, same employment history back seven years, same three references — and re-submitted
it for every single placement. Each agency swears it is the last time.

### Goals and motivations

1. **Never start from zero again.** The specific, visceral goal. Not "be verified" — she
   does not think in those terms. She thinks: *I already sent this.*
2. **See what is missing before it costs her.** She has lost a start date to a lapsed
   certification she genuinely believed was current. That is the memory VitalCV is selling
   against.
3. **Control who sees what.** She is not paranoid, she is professional. A record that goes
   to an employer she has not chosen is a dealbreaker, immediately and permanently.
4. **Speed to the next contract.** Between assignments she is not earning.

### Pain points and challenges

- **The re-submission loop.** Every placement, from scratch. Her documents are trapped in
  a Drive folder with filenames like `IMG_4471.jpg`.
- **Silent expirables.** Nothing tells her a cert lapsed until someone else notices.
- **Source-of-truth ambiguity.** She does not know which of her four copies of her licence
  is the current one, and neither does the agency.
- **Opaque waiting.** "You're in credentialing" is not a status. She cannot tell whether
  the delay is her fault or theirs.
- **Recruiter noise.** She gets a dozen texts a week. Her attention is genuinely scarce.

### Technology comfort

High, and specifically mobile-native. She will scan an NPI form on a phone in a break room
with one hand. She will **not** open a laptop to complete an employer's portal task, and a
surface that requires it silently loses her. She is comfortable with biometrics, sceptical
of anything that asks for an SSN before it has shown value, and she reads the sharing
settings.

### Preferred channels

SMS above all. Nursing communities (Facebook groups, Reddit's nursing subs, TikTok for
discovery). Word of mouth from other travellers is the single highest-trust channel and the
one VitalCV cannot buy. `[assumption — validate in pilot]` Email is where employer things
go to be ignored.

### Buying behaviour

**She does not buy. She spends trust and minutes.** The product is free to her, forever,
and that is load-bearing — but free does not mean frictionless. Her adoption decision is:

- **Minute 1:** Will entering my NPI show me something true that I did not already know?
- **Minute 2:** Does this look like it is on my side, or is it a recruiter funnel wearing a
  profile's clothes?
- **Week 2:** Did it tell me something before someone else did?

Adoption is *entering an NPI*. **Retention is the record staying alive** — and she will only
maintain it if it saves her a real re-submission at least once.

### Frustrations with current solutions

Her current solution is a folder, a camera roll, and her memory. Its frustrations are not
subtle: she cannot search it, it does not warn her, it does not travel, and every agency
makes her rebuild it by hand. Job boards (Vivian, Incredible Health) solve discovery, not
evidence — they will show her roles, then hand her to an agency that asks for the packet
again. LinkedIn holds a career narrative with no evidence behind it.

### Quote

> "I have sent my ACLS card to eleven different people this year. Eleven. And the twelfth
> one is going to ask me like it's the first time."

---

## 2.2 Denise Kowalski, CPCS — credentialing specialist / MSP

### Background and context

Denise has done this for nineteen years, has held her CPCS for eleven, and is the person
the medical staff office relies on when a file is complicated. She works in a system where
credentialing commonly runs 90–120+ days end to end, and she can tell you exactly which
segments of that are hers and which are not. Most of it is not: it is waiting on primary
sources, waiting on the applicant, and waiting on a committee that meets monthly.

She is not slow. She is **accountable**. There is a difference and vendors keep missing it.
Every file she touches must survive a Joint Commission survey, a payer audit, and — in the
worst case — a plaintiff's attorney reconstructing what the organisation knew and when.
That is why she does not accept anything she did not source herself, and why "we already
checked that" from a third party is worth exactly nothing to her unless she can see the
source, the timestamp, and what was actually returned.

She has sat through at least three vendor demos that implied the work would run itself. In
each case the demo used a clean file. She has never once had a clean file.

### Goals and motivations

1. **Defensible files.** The primary motivation, ahead of speed, always.
2. **Fewer chase emails.** She estimates a large fraction of her week is asking applicants
   for things they already sent to someone else. `[assumption — validate in pilot]`
3. **Shrink time-to-start where it is legitimately shrinkable** — the applicant-side
   gathering phase, not the verification phase and definitely not the committee phase.
4. **Not be blindsided.** A gap discovered at committee is a month lost.

### Pain points and challenges

- **Re-verification of the same clinician the same way, forever.** She knows the person was
  credentialed at the hospital across town. It does not help her. Trust does not travel
  between institutions, and mostly it shouldn't.
- **Incomplete applications.** The single largest source of delay she controls.
- **Source-of-truth ambiguity.** Three documents, three different middle initials.
- **Committee cadence.** Monthly. Missing it by two days costs four weeks.
- **Expirables at scale.** Reappointment cycles across a whole medical staff.
- **Vendor overclaim fatigue.** She has developed a reflex: when a slide says the platform
  handles verification, she asks what "handles" means, and the answer is usually "collects".

### Technology comfort

Expert in her own domain software, conservative about everything else. She lives in a
legacy credentialing platform, exports to Excel to actually think, and still receives
primary source responses by fax. She will evaluate a new tool by trying to break its claims,
not by exploring its features. Give her a read-only surface and she will find the weakest
sentence on it within ninety seconds.

### Preferred channels

Email, decisively. NAMSS — the professional association, its chapters, its conference, its
peer network — is where her professional trust actually forms. Vendor webinars she attends
sceptically and mutes. Peer referral from another MSP outweighs any marketing VitalCV can
produce. `[assumption — validate in pilot]`

### Buying behaviour and the employer-side buying committee

**Denise holds no budget and near-total veto.** If she says "this doesn't do what they
said", the pilot dies at the working level regardless of what an executive signed.

The committee around her:

| Role | Who | What they care about | How VitalCV wins them |
|---|---|---|---|
| **Economic buyer** | VP Talent Acquisition, COO, or VP Medical Staff Services | Time-to-start, cost per start, pilot scope that does not disrupt operations | Outcome pricing tied to clinicians who start; a pilot that runs alongside the existing stack |
| **Champion** | Director of Credentialing or TA Operations lead | Fewer escalations, a metric they can show upward | Give them the before/after number the pilot is designed to produce |
| **Veto — compliance** | **Denise**, CVO ops lead | Does this weaken the file? Does it replace PSV? | "No. It does not replace primary source verification. The decision stays with you." Say it first, unprompted. |
| **Veto — security/legal** | IT security, privacy counsel | Data handling, consent, breach surface | Clinician-controlled sharing; the clinician chose to send this packet |
| **Influencer** | Recruiters (Trey) | Submission velocity | Show what is outstanding pre-submission |
| **Downstream user** | HR / onboarding coordinator | Receiving a usable packet in week one | The accepted packet arrives structured, not as an email thread |
| **Incumbent risk** | Existing contract with a credentialing workflow vendor | Sunk cost, integration effort, renewal timing | **Do not position as replacement.** Position beneath. |

The last row is the one that kills deals. symplr, Medallion, Modio, CertifyOS and Verifiable
are entrenched and, in several cases, mid-contract. VitalCV is not competing for the
credentialing workflow seat. It is the evidence layer underneath it — the thing that arrives
*before* the workflow starts, so the workflow starts from further along.

### Frustrations with current solutions

Her credentialing platform is a workflow engine and a document vault; it does not make the
applicant arrive prepared. Her spreadsheet exists because the platform cannot answer the
questions she actually asks. Fax persists because some primary sources still answer that
way. The gap none of it fills: **the applicant showing up complete.**

### Quote

> "I don't need you to verify anything for me. I need the file to arrive with fewer holes
> in it, and I need to be able to see exactly where every single thing came from. If your
> product does the first without the second, it makes my job harder, not easier."

---

## 2.3 Trey Alvarez — staffing firm recruiter

### Background and context

Trey has three years on the desk and is good at it. He carries a book of 60–90 active
candidates and is measured on **starts**, not submissions — a distinction that governs
everything about how he behaves. A submission that dies in credentialing is worse than no
submission: it consumed his time, the client's goodwill, and the candidate's patience.

The pattern that costs him most: he submits a strong candidate, the client is enthusiastic,
and then three weeks disappear into credentialing. Somewhere in week two the candidate takes
a competing offer that moved faster. He did nothing wrong and lost the placement anyway.

He works his ATS because he must; it is a system of record that gives him almost nothing
back. His real intelligence lives in a spreadsheet and in his head.

### Goals and motivations

1. **Know what is outstanding before he submits.** Not after. This is the whole pitch to
   him and he will grasp it in one sentence.
2. **Compress the interview-to-start gap**, because that gap is where his candidates
   evaporate.
3. **Differentiate his submissions.** A candidate arriving with a source-backed record is a
   better submission than the same candidate arriving as a PDF résumé.
4. **Fewer surprises in front of the client.** Being blindsided by a gap in his own
   candidate's file is professionally embarrassing.

### Pain points and challenges

- **Candidate ghosting during the credentialing lag.** The number-one killer.
- **Documents he cannot see.** He does not know his candidate's cert lapsed either.
- **Rework.** Chasing the same documents from every candidate, every time.
- **Client-side opacity.** He cannot tell the candidate what is actually holding it up.
- **Another tab.** He is one tool away from tool fatigue and he knows it.

### Technology comfort

Practically fluent, structurally impatient. He can learn any interface in ten minutes and
will abandon any interface that does not pay him back within a week. Phone and LinkedIn are
his native environment. **A tool that does not feed his ATS is a tool he will use for a
month and then stop.** `[assumption — validate in pilot: whether read-only value alone
sustains use without integration]`

### Preferred channels

LinkedIn, phone, text. He responds to peers and to numbers. He is reachable and he will
take a meeting — but he will not champion something that makes his day longer.

### Buying behaviour

Influencer, not buyer. Agency ops and the VP of Talent sign; Trey determines whether the
pilot generates any usage at all. His adoption test is brutally simple: **did this tell me
something about a candidate that I could not have known, early enough to act on it?**

### Frustrations with current solutions

ATS plus spreadsheet plus prayer. The ATS holds candidates but knows nothing about their
evidence. The spreadsheet is his memory. The prayer is credentialing. Job boards compete
with him for candidate attention; LinkedIn gives him narrative, not readiness.

### Quote

> "I can sell a candidate who has a gap. What I can't do is find out about the gap the same
> week the client does."

---

## 2.4 Dr. Anand Rao, MD — locum tenens hospitalist

### Background and context

Anand went locum eight years ago, after a decade of employed hospitalist work, and does not
intend to go back. He works 6–10 assignments a year across three states, keeps a couple of
extra licences current in case an opportunity appears, and treats credentialing as a tax he
pays in billable weeks.

His agency has a credentialing coordinator who does the paperwork *for* him. This sounds
like it removes his pain and does not: he is still the one who has to produce the malpractice
history, the reference list, the procedure log, the gap-in-employment explanation, and the
same signature on the same release form, every four months, for a different coordinator who
has never met him.

He is the persona most likely to say "this isn't my problem" and the most likely to be
wrong about that.

### Goals and motivations

1. **Stop repeating himself.** Same history, same references, same explanations.
2. **Protect billable time.** A privileging queue that runs long is money.
3. **Optionality.** He keeps licences current specifically so he can say yes quickly.
4. **Dignity, honestly.** Being processed as a document set gets old at fifty-two.

### Pain points and challenges

- **Repeat submission via an intermediary**, which is slower than doing it himself and
  removes his visibility.
- **Privileging timelines** that he cannot see into or influence.
- **Expirables across multiple states** on unsynchronised renewal clocks.
- **Zero portability of the work already done.** Hospital A's completed file is invisible
  to Hospital B, permanently.

### Technology comfort

Moderate and impatient. Will use a good mobile surface; will not learn a system. Delegates
where he can. **A first session that does not produce something legible in under two
minutes loses him and he does not come back.**

### Preferred channels

Email and text, physician communities (Doximity, speciality forums), and peer word of mouth.
He will not discover VitalCV through a nursing channel and will not respond to staffing-style
outreach. `[assumption — validate in pilot]`

### Buying behaviour

Same shape as Marisol: free product, trust-and-minutes currency, adoption equals NPI entry.
Two differences that matter:

- **His agency is an incumbent relationship, not a neutral party.** His objection — "my
  agency already does this" — must be answered on portability, not effort: the agency's work
  belongs to the agency and dies with the placement; his record belongs to him and does not.
- **He is a credibility asset.** A physician who maintains a record is a stronger reference
  to an employer-side buyer than ten nurses, fairly or not. `[assumption — validate in
  pilot]`

### Frustrations with current solutions

The agency coordinator is the current solution and is a black box with a friendly voice.
Doximity is a professional network with no evidence layer. There is no product that holds
his career evidence in a form he controls — that is the actual gap, and he has stopped
expecting anyone to fill it.

### Quote

> "Every assignment, someone new asks me to explain a three-month gap from 2019. I have
> written that paragraph maybe forty times. It's the same paragraph."

---

## 2.5 Pam Whitfield — practice manager wearing the credentialing hat

### Background and context

Pam runs a four-provider independent specialty clinic in a small town. She is the office
manager, the HR department, the billing liaison, and the credentialing department. Nobody
trained her for the last one; she learned it because a provider fell off a payer panel in
2021 and the practice lost revenue for two months before anyone worked out why.

She has no credentialing software and cannot justify buying any for four providers. Her
system is a binder, a set of payer portal logins, and a wall calendar with renewal dates
written on it in red. It works because she is meticulous and it will fail the moment she is
on holiday for three weeks.

She is the persona for whom the free clinician side is the entire product. She does not
need a review console. She needs her four providers to each hold a live record so that she
is not the only copy.

### Goals and motivations

1. **Stop being the single point of failure.**
2. **Protect revenue** — enrollment lapses are directly financial in a small practice.
3. **Get renewal warnings before the payer does.**
4. **Spend less of her week on this**, because it is the fourth of her four jobs.

### Pain points and challenges

- **Payer enrollment**, which is its own separate hell alongside licensure.
- **No system of record.** The binder is the system of record.
- **No redundancy.** If she forgets, nobody catches it.
- **No budget and no appetite for another subscription or another login.**

### Technology comfort

Capable generalist. Uses payer portals daily, comfortable with spreadsheets and PDFs, has
no specialist tooling and no IT support. Will adopt something free that visibly reduces her
risk; will not adopt anything that requires a procurement conversation.

### Preferred channels

Email, practice-management communities, speciality-society administrative resources, and her
local peer network of other practice managers. `[assumption — validate in pilot]`

### Buying behaviour

Not a buyer for the paid side — she cannot sign a pilot and should not be sold one. Her value
is different and real:

- She is a **clinician-side adoption vector**: she can put four NPIs into VitalCV in an
  afternoon and has direct authority to ask her providers to maintain them.
- She is a **product truth test**: if the free record is genuinely useful without any
  employer on the other side, it works for her. If it only pays off when an employer accepts
  a packet, she gets nothing and that is a finding.

### Frustrations with current solutions

Portals, a binder, a wall calendar, and her memory. Nothing warns her. Nothing is redundant.
Nothing transfers when a provider joins or leaves.

### Quote

> "I'm the credentialing department. That's not a job title anyone gave me, it's just true.
> And if I get hit by a bus, this practice is in real trouble in about six weeks."

---

# Part 3 — Usage scenarios

Each scenario walks the real product wedge: **NPI → readiness snapshot → packet →
employer review → accept as head start.**

## 3.1 Marisol — NPI to a shared packet

**Trigger.** A recruiter texts her about a step-down contract in Portland. She has ninety
seconds before she is back on the floor.

1. **`/` — NPI entry.** She types her NPI on her phone. This is the whole ask. No account,
   no SSN, no upload.
2. **Readiness snapshot.** Identity comes back from NPPES and it is *her* — right name,
   right taxonomy, right practice location. This is the moment the product earns the next
   sixty seconds. Exclusion status shows **Checked** with what was actually run. Enrollment
   posture reflects PECOS. State licensure shows what is available where access exists —
   and, critically, shows **Access required** where it does not, with a plain sentence
   saying a source exists that VitalCV cannot reach yet.
3. **The one gap.** Her speciality certification is **Self-attested** — she entered it, no
   source confirmed it. The surface says exactly that, without a check glyph, because a
   check may only mean a source backed it.
4. **Her reaction, honestly modelled.** Two beats. First: *relief* — most of this was
   already true and she did not have to build it. Second: *suspicion* — she checks whether
   "Access required" is a euphemism for "we didn't bother". The plain-language meaning is
   what converts the suspicion into trust. If that sentence is vague, she leaves.
5. **Share.** She creates a share for the agency — a public record page under `/p/[slug]`,
   scoped to what she chose. She checks who can see it before she sends it. She sends the
   link by text, because of course she does.
6. **What retains her.** Three weeks later something in her record changes state and she
   finds out from VitalCV rather than from a rejection. That is the retention event. Nothing
   before it is retention.

**Failure mode to design against:** the snapshot renders a wall of states with no hierarchy,
she cannot tell what is *hers to fix* versus what is *the system's limitation*, and she
reads the whole thing as "incomplete" — which reads as "you are not good enough" to someone
who is, in fact, fully qualified.

## 3.2 Denise — receiving a packet on `/review`

**Trigger.** An applicant's file arrives with a VitalCV link attached. She is sceptical
before she clicks.

1. **`/review/[entityId]`.** She opens the packet the clinician chose to share.
2. **She immediately tries to break it.** This is not hostility, it is her job. She looks
   for the strongest claim on the page and tests whether it is backed. If she finds one
   overstatement, the entire packet is worthless to her and probably the vendor too.
3. **Source inspection.** For each lane she needs, at a glance: what source, what it
   returned, when, and whether the freshness window has passed. A lane that says
   **not found** must read as *a source answered and had no active record* — a finding —
   not as *we have nothing*. Those are opposite facts and conflating them is the defect the
   lane map exists to prevent.
4. **The honesty moment that wins her.** She reaches a lane marked **Access required** and
   the product says plainly that a source exists and VitalCV does not have access to it.
   She has never seen a vendor surface volunteer that. It is the single highest-trust event
   in her entire journey — **higher than any positive result** — because it proves the
   positive results are not decoration.
5. **Accept as head start.** She marks the packet accepted: a documented starting point,
   recorded, with provenance. **She has not credentialed anyone.** Primary source
   verification proceeds. The committee still decides. The value is that she began further
   along and can show an auditor exactly where "further along" came from.
6. **Fewer chase emails.** The applicant-side gathering phase shrank. The verification and
   committee phases did not, and any copy implying otherwise loses her permanently.

**Failure mode to design against:** the review surface presents a confidence score, a
percentage, or an aggregate grade. Denise does not want a score. A score is a claim she
cannot audit, and it invites exactly the reliance the truth contract forbids.

## 3.3 Trey — filtering records and submitting a candidate

**Trigger.** A client needs three step-down RNs in Portland, starting in four weeks.

1. **`/explore`.** He filters against actual record state rather than résumé keywords —
   speciality, licensure footprint, what is genuinely ready.
2. **Pre-submission read.** He opens a candidate and sees, before he picks up the phone,
   that her speciality certification is **Self-attested** and one licensure lane is
   **Access required**.
3. **The behaviour change — this is the entire product value to him.** He calls the
   candidate *first*, resolves the certification, and submits a candidate whose outstanding
   items are known and disclosed. Previously he found this out in week three from the client.
4. **Submission.** The packet goes to the client with the gaps stated. He looks like the
   recruiter who does his homework. `[assumption — validate in pilot: whether clients
   actually reward disclosed gaps over apparent completeness — there is a real chance they
   punish it, and that would be a significant finding]`
5. **The gap he still has.** None of this is in his ATS. He will feel that friction by week
   two and it is the most likely cause of pilot drop-off on the recruiter side.

**Failure mode to design against:** `/explore` presents itself as a candidate marketplace.
The moment it looks like a place to *source* clinicians rather than to understand records,
it collides with clinician trust — Marisol's "who else sees this?" — and the supply side is
the moat.

## 3.4 Anand — two minutes, delegated context

1. **`/` — NPI entry**, on a phone, between admissions.
2. **Identity and posture return.** He does not read carefully. He scans for whether it is
   right, and it is.
3. **The hook is not readiness, it is repetition.** The moment that lands for him is
   realising the history he has typed forty times could live somewhere he controls. Copy
   aimed at him must lead there, not at "credentialing".
4. **He shares with his agency coordinator** rather than an employer — the coordinator is
   his actual counterparty. This is a distinct sharing relationship the packet model should
   handle explicitly.
5. **Retention risk.** He will not maintain a record he does not use. His usage cadence is
   quarterly at best, so the record must survive dormancy and re-warm itself, or notify him
   when something changes without him logging in.

## 3.5 Pam — four providers, no employer on the other side

1. She enters **four NPIs** in one sitting.
2. She gets four readiness snapshots and — the thing she has never had — a place that is not
   her binder and not her memory.
3. **The value question.** Right now, does she get renewal warnings on expirables and payer
   enrollment posture in a form that beats a wall calendar? If yes, the free side stands
   alone and she is a genuine user. If the payoff only arrives when an employer accepts a
   packet, she gets nothing, because **there is no employer on the other side of her use
   case.** `[assumption — validate in pilot: this is the sharpest open question in the set]`
4. She asks her providers to keep their records current. She is the only persona with
   institutional authority to ask.

---

# Part 4 — Empathy maps (three primary personas)

## 4.1 Marisol Reyes, RN

| | |
|---|---|
| **SAYS** | "I already sent this." · "Who else can see it?" · "How long is credentialing going to take this time?" · "Is this free-free, or free-for-now?" |
| **THINKS** | *Another portal.* · *If this is a recruiter list in disguise I'm out.* · *Wait — how does it already know my taxonomy?* · *What does 'Access required' actually mean, is that on me?* |
| **DOES** | Screenshots documents to her camera roll · re-types the same employment history · asks in a nursing Facebook group before trusting anything · checks sharing settings before sending · does all of it on a phone |
| **FEELS** | Competent clinically, **infantilised administratively** · anxious about silent expirations · protective of her data · quietly resentful of doing unpaid document labour between contracts |
| **PAINS** | Re-submission loop · lapsed cert she didn't know about · opaque waiting · recruiter noise · unpaid gaps between assignments |
| **GAINS** | Sends a link instead of a packet · finds out about a gap first · starts a contract on time · feels like the record is hers |

**The single insight:** she is not looking to be verified. She is looking to **stop doing
clerical work for other people's systems.** Copy that leads with verification talks past
her; copy that leads with "you already sent this — send a link instead" reaches her.

## 4.2 Denise Kowalski, CPCS

| | |
|---|---|
| **SAYS** | "Does this replace primary source verification?" · "Where did that come from and when?" · "I still have to do my own verification." · "We already have symplr." |
| **THINKS** | *This demo is using a clean file.* · *If I accept this and it's wrong, it's my name on the file.* · *They said 'handles verification' — what does 'handles' mean?* · *Oh. It actually told me it can't reach that source.* |
| **DOES** | Exports to Excel to think · tests the weakest claim on any new surface within ninety seconds · asks peers at NAMSS before believing a vendor · keeps a personal tracking spreadsheet the platform can't replace · still receives faxes |
| **FEELS** | Accountable rather than slow · **defensive about being characterised as the bottleneck** · exhausted by vendor overclaim · genuinely curious when something is honest |
| **PAINS** | Incomplete applications · re-verifying someone verified elsewhere last month · committee cadence · audit exposure · being sold automation for work that legally cannot be automated |
| **GAINS** | Applicant arrives more complete · provenance she can show an auditor · fewer chase emails · a vendor that states its own limits before she finds them |

**The single insight:** **her trust is built by admissions, not by claims.** The
highest-value moment in her entire journey is a surface saying "a source exists here and we
cannot reach it." Design should treat honest limitation as a *feature surface*, not as
apologetic fine print.

## 4.3 Trey Alvarez

| | |
|---|---|
| **SAYS** | "Does it plug into my ATS?" · "How fast can they start?" · "Just tell me what's missing." · "I'm not logging into another thing." |
| **THINKS** | *Every day in credentialing is a day they can take another offer.* · *If I know the gap first I control the conversation.* · *Is this going to make my day longer?* · *Could a client use this to go around me?* |
| **DOES** | Lives on the phone and LinkedIn · keeps his real pipeline in a spreadsheet · submits fast and hopes · chases documents from every candidate individually · abandons tools that don't pay back inside a week |
| **FEELS** | Urgency, constantly · **embarrassment when blindsided in front of a client** · frustration at a lag he cannot influence · competitive |
| **PAINS** | Candidate ghosting during credentialing · invisible gaps · rework · client-side opacity · tool fatigue |
| **GAINS** | Knows the gap pre-submission · differentiated submissions · shorter interview-to-start gap · fewer dead placements |

**The single insight:** his fear is not incompleteness, it is **being surprised**. He can
sell a candidate with a gap. He cannot survive learning about it at the same time as the
client. Sell him *earliness*, never completeness.

---

# Part 5 — Design implications by surface

## `/` — NPI entry

| Persona | Implication |
|---|---|
| Marisol | Mobile-first, one field, **no account before value**. She is standing up. |
| Anand | Under two minutes to something legible, or he is gone permanently. |
| Pam | Must tolerate entering several NPIs in sequence without an account-per-provider ceremony. |

**Trust language:** the promise here is *see what's ready* — never a completion or approval
promise. The first screen after entry is the highest-leverage honesty moment in the product;
if identity comes back right, the next sixty seconds are earned.

## Passport / readiness snapshot (`/passport/[id]`)

Marisol and Anand need a hierarchy the current state list does not naturally provide:

1. **What is source-backed** — the good news, stated without inflation.
2. **What is mine to fix** — `self_attested`, expiring items. Actionable.
3. **What is the system's limit** — `access_required`, `unavailable`. **Explicitly not her
   fault.** This distinction is the difference between a clinician feeling equipped and a
   clinician feeling judged, and it is currently carried only by a tone token.

**States these personas must understand at a glance:** `Source-backed`, `Checked`,
`Self-attested`, `Access required`.

**The `Self-attested` risk:** to a clinician it can read as an accusation. The label is
correct and must stay; the surrounding copy must make clear it is a normal state, not a
deficiency. `[assumption — validate in pilot: whether clinicians read Self-attested as
neutral or as doubt]`

**The `stale` problem:** freshness lives in a separate vocabulary from evidence state.
Marisol will not distinguish "checked a while ago" from "not checked" unless the surface
does it for her — and "checked six months ago" against a source with a 24-hour refresh SLA
is materially different from "checked yesterday". The freshness window belongs next to the
state, in the same glance.

## Public share page (`/p/[slug]`)

This is where Marisol's "who else sees this?" is answered or lost. Requirements:

- **Scope visible before sending, not after.** She must see what the recipient sees.
- Shareable by text — she will not email it.
- No hint that the record is discoverable by parties she did not choose. Any drift toward
  "your profile is visible to employers" collapses supply-side trust.

## `/review/[entityId]` — the reviewer console

Denise's surface, and the one with the least room for error.

- **Provenance per lane, always visible:** source, what it returned, timestamp, freshness
  window. Not behind a disclosure.
- **`not_found` must read as a finding.** "The source answered and had no active record"
  is information. Rendering it as an absence is the failure the lane map guards against.
- **No aggregate score, no percentage, no grade.** She cannot audit a score, and a score
  invites the reliance the truth contract forbids.
- **`Access required` is a feature, not fine print.** Give it real estate. It is her
  highest-trust moment.
- **Accept-as-head-start must be visibly non-terminal.** The interaction should make it
  structurally obvious that PSV continues and the committee still decides. If a reviewer
  could plausibly mistake acceptance for a credentialing decision, the interaction is wrong
  regardless of the disclaimer text.

**States she must understand at a glance:** all seven, plus lane freshness and `not_found`.
She is the only persona who needs the full vocabulary.

## `/explore` — record filtering

Trey's surface, with a standing tension: **it must serve recruiters without becoming a
candidate marketplace.** Filters should describe record state, and the framing should stay
on *understanding readiness* rather than *sourcing people*. The moment Marisol perceives
`/explore` as a list she is on without having chosen it, the supply side breaks.

Trey needs outstanding items **before** submission, surfaced at the list level, not buried
one click deep in a record.

## `/employers`, `/for/cvo`, `/pilot`

| Page | Audience | Lead with |
|---|---|---|
| `/employers` | Economic buyer + Denise | Time-to-start, and — early and unprompted — "this does not replace primary source verification." Denise reads this page too. |
| `/for/cvo` | CVO ops lead | Positioned **beneath** the existing stack, as a receipts layer. Never as a replacement. Naming the incumbents respectfully is a trust move, not a weakness. |
| `/pilot` | Economic buyer | Outcome pricing tied to clinicians who start. Scope that runs alongside the current stack with no rip-and-replace. |

**Copy validation across all three:** no "hire instantly", no completion or approval
guarantees, no coverage claims about every state, and no implication that NPDB, DEA, ABMS,
or real-time Nursys/FSMB are integrated — **they are not**. The truth-contract banned strings
apply to every word on these pages.

## Trust-language matrix

| Persona | Must understand at a glance | Builds trust | **Tests** trust |
|---|---|---|---|
| Marisol | Source-backed, Checked, Self-attested, Access required | Identity returning correctly on the first screen; being told about a change before an employer is | Anything implying her record is visible to people she did not choose |
| Denise | All seven states + freshness + `not_found` | A surface volunteering that a source is out of reach | Any aggregate score; any wording that blurs acceptance into a credentialing decision |
| Trey | Self-attested, Access required, Needs review | Learning a gap before the client does | A second system that does not reach his ATS |
| Anand | Source-backed, Self-attested | Not re-typing the same history | Anything that takes more than one sitting |
| Pam | Source-backed, Self-attested, expiry/freshness | A renewal warning that beats her wall calendar | A product that only pays off when an employer is on the other side |

---

# Part 6 — Objection handling for pilot conversations

| Persona | Objection | Answer |
|---|---|---|
| Denise | "Does this replace primary source verification?" | **No.** It does not. You still verify. The packet arrives with fewer holes and full provenance, so your verification starts from a documented position instead of a blank one. Say this before she asks. |
| Denise | "We already have symplr / Medallion / Modio." | Keep them. This sits beneath the workflow, not in place of it — it changes what arrives *before* the workflow starts. No rip-and-replace, no migration. |
| Denise | "Vendors always overclaim this." | Fair, and you should test us. Open the review surface and find the strongest claim on it. The lanes we cannot reach say so on the page. |
| Economic buyer | "What do we actually pay for?" | Clinicians who start. Not seats, not lookups. Pilot-first, and pricing is a foundation preview — no payments collected at this stage. |
| Economic buyer | "What's the risk?" | The credentialing decision never moves. Nothing in the file becomes less defensible; the provenance record makes it more so. |
| Trey | "Does it plug into my ATS?" | **Not today.** It is a read surface you check before submitting. If that is not worth a tab, the pilot should tell us that rather than us claiming otherwise. |
| Trey | "Could a client use this to go around me?" | Sharing is clinician-controlled — the clinician chooses each recipient. `[assumption — validate in pilot: whether this reassures him or reveals a real structural risk to his role]` |
| Marisol | "Who sees this?" | Only who you send it to. You see the scope before you send it. |
| Marisol | "Free for now, or free?" | Free for clinicians, permanently. Employers and verifier organisations pay. Your trust is the business model, which is exactly why it cannot be spent. |
| Anand | "My agency already does this." | Their file belongs to them and ends with the placement. This one is yours and does not. |
| Pam | "I can't add a subscription or a login." | Nothing to buy. Your providers each hold their own record, and you are no longer the only copy. |

---

# Part 7 — What must be validated in the pilot

Ranked by how much of this document collapses if the answer is unfavourable:

1. **Does the free clinician side stand alone?** Pam's scenario is the clean test — she has
   no employer counterparty. If the record only pays off when a packet is accepted, the
   supply-side moat is conditional on demand-side adoption, which inverts the strategy.
2. **Do clinicians read `Self-attested` and `Access required` as honest, or as deficient?**
   The entire honest-state UX thesis rests on this and it has never been tested with a real
   clinician.
3. **Do employers reward disclosed gaps?** Trey's scenario assumes disclosure is a
   differentiator. It is equally plausible that clients punish visible gaps and recruiters
   learn to hide them — which would be a serious finding about the whole model.
4. **Is `Access required` genuinely Denise's highest-trust moment**, or is it read as an
   incomplete product? This document treats honest limitation as the core trust mechanic.
5. **Does a read-only surface sustain recruiter use without ATS integration?** Assume one
   month of use unless proven otherwise.
6. **What actually retains a clinician?** The hypothesis is: being told about a change
   before an employer is. Nothing else in the product is currently a retention event.

---

*Every statistic and behavioural claim in this document tagged `[assumption — validate in
pilot]` is exactly that. Nothing here is research. Public anchor: the NPPES registry holds
8M+ provider records. Income figures are typical public bands, not researched compensation
data.*
