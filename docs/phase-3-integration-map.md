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
| `get_account_status` | `GET /authentication/me` | emailVerified, roles, NIN verified flag |
| `resend_email_verification` | `POST /authentication/resend-email-verification-link` | Email comes from profile, not chat |
| `get_donor_profile` | `GET /donors/me` | No eligibility decision |
| `get_donations` | `GET /bookings/mine` | History + next appointment |
| `get_donation` | `GET /bookings/mine` then filter by id | Ownership enforced by Blivap JWT |
| `get_blood_requests` | `GET /blood-requests/mine` | Requester-owned only |
| `get_blood_request` | `GET /blood-requests/mine` then filter | |
| `get_wallet_summary` | `GET /wallet` | Balance + recent entries |
| `get_notification_settings` | `GET /notifications/settings` | |
| `list_notifications` | `GET /notifications` | Own inbox only |
| `update_notification_settings` | `PATCH /notifications/settings` | Confirmation required |
| `cancel_booking` | `PATCH /bookings/:id/cancel` | High risk, confirmation required |
| `notify_user` | Blivap notify adapter | Service key; ticket events only |

## Explicitly unsupported

- Wallet transfers, payouts, top-ups, refunds
- Password or OTP collection in chat
- Donor eligibility / medical fitness decisions
- Hospital facility approve/reject
- Blood compatibility confirmation
- Cancelling a blood request (no requester cancel route in Blivap today)
- Arbitrary Mongo/SQL or unbound service calls

## Decision path

Safety / emergency / human request → Phase 2 decision engine (always).  
When `LLM_ENABLED=true` → Ollama agent with RAG + allowlisted tools.  
LLM unavailable / ungrounded / disabled → Phase 2 knowledge + action resolver.  
Sensitive / unsupported mutation → escalate.  
Confirmation-bound mutation → Redis confirmation ticket, then execute once.

Model setup and deployment: [`phase-3-llm.md`](phase-3-llm.md).
