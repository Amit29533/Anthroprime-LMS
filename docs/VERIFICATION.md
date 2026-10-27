# Verification — 27 October 2026

Environment: Windows, Node 24.21.0. All application data used for checks was disposable local fixture data.

| Check | Result |
| --- | --- |
| LMS automated suite with `EOD_REPO` configured, including RSA/invitation training and UI POV coverage | 38 passed, 0 failed, 0 skipped |
| Actual EOD source contract | Existing account → scored baseline → course/practice completion → new formal assessment; passed |
| Actual HTTP server | Sign-in, HttpOnly cookie, CSRF denial, payload limits, malformed JSON, CSP and source-file isolation; passed |
| Persistence | SQLite reopen, rollback on failure, instance isolation and frozen course content; passed |
| Practice | Wrong answers, feedback, retries, server-side pass criteria, completion bypass denial; passed |
| Authorization | Anonymous callers, wrong roles, another learner's assignment and account deactivation; passed |
| Reassessment retry | Lost upstream response retried with the same saved request and one paper; passed |
| Dependency audit | Zero reported vulnerabilities; no npm runtime dependencies |
| Companion EOD full regression including Training Dashboard | 876 tests: 874 passed, 2 skipped, 0 failed |
| EOD follow-up policy/API checks | 37 passed |

The two EOD skips require its untracked SAMA source workbook.

Browser checks used the real local EOD HTTP service and the real LMS HTTP service. They verified sign-in with an existing EOD candidate, visible assessment-gap recommendations, sequential lesson completion, an incorrect practice answer with explanation, a successful retry and 100% completion, and saved dashboard/path progress. Administrator sign-in and authoring saved an actual draft. The lesson player and course editor had no document-level horizontal overflow at a 390 × 844 viewport; the learner dashboard was checked at 1280 × 900.

The sample course text and synthetic demo candidates are not production learner data. Browser screenshots are retained in the ignored local `.probe/screenshots` folder. Full-page capture was unavailable; viewport captures were used.

No production deployment, physical video playback compatibility, Docker build, backup restoration, or concurrent-room capacity certification is claimed. The CI workflow covers Windows and Ubuntu; its remote status must be checked after a push.

## RSA and invitation-only training

The new tests validate 12 modules, 48 lessons and 144 MCQs; every lesson has three questions, one correct fails and two correct passes. They check that quiz answer keys remain private until submission, first/best/latest scores persist, later failed retries preserve completion, and the plain completion endpoint cannot bypass an attached check.

Invitation tests cover denied sign-in/session/data access before invitation, normalized emails, no automatic course assignment, pending invitations, account binding, email changes, live revocation, cookie clearing and restored access. The real paired-checkout contract traverses the ECOD admin bridge through LMS and back to ECOD identity checks, assigning a course before a finalized assessment report and reading the resulting progress. ECOD tests additionally verify role guards, the fixed upstream destination, disallowed redirects, outage handling and dashboard rendering/interactions with escaped user data.

Browser verification used the local synthetic Rohit account. An uninvited Neha account was refused. Rohit was invited by email in ECOD, then assigned RSA in a separate action. A 1/3 attempt left completion at zero; a 2/3 retry completed one lesson. ECOD showed 1/48 lessons, 2% course completion, 25% of T01, and first/best scores of 33%/67%. Reloading the LMS resumed at the next lesson with saved progress. At 390 × 844 the curriculum is collapsed initially and the lesson had no horizontal document overflow. Screenshots are in the ignored `.probe/screenshots` directory.

Verification used local services and data; no production deployment or migration was performed. Invitations grant access locally and send no email. Instructor-led demonstrations, hands-on execution and formal readiness validation are not represented by an MCQ completion score.

## Experience polish and integration review

The latest local run passes 34 LMS tests, including ten UI POV scenarios and a palette contrast check. The ECOD regression run passes 874 of 876 tests; the same two tests requiring the absent SAMA workbook skip. `npm audit --audit-level=moderate` reports zero vulnerabilities. jsdom is a development dependency for the UI tests; the server still has no npm runtime dependencies.

The UI POV tests drive the actual LMS API/domain with disposable fixtures: candidate sign-in/logout, grading, red/green answer review, explicit retries, first/best/latest scores, completion gates, reassessment requests, network errors with retained answers, duplicate-submit prevention, admin authoring and assignment, live invitation revocation, mobile keyboard navigation, stale responses after navigation, unsaved-edit protection and safe pending saves. The paired ECOD contract verifies the real admin bridge and separate invitation/assignment flow.

Integration fixes:

- Assigned courses and paths remain in the library before a finalized baseline exists, with their original course/path snapshots after updates or archival.
- The general assignment dialog lists only candidates eligible for training access; the API independently enforces the same rule.
- A revoked session preserves its invitation error and ECOD navigation destination on the sign-in screen.
- Correctness feedback belongs to a submitted attempt. Answers are read-only in review, and a new attempt explicitly clears that feedback.
- Failed network submissions retain selected answers and expose an inline retry message. In-flight submissions cannot be duplicated.
- Course edits survive cancelled internal navigation. Inputs and navigation are protected during a pending save, and a late response cannot replace a newer screen.

Visual checks covered learner home, library, My learning, the RSA lesson/check, sign-in, admin overview, course studio/editor, paths, learners, reassessment, activity and Training Dashboard. Breakpoints checked include 320, 390, 768 and 1280 CSS pixels. The inspected views had no document-level horizontal overflow; training tables scroll inside their own labelled regions. Browser checks found no overlapping action controls in the inspected groups. Main content and interactive text were checked for text below 12 px; reading text is 16 px, with 16 px form controls, 15 px answer labels and 44 px minimum primary targets. Small decorative brand/illustration lettering is not instructional text.

Light and dark themes were inspected. The actual success/error text, body text, muted text and primary-action palette pairs meet 4.5:1 contrast. Correct answers use green plus a check/text label; incorrect choices use red plus an X/text label. Motion uses short fade/translation entrances and hover feedback. Browser emulation of reduced motion confirmed page and card animations become `none`; that emulation and viewport overrides were reset after checks.

Local screenshots: `.probe/screenshots/lms-polished-quiz-desktop.png`, `lms-polished-quiz-mobile.png` and `lms-polished-home.png`. Preview data is synthetic; the quiz verification advanced Rohit's RSA assignment to 2/48 lessons, without changing formal ECOD assessment scores.

This is local functional and visual verification, not a production deployment, load test, exhaustive assistive-technology audit or multi-browser certification.

## Focused learning window and course overview

The latest run passes all 38 LMS tests, including 14 UI/presentation POV scenarios. The two actual-checkout ECOD integration tests ran with `EOD_REPO` configured; neither skipped. No ECOD source or backend grading changes were needed for this presentation update.

Assigned courses now open an overview with module cards, completion counts and an ordered lesson list. A dedicated learning window separates reading sections from the knowledge-check introduction, question wizard and answer review. The compute/storage lesson has a five-section presentation with control/compute/storage cards, a compute comparison and a worked example. Other lessons are split at their existing headings into bounded reading sections; original notes and sources remain available in a collapsed disclosure. Stored course bodies, enrollment snapshots, lesson IDs and completion rules are unchanged; no migration or progress reset is required.

Browser checks confirmed native full-screen entry, persistence while changing reading sections, and Escape exit in the in-app browser. Unit POV coverage also checks native full-screen root identity, an expanded-window fallback when the API is unavailable, draft retention, and cleanup on leaving the reader. The outline collapses independently; on phones it overlays the stage with focus containment and a close control. Its course summary stays visible while the lesson list scrolls.

The reading window, final-section navigation, quiz and overview were inspected at 320, 390, 768 and 1280 CSS pixels. Inspected document widths did not exceed the viewport, lesson footers stayed within the viewport, and only one quiz question was visible at a time. Collapsing the desktop outline was explicitly checked to leave the stage at full available width. Reading leads are 17–18 px, concept-card text is 15 px, and quiz answer text is 16–17 px. Light/dark surfaces and reduced motion were checked; reading animation became `none` under reduced motion. Temporary viewport and media overrides were reset. The inspected LMS tab had no captured warning/error logs.

Two deliberately failed three-question attempts using the synthetic Rohit account produced red/green review with text labels and explanations. Neither completed the lesson nor unlocked the next one. ECOD's refreshed Training Dashboard reported the two attempts, with course completion still at 2/48 (4%) and T01 at 50%. Passing/retry flows, score history, invitation revocation, duplicate submissions, retained answers after a network error and reassessment are covered by the disposable-fixture integration/POV tests.

Local screenshots: `.probe/screenshots/reader-dark.png`, `reader-overview-dark.png` and `reader-quiz-review.png`. Screenshots and preview databases are ignored by Git. This is functional and responsive-layout verification in the in-app browser, not exhaustive multi-browser or production certification.

## AnthroPrime brand alignment

The LMS was visually aligned with anthroprime.com using its AP logo, locally hosted DM Sans and Cormorant Garamond fonts, exact ivory/navy/blue/gold palette, serif typography, angular blue hero panel and light/dark surfaces. Font license files are included with the assets.

All 19 automated checks passed after adding the brand assets. The HTTP check also verifies that the font and logo are served with the correct content types. Browser checks confirmed loaded fonts and images, the exact dark background/accent tokens, theme persistence after reload, and no horizontal overflow in the dashboard or library at 390 × 844. Desktop was checked at 1280 × 900. Local evidence is in `.probe/screenshots/anthroprime-*`.
