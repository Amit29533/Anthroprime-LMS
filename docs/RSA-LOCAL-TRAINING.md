# RSA local training

The RSA course contains **12 modules, 48 lessons and 144 MCQs**. Each lesson includes its reading followed by exactly three questions. Two correct answers complete the lesson. Candidates may retry, with first, best and latest scores recorded separately. An unsuccessful retry does not erase a previous completion.

The course is a self-paced knowledge component of the supplied readiness program. Completion does not change ECOD assessment scores, certify enterprise readiness, or replace a hands-on lab, client simulation or independent evaluation.

## Source analysis and coverage

| Source | Treatment |
| --- | --- |
| Standalone T01 and T02 PowerPoints | Exact SHA-256 duplicates of the corresponding decks in the ZIP; imported once |
| T01–T09 decks | Nine modules, four lessons each; pairs of related teaching topics form each lesson |
| C01–C02 and C03–C04 decks | Two combined consulting modules, four lessons each |
| Curriculum workbook v1.2, P01–P04 | One communication module with four written lessons and 12 authored MCQs; no matching teaching decks were supplied |
| Earlier curriculum workbooks | Compared as earlier outlines; v1.2 determines communication coverage |
| Trainer companions and slide notes | Used to identify facilitator material and verify practice answer keys; full notes, hidden-case facts and unseen assessment vignettes are not sent to learners |
| Readiness program PDF | Establishes the three pillars and distinction between enrichment and independent readiness validation |
| Trainer NDA/IP agreement | Administrative material; excluded from the learner course |
| CG image references | Retained in the original source archive, not published as lessons |
| Empty T10 directory | No T10 teaching content imported or represented as complete |

F01/RSA00 is an outline in the curriculum, without its own supplied teaching pack. The introductory platform/value concepts appear in T01; this is not a separately scored F01 exit. F02's unseen client simulation and independent readiness gate remain a formal assessment activity outside the LMS knowledge checks.

`content/rsa-source-map.json` records the originating deck, its SHA-256, slide ranges and selected question identifiers for the 44 deck-derived lessons. `rsa-communication.mjs` identifies the workbook topic for each additional lesson. Repeated answer positions from the source decks are rotated. Answer keys and explanations stay on the server until a practice attempt is submitted.

The source decks' absolute claim that storage is always in a customer-owned account was corrected to account for Databricks-managed default storage. See [Databricks default storage](https://docs.databricks.com/aws/en/storage/default-storage) and [high-level architecture](https://docs.databricks.com/aws/en/getting-started/high-level-architecture/), checked 27 October 2026. Teaching examples remain illustrative. Product availability and cloud-specific behavior should be checked against the actual workspace when running labs.

Lesson durations are estimates for this reading-and-MCQ course. The longer instructor-led hours in the workbooks include demonstrations, labs, role-plays and validation and are not claimed by these estimates.

## Invitation and assignment

1. Sign in as an ECOD administrator and open **Training Dashboard**.
2. Enter the email on the candidate's ECOD account and choose **Grant training access**. This adds an access-list entry locally; **no email is sent**.
3. Choose the candidate and the RSA course under **Assign a course**. Inviting does not assign a course automatically.
4. The candidate signs in to the LMS using their existing ECOD ID and password, including their existing MFA if enabled, and opens the course from **My learning**.
5. Use **Refresh progress** and **Lesson details** in ECOD to inspect completion by course/module and first/best/latest quiz scores and attempt counts.

An invitation can be added before an ECOD account exists. It remains pending until a candidate account has that email. It does not create an account or a password. Missing/ambiguous emails must be corrected in ECOD Users & Access. Assignment requires one active candidate account and an active invitation. Administrators may enter training without an invitation to manage it.

Email matching trims whitespace and ignores case. Once an invitation is linked to an ECOD user and candidate, another account cannot inherit it by reusing the email. The portal checks invitations at sign-in, session restore and every protected candidate API call. Revocation blocks the next such request while preserving progress; restoring access resumes the same assignment. Training cannot retract content already displayed in a browser.

## Local services

The current preview uses these local stores:

- ECOD: `../EOD-simple-review/data/lms-eod-preview.json`.
- LMS: `data/lms-preview.sqlite`, including WAL/SHM files while running.

Run ECOD in one PowerShell terminal from its repository:

```powershell
$env:STORAGE = 'json'
$env:DATA_FILE = 'data/lms-eod-preview.json'
$env:HOST = '127.0.0.1'
$env:PORT = '3131'
$env:LMS_WEB_URL = 'http://127.0.0.1:3140'
node server.mjs
```

Run LMS in a second terminal from this repository:

```powershell
$env:EOD_API_URL = 'http://127.0.0.1:3131/api'
$env:EOD_WEB_URL = 'http://127.0.0.1:3131'
$env:LMS_DATABASE = 'data/lms-preview.sqlite'
$env:APP_ORIGIN = 'http://127.0.0.1:3140'
$env:HOST = '127.0.0.1'
$env:PORT = '3140'
node server.mjs
```

Open [ECOD Training Dashboard](http://127.0.0.1:3131/#/training) and [LMS](http://127.0.0.1:3140/#/home). The two apps use the same account credentials; opening the other app can still require signing in again.

## Rebuild or import content

The generated content is already in `content/`; the ZIP is only needed to rebuild it. Original documents are not modified, extracted into public assets, or uploaded.

```powershell
python scripts/build-rsa-course.py 'D:\Downloads\4. Upskilling.zip'
$env:LOCAL_ECOD_PASSWORD = '<local ECOD administrator password>'
npm run seed:rsa
```

Use the EOD and LMS database environment settings above for the import. It accepts only a loopback ECOD instance, refuses production, verifies the RSA track, and imports through the same course validation rules. Repeating an unchanged import is a no-op. Changes create a new course version for future assignments; existing enrollments keep their snapshot. Importing grants no invitations and makes no assignments.

## Integration boundary and tests

ECOD's `/admin/training` routes require a live administrator session and call only the configured LMS `/api/integration/training` routes. LMS validates the forwarded administrator token with ECOD. The token is never included in dashboard JSON or a URL. Requests have deadlines and disallow redirects. The two apps do not share databases or expose cross-origin browser access. An LMS outage shows an error without ending the ECOD session.

```powershell
$env:EOD_REPO = 'C:\path\to\EOD-simple-review'
npm test
```

The complete dashboard contract needs the companion ECOD training changes. Against the older ECOD revision pinned in CI, the existing assessment contract still runs and the new dashboard contract explicitly skips until that companion change is available. Verification used local services and disposable fixtures. Publishing the LMS source does not deploy either service, migrate preview data, or publish the companion ECOD changes.

Browser verification uses synthetic local accounts. Rohit Verma was invited and assigned the RSA course separately for the preview; his first lesson records 33% then 67%. The later UI-polish check advanced the preview to 2/48 lessons complete. Other candidates were not granted access. Legacy sample records that predate first-score tracking display an unknown first score rather than inventing one.
