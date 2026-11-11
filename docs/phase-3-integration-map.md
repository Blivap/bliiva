# Phase 3 integration map

Bliiva does not open Blivap business collections. Every account-specific reply goes through `BlivapIntegrationPort`, then the allowlisted action registry.

## Identity

| Need | Source | Rule |
| --- | --- | --- |
| Support caller | `x-support-api-key` | Service-to-service |
| Authenticated user id | JWT `sub` / `x-support-user-id` | Never taken from chat text |
| Blivap user JWT | `x-support-access-token` or forwarded Bearer | Required for Blivap reads/mutations |
| Roles | JWT `roles` / `x-support-roles` | Admin/staff only for admin APIs |

## Reused Blivap endpoints

| Support action | Blivap route | Notes |
| --- | --- | --- |
| `get_profile` | `GET /authentication/me` | Safe profile projection only |
| `update_profile` | `PUT /authentication/me` | Confirmation required |
| `get_account_status` | `GET /authentication/me` | emailVerified, roles, NIN verified flag |
| `resend_email_verification` | `POST /authentication/resend-email-verification-link` | Email comes from profile, not chat |
| `change_password` | `PUT /authentication/change-password` | Confirm; never log secrets |
| `request_password_reset_email` | `POST /authentication/forgot-password` | Uses profile email |
| `submit_nin_verification` | `POST /nin-verification` | Confirm; redact NIN in logs |
| `get_donor_profile` | `GET /donors/me` | No eligibility decision |
| `list_donors` | `GET /donors` | Optional `bloodType` / search; public list fields only |
| `list_donors` | `GET /donors` | Optional `bloodType` / search; public list fields only |
| `register_donor` / `update_donor_location` / `update_meetup_care` | donor routes | Confirmation required |
| `get_donations` | `GET /bookings/mine` | History + next appointment |
| `list_bookings` | `GET /bookings` | Optional filter |
| `get_donation` | `GET /bookings/mine` then filter by id | Ownership enforced by Blivap JWT |
| `request_booking` | `POST /bookings/request` | Confirmation required |
| `accept_booking` / `decline_booking` / `cancel_booking` / `report_booking` | booking patches | Confirmation required |
| `get_blood_requests` | `GET /blood-requests/mine` | Requester-owned only |
| `get_blood_request` | `GET /blood-requests/mine` then filter | |
| `create_blood_request` | `POST /blood-requests` | Confirmation required |
| `get_wallet_summary` | `GET /wallet` | Balance + recent entries |
| `start_wallet_topup` | `POST /wallet/topups` | Confirm amount → Paystack URL |
| `verify_wallet_topup` | `POST /wallet/topups/:reference/verify` | After user pays |
| `list_banks` | `GET /wallet/banks` | |
| `list_bank_accounts` | `GET /wallet/bank-accounts` | |
| `add_bank_account` / `set_primary_bank_account` / `remove_bank_account` | bank-account routes | Confirmation required |
| `list_payouts` / `get_payout` | `GET /wallet/payouts` (+ `/:id`) | |
| `start_wallet_payout` | `POST /wallet/payouts` | Confirm amount → OTP emailed |
| `confirm_wallet_payout` | `POST /wallet/payouts/:id/confirm` | OTP param; redact in logs/analytics |
| `resend_payout_otp` | `POST /wallet/payouts/:id/resend-otp` | Confirmation required |
| `get_notification_settings` | `GET /notifications/settings` | |
| `list_notifications` | `GET /notifications` | Own inbox only |
| `update_notification_settings` | `PATCH /notifications/settings` | Confirmation required |
| `mark_notification_read` | `PATCH /notifications/:id/read` | |
| `mark_all_notifications_read` | `POST /notifications/mark-all-read` | Confirmation required |
| `list_hospitals` | `GET /hospitals` | |
| `list_welfare_packages` | `GET /welfare-packages` | |
| `get_meetup_session` | `GET /meetups/:sessionId` | |
| Meetup mutations | meetup routes | Confirmation; codes as params |
| `notify_user` | Blivap notify adapter | Service key; ticket events only |

## Explicitly unsupported

- Wallet peer transfers / refunds (top-up + withdraw with OTP are allowlisted)
- Collecting another user’s credentials
- Donor eligibility / medical fitness decisions
- Hospital facility approve/reject
- Blood compatibility confirmation
- Cancelling a blood request (no requester cancel route in Blivap today)
- Admin (`/admin/*`) APIs
- Arbitrary Mongo/SQL or unbound service calls
- Full media chat-room replacement (defer)

## Product knowledge

Seeded Q&A lives in `src/support/intelligence/dataset/blivap-support.dataset.ts` (sourced from `docs/blivap-product-knowledge.md`). Re-seed with `yarn seed:support` after dataset changes.

## Decision path

Safety / emergency / human request → Phase 2 decision engine (always).  
When `LLM_ENABLED=true` → Ollama agent with RAG + allowlisted tools.  
LLM unavailable / ungrounded / disabled → Phase 2 knowledge + action resolver.  
Sensitive / unsupported mutation → escalate.  
Confirmation-bound mutation → Redis confirmation ticket, then execute once.  
OTP/reference follow-ups after top-up/payout start → `action_resource` free-text param collection (secrets redacted in prompts/audit).

Model setup and deployment: [`phase-3-llm.md`](phase-3-llm.md).
