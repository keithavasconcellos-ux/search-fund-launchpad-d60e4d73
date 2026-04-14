---
name: Email Hub Build Spec
description: Full build spec for Email Hub module — service abstractions, inbox, compose, sequences, templates, analytics, call scheduler
type: feature
---
## Key Architecture
- src/lib/email/emailService.ts — IEmailService interface + MockEmailService (provider factory pattern)
- src/lib/calendar/calendarService.ts — ICalendarService interface + MockCalendarService
- src/lib/queries/email-hub.ts — all email-specific Supabase queries
- All UI components in src/components/email/

## Tables Added
- email_threads: added sending_provider (default 'manual'), scheduled_at columns
- email_sequences: name, target_vertical, is_active, steps (jsonb array)
- scheduled_calls: contact_id, business_id, scheduled_at, duration_mins, status, notes, provider, external_event_id

## Conventions
- Always use emailService for sending/scheduling — never call Supabase directly from components
- Use existing updateCrmStage() from src/lib/queries/businesses.ts
- Use @hello-pangea/dnd for drag-and-drop
- Toast notifications via sonner
- Store times in UTC, display in local timezone via Intl.DateTimeFormat
- sending_provider = 'manual' for all mock sends; 'gmail'/'outlook' later
