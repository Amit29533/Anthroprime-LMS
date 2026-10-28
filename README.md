# Anthroprime Learning

Candidate-first courses, practice quizzes, learning paths and progress, connected to [EOD-simple](https://github.com/Amit29533/EOD-simple).

Learners use their existing **EOD username/email and password**. EOD owns accounts and formal assessments; this repository owns learning content and progress. No second account is created.

Candidate training is now **invitation only**. Administrators grant access by ECOD account email and assign courses separately in the **Training Dashboard** in ECOD or LMS. Invitations are a local access list; no email is sent. See [RSA course, source analysis and local instructions](docs/RSA-LOCAL-TRAINING.md).

The ECOD-side Training Dashboard requires its companion ECOD changes. The LMS dashboard is included here; publishing this repository does not publish or deploy the ECOD changes.

## Implemented

- Responsive learner dashboard, searchable library, ordered learning paths and lesson player.
- Articles, HTTPS video/resource links and short practice quizzes with explanations and retries.
- Server-side grading, sequential lessons and persistent progress.
- Course authoring, competency mapping, publication, archival, path authoring and candidate assignment.
- Frozen content for existing enrollments and conflict detection for author edits.
- Recommendations from finalized EOD capability gaps.
- Reassessment requests and administrator allocation through EOD, using retry-safe request IDs.
- Shared credentials, MFA support, live account checks and encrypted HttpOnly cookies.
- Transactional SQLite storage and audit events; domain, security, HTTP and real EOD contract tests.
- RSA course from the supplied materials: 12 modules, 48 lessons, three MCQs after every lesson; pass two of three with retries.
- ECOD Training Dashboard with invitation/revocation, course assignment, module completion, and first/best/latest quiz scores.
- Readable responsive layouts, light/dark themes, reduced-motion support, accessible mobile navigation and explicit green/red MCQ review.
- Candidate/admin UI POV tests, retained answers after network errors, unsaved-edit protection and safe pending saves.

See [architecture and scope](docs/ARCHITECTURE.md). Managed uploads, automatic cross-origin SSO, notifications, certificates and trainer permissions are planned.

The interface follows [AnthroPrime's visual identity](https://anthroprime.com): the AP mark, locally hosted Cormorant Garamond / DM Sans fonts, ivory and charcoal surfaces, navy-blue panels and warm gold accents. Both light and dark themes are supported. Font licenses and asset provenance are included in `public/assets/`.

## Run locally

Use **Node 24.15 or later in the Node 24 series**. There are no npm runtime dependencies; storage uses Node's built-in SQLite API.

```powershell
npm ci --ignore-scripts
Copy-Item .env.example .env
```

Set `EOD_API_URL` to the running assessment API, for example `http://127.0.0.1:3131/api`, and `EOD_WEB_URL` to its browser origin. Set `APP_ORIGIN` to the exact LMS browser URL. `localhost` and `127.0.0.1` are different origins.

```powershell
npm start
```

Open [the local LMS](http://127.0.0.1:3140) and sign in with an existing candidate or administrator account. `.env` and generated databases are ignored by Git. An omitted development session key is generated in memory; restarting signs users out without deleting progress.

No production EOD URL or secret is committed. Production requires HTTPS, a correct `APP_ORIGIN`, a 64-character hexadecimal `LMS_SESSION_KEY`, persistent storage and reverse-proxy edge throttling.

## Optional sample content

Sample seeding is restricted to a local loopback EOD fixture and refused in production. It creates three courses, three practice quizzes and a learning path. Administrators invite and assign candidates separately. It does not create EOD users, change assessment results or print tokens.

```powershell
$env:DEMO_EOD_PASSWORD = '<local EOD fixture administrator password>'
npm run seed:demo
```

No sample learning data is created automatically at startup.

## Verify

```powershell
npm test
npm audit --audit-level=moderate
```

For the actual EOD contract, point to a local source checkout:

```powershell
$env:EOD_REPO = 'C:\path\to\EOD-simple'
npm test
```

The contract tests build disposable EOD data and verify the assessment/learning cycle and the admin training bridge. They never use production accounts. Without `EOD_REPO`, both contracts explicitly skip; the dashboard contract also needs the companion ECOD training changes. CI still checks out its pinned EOD revision and runs the supported contracts on Windows and Ubuntu.

## Connect EOD navigation

The companion EOD change supports an optional `LMS_WEB_URL` setting. Set it to the LMS browser URL to show **Continue learning** in the candidate journey. LMS works against EOD's current APIs without that navigation change.

Shared credentials work now. Automatic browser-session handoff needs the planned OIDC integration, so opening the other application can require signing in again with the same account.

## Learning experience

Candidates get a top-navigation workspace (Home, My learning, Library, Assessments) with generated course covers, a **Continue learning** card that jumps straight to the next lesson, and status filters for assigned courses. The sign-in page uses existing ECOD credentials, with a show-password control and an optional authenticator code.

A course page shows a banner, a progress card (lessons, incomplete, completed) and a **Lessons** tab that groups lessons by module with done, current and locked states. An **About** tab covers outcomes and how the course works.

Opening a lesson enters a full-window player with a collapsible course outline. Each lesson is a single readable page: the full text, a highlighted learning goal, structured lists, sources as footnotes, an **On this page** list on wide screens and a reading-progress bar. Nothing is hidden behind a disclosure. Each knowledge check has an introduction (questions, pass mark, attempts), one question at a time, and a results screen with a score ring, a pass or not-yet badge and a red/green review with explanations. **Notes** keeps per-lesson notes in the browser (this device only). The **Full screen** control uses browser full screen when supported, with an expanded-window fallback; **Esc** or **Exit full screen** returns. Presentation changes preserve existing course snapshots and candidate progress.

## Deploy on Netlify

`netlify.toml` publishes `public` as static pages and runs one function (`netlify/functions/api.mjs`) for `/api/*` and `/health`. A function has no durable disk, so learning data lives in Netlify Blobs: each request loads the dataset into an in-memory store and a request that changed something saves it back only if no other request saved first (otherwise it is replayed on the newer data). Deploy previews and branch deploys use their own Blobs store, never the live one.

1. In Netlify, import the repository. The build settings come from `netlify.toml`; leave them as they are.
2. Add these environment variables (scope: Functions and Runtime):

   | Variable | Value |
   |---|---|
   | `EOD_API_URL` | `https://ecod.anthroprime.com/api` |
   | `EOD_WEB_URL` | `https://ecod.anthroprime.com` |
   | `LMS_SESSION_KEY` | 64 hexadecimal characters: `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"` |
   | `APP_ORIGIN` | Optional. The LMS address, for example `https://learning.anthroprime.com`. Without it the address the browser used is accepted. |

3. Deploy, then set `LMS_WEB_URL` on the ECOD site to the LMS address and redeploy ECOD, so its Training Dashboard can reach the LMS.
4. Publish the RSA course once (safe to re-run):

   ```powershell
   $env:LMS_URL = 'https://learning.anthroprime.com'
   $env:EOD_API_URL = 'https://ecod.anthroprime.com/api'
   $env:ECOD_ADMIN_PASSWORD = '<ECOD administrator password>'
   npm run publish:rsa
   ```

5. Invite candidates and assign the course from ECOD's **Training Dashboard**.

The whole dataset is one blob, which suits a training cohort (hundreds of candidates). The sign-in limit is per function instance on Netlify, so ECOD's own throttle remains the main defence against password guessing.

## Deployment boundary

The Dockerfile targets a single persistent Node service behind an HTTPS reverse proxy. Mount `/app/data` on a durable volume. Do not use ephemeral function storage or independent database copies across replicas. The Docker image has not been built or deployed during local verification.

Before live use, establish database/media backups and retention, coordinated EOD/LMS deletion, load targets and monitoring. Video lessons currently use HTTPS media links; managed uploads are a separate increment.

License: GPL-3.0, preserved from the original repository.
