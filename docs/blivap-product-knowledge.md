# Blivap product knowledge (from web + mobile UI)

Source: Blivap web (`blivap`), mobile (`blivap-mobile`), and admin (`blivap-admin`) routes/screens/copy. Do not invent clinical policy beyond what the apps say. When public FAQ and in-app Help disagree, say the apps differ and escalate rather than pick a hard medical rule.

## What Blivap is

Blivap is a Nigeria-focused donation matching platform. It helps people register, get matched, and donate (blood is the live path in the apps; other pathways may be marketed as coming soon). Users can also browse donors, send/accept bookings, coordinate meetups, and manage a wallet for top-ups, welfare holds, and withdrawals.

## Who uses it

- Donors and requesters: web app + mobile app
- Visitors: marketing site, FAQ, waitlist, contact, education pages
- Ops/support: Blivap Admin (not end-user)

## Account and authentication

- **Sign up**: Register with name, DOB, phone, email, password; accept terms/privacy. Social signup (Google/Apple) may be available.
- **Sign in**: Email + password, or social where enabled.
- **Complete profile after social login**: add phone + date of birth before using the app.
- **Email verification**: enter the code sent to email; resend if needed.
- **Forgot password**: request a reset, then set a new password. Signed-in users can also email a reset link from Privacy & Security.
- **Avatar**: choose a profile avatar.
- **Profile**: Settings → Personal Information to update name, phone, DOB, photo.
- **NIN / identity**: enter an 11-digit NIN. Profile details must match. Required before booking donors or accepting bookings. Mobile notes verification is not available abroad.
- **Change password**: Settings → Privacy & Security.
- **2FA**: labeled coming soon on web.
- **Delete account / logout**: Privacy & Security / Delete Account; Logout from profile/settings.

## Donor flows

- **Become a donor (web)**: Overview “Start a donation” or Donors → new. Steps: Basics (location) → AI questionnaire (pathway-specific yes/no screening) → Eligibility/activation. Overview can start blood, sperm, and egg/ovum intake.
- **Become a donor (mobile)**: Donate → Donate blood → verify identity → medical questions. Mobile Donate also shows Request blood. Sperm / plasma / platelets / double red are labeled Coming soon on mobile — do not promise those bookings there.
- **Browse donors**: Donors list with search/filters; open a donor profile.
- **Donor profile**: blood type, location, ratings, history; Continue to book if available. Cooling-down donors cannot be booked.
- **Cooldown / block**: Overview can show a pathway in cooldown after a recent donation, or a permanent donation block.
- **Donation history**: Settings → Donation History.

## Bookings / requesting blood

End-user “request blood” is mainly **book a donor**, not an admin-style blood-request queue.

- **Web**: open a donor → Schedule Appointment (hospital, date, time) → meetup care payment if needed → submit. Track under Bookings.
- **Mobile**: Donate → Request blood → choose donor → urgency, units, hospital → fund welfare if needed → submit. Track under Bookings.
- **Donor actions**: Bookings → Incoming/Pending → Accept or Decline (NIN required to accept).
- **Requester actions**: withdraw pending; rate after completion; open chat/meetup when available.

## Meetup, chat, and welfare

- **Meetup**: for an accepted booking, open meetup session. Share/scan a 6-digit code or QR, confirm donation on both sides, complete, rate, or report/terminate if needed.
- **Chat**: messaging with the other party on accepted bookings (mobile also has a chat tab).
- **Meetup care**: in Personal Information, donor chooses “I’ll cover it” or “Ask the requester.” If the requester pays, items are held from their wallet before the request is sent. Care is practical welfare (travel/food/rest), not payment for blood itself.
- **Compensation wording**: some marketing/FAQ/onboarding copy mentions compensation or “donate for money.” For booked blood meetups, prefer the in-app welfare framing; do not invent payout amounts.

## Wallet

- **Overview**: available and held balances; ledger/activity. Mobile may show an earnings tab for wallet activity.
- **Add money / top-up (web)**: Wallet → Add money via Paystack.
- **Add money / top-up (mobile)**: Wallet → Add money → Debit Card (Visa/Mastercard/Verve) or Bank Transfer, then continue on the matching payment screen.
- **Withdraw**: Wallet → Withdraw → choose bank → amount (minimum ₦100) → review → OTP. Needs a saved bank account; cannot exceed available balance.
- **Bank details**: Settings → Bank Details — resolve 10-digit account + bank, save, set primary, delete.
- **History/receipts**: Wallet ledger or History page; open an entry for a receipt.

## Notifications and settings

- Notification bell / Notifications screen for recent alerts.
- Settings → Notifications: push master switch plus donation reminders, nearby drives, eligibility alerts, reward updates, app updates.
- Settings hub also includes Personal Information, Bank Details, Donation History, Privacy & Security, Help & Support.

## Public site / education

- **FAQ / Help FAQ**: age/weight/health screening marketing copy; intervals; prep tips; visit length. Copy can conflict with admin eligibility settings or across pages — escalate hard clinical conflicts.
- **Giving Blood / About Blood / About Donating / About Sperm / Education**: blood groups, why donate, register→book→donate, prep/aftercare marketing, sperm confidentiality/compensation marketing.
- **Waitlist**: email + App Store / Google Play / Both; notified when the store listing is live.
- **Contact**: `/contact` form (name, email, message) for donor support, partnerships, platform, or research; listed emails include support@blivap.com and info@blivap.com; HQ Lagos, Nigeria; replies usually within 24 hours on business days.
- **Book a Demo**: marketing CTA that routes toward registration.
- **Vulnerability disclosure**: coordinated disclosure via security@blivap.com; no public disclosure until fixed.

## Help and support

- In-app support chat (web, when logged in) — this Bliiva assistant.
- Settings → Help & Support lists email/phone contacts and “Report a problem.”
- Contact inconsistency: web Help uses support@blivap.com and +234 090 2667 6096 (Mon–Fri 9AM–5PM WAT); mobile Help shows support@blivapdonation.org and a different phone — confirm the current official channel before quoting one as policy.
- Users can also ask to talk to a human specialist from chat.

## Coming soon / caveats

- Several non-blood donation types appear in marketing or UI as “Soon,” especially on mobile.
- Admin eligibility interval settings and FAQ interval text can differ — do not invent which clinical rule wins.
- Admin-only tools (users, blood request ops queue, facilities, welfare packages, CMS, analytics) are not end-user features.
