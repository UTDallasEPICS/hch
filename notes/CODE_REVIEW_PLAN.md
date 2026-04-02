# Codebase Review & Refactoring Plan

## Identified Issues

### 1. Database & Architectural Coherence (High Severity)

- **The "Hardcoded" Smell:** Forms like AppForm, GadForm, PhqForm, and PclForm have explicitly defined tables with literal columns for each question (e.g., `g01`, `q02`).
- **The "Dynamic" Smell:** Exists alongside a dynamic form engine (`Form`, `Question`, `AceResponse`).
- **Redundant Tables:** Duplicated domain concepts like `Note` & `NoteEdit` existing alongside `SessionNote` & `SessionNoteEdit`.

### 2. Developer Experience & DRY Violations (High Severity)

- **Missing Server Middleware:** No centralized authentication/authorization. Secure API routes manually verify sessions and run: `if (!isAdmin(...)) { ... }`.
- **Hardcoded Workflow Logic:** Business logic dictating required forms and specific pass thresholds (`ACE_QUESTION_COUNT = 10`) is hardcoded in backend utilities rather than using a flexible database assignment.

### 3. Frontend Architecture & "N+1" Problems (Medium Severity)

- **Network Waterfall:** `app/pages/taskPage.vue` makes 8+ separate API calls on mount to determine user progress.
- **Reactivity Anti-Patterns:** Code literally spells out field-by-field assignments (e.g., `form.g1 = a.g01; form.g2 = a.g02;`).
- **Manual Promise Orchestration:** Adding a new form requires modifying massive `Promise.allSettled` blocks in the frontend.

### 4. UI/UX & Ecosystem Alignment (Medium/Low Severity)

- **Underutilizing `@nuxt/ui`:** Forms are built using raw HTML inputs instead of leveraging `UFormGroup` and `URadioGroup`.
- **Leaking Business Logic:** Logic like GAD-7 severity scoring is duplicated between the frontend and backend.

---

## Action Plan

### Phase 1: Security & Route Consolidation

- [ ] Create a Nitro server middleware (`server/middleware/auth.ts`) to handle session verification and authorization.
- [ ] Refactor all secure API routes to utilize the context provided by the middleware instead of manual `isAdmin` checks.

### Phase 2: The "N+1" Frontend Fix

- [ ] Create a new aggregated API endpoint (e.g., `/api/user/dashboard-status`).
- [ ] Refactor `app/pages/taskPage.vue` to use this single endpoint, drastically reducing page load time and code complexity.

### Phase 3: Unify the Form Architecture

- [ ] Migrate hardcoded forms (`GAD`, `PHQ`, `PCL`) into the standardized JSON payload structure or dynamic form engine.
- [ ] Update frontend reactivity to use loops and dynamic state instead of hardcoded fields.
- [ ] Refactor `@nuxt/ui` implementations to use proper form components.
- [ ] Consolidate redundant tables (e.g., merge `Note` and `SessionNote`).
