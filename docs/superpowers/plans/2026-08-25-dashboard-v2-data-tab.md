# Dashboard V2 Data Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a fourth tab, "Data", to the Dashboard V2 editor's left rail — a static, mock-data browser for datasets and their columns — and rename the existing "Widgets" tab to "Building Blocks", with no backend calls or widget-binding changes.

**Architecture:** A new self-contained `DataPanel.tsx` component (styled and structured like its siblings `Palette.tsx`/`Outline.tsx`: a search input over a hardcoded in-memory list, expandable rows) gets built and unit-tested on its own in Task 1, then wired into `EditorPanel.tsx`'s existing `Tabs` in Task 2, which also fixes the panel's selection-follow logic so it generalizes correctly to the new tab.

**Tech Stack:** React + TypeScript, `@apache-superset/core/theme` (styled/css), antd components via `@superset-ui/core/components`, `ColumnTypeLabel` from `@superset-ui/chart-controls`, Jest + React Testing Library.

**Spec:** [docs/superpowers/specs/2026-08-25-dashboard-v2-mockup-alignment-design.md](../specs/2026-08-25-dashboard-v2-mockup-alignment-design.md) (PR 1 section)

## Global Constraints

- No network/API calls in this PR — `DataPanel` renders a hardcoded, in-memory dataset list only.
- No changes to any widget's `dataBinding` or to `DashboardProvider` — the Data tab does not select, bind, or drag anything onto the canvas.
- Do not touch the Assistant/chat panel (`src/core/chat/ChatHost.tsx`) or anything it depends on.
- Column type icons must use `ColumnTypeLabel` from `@superset-ui/chart-controls` (the same component `schemaControlRenderers.tsx` already uses), not a new icon scheme.
- Tests use flat `test()` calls, not `describe()` blocks (matches every existing test file in this directory).
- All user-facing strings go through `t()` from `@apache-superset/core/translation`.

---

## File Structure

- **Create** `superset-frontend/src/pages/DashboardBuilderV2/DataPanel.tsx` — the Data tab's content: search input + hardcoded dataset list with expandable columns. No props; no dependency on `provider`/`DashboardProvider` at all.
- **Create** `superset-frontend/src/pages/DashboardBuilderV2/DataPanel.test.tsx` — unit tests for the component in isolation.
- **Modify** `superset-frontend/src/pages/DashboardBuilderV2/EditorPanel.tsx` — add the `data` tab (first in order), rename the `widgets` tab's label, generalize the selection-follow condition.
- **Modify** `superset-frontend/src/pages/DashboardBuilderV2/EditorPanel.test.tsx` — update the three assertions that hardcode the old "Widgets" label, add tab-order and selection-follow-from-Data coverage.

---

## Task 1: `DataPanel` component

**Files:**
- Create: `superset-frontend/src/pages/DashboardBuilderV2/DataPanel.tsx`
- Test: `superset-frontend/src/pages/DashboardBuilderV2/DataPanel.test.tsx`

**Interfaces:**
- Produces: `export default function DataPanel(): ReactElement` — zero props, self-contained. Task 2 renders it as `<DataPanel />` with no wiring.

- [ ] **Step 1: Write the failing tests**

Create `superset-frontend/src/pages/DashboardBuilderV2/DataPanel.test.tsx`:

```tsx
/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import userEvent from '@testing-library/user-event';
import { render, screen } from 'spec/helpers/testing-library';
import DataPanel from './DataPanel';

const mount = () => render(<DataPanel />);

test('lists the placeholder datasets, collapsed by default', () => {
  mount();

  expect(screen.getByTestId('data-panel-dataset-sales')).toBeVisible();
  expect(screen.getByTestId('data-panel-dataset-coffee_sales')).toBeVisible();
  expect(
    screen.queryByTestId('data-panel-columns-sales'),
  ).not.toBeInTheDocument();
});

test('expanding a dataset shows its columns', async () => {
  mount();

  await userEvent.click(screen.getByTestId('data-panel-dataset-sales'));

  const columns = screen.getByTestId('data-panel-columns-sales');
  expect(columns).toHaveTextContent('order_id');
  expect(columns).toHaveTextContent('order_date');
  expect(columns).toHaveTextContent('sales_amount');
  expect(columns).toHaveTextContent('region');
});

test('a second click collapses it again', async () => {
  mount();
  const row = screen.getByTestId('data-panel-dataset-sales');

  await userEvent.click(row);
  await userEvent.click(row);

  expect(
    screen.queryByTestId('data-panel-columns-sales'),
  ).not.toBeInTheDocument();
});

test('searching narrows the list to matching dataset names', async () => {
  mount();

  await userEvent.type(screen.getByTestId('data-panel-search'), 'coffee');

  expect(
    screen.getByTestId('data-panel-dataset-coffee_sales'),
  ).toBeVisible();
  expect(
    screen.queryByTestId('data-panel-dataset-sales'),
  ).not.toBeInTheDocument();
});

test('a search with no matches says so', async () => {
  mount();

  await userEvent.type(screen.getByTestId('data-panel-search'), 'nope');

  expect(screen.getByTestId('data-panel-empty')).toBeVisible();
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test -- DataPanel.test.tsx`
Expected: FAIL — `Cannot find module './DataPanel'` (the file doesn't exist yet).

- [ ] **Step 3: Implement `DataPanel.tsx`**

Create `superset-frontend/src/pages/DashboardBuilderV2/DataPanel.tsx`:

```tsx
/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import { useState } from 'react';
import type { ReactElement } from 'react';
import { t } from '@apache-superset/core/translation';
import { css, styled } from '@apache-superset/core/theme';
import { GenericDataType } from '@apache-superset/core/common';
import { EmptyState, Input } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import { ColumnTypeLabel } from '@superset-ui/chart-controls';

interface MockColumn {
  readonly name: string;
  readonly type: GenericDataType;
}

interface MockDataset {
  readonly id: string;
  readonly name: string;
  readonly columns: readonly MockColumn[];
}

/**
 * Static placeholder rows. The Data tab does not call the dataset API —
 * a later change wires this list, and each dataset's columns, to
 * `/api/v1/dataset/`, the same endpoint `datasetMetadata.ts` already reads a
 * single bound dataset's columns from.
 */
const MOCK_DATASETS: readonly MockDataset[] = [
  {
    id: 'sales',
    name: 'sales',
    columns: [
      { name: 'order_id', type: GenericDataType.String },
      { name: 'order_date', type: GenericDataType.Temporal },
      { name: 'sales_amount', type: GenericDataType.Numeric },
      { name: 'region', type: GenericDataType.String },
    ],
  },
  {
    id: 'coffee_sales',
    name: 'coffee_sales',
    columns: [
      { name: 'product', type: GenericDataType.String },
      { name: 'roast_date', type: GenericDataType.Temporal },
      { name: 'unit_price', type: GenericDataType.Numeric },
      { name: 'is_decaf', type: GenericDataType.Boolean },
    ],
  },
];

const matches = (dataset: MockDataset, query: string): boolean =>
  query.trim() === '' ||
  dataset.name.toLowerCase().includes(query.trim().toLowerCase());

/**
 * The panel's own scroll column, set down from the tab bar and in from the
 * panel edge — the same step `Palette`'s `Column` and `Outline`'s `Panel`
 * take from theirs, so the four tabs of one rail start on one line.
 */
const Column = styled.div`
  ${({ theme }) => css`
    display: flex;
    flex-direction: column;
    gap: ${theme.sizeUnit * 5}px;
    min-height: 0;
    padding: ${theme.sizeUnit * 3}px ${theme.sizeUnit}px 0;
  `}
`;

const List = styled.div`
  ${({ theme }) => css`
    display: flex;
    flex-direction: column;
    gap: ${theme.sizeUnit}px;
    overflow-y: auto;
    min-height: 0;
  `}
`;

const DatasetButton = styled.button`
  ${({ theme }) => css`
    display: flex;
    align-items: center;
    gap: ${theme.sizeUnit * 2}px;
    width: 100%;
    padding: ${theme.sizeUnit * 2}px;
    border: 1px solid ${theme.colorBorder};
    border-radius: ${theme.borderRadiusSM}px;
    background-color: ${theme.colorFillQuaternary};
    color: ${theme.colorText};
    font-size: ${theme.fontSizeSM}px;
    text-align: left;
    cursor: pointer;
    transition: background-color ${theme.motionDurationMid};

    .data-panel-chevron {
      display: flex;
      flex: 0 0 auto;
      color: ${theme.colorTextTertiary};
    }

    &:hover {
      background-color: ${theme.colorFillTertiary};
    }

    &:focus-visible {
      outline: 2px solid ${theme.colorPrimaryBorder};
      outline-offset: -2px;
    }
  `}
`;

const ColumnList = styled.div`
  ${({ theme }) => css`
    display: flex;
    flex-direction: column;
    gap: ${theme.sizeUnit}px;
    margin-top: ${theme.sizeUnit}px;
    margin-left: ${theme.sizeUnit * 2}px;
    padding-left: ${theme.sizeUnit * 3}px;
    border-left: 1px solid ${theme.colorBorder};
  `}
`;

const ColumnRow = styled.div`
  ${({ theme }) => css`
    display: flex;
    align-items: center;
    gap: ${theme.sizeUnit * 2}px;
    padding: ${theme.sizeUnit}px ${theme.sizeUnit * 2}px;
    font-size: ${theme.fontSizeSM}px;
    color: ${theme.colorText};
  `}
`;

/**
 * Datasets and their columns, to browse rather than to place.
 *
 * Building Blocks places widgets onto the canvas; this tab answers "what
 * data is there to use" without touching any widget's binding — expanding a
 * row reads its columns and nothing else happens.
 */
export default function DataPanel(): ReactElement {
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());

  const found = MOCK_DATASETS.filter(dataset => matches(dataset, query));

  const toggle = (id: string): void =>
    setExpanded(previous => {
      const next = new Set(previous);
      if (!next.delete(id)) {
        next.add(id);
      }
      return next;
    });

  return (
    <Column data-test="data-panel">
      <Input
        allowClear
        value={query}
        aria-label={t('Search datasets')}
        placeholder={t('Search datasets…')}
        data-test="data-panel-search"
        prefix={<Icons.SearchOutlined iconSize="s" />}
        onChange={event => setQuery(event.target.value)}
      />
      {found.length === 0 ? (
        <div data-test="data-panel-empty">
          <EmptyState
            size="small"
            image="filter-results.svg"
            title={t('No matching datasets')}
            description={t('Nothing here is called “%s”.', query)}
          />
        </div>
      ) : (
        <List>
          {found.map(dataset => {
            const isOpen = expanded.has(dataset.id);
            return (
              <div
                key={dataset.id}
                data-test={`data-panel-dataset-${dataset.id}`}
              >
                <DatasetButton
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => toggle(dataset.id)}
                >
                  <span className="data-panel-chevron" aria-hidden>
                    {isOpen ? (
                      <Icons.UpOutlined iconSize="s" />
                    ) : (
                      <Icons.DownOutlined iconSize="s" />
                    )}
                  </span>
                  {dataset.name}
                </DatasetButton>
                {isOpen && (
                  <ColumnList data-test={`data-panel-columns-${dataset.id}`}>
                    {dataset.columns.map(column => (
                      <ColumnRow key={column.name}>
                        <ColumnTypeLabel type={column.type} />
                        {column.name}
                      </ColumnRow>
                    ))}
                  </ColumnList>
                )}
              </div>
            );
          })}
        </List>
      )}
    </Column>
  );
}
```

Note: `data-panel-dataset-${dataset.id}` is on the wrapping `<div>`, not the
`<button>` — the test's `toBeVisible()`/click target is the same element
either way here since the div has no independent styling, but clicking must
go through `userEvent.click` on that testid, which dispatches to whatever is
at that DOM node (the div passes the click through to its child button
because it's not `pointer-events: none`, but to keep this unambiguous the
click handler is what matters, not which element wraps it) — see Step 4.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test -- DataPanel.test.tsx`
Expected: PASS, all 5 tests.

If the click tests fail because `userEvent.click` on the wrapping `<div>`
testid doesn't reach the `<button>`'s `onClick`: change the test to click
`screen.getByRole('button', { name: /sales/i })` scoped within
`screen.getByTestId('data-panel-dataset-sales')` instead, e.g.:

```tsx
const row = screen.getByTestId('data-panel-dataset-sales');
await userEvent.click(within(row).getByRole('button'));
```

(`within` from `spec/helpers/testing-library`, matching the pattern already
used elsewhere in this directory's tests.)

- [ ] **Step 5: Commit**

```bash
git add superset-frontend/src/pages/DashboardBuilderV2/DataPanel.tsx superset-frontend/src/pages/DashboardBuilderV2/DataPanel.test.tsx
git commit -m "feat(dashboard-v2): add placeholder Data panel with mock datasets"
```

---

## Task 2: Wire the Data tab into `EditorPanel`, rename Widgets → Building Blocks

**Files:**
- Modify: `superset-frontend/src/pages/DashboardBuilderV2/EditorPanel.tsx`
- Modify: `superset-frontend/src/pages/DashboardBuilderV2/EditorPanel.test.tsx`

**Interfaces:**
- Consumes: `DataPanel` (default export, zero props) from Task 1.
- Produces: no new exports — `EditorPanel`'s own props (`{ onAdd: (type: string) => void }`) are unchanged.

- [ ] **Step 1: Write the failing tests**

In `superset-frontend/src/pages/DashboardBuilderV2/EditorPanel.test.tsx`,
replace the existing tab-presence test (currently at the top, right after
`mount`) with one that expects all four tabs under their new names, and add
two new tests. The three edits:

Replace:

```tsx
test('the panel offers widgets, properties and an outline', () => {
  mount();

  expect(screen.getByRole('tab', { name: 'Widgets' })).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: 'Properties' })).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: 'Outline' })).toBeInTheDocument();
});
```

with:

```tsx
test('the panel offers data, building blocks, properties and an outline', () => {
  mount();

  expect(screen.getByRole('tab', { name: 'Data' })).toBeInTheDocument();
  expect(
    screen.getByRole('tab', { name: 'Building Blocks' }),
  ).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: 'Properties' })).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: 'Outline' })).toBeInTheDocument();
});

test('data comes first, ahead of building blocks, properties and outline', () => {
  mount();

  const labels = screen.getAllByRole('tab').map(tab => tab.textContent);
  expect(labels).toEqual(['Data', 'Building Blocks', 'Properties', 'Outline']);
});

test('the data tab shows the placeholder dataset browser', async () => {
  mount();

  await userEvent.click(screen.getByRole('tab', { name: 'Data' }));

  expect(screen.getByTestId('data-panel')).toBeVisible();
});

test('selecting something while browsing data brings its properties forward too', () => {
  mount();
  const id = provider.addWidget(provider.getRoot().id, 0, {
    type: 'markdown',
  });

  act(() => provider.setSelection(id));

  // Outline is the one tab that sets its own selection and must not be
  // ejected from; every other tab — including the new Data tab — follows a
  // selection made elsewhere the same way Widgets already does.
  expect(screen.getByTestId('inspector-identity')).toHaveTextContent(id);
});
```

Then find the two existing assertions in the panel-collapse test that name
`'Widgets'` and change them to `'Building Blocks'`:

```tsx
  expect(screen.queryByRole('tab', { name: 'Widgets' })).toBeNull();
  expect(screen.getByTestId('panel-expand')).toBeInTheDocument();

  await userEvent.click(screen.getByTestId('panel-expand'));

  expect(screen.getByRole('tab', { name: 'Widgets' })).toBeInTheDocument();
```

becomes:

```tsx
  expect(screen.queryByRole('tab', { name: 'Building Blocks' })).toBeNull();
  expect(screen.getByTestId('panel-expand')).toBeInTheDocument();

  await userEvent.click(screen.getByTestId('panel-expand'));

  expect(
    screen.getByRole('tab', { name: 'Building Blocks' }),
  ).toBeInTheDocument();
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test -- EditorPanel.test.tsx`
Expected: FAIL — the renamed/new assertions don't match anything yet (`EditorPanel.tsx` hasn't changed), and the two `'Widgets'` assertions in the collapse test now fail too since they were changed to expect `'Building Blocks'`.

- [ ] **Step 3: Implement the `EditorPanel.tsx` changes**

Add the import (alongside the existing `Inspector`/`Outline`/`Palette` imports):

```tsx
import DataPanel from './DataPanel';
```

Change the tab type:

```tsx
type PanelTab = 'data' | 'widgets' | 'properties' | 'outline';
```

Generalize the selection-follow condition — this file's own doc comment
already states the intended rule ("A selection made in the Outline is the
exception... every other route brings Properties forward"); today's
`tab === 'widgets'` check only implements that rule for one of the two
non-Outline tabs, which was invisible with three tabs but becomes a real gap
once Data is a second tab someone can be browsing when a selection changes
elsewhere:

```tsx
  const selection = provider.getSelection();
  const [shown, setShown] = useState(selection);
  if (selection !== shown) {
    setShown(selection);
    if (selection !== undefined && tab !== 'outline') {
      setTab('properties');
    }
  }
```

(Only the inner condition changes, from `tab === 'widgets'` to
`tab !== 'outline'`.)

Add the `data` tab first, and rename `widgets`'s label, in the `items` array:

```tsx
        items={[
          {
            key: 'data',
            label: t('Data'),
            children: <DataPanel />,
          },
          {
            key: 'widgets',
            label: t('Building Blocks'),
            children: <Palette onAdd={onAdd} />,
          },
          {
            key: 'properties',
            label: t('Properties'),
            children: <Inspector />,
          },
          {
            key: 'outline',
            label: t('Outline'),
            children: <Outline />,
          },
        ]}
```

Leave `useState<PanelTab>('widgets')` (the default active tab on mount)
unchanged — this PR adds Data to the tab bar without deciding it should also
become the tab an author lands on first; that's a product decision for a
later change, not an implementation default to slip in unannounced here.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test -- EditorPanel.test.tsx`
Expected: PASS, all tests including the four touched/added above.

- [ ] **Step 5: Run the full DashboardBuilderV2 test directory to check for collateral damage**

Run: `npm run test -- superset-frontend/src/pages/DashboardBuilderV2`
Expected: PASS. This directory's tests are the only place `'Widgets'` as a
tab name or `PanelTab` are referenced outside the two files just changed —
confirm nothing else (e.g. an `index.test.tsx` mounting the full page) also
hardcodes the old label.

- [ ] **Step 6: Commit**

```bash
git add superset-frontend/src/pages/DashboardBuilderV2/EditorPanel.tsx superset-frontend/src/pages/DashboardBuilderV2/EditorPanel.test.tsx
git commit -m "feat(dashboard-v2): add Data tab to editor panel, rename Widgets to Building Blocks"
```

---

## Plan self-review

- **Spec coverage:** tab rename (Task 2) ✓, new Data tab first in order (Task 2) ✓, mock search + expandable mock columns with `ColumnTypeLabel` icons (Task 1) ✓, no API calls/no dataBinding wiring/no drag-drop (both tasks — never introduced) ✓, tests following existing patterns (both tasks) ✓. No spec item lacks a task.
- **Placeholder scan:** no TBD/TODO; both components are fully written out above, not summarized.
- **Type consistency:** `DataPanel` is a zero-prop `() => ReactElement` in both Task 1's implementation and Task 2's usage (`<DataPanel />`, no props passed). `PanelTab` gains `'data'` in Task 2 and every `items` entry's `key` matches one of the four `PanelTab` union members.
