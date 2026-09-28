# Supabase Auth email templates

These are copy-ready HTML bodies for **Authentication → Email Templates** in the Supabase dashboard. Each file is a complete HTML email with inline styles, a responsive table layout, and no external assets. Paste the file contents into the matching template's body field and keep the action link variables intact.

The layouts use the shipped Astrid Nails & Beauty Bar identity with LuxeGlow as the account experience label. They share the notification worker's plum, warm ivory, and brass palette.

## Authentication emails

| Supabase template | File | Suggested subject |
| --- | --- | --- |
| Confirm signup | `confirmation.html` | Confirm your email address |
| Invite user | `invite.html` | You are invited to LuxeGlow |
| Magic link or OTP | `magic_link.html` | Your LuxeGlow sign-in link |
| Change email address | `email_change.html` | Confirm your new email address |
| Reset password | `recovery.html` | Reset your LuxeGlow password |
| Reauthentication | `reauthentication.html` | `{{ .Token }} is your verification code` |

The confirmation, invite, magic link, email change, and recovery templates use `{{ .ConfirmationURL }}` for their action button. The magic link also includes `{{ .Token }}` as the OTP alternative. Reauthentication uses `{{ .Token }}` as its verification code. The email change template uses `{{ .NewEmail }}` for the pending address.

## Security notifications

| Supabase notification | File | Variables used |
| --- | --- | --- |
| Password changed | `password_changed_notification.html` | `{{ .Email }}` |
| Email address changed | `email_changed_notification.html` | `{{ .OldEmail }}`, `{{ .Email }}` |

Security notifications are factual notices and contain no confirmation links. Apply the two security bodies currently enabled in the project (Password changed and Email address changed). Leave other notification enablement settings as they are.

No Supabase dashboard or `supabase/config.toml` settings were changed. The templates make no claims about link or code expiry. Keep the project's existing redirect allowlist and routes, especially the `/reset-password` redirect used by recovery links.
