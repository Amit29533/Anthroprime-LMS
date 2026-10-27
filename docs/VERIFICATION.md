# Verification — 27 October 2026

Environment: Windows, Node 24.21.0. All application data used for checks was disposable local fixture data.

| Check | Result |
| --- | --- |
| LMS automated suite with `EOD_REPO` configured | 19 passed, 0 failed, 0 skipped |
| Actual EOD source contract | Existing account → scored baseline → course/practice completion → new formal assessment; passed |
| Actual HTTP server | Sign-in, HttpOnly cookie, CSRF denial, payload limits, malformed JSON, CSP and source-file isolation; passed |
| Persistence | SQLite reopen, rollback on failure, instance isolation and frozen course content; passed |
| Practice | Wrong answers, feedback, retries, server-side pass criteria, completion bypass denial; passed |
| Authorization | Anonymous callers, wrong roles, another learner's assignment and account deactivation; passed |
| Reassessment retry | Lost upstream response retried with the same saved request and one paper; passed |
| Dependency audit | Zero reported vulnerabilities; no npm runtime dependencies |
| Companion EOD full regression | 874 tests: 872 passed, 2 skipped, 0 failed |
| EOD follow-up policy/API checks | 37 passed |

The two EOD skips require its untracked SAMA source workbook.

Browser checks used the real local EOD HTTP service and the real LMS HTTP service. They verified sign-in with an existing EOD candidate, visible assessment-gap recommendations, sequential lesson completion, an incorrect practice answer with explanation, a successful retry and 100% completion, and saved dashboard/path progress. Administrator sign-in and authoring saved an actual draft. The lesson player and course editor had no document-level horizontal overflow at a 390 × 844 viewport; the learner dashboard was checked at 1280 × 900.

The sample course text and synthetic demo candidates are not production learner data. Browser screenshots are retained in the ignored local `.probe/screenshots` folder. Full-page capture was unavailable; viewport captures were used.

No production deployment, physical video playback compatibility, Docker build, backup restoration, or concurrent-room capacity certification is claimed. The CI workflow covers Windows and Ubuntu; its remote status must be checked after a push.

## AnthroPrime brand alignment

The LMS was visually aligned with anthroprime.com using its AP logo, locally hosted DM Sans and Cormorant Garamond fonts, exact ivory/navy/blue/gold palette, serif typography, angular blue hero panel and light/dark surfaces. Font license files are included with the assets.

All 19 automated checks passed after adding the brand assets. The HTTP check also verifies that the font and logo are served with the correct content types. Browser checks confirmed loaded fonts and images, the exact dark background/accent tokens, theme persistence after reload, and no horizontal overflow in the dashboard or library at 390 × 844. Desktop was checked at 1280 × 900. Local evidence is in `.probe/screenshots/anthroprime-*`.
