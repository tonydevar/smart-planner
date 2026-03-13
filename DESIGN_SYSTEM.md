# Smart Planner — Design System

This document defines all design tokens, component rules, and principles for the Smart Planner UI.

## Design Philosophy

**Flat, Clean, Fast.**

The UI uses a flat design system — no glassmorphism, no backdrop-filter blur, no box-shadows. Every element is defined by borders and background colour, not depth effects. The result is a faster rendering page that works well on lower-end devices and is fully accessible.

---

## Design Tokens

All tokens are CSS custom properties defined in `frontend/src/index.css`.

### Colour Tokens

| Token              | Value       | Usage                                       |
|--------------------|-------------|---------------------------------------------|
| `--bg`             | `#FFFFFF`   | Page background, modal backgrounds          |
| `--fg`             | `#111827`   | (alias for text-primary — body copy)        |
| `--primary`        | `#3B82F6`   | Primary action buttons, focus borders       |
| `--primary-hover`  | `#2563EB`   | Primary button hover state                  |
| `--secondary`      | `#10B981`   | Secondary actions, success indicators       |
| `--accent`         | `#F59E0B`   | Highlights, overflow badges, amber accent   |
| `--muted`          | `#F3F4F6`   | Form input backgrounds, section backgrounds |
| `--muted-hover`    | `#E5E7EB`   | Muted element hover                         |
| `--border`         | `#E5E7EB`   | All borders (cards, inputs, dividers)       |
| `--danger`         | `#EF4444`   | Destructive actions, error states           |
| `--text-primary`   | `#111827`   | Primary body text                           |
| `--text-secondary` | `#6B7280`   | Secondary/supporting text                   |
| `--text-muted`     | `#9CA3AF`   | Placeholder text, labels, meta info         |

### Category Colours (retained from original)

| Token                  | Value      |
|------------------------|------------|
| `--cat-explore`        | `#7c5cff`  |
| `--cat-learn`          | `#3b82f6`  |
| `--cat-build`          | `#10b981`  |
| `--cat-integrate`      | `#f59e0b`  |
| `--cat-reflect`        | `#ec4899`  |
| `--cat-office-hours`   | `#6366f1`  |
| `--cat-break`          | `#6b7280`  |
| `--cat-other`          | `#64748b`  |

### Priority Colours (retained from original)

| Token        | Value      |
|--------------|------------|
| `--pri-high` | `#ef4444`  |
| `--pri-medium`| `#f59e0b` |
| `--pri-low`  | `#22c55e`  |

### Spacing & Shape

| Token         | Value  | Usage                             |
|---------------|--------|-----------------------------------|
| `--radius-sm` | `6px`  | Buttons (sm), inputs, badges      |
| `--radius`    | `8px`  | Standard buttons, dropdowns       |
| `--radius-lg` | `12px` | Cards, modals                     |
| `--transition`| `200ms ease` | All interactive transitions |

---

## Global Rules

```css
/* No box-shadow anywhere */
*, *::before, *::after {
  box-shadow: none !important;
}
```

- **No `backdrop-filter`** — removed from all components
- **No `box-shadow`** — enforced globally via `!important`
- **No gradients on buttons** — flat solid colours only
- **Font**: `Outfit` (Google Fonts) — weights 400/500/600/700/800

---

## Components

### Card (`.glass-card`)

Replaces the old glassmorphism card:

```css
.glass-card {
  background: var(--bg);           /* white */
  border: 1px solid var(--border); /* #E5E7EB */
  border-radius: var(--radius-lg); /* 12px */
}
```

### Buttons

All buttons use flat solid colours and `scale()` hover transform (no shadows, no gradients).

| Class            | Background           | Hover                         |
|------------------|----------------------|-------------------------------|
| `.btn-primary`   | `var(--primary)` blue| `var(--primary-hover)` + scale(1.02) |
| `.btn-secondary` | `var(--muted)` gray  | `var(--muted-hover)` + scale(1.02) |
| `.btn-ghost`     | transparent          | `var(--muted)` bg + scale(1.03) |
| `.btn-danger`    | `var(--danger)` red  | `#DC2626` + scale(1.02) |

Size modifiers: `.btn-sm` (padding 4px 10px), `.btn-icon` (6px square).

### Form Controls (`.form-control`)

```css
.form-control {
  background: var(--muted);          /* gray-100 resting */
  border: 1px solid transparent;
}
.form-control:focus {
  background: #fff;                  /* white on focus */
  border: 2px solid var(--primary);  /* blue-500 focus ring */
}
```

### Modal

```css
.modal-overlay {
  background: rgba(17, 24, 39, 0.4); /* no blur */
}
.modal-box {
  background: #fff;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);   /* no shadow */
}
```

### Tags (`.cat-pill`, `.pri-badge`)

**Exempt from flat-radius rule** — retain `border-radius: 999px` for pill shape.
Use colour-coded backgrounds from `--cat-*` / `--pri-*` tokens.

### Spinner (`.spinner`)

```css
.spinner {
  border: 2px solid var(--border);
  border-top-color: var(--primary);  /* blue-500 */
}
```

---

## Icon Library

**lucide-react** is installed (`package.json`) for use in future components.
No JSX icon replacements are made in this feature — existing emoji/text icons remain.
Import icons as needed: `import { ChevronDown } from 'lucide-react'`.

---

## Typography

| Weight | Token name   | Usage                     |
|--------|--------------|---------------------------|
| 400    | Regular      | Body text                 |
| 500    | Medium       | Labels, secondary headings|
| 600    | SemiBold     | Section headings          |
| 700    | Bold         | Card titles, modal titles |
| 800    | ExtraBold    | Page-level headings       |

Font stack: `'Outfit', -apple-system, 'Segoe UI', sans-serif`

---

## What NOT to Do

- ❌ No `box-shadow` (globally suppressed)
- ❌ No `backdrop-filter` / `blur()`
- ❌ No gradient backgrounds on interactive elements
- ❌ No `translateY(-1px)` hover trick — use `scale()` instead
- ❌ No dark-mode glassmorphism variables (`--bg-deep`, `--bg-glass`, etc.)
- ✅ Use `--border` for all dividers and card outlines
- ✅ Use `var(--muted)` for subtle backgrounds
- ✅ Use `scale(1.02-1.03)` for button hover feedback
