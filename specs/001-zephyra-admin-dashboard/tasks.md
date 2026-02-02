# Tasks: Zephyra Admin Dashboard

**Input**: Design documents from `/specs/001-zephyra-admin-dashboard/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Tests**: Tests included as per Constitution II (80% cobertura código crítico).

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US7)
- Exact file paths included in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [x] T001 Create Next.js 16 project with TypeScript in repository root
- [x] T002 [P] Install production dependencies: `convex`, `resend`, `@react-email/components`, `jose`, `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-image`, `@tiptap/extension-table`, `@tiptap/extension-youtube`, `@tiptap/extension-link`
- [x] T003 [P] Install dev dependencies: `vitest`, `playwright`, `@types/react`, `@types/node`
- [x] T004 [P] Create project directory structure per plan.md (`src/app/`, `src/features/`, `src/components/`, `convex/`, `tests/`)
- [x] T005 [P] Configure `.mcp.json` with next-devtools, convex, vercel, github servers
- [x] T006 [P] Create `src/styles/variables.css` with CSS custom properties (colors, spacing, typography, shadows)
- [x] T007 [P] Create `src/app/globals.css` importing variables and reset styles
- [x] T008 [P] Create `.env.local.example` with required environment variables template

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Convex Backend Setup

- [x] T009 Initialize Convex project with `npx convex dev`
- [x] T010 Copy `contracts/convex-schema.ts` to `convex/schema.ts`
- [x] T011 [P] Create `convex/model/softDelete.ts` with soft delete helper functions
- [x] T012 [P] Create `convex/model/auth.ts` with `requireAuth()` and `requireRole()` helpers
- [x] T013 [P] Create `convex/files.ts` with `generateUploadUrl`, `getUrl`, `delete` mutations/queries

### Next.js Core Setup

- [x] T014 Create `src/providers/ConvexProvider.tsx` client component wrapping Convex client
- [x] T015 Create `src/app/layout.tsx` root layout with ConvexProvider and global styles
- [x] T016 Create `proxy.ts` in project root for route protection (replaces middleware.ts)

### UI Component Library (Shared)

- [x] T017 [P] Create `src/components/ui/Button/Button.tsx` and `Button.module.css` with variants (primary, secondary, danger, ghost)
- [x] T018 [P] Create `src/components/ui/Input/Input.tsx` and `Input.module.css` with label, error states
- [x] T019 [P] Create `src/components/ui/Select/Select.tsx` and `Select.module.css`
- [x] T020 [P] Create `src/components/ui/Modal/Modal.tsx` and `Modal.module.css` with confirm dialog variant
- [x] T021 [P] Create `src/components/ui/Table/Table.tsx` and `Table.module.css` with sortable headers
- [x] T022 [P] Create `src/components/ui/Card/Card.tsx` and `Card.module.css`
- [x] T023 [P] Create `src/components/ui/Toast/Toast.tsx` and `Toast.module.css` with success/error/warning variants
- [x] T024 [P] Create `src/providers/ToastProvider.tsx` with toast context and hook
- [x] T025 [P] Create `src/components/ui/Skeleton/Skeleton.tsx` for loading states
- [x] T026 [P] Create `src/components/ui/ImageUpload/ImageUpload.tsx` with Convex storage integration
- [x] T027 [P] Create `src/lib/cn.ts` classNames utility helper

### Layout Components

- [x] T028 [P] Create `src/components/layout/AuthLayout/AuthLayout.tsx` and `.module.css` for login pages
- [x] T029 [P] Create `src/components/layout/DashboardLayout/DashboardLayout.tsx` and `.module.css` with sidebar, header

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 7 - Autenticación de Administradores (Priority: P1) 🎯 MVP

**Goal**: Secure access to dashboard with email/password authentication, session management, and password reset

**Independent Test**: Access `/admin` without auth → redirected to `/login`. Login with valid credentials → access granted. Logout → access denied.

### Tests for US7

- [ ] T030 [P] [US7] E2E test: unauthenticated user redirected to login in `tests/e2e/playwright/auth.spec.ts`
- [ ] T031 [P] [US7] E2E test: valid login grants dashboard access in `tests/e2e/playwright/auth.spec.ts`
- [ ] T032 [P] [US7] E2E test: invalid credentials show error in `tests/e2e/playwright/auth.spec.ts`
- [ ] T033 [P] [US7] E2E test: password reset flow works in `tests/e2e/playwright/auth.spec.ts`

### Implementation for US7

- [x] T034 [US7] Create `convex/adminUsers.ts` with `login`, `logout`, `getCurrentUser` mutations/queries
- [x] T035 [US7] Create `convex/adminUsers.ts` `requestPasswordReset` mutation (creates token, schedules email)
- [x] T036 [US7] Create `convex/adminUsers.ts` `resetPassword` mutation (validates token, updates password)
- [ ] T037 [P] [US7] Create `src/emails/PasswordReset.tsx` React Email template
- [x] T038 [US7] Create `src/features/auth/lib/session.ts` with JWT sign/verify using `jose`
- [x] T039 [US7] Create `src/features/auth/actions/login.ts` server action calling Convex and setting cookie
- [x] T040 [US7] Create `src/features/auth/actions/logout.ts` server action clearing cookie
- [x] T041 [P] [US7] Create `src/features/auth/components/LoginForm/LoginForm.tsx` and `.module.css`
- [x] T042 [P] [US7] Create `src/features/auth/components/ForgotPasswordForm/ForgotPasswordForm.tsx`
- [x] T043 [P] [US7] Create `src/features/auth/components/ResetPasswordForm/ResetPasswordForm.tsx`
- [x] T044 [US7] Create `src/app/(auth)/login/page.tsx` using LoginForm
- [x] T045 [US7] Create `src/app/(auth)/forgot-password/page.tsx` using ForgotPasswordForm
- [x] T046 [US7] Create `src/app/(auth)/reset-password/page.tsx` using ResetPasswordForm
- [x] T047 [US7] Create `src/app/(auth)/layout.tsx` using AuthLayout
- [x] T048 [US7] Update `proxy.ts` to protect `/admin/*` routes and redirect auth routes for logged-in users
- [x] T049 [US7] Create `convex/seed.ts` with `seedSuperAdmin` internal mutation for initial admin

**Checkpoint**: Authentication complete. Dashboard access is protected. Password reset works via email.

---

## Phase 4: Dashboard Home & Stats (Priority: P1)

**Goal**: Dashboard landing page with statistics overview

**Independent Test**: After login, dashboard shows stats for all content types.

### Implementation for Dashboard

- [x] T050 [P] Create `convex/stats.ts` with `getDashboardStats` query returning counts for all entities
- [x] T051 [P] Create `src/features/dashboard/components/StatsCard/StatsCard.tsx` and `.module.css`
- [x] T052 [P] Create `src/features/dashboard/components/Sidebar/Sidebar.tsx` and `.module.css` with navigation links
- [x] T053 [P] Create `src/features/dashboard/components/Header/Header.tsx` and `.module.css` with user info, logout
- [x] T054 Create `src/app/(dashboard)/admin/page.tsx` dashboard home with stats grid
- [x] T055 Create `src/app/(dashboard)/layout.tsx` using DashboardLayout with Sidebar and Header

**Checkpoint**: Dashboard home accessible with navigation to all sections.

---

## Phase 5: User Story 1 - Gestión de Artículos del Blog (Priority: P1) 🎯 MVP

**Goal**: Full CRUD for blog posts with WYSIWYG editor, drafts, and publish workflow

**Independent Test**: Create article with all fields → appears on public site. Edit → changes reflect. Delete → moves to trash.

### Tests for US1

- [ ] T056 [P] [US1] Unit test: slug generation from title in `tests/unit/features/blog/slug.test.ts`
- [ ] T057 [P] [US1] E2E test: create article flow in `tests/e2e/playwright/blog.spec.ts`
- [ ] T058 [P] [US1] E2E test: edit article flow in `tests/e2e/playwright/blog.spec.ts`
- [ ] T059 [P] [US1] E2E test: delete article (soft delete) in `tests/e2e/playwright/blog.spec.ts`

### Implementation for US1

- [ ] T060 [US1] Create `convex/blogPosts.ts` with `list`, `listPublished`, `getBySlug`, `getById` queries
- [ ] T061 [US1] Create `convex/blogPosts.ts` `create`, `update`, `publish`, `unpublish`, `delete` mutations
- [ ] T062 [P] [US1] Create `src/features/blog/components/WysiwygEditor/WysiwygEditor.tsx` using Tiptap with extensions
- [ ] T063 [P] [US1] Create `src/features/blog/components/WysiwygEditor/WysiwygEditor.module.css` editor styles
- [ ] T064 [P] [US1] Create `src/features/blog/components/BlogList/BlogList.tsx` and `.module.css` with status badges
- [ ] T065 [P] [US1] Create `src/features/blog/components/BlogCard/BlogCard.tsx` and `.module.css`
- [ ] T066 [US1] Create `src/features/blog/components/BlogForm/BlogForm.tsx` with all fields including WYSIWYG
- [ ] T067 [US1] Create `src/features/blog/components/BlogForm/BlogForm.module.css`
- [ ] T068 [US1] Create `src/app/(dashboard)/admin/blog/page.tsx` listing all posts with filters
- [ ] T069 [US1] Create `src/app/(dashboard)/admin/blog/new/page.tsx` create article page
- [ ] T070 [US1] Create `src/app/(dashboard)/admin/blog/[id]/edit/page.tsx` edit article page

**Checkpoint**: Blog management complete. Can create, edit, publish/unpublish, and delete articles.

---

## Phase 6: User Story 2 - Gestión del Equipo (Priority: P1) 🎯 MVP

**Goal**: CRUD for team members with image upload and visibility toggle

**Independent Test**: Add team member → appears in public carousel. Edit → changes reflect. Delete → warning if has blog posts.

### Tests for US2

- [ ] T071 [P] [US2] E2E test: add team member in `tests/e2e/playwright/team.spec.ts`
- [ ] T072 [P] [US2] E2E test: edit team member in `tests/e2e/playwright/team.spec.ts`
- [ ] T073 [P] [US2] E2E test: delete team member with blog posts shows warning in `tests/e2e/playwright/team.spec.ts`

### Implementation for US2

- [ ] T074 [US2] Create `convex/teamMembers.ts` with `list`, `listPublic`, `getById`, `canDelete` queries
- [ ] T075 [US2] Create `convex/teamMembers.ts` `create`, `update`, `reorder`, `delete` mutations
- [ ] T076 [P] [US2] Create `src/features/team/components/TeamList/TeamList.tsx` and `.module.css` with drag reorder
- [ ] T077 [P] [US2] Create `src/features/team/components/TeamCard/TeamCard.tsx` and `.module.css`
- [ ] T078 [US2] Create `src/features/team/components/TeamForm/TeamForm.tsx` and `.module.css` with image upload
- [ ] T079 [US2] Create `src/app/(dashboard)/admin/team/page.tsx` listing team members
- [ ] T080 [US2] Create `src/app/(dashboard)/admin/team/new/page.tsx` add team member
- [ ] T081 [US2] Create `src/app/(dashboard)/admin/team/[id]/edit/page.tsx` edit team member

**Checkpoint**: Team management complete. Can add, edit, reorder, and delete team members.

---

## Phase 7: User Story 3 - Gestión de Proyectos (Priority: P2)

**Goal**: CRUD for projects with nested achievements management

**Independent Test**: Create project with achievements → visible on public site. Edit → changes reflect. Reorder achievements → order updates.

### Tests for US3

- [ ] T082 [P] [US3] E2E test: create project with achievements in `tests/e2e/playwright/projects.spec.ts`
- [ ] T083 [P] [US3] E2E test: edit project and reorder achievements in `tests/e2e/playwright/projects.spec.ts`

### Implementation for US3

- [ ] T084 [US3] Create `convex/projects.ts` with `list`, `listPublic`, `getBySlug` queries (includes achievements)
- [ ] T085 [US3] Create `convex/projects.ts` `create`, `update`, `reorder`, `delete` mutations
- [ ] T086 [US3] Create `convex/projectAchievements.ts` with `add`, `update`, `delete`, `reorder` mutations
- [ ] T087 [P] [US3] Create `src/features/projects/components/ProjectList/ProjectList.tsx` and `.module.css`
- [ ] T088 [P] [US3] Create `src/features/projects/components/ProjectCard/ProjectCard.tsx` and `.module.css`
- [ ] T089 [US3] Create `src/features/projects/components/ProjectForm/ProjectForm.tsx` with achievements editor
- [ ] T090 [P] [US3] Create `src/features/projects/components/AchievementsList/AchievementsList.tsx` inline editable list
- [ ] T091 [US3] Create `src/app/(dashboard)/admin/projects/page.tsx` listing projects
- [ ] T092 [US3] Create `src/app/(dashboard)/admin/projects/new/page.tsx` create project
- [ ] T093 [US3] Create `src/app/(dashboard)/admin/projects/[id]/edit/page.tsx` edit project

**Checkpoint**: Projects management complete including achievements.

---

## Phase 8: User Story 4 - Gestión de Servicios (Priority: P2)

**Goal**: CRUD for services with icon picker

**Independent Test**: Create service with icon → visible in public carousel. Edit → changes reflect. Reorder → order updates.

### Tests for US4

- [ ] T094 [P] [US4] E2E test: create service with icon in `tests/e2e/playwright/services.spec.ts`
- [ ] T095 [P] [US4] E2E test: reorder services in `tests/e2e/playwright/services.spec.ts`

### Implementation for US4

- [ ] T096 [US4] Create `convex/services.ts` with `list`, `listPublic` queries
- [ ] T097 [US4] Create `convex/services.ts` `create`, `update`, `reorder`, `delete` mutations
- [ ] T098 [P] [US4] Create `src/components/ui/IconPicker/IconPicker.tsx` and `.module.css` with Material Icons selection
- [ ] T099 [P] [US4] Create `src/features/services/components/ServiceList/ServiceList.tsx` and `.module.css`
- [ ] T100 [P] [US4] Create `src/features/services/components/ServiceCard/ServiceCard.tsx` and `.module.css`
- [ ] T101 [US4] Create `src/features/services/components/ServiceForm/ServiceForm.tsx` with icon picker
- [ ] T102 [US4] Create `src/app/(dashboard)/admin/services/page.tsx` listing services
- [ ] T103 [US4] Create `src/app/(dashboard)/admin/services/new/page.tsx` create service
- [ ] T104 [US4] Create `src/app/(dashboard)/admin/services/[id]/edit/page.tsx` edit service

**Checkpoint**: Services management complete including icon selection.

---

## Phase 9: User Story 5 - Gestión de Clientes y Alianzas (Priority: P3)

**Goal**: CRUD for clients and alliances (similar structure)

**Independent Test**: Add client logo → visible in "Ya confían en nosotros". Add alliance → visible in "Nuestras Alianzas".

### Tests for US5

- [ ] T105 [P] [US5] E2E test: add client in `tests/e2e/playwright/clients.spec.ts`
- [ ] T106 [P] [US5] E2E test: add alliance in `tests/e2e/playwright/alliances.spec.ts`

### Implementation for US5

- [ ] T107 [US5] Create `convex/clients.ts` with `list`, `listPublic`, `create`, `update`, `reorder`, `delete`
- [ ] T108 [US5] Create `convex/alliances.ts` with `list`, `listPublic`, `create`, `update`, `reorder`, `delete`
- [ ] T109 [P] [US5] Create `src/features/clients/components/ClientList/ClientList.tsx` and `.module.css`
- [ ] T110 [P] [US5] Create `src/features/clients/components/ClientForm/ClientForm.tsx` with logo upload
- [ ] T111 [P] [US5] Create `src/features/alliances/components/AllianceList/AllianceList.tsx` and `.module.css`
- [ ] T112 [P] [US5] Create `src/features/alliances/components/AllianceForm/AllianceForm.tsx` with logo upload
- [ ] T113 [US5] Create `src/app/(dashboard)/admin/clients/page.tsx` listing clients
- [ ] T114 [US5] Create `src/app/(dashboard)/admin/clients/new/page.tsx` add client
- [ ] T115 [US5] Create `src/app/(dashboard)/admin/alliances/page.tsx` listing alliances
- [ ] T116 [US5] Create `src/app/(dashboard)/admin/alliances/new/page.tsx` add alliance

**Checkpoint**: Clients and alliances management complete.

---

## Phase 10: User Story 6 - Gestión de Newsletter (Priority: P3)

**Goal**: View, search, filter, and export newsletter subscribers

**Independent Test**: View subscriber list → shows all subscribers. Export → downloads CSV with active only.

### Tests for US6

- [ ] T117 [P] [US6] E2E test: view and search subscribers in `tests/e2e/playwright/newsletter.spec.ts`
- [ ] T118 [P] [US6] E2E test: export subscribers CSV in `tests/e2e/playwright/newsletter.spec.ts`

### Implementation for US6

- [ ] T119 [US6] Create `convex/newsletter.ts` with `list`, `export`, `subscribe`, `setActive` queries/mutations
- [ ] T120 [P] [US6] Create `src/features/newsletter/components/SubscriberList/SubscriberList.tsx` with search
- [ ] T121 [P] [US6] Create `src/features/newsletter/components/ExportButton/ExportButton.tsx` CSV download
- [ ] T122 [US6] Create `src/app/(dashboard)/admin/newsletter/page.tsx` subscribers management

**Checkpoint**: Newsletter management complete.

---

## Phase 11: Admin User Management (Priority: P1 - Super-admin only)

**Goal**: Super-admin can create, edit, delete other admin users

**Independent Test**: Login as super-admin → Users section visible. Create admin → can login. Regular admin → no Users section.

### Tests for Admin Users

- [ ] T123 [P] E2E test: super-admin can access users section in `tests/e2e/playwright/users.spec.ts`
- [ ] T124 [P] E2E test: regular admin cannot access users section in `tests/e2e/playwright/users.spec.ts`

### Implementation for Admin Users

- [ ] T125 Create `convex/adminUsers.ts` `list`, `create`, `update`, `delete` for user management
- [ ] T126 [P] Create `src/features/users/components/UserList/UserList.tsx` and `.module.css`
- [ ] T127 [P] Create `src/features/users/components/UserForm/UserForm.tsx` with role selection
- [ ] T128 Create `src/app/(dashboard)/admin/users/page.tsx` listing admin users (super-admin only)
- [ ] T129 Create `src/app/(dashboard)/admin/users/new/page.tsx` create admin user
- [ ] T130 Create `src/app/(dashboard)/admin/users/[id]/edit/page.tsx` edit admin user

**Checkpoint**: Admin user management complete for super-admin.

---

## Phase 12: Trash (Papelera) - Cross-cutting

**Goal**: View and restore soft-deleted items, permanent deletion after 30 days

**Independent Test**: Delete item → appears in trash. Restore → item restored. After 30 days → permanently deleted.

### Tests for Trash

- [ ] T131 [P] E2E test: deleted items appear in trash in `tests/e2e/playwright/trash.spec.ts`
- [ ] T132 [P] E2E test: restore item from trash in `tests/e2e/playwright/trash.spec.ts`

### Implementation for Trash

- [ ] T133 Create `convex/trash.ts` with `list`, `restore`, `permanentDelete` mutations/queries
- [ ] T134 Create `convex/crons.ts` with daily job to permanently delete items older than 30 days
- [ ] T135 [P] Create `src/features/trash/components/TrashList/TrashList.tsx` grouped by entity type
- [ ] T136 [P] Create `src/features/trash/components/TrashItem/TrashItem.tsx` with restore and delete actions
- [ ] T137 Create `src/app/(dashboard)/admin/trash/page.tsx` trash management

**Checkpoint**: Trash functionality complete with auto-cleanup.

---

## Phase 13: Public Pages (Optional - if building public site)

**Purpose**: Public-facing pages that display managed content

- [ ] T138 [P] Create `src/app/(public)/page.tsx` home page
- [ ] T139 [P] Create `src/app/(public)/blog/page.tsx` blog listing (published only)
- [ ] T140 [P] Create `src/app/(public)/blog/[slug]/page.tsx` blog post detail
- [ ] T141 [P] Create `src/app/(public)/projects/[slug]/page.tsx` project detail
- [ ] T142 Create `src/app/(public)/layout.tsx` public layout with navigation

---

## Phase 14: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T143 [P] Run `quickstart.md` validation - verify all setup steps work
- [ ] T144 [P] Add loading states with Skeleton to all list pages
- [ ] T145 [P] Add error boundaries to dashboard routes
- [ ] T146 [P] Implement optimistic updates for mutations
- [ ] T147 [P] Add confirmation dialogs before all delete operations
- [ ] T148 [P] Configure Playwright for CI/CD in `playwright.config.ts`
- [ ] T149 [P] Add `README.md` with project overview and development instructions
- [ ] T150 Code review all Convex mutations for proper auth checks
- [ ] T151 Security audit: validate all inputs, check for XSS in WYSIWYG output

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **US7 Auth (Phase 3)**: Depends on Foundational - Should be first user story (enables dashboard access)
- **Dashboard Home (Phase 4)**: Depends on US7 Auth
- **User Stories (Phase 5-12)**: All depend on Dashboard Home completion
  - P1 Stories (US1, US2, Admin Users) can proceed in parallel
  - P2 Stories (US3, US4) can proceed in parallel after P1
  - P3 Stories (US5, US6) can proceed in parallel after P2
  - Trash (Phase 12) depends on at least one CRUD feature complete
- **Public Pages (Phase 13)**: Optional, can run in parallel with dashboard features
- **Polish (Phase 14)**: Depends on all desired user stories being complete

### User Story Dependencies

| Story | Priority | Depends On | Can Start After |
|-------|----------|------------|-----------------|
| US7 - Auth | P1 | Foundational | Phase 2 complete |
| US1 - Blog | P1 | US7, US2 (for authors) | Phase 3 + T074 (team list for author selection) |
| US2 - Team | P1 | US7 | Phase 3 complete |
| US3 - Projects | P2 | US7 | Phase 3 complete |
| US4 - Services | P2 | US7 | Phase 3 complete |
| US5 - Clients/Alliances | P3 | US7 | Phase 3 complete |
| US6 - Newsletter | P3 | US7 | Phase 3 complete |
| Admin Users | P1 | US7 | Phase 3 complete |
| Trash | Cross | Any CRUD story | Phase 5 or 6 complete |

### Within Each User Story

1. Convex queries/mutations first (backend)
2. Feature components (frontend)
3. Page routes (integration)
4. Tests (validation)

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All UI components (T017-T029) can run in parallel
- All Convex entity files can be created in parallel within a phase
- E2E tests for different features can run in parallel

---

## Implementation Strategy

### MVP First (Auth + Blog + Team)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL)
3. Complete Phase 3: US7 Auth
4. Complete Phase 4: Dashboard Home
5. Complete Phase 6: US2 Team (needed for blog authors)
6. Complete Phase 5: US1 Blog
7. **STOP and VALIDATE**: Core content management working
8. Deploy MVP

### Incremental Delivery

1. MVP → Blog and Team management (value: content publishing)
2. Add US3 Projects, US4 Services → Full content management
3. Add US5 Clients/Alliances, US6 Newsletter → Complete dashboard
4. Add Trash → Recovery capability
5. Add Public Pages → Full site

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Tiptap WYSIWYG requires custom styling to match design system
- All delete operations are soft delete by default
- proxy.ts replaces middleware.ts in Next.js 16
