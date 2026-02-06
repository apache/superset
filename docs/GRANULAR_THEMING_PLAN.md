<!--
Licensed to the Apache Software Foundation (ASF) under one
or more contributor license agreements.  See the NOTICE file
distributed with this work for additional information
regarding copyright ownership.  The ASF licenses this file
to you under the Apache License, Version 2.0 (the
"License"); you may not use this file except in compliance
with the License.  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing,
software distributed under the License is distributed on an
"AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, either express or implied.  See the License for the
specific language governing permissions and limitations
under the License.
-->

# Granular Theming Feature Plan

## Overview

Extend Superset's theming system to support theme application at granular levels beyond instance and dashboard. This includes charts, dashboard components (Markdown, Rows, Columns, Tabs), and improved UI consistency across all dashboard elements.

## Current State

### Theme Hierarchy (Existing)
1. **Instance Level** - Global theme via ThemeController, affects entire Superset
2. **Dashboard Level** - Override via Dashboard Properties modal, stored in `theme_id`

### Current Limitations
- Charts inherit dashboard/instance theme - no per-chart override
- Dashboard components (Markdown, Row, Column, Tab) have no theme controls
- Inconsistent UI patterns across components:
  - Charts have `SliceHeaderControls` menu (vertical dots)
  - Markdown has `MarkdownModeDropdown` (Edit/Preview toggle) - no standard menu
  - Row/Column have `BackgroundStyleDropdown` via gear icon
  - Tabs have editable title only

---

## Proposed Theme Hierarchy

```
Instance Theme (global default)
    └── Dashboard Theme (override)
            ├── Chart Theme (per-chart override)
            ├── Markdown Theme (per-component override)
            ├── Row Theme (per-component override)
            ├── Column Theme (per-component override)
            └── Tab Theme (per-component override)
```

Each level inherits from parent and can selectively override tokens.

---

## Feature Breakdown

### Phase 1: Chart-Level Theming

#### 1.1 Chart Theme in Explore View
**Location:** Chart controls panel (alongside color palette picker)

**Tasks:**
- [ ] Add `ThemeControl` component to explore controls
- [ ] Create theme selector UI (dropdown with theme previews)
- [ ] Store theme selection in chart `form_data` / `params`
- [ ] Update chart rendering to apply theme override
- [ ] Add to relevant viz control panels (sections.tsx)

**Files to modify:**
- `superset-frontend/src/explore/components/controls/` - New ThemeControl
- `superset-frontend/src/explore/controlPanels/sections.tsx` - Add to panels
- `superset-frontend/packages/superset-ui-core/src/chart/` - Theme application

#### 1.2 Chart Theme in Dashboard Context
**Location:** SliceHeaderControls menu (top-right vertical dots)

**Tasks:**
- [ ] Add "Apply Theme" menu item to SliceHeaderControls
- [ ] Create theme selection modal/popover
- [ ] Store per-chart theme in dashboard layout metadata
- [ ] Update chart rendering in dashboard to check for theme override
- [ ] Handle theme inheritance (chart theme → dashboard theme → instance theme)

**Files to modify:**
- `superset-frontend/src/dashboard/components/SliceHeaderControls/index.tsx`
- `superset-frontend/src/dashboard/reducers/` - Store chart themes
- `superset-frontend/src/dashboard/actions/` - Theme actions

---

### Phase 2: UI Consistency Improvements

#### 2.1 Standardized Component Menu
Create a consistent menu pattern for ALL dashboard components.

**Proposed Pattern:**
- All components get a `ComponentHeaderControls` menu (vertical dots like charts)
- Menu appears on hover/focus in both view and edit modes
- Contains context-appropriate actions

**Tasks:**
- [ ] Create generic `ComponentHeaderControls` component
- [ ] Define standard menu structure with extensible items
- [ ] Implement for each component type

#### 2.2 Markdown Component Menu
**Current:** `MarkdownModeDropdown` (Edit/Preview) at top of card in edit mode

**Proposed:** Standard vertical dots menu with:
- Edit content (opens editor modal or inline)
- Apply theme
- View source (preview mode)
- Delete component

**Tasks:**
- [ ] Add `ComponentHeaderControls` to Markdown
- [ ] Move Edit/Preview toggle into menu or make it a toggle button
- [ ] Remove old `MarkdownModeDropdown` UI
- [ ] Add theme selection option

**Files to modify:**
- `superset-frontend/src/dashboard/components/gridComponents/Markdown/`
- `superset-frontend/src/dashboard/components/menu/MarkdownModeDropdown.tsx` - Deprecate

#### 2.3 Row/Column Component Menu
**Current:** Gear icon for `BackgroundStyleDropdown` (Transparent/Solid)

**Proposed:** Standard vertical dots menu with:
- Background style (submenu or modal)
- Apply theme
- Delete component

**Tasks:**
- [ ] Add `ComponentHeaderControls` to Row/Column
- [ ] Move background style into menu
- [ ] Remove standalone gear icon
- [ ] Add theme selection option

**Files to modify:**
- `superset-frontend/src/dashboard/components/gridComponents/Row/`
- `superset-frontend/src/dashboard/components/gridComponents/Column/`
- `superset-frontend/src/dashboard/components/menu/BackgroundStyleDropdown.tsx`

#### 2.4 Tab Component Menu
**Current:** Editable title only

**Proposed:** Standard vertical dots menu on each tab with:
- Rename tab
- Apply theme (to tab content area)
- Delete tab

**Tasks:**
- [ ] Add `ComponentHeaderControls` to Tab headers
- [ ] Integrate with existing editable title
- [ ] Add theme selection option

**Files to modify:**
- `superset-frontend/src/dashboard/components/gridComponents/Tab/`
- `superset-frontend/src/dashboard/components/gridComponents/Tabs/`

---

### Phase 3: Theme Storage & API

#### 3.1 Backend Storage
**Tasks:**
- [ ] Extend dashboard `json_metadata` schema to include component themes
- [ ] Add chart theme field to chart model or store in dashboard layout
- [ ] Create API endpoints for component theme CRUD (or use existing dashboard save)

**Schema proposal:**
```json
{
  "json_metadata": {
    "theme_id": 123,
    "component_themes": {
      "CHART-abc123": { "theme_id": 456 },
      "MARKDOWN-def456": { "theme_id": 789 },
      "ROW-ghi789": { "theme_id": 101 }
    }
  }
}
```

#### 3.2 Frontend State Management
**Tasks:**
- [ ] Add component themes to dashboard Redux state
- [ ] Create actions for setting/clearing component themes
- [ ] Update selectors to resolve theme hierarchy
- [ ] Cache resolved themes for performance

---

### Phase 4: Theme Application & Rendering

#### 4.1 Theme Resolution Logic

Full cascade order: **Instance → Dashboard → Tab → Row/Column → Chart/Component**

Each level overrides the one above it. Components inherit from their structural parent.

```typescript
function resolveComponentTheme(
  componentId: string,
  parentChain: string[]  // [dashboardId, tabId?, rowId?, columnId?]
): Theme {
  const instanceTheme = getInstanceTheme();
  const dashboardTheme = getDashboardTheme();

  // Walk up the parent chain, collecting theme overrides
  let mergedTheme = mergeThemes(instanceTheme, dashboardTheme);

  for (const parentId of parentChain) {
    const parentTheme = getComponentTheme(parentId);
    if (parentTheme) {
      mergedTheme = mergeThemes(mergedTheme, parentTheme);
    }
  }

  // Finally apply this component's theme
  const componentTheme = getComponentTheme(componentId);
  return componentTheme
    ? mergeThemes(mergedTheme, componentTheme)
    : mergedTheme;
}
```

#### 4.2 Theme Provider Hierarchy
**Tasks:**
- [ ] Create `ComponentThemeProvider` wrapper
- [ ] Wrap each dashboard component with theme context
- [ ] Ensure proper theme inheritance and override behavior
- [ ] Handle theme changes without full re-render

---

## UI/UX Design Considerations

### Menu Placement
- **Charts:** Keep existing top-right position (SliceHeaderControls)
- **Markdown/Row/Column:** Top-right corner, visible on hover
- **Tabs:** In tab header, right side of tab label

### Theme Selector UI

**Decision:** Modal with live preview rendering

The theme selector will open a modal that shows:
- List of available themes (left panel)
- Live preview of the component with selected theme applied (right panel)
- Apply / Cancel buttons

This provides the best UX for understanding theme impact before committing.

**Implementation approach:**
- Render component in isolated ThemeProvider within modal
- Pass temporary theme to preview without affecting dashboard state
- On "Apply", persist theme selection to dashboard metadata

### Visual Indicators
- Show subtle indicator when component has theme override (e.g., small theme icon)
- Tooltip showing "Custom theme: [Theme Name]"
- In edit mode, highlight themed components differently

---

## Technical Considerations

### Performance
- Theme objects can be large - cache aggressively
- Use React.memo and useMemo for theme-dependent components
- Consider lazy loading theme data for components not in viewport

### Backwards Compatibility
- Components without theme override continue to inherit from parent
- Existing dashboards work unchanged
- Migration not required - additive feature

### Theme Merging Strategy
- Deep merge with component theme taking precedence
- Only override specified tokens, inherit rest
- Handle algorithm (light/dark) inheritance carefully

---

## Implementation Order

1. **Phase 1.2** - Chart theme in dashboard (SliceHeaderControls) - Most impactful, builds on existing menu
2. **Phase 2.1** - Create generic ComponentHeaderControls - Foundation for other components
3. **Phase 2.2** - Markdown menu - Good test case, simplest component
4. **Phase 2.3** - Row/Column menu - Similar pattern, removes old UI
5. **Phase 2.4** - Tab menu - More complex due to tab structure
6. **Phase 1.1** - Chart theme in Explore - Can be done in parallel
7. **Phase 3 & 4** - Storage and rendering - Continuous throughout

---

## Decisions Made

1. **Theme scope for Tabs:** Theme applies to tab **contents** (the content area), which can be overridden by components within the tab.

2. **Nested theming:** Full cascade - each level overrides the one above:
   ```
   Instance → Dashboard → Tab → Row/Column → Chart/Component
   ```
   A Chart theme overrides the Row theme it sits in.

3. **Color scheme vs Theme:** Keep **separate**:
   - **Color Scheme (palette):** Categorical/sequential colors for data visualization
   - **Theme:** UI elements - axes, fonts, backgrounds, borders, etc.

   Both controls will exist side-by-side in chart controls.

4. **Theme selector UI:** Modal with live preview rendering.

## Open Questions

1. **Undo/Redo:** Should theme changes be undoable in dashboard edit mode?
2. **Theme inheritance indicator:** How to show which theme a component is inheriting from?

---

## Success Metrics

- [ ] Users can apply themes to individual charts in dashboards
- [ ] All dashboard components have consistent menu UI
- [ ] Old gear icon and mode dropdown removed
- [ ] Theme inheritance works correctly across all levels
- [ ] No performance regression on dashboard load
- [ ] Backwards compatible with existing dashboards

---

## Future Possibilities

Once granular theming is in place, this opens doors for:

1. **ECharts Token Overrides** - The theme system already supports `echartsOverrides` for per-chart-type styling. Future work could expose UI for:
   - Rounded corners on bar charts
   - Custom line styles
   - Shadow effects
   - Animation settings

2. **Theme Templates** - Pre-built component theme combinations (e.g., "Dark Card", "Glassmorphism", "Minimal")

3. **Theme Export/Import** - Share component themes across dashboards

4. **Conditional Theming** - Apply themes based on data values or user context

---

## Implementation Log

_Ongoing notes as we implement..._

### Session 1 - Planning
- Created initial plan document
- Established theme hierarchy: Instance → Dashboard → Tab → Row/Column → Chart/Component
- Decided on modal with live preview for theme selection
- Clarified color scheme (data) vs theme (UI) separation

### Session 1 - Implementation Started
- Created `ComponentHeaderControls` component at:
  `src/dashboard/components/menu/ComponentHeaderControls/index.tsx`
  - Generic vertical dots menu matching SliceHeaderControls pattern
  - Uses NoAnimationDropdown + Menu from @superset-ui/core
  - Configurable menu items, edit mode visibility
  - Exports `ComponentMenuKeys` enum for standard actions

- Created `useComponentMenuItems` hook at:
  `src/dashboard/components/menu/ComponentHeaderControls/useComponentMenuItems.tsx`
  - Builds standard menu items (theme, delete)
  - Supports custom items before/after standard items
  - Shows "Change theme (name)" when theme applied

**Next Steps:**
1. ~~Integrate ComponentHeaderControls into Markdown component~~ DONE
2. Test with simple Edit/Preview + Theme + Delete menu
3. ~~Remove old MarkdownModeDropdown~~ DONE

### Session 1 - Markdown Integration
- Integrated `ComponentHeaderControls` into Markdown component
- Replaced old UI elements:
  - Removed `DeleteComponentButton` from HoverMenu (now in ComponentHeaderControls)
  - Removed `MarkdownModeDropdown` from `WithPopoverMenu.menuItems`
- New menu includes: Edit/Preview toggle, Apply Theme, Delete
- Uses existing `HoverMenu position="top"` for proper CSS integration
- Menu shows on hover in edit mode (leverages existing DashboardWrapper CSS)

**Files modified:**
- `src/dashboard/components/gridComponents/Markdown/Markdown.jsx`

**Status:** Completed - all tests pass

### Session 2 - CSS Fix and Test Updates
- Fixed CSS visibility issue: replaced custom `MarkdownControlsWrapper` with `HoverMenu` component
- The custom wrapper's CSS selectors weren't being triggered by the existing DashboardWrapper CSS rules
- Using `HoverMenu position="top"` integrates with existing CSS that shows hover menus:
  ```css
  div:hover > .hover-menu-container .hover-menu { opacity: 1; }
  ```
- Updated tests to work with new menu pattern:
  - Tests now click "More Options" button to open dropdown
  - Tests look for "Preview" option (not "Edit") when in edit mode
  - All 16 Markdown tests passing

**Files modified:**
- `src/dashboard/components/gridComponents/Markdown/Markdown.jsx`
- `src/dashboard/components/gridComponents/Markdown/Markdown.test.tsx`

**Status:** Phase 2.2 complete, ready for Phase 2.3 (Row/Column)

### Session 2 - ThemeSelectorModal Implementation
- Created `ThemeSelectorModal` component at:
  `src/dashboard/components/menu/ThemeSelectorModal/index.tsx`
  - Fetches themes from `/api/v1/theme/` API
  - Shows dropdown with theme names and badges (Default, Dark)
  - Apply/Cancel buttons
  - Stores selected theme ID in component metadata

- Wired up ThemeSelectorModal to Markdown component:
  - Added `isThemeSelectorOpen` state
  - Added `handleOpenThemeSelector`, `handleCloseThemeSelector`, `handleApplyTheme` methods
  - `handleApplyTheme` stores `theme_id` in component.meta via `updateComponents`
  - Modal opens when clicking "Apply theme" menu item

**Files created:**
- `src/dashboard/components/menu/ThemeSelectorModal/index.tsx`

**Files modified:**
- `src/dashboard/components/gridComponents/Markdown/Markdown.jsx`

**Status:** ThemeSelectorModal complete, all tests pass

**Note:** Theme selection is stored in component metadata (client-side).
Backend persistence (Phase 3) will save this to dashboard `json_metadata.component_themes`.

### Session 3 - Bug Fix: setState Race Condition

**Problem:** Clicking "Apply theme" menu item didn't open the modal. Debug logging showed:
- `handleOpenThemeSelector` was called and set `isThemeSelectorOpen: true`
- But the setState callback showed `isThemeSelectorOpen: false`
- ThemeSelectorModal received `show: false`

**Root Cause:** `handleChangeEditorMode` used a non-functional setState pattern:
```javascript
const nextState = { ...this.state, editorMode: mode };  // Reads stale state
this.setState(nextState);  // Overwrites pending isThemeSelectorOpen: true
```

When the dropdown menu closed, it triggered `handleChangeFocus → handleChangeEditorMode`,
which copied the old state (before React applied the pending `isThemeSelectorOpen: true`)
and overwrote it.

**Fix:** Changed to functional setState:
```javascript
this.setState(prevState => ({
  ...prevState,
  editorMode: mode,
  ...(mode === 'preview' ? { hasError: false } : {}),
}));
```

**Status:** Modal now opens correctly. Theme selection is stored in component metadata.

**Next Steps:**
1. ~~Phase 2.3: Add ComponentHeaderControls to Row/Column~~ DONE
2. Phase 2.4: Add ComponentHeaderControls to Tabs
3. Phase 1.2: Add theme selector to SliceHeaderControls (charts)
4. Phase 3: Backend persistence
5. Phase 4: Theme rendering/application

### Session 3 - Phase 2.3: Row/Column Integration

Updated Row and Column components to use `ComponentHeaderControls`:

**Row.tsx changes:**
- Replaced `DeleteComponentButton` and gear `IconButton` with `ComponentHeaderControls`
- Removed `BackgroundStyleDropdown` from `WithPopoverMenu.menuItems`
- Added menu items: Background toggle (Transparent/Solid), Apply theme, Delete
- Added `ThemeSelectorModal` integration
- Fixed `backgroundStyle` variable ordering (moved before hooks that use it)

**Column.jsx changes:**
- Same pattern as Row
- Replaced old UI elements with `ComponentHeaderControls`
- Added theme selector modal integration

**Test updates:**
- Updated Row.test.tsx and Column.test.jsx to use new menu pattern
- Removed mocks for `DeleteComponentButton`
- Tests now click "More Options" menu button and select "Delete" from dropdown

**Files modified:**
- `src/dashboard/components/gridComponents/Row/Row.tsx`
- `src/dashboard/components/gridComponents/Row/Row.test.tsx`
- `src/dashboard/components/gridComponents/Column/Column.jsx`
- `src/dashboard/components/gridComponents/Column/Column.test.jsx`

**Status:** All tests pass (Row, Column, Markdown)

### Session 4 - Phase 2.4: Tabs Integration

Updated Tabs and TabsRenderer components to use `ComponentHeaderControls`:

**TabsRenderer.tsx changes:**
- Replaced `DeleteComponentButton` with `ComponentHeaderControls`
- Added `handleOpenThemeSelector` prop to interface
- Added `handleMenuClick` callback for menu actions
- Added menu items: Apply theme, Delete
- Menu appears in HoverMenu alongside DragHandle

**Tabs.jsx changes:**
- Added `ThemeSelectorModal` import and integration
- Added `isThemeSelectorOpen` state
- Added `handleOpenThemeSelector`, `handleCloseThemeSelector`, `handleApplyTheme` handlers
- Passed `handleOpenThemeSelector` to TabsRenderer
- Theme stored in `tabsComponent.meta.theme_id`

**Test updates:**
- Updated TabsRenderer.test.tsx to include `handleOpenThemeSelector` in props
- Updated Tabs.test.tsx:
  - Removed `DeleteComponentButton` mock (no longer used)
  - Updated tests to check for `ComponentHeaderControls` via `[aria-label="More Options"]`
  - Updated delete test to use menu pattern (click menu button, then "Delete" option)

**Files modified:**
- `src/dashboard/components/gridComponents/TabsRenderer/TabsRenderer.tsx`
- `src/dashboard/components/gridComponents/TabsRenderer/TabsRenderer.test.tsx`
- `src/dashboard/components/gridComponents/Tabs/Tabs.jsx`
- `src/dashboard/components/gridComponents/Tabs/Tabs.test.tsx`

**Status:** All tests pass (108 tests across 7 test suites)

**Phase 2 Complete!** All dashboard components now have consistent `ComponentHeaderControls` menu:
- Markdown: Edit/Preview toggle, Apply theme, Delete
- Row: Background toggle, Apply theme, Delete
- Column: Background toggle, Apply theme, Delete
- Tabs: Apply theme, Delete

**Next Steps:**
1. ~~Phase 1.2: Add theme selector to SliceHeaderControls (charts)~~ DONE
2. Phase 3: Backend persistence
3. Phase 4: Theme rendering/application

### Session 4 - Phase 1.2: SliceHeaderControls (Chart) Theme Integration

Added theme selector to chart menu in dashboard view:

**types.ts changes:**
- Added `currentThemeId?: number | null` prop
- Added `onApplyTheme?: (themeId: number | null) => void` callback prop

**dashboard/types.ts changes:**
- Added `ApplyTheme = 'apply_theme'` to MenuKeys enum

**SliceHeaderControls/index.tsx changes:**
- Added `isThemeSelectorOpen` state
- Added `handleCloseThemeSelector` and `handleApplyTheme` handlers
- Added `ApplyTheme` case to handleMenuClick switch
- Added "Apply theme" menu item (only shown if `onApplyTheme` prop is provided)
- Added `ThemeSelectorModal` rendering

**Design notes:**
- Theme selector only appears if parent passes `onApplyTheme` callback
- This allows gradual adoption - parent components can enable theming when ready
- Charts in dashboard view can have themes applied once parent wiring is complete

**Files modified:**
- `src/dashboard/types.ts`
- `src/dashboard/components/SliceHeaderControls/types.ts`
- `src/dashboard/components/SliceHeaderControls/index.tsx`

**Status:** All 33 tests pass

**Remaining Work:**
1. ~~Wire up `onApplyTheme` callback in parent component (ChartHolder/SliceHeader)~~ DONE
2. Phase 3: Backend persistence for component themes
3. Phase 4: Theme rendering/application

### Session 5 - Phase 4.2: ComponentThemeProvider Implementation

Created `ComponentThemeProvider` for component-level theme application:

**ComponentThemeProvider/index.tsx:**
- Wrapper component that loads and applies theme for dashboard components
- Fetches theme from ThemeController via `createTheme(themeId, parentThemeConfig)`
- Merges component theme with parent theme for proper inheritance
- Error boundary catches missing ThemeProvider (e.g., in tests) and gracefully falls back
- Uses ref for parent theme config to avoid infinite re-render loops

**Integration:**
- Wrapped children of Row, Column, Tabs, Markdown, ChartHolder with ComponentThemeProvider
- Components pass `themeId={component.meta?.theme_id}` to the provider
- Theme inheritance works: Instance → Dashboard → Tab → Row/Column → Chart/Component

**useComponentTheme hook:**
- Helper hook to get theme info for UI display
- Returns `{ themeId, themeName, hasTheme }`

**Files created:**
- `src/dashboard/components/ComponentThemeProvider/index.tsx`
- `src/dashboard/components/ComponentThemeProvider/ComponentThemeProvider.test.tsx`

**Status:** Theme application working. Themes now visually apply to components.

### Session 5 - ChartHolder/SliceHeader Wiring Complete

Wired up `onApplyTheme` from SliceHeaderControls through the component hierarchy:

**ChartHolder.tsx changes:**
- Added `handleApplyTheme` callback that updates component.meta.theme_id
- Uses `getComponentById` pattern to avoid stale closures
- Passes `onApplyTheme` and `currentThemeId` to Chart component
- Wrapped Chart with `ComponentThemeProvider`

**Chart.jsx and SliceHeader changes:**
- Props flow: ChartHolder → Chart → SliceHeader → SliceHeaderControls
- `onApplyTheme` and `currentThemeId` passed down the hierarchy
- Theme modal now accessible from chart's menu

**Files modified:**
- `src/dashboard/components/gridComponents/ChartHolder/ChartHolder.tsx`
- `src/dashboard/components/gridComponents/Chart/Chart.jsx`
- `src/dashboard/components/SliceHeader/index.tsx`

### Session 5 - Stability Fixes for handleApplyTheme

Fixed re-render issues caused by unstable callback dependencies:

**Problem:** `handleApplyTheme` callbacks in Row, Column, Tabs had the full component object
or `props` in their dependency arrays, causing unnecessary re-renders.

**Solution:** Applied ref pattern to all components:
1. Create ref: `const componentRef = useRef(component)`
2. Keep ref updated: `useEffect(() => { componentRef.current = component }, [component])`
3. Use ref in callback: `const currentComponent = componentRef.current`
4. Remove component from dependencies

**Files modified:**
- `src/dashboard/components/gridComponents/Row/Row.tsx`
- `src/dashboard/components/gridComponents/Column/Column.jsx`
- `src/dashboard/components/gridComponents/Tabs/Tabs.jsx`
- `src/dashboard/components/gridComponents/ChartHolder/ChartHolder.tsx`

**ComponentThemeProvider re-render fix:**
- Fixed infinite re-render loop caused by `parentThemeConfig` in useEffect dependencies
- Changed to use ref pattern for parent theme config
- Simplified `useComponentTheme` hook to avoid setState in effect

**Status:** All re-render issues resolved. Dashboard loads cleanly without excessive renders.

### Current Status Summary

**Completed:**
- Phase 1.2: Chart theme in dashboard (SliceHeaderControls) ✅
- Phase 2.1: ComponentHeaderControls component ✅
- Phase 2.2: Markdown menu integration ✅
- Phase 2.3: Row/Column menu integration ✅
- Phase 2.4: Tabs menu integration ✅
- Phase 4.2: ComponentThemeProvider and theme application ✅

**In Progress:**
- Phase 3: Backend persistence (themes stored in component.meta, needs API save)

**Not Started:**
- Phase 1.1: Chart theme in Explore view
- Theme visual indicators in edit mode
