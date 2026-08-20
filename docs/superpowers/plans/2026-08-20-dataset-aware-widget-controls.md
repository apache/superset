# Dataset-Aware Widget Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the fields inside a Dashboard V2 widget's schema-driven control panel that reference a column or a metric on the widget's bound dataset (`dimensions`, `metrics`, `colorDimension`) render as dataset-aware pickers — with type icons and, for ordered fields, add/remove/drag — instead of plain text/JSON inputs.

**Architecture:** Extend the existing `x-control` vocabulary (`code`, `color`) in `schemaControlRenderers.tsx` with four new values (`column`, `column-multi`, `metric`, `metric-multi`), declared on the backend Pydantic control models exactly like the existing ones. A new frontend module fetches the bound dataset's columns/metrics on demand; the new renderers use it to populate pickers, reusing `ColumnTypeLabel` from `@superset-ui/chart-controls` for the type-icon treatment. Everything still reads/writes `node.props` through the existing `provider.updateProps` path.

**Tech Stack:** Python/Pydantic (backend control models), TypeScript/React, JsonForms (`@jsonforms/react`, `@jsonforms/core`), antd via `@superset-ui/core/components`, Jest + React Testing Library.

**Spec:** [docs/superpowers/specs/2026-08-20-dataset-aware-widget-controls-design.md](../specs/2026-08-20-dataset-aware-widget-controls-design.md)

## Global Constraints

- No `any` types in new/modified TypeScript — use `unknown` with narrowing casts instead (per CLAUDE.md's frontend modernization section).
- New Python code needs full type hints and must be mypy-clean.
- Prefer `@superset-ui/core/components` exports over importing `antd` directly for any new UI (per CLAUDE.md; `schemaControlRenderers.tsx` already follows this — `jsonFormsHelpers.tsx`'s raw `antd` import is pre-existing and out of scope to fix here).
- Run `pre-commit run --all-files` before pushing (non-negotiable per CLAUDE.md).
- New files need the standard ASF license header.
- Visualization-type swapping (changing an already-placed widget's `type`) is explicitly out of scope for this plan — see the spec's Scope section.

---

## File Structure

**Backend — modified:**
- `superset/widgets/controls.py` — add `x-control` extras to `DataBinding.dimensions`, `DataBinding.metrics`, and `BalloonsControls.color_dimension`.
- `tests/unit_tests/widgets/test_registry.py` — assert the new extras appear in the served schema.

**Frontend — new:**
- `superset-frontend/src/core/dashboard/datasetMetadata.ts` — fetches and caches a dataset's columns/metrics; exposes a `useDatasetMetadata` hook.
- `superset-frontend/src/core/dashboard/datasetMetadata.test.ts`
- `superset-frontend/src/pages/DashboardBuilderV2/schemaControlRenderers.test.tsx` — direct unit tests for the new pure helper functions.

**Frontend — modified:**
- `superset-frontend/src/pages/DashboardBuilderV2/schemaControlRenderers.tsx` — add `ColumnControl`, `ColumnMultiControl`, `MetricControl`, `MetricMultiControl` and their shared `ReferenceSelect`/`ReferenceMultiList` primitives; register all four in the exported `schemaControlRenderers` array.
- `superset-frontend/src/pages/DashboardBuilderV2/SchemaControlPanel.tsx` — thread the widget's full props into JsonForms via `config={{ formData: props }}` so a control can read sibling data (e.g. `dataBinding.datasetId`).
- `superset-frontend/src/pages/DashboardBuilderV2/SchemaControlPanel.test.tsx` — integration tests mounting the new controls end-to-end.

---

### Task 1: Backend — declare column/metric-reference `x-control` extras

**Files:**
- Modify: `superset/widgets/controls.py:49-69` (`DataBinding.metrics`, `DataBinding.dimensions`), `superset/widgets/controls.py:205-224` (`BalloonsControls.color_dimension`)
- Test: `tests/unit_tests/widgets/test_registry.py`

**Interfaces:**
- Consumes: nothing new (uses existing `Field(json_schema_extra=...)` pattern already used for `x-control: "code"`/`"color"` in this file).
- Produces: the served control schema for every widget using `DataBinding` (`metric-tile`, `ag-grid-table`, `balloons`, `echarts`) now carries `dimensions["x-control"] == "column-multi"` and `metrics["x-control"] == "metric-multi"`; `balloons`' `colorDimension["x-control"] == "column"`. Frontend Tasks 3–5 tester functions match on these exact string values.

- [ ] **Step 1: Write the failing tests**

Add to `tests/unit_tests/widgets/test_registry.py`:

```python
def test_data_binding_declares_column_and_metric_controls() -> None:
    schema = _block("balloons").get_control_schema(None, None)
    data_binding_props = schema["$defs"]["DataBinding"]["properties"]
    assert data_binding_props["dimensions"]["x-control"] == "column-multi"
    assert data_binding_props["metrics"]["x-control"] == "metric-multi"


def test_color_dimension_declares_column_control() -> None:
    schema = _block("balloons").get_control_schema(None, None)
    assert schema["properties"]["colorDimension"]["x-control"] == "column"
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pytest tests/unit_tests/widgets/test_registry.py -v -k "declares_column_and_metric_controls or declares_column_control"`
Expected: FAIL — `KeyError: 'x-control'` (the extra doesn't exist yet).

- [ ] **Step 3: Add the extras in `superset/widgets/controls.py`**

Change `DataBinding.metrics` (currently `json_schema_extra={"x-control": "code", "x-language": "json"}`) to:

```python
    metrics: list[Any] = Field(
        title="Metrics",
        description=(
            "Metrics to fetch. Each entry is EITHER a string naming a saved "
            'metric on the dataset (e.g. "count"), OR an ad-hoc aggregate '
            "object of the shape "
            '{"expressionType": "SIMPLE", "column": {"column_name": "<col>"}, '
            '"aggregate": "SUM"|"AVG"|"COUNT"|"COUNT_DISTINCT"|"MIN"|"MAX", '
            '"label": "<optional display label>"}. Do not pass a raw SQL string '
            'like "SUM(sales)" — a plain string is looked up as a saved-metric '
            "name, not evaluated as an expression."
        ),
        # A saved-metric name renders as a picker over the dataset's metrics;
        # an ad-hoc object falls back to the raw JSON editor (see
        # `MetricMultiControl` on the frontend).
        json_schema_extra={"x-control": "metric-multi", "x-language": "json"},
    )
```

Change `DataBinding.dimensions` (currently no `json_schema_extra`) to:

```python
    dimensions: list[str] = Field(
        default_factory=list,
        title="Dimensions",
        description="Columns to group by (the categories / series).",
        json_schema_extra={"x-control": "column-multi"},
    )
```

In `BalloonsControls`, add `json_schema_extra={"x-control": "column"}` to `color_dimension`:

```python
    color_dimension: str = Field(
        default="",
        alias="colorDimension",
        title="Color dimension",
        description=(
            "Which grouping dimension colors the balloons — its distinct values "
            "become the customizable series. The value MUST be one of "
            "`dataBinding.dimensions`; if the dimension you want to color by "
            "isn't grouped yet, add it to `dimensions` as well (it is not enough "
            "to name it here). Leave empty to color by the last dimension. "
            'E.g. to color by gender: set this to "gender" AND include "gender" '
            'in dimensions (e.g. dimensions ["name", "gender"]).'
        ),
        json_schema_extra={"x-control": "column"},
    )
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pytest tests/unit_tests/widgets/test_registry.py -v`
Expected: PASS (all tests in the file, including the two new ones and the pre-existing ones — `test_get_control_schema_base_shape` still checks `properties`/`required`/`$defs` keys only, unaffected by the new extras).

- [ ] **Step 5: Run mypy on the changed file**

Run: `pre-commit run mypy --files superset/widgets/controls.py`
Expected: PASS (no type changes — `json_schema_extra` already accepts an arbitrary dict).

- [ ] **Step 6: Commit**

```bash
git add superset/widgets/controls.py tests/unit_tests/widgets/test_registry.py
git commit -m "feat(widgets): declare column/metric x-control extras on shared fields"
```

---

### Task 2: Frontend — dataset metadata fetch and hook

**Files:**
- Create: `superset-frontend/src/core/dashboard/datasetMetadata.ts`
- Test: `superset-frontend/src/core/dashboard/datasetMetadata.test.ts`

**Interfaces:**
- Consumes: `SupersetClient` from `@superset-ui/core`; `GenericDataType` from `@apache-superset/core/common`.
- Produces (for Tasks 3–5):
  - `interface DatasetColumnMeta { name: string; type: GenericDataType | null }`
  - `interface DatasetMetricMeta { name: string; verboseName: string }`
  - `interface DatasetMetadata { columns: DatasetColumnMeta[]; metrics: DatasetMetricMeta[] }`
  - `function fetchDatasetMetadata(datasetId: number): Promise<DatasetMetadata>`
  - `function resetDatasetMetadataCacheForTests(): void`
  - `interface DatasetMetadataState { metadata: DatasetMetadata | null; loading: boolean; error: string | null }`
  - `function useDatasetMetadata(datasetId: number | undefined): DatasetMetadataState`

- [ ] **Step 1: Write the failing tests**

Create `superset-frontend/src/core/dashboard/datasetMetadata.test.ts`:

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
import { renderHook, waitFor } from '@testing-library/react';
import { SupersetClient } from '@superset-ui/core';
import {
  fetchDatasetMetadata,
  resetDatasetMetadataCacheForTests,
  useDatasetMetadata,
} from './datasetMetadata';

const getSpy = jest.spyOn(SupersetClient, 'get');

beforeEach(() => {
  resetDatasetMetadataCacheForTests();
  getSpy.mockReset();
});

test('parses columns and metrics from the dataset GET response', async () => {
  getSpy.mockResolvedValue({
    json: {
      result: {
        columns: [
          { column_name: 'region', type_generic: 1 },
          { column_name: 'sales_amount', type_generic: 0 },
        ],
        metrics: [{ metric_name: 'count', verbose_name: 'Count' }],
      },
    },
  } as never);

  const metadata = await fetchDatasetMetadata(1);

  expect(metadata.columns).toEqual([
    { name: 'region', type: 1 },
    { name: 'sales_amount', type: 0 },
  ]);
  expect(metadata.metrics).toEqual([{ name: 'count', verboseName: 'Count' }]);
  expect(getSpy).toHaveBeenCalledWith(
    expect.objectContaining({ endpoint: '/api/v1/dataset/1' }),
  );
});

test('falls back to metric_name when verbose_name is blank', async () => {
  getSpy.mockResolvedValue({
    json: { result: { metrics: [{ metric_name: 'count', verbose_name: '' }] } },
  } as never);

  const metadata = await fetchDatasetMetadata(2);

  expect(metadata.metrics).toEqual([{ name: 'count', verboseName: 'count' }]);
});

test('fetches only once per dataset id and caches the result', async () => {
  getSpy.mockResolvedValue({ json: { result: {} } } as never);

  await fetchDatasetMetadata(3);
  await fetchDatasetMetadata(3);

  expect(getSpy).toHaveBeenCalledTimes(1);
});

test('does not cache a failed fetch, so a retry can succeed', async () => {
  getSpy.mockRejectedValueOnce(new Error('boom'));
  getSpy.mockResolvedValueOnce({ json: { result: {} } } as never);

  await expect(fetchDatasetMetadata(4)).rejects.toThrow('boom');
  await expect(fetchDatasetMetadata(4)).resolves.toEqual({
    columns: [],
    metrics: [],
  });
  expect(getSpy).toHaveBeenCalledTimes(2);
});

test('useDatasetMetadata fails open to null metadata on error', async () => {
  getSpy.mockRejectedValue(new Error('boom'));

  const { result } = renderHook(() => useDatasetMetadata(5));

  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.metadata).toBeNull();
  expect(result.current.error).toBe('boom');
});

test('useDatasetMetadata returns the empty state when no dataset id is given', () => {
  const { result } = renderHook(() => useDatasetMetadata(undefined));

  expect(result.current).toEqual({
    metadata: null,
    loading: false,
    error: null,
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test -- src/core/dashboard/datasetMetadata.test.ts`
Expected: FAIL — `Cannot find module './datasetMetadata'`.

- [ ] **Step 3: Write the implementation**

Create `superset-frontend/src/core/dashboard/datasetMetadata.ts`:

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

/**
 * Column/metric metadata for the dataset a widget is bound to, used by the
 * column/metric-reference controls in `schemaControlRenderers.tsx`. Fetched
 * from the same `/api/v1/dataset/<id>` endpoint V1 Explore already uses —
 * no backend work needed for this.
 */
import { useEffect, useState } from 'react';
import { SupersetClient } from '@superset-ui/core';
import { GenericDataType } from '@apache-superset/core/common';

export interface DatasetColumnMeta {
  name: string;
  type: GenericDataType | null;
}

export interface DatasetMetricMeta {
  name: string;
  verboseName: string;
}

export interface DatasetMetadata {
  columns: DatasetColumnMeta[];
  metrics: DatasetMetricMeta[];
}

interface RawDatasetColumn {
  column_name: string;
  type_generic?: GenericDataType | null;
}

interface RawDatasetMetric {
  metric_name: string;
  verbose_name?: string | null;
}

interface RawDatasetResult {
  columns?: RawDatasetColumn[];
  metrics?: RawDatasetMetric[];
}

const cache = new Map<number, Promise<DatasetMetadata>>();

/**
 * Fetches a dataset's columns and metrics, cached per dataset id for the
 * lifetime of the page (the Inspector remounts controls on every selection
 * change; the underlying dataset rarely changes mid-edit).
 */
export function fetchDatasetMetadata(
  datasetId: number,
): Promise<DatasetMetadata> {
  const cached = cache.get(datasetId);
  if (cached) return cached;

  const promise = SupersetClient.get({
    endpoint: `/api/v1/dataset/${datasetId}`,
  })
    .then(({ json }) => {
      const result = (json as { result: RawDatasetResult }).result;
      return {
        columns: (result.columns ?? []).map(column => ({
          name: column.column_name,
          type: column.type_generic ?? null,
        })),
        metrics: (result.metrics ?? []).map(metric => ({
          name: metric.metric_name,
          verboseName: metric.verbose_name || metric.metric_name,
        })),
      };
    })
    .catch(error => {
      // Don't poison the cache with a transient failure — the next mount
      // should retry rather than fail open forever.
      cache.delete(datasetId);
      throw error;
    });

  cache.set(datasetId, promise);
  return promise;
}

/** Test-only: clears the module-level cache between test runs. */
export function resetDatasetMetadataCacheForTests(): void {
  cache.clear();
}

export interface DatasetMetadataState {
  metadata: DatasetMetadata | null;
  loading: boolean;
  error: string | null;
}

const EMPTY_STATE: DatasetMetadataState = {
  metadata: null,
  loading: false,
  error: null,
};

/**
 * React hook wrapping `fetchDatasetMetadata`. Fails open: a fetch error
 * leaves `metadata` `null` rather than throwing, so a control can fall back
 * to a plain input instead of blocking the panel.
 */
export function useDatasetMetadata(
  datasetId: number | undefined,
): DatasetMetadataState {
  const [state, setState] = useState<DatasetMetadataState>(EMPTY_STATE);

  useEffect(() => {
    if (!datasetId) {
      setState(EMPTY_STATE);
      return undefined;
    }
    let cancelled = false;
    setState({ metadata: null, loading: true, error: null });
    fetchDatasetMetadata(datasetId)
      .then(metadata => {
        if (!cancelled) setState({ metadata, loading: false, error: null });
      })
      .catch(error => {
        if (!cancelled) {
          setState({
            metadata: null,
            loading: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [datasetId]);

  return state;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test -- src/core/dashboard/datasetMetadata.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Type-check**

Run: `npm run type` (or `pre-commit run mypy` is backend-only; for frontend use the project's TS check script referenced in CLAUDE.md)
Expected: PASS — no `any`, all casts are `unknown`-based.

- [ ] **Step 6: Commit**

```bash
git add superset-frontend/src/core/dashboard/datasetMetadata.ts superset-frontend/src/core/dashboard/datasetMetadata.test.ts
git commit -m "feat(dashboard-v2): add dataset column/metric metadata fetch"
```

---

### Task 3: Frontend — column-reference controls (`x-control: "column"` / `"column-multi"`)

**Files:**
- Modify: `superset-frontend/src/pages/DashboardBuilderV2/SchemaControlPanel.tsx` (thread `config={{ formData: props }}` into `<JsonForms>`)
- Modify: `superset-frontend/src/pages/DashboardBuilderV2/schemaControlRenderers.tsx` (add primitives + column controls + registry entries)
- Create: `superset-frontend/src/pages/DashboardBuilderV2/schemaControlRenderers.test.tsx`
- Modify: `superset-frontend/src/pages/DashboardBuilderV2/SchemaControlPanel.test.tsx` (add integration tests)

**Interfaces:**
- Consumes: `useDatasetMetadata`, `DatasetMetadata` from Task 2's `src/core/dashboard/datasetMetadata`; `ColumnTypeLabel` from `@superset-ui/chart-controls`; `selectOption` from `spec/helpers/testing-library` (tests only).
- Produces (for Task 4): `ReferenceOption` type, `ReferenceSelect` and `ReferenceMultiList` components (file-local, reused by Metric controls in the same file), exported `columnOptions(metadata: DatasetMetadata | null, allowedTypes: string[] | undefined): ReferenceOption[]`, and the `useBoundDatasetId(props: ControlProps): number | undefined` helper.

- [ ] **Step 1: Write the failing unit tests for `columnOptions`**

Create `superset-frontend/src/pages/DashboardBuilderV2/schemaControlRenderers.test.tsx`:

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
import { columnOptions } from './schemaControlRenderers';

test('columnOptions filters by x-column-types when given', () => {
  const metadata = {
    columns: [
      { name: 'region', type: 1 },
      { name: 'sales', type: 0 },
    ],
    metrics: [],
  };
  expect(columnOptions(metadata, ['numeric']).map(o => o.value)).toEqual([
    'sales',
  ]);
});

test('columnOptions returns every column when no x-column-types hint is given', () => {
  const metadata = {
    columns: [
      { name: 'region', type: 1 },
      { name: 'sales', type: 0 },
    ],
    metrics: [],
  };
  expect(columnOptions(metadata, undefined).map(o => o.value)).toEqual([
    'region',
    'sales',
  ]);
});

test('columnOptions returns an empty list when metadata has not loaded yet', () => {
  expect(columnOptions(null, undefined)).toEqual([]);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test -- src/pages/DashboardBuilderV2/schemaControlRenderers.test.tsx`
Expected: FAIL — `columnOptions` is not exported yet.

- [ ] **Step 3: Thread form data into JsonForms**

In `SchemaControlPanel.tsx`, add one prop to the existing `<JsonForms>` call:

```tsx
          <JsonForms
            key={formKey}
            schema={schema}
            uischema={uiSchema}
            data={props}
            renderers={schemaControlRenderers}
            cells={cellRegistryEntries}
            validationMode="ValidateAndHide"
            // Column/metric-reference controls need the widget's
            // `dataBinding.datasetId`, which lives outside their own field —
            // `config.formData` is how a JsonForms control reaches sibling
            // data (mirrors `SemanticLayerModal`'s `config={{ formData }}`).
            config={{ formData: props }}
            onChange={({ data }) => {
```

(Everything after `onChange={({ data }) => {` is unchanged.)

- [ ] **Step 4: Implement `columnOptions` and the column controls in `schemaControlRenderers.tsx`**

Change the import block at the top of the file from:

```tsx
import { useState } from 'react';
import type { ChangeEvent } from 'react';
import { withJsonFormsControlProps } from '@jsonforms/react';
import type { ControlProps, JsonSchema } from '@jsonforms/core';
import { rankWith, schemaMatches } from '@jsonforms/core';
import { Flex, Typography } from '@superset-ui/core/components';
import { useTheme } from '@apache-superset/core/theme';
import { renderers as baseRenderers } from 'src/features/semanticLayers/jsonFormsHelpers';
```

to:

```tsx
import { useRef, useState } from 'react';
import type { ChangeEvent, ReactElement, ReactNode } from 'react';
import { withJsonFormsControlProps } from '@jsonforms/react';
import type { ControlProps, JsonSchema } from '@jsonforms/core';
import { rankWith, schemaMatches } from '@jsonforms/core';
import { t } from '@apache-superset/core/translation';
import {
  Button,
  Flex,
  Form,
  Select,
  Typography,
} from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import { ColumnTypeLabel } from '@superset-ui/chart-controls';
import { useTheme } from '@apache-superset/core/theme';
import { renderers as baseRenderers } from 'src/features/semanticLayers/jsonFormsHelpers';
import {
  useDatasetMetadata,
  type DatasetMetadata,
} from 'src/core/dashboard/datasetMetadata';
```

Then, after the `ColorControl` definition and before `export const schemaControlRenderers = [...]`, add:

```tsx
/**
 * The dataset id a column/metric-reference control resolves options
 * against. A JsonForms control only sees its own field's data by default —
 * the whole node's props reach it through `config.formData`, which
 * `SchemaControlPanel` populates for exactly this reason (mirroring
 * `SemanticLayerModal`'s own `config={{ formData }}`).
 */
function useBoundDatasetId(props: ControlProps): number | undefined {
  const formData = (
    props.config as { formData?: Record<string, unknown> } | undefined
  )?.formData;
  const dataBinding = formData?.dataBinding as
    | { datasetId?: number }
    | undefined;
  return dataBinding?.datasetId;
}

interface ReferenceOption {
  value: string;
  label: ReactNode;
}

const COLUMN_TYPE_BY_HINT: Record<string, number> = {
  numeric: 0,
  string: 1,
  temporal: 2,
  boolean: 3,
};

/**
 * Column options for a `column`/`column-multi` control, filtered by the
 * field's `x-column-types` hint (omitted means any column type).
 */
export function columnOptions(
  metadata: DatasetMetadata | null,
  allowedTypes: string[] | undefined,
): ReferenceOption[] {
  const allowed = allowedTypes?.map(hint => COLUMN_TYPE_BY_HINT[hint]);
  return (metadata?.columns ?? [])
    .filter(
      column =>
        !allowed || (column.type !== null && allowed.includes(column.type)),
    )
    .map(column => ({
      value: column.name,
      label: (
        <Flex align="center" gap="small">
          <ColumnTypeLabel type={column.type ?? undefined} />
          {column.name}
        </Flex>
      ),
    }));
}

/** A single reference value (column or metric), rendered as a Select. */
function ReferenceSelect({
  label,
  value,
  options,
  loading,
  disabled,
  onChange,
}: {
  label: string;
  value: string | undefined;
  options: ReferenceOption[];
  loading: boolean;
  disabled: boolean;
  onChange: (next: string | undefined) => void;
}): ReactElement {
  return (
    <Form.Item label={label}>
      <Select
        value={value}
        onChange={next => onChange((next as string | undefined) ?? undefined)}
        options={options}
        loading={loading}
        disabled={disabled}
        allowClear
        style={{ width: '100%' }}
      />
    </Form.Item>
  );
}

/**
 * An ordered list of reference values (columns or metrics): each entry can
 * be removed or dragged to reorder, and a trailing Select adds one more from
 * whatever isn't already picked.
 */
function ReferenceMultiList({
  label,
  values,
  options,
  loading,
  disabled,
  onChange,
}: {
  label: string;
  values: string[];
  options: ReferenceOption[];
  loading: boolean;
  disabled: boolean;
  onChange: (next: string[]) => void;
}): ReactElement {
  const dragIndexRef = useRef<number | null>(null);
  const available = options.filter(option => !values.includes(option.value));

  const move = (from: number, to: number) => {
    const next = [...values];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  };

  return (
    <Flex vertical gap="small">
      <Typography.Text strong>{label}</Typography.Text>
      {values.map((value, index) => {
        const option = options.find(candidate => candidate.value === value);
        return (
          <Flex
            key={value}
            align="center"
            gap="small"
            draggable
            onDragStart={() => {
              dragIndexRef.current = index;
            }}
            onDragOver={event => event.preventDefault()}
            onDrop={() => {
              if (
                dragIndexRef.current !== null &&
                dragIndexRef.current !== index
              ) {
                move(dragIndexRef.current, index);
              }
              dragIndexRef.current = null;
            }}
          >
            <Icons.HolderOutlined iconSize="s" />
            <div style={{ flex: 1 }}>{option?.label ?? value}</div>
            <Button
              buttonSize="xsmall"
              buttonStyle="link"
              aria-label={t('Remove')}
              icon={<Icons.CloseOutlined iconSize="s" />}
              onClick={() => onChange(values.filter((_, i) => i !== index))}
            />
          </Flex>
        );
      })}
      {available.length > 0 && (
        <Select
          value={undefined}
          placeholder={t('Add field')}
          options={available}
          loading={loading}
          disabled={disabled}
          onChange={next => onChange([...values, next as string])}
          style={{ width: '100%' }}
        />
      )}
    </Flex>
  );
}

/** `x-control: "column"` — a single column reference. */
function ColumnControl(props: ControlProps): ReactElement {
  const datasetId = useBoundDatasetId(props);
  const { metadata, loading } = useDatasetMetadata(datasetId);
  const allowedTypes = (props.schema as Record<string, unknown>)[
    'x-column-types'
  ] as string[] | undefined;
  return (
    <ReferenceSelect
      label={props.label}
      value={props.data as string | undefined}
      options={columnOptions(metadata, allowedTypes)}
      loading={loading}
      disabled={!props.enabled}
      onChange={value => props.handleChange(props.path, value)}
    />
  );
}

/** `x-control: "column-multi"` — an ordered list of column references. */
function ColumnMultiControl(props: ControlProps): ReactElement {
  const datasetId = useBoundDatasetId(props);
  const { metadata, loading } = useDatasetMetadata(datasetId);
  const allowedTypes = (props.schema as Record<string, unknown>)[
    'x-column-types'
  ] as string[] | undefined;
  const values = Array.isArray(props.data) ? (props.data as string[]) : [];
  return (
    <ReferenceMultiList
      label={props.label}
      values={values}
      options={columnOptions(metadata, allowedTypes)}
      loading={loading}
      disabled={!props.enabled}
      onChange={next => props.handleChange(props.path, next)}
    />
  );
}
```

Finally, extend the exported array (currently ending after the `color` entry) to:

```tsx
export const schemaControlRenderers = [
  ...baseRenderers,
  {
    tester: rankWith(1000, xControlIs('code')),
    renderer: withJsonFormsControlProps(CodeControl),
  },
  {
    tester: rankWith(1000, xControlIs('color')),
    renderer: withJsonFormsControlProps(ColorControl),
  },
  {
    tester: rankWith(1000, xControlIs('column')),
    renderer: withJsonFormsControlProps(ColumnControl),
  },
  {
    tester: rankWith(1000, xControlIs('column-multi')),
    renderer: withJsonFormsControlProps(ColumnMultiControl),
  },
];
```

- [ ] **Step 5: Run the unit tests to verify they pass**

Run: `npm run test -- src/pages/DashboardBuilderV2/schemaControlRenderers.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 6: Write the failing integration tests**

Append to `SchemaControlPanel.test.tsx` (add `import { selectOption } from 'spec/helpers/testing-library';` — this file already imports `render, screen, waitFor` from the same module, so extend that import; and add `const getSpy = jest.spyOn(SupersetClient, 'get');` plus `getSpy.mockReset()` in `beforeEach`):

```tsx
test('renders a column picker for an x-control: "column" field and writes the pick back into props', async () => {
  postSpy.mockResolvedValue({
    json: {
      result: {
        type: 'object',
        properties: {
          colorDimension: {
            type: 'string',
            title: 'Color dimension',
            'x-control': 'column',
          },
        },
      },
    },
  } as never);
  getSpy.mockResolvedValue({
    json: {
      result: {
        columns: [{ column_name: 'gender', type_generic: 1 }],
        metrics: [],
      },
    },
  } as never);

  const id = mount('balloons', {
    dataBinding: { datasetId: 1, metrics: ['count'] },
  });

  await screen.findByText('Color dimension');
  await selectOption('gender');

  await waitFor(() =>
    expect(provider.getNode(id)?.props?.colorDimension).toBe('gender'),
  );
});

test('renders an ordered column-multi list for an x-control: "column-multi" field, and picking one writes the array back', async () => {
  postSpy.mockResolvedValue({
    json: {
      result: {
        type: 'object',
        properties: {
          dimensions: {
            type: 'array',
            title: 'Dimensions',
            'x-control': 'column-multi',
          },
        },
      },
    },
  } as never);
  getSpy.mockResolvedValue({
    json: {
      result: {
        columns: [
          { column_name: 'name', type_generic: 1 },
          { column_name: 'gender', type_generic: 1 },
        ],
        metrics: [],
      },
    },
  } as never);

  const id = mount('balloons', {
    dataBinding: { datasetId: 1, metrics: ['count'] },
  });

  await screen.findByText('Dimensions');
  await selectOption('name');

  await waitFor(() =>
    expect(provider.getNode(id)?.props?.dimensions).toEqual(['name']),
  );
});
```

- [ ] **Step 7: Run the integration tests to verify they fail, then pass**

Run: `npm run test -- src/pages/DashboardBuilderV2/SchemaControlPanel.test.tsx`
Expected: first FAIL (before Step 4's implementation lands — if run out of order) then PASS once Steps 3–4 are in place. Since Steps 3–4 already precede this in the task, running now should show PASS for all tests in the file, including the 4 pre-existing ones (unaffected by the added `config` prop).

- [ ] **Step 8: Type-check and lint**

Run: `npm run type`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add superset-frontend/src/pages/DashboardBuilderV2/SchemaControlPanel.tsx \
        superset-frontend/src/pages/DashboardBuilderV2/SchemaControlPanel.test.tsx \
        superset-frontend/src/pages/DashboardBuilderV2/schemaControlRenderers.tsx \
        superset-frontend/src/pages/DashboardBuilderV2/schemaControlRenderers.test.tsx
git commit -m "feat(dashboard-v2): add column-reference widget controls"
```

---

### Task 4: Frontend — metric-reference controls (`x-control: "metric"` / `"metric-multi"`)

**Files:**
- Modify: `superset-frontend/src/pages/DashboardBuilderV2/schemaControlRenderers.tsx`
- Modify: `superset-frontend/src/pages/DashboardBuilderV2/schemaControlRenderers.test.tsx`
- Modify: `superset-frontend/src/pages/DashboardBuilderV2/SchemaControlPanel.test.tsx`

**Interfaces:**
- Consumes: `ReferenceOption`, `ReferenceSelect`, `ReferenceMultiList`, `useBoundDatasetId`, `useDatasetMetadata`, `CodeControl` — all already in `schemaControlRenderers.tsx` from Task 3 (`CodeControl` predates Task 3).
- Produces: exported `metricOptions(metadata: DatasetMetadata | null): ReferenceOption[]` and `hasAdvancedMetric(values: unknown[], metadata: DatasetMetadata): boolean`, for direct unit testing and for any future consumer.

- [ ] **Step 1: Write the failing unit tests**

Append to `schemaControlRenderers.test.tsx`:

```tsx
import { hasAdvancedMetric, metricOptions } from './schemaControlRenderers';

test('metricOptions lists the dataset\'s saved metrics by verbose name', () => {
  const metadata = {
    columns: [],
    metrics: [{ name: 'count', verboseName: 'Count' }],
  };
  expect(metricOptions(metadata).map(o => o.value)).toEqual(['count']);
});

test('hasAdvancedMetric is false when every value is a known saved metric', () => {
  const metadata = {
    columns: [],
    metrics: [{ name: 'count', verboseName: 'Count' }],
  };
  expect(hasAdvancedMetric(['count'], metadata)).toBe(false);
});

test('hasAdvancedMetric is true for an ad-hoc aggregate object', () => {
  const metadata = {
    columns: [],
    metrics: [{ name: 'count', verboseName: 'Count' }],
  };
  expect(
    hasAdvancedMetric(
      [{ expressionType: 'SIMPLE', aggregate: 'SUM' }],
      metadata,
    ),
  ).toBe(true);
});

test('hasAdvancedMetric is true for a metric name the dataset does not have', () => {
  const metadata = {
    columns: [],
    metrics: [{ name: 'count', verboseName: 'Count' }],
  };
  expect(hasAdvancedMetric(['unknown_metric'], metadata)).toBe(true);
});
```

(Move the existing `import { columnOptions } from './schemaControlRenderers';` and this new import into one combined `import { columnOptions, hasAdvancedMetric, metricOptions } from './schemaControlRenderers';` line at the top of the file.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test -- src/pages/DashboardBuilderV2/schemaControlRenderers.test.tsx`
Expected: FAIL — `metricOptions`/`hasAdvancedMetric` not exported yet.

- [ ] **Step 3: Implement the metric controls in `schemaControlRenderers.tsx`**

Add, after `ColumnMultiControl` and before the exported array:

```tsx
/**
 * Metric options for a `metric`/`metric-multi` control: the dataset's saved
 * metrics, shown with the same Sigma icon Explore's metric picker uses.
 */
export function metricOptions(
  metadata: DatasetMetadata | null,
): ReferenceOption[] {
  return (metadata?.metrics ?? []).map(metric => ({
    value: metric.name,
    label: (
      <Flex align="center" gap="small">
        <ColumnTypeLabel type="metric" />
        {metric.verboseName}
      </Flex>
    ),
  }));
}

/**
 * True when any of `values` isn't a plain saved-metric name known to
 * `metadata` — i.e. at least one entry is an ad-hoc aggregate object. When
 * true, `MetricMultiControl` drops to the raw JSON editor for the whole
 * field rather than a picker that can't represent every entry.
 */
export function hasAdvancedMetric(
  values: unknown[],
  metadata: DatasetMetadata,
): boolean {
  const known = new Set(metadata.metrics.map(metric => metric.name));
  return values.some(value => typeof value !== 'string' || !known.has(value));
}

/** `x-control: "metric"` — a single metric reference. */
function MetricControl(props: ControlProps): ReactElement {
  const datasetId = useBoundDatasetId(props);
  const { metadata, loading } = useDatasetMetadata(datasetId);
  return (
    <ReferenceSelect
      label={props.label}
      value={props.data as string | undefined}
      options={metricOptions(metadata)}
      loading={loading}
      disabled={!props.enabled}
      onChange={value => props.handleChange(props.path, value)}
    />
  );
}

/**
 * `x-control: "metric-multi"` — an ordered list of metric references. Falls
 * back to the raw JSON editor (`CodeControl`) whenever an existing entry
 * isn't expressible as a saved-metric pick, e.g. an ad-hoc aggregate object
 * authored through the JSON tab.
 */
function MetricMultiControl(props: ControlProps): ReactElement {
  const datasetId = useBoundDatasetId(props);
  const { metadata, loading } = useDatasetMetadata(datasetId);
  const values = Array.isArray(props.data) ? (props.data as unknown[]) : [];

  if (metadata && hasAdvancedMetric(values, metadata)) {
    return <CodeControl {...props} />;
  }

  return (
    <ReferenceMultiList
      label={props.label}
      values={values as string[]}
      options={metricOptions(metadata)}
      loading={loading}
      disabled={!props.enabled}
      onChange={next => props.handleChange(props.path, next)}
    />
  );
}
```

Extend the exported array with two more entries:

```tsx
  {
    tester: rankWith(1000, xControlIs('metric')),
    renderer: withJsonFormsControlProps(MetricControl),
  },
  {
    tester: rankWith(1000, xControlIs('metric-multi')),
    renderer: withJsonFormsControlProps(MetricMultiControl),
  },
];
```

(This replaces the closing `];` from Task 3's array — the four new entries plus the two from Task 3 all sit alongside the original `code`/`color` entries.)

- [ ] **Step 4: Run the unit tests to verify they pass**

Run: `npm run test -- src/pages/DashboardBuilderV2/schemaControlRenderers.test.tsx`
Expected: PASS (7 tests total: 3 from Task 3 + 4 new).

- [ ] **Step 5: Write the failing integration tests**

Append to `SchemaControlPanel.test.tsx`:

```tsx
test('renders a metric picker for an x-control: "metric-multi" field and writes the pick back', async () => {
  postSpy.mockResolvedValue({
    json: {
      result: {
        type: 'object',
        properties: {
          metrics: {
            type: 'array',
            title: 'Metrics',
            'x-control': 'metric-multi',
          },
        },
      },
    },
  } as never);
  getSpy.mockResolvedValue({
    json: {
      result: {
        columns: [],
        metrics: [{ metric_name: 'count', verbose_name: 'Count' }],
      },
    },
  } as never);

  const id = mount('balloons', { dataBinding: { datasetId: 1, metrics: [] } });

  await screen.findByText('Metrics');
  await selectOption('Count');

  await waitFor(() =>
    expect(provider.getNode(id)?.props?.metrics).toEqual(['count']),
  );
});

test('falls back to the raw JSON editor when an existing metric entry is an ad-hoc aggregate', async () => {
  postSpy.mockResolvedValue({
    json: {
      result: {
        type: 'object',
        properties: {
          metrics: {
            type: 'array',
            title: 'Metrics',
            'x-control': 'metric-multi',
          },
        },
      },
    },
  } as never);
  getSpy.mockResolvedValue({
    json: {
      result: {
        columns: [],
        metrics: [{ metric_name: 'count', verbose_name: 'Count' }],
      },
    },
  } as never);

  mount('balloons', {
    dataBinding: {
      datasetId: 1,
      metrics: [
        {
          expressionType: 'SIMPLE',
          column: { column_name: 'sales' },
          aggregate: 'SUM',
        },
      ],
    },
  });

  expect(await screen.findByText('Metrics')).toBeInTheDocument();
  // The raw JSON editor renders a textarea, not a Select — its absence
  // confirms the fallback fired instead of the picker.
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
});
```

- [ ] **Step 6: Run the integration tests to verify they pass**

Run: `npm run test -- src/pages/DashboardBuilderV2/SchemaControlPanel.test.tsx`
Expected: PASS (8 tests total).

- [ ] **Step 7: Type-check**

Run: `npm run type`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add superset-frontend/src/pages/DashboardBuilderV2/schemaControlRenderers.tsx \
        superset-frontend/src/pages/DashboardBuilderV2/schemaControlRenderers.test.tsx \
        superset-frontend/src/pages/DashboardBuilderV2/SchemaControlPanel.test.tsx
git commit -m "feat(dashboard-v2): add metric-reference widget controls with JSON fallback"
```

---

### Task 5: Integration — verify the real backend-served `balloons` schema end-to-end, and manual QA

**Files:**
- Modify: `superset-frontend/src/pages/DashboardBuilderV2/SchemaControlPanel.test.tsx`

**Interfaces:**
- Consumes: everything from Tasks 1–4. This task adds no new production code — it locks in the contract between Task 1's backend shape and Tasks 3–4's frontend testers with one fixture that mirrors exactly what `Balloons.get_control_schema()` now serves (nested `dataBinding` under `$defs`, per `test_get_control_schema_base_shape`).

- [ ] **Step 1: Write the failing integration test**

Append to `SchemaControlPanel.test.tsx`:

```tsx
test('the real balloons schema shape (dataBinding nested under $defs) renders pickers for dimensions, metrics, and colorDimension', async () => {
  postSpy.mockResolvedValue({
    json: {
      result: {
        type: 'object',
        properties: {
          dataBinding: { $ref: '#/$defs/DataBinding' },
          colorDimension: {
            type: 'string',
            title: 'Color dimension',
            'x-control': 'column',
          },
        },
        $defs: {
          DataBinding: {
            type: 'object',
            properties: {
              datasetId: { type: 'integer', title: 'Dataset ID' },
              metrics: {
                type: 'array',
                title: 'Metrics',
                'x-control': 'metric-multi',
              },
              dimensions: {
                type: 'array',
                title: 'Dimensions',
                'x-control': 'column-multi',
              },
            },
          },
        },
      },
    },
  } as never);
  getSpy.mockResolvedValue({
    json: {
      result: {
        columns: [{ column_name: 'gender', type_generic: 1 }],
        metrics: [{ metric_name: 'count', verbose_name: 'Count' }],
      },
    },
  } as never);

  // `metrics`/`dimensions` are pre-filled with the only known metric/column
  // so neither's "Add field" select renders — otherwise `selectOption`
  // would find three comboboxes (dimensions' add-select, metrics'
  // add-select, and colorDimension's) instead of the one it expects.
  const id = mount('balloons', {
    dataBinding: { datasetId: 1, metrics: ['count'], dimensions: ['gender'] },
  });

  await screen.findByText('Color dimension');
  await selectOption('gender');

  await waitFor(() =>
    expect(provider.getNode(id)?.props?.colorDimension).toBe('gender'),
  );
});
```

- [ ] **Step 2: Run the test**

Run: `npm run test -- src/pages/DashboardBuilderV2/SchemaControlPanel.test.tsx`
Expected: PASS (9 tests total). If it fails, the mismatch is between this fixture and Task 1's actual served shape — re-run `pytest tests/unit_tests/widgets/test_registry.py -v -k balloons` and diff the two.

- [ ] **Step 3: Manual verification in the browser**

Per CLAUDE.md's UI-change policy, confirm the feature works end-to-end in a real dashboard before calling this done:

1. Start the dev stack (`npm run dev` in `superset-frontend/`, Flask app running per the project's normal dev setup).
2. Open a Dashboard V2 page, add a `balloons` widget, bind it to a dataset with at least one string column and one saved metric.
3. In the Inspector's Form tab, confirm: `dimensions` shows an ordered list with a type icon per column and an "Add field" select; `metrics` shows the same for saved metrics; `colorDimension` shows a single-select column picker.
4. Reorder a dimension by dragging, remove one, and add one back — confirm the canvas/query updates accordingly.
5. Switch to the JSON tab and hand-author an ad-hoc metric object into `metrics` — switch back to the Form tab and confirm `metrics` now shows the raw JSON editor instead of the picker (the fallback from Task 4).

- [ ] **Step 4: Run the full test suite for touched areas**

Run: `npm run test -- src/pages/DashboardBuilderV2 src/core/dashboard`
Expected: PASS, no regressions in `Inspector.test.tsx`, `EditorPanel.test.tsx`, `index.test.tsx`, etc.

Run: `pytest tests/unit_tests/widgets/ -v`
Expected: PASS.

- [ ] **Step 5: Pre-commit and final commit**

```bash
git add -A
pre-commit run --all-files
git add -A
git commit -m "test(dashboard-v2): lock the balloons control schema shape end-to-end"
```

---

## Self-Review Notes

- **Spec coverage:** every schema-level item in the design doc has a task — new `x-control` values (Task 1 backend, Tasks 3–4 frontend renderers), dataset metadata plumbing (Task 2), error handling / fail-open (Task 2's `useDatasetMetadata`, exercised in its own tests), the metric JSON escape hatch (Task 4), and testing at both backend and frontend layers (every task). Visualization-type swapping is out of scope per the spec and is not addressed here.
- **Type consistency:** `DatasetMetadata`/`DatasetColumnMeta`/`DatasetMetricMeta` (Task 2) are used with the same shape in Tasks 3–4's `columnOptions`/`metricOptions`/`hasAdvancedMetric` signatures. `ReferenceOption` (Task 3) is reused unchanged by Task 4's `metricOptions`. `useBoundDatasetId` and `ReferenceSelect`/`ReferenceMultiList` (Task 3) are consumed as-is by Task 4 with no signature changes.
- **No placeholders:** every step above contains real, complete code — no "add appropriate handling" or "similar to Task N" shortcuts.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-20-dataset-aware-widget-controls.md`. Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
