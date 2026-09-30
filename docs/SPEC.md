# Build an AI-Powered Calendar, To-Do & Voice Planning Platform

## 1. Product Overview

Build a modern, production-ready productivity platform that combines:

* Calendar
* To-do/task management
* Appointments/events
* Ongoing tasks
* Reminders
* Notifications
* Text-based input
* Voice/audio-based input
* Speech-to-text transcription
* AI-generated titles
* AI-generated summaries
* AI-powered extraction of tasks, appointments, dates, deadlines, reminders, and other structured information from natural language

The application should feel like a **personal planning assistant**, rather than a traditional calendar.

The core idea is:

> **Think → Speak or Type → AI Understands → Review → Save → Get Reminded**

The platform must consist of:

* iOS mobile application
* Android mobile application
* Web application
* .NET backend/API
* SQL Server Express database

---

# 2. Mandatory Technology Stack

Do not replace the following technologies with alternatives unless explicitly requested.

## Backend

Use:

* **.NET / ASP.NET Core**
* C#
* RESTful API
* Entity Framework Core
* Dependency Injection
* Configuration through standard .NET configuration mechanisms
* Async/await
* Proper logging
* Validation
* Authentication and authorization

The backend must contain the business logic and must not rely on the clients to implement business-critical rules.

Recommended architecture:

```text
API
Application
Domain
Infrastructure
```

Use a clean architecture / layered architecture approach.

The architecture should be modular and testable.

---

# 3. Database

Use:

**Microsoft SQL Server Express**

SQL Server Express is the required initial database.

Use:

* Entity Framework Core
* Code First migrations
* Proper indexes
* Foreign keys
* Constraints
* Transactions where appropriate

The database schema must be designed so that the application can later migrate to a larger SQL Server edition or another compatible infrastructure without requiring a complete rewrite of the application.

Do not use PostgreSQL, MySQL, MongoDB, SQLite, or another primary server database unless explicitly requested.

SQLite may be used only as an optional **local/offline storage mechanism on the client**, if needed.

---

# 4. Mobile Applications

Build both:

* iOS
* Android

using:

**React Native**

Prefer a shared React Native codebase rather than maintaining separate native applications.

The mobile application should use native platform capabilities where appropriate, especially for:

* Microphone
* Audio recording
* Push/local notifications
* Background processing
* Secure storage
* Permissions
* Calendar/date functionality

The architecture should keep platform-specific code isolated.

---

# 5. Web Application

Build a separate web application using:

**React**

The web application should share concepts, API contracts, validation rules, and reusable business/UI patterns with the mobile application where practical, but it should remain an appropriate web application rather than trying to force the mobile UI onto the browser.

The web app should provide:

* Dashboard / Today
* Calendar
* Tasks
* Appointments
* Voice/text capture
* AI processing
* Search
* Settings
* Notifications/status
* User/account management

The web application communicates with the same .NET backend API used by the mobile applications.

---

# 6. High-Level Architecture

Use the following architecture:

```text
                    ┌──────────────────────┐
                    │      iOS App         │
                    │   React Native       │
                    └──────────┬───────────┘
                               │
                               │
                    ┌──────────▼───────────┐
                    │    Android App       │
                    │   React Native       │
                    └──────────┬───────────┘
                               │
                               │ HTTPS / REST API
                               │
                    ┌──────────▼───────────┐
                    │      Web App          │
                    │        React          │
                    └──────────┬───────────┘
                               │
                               │
                    ┌──────────▼───────────┐
                    │     ASP.NET Core      │
                    │      .NET API         │
                    │                       │
                    │ Domain                │
                    │ Application           │
                    │ Infrastructure        │
                    │ AI Services           │
                    │ Notification Services │
                    └──────────┬───────────┘
                               │
                               │ EF Core
                               │
                    ┌──────────▼───────────┐
                    │   SQL Server Express  │
                    └──────────────────────┘
```

All clients must communicate with the backend through a well-defined API.

Do not put direct database access inside React or React Native.

---

# 7. API Architecture

The ASP.NET Core backend should expose a clean REST API.

Potential areas:

```text
/api/auth
/api/users
/api/tasks
/api/appointments
/api/reminders
/api/calendar
/api/notifications
/api/voice
/api/transcriptions
/api/ai
/api/search
/api/sync
```

The exact endpoint structure can be improved during implementation.

API contracts should be represented with DTOs.

Do not expose EF Core entities directly from controllers.

Use request/response DTOs.

---

# 8. Authentication

Implement a secure authentication architecture suitable for:

* iOS
* Android
* Web

The system should support authenticated users and user-specific data.

The backend must ensure that one user cannot access another user's:

* Tasks
* Appointments
* Voice recordings
* Transcriptions
* Notes
* Settings

Keep authentication and authorization logic centralized in the backend.

Do not store sensitive authentication information insecurely on the client.

---

# 9. Core Domain

The core domain should contain entities such as:

```text
User
Task
Appointment
Reminder
Notification
Note
VoiceCapture
Transcript
AIExtraction
Tag
RecurrenceRule
```

The exact model can evolve as implementation progresses.

Each entity should have appropriate:

* ID
* CreatedAt
* UpdatedAt
* User ownership
* Status
* Audit information where appropriate

Use UTC timestamps internally where practical and convert to the user's timezone for display and scheduling.

---

# 10. Tasks

A task should support:

* Title
* Description
* Full notes
* AI-generated summary
* Created date
* Start date
* Due date
* Optional time
* Priority
* Status
* Tags
* Reminder
* Recurrence
* Completion date

Statuses should include at least:

```text
Inbox
Planned
InProgress
Ongoing
Completed
Cancelled
```

An **Ongoing** task is important.

For example:

> "Work on the new website."

This task may not have a specific time or deadline.

It should remain active until the user explicitly completes it.

---

# 11. Appointments

Appointments/events should support:

* Title
* Description
* Date
* Start time
* End time
* Location
* Notes
* Reminder
* Recurrence
* Status
* Optional participants

Statuses:

```text
Scheduled
Completed
Cancelled
```

Appointments must be easy to reschedule.

---

# 12. Calendar

Provide:

* Day view
* Week view
* Month view

Calendar items should visually distinguish:

* Appointments
* Tasks
* Deadlines
* Ongoing tasks
* Reminders

Users should be able to:

* Create
* Edit
* Delete
* Complete
* Cancel
* Reschedule
* Move
* Change reminders

---

# 13. Today Dashboard

The Today screen should be the main productivity dashboard.

Display:

* Current date
* Current time
* Today's appointments
* Tasks due today
* Ongoing tasks
* Overdue tasks
* Upcoming reminders
* Important items
* Daily AI summary

Example:

```text
Today — Saturday, August 15

09:00
Team Meeting

Tasks
□ Finish project proposal
□ Call John
□ Review presentation

Ongoing
Prepare new marketing plan

Upcoming
Tomorrow
Dentist — 10:00
```

Users should be able to perform common actions directly from this screen.

---

# 14. Quick Capture

Quick Capture is a core feature.

The user should be able to quickly enter:

* Text
* Voice

without navigating through complicated forms.

Examples:

> "Call David tomorrow at 3pm."

> "Dentist next Thursday at 9:30."

> "Finish the presentation by Friday."

The AI should determine the appropriate structured object.

---

# 15. Voice Input

Voice input is one of the most important features.

On mobile, provide a prominent microphone button.

The user can speak naturally.

Example:

> "I need to finish the financial report this week, remind me to call Mike tomorrow afternoon, and I have a meeting with Sarah next Tuesday at 11."

The system should:

1. Record audio.
2. Upload/process the recording.
3. Convert speech to text.
4. Preserve the original transcription.
5. Analyze the text with AI.
6. Identify tasks.
7. Identify appointments.
8. Identify deadlines.
9. Identify reminders.
10. Identify dates and times.
11. Generate concise titles.
12. Generate summaries.
13. Detect priority where possible.
14. Detect recurrence where possible.
15. Ask for clarification when necessary.
16. Present the result to the user.
17. Allow editing.
18. Save only after user confirmation.

---

# 16. AI Processing Architecture

AI functionality must be isolated behind backend interfaces.

For example:

```text
IAiService

ITranscriptionService
ISummarizationService
ITitleGenerationService
IIntentExtractionService
```

The mobile/web clients should **not directly call AI providers with secret API keys**.

AI requests should go through the .NET backend.

This allows the AI provider/model to be changed later without changing the clients.

---

# 17. AI Structured Extraction

Convert natural language into structured data.

For example:

```text
Input:
"I need to prepare the proposal by Thursday and meet Sarah next Tuesday at 11."
```

Potential output:

```text
Task:
    Title: Prepare proposal
    DueDate: Thursday

Appointment:
    Title: Meet Sarah
    Date: Next Tuesday
    StartTime: 11:00
```

The AI extraction layer should return structured JSON internally.

Example conceptual model:

```text
AIExtractionResult
    Intent
    Title
    Summary
    Description
    StartDate
    DueDate
    StartTime
    EndTime
    Reminder
    Priority
    Location
    Recurrence
    GeneratedItems[]
```

Do not blindly trust AI output.

Validate AI-generated structured data on the backend before persisting it.

---

# 18. AI Review Screen

Never silently create potentially important appointments from ambiguous input.

After AI processing, show:

```text
I understood:

TASK
Finish project proposal
Due Thursday
Priority High

APPOINTMENT
Client meeting
Monday
10:00 – 11:00

REMINDER
Call John
Tomorrow
14:00
```

Actions:

```text
Save All
Edit
Cancel
```

The user must be able to modify every extracted property.

---

# 19. AI Title Generation

Long input should produce concise titles.

Example:

Input:

> "I was thinking that we should probably redesign the onboarding flow because users are dropping out at the second step..."

Title:

**Redesign onboarding flow**

Titles should be:

* Short
* Clear
* Easy to scan
* Action-oriented where appropriate

---

# 20. AI Summary

For long recordings/notes, generate a concise summary.

Display:

```text
Title:
Launch planning

Summary:
Discussed the launch timeline, marketing activities,
and remaining technical tasks.

Full transcription:
[original transcript]
```

The summary must never replace the original transcription.

---

# 21. Voice Capture History

Store the relationship between:

```text
Voice Recording
        ↓
Transcript
        ↓
AI Analysis
        ↓
Generated Items
```

Users should be able to open previous captures and see:

* Original recording
* Transcription
* Summary
* Generated title
* Generated tasks
* Generated appointments

Design this so full-text search can be added later.

---

# 22. Notifications

Support native notifications for:

* Appointments
* Task deadlines
* Reminders
* Overdue tasks
* Important tasks
* Daily agenda
* Daily summary

Example:

> Meeting with Sarah starts in 30 minutes.

Another example:

> You have 3 tasks due today.

---

# 23. Notification Actions

Where supported by iOS and Android, provide actions such as:

* Complete
* Snooze
* Open
* Reschedule
* Cancel

Snooze options:

```text
15 minutes
1 hour
Later today
Tomorrow
Custom
```

The backend should manage notification scheduling rules, while platform-specific notification delivery should be handled appropriately by the clients and notification infrastructure.

---

# 24. Recurrence

Support:

* Daily
* Weekdays
* Weekly
* Monthly
* Custom

Examples:

> Every Monday at 09:00

> Pay rent on the first day of every month

Use a recurrence model that can support future expansion.

---

# 25. Natural Language Date Understanding

The AI must understand:

* Today
* Tomorrow
* Tonight
* Tomorrow morning
* Tomorrow afternoon
* Next Monday
* This Friday
* In two hours
* In three days
* End of this week
* Next month
* Every Monday

Relative dates must be resolved using:

* User timezone
* Current date/time
* User locale

Never hardcode date assumptions.

---

# 26. Search

Implement global search across:

* Tasks
* Appointments
* Notes
* Transcriptions
* Summaries
* Titles

Search should eventually support natural language.

Example:

> "client meetings"

should find relevant tasks, appointments, and transcripts.

---

# 27. Offline Capability

Mobile applications should provide reasonable offline functionality.

At minimum:

* Existing data remains accessible.
* Users can create tasks offline.
* Users can edit tasks offline.
* Users can edit appointments offline.
* Changes are queued.
* Changes synchronize when connectivity returns.

Voice recordings can be stored locally until they can be uploaded.

AI processing may require an internet connection.

Clearly communicate sync/processing status to the user.

---

# 28. Synchronization

Design the backend and clients for multi-device synchronization.

Example:

```text
iPhone
   ↓
Backend
   ↓
SQL Server

Android
   ↓
Backend

Web
   ↓
Backend
```

Changes from all clients must eventually converge.

Design for:

* Offline changes
* Conflicts
* Server timestamps
* Client timestamps
* Sync state
* Deleted records
* Recurring items

Avoid assuming that the client is always online.

---

# 29. Client Architecture

## React Native

Use a scalable architecture separating:

```text
UI
State Management
Domain/Business Logic
API Client
Local Storage
Notification Layer
Voice/Audio Layer
Authentication
```

Keep API communication centralized.

Do not scatter HTTP calls throughout UI components.

## React Web

Use a similar conceptual architecture:

```text
Components
Pages
State
API Client
Domain Models
Authentication
```

Where practical, share:

* Type definitions
* API contracts
* Validation schemas
* Utility functions

between React and React Native.

However, do not create an artificial shared abstraction that makes the applications harder to maintain.

---

# 30. Backend Architecture

Use a clean architecture such as:

```text
src/
    Api/
    Application/
    Domain/
    Infrastructure/
```

### Domain

Contains:

* Entities
* Value objects
* Domain rules
* Domain interfaces

### Application

Contains:

* Use cases
* Commands
* Queries
* DTOs
* Application services
* Validation

### Infrastructure

Contains:

* EF Core
* SQL Server
* AI providers
* Speech-to-text providers
* Notifications
* File/audio storage
* External services

### API

Contains:

* Controllers/endpoints
* Authentication
* Middleware
* API configuration
* Dependency injection
* API documentation

---

# 31. Entity Framework Core

Use EF Core for database access.

Use:

* Migrations
* Proper relationships
* Indexes
* Concurrency handling
* Transactions
* Query optimization

Do not expose EF entities directly from API endpoints.

Use DTOs.

---

# 32. Database Design

The initial database must be:

**SQL Server Express**

Design tables for:

```text
Users
Tasks
Appointments
Reminders
Notifications
VoiceCaptures
Transcripts
AIExtractions
Notes
Tags
TaskTags
RecurrenceRules
```

Use proper normalization where appropriate.

Avoid premature overengineering.

The schema should still be capable of scaling beyond SQL Server Express later.

---

# 33. File and Audio Storage

Do not store large audio files directly inside SQL Server unless there is a specific reason to do so.

Design an abstraction:

```text
IFileStorageService
```

This can initially use local/server storage for development and later support cloud object storage.

The database should store metadata and references to files rather than unnecessarily storing large binary objects.

---

# 34. Configuration

All external services must be configurable.

Do not hardcode:

* API keys
* Connection strings
* URLs
* Secrets
* Notification credentials

Use environment-specific configuration.

Provide an example configuration file/documentation containing placeholders.

Never commit real secrets.

---

# 35. API Documentation

Document the API.

Prefer OpenAPI/Swagger for the .NET backend.

The API documentation should describe:

* Authentication
* Endpoints
* Request models
* Response models
* Errors
* Validation
* Pagination
* Filtering

---

# 36. Error Handling

Implement consistent API error responses.

Handle:

* Validation errors
* Authentication errors
* Authorization errors
* Not found
* Conflicts
* AI failures
* Transcription failures
* Network failures
* Database failures

Do not expose internal stack traces or sensitive implementation details to clients.

---

# 37. Logging & Observability

Implement structured logging in the .NET backend.

Log important operations such as:

* Authentication events
* AI processing
* Transcription failures
* API errors
* Synchronization failures
* Notification scheduling

Do not log:

* Passwords
* Tokens
* API keys
* Sensitive audio/transcription content unnecessarily

---

# 38. Testing

Create automated tests for critical functionality.

Backend:

* Unit tests
* Application/service tests
* API/integration tests
* Database-related tests where appropriate

Client:

* Critical business logic tests
* State management tests
* Important UI behavior tests

Especially test:

* AI extraction validation
* Date/time parsing
* Recurrence
* Task lifecycle
* Appointment lifecycle
* Synchronization
* Notification scheduling

---

# 39. UI / UX

Create a modern, premium productivity UI.

Design principles:

* Minimal
* Clean
* Fast
* Elegant
* Excellent typography
* Clear hierarchy
* Excellent dark mode
* Accessible
* Large touch targets
* Smooth animations
* Native-feeling mobile interactions

The application should not look like an old enterprise calendar.

The web application should be responsive and work well on:

* Desktop
* Laptop
* Tablet
* Mobile browser

---

# 40. Settings

Provide:

### Account

* Profile
* Authentication
* Sign out

### Notifications

* Enable/disable notifications
* Default reminder time
* Daily summary
* Task reminders
* Appointment reminders

### AI

* Enable AI processing
* Voice processing preferences
* Review-before-save
* Automatic vs manual processing

### Appearance

* Light
* Dark
* System

### Language

* Application language
* Date format
* Time format
* Timezone

### Privacy

* Audio storage
* Transcript storage
* Delete recordings
* Delete transcripts
* Delete account/data

---

# 41. Privacy & Security

Voice recordings and transcriptions can contain personal information.

Therefore:

* Encrypt communication using HTTPS.
* Secure authentication.
* Protect API endpoints.
* Enforce user-level authorization.
* Never expose AI API keys to clients.
* Store credentials securely.
* Allow users to delete recordings.
* Allow users to delete transcripts.
* Clearly define what information is sent to external AI providers.
* Avoid retaining raw audio indefinitely unless explicitly requested.

Privacy should be considered in the architecture from the beginning.

---

# 42. MVP

Do not implement the entire platform simultaneously.

Build the MVP in stages.

## Phase 1 — Foundation

Implement:

* .NET backend
* ASP.NET Core API
* SQL Server Express
* EF Core
* Authentication
* React Native project
* React web project
* Basic API communication
* Basic database migrations

## Phase 2 — Core Productivity

Implement:

* Tasks
* Appointments
* Today view
* Calendar
* Create/edit/delete
* Complete/cancel
* Basic reminders

## Phase 3 — Voice & AI

Implement:

* Voice recording
* Audio upload
* Speech-to-text
* AI title generation
* AI summary
* AI task extraction
* AI appointment extraction
* Date/time extraction
* Review screen

## Phase 4 — Notifications

Implement:

* Mobile notifications
* Reminders
* Appointment notifications
* Task deadline notifications
* Notification actions

## Phase 5 — Synchronization

Implement:

* Multi-device synchronization
* Offline changes
* Conflict handling
* Sync status

## Phase 6 — Advanced Features

Implement:

* Recurring tasks
* Recurring appointments
* Search
* Voice history
* Advanced AI
* Widgets
* Calendar integrations
* Analytics

---

# 43. Development Rules

Do not build fake/demo functionality where real functionality is expected.

If an external dependency is required, create a proper abstraction and clearly document the required configuration.

Do not put secrets into source code.

Do not create unnecessary infrastructure before it is needed.

Prefer simple, maintainable solutions.

Do not over-engineer the MVP.

However, do not create an architecture that makes future expansion impossible.

---

# 44. Expected Repository Structure

Use a monorepo if appropriate.

A possible structure:

```text
/
├── backend/
│   ├── src/
│   │   ├── Api/
│   │   ├── Application/
│   │   ├── Domain/
│   │   └── Infrastructure/
│   └── tests/
│
├── mobile/
│   ├── src/
│   ├── ios/
│   └── android/
│
├── web/
│   ├── src/
│   └── public/
│
├── shared/
│   ├── types/
│   ├── validation/
│   └── utilities/
│
└── docs/
```

Adjust this structure if a better architecture is identified, but preserve the separation between backend, mobile, and web.

---

# 45. Definition of Done for the MVP

The MVP should be considered complete only when a user can perform the following end-to-end flow:

### Example

The user opens the mobile app and taps the microphone.

They say:

> "I need to finish the project proposal by Thursday, remind me to call John tomorrow at 2pm, and I have a meeting with Sarah next Monday at 10."

The application:

1. Records the audio.
2. Converts it to text.
3. Displays the full transcription.
4. Sends the text to the backend AI service.
5. Extracts three structured items.
6. Generates concise titles.
7. Generates summaries where appropriate.
8. Resolves the dates/times using the user's timezone.
9. Shows the user a review screen.
10. Allows editing.
11. Saves the confirmed items.
12. Displays them in Today/Calendar/Tasks.
13. Schedules the appropriate reminders.
14. Sends the user a mobile notification at the configured time.
15. Allows the user to complete, snooze, edit, reschedule, or cancel the items.
16. Synchronizes the changes with the backend.
17. Makes the same data available from the React web application.

This complete flow is the most important acceptance test for the product.

---

# 46. Final Instruction

Build this as a **real full-stack application**, not just a visual prototype.

The mandatory stack is:

```text
Backend:
.NET / ASP.NET Core / C#

Database:
Microsoft SQL Server Express

Mobile:
React Native
iOS + Android

Web:
React

ORM:
Entity Framework Core

API:
REST / HTTP

Architecture:
Clean Architecture / Layered Architecture

AI:
Provider-agnostic backend abstraction

Speech:
Provider-agnostic transcription abstraction
```

Make sensible technical decisions where the specification does not dictate an implementation.

Prioritize:

1. Excellent user experience
2. Reliable task/calendar behavior
3. Voice + AI capture
4. Correct date/time handling
5. Notifications
6. Data integrity
7. Security
8. Maintainability
9. Testability
10. Future scalability

The application should ultimately feel like a **personal AI planning assistant that happens to have a calendar**, rather than simply another calendar application.
