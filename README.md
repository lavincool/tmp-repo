# Viso Faces (Phase 1)

Face enrollment, management, and group recognition built with **Next.js 16.4.3**, **`@viso-lol/sdk@0.2.0`**, **HeroUI v3**, **Tailwind CSS v4**, and **Bun**.

## Overview

This application implements **Phase 1** of Viso Faces:

- **Enrollment**: Upload a single-face portrait with a name and explicit consent to index it into a persistent Viso face collection.
- **Listing & Deletion**: View registered people with initials and names, with cursor pagination and confirmation dialog for deletion.
- **Group Recognition**: Upload a photo containing one or more people and recognize registered individuals with SVG bounding boxes and similarity scores. Unknown faces and errors are clearly distinguished.
- **Zero Bucket Dependency**: Image bytes are processed in-memory and sent directly to Viso APIs. No image buckets or external databases are required.

## Stack

- **Framework**: Next.js 16.4.3 (App Router, Turbopack, strict TypeScript, React 19)
- **Styling**: Tailwind CSS v4 + HeroUI v3 compound components (`Button`, `TextField`, `Label`, `Input`, `FieldError`, `Checkbox`, `Spinner`, `AlertDialog`)
- **SDK**: `@viso-lol/sdk@0.2.0`
- **Image Processing**: `sharp` (server-side format, 2MP limit, 3 MiB payload, and pixel decoding validation)
- **Tooling**: Bun, Vitest, oxlint, oxfmt

## Project Structure

```text
src/app/page.tsx                     # Quiet introduction screen
src/app/people/page.tsx              # Registered people list screen
src/app/people/new/page.tsx          # Focused face enrollment form
src/app/recognize/page.tsx           # Photo upload and recognition workspace
src/app/api/people/route.ts          # GET (list) and POST (enroll)
src/app/api/people/[faceId]/route.ts  # DELETE (remove face from collection)
src/app/api/recognize/route.ts       # POST (face-only vision.analyze)
src/components/site-header.tsx       # Viso Faces navigation header
src/components/people-list.tsx       # Paginated list with HeroUI AlertDialog
src/components/face-registration.tsx # Registration form with client preview
src/components/recognition-workspace.tsx # Recognition view with desktop/mobile layout
src/components/face-overlay.tsx      # SVG bounding boxes and identity badges
src/lib/contracts.ts                 # Zod validation schemas and DTOs
src/lib/client/image.ts              # Browser image normalization (Canvas, 2MP, <= 3 MiB)
src/lib/server/viso.ts               # Lazy Viso client factory & config validation
src/lib/server/images.ts             # Server byte/dimension/pixel decoding with sharp
src/lib/server/faces.ts              # Core enrollment, list, delete, and recognition services
src/lib/server/faces.test.ts         # Vitest unit test suite with SDK mocks
```

## Available Scripts

| Script              | Command        | Purpose                  |
| ------------------- | -------------- | ------------------------ |
| `bun run dev`       | `next dev`     | Start development server |
| `bun run build`     | `next build`   | Create production build  |
| `bun run start`     | `next start`   | Start production server  |
| `bun run format`    | `oxfmt`        | Format code with oxfmt   |
| `bun run lint`      | `oxlint`       | Lint code with oxlint    |
| `bun run typecheck` | `tsc --noEmit` | Strict TypeScript check  |
| `bun run test`      | `vitest run`   | Run Vitest unit tests    |

## Configuration

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Set the following variables:

```dotenv
VISO_API_KEY=viso_sk_...
VISO_COLLECTION_ID=col_...
VISO_BASE_URL=https://api.viso.lol/v1
```

### Required API Scopes

The API key needs:

- **`face:read`**: Required for listing faces and face-only `vision.analyze`.
- **`face:write`**: Required for indexing and deleting faces.
- _Note_: Face recognition does not require `vision:read`, object permissions, AWS credentials, Gemini keys, or image bucket access.

### Vercel Deployment Setup

1. Add `VISO_API_KEY`, `VISO_COLLECTION_ID`, and optional `VISO_BASE_URL` in **Project Settings > Environment Variables** on Vercel.
2. The application handles requests through Node.js Route Handlers (`runtime = "nodejs"`), keeping credentials strictly server-side.
3. No remote buckets, databases, or cloud storage buckets are needed.

## Testing & Verification

Unit tests use isolated mocks and do not make live network calls or consume API quotas:

```bash
bun run test
```

### Manual Acceptance Flow (Live Provider Validation)

To verify the live integration against your active Viso project:

1. **Configure Environment**:
   - Ensure `VISO_API_KEY` has `face:read` and `face:write` scopes enabled in the dashboard.
   - Ensure `VISO_COLLECTION_ID` points to an active collection in your project.
2. **Register First Portrait**:
   - Navigate to `/people/new`.
   - Enter a name (e.g. "Ada Lovelace").
   - Upload a clear portrait photo containing exactly one face (JPEG or PNG).
   - Check the consent checkbox.
   - Click **Registrar rostro**. Verify navigation to `/people` upon completion.
3. **Register Second Portrait**:
   - Register a second person (e.g. "Grace Hopper") with their single-face portrait.
4. **Reload Registered List**:
   - Refresh `/people`.
   - Verify that both names persist with their corresponding initials.
5. **Recognize Faces in a Group Photo**:
   - Navigate to `/recognize`.
   - Upload a photograph containing one or both of the registered individuals.
   - Click **Reconocer rostros**.
   - Verify that bounding boxes appear in the correct positions on the photograph, matching the query image dimensions.
   - Verify that selecting a box or result card highlights both with a blue outline.
   - Verify that similarity scores are displayed (e.g., `Similitud: 94.5%`).
6. **Test an Unknown Face**:
   - Upload a photo containing an unregistered person.
   - Verify that the face is labeled `Sin coincidencia` without failing.
7. **Delete a Registration**:
   - On `/people`, click **Eliminar** next to one of the registered persons.
   - Verify that the HeroUI confirmation dialog opens naming the person.
   - Confirm deletion and verify that the entry is removed from the list.
# tmp-repo
