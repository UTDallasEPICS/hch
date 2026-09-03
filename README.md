# HOPE COPE HEAL - Electronic Health Records System

Hope.Cope.Heal is a non-profit organization dedicated to providing free essential mental health support to families navigating childhood cancer. They focus on trauma and long-term psychological recovery and therapy. Hope.Cope.Heal operates at the intersection of healthcare administration and non-profit social services, requiring strict HIPAA compliance. They use a unique charitable scholarship system to provide services, rather than traditional insurance-based billing. Currently Hope.Cope.Heal is struggling with "Simple Practice" software, which is too rigid for their specialized intake, document verification, and scholarship tracking needs. We aim to help them overcome this obstacle by developing a customized application that will suit their needs.

## Conceptual Overview

This application is intended to support a mental health clinic workflow from intake through ongoing care. The application helps clients submit onboarding and assessment forms, request care-related information, and track their next steps. It also gives clinic staff the tools to manage clients, review requests, coordinate scheduling, and oversee note approval and audit workflows.

### User roles

- **Client**: Signs in with email OTP, completes intake and clinical forms, requests access to records, and views appointment/task information.
- **Clinician**: Reviews client information, manages appointments, contributes clinical documentation, and participates in note workflows.
- **Admin**: Oversees client operations, reviews requests, monitors notifications, approves notes, and audits governed changes.

## Third-Party Integrations

- **Gmail OTP via Nodemailer**: Sends one-time passcodes and outbound app email.
- **Better Auth**: Provides authentication, sessions, and email OTP flows.
- **Prisma**: Handles database access, migrations, and generated client code.
- **Prisma Studio**: Supports local database inspection during development.

## Features

- **Nuxt 4**: The latest and greatest from the Nuxt team.
- **Better Auth**: Comprehensive authentication with Email OTP support.
- **Prisma**: Type-safe ORM for interacting with the database.
- **SQLite**: Lightweight, zero-configuration database, ideal for development and small-to-medium projects.
- **Nuxt UI v3**: Beautiful, accessible, and customizable UI components built with Tailwind CSS.
- **Nodemailer**: Pre-configured for sending verification emails via Gmail.
- **FullCalendar**: Powers the appointment calendar and scheduling views.
- **Tiptap**: Supports rich-text note editing workflows.

## Stack

- **Framework**: Nuxt
- **Frontend**: Vue 3
- **Backend**: Node.js runtime with Nitro server routes inside Nuxt
- **Auth**: Better Auth
- **ORM**: Prisma
- **Database**: SQLite
- **UI Framework**: Nuxt UI
- **Email**: Nodemailer
- **Other important packages**: FullCalendar, Tiptap, Zod, `@prisma/adapter-better-sqlite3`
- **Other tools used/needed**: Prisma Studio, Docker, pnpm, esbuild

## Getting Started

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd hch
```

### 2. Install dependencies

This project uses `pnpm`.

```bash
pnpm install
```

### 3. Setup environment variables

Copy the example environment file and fill in your details.

```bash
cp .env.example .env
```

Open `.env` and configure the following:

- `DATABASE_URL`: The SQLite connection string (default: `file:./dev.db` at the project root). Prisma CLI loads this from `.env` in `prisma.config.ts`, so migrate, seed, and the app all use the same file.
- `BETTER_AUTH_SECRET`: A secure random string for encryption. You can generate one using `openssl rand -hex 32`.
- `BETTER_AUTH_URL`: The base URL of your application, (default; `http://localhost:3000`).
- `EMAIL_USER`: Your Gmail address for OTP delivery.
- `EMAIL_PASS`: Your Gmail App Password. (How to generate an App Password: https://support.google.com/accounts/answer/185833)

### 4. Database setup

Initialize the database and apply migrations:

```bash
pnpm prisma migrate dev --name init
```

Generate the Prisma client:

```bash
pnpm prisma generate
```

Run the seed script:

```bash
pnpm prisma db seed
```

If you need a clean reset with seed data:

```bash
pnpm prisma:reset
```

### 5. Start the development server

```bash
pnpm dev
```

The application will be available at `http://localhost:3000`. This command also starts Prisma Studio.

### 6. How to log in

Login requires an email address that already exists in the database.

- **Option A: Use a seeded user**
  Go to `/auth` and log in with an email created by `prisma/seed.ts`, such as `alice@a.com` or `carl@c.com`.
- **Option B: Use your own email**
  Add your email to the seed data and run `pnpm prisma:reset` again.

To get your OTP:

- Check your configured email inbox.
- Or check the Prisma Studio verification table to see the code.

## Functional Requirements

### `/auth`

- Accept a user email address.
- Send a one-time passcode to a valid user email.
- Verify the passcode and sign the user in.

### `/`

- Show a dashboard tailored to the signed-in user role.
- Show client progress and appointments for client users.
- Show counts, requests, approvals, and shortcuts for staff users.

### `/calendar`

- Display appointments in calendar and list views.
- Filter appointments by clinician and client when applicable.
- Support appointment creation, editing, review, and deletion through the API.
- Show video-conference metadata when present.

### `/clients`

- List clinic clients.
- Open client detail views.
- Surface metrics and workflow-relevant profile information.

### `/clients/appointment-schedule-requests`

- Show pending client scheduling requests.
- Allow staff review and response actions.

### `/clients/session-notes-requests`

- Show client requests for note access or summaries.
- Allow staff approval or rejection.

### `/clients/session-notes-approvals`

- Show clinician-authored notes awaiting approval.
- Support the administrative approval workflow.

### `/audits`

- List audit records.
- Show reasoning, signatures, and supporting document metadata.
- Open detailed audit views.

### `/taskPage`

- Show required client tasks based on workflow stage.
- Let clients complete intake and assessment forms.
- Let clients request session-note access.
- Show approved content when permissions allow.

### `/forms/*`

- Provide pages for application, ACE, GAD-7, PHQ-9, PCL, physician statement, and release-of-information workflows.
- Support form completion and result/score views where implemented.

### Notes-related pages

- Support note authoring, review, and approval states.
- Support client-facing note access controls.

## User Workflows

### Client workflow

1. Sign into client profile.
2. Complete intake and required forms.
3. Wait for staff review and status progression.
4. View appointments and/or records when eligible.

### Clinician workflow

1. Sign in to the staff workspace.
2. Review assigned client submissions.
3. Manage appointments and documentation.
4. Submit notes into the review/approval flow.

### Admin workflow

1. Sign in to the operations dashboard.
2. Monitor notifications, requests, and client status.
3. Review appointment schedule requests.
4. Review session-note access requests.
5. Approve notes and inspect audit history.

## Migration Scripts

- Prisma migration files live in `prisma/migrations`.
- Use `pnpm dlx prisma migrate dev --name <change-name>` to create a development migration after schema changes.
- `prisma/seed.ts` seeds default users, roles, templates, and sample development data.
- `pnpm prisma:reset` resets the local development database and reruns the seed.

### Imported data from project partner

- There is currently **no automated import script** in this repository for data from our partner's system.

## Deployment Notes

- 2 Production enviorments are currently deployed (Main & Stage)
- Validate and push code and new functions/features into stage branch before merging into main.

- Production Stage: https://hch-stage.npts.tech/
- Production Main: https://hch.npts.tech/auth

## Project Structure

- `app/`: Frontend pages, components, assets, layouts, composables, and stores.
- `server/`: API routes, authentication logic, middleware, uploads, and backend utilities.
- `prisma/`: Schema files, migrations, generated client code, and seed scripts.
- `public/`: Static public assets.
- `uploads/`: Uploaded supporting documents in local development.
