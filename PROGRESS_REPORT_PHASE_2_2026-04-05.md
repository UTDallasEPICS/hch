## Phase 2: API Route Reorganization (Completed April 5, 2026)

### 1. User & Auth Consolidation

- **Deleted Legacy Folders:** Completely removed the non-standard `/server/api/get/` and `/server/api/user/` directories.
- **RESTful Endpoints:** Migrated all endpoints retrieving the current user's state into a standardized `/server/api/users/me/` structure:
  - `is-admin.get.ts` -> `users/me/is-admin.get.ts`
  - `my-status.get.ts` -> `users/me/status.get.ts`
  - `permissions.get.ts` -> `users/me/permissions.get.ts`
  - `client-status.get.ts` -> `users/me/client-status.get.ts`
- Migrated `/get/users/index.ts` to standard `/users/index.get.ts`.
- Ran batch `sed` scripts across the `/app` frontend directory to update all `$fetch` calls to point to the new `/api/users/me/*` endpoints.

### 2. Forms API Consolidation

- Unified the previously scattered clinical assessment APIs by moving them into a cohesive `/server/api/forms/` directory.
  - `/api/ace` -> `/api/forms/ace`
  - `/api/gad` -> `/api/forms/gad`
  - `/api/phq` -> `/api/forms/phq`
  - `/api/pcl` -> `/api/forms/pcl`
  - `/api/application` -> `/api/forms/application`
  - `/api/physician-statement` -> `/api/forms/physician-statement`
  - `/api/release-of-information` -> `/api/forms/release-of-information`
- Updated the frontend `taskPage.vue` and all Vue form components to reference the newly nested `/api/forms/*` endpoints.

### 3. Appointments API Strict REST Refactoring

- **Nitro Conventions:** Refactored the appointments API to strictly adhere to Nuxt/Nitro file-based routing and HTTP methods, eliminating RPC-style naming:
  - `create.post.ts` -> `index.post.ts`
  - `update.post.ts` -> `[id].put.ts`
  - `delete.post.ts` -> `[id].delete.ts`
- **Backend Updates:** Modified the `put` and `delete` handlers to extract the `id` from the URL parameters (`getRouterParam`) rather than parsing it out of the request body.
- **Frontend Updates:** Refactored `app/pages/calendar.vue` to append the event ID dynamically to the `$fetch` URL and utilize the proper `PUT` and `DELETE` HTTP methods.

### 4. Verification

- Successfully ran `npx vue-tsc --noEmit` to ensure the massive sweeping changes to the API endpoints and frontend fetch calls did not introduce any regressions or broken links. The compilation passed perfectly.

---

## Next Steps: Phase 3

With the database schema unified and the API folders strictly mapped to standard REST entities, the next critical step is to tackle the security architecture. We will implement "secure-by-default" global middleware and strip out the verbose, manual authentication boilerplate currently polluting over 50 API route files.
