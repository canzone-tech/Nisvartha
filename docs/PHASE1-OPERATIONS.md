# Phase 1 — enquiry operations (pre-launch)

This procedure is for an authorized operator on a trusted host, **not the public website**. The Phase 1 enquiry store remains MySQL; there is no second CRM or staff API.

## Access controls

- Provision a **dedicated MySQL login with SELECT access only to `nisvartha.enquiries`**. Provision credentials through your managed secret mechanism, not files committed to Git. Never use the production application writer account for operator access.
- Set `NISVARTHA_OPERATOR_DATABASE_URL` to the read-only account URL on the trusted operator host. Restrict shell/host access to approved personnel; keep backups and credentials private.
- To see the most recent 50 records **without names, emails or messages**: `node backend/scripts/enquiries.mjs list`.
- To view an individual enquiry after verifying the operator's purpose: `node backend/scripts/enquiries.mjs show NF-<uuid> --reveal`. The command prints personal information **only to the operator terminal**. Do not redirect it into shared logs, tickets or chat.
- There is **no public endpoint** to list, read, change or delete enquiries. Phase 1 CLI is intentionally read-only. The Phase 2 CMS will own authenticated case handling, status changes and audit history.
- Logins, access reviews and any exports must be governed by the approved Foundation data-handling policy. Do not claim the CLI provides an audit trail for reads.

## Activation gate

Until an approved privacy notice, responsible contact, retention/deletion schedule and staff response workflow exist, leave `NEXT_PUBLIC_FORMS_ENABLED=false`, `FORM_SUBMISSIONS_ENABLED=false` and `PRIVACY_NOTICE_APPROVED=false`. The backend also requires `PRIVACY_NOTICE_VERSION` to enable submissions. The version is stored alongside consent.

## Operations and recovery

- The authoritative database needs encrypted, access-controlled backups and regular **restore tests to an isolated destination** before public submission is enabled. Do not test a restore against production.
- Run `npm run verify` only on a development/CI machine: it creates and removes an isolated synthetic MySQL container, tests migrations and validates compiled API/web requests. This is not a production diagnostic command.
- Check `/api/v1/health/live` for process liveness and `/api/v1/health/ready` for MySQL readiness; do not treat liveness as database readiness.
- On a launch or recovery incident, pause submissions using the server-side form gate before taking other action. Restore from the verified backup using the approved operational procedure.
- Production deployment, backup evidence, contact/privacy approval and visual accessibility UAT remain separately gated.
