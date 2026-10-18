# Relay — Unified Business Management Platform

Relay is a web application for small service businesses that brings
lead management and customer operations into one workspace.

Its central goal is to prevent missed leads through clear ownership,
acknowledgement deadlines, and automated escalation.

## Project status

In development.

Feature availability and integration verification are documented below.
Some functionality may require external provider credentials.

## Planned capabilities

- Isolated company workspaces and role-based permissions
- Contacts, companies, and sales opportunities
- Custom fields and configurable sales pipelines
- Lead capture, assignment, and acknowledgement
- Automatic escalation and a recovery queue
- Customer messaging through Twilio
- Payment tracking through Stripe
- Appointment scheduling through Google Calendar
- External escalation notifications
- Operational dashboards and audit history

## Feature status

Update this list to reflect the current implementation:

| Feature | Status |
|---|---|
| Authentication and workspaces | To be documented |
| CRM and pipelines | To be documented |
| Lead assignment and escalation | To be documented |
| Twilio messaging | To be documented |
| Stripe payments | To be documented |
| Google Calendar | To be documented |
| External notifications | To be documented |
| Dashboard and audit history | To be documented |

## Technology stack

- React and TypeScript
- Next.js / Vinext
- Tailwind CSS
- Drizzle ORM
- Cloudflare tooling

Document the actual database and deployment configuration used.

## Local setup

### Prerequisites

- Node.js 24 or later
- npm

### Installation

```bash
git clone https://github.com/username/relayApp.git
cd relay-business-platform
npm ci --include=dev
```

Configure the environment using `.env.example`, if provided.

### Development

```bash
npm run dev
```

Open the local URL printed in the terminal.

### Checks

```bash
npm run lint
npm run typecheck
npm test
```

## External services

The project specification includes:

- Twilio WhatsApp Sandbox or SMS
- Stripe test mode
- Google Calendar through OAuth 2.0
- Slack, Telegram, or transactional email for notifications

Document which integrations are implemented and tested.
Never commit real credentials.


## Known limitations

Document incomplete functionality, configuration requirements,
and any outstanding issues.

## Author

Abbas Khan
GitHub: https://github.com/....