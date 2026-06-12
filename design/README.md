# Docketly Design System

The single reference for how the dashboard looks and why. The system has four
layers, lowest to highest; each layer only consumes the ones below it.

```
1. Theme        app/globals.css           CSS variables (oklch), radius, dark variant
2. Primitives   components/ui/*           shadcn/ui components, styled by the theme
3. Tokens       design/tokens.ts          semantic recipes: tones, status mapping, typography
4. Patterns     design/patterns/*         reusable compositions: PageHeader, EmptyState, Field, GateBadge
                components/*              app composites: StatusBadge, SidebarNav, forms
```

Pages under `app/(dashboard)/` compose layers 2–4 and add layout only. If a
page needs a raw palette class (`bg-amber-100`…), that's a signal the token
layer is missing something — add it there instead.

---

## 1. Theme (`app/globals.css`)

Tailwind v4 with the shadcn "new-york" style, **neutral** base color, CSS
variables in oklch. Key values:

| Variable | Light | Meaning |
|---|---|---|
| `--background` / `--foreground` | white / near-black | page canvas |
| `--muted` / `--muted-foreground` | neutral-50-ish / mid-gray | quiet surfaces, secondary text |
| `--primary` | near-black | the one strong action per view |
| `--destructive` | red (oklch 0.577 0.245 27) | errors and dangerous actions |
| `--border` / `--input` / `--ring` | light neutrals | hairlines, fields, focus |
| `--sidebar-*` | near-white set | the nav rail |
| `--radius` | 0.625rem | global corner radius (sm/md/lg/xl derive from it) |

Dark mode: a full `.dark` variable set exists and primitives honor it, but
**no toggle is shipped** — the dashboard currently renders light-only. Adding
a toggle is a theme-layer change; no component would need editing.

Fonts: system stack (no webfont). Icons: `lucide-react`, almost always
`h-4 w-4`.

## 2. Primitives (`components/ui/`)

Generated via shadcn CLI — treat as vendored, edit rarely:

`badge` `button` `card` `dialog` `input` `label` `select` `switch` `table`
`tabs` `textarea`

Add new ones with `npx shadcn@latest add <name>` (config in
`components.json`: RSC on, alias `@/components/ui`, neutral palette, CSS
variables). Note: `tabs` is installed but the Notices filter intentionally
uses **links styled as tabs** instead, so filter state lives in the URL and
works in server components.

## 3. Tokens (`design/tokens.ts`)

### Tones — the five semantic colors

| Tone | Classes | Means |
|---|---|---|
| `info` | blue 100/800 | in flight, give it a moment |
| `success` | green 100/800 | done, handled |
| `warning` | amber 100/800 | needs a human |
| `danger` | red 100/800 | went wrong |
| `neutral` | neutral 100/600 | intentionally skipped |

### Status → tone (`STATUS_TONE`)

Notice statuses and automation-run statuses share one badge language:

| Status | Tone | | Status | Tone |
|---|---|---|---|---|
| `classifying` | info | | `pending` | info |
| `classified` | success | | `sent` | success |
| `needs_review` | warning | | `skipped` | neutral |
| `failed` | danger | | | |

`STATUS_LABEL` holds display overrides (`needs_review` → "needs review").
Render statuses **only** through `<StatusBadge>` (`components/status-badge.tsx`),
which consumes these maps — never hand-roll a status color.

### Typography recipes (`TEXT`)

| Recipe | Use |
|---|---|
| `pageTitle` | the h1 on every dashboard page |
| `pageSubtitle` | the one-liner under it |
| `fieldLabel` | uppercase micro-label over read-only values |
| `identifier` | case numbers, run ids — always mono |
| `reasoning` | the AI's sentence — always italic muted |
| `sourceText` | raw notice text — mono on muted, pre-wrapped |

## 4. Patterns (`design/patterns/`)

| Pattern | Used for |
|---|---|
| `PageHeader` | title + subtitle + optional action slot, on all five pages |
| `EmptyState` | the dashed teaching box (PRD §8: "empty states teach") |
| `Field` | labeled read-only value in the classification panel |
| `GateBadge` | a "held because" reason — always warning tone, because a failed gate is a request for judgment, not an error |

App-level composites in `components/`: `StatusBadge` (the only status
renderer), `SidebarNav` (client; the Review count chip), `AutomationForm`
(the token-reference + live-preview editor), `ReviewForm`, `UploadButton`,
`AutomationToggle`.

---

## Rules of thumb

1. **Meaning flows through tones.** New state to display? Map it to one of
   the five tones in `tokens.ts`; don't introduce a sixth color casually.
2. **Status rendering has one door**: `<StatusBadge status={...}>`.
3. **Every list page ships its empty state**, written to teach the next
   action, via `<EmptyState>`.
4. **Tables are the default surface** for collections; cards for the
   side-by-side document/classification split; dialogs sparingly (currently
   unused — full pages over modals for anything with a URL worth sharing).
5. **Server components by default**; a component goes `"use client"` only
   for state or browser APIs (forms, toggles, uploads, nav highlighting).
6. **Clickable table rows** use the in-cell `<Link>` + absolute-overlay span
   idiom (see `notices/page.tsx`) so the whole row is a target without
   nesting interactive elements.
