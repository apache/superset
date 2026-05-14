# SIP: Granular (Component-Level) Theming for Dashboard Components

**Status:** Draft — living doc, kept in lockstep with the work on `feat/granular-theming-v2`.
**Champion:** @rusackas
**Supersedes:** Closed PR [#36749](https://github.com/apache/superset/pull/36749) (became unrebasable after the .jsx → .tsx conversion, React 18 upgrade, and theme-controller churn since 2025-12).

## Motivation

Superset already supports themes at two levels:
- **Instance** — the global default theme configured by the deployment.
- **Dashboard** — a per-dashboard override (managed via `ThemeController.dashboardCrudTheme` + `createDashboardThemeProvider`).

Users have repeatedly asked to override theme tokens at a finer granularity — for example to make a single chart match a brand color in a sales dashboard, to highlight a tab with a different palette, or to give a Markdown callout a distinct background. Today the only options are to (a) override the entire dashboard or (b) inject custom CSS.

This SIP proposes a **third level**: per-component theme overrides on dashboard grid components (Charts, Markdown, Row, Column, Tabs), with an inheritance chain:

```
Instance Theme         (deployment default)
  └── Dashboard Theme  (existing per-dashboard override)
        └── Tab Theme           ┐
              └── Row/Col Theme │  (new, per-component)
                    └── Chart/Markdown Theme
```

Each level can override any subset of theme tokens; unspecified tokens are inherited from the parent.

## Non-goals

- **Custom CSS replacement.** This isn't trying to subsume CSS injection — only theme-token-level overrides (colors, font sizes, spacing, etc.).
- **New theme authoring UI.** Users pick from existing themes (the CRUD `theme` resource); creating themes still happens in the existing Themes section.
- **Backend schema changes.** All persistence lives on existing fields (`position_json` per-component `meta`, see Storage below).
- **Cross-dashboard reuse of component theme assignments.** A theme can be reused, but an *assignment* of a theme to a specific component lives with that component.

## Storage

Dashboard layout items are stored in `position_json` and surfaced in Redux as `LayoutItem`s with a `meta: LayoutItemMeta` field already typed as open-ended:

```ts
export type LayoutItemMeta = {
  // ...known fields...
  [key: string]: unknown;
};
```

We add an optional `themeId?: number | null` to `LayoutItemMeta`. No new tables, no migrations, no dashboard `json_metadata` changes.

A `themeId === null` means "explicitly no override — inherit from parent." A missing key means the same thing semantically; we treat them identically when reading.

Round-trip:
- **Read**: `LayoutItem.meta.themeId` is parsed straight from `position_json` like any other meta property.
- **Write**: dashboard save serializes the entire `position_json` already; storing `themeId` is free.
- **Backwards compatibility**: pre-feature dashboards have no `themeId` keys, so they fall through to the dashboard/instance theme as today.

## Architecture

### `ComponentThemeProvider`

A wrapper component placed inside each grid component, between the dashboard's existing `ThemeProvider` and the component's body:

```tsx
<ComponentThemeProvider layoutId={id}>
  {/* component body */}
</ComponentThemeProvider>
```

Responsibilities:
1. Read `themeId` from the layout item via Redux selector.
2. Walk up the layout tree (`parents`) to compute the effective theme — first non-null `themeId` wins; fall back to the dashboard/instance theme.
3. Call `ThemeController.createDashboardThemeProvider(themeId)` (same code path used for dashboard CRUD themes — themes are themes, regardless of which scope picked them).
4. Wrap children in `AntdThemeProvider` with the resolved theme.

Caching: `ThemeController` already memoizes themes by id (`dashboardThemes: Map<string, Theme>`). We reuse that — same theme assigned to 100 charts costs one fetch.

### `ComponentHeaderControls` (Phase 2, lands first)

A shared vertical-dots menu for grid components. Each grid component type
plugs in its own list of menu items via a `useComponentMenuItems` hook;
the visual chrome (the dots icon button, the dropdown surface, the
edit-mode visibility gating) lives in `ComponentHeaderControls` itself.

Per-component menu surfaces (informational — the actual conversions of
the existing patterns happen as part of Phase 4 for each component, so
we don't change user-visible UX in Phase 2):

| Component | Current pattern | Converges to |
|---|---|---|
| Markdown | `MarkdownModeDropdown` (Edit/Preview popover) | dots menu w/ Edit + Preview items |
| Row / Col | Gear icon → `WithPopoverMenu` with `BackgroundStyleDropdown` | dots menu w/ Background item |
| Chart | `SliceHeaderControls` (already a dots menu — wraps `MenuDotsDropdown`) | reuses the same shared component |
| Tabs | none | dots menu (new affordance) |

Phase 2 itself only **builds the component** and converts **Markdown** as
the PoC. The other components remain on their existing patterns until
the per-component Phase-4 PRs wire them up together with their theme
provider — that lets reviewers evaluate the menu unification + theming
together rather than as separate churn passes.

### `ThemeSelectorModal` (Phase 3)

Modal triggered from "Apply theme" in `ComponentHeaderControls`. Shows:
- A theme picker populated from the CRUD `/api/v1/theme/` endpoint (same source the dashboard-level picker uses).
- A "Clear override (inherit)" button when `themeId` is already set.
- **Live preview**: as the user picks options the targeted component
  re-renders with the candidate theme tokens immediately, *without*
  marking the dashboard dirty. Cancel reverts; Apply commits to Redux.
  Implemented via a tiny module-level subscribable `previewThemeStore`
  + `useSyncExternalStore` in `useEffectiveThemeId` (preview wins over
  the Redux-resolved id when present).

On save it dispatches a Redux action that updates the component's `meta.themeId` and marks the dashboard dirty.

## Phases

| Phase | Scope | PR target |
|---|---|---|
| **1** | Storage shape (`LayoutItemMeta.themeId`) + `ComponentThemeProvider` skeleton wired to one component (Chart) for proof of concept. No UI. | One PR |
| **2** | Build `ComponentHeaderControls` (shared dots menu) + tests. **Component creation only** — per-component conversions of the existing menu patterns happen in Phase 4 alongside theme wiring, so reviewers can evaluate the menu unification + theming together rather than as separate churn passes. | One PR |
| **3** | `ThemeSelectorModal` + persistence + "Apply theme" menu item. End-to-end demo on Chart. | One PR |
| **4** | Per-component PRs (Markdown / Row / Column / Tabs): swap their existing menu pattern for `ComponentHeaderControls`, wire `ComponentThemeProvider` around the body, add the "Apply theme" item. One PR per component so each menu/UX change can be reviewed in isolation. | ~4 small PRs |

Each phase is independently revertable. Phase 2 has standalone value.

## Open questions / shortcomings

These get refined as the work progresses; do not merge any phase without revisiting this section.

- [ ] **Theme resolution caching at the component level.** `ThemeController` caches themes by id, but `ComponentThemeProvider` walks the parents tree every render to find the effective `themeId`. Need to confirm the walk is cheap enough at typical dashboard sizes (~50 components), or memoize via Redux reselect.
- [ ] **Export / screenshot behavior.** The screenshot service (Playwright / WebDriver) reads the same DOM, so theme overrides should "just work" — but we need a screenshot regression test.
- [ ] **Embedded SDK.** Embedded dashboards default to light mode (#38644). Need to confirm component-level themes still apply in embedded context, since embedded skips `ThemeController.setCrudTheme`.
- [ ] **Theme deletion** — what happens if a `themeId` references a theme that's been deleted from the CRUD store? Likely fall back silently to parent; need a `useEffect` cleanup path.
- [ ] **Permission model.** Should `theme_write` be required to assign a theme to a component? Currently any dashboard editor can do it. Probably fine, but worth confirming with @michael-s-molina.
- [ ] **i18n / a11y of the modal.** Standard checklist — needs labels, focus management, keyboard.
- [ ] **Mobile** — `ComponentHeaderControls` hover-to-reveal pattern needs a tap-equivalent.

## Test plan

Each phase brings its own tests; the cumulative bar:

### Unit
- `ComponentThemeProvider`: resolves theme from own `themeId`; resolves from parent when own is null; falls back to dashboard/instance when no ancestor sets one; reacts to Redux meta changes.
- `useComponentThemeId` (selector / hook the provider uses): correctness on the parents-walk.
- `ComponentHeaderControls`: shows correct menu items per component type; routes `onClick` for each.
- `ThemeSelectorModal`: opens populated with available themes; "save" dispatches the right action; "clear override" sets `themeId: null`.

### Integration (RTL)
- Dashboard with one chart → assign a theme → chart re-renders with new tokens.
- Same dashboard → assign theme to the Row containing the chart → chart inherits Row theme (no own override).
- Set chart override + row override → chart wins (most-specific).
- Clear chart override → chart inherits row.
- Reload dashboard (re-render from `position_json`) → state preserved.

### E2E (Playwright)
- One scenario per component type: open dashboard → menu → apply theme → save → reload → verify.
- Permission scenario: editor can apply, viewer cannot see the menu.

### Manual / screenshot
- Light theme dashboard with one dark-themed chart and one default-themed chart — visual diff in CI.
- Embedded dashboard with a component theme — verify no host-CSS bleed.

## Out-of-scope (potential follow-ups)

- **Theme presets** — "apply this theme to all charts of viz type X" via a dashboard-level rule.
- **Theme inheritance debugger** — devtools view that shows which level set each token for a hovered component.
- **Bulk operations** — multi-select components and apply a theme to all.

## Implementation log

- _(Phase 1)_ — ✅ landed locally. `LayoutItemMeta.themeId`,
  `ComponentThemeProvider` + `useEffectiveThemeId` hook, wired into
  `ChartHolder`. 8 passing unit tests. No UI yet — `themeId` has to be
  set via Redux devtools or position_json hand-edit to verify visually.
- _(Phase 2)_ — ✅ landed locally. `ComponentHeaderControls` shared dots
  menu + 4 passing unit tests. Generic `items: ComponentMenuItem[]` API
  so each grid component can plug in its own list (Edit/Preview for
  Markdown, Background for Row/Col, Apply Theme/Delete for Chart, etc.).
  Built on the existing `MenuDotsDropdown` so the trigger styling
  matches Chart's `SliceHeaderControls` today (Phase 4 will converge
  `SliceHeaderControls` onto this).

  **Deferred to Phase 4**: actually swapping the existing per-component
  menu UI (Markdown's `MarkdownModeDropdown` PopoverDropdown, Row/Col's
  gear-icon-into-`WithPopoverMenu`, Tabs' nothing) for this component.
  Those conversions are user-visible UX changes (e.g. Markdown loses
  its toggle-style Edit/Preview switcher and gains a dots menu), so we
  do them per-component alongside the theme wiring so each can be
  reviewed in isolation.
- _(Phase 3)_ — ✅ landed locally. `ThemeSelectorModal` (fetches non-system
  themes via the same `/api/v1/theme/?q=...` query that the dashboard
  Properties modal uses; preselects the currently-resolved override;
  "Apply" / "Cancel" / "Clear override (inherit)" buttons) and the
  thin `setComponentThemeId(componentId, themeId | null)` action that
  merges into `meta.themeId` via the existing `updateComponents` thunk.

  No call site for the modal yet — Phase 4's per-component PRs add the
  "Apply theme" item to each component's menu that opens this modal.
  The modal is parent-controlled (`show`/`onHide`), parent-owned, so
  there's no wiring needed beyond `<ThemeSelectorModal layoutId={id}
  show={open} onHide={...} />` in each call site.

  3 passing tests on `setComponentThemeId`: preserves other meta keys
  + sets numeric `themeId`; stores explicit `null` for the clear path;
  no-op when the component id isn't in the layout.
- _(Phase 4)_ — ✅ landed locally for all five grid-component types.
  Same three-step recipe applied to each:
  (a) wrap body in `<ComponentThemeProvider layoutId={id}>`,
  (b) add "Apply theme" item to the component's menu via
      `ComponentHeaderControls`,
  (c) mount `<ThemeSelectorModal>` gated on `editMode`.

  - **Chart (4a)**: `SliceHeaderControls` gets the menu item; the
    provider was already wrapping `ChartHolder` from Phase 1.
  - **Tabs (4b)**: `TabsRenderer` wraps `<StyledTabsContainer>` in the
    provider; adds the dots-menu trigger inside the existing left
    `HoverMenu` next to the drag handle and delete button.
  - **Row (4c)**: wraps the `<WithPopoverMenu>` body; adds the
    dots-menu trigger to the left `HoverMenu` next to drag/delete/
    setting-icon. The existing gear icon (which opens the
    BackgroundStyleDropdown focus popover) is preserved as-is.
  - **Column (4d)**: same recipe as Row, wrapping its
    `<WithPopoverMenu>` body and adding the dots menu to the top
    `HoverMenu` next to drag/delete/setting-icon.
  - **Markdown (4e)**: class component, so theme-modal state goes
    through `this.state.themeModalOpen`. Adds a second
    `ComponentHeaderControls` to the existing `<WithPopoverMenu
    menuItems>` array next to the `MarkdownModeDropdown`
    (Edit/Preview toggle is preserved as-is — the full menu-pattern
    convergence onto a single dots menu is intentionally deferred so
    Markdown's Edit/Preview UX is not changed in this phase).

  Functional outcome: every grid-component type now supports the full
  Instance → Dashboard → Tab → Row/Col → Chart/Markdown inheritance
  chain end-to-end. Setting a `themeId` at any level applies to that
  subtree; clearing it falls through to the parent.

  Note on the broader menu-pattern unification: the SIP originally
  imagined Phase 4 PRs would also converge `MarkdownModeDropdown`
  (Edit/Preview popover) and the Row/Column gear icon into the shared
  dots menu. We deferred those user-visible UX displacements so each
  Phase-4 PR adds the theming affordance *additively* — i.e. the
  existing menu controls are untouched, the dots menu sits alongside.
  A follow-up SIP (or single sweep PR) can take the menu unification
  later without coupling it to the theming work.

### Phase 1 status

- [x] Add optional `themeId` field to `LayoutItemMeta`. (`src/dashboard/types.ts`)
- [x] Build `ComponentThemeProvider` — `pickEffectiveThemeId` resolver (pure
  function, walks `parents` up the layout map until it finds a non-null
  `themeId` or hits `DASHBOARD_ROOT_ID`) + `useEffectiveThemeId` Redux hook
  + `ComponentThemeProvider` that lazy-fetches the resolved theme via the
  existing `ThemeController.createDashboardThemeProvider` (which caches by
  id, so N components referencing the same theme = 1 fetch). Renders as a
  pass-through when no ancestor sets a `themeId`.
- [x] Wire into `ChartHolder` — wrapped around the existing
  `<AntdThemeProvider>` so per-component theme tokens apply to the chart
  body while the existing popup-container `ConfigProvider` continues to
  work in fullscreen mode.
- [x] Add unit tests — 8 cases for `pickEffectiveThemeId` covering own-id /
  inheritance / null-skip / no-ancestor / root-stop / malformed-parents /
  other-meta-keys / missing-id.
- [x] Update SIP with surprises uncovered during wiring (none significant —
  the existing `createDashboardThemeProvider` did exactly what we needed,
  including caching by id; the only structural decision was treating the
  ChartHolder's `<AntdThemeProvider>` as a popup-container shim rather than
  a token provider, and nesting our provider outside it).

#### Phase 1 surprises / notes

- `ThemeController.createDashboardThemeProvider` already does Theme.fromConfig
  with the right dark/light base + font loading + caching. We did not need
  to duplicate any of that logic in the component-level provider.
- The provider is `useState` + `useEffect` rather than `useMemo` because the
  fetch is async. That means there's a one-frame flash of the parent theme
  before the component theme kicks in. Probably acceptable; if not, we can
  Suspense-ify in Phase 4.
- `useEffectiveThemeId` re-runs on every Redux state change because the
  selector returns a primitive `number | null` — that's fine for now, but
  if dashboards get bigger we may want a memoized selector via reselect
  keyed on `(layoutId, layout)` — file in the open questions section.
