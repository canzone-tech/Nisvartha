# NISVARTHA — member referral-code authentication (12 November 2026)

**Status:** approved owner implementation change; the baseline `Nisvartha_Foundation_SRS_v1.0` is **unchanged**. This document takes precedence over conflicting historic repo notes about email login or contact uniqueness. Not a production deployment or financial activation approval.

## Business contract

- Email and E.164 mobile are **not unique**. Multiple distinct MemberAccounts may reuse either or both. Each member retains its own immutable ID, credential hash, sessions, application, referrals, audit records, recovery and financial history.
- Generate a cryptographically random **8-character uppercase alphanumeric** referral code on *every* registration, including PENDING, staff-assisted and one-time root. MySQL enforces global uniqueness. Existing 22-character previously issued codes remain supported, not automatically rewritten.
- The same member code is both the **login ID** and **direct sponsor/inviter code**, subject to existing inviter status/eligibility rules. The code can be shared; it is not the password and is never an authentication bearer by itself.
- Login accepts `{ "identifier": "<member referral code>", "password": "<password>" }` only; email, phone, mixed or extra identity fields are rejected. Keep Argon2id verification, throttling, lockouts, and session revocation.
- Registration success returns `referralCode`. Public and Admin-assisted views visibly present it with a Copy control and an explicit instruction to securely retain it for future login. Password is never displayed, persisted in plaintext, or embedded in referral links.
- Authenticated members may see their own code even if their membership is pending, but sponsorship and invite sharing remain governed by existing active-status rules.
- Member recovery is issued only by an authenticated Admin after independent identity proof and is targeted by immutable member ID; shared contacts must never be used to infer a recovery target. Authorized contact corrections revoke the corrected account's sessions only.

## Migration and release

Append-only migration: `backend/prisma/migrations/0038_shared_member_contacts/migration.sql`. Drop `member_accounts_email_key` and `member_accounts_mobile_key`, add nonunique lookup indexes. Preserve `member_accounts_referralCode_key`, all historical migrations, existing database and other domains. Deploy only through controlled migration verification, backup/restore and exact-head CI.

## Regression coverage

Run `npm run verify` with Node 22, Docker/MySQL 8.4, Chromium and the project's existing synthetic isolation. Real DB/compiled smokes must cover two independent members sharing email/mobile; unique referral code issuance and code-only login; old email login rejected; PIN consumption, approved sponsor attribution, Admin/root registration, recovery/session invalidation; and same-origin frontend BFF. Check migration allowlist/release chain and source/CI build parity. No code changes here enable payments, compensation, money transfers or live deployment.
