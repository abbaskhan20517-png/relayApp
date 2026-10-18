# Relay implementation plan

React/Vinext provides the responsive application; the same server domain layer runs against Cloudflare D1 in Sites and Node SQLite locally. SQL migrations own the schema. Provider HTTP adapters and encrypted credential storage are server-only. A durable jobs table and conditional versioned transitions drive escalation and retries. Hosted cron invocation requires a separately configured scheduler; the local server runs a worker every five seconds.

## Relationships
Workspace → users, roles, contacts, companies, pipelines, leads, integrations, audit, jobs. Pipeline → stages and custom field definitions. Contact → company, opportunities, leads, messages, payments, appointments, activities. User → role, assigned leads, calendar connection. Opportunity → pipeline, stage, contact. All child lookups require workspace identity. Audit is append-only.

## Phases and checklist
1. Schema, authentication, sessions, workspace isolation and permissions.
2. Contacts, companies, multiple pipelines, custom fields, saved filters and contact history.
3. Eligible assignment, acknowledgement, durable escalation, availability and recovery.
4. Twilio, Stripe, Google OAuth/Calendar and Resend adapters; integration administration and synchronization history.
5. Dashboard, responsive UI, security and workflow tests, setup and acceptance report.

## Decisions
- Open leads are leads not closed; acknowledgement does not remove capacity usage. Acknowledged leads stay with their owner on leave/offline. Unacknowledged leads are reassigned immediately.
- No eligible employee means a visible recovery item, with the workspace Owner as accountable recovery recipient. Final escalation is terminal and stays visible until acknowledged or manually recovered.
- Workspace timezone defaults to Asia/Karachi; timestamps are UTC milliseconds, money is integer minor units. Currency totals are always separate. Opportunity forecasts and unpaid requests overlap and are never summed together.
- Abandoned checkout stays pending until Stripe reports expiry; redirects never confirm payment.
- Integration credentials are per-workspace AES-GCM encrypted using an externally configured master key. Missing credentials disable provider actions with an explanation.
- Password accounts are required by the brief; hosted Sites sign-in is an additional outer access boundary. Private Site ingress cannot accept ordinary provider webhooks; live verification requires supported authenticated ingress or deployment to a public HTTPS application host.
- Invitation links are generated for the Owner to share; sending invitations is deliberately not automatic.
- Demo data is explicitly labeled, optional and stored in the database; no fabricated provider successes.

See ACCEPTANCE.md for verified coverage and remaining limits.
