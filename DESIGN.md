# Events Design System

This is the visual system extracted from the verified Events UI. It is intentionally compact, bright, and editorial rather than promotional.

## Product Signal

Events should feel like a living city guide: clear enough to scan quickly, warm enough to make a plan feel inviting, and direct enough that the next action is never ambiguous.

## Color Tokens

| Token | Value | Use |
| --- | --- | --- |
| `background` | `#f6f8fb` | Cool-white page canvas |
| `foreground` | `#122033` | Ink text and dark how-it-works band |
| `primary` | `#2758f2` | Primary actions, links, focus rings |
| `accent` | `#ff754f` | Editorial signal, selected state, category emphasis |
| `secondary` | `#e8f6e8` | Leaf-green supporting status |
| `muted` | `#edf1f6` | Quiet surfaces and control backgrounds |
| `muted-foreground` | `#607086` | Supporting copy and metadata |
| `border` | `#dbe3ee` | Dividers, card edges, input boundaries |
| `destructive` | `#c93c4a` | Inline validation errors |

## Type

- Display: `Space Grotesk`, with `Trebuchet MS` fallback.
- Interface: `Plus Jakarta Sans`, with `Segoe UI` fallback.
- Display headings use a compact negative tracking value and tight line height. Body text uses generous line height for scanning.
- Type size is responsive through layout constraints, not viewport-scaled text.

## Geometry

- Primary radius: `8px`.
- Event cards use `9px` to preserve a slightly softer frame around photography.
- Buttons and inputs use `6px` to `7px` radii.
- Page sections are full-width bands with constrained inner shells. Cards are reserved for repeated event items, dialogs, and the drawer.
- Media uses stable aspect ratios so loading states and event switching do not resize the layout.
- The featured-event panel gives the rotated media stack a generous white frame and clips accidental bleed at the rounded boundary.
- Wheel pickers use a fixed compact height and centered selection band so changing values cannot resize the create form.

## Components

### `EventMedia`

Owns stable image sizing, alt text, and local or object URL sources.

### `EventMeta`

Renders date, time, venue, city, and optional price as a consistent icon-led list.

### `EventBadge`

Renders category labels using default, primary, or accent tones.

### `EventActions`

Keeps the primary card action consistent and uses an icon plus a short command label.

### `AnimatedEventHero`

An adapter over Aceternity `AnimatedTestimonials`. It maps `Event` data to the existing content contract and adds controlled active state, autoplay, pause-on-hover/focus, arrow-key navigation, indicators, metadata, and reduced-motion support.

### `ExpandableEventCard`

An event version of the Aceternity standard expandable card pattern. The full card surface is a keyboard-accessible detail trigger, while the actual content lives in one shared dialog with outside-click, Escape, focusable close controls, a soft blurred backdrop, and mobile-safe sizing.

### `HowItWorksCarousel`

Uses the Aceternity Apple cards carousel track with three static local step cards. The track is horizontally scrollable and its controls remeasure after responsive layout and image loading; cards never open a second view.

### `LoginPage`

Provides the `/login` destination for reservation intent until authentication is connected. It keeps the return path obvious and reports that login is demo-only when the placeholder form is submitted.

### `CreateEventDrawer`

Uses shadcn Sheet primitives and the shared `CreateEventForm`. The form owns draft state, field validation, preview URL lifecycle, replacement, removal, and publish handoff in both the inline create surface and the drawer.

### `CreateEventForm`

Keeps the inline and drawer versions identical. Category and price share a
compact basics row, while date and time share a timing row on wider surfaces;
both groups collapse to one column on mobile and narrow drawer widths.

### `WheelColumn`

Provides the compact iOS-inspired vertical picker primitive. Its selected row sits inside a quiet center band, adjacent values fade into the background, and the column supports snap scrolling plus Arrow, Home, and End keyboard movement.

### `ScrollableDatePicker` and `ScrollableTimePicker`

Compose three linked wheel columns for dates (`weekday`, `day`, `month`) and times (`hour`, `minute`, `AM/PM`). The month column is deduplicated to one option per available month and maps back to the nearest valid date while preserving the selected day when possible. They format directly into the existing event draft strings without adding manual text inputs or changing the publish contract.

## Motion

- Hero transitions use short opacity, scale, and position changes.
- Event cards lift by `4px` on hover.
- Drawer and detail dialogs use short, reversible entrances.
- Autoplay pauses on hover and focus.
- `prefers-reduced-motion: reduce` removes autoplay and compresses animated transitions.
- Wheel movement uses native scroll snapping and compact transitions so it remains usable with reduced motion enabled.

## Accessibility

- Semantic headings and section landmarks are used throughout the route.
- Controls have visible focus rings, accessible labels, and familiar icons.
- Hero arrows and indicators support keyboard navigation.
- Detail dialogs support Escape, outside click, and a focusable close button.
- Browse event cards open from their full surface and expose a keyboard activation path.
- Reserve event routes to the login destination without pretending to complete authentication.
- The create form keeps validation inline and the upload surface supports keyboard activation through the dropzone control.
- Date and time wheels expose listbox options with selected state and keyboard movement; no manual date or time text fields are required.
- Mobile layouts keep the page and dialog within the viewport width; horizontal overflow is limited to the intentionally scrollable Apple card track.

## Imagery

The five local PNGs in `public/events` are deterministic demo assets generated for this slice. They are intentionally free of embedded text and logos so they can be replaced with real event photography without changing component contracts.
