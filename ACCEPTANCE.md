# Verification report

Verified locally on 18 October 2026. `npm test` passes six test groups covering the critical API workflows. TypeScript checking and a production Vinext build pass. No available browser surface was present in the session, so visual/keyboard/mobile browser inspection is **unverified**. No provider credentials were supplied, and **no live provider acceptance is claimed**.

| # | Required scenario | Status and evidence |
|---|---|---|
| 1 | Signup creates Owner/workspace | Pass, workflow test |
| 2 | Guessed IDs cannot cross workspaces | Pass, workflow test |
| 3 | Monetary values protected in API/export | Pass, workflow test; UI derives from redacted response |
| 4 | Custom fields and two pipelines | API pass; configuration interface implemented, browser interaction unverified |
| 5 | Required fields block transitions | Pass, workflow test |
| 6 | Three-criterion dynamic saved view | Persistence tested; client evaluates saved filters against current state; browser interaction unverified |
| 7 | Web intake and eligible assignment | Shared assignment implementation; capacity/fallback tested; live public form blocked by private hosting ingress |
| 8 | Acknowledgement stops escalation | Pass, workflow test |
| 9 | Levels and real external alert | Local transitions tested; live Resend delivery blocked by credentials; hosted scheduler must be configured |
| 10 | Offline reassigns unacknowledged leads | Pass, workflow test; acknowledged-lead policy displayed |
| 11 | Concurrent workers do not double escalate | Pass, workflow test; transactional conditional updates |
| 12 | Pending escalation survives restart | Pass, disk database close/reopen test |
| 13 | Real inbound Twilio message | Signature/normalization/record creation tested with fixture; real phone blocked by credentials and HTTPS ingress |
| 14 | Duplicate message events deduplicate | Pass, workflow test; provider MessageSid unique record identity; unique normalized contact phone index |
| 15 | Reply reaches phone and delivery states | Adapter, callbacks, failure and retry UI implemented; live delivery unverified |
| 16 | Invalid signatures rejected | Pass, both Twilio and Stripe fixtures |
| 17 | Stripe test payment updates opportunity relationship | Signed fixture updates linked payment; live Checkout blocked by account credentials |
| 18 | Duplicate payment events do not duplicate revenue | Pass, workflow test; stable collection ledger identities |
| 19 | Refund updates collected revenue | Signed refund fixture passes; live refund unverified |
| 20 | Google event create/reschedule/cancel | HTTP adapters and UI implemented; live consent/account required |
| 21 | Conflicts/disconnected calendars | Disconnected action tested; real free/busy check unverified |
| 22 | Recovery/dashboard match records | Derived from database records, with separate currency ledger; browser-level reconciliation unverified |
| 23 | Audit cannot be mutated | API rejection plus database immutable triggers tested; role-restricted full audit read |
| 24 | Provider outage leaves CRM usable | Provider actions are isolated; missing connections/opt-out failure tested; real provider outage not exercised |

## Implemented deliverables

- Complete source in app/, styles/, lib/, db/ and scripts/.
- SQL migrations and Drizzle schema/journal; workspace lookup and contact deduplication indexes; append-only audit triggers.
- Password hashing, expiring/revocable cookie sessions, account/IP throttling, server permission checks and workspace-scoped reads/writes.
- Configurable role permissions; Manager uses the User base. Owner cannot be modified by another role. Invitations are links to share, not automatically sent emails.
- Contacts, companies, opportunities, multi-pipeline stage settings, custom fields, archived fields, required transitions, combined filters and saved views.
- Availability, round-robin intake with atomic capacity selection, explicit and activity acknowledgements, versioned escalation, recovery, manual reassignment and notification retries.
- Real HTTP adapters for Twilio, Stripe, Google and Resend, AES-GCM secret storage, signatures, event history and test-mode restrictions.
- Responsive UI for every primary screen, explicit provider states, contact history and five-second polling.
- Two-workspace seed command, placeholder environment template, startup/provider/HTTPS/worker instructions and a demo script in SETUP.md.

## Remaining limitations

These are explicit limits, not completed acceptance claims:

- Hosted background scheduling and provider/public intake ingress are external deployment configuration. The owner-private Site is an application review surface; it cannot receive ordinary unauthenticated provider webhooks. Local mode has a persistent background worker. Do not rely on hosted automatic escalation before configuring and verifying the scheduler.
- The connected UI hydrates up to 5,000 records per entity and evaluates combined saved views in the client. `/api/search` supplies workspace-scoped server filtering/pagination (25 default, maximum 100), but the main UI has not been converted to use it. High-volume dashboard metrics beyond that loaded-record limit require server-side aggregate endpoints. This implementation is not validated for large historical datasets.
- Automatic bounded retries are implemented for escalation email. Outbound Twilio errors support explicit retry. Checkout and calendar API errors require an explicit retry; a generic durable provider-operation outbox is not implemented. Blind automatic retries of uncertain external creates could duplicate actions.
- Intake selects capacity atomically in SQL. Automatic reassignments also check recipient capacity inside the conditional update and retry competing choices. The final responsible recipient is an accountable recovery fallback and may hold leads beyond ordinary distribution capacity; this is shown in recovery. Authorized manual reassignment may intentionally exceed capacity.
- CRM fields are JSON records with application validation and database triggers that enforce workspace-specific contact/company/pipeline/stage/owner references, safe deletion and safe stage removal. Native foreign keys cover workspace/user/session relationships. Dedicated normalized tables would improve reporting and schema evolution at larger scale.
- Google free/busy can flag the existing event when rescheduling into its own time slot; the interface offers explicit conflict acceptance. Cross-system Calendar creates are not distributed transactions, so a remote success followed by a failed local write requires reconciliation.
- Failed payment-request creation is retained for history. There is no request-creation retry button on that failed request; create a fresh request from the opportunity after fixing configuration. Stripe's own Checkout/event retries handle confirmation delivery.
- Authentication includes recognized salted PBKDF2-SHA256 (100,000 iterations for Worker Web Crypto compatibility). No password-reset/email-verification flow was specified or added. Security review and rate-limit tuning are still needed before exposing a public production service.
- Accessibility markup, responsive layouts, focus styles and labeled forms are implemented, but a full browser accessibility audit and focus trapping for dialogs remain outstanding.
- No live provider operations, externally reachable intake, hosted scheduling SLA, mobile browser layout or third-party consent was verified in this session.

The application is a working, persistent implementation for local evaluation with a private hosted review surface. The limits above mean it should not yet be represented as fully accepted or production hardened.
