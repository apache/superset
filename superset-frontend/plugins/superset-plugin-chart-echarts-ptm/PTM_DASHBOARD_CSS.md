# PTM Dashboard CSS Template

Copy and paste this CSS into **Dashboard > Edit > CSS** to apply the Portal Telemedicina theme.

---

## ⚠️ Important: Loading Custom Fonts

Superset's CSS editor **does not allow `@import`** statements. To use the custom fonts (Montserrat and Inter), you have two options:

### Option 1: Add a Markdown Component (Recommended)

1. Add a **Markdown** component to your dashboard
2. Set its height to **0** or **1** pixel to hide it
3. Paste this HTML in the Markdown content:

```html
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
```

### Option 2: Use System Font Fallbacks

If you can't add the Markdown component, the CSS below will automatically fall back to system fonts that look similar:
- Montserrat → system-ui, -apple-system, BlinkMacSystemFont
- Inter → system-ui, -apple-system, BlinkMacSystemFont

---

## Complete Theme CSS

```css
/* ================================================
   PTM DASHBOARD THEME
   Portal Telemedicina Design System
   ================================================ */

/* === FONTS ===
   NOTE: @import is not allowed in Superset CSS editor.
   Load fonts via Markdown component (see instructions above)
   or use the system font fallbacks defined in the variables.
   ============================================== */

/* === CSS VARIABLES (for easy customization) === */
:root {
  --ptm-primary: #2C9FE5;
  --ptm-primary-dark: #2075AC;
  --ptm-secondary: #33A7B5;
  --ptm-success: #5AD7A5;
  --ptm-error: #EC4B60;
  --ptm-attention: #F5C451;
  
  --ptm-neutral-white: #FFFFFF;
  --ptm-neutral-100: #F7F7F6;
  --ptm-neutral-200: #F1F1F1;
  --ptm-neutral-300: #CACACA;
  --ptm-neutral-400: #979797;
  --ptm-neutral-500: #666666;
  --ptm-neutral-600: #222222;
  
  /* Fonts with system fallbacks */
  --ptm-font-title: 'Montserrat', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --ptm-font-body: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  
  --ptm-radius-sm: 8px;
  --ptm-radius-md: 12px;
  --ptm-radius-lg: 16px;
  
  --ptm-shadow-card: 0 2px 8px rgba(0, 0, 0, 0.06);
  --ptm-shadow-hover: 0 4px 16px rgba(0, 0, 0, 0.1);
}

/* === DASHBOARD BACKGROUND === */
.dashboard {
  background-color: var(--ptm-neutral-100) !important;
}

.dashboard-content {
  background-color: var(--ptm-neutral-100) !important;
}

.grid-container {
  background-color: var(--ptm-neutral-100) !important;
}

/* === CHART CARDS === */
.dashboard-component-chart-holder {
  background: var(--ptm-neutral-white) !important;
  border-radius: var(--ptm-radius-lg) !important;
  box-shadow: var(--ptm-shadow-card) !important;
  border: none !important;
  overflow: hidden;
  transition: box-shadow 0.2s ease;
}

.dashboard-component-chart-holder:hover {
  box-shadow: var(--ptm-shadow-hover) !important;
}

.chart-container {
  border-radius: var(--ptm-radius-lg) !important;
}

.slice_container {
  border-radius: var(--ptm-radius-lg) !important;
}

/* === CHART HEADER / TITLE === */
.slice_container .header-title {
  font-family: var(--ptm-font-title) !important;
  font-weight: 600 !important;
  font-size: 14px !important;
  color: var(--ptm-neutral-600) !important;
  letter-spacing: 0.02em;
}

.editable-title input {
  font-family: var(--ptm-font-title) !important;
  font-weight: 600 !important;
}

/* === BIG NUMBER / KPI CARDS === */
.big-number-vis {
  font-family: var(--ptm-font-title) !important;
}

.big-number-vis .header-line {
  font-weight: 700 !important;
  color: var(--ptm-neutral-600) !important;
  font-size: 32px !important;
}

.big-number-vis .subheader-line {
  font-family: var(--ptm-font-body) !important;
  font-weight: 400 !important;
  color: var(--ptm-neutral-500) !important;
  font-size: 12px !important;
  margin-top: 4px;
}

/* Big Number with Trendline */
.big-number-container .header-line {
  font-family: var(--ptm-font-title) !important;
  font-weight: 700 !important;
}

/* Comparison indicator colors */
.big-number-vis .is-positive {
  color: var(--ptm-success) !important;
}

.big-number-vis .is-negative {
  color: var(--ptm-error) !important;
}

/* === FILTER BAR === */
.filter-bar {
  background: var(--ptm-neutral-white) !important;
  border-radius: var(--ptm-radius-sm) !important;
  box-shadow: var(--ptm-shadow-card) !important;
}

.filter-bar-wrapper {
  background: var(--ptm-neutral-white) !important;
}

/* === BUTTONS === */
.ant-btn {
  font-family: var(--ptm-font-body) !important;
  font-weight: 500 !important;
  border-radius: var(--ptm-radius-sm) !important;
}

.ant-btn-primary {
  background-color: var(--ptm-primary) !important;
  border-color: var(--ptm-primary) !important;
}

.ant-btn-primary:hover,
.ant-btn-primary:focus {
  background-color: var(--ptm-primary-dark) !important;
  border-color: var(--ptm-primary-dark) !important;
}

/* === TABLES === */
.table {
  font-family: var(--ptm-font-body) !important;
}

.table th {
  font-family: var(--ptm-font-body) !important;
  font-weight: 600 !important;
  font-size: 12px !important;
  color: var(--ptm-neutral-500) !important;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  background-color: var(--ptm-neutral-100) !important;
}

.table td {
  font-size: 14px !important;
  color: var(--ptm-neutral-600) !important;
}

.table tbody tr:hover {
  background-color: var(--ptm-neutral-100) !important;
}

/* Pivot Table */
.pvtTable {
  font-family: var(--ptm-font-body) !important;
}

/* === TABS === */
.ant-tabs {
  font-family: var(--ptm-font-body) !important;
}

.ant-tabs-tab {
  font-weight: 500 !important;
  color: var(--ptm-neutral-500) !important;
}

.ant-tabs-tab-active {
  color: var(--ptm-primary) !important;
}

.ant-tabs-tab:hover {
  color: var(--ptm-primary) !important;
}

.ant-tabs-ink-bar {
  background-color: var(--ptm-primary) !important;
}

/* === INPUTS & SELECTS === */
.ant-select-selector {
  border-radius: var(--ptm-radius-sm) !important;
  font-family: var(--ptm-font-body) !important;
}

.ant-input {
  border-radius: var(--ptm-radius-sm) !important;
  font-family: var(--ptm-font-body) !important;
}

.ant-select-focused .ant-select-selector {
  border-color: var(--ptm-primary) !important;
  box-shadow: 0 0 0 2px rgba(44, 159, 229, 0.2) !important;
}

.ant-input:focus,
.ant-input-focused {
  border-color: var(--ptm-primary) !important;
  box-shadow: 0 0 0 2px rgba(44, 159, 229, 0.2) !important;
}

/* === DROPDOWNS === */
.ant-dropdown-menu {
  border-radius: var(--ptm-radius-sm) !important;
  box-shadow: var(--ptm-shadow-hover) !important;
}

.ant-dropdown-menu-item {
  font-family: var(--ptm-font-body) !important;
}

/* === MARKDOWN / TEXT COMPONENTS === */
.dashboard-markdown {
  font-family: var(--ptm-font-body) !important;
}

.dashboard-markdown h1,
.dashboard-markdown h2,
.dashboard-markdown h3 {
  font-family: var(--ptm-font-title) !important;
  font-weight: 700 !important;
  color: var(--ptm-neutral-600) !important;
}

.dashboard-markdown p {
  color: var(--ptm-neutral-500) !important;
}

/* === ROW/COLUMN HEADERS (Dashboard Sections) === */
.header-text {
  font-family: var(--ptm-font-title) !important;
  font-weight: 600 !important;
  color: var(--ptm-neutral-600) !important;
}

.dragdroppable-row .header-container {
  font-family: var(--ptm-font-title) !important;
}

/* === TOOLTIP OVERRIDES === */
.dashboard-tooltip {
  font-family: var(--ptm-font-body) !important;
  border-radius: var(--ptm-radius-sm) !important;
}

/* === LOADING STATE === */
.loading {
  font-family: var(--ptm-font-body) !important;
}

/* === SCROLLBARS (WebKit) === */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: var(--ptm-neutral-100);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb {
  background: var(--ptm-neutral-300);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--ptm-neutral-400);
}

/* === PRINT STYLES === */
@media print {
  .dashboard-component-chart-holder {
    box-shadow: none !important;
    border: 1px solid var(--ptm-neutral-200) !important;
  }
}
```

---

## Minimal Version (Cards + Typography only)

If you want a lighter version:

```css
/* PTM Dashboard - Minimal Theme */

/* NOTE: To load fonts, add a Markdown component with:
   <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700&family=Inter:wght@300;400;500&display=swap" rel="stylesheet">
*/

:root {
  --ptm-primary: #2C9FE5;
  --ptm-neutral-100: #F7F7F6;
  --ptm-neutral-white: #FFFFFF;
  --ptm-font-title: 'Montserrat', system-ui, -apple-system, sans-serif;
  --ptm-font-body: 'Inter', system-ui, -apple-system, sans-serif;
}

/* Background */
.dashboard, .dashboard-content, .grid-container {
  background-color: var(--ptm-neutral-100) !important;
}

/* Cards */
.dashboard-component-chart-holder {
  background: var(--ptm-neutral-white) !important;
  border-radius: 16px !important;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06) !important;
  border: none !important;
}

/* Typography */
.slice_container .header-title,
.big-number-vis {
  font-family: var(--ptm-font-title) !important;
}

.table, .ant-btn, .ant-select, .ant-input {
  font-family: var(--ptm-font-body) !important;
}
```

---

## Usage

1. Open your dashboard in **Edit mode**
2. Click the **...** menu (more actions)
3. Select **Edit CSS**
4. Paste the CSS above
5. **(Optional but recommended)** Add a Markdown component with the font `<link>` tag (see instructions above)
6. Save

The theme will be applied to this dashboard only. For global changes, consider modifying the Superset theme files.
