# Anthroprime Learning

Candidate-first courses, practice quizzes, learning paths and progress, connected to [EOD-simple](https://github.com/Amit29533/EOD-simple).

Learners use their existing **EOD username/email and password**. EOD owns accounts and formal assessments; this repository owns learning content and progress. No second account is created.

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

See [architecture and scope](docs/ARCHITECTURE.md). Managed uploads, automatic cross-origin SSO, notifications, certificates and trainer permissions are planned.

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

Sample seeding is restricted to a local loopback EOD fixture and refused in production. It creates three courses, three practice quizzes and a learning path, assigning the path to the fixture's Neha or Rohit candidate if present. It does not create EOD users, change assessment results or print tokens.

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

The contract test builds disposable EOD data and verifies a scored baseline → learning and practice → newly allocated formal assessment. It never uses production accounts. Without `EOD_REPO`, that one test explicitly skips. CI checks out a pinned EOD revision and runs it on Windows and Ubuntu.

## Connect EOD navigation

The companion EOD change supports an optional `LMS_WEB_URL` setting. Set it to the LMS browser URL to show **Continue learning** in the candidate journey. LMS works against EOD's current APIs without that navigation change.

Shared credentials work now. Automatic browser-session handoff needs the planned OIDC integration, so opening the other application can require signing in again with the same account.

## Deployment boundary

The Dockerfile targets a single persistent Node service behind an HTTPS reverse proxy. Mount `/app/data` on a durable volume. Do not use ephemeral function storage or independent database copies across replicas. The Docker image has not been built or deployed during local verification.

Before live use, establish database/media backups and retention, coordinated EOD/LMS deletion, load targets and monitoring. Video lessons currently use HTTPS media links; managed uploads are a separate increment.

License: GPL-3.0, preserved from the original repository.
