# Accessibility Developer Guide

> Apache Superset — WCAG 2.1 AA Compliance Patterns
>
> This guide documents the accessibility patterns used in this codebase.
> Follow these patterns when creating or modifying components.

---

## A. Overview

Apache Superset targets **WCAG 2.1 Level AA** compliance. This project addresses 15 specific success criteria across four areas:

| Area | Criteria Count | Level |
|------|---------------|-------|
| Level A Core | 5 | A |
| Visual Presentation | 4 | AA |
| Interaction | 7 | AA |
| Infrastructure | 2 targets | n/a |

For the full mapping of criteria to files and commits, see [WCAG_COMPLIANCE_MATRIX.md](./WCAG_COMPLIANCE_MATRIX.md).

---

## B. Architecture Patterns

### 1. Accessible Icons

**WCAG 1.1.1 — Non-text Content**

Icons in Superset fall into two categories: **functional** (convey meaning or are clickable) and **decorative** (purely visual, next to text labels).

#### Functional Icons (need accessible name)

```tsx
// Icon button with aria-label — user hears "Fullscreen"
<Button
  aria-label={t('Fullscreen')}
  onClick={toggleFullscreen}
>
  <Icons.FullscreenExitOutlined />
</Button>
```

#### Decorative Icons (hidden from screen readers)

```tsx
// Icon next to visible text — screen reader skips the icon
<Icons.SaveOutlined aria-hidden="true" />
<span>{t('Save')}</span>
```

#### How BaseIcon handles this automatically

The `BaseIcon` component in `superset-ui-core` detects `aria-hidden` and adjusts behavior:

```tsx
// From BaseIcon.tsx
const isDecorative = rest?.['aria-hidden'] === true || rest?.['aria-hidden'] === 'true';
const whatRole = isDecorative ? 'presentation' : (rest?.onClick ? 'button' : 'img');
const ariaLabel = isDecorative ? undefined : genAriaLabel(fileName || '');
```

**Rule:** If the icon is next to a visible text label, add `aria-hidden="true"`. If the icon is the only content of a button or link, ensure the parent has an `aria-label`.

---

### 2. Toggle States

**WCAG 1.3.3 — Sensory Characteristics**

Toggle buttons must expose their state programmatically, not just visually.

#### aria-pressed for on/off toggles

```tsx
// Dashboard edit mode toggle
<Button
  aria-label={t('Edit dashboard')}
  aria-pressed={editMode}
  onClick={toggleEditMode}
>
  {t('Edit dashboard')}
</Button>
```

#### aria-expanded for collapsible sections

```tsx
// Filter bar collapse/expand
<Button
  aria-label={isCollapsed ? t('Expand filter bar') : t('Collapse filter bar')}
  aria-expanded={!isCollapsed}
  onClick={toggleFilterBar}
>
  <Icons.FilterOutlined />
</Button>
```

**Rule:** Use `aria-pressed` for toggles (on/off). Use `aria-expanded` for sections that show/hide content. Always include a descriptive `aria-label`.

---

### 3. Color-Independent Indicators

**WCAG 1.4.1 — Use of Color**

Never use color as the sole means of conveying information. Always provide a secondary indicator.

#### Distinct shapes per status

```tsx
// AlertStatusIcon — each status has a unique icon shape
const iconConfig = {
  Success: <Icons.CheckCircleOutlined />,   // checkmark circle
  Error:   <Icons.CloseCircleOutlined />,   // X circle
  Working: <Icons.LoadingOutlined />,       // spinner
  Noop:    <Icons.ClockCircleOutlined />,   // clock
  Grace:   <Icons.ExclamationCircleOutlined />, // exclamation
};
```

#### Text prefixes for error states

```tsx
// Error message with text prefix, not just red color
<span>
  <strong>{t('Error:')}</strong> {errorMessage}
</span>
```

**Rule:** Status indicators need both color AND shape/text. Error messages need an "Error:" prefix or icon in addition to color.

---

### 4. Form Error Handling

**WCAG 3.3.1 — Error Identification, WCAG 3.3.3 — Error Suggestion**

Form errors must be programmatically linked to their inputs and include helpful correction hints.

#### Linking errors to inputs

```tsx
// TextControl with aria-invalid and aria-describedby
<input
  aria-label={this.props.label}
  aria-invalid={hasErrors || undefined}
  aria-describedby={errorId}
  id={this.props.controlId || this.props.name}
/>
{hasErrors && (
  <span
    id={errorId}
    role="alert"
    className="text-danger"
  >
    {validationErrors.join(', ')}
  </span>
)}
```

#### Error containers with role="alert"

```tsx
// Alert component with ARIA live region
<AntdAlert
  role="alert"
  aria-atomic="true"
  aria-live={type === 'error' ? 'assertive' : 'polite'}
  type={type}
  message={message}
/>
```

#### Error messages with correction hints (WCAG 3.3.3)

```tsx
// Bad: generic error
"Invalid input"

// Good: error with suggestion
"Password must be at least 8 characters. Include letters and numbers."
"Email format: name@example.com"
"SSH port must be a number between 1 and 65535 (e.g. 22)"
```

**Rules:**
- Every validated input needs `aria-invalid` (true when error present, undefined otherwise)
- Every error message element needs an `id` matching the input's `aria-describedby`
- Error containers use `role="alert"` with `aria-atomic="true"`
- Use `aria-live="assertive"` for errors, `"polite"` for warnings/info/success
- Error text must suggest how to fix the problem

---

### 5. Text Sizing

**WCAG 1.4.4 — Resize Text**

Text must remain readable and functional at 200% zoom without loss of content.

#### Use theme tokens instead of hardcoded pixels

```tsx
// Bad: hardcoded pixel size
font-size: 12px;
height: 24px;
line-height: 18px;

// Good: theme tokens and flexible sizing
font-size: ${theme.fontSizeSM}px;     // resolves to 12px but scales with theme
min-height: 24px;                      // min instead of fixed
line-height: 1.5;                      // unitless — scales with font-size
```

#### Available theme tokens

| Token | Default | Use for |
|-------|---------|---------|
| `theme.fontSizeSM` | 12 | Small/secondary text |
| `theme.fontSize` | 14 | Body text (default) |
| `theme.fontSizeLG` | 16 | Emphasized text |
| `theme.fontSizeXL` | 22 | Headings, large icons |

**Rules:**
- Never use hardcoded `font-size` in pixels — use theme tokens
- Use `min-height` instead of `height` for text containers
- Use unitless `line-height` values (1, 1.2, 1.5) — they scale with font-size
- Ensure containers use `flex-wrap` to accommodate text expansion at zoom

---

### 6. Accessible Charts (ECharts)

**WCAG 1.4.5 — Images of Text, WCAG 1.1.1 — Non-text Content**

Charts use SVGRenderer for accessible text and the ECharts aria module for screen reader descriptions.

#### SVGRenderer for text accessibility

```tsx
// Echart.tsx — SVGRenderer instead of CanvasRenderer
import { SVGRenderer } from 'echarts/renderers';
import { AriaComponent } from 'echarts/components';

use([
  SVGRenderer,    // Text renders as real DOM elements, not canvas pixels
  AriaComponent,  // Generates data descriptions for screen readers
  BarChart,
  // ... other chart types
]);
```

#### ECharts aria module for data descriptions

```tsx
// Automatically generates screen-reader descriptions from chart data
const ariaOptions = {
  aria: {
    enabled: true,
    decal: { show: false }, // visual patterns handled separately
    label: {
      enabled: true,
      description: echartOptions.title?.text || 'Chart data',
    },
  },
};
```

#### Chart container accessibility

```tsx
// Chart component wraps visualization with role and label
<div
  role="img"
  aria-label={`${chartName} — ${vizType} visualization`}
>
  {/* ECharts renders here */}
</div>
```

**Rules:**
- Always use `SVGRenderer` (never `CanvasRenderer`) for new chart plugins
- Include `AriaComponent` in the `use()` registration
- Chart containers need `role="img"` and `aria-label`
- Provide a meaningful `aria.label.description` from chart title

---

### 7. Responsive Layout (Reflow)

**WCAG 1.4.10 — Reflow**

Content must reflow without horizontal scrolling at 320px viewport width (equivalent to 400% zoom at 1280px).

#### Media query pattern

```css
/* Dashboard filter sidebar — collapses at narrow viewports */
@media (max-width: 768px) {
  display: none;
}

/* Dashboard content — takes full width when sidebar collapses */
@media (max-width: 768px) {
  max-width: 100vw;
}
```

#### Navigation wrapping

```css
/* SubMenu items wrap at narrow viewports */
@media (max-width: 480px) {
  flex-wrap: wrap;
}
```

#### Modals at narrow viewports

```css
/* Modals go full-width on small screens */
@media (max-width: 768px) {
  .ant-modal {
    max-width: 100vw;
    margin: 0;
  }
}
```

**Rules:**
- Test at 320px viewport width — no horizontal scrollbar
- Sidebar navigation should collapse or stack above content
- Modals should go full-width on narrow screens
- Use `flex-wrap: wrap` for navigation items and toolbars
- Never set a fixed `width` that would cause overflow — use `max-width` with `100%` or `100vw`

---

### 8. Focus Management

**WCAG 2.4.7 — Focus Visible, WCAG 1.4.11 — Non-text Contrast**

Every interactive element must have a visible focus indicator with at least 3:1 contrast ratio.

#### Global baseline (already applied)

```tsx
// GlobalStyles.tsx — applies to all interactive elements
*:focus-visible {
  outline: 2px solid ${theme.colorPrimary};
  outline-offset: 2px;
}
```

#### Component-level override when needed

```tsx
// When the global outline doesn't work well (e.g., on dark backgrounds)
const FocusableItem = styled.div`
  &:focus-visible {
    box-shadow: 0 0 0 2px ${theme.colorPrimary};
    outline: none;
  }
`;
```

#### Never remove focus indicators

```tsx
// Bad: removes focus indicator entirely
outline: none;

// Good: transparent outline that :focus-visible overrides
outline: 2px solid transparent;
```

**Rules:**
- Never add `outline: none` without a replacement focus style
- Use `:focus-visible` (not `:focus`) to avoid showing focus rings on mouse click
- Focus indicators need at least 3:1 contrast against the background
- The global `*:focus-visible` in GlobalStyles provides a baseline — override per component only when necessary

---

### 9. Navigation Consistency

**WCAG 3.2.3 — Consistent Navigation, WCAG 3.1.2 — Language of Parts**

Navigation landmarks must be labeled and the page language must be set programmatically.

#### Labeled navigation landmarks

```tsx
// Primary navigation — always has the same aria-label
<nav aria-label={t('Main navigation')}>
  {/* ... menu items */}
</nav>

// Secondary page navigation
<nav aria-label={t('Page navigation')}>
  {/* ... sub-menu items */}
</nav>
```

#### Document language

```tsx
// App.tsx — set from bootstrapData locale
useEffect(() => {
  const locale = bootstrapData?.common?.locale || 'en';
  document.documentElement.lang = locale;
}, [bootstrapData]);
```

**Rules:**
- Every `<nav>` element needs a unique `aria-label`
- Navigation order must remain consistent across pages
- Document `lang` attribute must be set from the application locale

---

## C. Testing Guide

### Automated Tests

Run all accessibility-specific tests:

```bash
# Run all a11y tests (axe-core page tests + component tests)
cd superset-frontend
npx jest --testPathPattern="a11y" --no-cache

# Run only the regression test suite
npx jest src/a11y-regression.test.tsx --no-cache

# Run a specific page's a11y test
npx jest src/pages/Dashboard/Dashboard.a11y.test.tsx --no-cache
```

### Test Helper

The shared test helper at `spec/helpers/a11yTestHelper.tsx` provides:
- Pre-configured axe-core with WCAG 2.1 A+AA ruleset
- Helper function to run axe against rendered components
- Standard configuration for common Superset test scenarios

### Manual Testing Resources

- **Screenreader Test Protocol:** [`docs/screenreader-test-protocol.md`](./screenreader-test-protocol.md)
- **Cross-browser Test Matrix:** [`docs/cross-browser-test-matrix.md`](./cross-browser-test-matrix.md)
- **axe-core Test Report:** [`docs/a11y-test-report.md`](./a11y-test-report.md)

### Quick Manual Checks

1. **Tab through the page** — can you reach every interactive element?
2. **Check focus visibility** — is there a visible outline on the focused element?
3. **Zoom to 200%** — does text reflow without horizontal scrolling?
4. **Zoom to 400%** (or resize to 320px) — is content still usable?
5. **Turn off CSS colors** — can you still distinguish status indicators?
6. **Test with a screen reader** — are icons, charts, and errors announced?

---

## D. Adding New Components — Accessibility Checklist

Use this checklist when creating or modifying any UI component:

### Interactive Elements
- [ ] All buttons have visible text OR `aria-label`
- [ ] All icon-only buttons have `aria-label`
- [ ] Decorative icons have `aria-hidden="true"`
- [ ] Toggle buttons have `aria-pressed` or `aria-expanded`
- [ ] Links have descriptive text (not "click here")

### Forms
- [ ] All inputs have associated `<label>` or `aria-label`
- [ ] Error messages are linked via `aria-describedby`
- [ ] Invalid inputs have `aria-invalid="true"`
- [ ] Error containers have `role="alert"` and `aria-atomic="true"`
- [ ] Error messages suggest how to fix the problem
- [ ] Relevant inputs have `autoComplete` attribute

### Visual
- [ ] No hardcoded pixel font sizes — use theme tokens
- [ ] Status indicators use shape/text in addition to color
- [ ] Non-text UI components have at least 3:1 contrast ratio
- [ ] Focus indicators have at least 3:1 contrast ratio
- [ ] Content reflows at 320px without horizontal scrollbar

### Structure
- [ ] Page has a meaningful `<h1>` heading
- [ ] Heading hierarchy is logical (h1 > h2 > h3, no skips)
- [ ] Navigation landmarks have unique `aria-label`

### Charts
- [ ] Uses `SVGRenderer` (not `CanvasRenderer`)
- [ ] Chart container has `role="img"` and `aria-label`
- [ ] `AriaComponent` is registered in `use()`
- [ ] Hover/tooltip content is dismissable with Escape

### Testing
- [ ] Component tests verify ARIA attributes
- [ ] Run axe-core against rendered output
- [ ] Test keyboard navigation (Tab, Enter, Space, Escape)
- [ ] Test with screen reader (NVDA or VoiceOver)
- [ ] Test at 200% and 400% zoom levels
