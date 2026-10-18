# Run Relay

Requires Node.js 24 (the local SQLite adapter uses `node:sqlite`).

```powershell
npm ci
npm run setup
npm run local
```

Open http://127.0.0.1:5173 and create your workspace. The local server applies SQL migrations, stores records in `.local/relay.sqlite`, bundles the same React UI, and runs durable jobs every five seconds. Stop with Ctrl+C and run the same command to resume. Back up the database and the master encryption key. Do not regenerate SECRET_KEY while retaining encrypted connections. Local files and `.env` are ignored by Git. Never use the example placeholders outside local development.

On this Windows environment, the npm shell shim failed under the Sites helper. The equivalent explicit launcher worked:

```powershell
node 'C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js' ci
node --env-file-if-exists=.env scripts/local-server.mjs
```

## Optional local sample data

Stop the local server before seeding. No production seeds run automatically.

```powershell
$env:SEED_PASSWORD='choose-a-development-only-password'
node scripts/seed.mjs
Remove-Item Env:SEED_PASSWORD
npm run local
```

Creates two isolated companies, two Owner accounts (`alex@relay.example`, `jamie@relay.example`), configurable Manager, Admin and User roles, employees, companies, contacts, opportunities and leads. The password is the supplied SEED_PASSWORD. Each Owner can also add labeled demo records from an empty dashboard. Demo sources are illustrative labels; no provider traffic is fabricated. Do not enter real customer numbers in sample data.

## Hosted application

The source includes a Sites/Vinext deployment, D1 schema, and `.openai/hosting.json`. Sites provisions D1 and applies the journaled Drizzle migrations. Use the Sites workflow to build, package, save and privately deploy. Configure APP_URL, SECRET_KEY and WORKER_TOKEN as server runtime secrets/environment values using Sites environment settings, then redeploy. Do not put credentials in the hosting manifest.

Private Sites sign-in is an outer access boundary; Relay password sessions and workspace memberships are enforced inside it. Customer web forms, Twilio and Stripe cannot ordinarily pass private Sites sign-in. Keep the private Site private. For live provider testing, run the local application behind an HTTPS tunnel or deploy to an application host with publicly reachable HTTPS endpoints and a persistent disk/SQLite service. Do not expose the local SQLite file or the `.local` directory. For the Node server behind a reverse proxy, preserve the configured public APP_URL, forward requests to 127.0.0.1:5173 and strip untrusted forwarded client-IP headers.

## Durable worker and realtime updates

Local mode runs escalation and notification work every five seconds. Jobs and attempt counts are database records, so restarting resumes pending deadlines. Notification claims have a 60-second recovery lease. Escalation mutations use conditional versions and guarded audit/notification inserts in a transaction. Acknowledgement preserves the original first-assignment timestamp.

Hosted mode requires an external scheduler to POST `/api/worker` every 15–30 seconds, with `Authorization: Bearer <WORKER_TOKEN>`. An owner-private Site also requires the platform's supported service authorization, if available. Neither a browser being open nor client polling runs the hosted worker. Configure and verify the scheduler before relying on automatic escalations. The app polls persisted state every five seconds; it has no fabricated push updates. Normal alerts can meet the same-minute target only with a running scheduler and a healthy provider.

## Provider setup

Enter credentials through Integrations as an authorized administrator. Credentials are workspace-specific and encrypted with AES-GCM. An untested saved connection reads **Configured**, not verified Connected. Operation history displays real successes, failures and rejected signatures.

### Twilio WhatsApp Sandbox (SMS is also supported)

1. Activate the WhatsApp Sandbox in your Twilio account. Join it from each test phone using Twilio's join instructions.
2. Save Account SID, auth token and sender (e.g. `whatsapp:+14155238886`) in Relay. For SMS use an SMS-enabled Twilio number without the prefix.
3. In the Sandbox incoming-message configuration, select POST and use `https://PUBLIC-ORIGIN/api/webhooks/twilio/WORKSPACE-ID`. Copy the workspace ID from the integration form.
4. Outbound status callbacks use the same endpoint with `?status=1`; APP_URL must exactly match the public HTTPS origin. Validation covers the full URL, query string and sorted form parameters using Twilio HMAC-SHA1.
5. Send from your phone, reply in Conversations, and confirm real delivery states. Repeated MessageSid deliveries deduplicate. STOP/UNSUBSCRIBE/CANCEL sets opt-out. Outbound sends stay blocked until the contact explicitly opts in and an authorized employee updates that preference.

Recipients must join the Sandbox; business-initiated conversations outside the 24-hour window need approved templates. Sandbox delivery is not production WhatsApp onboarding. See [Twilio signature validation](https://www.twilio.com/docs/usage/webhooks/webhooks-security) and [Sandbox limitations](https://www.twilio.com/docs/whatsapp/sandbox).

### Stripe test mode

1. Use an `sk_test_…` secret key. Relay rejects live secret keys.
2. Create a **snapshot** webhook destination in test mode for `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, and `charge.refunded`.
3. Use `https://PUBLIC-ORIGIN/api/webhooks/stripe/WORKSPACE-ID` and save its `whsec_…` signing secret in Relay. For a local listener use `stripe listen --forward-to http://127.0.0.1:5173/api/webhooks/stripe/WORKSPACE-ID` and use the listener's secret.
4. Create a payment request from an opportunity or Payments. Amounts are integer minor units. Open Checkout and use Stripe's documented test card. Sending the link through Twilio is a separate explicit action.
5. Confirm the signed event changes the request to paid. Repeat delivery and confirm one collection entry. Refund in Stripe test mode and confirm cumulative refunds and the negative collection ledger entry.

Raw-body HMAC verification includes a five-minute timestamp tolerance. Redirects never confirm payment. Abandoned checkout remains pending until the real expiration event. Paid sessions awaiting asynchronous settlement read processing. A collection ledger records confirmed payment and refund times separately; the monthly figure sums ledger amounts in the workspace timezone. Currency totals remain separate; forecasts and unpaid requests are never added together. See [Stripe webhooks](https://docs.stripe.com/webhooks), [Checkout sessions](https://docs.stripe.com/api/checkout/sessions), and [event types](https://docs.stripe.com/api/events/types).

### Google Calendar OAuth

1. Create a Google Cloud project, enable Google Calendar API, and configure an OAuth consent screen with your test employees.
2. Create a Web application OAuth client. Register the exact callback `https://PUBLIC-ORIGIN/api/oauth/google/callback` (localhost callbacks are suitable for development).
3. Save client ID and client secret in Integrations. Each employee then clicks **Connect Google Calendar** while signed in to their Relay account.
4. The app requests calendar event and free/busy scopes with offline consent. Tokens are encrypted server-side, access tokens refresh automatically, and unusable refresh tokens produce a reconnection state.
5. Book, reschedule and cancel an appointment; verify the real primary calendar event. Google free/busy conflicts block booking unless explicitly accepted. When rescheduling, free/busy can include the original appointment; move to a free time or explicitly confirm that warning.

Timestamps are UTC milliseconds. Booking inputs use the browser timezone, explicitly labeled; stored appointments display in the employee timezone. Disconnection removes the stored connection. See [Google web-server OAuth](https://developers.google.com/identity/protocols/oauth2/web-server) and [Calendar free/busy](https://developers.google.com/workspace/calendar/api/v3/reference/freebusy/query).

### Resend escalation email

1. Configure a verified sending domain and API key in Resend.
2. Save the API key and verified sender email in Integrations.
3. Every employee sets their notification email under Your profile; an authorized team manager can also configure it.
4. Configure short demonstration windows (minimum five seconds), run the worker, ignore a lead, and verify the new owner's real email contains name, source, reason and lead link.
5. Temporary failures retry with bounded exponential delay, up to four attempts. Permanent or exhausted failures appear in Integrations and support an explicit retry after configuration is fixed. Missing provider credentials cannot produce a success.

See [Resend send-email API](https://resend.com/docs/api-reference/emails/send-email) and [idempotency](https://resend.com/changelog/idempotency-keys).

## Verification and demo script

```powershell
npm test
npm run typecheck
npm run build
```

1. Sign up two workspaces and confirm each has its own contacts, pipelines and roles. Use the tests for guessed-ID requests.
2. Create a contact, a manual lead and an opportunity. Acknowledge the assigned lead and verify no escalation follows.
3. Add a Number field to one pipeline, require it at the next stage, attempt a move, fill it and retry. Open the other pipeline to verify its separate field set.
4. Combine source, owner and tag filters. Save the dynamic view, change a tag and reopen the view.
5. Invite a User, grant export without values, and inspect the response/export for missing monetary fields. Direct unauthorized settings and audit mutations are rejected.
6. Set an employee Available, set windows to 5, 5, 5 seconds, ignore a lead and observe ownership history and recovery reasons. Restart local mode while a job is pending; verify it resumes.
7. Set the assignee Offline. Unacknowledged leads move; acknowledged leads stay. Manual reassignments have their own audit event.
8. Complete the live provider steps above. These require your accounts, secrets, phones and Google consent; fixture tests do not replace them.

See ACCEPTANCE.md for verified checks and outstanding limitations.

## WhatsApp templates and reply windows

Relay checks for an inbound WhatsApp message in the preceding 24 hours before sending a free-form WhatsApp reply. SMS is exempt. Older records incorrectly labeled WhatsApp are not automatically rewritten.

In Conversations, choose **Template**, or select **Approved WhatsApp template** in the message dialog. Copy an approved Content SID from Twilio Content Template Builder (HX followed by 32 hexadecimal characters). Enter variables as a JSON object such as `{"1":"Taylor","2":"Tuesday"}`. Relay sends ContentSid and ContentVariables; Twilio remains authoritative for approval, recipient eligibility and delivery. Templates are referenced manually; template catalog synchronization and previews are not implemented.

Failed template retries preserve the original template and variables. Text retries recheck the reply window. Existing opt-out restrictions apply to both. These paths have mocked-provider coverage, not live-delivery acceptance.
