# Nuxt Template (Better Auth + Prisma + SQLite)

A modern, production-ready Nuxt 4 template featuring a robust authentication system, ORM integration, and a clean UI foundation.

## Features

- **Nuxt 4**: The latest and greatest from the Nuxt team.
- **Better Auth**: Comprehensive authentication with **Email OTP** support.
- **Prisma**: Type-safe ORM for interacting with the database.
- **SQLite**: Lightweight, zero-configuration database, ideal for development and small-to-medium projects.
- **Nuxt UI v3**: Beautiful, accessible, and customizable UI components built with Tailwind CSS.
- **Nodemailer**: Pre-configured for sending verification emails via Gmail.

## Stack

- **Framework**: [Nuxt](https://nuxt.com/)
- **Auth**: [Better Auth](https://www.better-auth.com/)
- **ORM**: [Prisma](https://www.prisma.io/)
- **Database**: [SQLite](https://sqlite.org/)
- **UI Framework**: [Nuxt UI](https://ui3.nuxt.com/)
- **Email**: [Nodemailer](https://nodemailer.com/)

## Getting Started

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd nuxt-template
```

### 2. Install dependencies

This project uses `pnpm`, but you can use `npm` as well.

```bash
pnpm install
```

### 3. Setup Environment Variables

Copy the example environment file and fill in your details.

```bash
cp .env.example .env
```

Open `.env` and configure the following:

- `DATABASE_URL`: The SQLite connection string (default: `file:./dev.db`).
- `BETTER_AUTH_SECRET`: A secure random string for encryption. You can generate one using `openssl rand -hex 32`.
- `BETTER_AUTH_URL`: The base URL of your application (default: `http://localhost:3000`).
- `EMAIL_USER`: Your Gmail address (for OTP delivery).
- `EMAIL_PASS`: Your Gmail App Password. [How to generate an App Password](https://support.google.com/accounts/answer/185833).

### 4. Database Setup

Initialize your SQLite database and run migrations.

```bash
pnpm dlx prisma migrate dev --name init
```

Generate the Prisma client

```bash
pnpm dlx prisma generate
```

To reset the database and run the seed script:

```bash
pnpm prisma:reset
```

### 5. Start the development server

```bash
pnpm dev
```

Your application will be available at `http://localhost:3000`. This command also starts **Prisma Studio** automatically.

### 6. How to Login

Login requires an email address that already exists in the database.

- **Option A: Use the seeded user**
  Go to `/auth` and log in with `alice@a.com`.
- **Option B: Use your own email**
  Update `prisma/seed.ts` with your email, then run `pnpm prisma:reset` to re-seed.

**To get your OTP:**

- Check your configured email inbox.
- **Or**, check the **Prisma Studio** tab in your browser and look in the `Verification` table.

## Project Structure

- `app/`: Frontend code (pages, components, assets, composables).
- `server/`: Backend code (API routes, authentication logic, database utilities).
- `prisma/`: Database schema, migrations, and seed scripts.
- `public/`: Static assets.

---

## Document → Form Converter

The converter lets an admin upload a **PDF**, **Word (.docx)**, or **Google Doc** and turn it into a live form inside the app — without any generative AI. Everything runs through extraction rules.

---

### How it works — end to end

```
Upload page          Python FastAPI          Nuxt Server           Database
(/admin/convert)     (port 8000)             (Nitro)               (SQLite)
      │                    │                      │                     │
      │── POST file ──────►│                      │                     │
      │                    │ extract fields        │                     │
      │                    │◄──────────────────────│ forward bytes       │
      │                    │ return JSON schema    │                     │
      │                    │──────────────────────►│                     │
      │                    │                       │── save DocumentUpload + ExtractedFields ─►│
      │◄── redirect ────────────────────────────── │ return documentId   │
      │                                            │                     │
Correction UI                                      │                     │
(/admin/convert/:id)                               │                     │
      │── PATCH fields ──────────────────────────►│ autosave edits ────►│
      │── POST /save ────────────────────────────►│ create Form + Questions ──────────────────►│
      │◄── redirect to /forms/:slug ──────────────│                     │
```

---

### Step 1 — Start both services

**Python extraction service** (must be running before uploads):

```bash
cd backend
pip install -r requirements.txt
python main.py
# Runs on http://localhost:8000
```

**Nuxt dev server** (in a separate terminal):

```bash
pnpm dev
# Runs on http://localhost:3000
```

The Nuxt server calls the Python service via `EXTRACT_SERVICE_URL` (defaults to `http://localhost:8000` — override in `.env`).

---

### Step 2 — Upload a document

Navigate to **`/admin/convert`**. You must be logged in.

#### PDF or Word (.docx)

1. Click the **PDF / Word** tab.
2. Drag and drop a file (or click to browse). Supported: `.pdf`, `.docx`, up to 20 MB.
3. Click **Extract Form Fields**.

The file is saved to `server/uploads/<documentId>.pdf` (or `.docx`) so it can be previewed later.

#### Google Doc

1. Click the **Google Doc** tab.
2. Paste the full Google Docs URL or just the document ID.
3. Click **Fetch & Extract**.

> **Prerequisite:** The Google Doc must be shared with the service account whose credentials are in `GOOGLE_CREDS_PATH` (`.env`). See [Google Docs adapter setup](#google-docs-adapter-setup).

---

### Step 3 — How fields are extracted

The Python service (`backend/`) uses **deterministic rules only** — no AI.

#### PDF adapter (`adapters/pdf_adapter.py`)

Two passes run on every page:

| Pass                          | Strategy                                                                                                                                                                           | Confidence |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| **Pass 1** — Line proximity   | Finds text clusters that sit above a thin horizontal rectangle (an input underline) within 60 pt. Classic form layouts.                                                            | `high`     |
| **Pass 2** — Column detection | Splits words into X-position buckets. Treats the leftmost column (up to 50 % of page width) as the label column. Each Y-row = one field. Handles table-style forms like the GAD-7. | `low`      |

Results from both passes are **merged** — Pass 1 wins on duplicates. Fields with non-printable-only labels are discarded.

**Type inference** from label text:

| Keyword pattern              | Inferred type |
| ---------------------------- | ------------- |
| date, dob, born, birthday    | `date`        |
| age, number, amount, score   | `number`      |
| check, tick, agree, confirm  | `checkbox`    |
| select, choose, option, pick | `dropdown`    |
| _(anything else)_            | `text`        |

#### Word adapter (`adapters/word_adapter.py`)

Iterates paragraphs and tables in document order:

- **Paragraphs** ending with `:` or `?`, or followed by a blank paragraph → label field.
- **Bullet/list paragraphs** that follow a label paragraph → accumulated into a single `radio` field with options.
- **Table rows** → first column = label, second column = answer area. If the answer cell contains `/`-separated values (e.g. `Yes / No`), they become radio options.

#### Google Docs adapter (`adapters/gdocs_adapter.py`)

Calls the Google Docs REST API (`documents.readonly` scope) and walks `body.content`:

- **Paragraph elements** with trailing `:` or `?`, or followed by a blank paragraph, or containing a `HORIZONTAL_RULE` → label field.
- **Table elements** → same first-column/second-column logic as the Word adapter.

---

### Step 4 — Correct the extracted fields

After upload you are redirected to **`/admin/convert/:id`**.

The UI is split into two panels:

```
┌─────────────────────────┬──────────────────────────────────┐
│   Source Document       │   Form Builder                   │
│   (PDF iframe /         │                                  │
│    Google Doc embed)    │   ┌──────────────────────────┐   │
│                         │   │ 1 [high]           p.1 t │   │
│                         │   │ Label                    │   │
│                         │   │ [__________________]     │   │
│                         │   │ Type: text number date…  │   │
│                         │   └──────────────────────────┘   │
│                         │   ┌──────────────────────────┐   │
│                         │   │ 2 [low]  ← needs review  │   │
│                         │   └──────────────────────────┘   │
└─────────────────────────┴──────────────────────────────────┘
```

**What each element means:**

| Element                | Description                                                                                |
| ---------------------- | ------------------------------------------------------------------------------------------ |
| `[high]` badge         | Extraction found direct evidence of an input area below the label                          |
| `[low]` badge          | No input area detected — verify against the source document                                |
| Red border / red input | Label is empty — must be filled in manually                                                |
| Amber border           | Low-confidence field                                                                       |
| Page hint (`p.1`)      | PDF page the label was found on                                                            |
| Type buttons           | Click to change the field type (`text`, `number`, `date`, `checkbox`, `dropdown`, `radio`) |
| Options row            | Appears for `checkbox`, `dropdown`, `radio` — enter comma-separated option values          |
| 🗑 trash icon          | Soft-deletes the field (it is hidden but recoverable with **Restore**)                     |
| **+ Add Field**        | Inserts a blank field you can fill in manually                                             |

**Autosave:** Every edit is debounced and persisted automatically (800 ms after the last keystroke). A status indicator in the top bar shows `Saving…` → `Saved`.

---

### Step 5 — Save as Form

Once all labels are filled and types are correct, click **Save as Form** (top-right).

Fill in:

- **Form Title** — displayed to users (e.g. `GAD-7 Anxiety Scale`).
- **Slug** — the URL key, auto-generated from the title (e.g. `gad-7-anxiety-scale`). Must be unique.
- **Description** — optional subtitle.

Click **Create Form**. The system will:

1. Load all non-deleted `ExtractedField` rows for this document.
2. Create one `Question` row per field (with a unique `alias` derived from the slug + field index + label).
3. Create a `Form` row and link all questions via `FormQuestion` junction rows (preserving order).
4. Set `DocumentUpload.status = "saved"` and record `savedFormId`.
5. Redirect you to `/forms/<slug>` — the live form.

---

### Database models

```
DocumentUpload              ExtractedField
──────────────              ──────────────
id (cuid)                   id (cuid)
originalName                documentId  ──────────► DocumentUpload.id
mimeType                    fieldIndex  (sort order)
storagePath                 label       (question text)
status                      type        (text|number|date|checkbox|dropdown|radio)
  pending → extracting      options     (JSON array, nullable)
  → review → saved          pageNumber  (PDF page, nullable)
  → error                   boundingBox (JSON {x0,y0,x1,y1,page}, nullable)
sourceUrl (Google Docs)     elementIndex (Word/GDocs paragraph index, nullable)
savedFormId ──────────────► Form.id     confidence  (high|low)
                            isDeleted   (soft-delete flag)

Form                        Question                FormQuestion
────                        ────────                ────────────
id (cuid)                   id (cuid)               formId ──► Form.id
title                       text                    questionId ──► Question.id
slug (unique)               type                    order (1-based)
description                 alias (unique)
sourceDocuments[] ──────────► DocumentUpload[]
```

---

### API reference

| Method  | Path                       | Description                                                                                                       |
| ------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `POST`  | `/api/convert/upload`      | Upload a PDF/DOCX (`file` field) or provide a Google Doc ID (`docId` field). Returns `{ documentId }`.            |
| `GET`   | `/api/convert/:id`         | Returns the `DocumentUpload` with all non-deleted `ExtractedField` rows.                                          |
| `PATCH` | `/api/convert/:id`         | Body: `{ fields: FieldPatch[] }`. Autosave endpoint — updates `label`, `type`, `options`, `isDeleted` per field.  |
| `POST`  | `/api/convert/:id/save`    | Body: `{ title, slug, description? }`. Promotes fields into `Form` + `Question` rows. Returns `{ formId, slug }`. |
| `GET`   | `/api/convert/:id/preview` | Streams the original uploaded file as `application/pdf` for the iframe viewer.                                    |

---

### Python extraction service API

| Method | Path            | Description                                                       |
| ------ | --------------- | ----------------------------------------------------------------- |
| `GET`  | `/health`       | Liveness check — returns `{ "status": "ok" }`.                    |
| `POST` | `/extract/file` | Multipart upload (`file` field). Returns `ExtractionResult` JSON. |
| `POST` | `/extract/gdoc` | JSON body `{ "doc_id": "..." }`. Returns `ExtractionResult` JSON. |

**`ExtractionResult` schema:**

```json
{
  "source_type": "pdf",
  "source_name": "GAD-7_Anxiety.pdf",
  "fields": [
    {
      "field_id": "uuid",
      "label": "Feeling nervous, anxious, or on edge",
      "type": "radio",
      "options": ["Not at all", "Several days", "More than half the days", "Nearly every day"],
      "bounding_box": { "x0": 36, "y0": 120, "x1": 360, "y1": 134, "page": 1 },
      "element_index": null,
      "confidence": "high"
    }
  ],
  "warnings": []
}
```

---

### Google Docs adapter setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → create a project.
2. Enable the **Google Docs API**.
3. Create a **Service Account** → download the JSON key.
4. Set in `.env`:
   ```env
   GOOGLE_CREDS_PATH=/absolute/path/to/service-account.json
   ```
5. Share the Google Doc with the service account email (e.g. `my-sa@my-project.iam.gserviceaccount.com`) as **Viewer**.

---

### Environment variables

| Variable              | Required | Default                 | Description                                            |
| --------------------- | -------- | ----------------------- | ------------------------------------------------------ |
| `DATABASE_URL`        | ✓        | `file:./dev.db`         | SQLite connection string                               |
| `BETTER_AUTH_SECRET`  | ✓        | —                       | Random secret for auth encryption                      |
| `BETTER_AUTH_URL`     | ✓        | `http://localhost:3000` | App base URL                                           |
| `EMAIL_USER`          | ✓        | —                       | Gmail address for OTP delivery                         |
| `EMAIL_PASS`          | ✓        | —                       | Gmail App Password                                     |
| `EXTRACT_SERVICE_URL` |          | `http://localhost:8000` | Python extraction service base URL                     |
| `GOOGLE_CREDS_PATH`   |          | —                       | Path to Google service-account JSON (Google Docs only) |

---

## Code Reference

This section documents the purpose and internal logic of every file in the converter pipeline, extracted from the original source-file comments.

---

### `backend/schema.py`

Defines the **unified JSON schema** that every adapter must produce. All three adapters (PDF, Word, Google Docs) return a list of `ExtractedField` objects wrapped in an `ExtractionResult`. The Normalizer validates the output and ensures it always conforms to this schema.

**Key types:**

| Class              | Purpose                                                                                                                 |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| `FieldType`        | Enum of valid input types: `text`, `number`, `date`, `checkbox`, `dropdown`, `radio`                                    |
| `Confidence`       | `high` — an input area was detected; `low` — no input area found, admin must verify                                     |
| `BoundingBox`      | Pixel/point coordinates `(x0, y0, x1, y1, page)` from a PDF page                                                        |
| `ExtractedField`   | One form field: `field_id`, `label`, `type`, `options`, `bounding_box` or `element_index`, `confidence`, `raw_metadata` |
| `ExtractionResult` | Container: `source_type`, `source_name`, `fields[]`, `warnings[]`                                                       |

`bounding_box` and `element_index` are mutually exclusive — PDF extraction fills `bounding_box`; Word/Google Docs fill `element_index`.

---

### `backend/normalizer.py`

The **router** that detects the file type from the MIME type and delegates to the correct adapter. Guarantees the output always conforms to `ExtractionResult`.

**Routing table:**

| MIME type                                                                 | Adapter called                                 |
| ------------------------------------------------------------------------- | ---------------------------------------------- |
| `application/pdf`                                                         | `pdf_adapter.extract(file_path, source_name)`  |
| `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | `word_adapter.extract(file_path, source_name)` |
| `application/vnd.google-apps.document`                                    | `gdocs_adapter.extract(gdoc_id)`               |

Google Docs are passed as a `doc_id` string — no file is downloaded.

`route()` parameters:

| Parameter     | Type                  | Description                                                  |
| ------------- | --------------------- | ------------------------------------------------------------ |
| `mime_type`   | `str`                 | MIME type of the uploaded document                           |
| `file_path`   | `Path \| str \| None` | Path to the uploaded file (PDF or DOCX)                      |
| `source_name` | `str`                 | Original filename to embed in the result                     |
| `gdoc_id`     | `str \| None`         | Google Docs document ID (only when `mime_type == MIME_GDOC`) |

---

### `backend/main.py`

**FastAPI entry point** for the extraction service. Runs on `http://localhost:8000`.

**Endpoints:**

| Method | Path            | Description                                                                                                                                                            |
| ------ | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`  | `/health`       | Liveness probe — returns `{ "status": "ok" }`                                                                                                                          |
| `POST` | `/extract/file` | Multipart upload (`file` field). Accepts PDF or DOCX. Writes bytes to a temp file, calls `normalizer.route()`, deletes the temp file, returns `ExtractionResult` JSON. |
| `POST` | `/extract/gdoc` | JSON body `{ "doc_id": "..." }`. Calls `normalizer.route()` for Google Docs, returns `ExtractionResult` JSON.                                                          |

MIME type detection (`_detect_mime`): prefers the browser-supplied `content_type`; falls back to file-extension mapping so Windows/Mac discrepancies don't break routing.

CORS is configured via the `ALLOWED_ORIGINS` environment variable (comma-separated, default `http://localhost:3000`).

---

### `backend/adapters/pdf_adapter.py`

**Two-pass strategy** that handles both classic and table-style PDF form layouts.

**Pass 1 — Line-proximity detection** (`_pass1`)

- Collects thin horizontal rectangles (`height ≤ 3 pt`, `width ≥ 30 pt`) that represent input underlines.
- Clusters words into visual rows using a `ROW_MERGE_GAP = 4 pt` bucket.
- For each label-like text cluster, checks if an underline exists within `LABEL_TO_INPUT_GAP = 60 pt` below it.
- Match found → `confidence: high`. No match → `confidence: low`.

**Pass 2 — Column detection** (`_pass2`)

- Buckets words by their left-edge X position (`COL_BUCKET_SIZE = 20 pt`).
- Treats all columns whose left edge is within the left 50 % of the page as the label column.
- Each distinct Y-row in that column becomes one field. Always `confidence: low` — the admin must verify.

**Merge** (`_merge`)

- Pass 1 results are preferred. Pass 2 results are added only when their label doesn't already appear in Pass 1 (case-insensitive deduplication).
- Final list is sorted by page number then top-of-bounding-box Y coordinate.

**Tunable constants:**

| Constant             | Value | Meaning                                                       |
| -------------------- | ----- | ------------------------------------------------------------- |
| `LINE_MIN_WIDTH`     | 30 pt | Minimum width for a rect to be treated as an input underline  |
| `LINE_MAX_HEIGHT`    | 3 pt  | Maximum height for a rect to be treated as an input underline |
| `LABEL_TO_INPUT_GAP` | 60 pt | Max vertical gap from label bottom to an underline            |
| `MIN_LABEL_CHARS`    | 3     | Minimum characters for text to be considered a label          |
| `COL_BUCKET_SIZE`    | 20 pt | X-position bucket size for column detection                   |
| `ROW_MERGE_GAP`      | 4 pt  | Word-top bucket size for row grouping                         |

`_clean()` removes invisible Unicode control and zero-width characters (categories `Cf`, `Cc`) before any label comparison.

---

### `backend/adapters/word_adapter.py`

Iterates all top-level document elements (paragraphs and tables) in document order using `_iter_block_items()`, which yields them in their actual sequence from the XML body.

**Paragraph rules:**

- A paragraph is treated as a label if its text ends with `:` or `?`, or if it is a short phrase (3–10 words).
- Confidence is `high` if the label ends with `:` / `?`, or if the next paragraph is blank (the answer line).
- Bullet-style paragraphs (`List Bullet`, `List Number`, `List Paragraph`) are accumulated into a single `radio` field with options. The group is flushed when a non-bullet element is encountered.

**Table rules:**

- First cell of each row → label text.
- Second cell of each row → answer area. If the answer cell contains `/`-separated values (e.g. `Yes / No`), those become radio options.

---

### `backend/adapters/gdocs_adapter.py`

Uses the **Google Docs REST API** (`documents.readonly` scope) to retrieve a document's `body.content` (`structuralElements`). No file is downloaded — only the document ID from the URL is needed.

**Authentication:** reads `GOOGLE_CREDS_PATH` env var. If set, loads a service-account JSON key file. If unset, falls back to Application Default Credentials.

**Paragraph rules:**

- A `HORIZONTAL_RULE` inline object within a paragraph indicates an input line → `confidence: high`.
- A blank paragraph immediately following the label → `confidence: high`.
- Label ending with `:` or `?` → `confidence: high`.
- Paragraphs with a `LIST` named style type → field type forced to `radio`.

**Table rules:** same first-column/second-column logic as the Word adapter.

---

### `server/api/convert/upload.post.ts`

**`POST /api/convert/upload`** — accepts a multipart form with either a `file` field (PDF/DOCX binary) or a `docId` field (Google Docs document ID).

**File upload workflow:**

1. Creates a `DocumentUpload` row with `status: "extracting"`.
2. Saves the raw bytes to `server/uploads/<documentId>.<ext>` so the preview endpoint can serve it later.
3. Forwards the bytes to the Python extraction service (`EXTRACT_SERVICE_URL`).
4. Calls `persistFields()` which writes one `ExtractedField` row per returned field, stripping invisible Unicode characters from labels.
5. Updates `DocumentUpload.status` to `"review"` on success, or `"error"` with a message on failure.
6. Returns `{ documentId }`.

**Google Doc workflow:** skips file saving; passes the `doc_id` directly to `/extract/gdoc` on the Python service.

---

### `server/api/convert/[id].get.ts`

**`GET /api/convert/:id`** — returns the `DocumentUpload` row together with all non-deleted `ExtractedField` rows, sorted by `fieldIndex` ascending.

---

### `server/api/convert/[id].patch.ts`

**`PATCH /api/convert/:id`** — real-time autosave endpoint called by the correction UI 800 ms after the last edit.

Body: `{ fields: FieldPatch[] }` where each `FieldPatch` must include `fieldId` plus any subset of `{ label, type, options, isDeleted }`. Only the provided keys are updated (partial patch via spread).

---

### `server/api/convert/[id]/preview.get.ts`

**`GET /api/convert/:id/preview`** — streams the originally uploaded PDF or DOCX back to the browser so the correction UI can embed it in an `<iframe>`.

- Google Doc sources have no local file — returns 404.
- If the file is missing from disk (uploaded before file-saving was introduced), returns 404 with a descriptive message.
- Sets `Content-Type`, `Content-Disposition: inline`, and `Cache-Control: private, max-age=3600`.

---

### `server/api/convert/[id]/save.post.ts`

**`POST /api/convert/:id/save`** — promotes a reviewed `DocumentUpload` into a live `Form` + `Question` set.

Body: `{ title: string, slug: string, description?: string }`

**Workflow:**

1. Loads all non-deleted `ExtractedField` rows for the document.
2. Creates one `Question` row per field. The `alias` is derived as `<slug>_<fieldIndex>_<sanitised_label_30chars>` to ensure global uniqueness.
3. Creates a `Form` row and links all questions via `FormQuestion` junction rows (order preserved).
4. Sets `DocumentUpload.status = "saved"` and writes `savedFormId`.
5. Returns `{ formId, slug }`. The client redirects to `/forms/<slug>`.

---

## License

MIT
