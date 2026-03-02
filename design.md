# Smart Planner - Design Documentation

## Design Philosophy

The Smart Planner uses a **glassmorphism** aesthetic with a deep, atmospheric background. The design reflects the app's purpose—a sophisticated tool for neuroengineering career transition—while maintaining clarity and usability.

## Visual Identity

### Color System

| Role | Color | Usage |
|------|-------|-------|
| Deep Background | `#0a0e17` | Page base, atmospheric layers |
| Surface | `#12182b` | Cards, elevated elements |
| Elevated | `#1a2238` | Input fields, list items |
| Glass | `rgba(26, 34, 56, 0.7)` | Translucent panels |

### Category Colors (Neuroengineering Workflow)

| Category | Color | Hex |
|----------|-------|-----|
| Explore | Violet | `#7c5cff` |
| Learn | Blue | `#3b82f6` |
| Build | Emerald | `#10b981` |
| Integrate | Amber | `#f59e0b` |
| Reflect | Pink | `#ec4899` |
| Office Hours | Indigo | `#6366f1` |
| Other | Slate | `#64748b` |

### Typography

- **Primary Font**: Inter (system fallback: -apple-system, Segoe UI)
- **Monospace**: JetBrains Mono (for time displays)
- **Scale**: 16px base, fluid responsive sizing

## Component Library

### Glass Cards
- Backdrop blur: 16px
- Border: 1px solid rgba(255, 255, 255, 0.08)
- Shadow: 0 8px 32px rgba(0, 0, 0, 0.4)
- Hover: translateY(-2px) with enhanced shadow

### Buttons
- **Primary**: Gradient (violet → blue) with glow shadow
- **Secondary**: Elevated background with glass border
- **Ghost**: Transparent with hover background
- Border radius: 12px
- Transition: 150ms ease

### Form Inputs
- Background: Elevated surface
- Border: 1px solid glass border
- Focus: Violet glow (3px rgba ring)
- Border radius: 12px

### Pills & Badges
- Category pills: Colored background (20% opacity) + solid text
- Priority badges: High (red), Medium (amber), Low (green)
- Border radius: Full (pill shape)

## Layout

### Grid Structure
```
┌─────────────────────────────────────────┐
│              HEADER                     │
├─────────────┬───────────────────────────┤
│             │                           │
│  SIDEBAR    │      MAIN CONTENT        │
│  (340px)    │      (flexible)           │
│             │                           │
│  - Tasks    │  - Schedule Grid         │
│  - Missions │  - AI Panel              │
│  - Allot.   │                           │
│             │                           │
└─────────────┴───────────────────────────┘
```

### Responsive Breakpoints
- **Desktop**: > 1024px (full grid)
- **Tablet**: 768px - 1024px (stacked sidebar)
- **Mobile**: < 768px (single column)

## Animations

### Ambient
- Background breathe: 20s infinite scale/rotate

### Interactive
- Card hover: 250ms translateY
- Button press: 150ms scale
- Modal entrance: 400ms fade + scale
- Staggered list items: 50ms delays

### AI Panel
- Pulsing orb indicator (2s cycle)

## Accessibility

- Minimum contrast ratio: 4.5:1 for text
- Focus indicators: violet rings
- Keyboard-navigable modals
- Screen reader friendly labels
- Reduced motion support via media query

## Usage Notes

This CSS assumes:
- Vanilla HTML structure (no framework)
- Semantic HTML5 elements
- JavaScript will toggle `.active`, `.checked`, `.hidden` classes
- Modal uses `.modal-overlay.active` for visibility
