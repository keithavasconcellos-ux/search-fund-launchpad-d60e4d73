# Project Memory

## Core
Acquira — search fund workflow tool. Dark data-forward aesthetic.
BG #0b1221, Accent #2e86ff (Acquira Blue), Green/Amber/Red status.
Fonts: Instrument Serif (display), DM Sans (body), DM Mono (data/numbers).
Supabase URL: dzepmywtihvjgewdrynx.supabase.co. Anon key in src/lib/supabase.ts.
User wants to wait for directive before wiring data to Supabase.
Email service abstraction at src/lib/email/emailService.ts — all email ops go through IEmailService.
Calendar service abstraction at src/lib/calendar/calendarService.ts — all call scheduling through ICalendarService.

## Memories
- [Design spec overview](mem://features/design-spec) — 6 modules: Dashboard, Map View, CRM, Library, Email Hub, DD Agent
- [Data model](mem://features/data-model) — Business, Contact, EmailThread, DDMemo entities and key fields
- [Email Hub spec](mem://features/email-hub) — Build spec for Email Hub: service abstraction, inbox split-pane, compose queue, sequences, templates, analytics, call scheduler
