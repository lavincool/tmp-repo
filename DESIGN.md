# Viso Faces — Phase 1 design

This is the design for a **new application built from scratch**. Implement only face enrollment and recognition. This document and the accompanying prompt supersede every earlier specification for the demo.

Use Next.js 16.4, HeroUI v3, and Tailwind CSS v4. Documentation and code are in English; visible interface copy is in Spanish.

## Scope

There are two primary tasks:

1. Register a person using a name, one uploaded portrait, and explicit consent.
2. Upload a photograph and recognize its faces against the registered collection.

Include a small list of registered names with a delete action so users can inspect and remove their registrations. Display initials rather than stored portraits. Photographs are temporary inputs; the app does not retain their bytes or require an image bucket.

Object detection, visual prompts, person–object filtering, camera capture, live video, authentication, stored portraits, dashboards, and analysis history are outside Phase 1. Do not add routes, disabled controls, settings, or placeholders for them. Any second phase requires a separate explicit authorization from the owner.

## Routes and composition

| Route         | Screen                           | Primary action                     |
| ------------- | -------------------------------- | ---------------------------------- |
| `/`           | Quiet introduction               | `Reconocer rostros` → `/recognize` |
| `/people`     | Registered names                 | `Registrar rostro` → `/people/new` |
| `/people/new` | Focused registration form        | `Registrar rostro` submits         |
| `/recognize`  | Upload, recognition, and results | `Reconocer rostros` submits        |

Use real Next.js links and browser history. A shared header contains the text wordmark **Viso Faces** linking home, plus `Personas` and `Reconocer`. Keep this short navigation visible on mobile. No sidebar or hamburger is needed.

Each page handles one task. Registration and recognition forms never share a screen. Results appear on the recognition route after a successful request; there is no additional results route.

## Visual system

Aim for an Apple-inspired light interface: whitespace, clear type, quiet surfaces, and one blue action. Content should feel intentionally placed rather than enclosed in a dashboard of cards.

| Role           | Value     |
| -------------- | --------- |
| Canvas         | `#FBFBFD` |
| Surface        | `#FFFFFF` |
| Subtle surface | `#F5F5F7` |
| Main text      | `#1D1D1F` |
| Secondary text | `#6E6E73` |
| Divider        | `#E5E5EA` |
| Border         | `#D2D2D7` |
| Accent         | `#0071E3` |
| Accent hover   | `#0066CC` |
| Destructive    | `#B42318` |

Typography: `-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`. Use the system font; no external font download is needed.

- Home heading: 56px desktop / 36px mobile, weight 600, line-height 1.1.
- Page headings: 32px desktop / 28px mobile, weight 600.
- Body and inputs: 16px; labels and secondary copy: 14px.
- Use a 4px spacing grid, 24px between form groups, and 48px between major sections.
- Header: 64px tall. Page gutters: 32px desktop / 20px mobile.
- Content width: 960px; registration width: 480px. Leave 48px below the header before the page heading.
- Buttons: minimum 44px height, approximately 20px horizontal padding; primary buttons may be pill-shaped.
- Inputs: 10px radius. Image frame: 16px. Confirmation dialog: 20px.
- Favor whitespace and thin separators. Reserve a subtle shadow for floating dialogs.

One primary action per screen. Secondary actions are neutral links or ghost buttons. Avoid decorative gradients, saturated backgrounds, charts, large counters, repeated badges, nested cards, and ornamental animation.

## HeroUI usage

Use actual HeroUI v3 controls: `Button`, `TextField` with `Label`/`Input`/`FieldError`, `Checkbox`, `Spinner`, and `AlertDialog`. The only modal in Phase 1 is delete confirmation. Ordinary navigation and forms use dedicated routes.

Load styles in this order:

```css
@import "tailwindcss";
@import "@heroui/styles";

html[data-theme="light"] {
  color-scheme: light;
  --background: #fbfbfd;
  --foreground: #1d1d1f;
  --surface: #ffffff;
  --surface-secondary: #f5f5f7;
  --muted: #6e6e73;
  --accent: #0071e3;
  --accent-foreground: #ffffff;
  --border: #d2d2d7;
  --danger: #b42318;
}
```

Set `<html lang="es" className="light" data-theme="light">`. HeroUI v3 does not need `HeroUIProvider`. Use its current compound components and keep styling centralized. Follow the [HeroUI quick start](https://heroui.com/en/docs/react/getting-started/quick-start), [Next.js integration](https://heroui.com/en/docs/react/getting-started/frameworks), and [theming reference](https://heroui.com/en/docs/react/getting-started/theming) only when a specific API detail is unresolved.

## Screen details

### Home

Show only the shared header, a generous introduction, and two actions:

- Heading: `Caras conocidas. Sin complicaciones.`
- Description: `Registra un rostro y encuéntralo en otra fotografía.`
- Primary: `Reconocer rostros`.
- Secondary: `Registrar un rostro` → `/people/new`.

Do not add a gallery, upload form, settings panel, or feature cards to this screen.

### Registered people

Title: `Personas`. Place `Registrar rostro` beside the heading. Below it, show a simple divided list: initials in a small neutral circle, the registered name, and a quiet `Eliminar` action.

Keep IDs, timestamps, and provider details out of the default view. Use `Cargar más` for cursor pagination. No search, sorting, image grid, or profile editor is needed. The empty state says `Todavía no hay rostros registrados.` and offers registration.

Deleting opens a small AlertDialog naming the person, with `Cancelar` and `Eliminar`. Keep the entry visible if deletion fails. Preserve focus and communicate the outcome.

### Registration

Title: `Registra un rostro`. A centered form contains:

1. Name field labeled `Nombre`.
2. One portrait upload area with `Elegir foto`; replace it with the image preview after selection.
3. An unchecked consent checkbox: `Acepto registrar este rostro para reconocerlo en esta demo. El nombre aparecerá en la lista compartida.`
4. One `Registrar rostro` button.

Allow `Cambiar foto` as a quiet action. State briefly that the image must contain exactly one face. Preserve the name and preview on validation errors. Show pending text during submission, prevent duplicate clicks, and navigate to `/people` after success. No camera, multi-step wizard, crop editor, or registration modal.

### Recognition

Title: `Reconoce los rostros de tu foto`. Initially show only an upload area, a short note that recognition searches the registered collection, and the primary action once a photo is ready.

After recognition, show the photograph as the main content and a compact results list. Desktop: image plus a 260–300px results column with a 32px gap. Mobile: image first, results below. The only utility action needed is `Cambiar foto`.

Each detected face has an image box and a corresponding result row. Selecting either highlights both. Show the registered name and `Similitud: …` for matches. Label unknown faces `Sin coincidencia`; label failures `No se pudo evaluar`. A provider error is not an unknown person, and similarity is not an identity probability.

Use blue for selected boxes and a quiet neutral style for other boxes. Keep labels readable against the photograph. Preserve the correct image aspect ratio and normalized query coordinates.

No filters, prompts, mode selectors, threshold sliders, overlay settings, export buttons, or debug panels. The recognition threshold is fixed in the implementation.

## Interaction and quality

- A request starts only after pressing the relevant submit button. Changing a photo or selecting a result never triggers inference.
- Changing the recognition photo clears previous results. Discard late responses from an older photo.
- Keep successful face results when some searches fail. Communicate partial results in one concise message.
- Show inline field errors and accessible request status. Never invent progress percentages or sample recognition results.
- Stop temporary image resources and revoke object URLs when replaced or unmounted.
- Use visible keyboard focus, labels, sufficient contrast, and 44px touch targets. No horizontal overflow at 390px width.
- Use brief 120–160ms transitions and respect reduced motion.
- Missing configuration should produce a clear setup-required message, not a fake successful state or a broken page.

## Completion criteria

The product is complete for Phase 1 when someone can register an authorized portrait, see its name persist after a reload, recognize it in another image, distinguish unknown faces and errors, and delete the registration. All four routes must work on desktop and mobile. Verify the existing checks and visually review the result where browser tooling is available.

Stop after Phase 1. Other features require a new explicit approval.
