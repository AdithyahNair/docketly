# Docketly Design System

The single reference for how the dashboard looks and why. The current look is
the **Docketly Redesign**: a warm Notion/Attio-style light theme from the
Claude Design handoff (chat brief: "Series-A polish, soft, warm, friendly").

The system has four layers, lowest to highest; each layer only consumes the
ones below it.

```
1. Theme        app/globals.css           CSS variables (warm hex palette), radius, font
2. Primitives   components/ui/*           shadcn/ui components, styled by the theme
3. Tokens       design/tokens.ts          semantic recipes: tones, status mapping, typography
4. Patterns     design/patterns/*         PageHeader, EmptyState, Field, GateBadge, Confidence, Callout
                components/*              app composites: StatusBadge, SidebarNav, forms
```

Pages under `app/(dashboard)/` compose layers 2–4 and add layout only. If a
page needs a raw palette class, that's a signal the token layer is missing
something — add it there instead.

---

## 1. Theme (`app/globals.css`)

Tailwind v4, light-only (a class-based dark variant exists but no dark
palette is defined — that's intentional, per the design brief). Typeface:
**Instrument Sans** via `next/font`, 14px base. Radius: 10px.

### Ink scale (warm grays)

| Variable | Value | Use |
|---|---|---|
| `--ink` (= `--foreground`) | `#33312D` | primary text, primary buttons |
| `--ink-2` | `#74726C` | secondary text, table headers |
| `--ink-3` | `#A8A59E` | placeholders, icons at rest |

### Surfaces & lines

| Variable | Value | Use |
|---|---|---|
| `--background` | `#FFFFFF` | page + cards |
| `--sidebar` | `#F7F6F3` | the nav rail, callout blocks |
| `--muted` | `#F2F1ED` | hover fills |
| `--accent` | `#ECEAE4` | active/selected fills |
| `--raised` | `#FBFAF8` | table headers, row hover, source blocks |
| `--border` | `#E8E6E1` | card borders, hairlines |
| `--input` | `#DCDAD3` | form-control borders (stronger) |
| `--row-line` | `#F1F0EC` | between table rows (quieter) |

### The accent

`--brand: #2383E2` (Notion blue). Used for: focus rings (`--ring`), switch
on-state, token keys in the reference panel, selected role chips, text
selection. **Not** used for primary buttons — those are `--ink` (charcoal),
per the design.

### Status colors (soft pills)

| | bg | ink |
|---|---|---|
| green | `#DEECDF` | `#2B5C3C` |
| amber | `#FAEEDB` | `#8A5A22` |
| red | `#FAE3E3` | `#A13E3E` |
| blue | `#E2EEF9` | `#2B5E8E` |

## 2. Primitives (`components/ui/`)

shadcn "new-york", themed by the variables above. Two carry deliberate local
edits: `table.tsx` (raised header band, 13.5px cells, `row-line` hairlines,
`raised` hover) and `switch.tsx` (checked state is `brand`, not primary).
The rest are stock. Add new ones with `npx shadcn@latest add <name>`.

## 3. Tokens (`design/tokens.ts`)

- `TONES` — the five semantic colors as soft pills: `info` (blue, in
  flight), `success` (green, done), `warning` (amber, needs a human),
  `danger` (red, went wrong), `neutral` (muted, intentionally skipped).
- `STATUS_TONE` / `STATUS_LABEL` — notice + run statuses → tone and
  sentence-case display label. Render statuses **only** through
  `<StatusBadge>` (`components/status-badge.tsx`): a rounded-full pill with
  a leading dot.
- `TEXT` — typography recipes with the design's exact px values:
  `pageTitle` (22px/650/-0.012em), `pageSubtitle`, `fieldLabel` (13px/550),
  `fieldHint`, `identifier` (mono 12.5px tabular), `cardTitle`, `cardSub`,
  `sourceText` (mono on raised).

## 4. Patterns (`design/patterns/`)

| Pattern | Used for |
|---|---|
| `PageHeader` | title + subtitle/chips + action slot, on every page |
| `EmptyState` | teaching empty box: icon circle, bold title, quiet line — always inside a Card |
| `Field` | labeled read-only value (notice detail) |
| `GateBadge` | "held because" reason — amber, **squared** corners (status pills are round) |
| `Confidence` | 44×4 mini-bar + % + note; amber fill below the 0.8 gate |
| `Callout` | AI-authored text (reasoning, eval notes): ivory block + sparkle |

App composites in `components/`: `StatusBadge`, `SidebarNav` (workspace
rail items + amber review count), `AutomationForm` (two-column editor with
token reference + live preview), `ReviewForm` (owns the review page: actions
live in its header), `UploadButton`, `AutomationToggle`.

---

## Rules of thumb

1. **Meaning flows through tones**; don't introduce a sixth color casually.
2. **Status rendering has one door**: `<StatusBadge>`. Reasons are
   `<GateBadge>`, never status pills.
3. **Primary buttons are charcoal, the accent is blue.** One dark button per
   view; secondary actions are outline.
4. **Tables live inside `<Card className="overflow-hidden p-0 …">`** so the
   raised header band meets the card edge.
5. **Every list page ships its teaching `<EmptyState>`.**
6. **Case numbers and ids are always `TEXT.identifier`** (mono, tabular).
7. **Server components by default**; `"use client"` only for state or
   browser APIs.
8. **Clickable table rows** use the in-cell `<Link>` + absolute-overlay span
   idiom (see `notices/page.tsx`).
9. The sidebar's ⌘K search is a **visual affordance only** (per the design
   prototype); wire it to a real command palette before making it prominent
   in demos.
