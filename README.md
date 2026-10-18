# Relay ? Unified business workspace

A persistent CRM and lead-management application for small service teams. React/Vinext powers the responsive interface; server rules use Cloudflare D1 on Sites and SQLite in the included local server.

## Start locally

Requires Node.js 24.

```powershell
npm ci
Copy-Item .env.example .env
# Replace the placeholder encryption and worker secrets.
npm run local
```

Open http://127.0.0.1:5173 and create your workspace. Database records live in `.local/relay.sqlite`; the durable background worker runs every five seconds. The app also includes a private Sites deployment.

- [Setup, provider connections and demonstration](SETUP.md)
- [Architecture, relationships and decisions](ARCHITECTURE.md)
- [Verification checklist and explicit limitations](ACCEPTANCE.md)

```powershell
npm test
npm run typecheck
npm run build
```

Provider integrations require your own sandbox credentials and Google consent. No real messages, payments, appointments or external alerts have been claimed as verified. The private hosted surface needs supported HTTPS webhook ingress and an external worker scheduler before live integration acceptance. Read ACCEPTANCE.md before production use.
