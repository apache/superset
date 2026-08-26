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
 * Extra JSONForms renderers for schema-driven widget controls, on top
 * of the Semantic Layer's shared `renderers`:
 *   - `x-control: code`         → a raw JSON editor (e.g. AG Grid column definitions).
 *   - `x-control: color`       → a native color swatch (e.g. per-series balloon color).
 *   - `x-control: column`      → a single column-reference picker.
 *   - `x-control: column-multi` → an ordered, reorderable list of column references.
 *   - `x-control: metric-multi` → an ordered, reorderable list of metric references.
 *   - `datasetId` (any field of that name) → a searchable dataset picker.
 *     Matched by property name rather than an `x-control` hint — the
 *     backend's `DataBinding` schema is unchanged, so this is the one
 *     control here selected structurally instead of by a declared extra.
 *   - `x-dynamic: true` (any object field so declared) → an "overrides" list:
 *     collapsed by default, showing only the entries actually customized,
 *     plus a picker to add one more — rather than the upstream JsonForms
 *     renderer's one always-expanded group per possible entry.
 *
 * `code` and `color` fall back to the field's schema `default`, since
 * JsonForms does not write defaults into the data until a field is touched.
 */
import { useMemo, useRef, useState } from 'react';
import type { ChangeEvent, ReactElement, ReactNode } from 'react';
import { withJsonFormsControlProps } from '@jsonforms/react';
import type { ControlProps, JsonSchema } from '@jsonforms/core';
import {
  and,
  rankWith,
  schemaMatches,
  schemaTypeIs,
  scopeEndIs,
} from '@jsonforms/core';
import { t } from '@apache-superset/core/translation';
import { FeatureFlag, isFeatureEnabled } from '@superset-ui/core';
import {
  AsyncSelect,
  Button,
  ColorPicker,
  Collapse,
  Flex,
  Form,
  Input,
  InputNumber,
  Select,
  Typography,
} from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import { ColumnTypeLabel } from '@superset-ui/chart-controls';
import { useTheme } from '@apache-superset/core/theme';
import { renderers as baseRenderers } from 'src/features/semanticLayers/jsonFormsHelpers';
import {
  fromCompositeValue,
  kindFromComposite,
  loadDatasetOptions,
  toCompositeValue,
} from 'src/dashboard/components/nativeFilters/FiltersConfigModal/FiltersConfigForm/DatasetSelect';
import {
  useDatasetMetadata,
  type DatasetMetadata,
} from 'src/core/dashboard/datasetMetadata';

const xControlIs = (value: string) =>
  schemaMatches(
    (schema: JsonSchema) =>
      (schema as Record<string, unknown>)['x-control'] === value,
  );

const isDynamicSeries = schemaMatches(
  (schema: JsonSchema) =>
    (schema as Record<string, unknown>)['x-dynamic'] === true,
);

/** Raw JSON editor for an `x-control: code` field. */
function CodeControl({
  data,
  handleChange,
  path,
  schema,
  label,
}: ControlProps) {
  const schemaRecord = schema as Record<string, unknown>;
  // Fall back to the schema default, or an empty container of the right kind
  // (`[]` for an array field like `metrics`, `{}` otherwise) so the editor
  // opens on a valid, type-appropriate value rather than `{}` for an array.
  const fallback =
    schemaRecord.default ?? (schemaRecord.type === 'array' ? [] : {});
  const [text, setText] = useState(() =>
    JSON.stringify(data ?? fallback, null, 2),
  );
  const [error, setError] = useState<string | null>(null);

  const onChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const next = event.target.value;
    setText(next);
    try {
      handleChange(path, JSON.parse(next));
      setError(null);
    } catch {
      setError('Invalid JSON — not applied');
    }
  };

  return (
    <Form.Item label={label}>
      <Input.TextArea
        value={text}
        onChange={onChange}
        rows={12}
        spellCheck={false}
        style={{ fontFamily: 'monospace', fontSize: 12 }}
      />
      {error && <Typography.Text type="danger">{error}</Typography.Text>}
    </Form.Item>
  );
}

/** Native color picker for an `x-control: color` string field. */
function ColorControl({
  data,
  handleChange,
  path,
  schema,
  label,
}: ControlProps) {
  const theme = useTheme();
  const value = (data ??
    (schema as Record<string, unknown>).default ??
    theme.colorText) as string;
  return (
    <Form.Item label={label}>
      <input
        type="color"
        value={value}
        onChange={event => handleChange(path, event.target.value)}
      />
    </Form.Item>
  );
}

interface SeriesEntrySchema {
  properties?: {
    color?: { default?: string };
    sizeScale?: { default?: number; minimum?: number; maximum?: number };
  };
}

interface SeriesMapSchema {
  properties?: Record<string, SeriesEntrySchema>;
}

interface SeriesStyleValue {
  color: string;
  sizeScale: number;
}

/** The value a not-yet-customized series entry starts from, read off its
 * own enriched sub-schema (the backend pre-colors each entry from a
 * palette) rather than one fixed default shared by every series. Falls
 * back to `fallbackColor` only for an entry the backend never colored —
 * not expected to happen, but a theme token beats a literal black. */
export function seriesDefaults(
  entrySchema: SeriesEntrySchema | undefined,
  fallbackColor: string,
): SeriesStyleValue {
  return {
    color: entrySchema?.properties?.color?.default ?? fallbackColor,
    sizeScale: entrySchema?.properties?.sizeScale?.default ?? 1,
  };
}

/**
 * `x-dynamic: true` on a dict-of-objects field (e.g. Balloons'
 * `customize.series`, one entry per distinct color-dimension value): an
 * overrides list, collapsed by default, rather than the upstream renderer's
 * one always-expanded group per possible entry — which turns a real
 * grouping column into thousands of pixels of identical, unstyled controls.
 *
 * The backend enriches this field's schema with one inlined per-value
 * sub-schema (a title and a palette-defaulted `color`), but leaves the
 * *data* untouched until an author actually edits a value — so "has an
 * entry in `data`" already means "has been customized", with no comparison
 * against the schema's own defaults needed.
 */
function SeriesOverridesControl(props: ControlProps): ReactElement {
  const { data, handleChange, path, schema, label } = props;
  const theme = useTheme();
  const seriesSchema = schema as SeriesMapSchema;
  const keys = useMemo(
    () => Object.keys(seriesSchema.properties ?? {}),
    [seriesSchema],
  );
  const values = (data ?? {}) as Record<string, SeriesStyleValue>;
  const customizedKeys = keys.filter(key => values[key] !== undefined);
  const availableKeys = keys.filter(key => values[key] === undefined);

  if (keys.length === 0) {
    return (
      <Form.Item label={label}>
        <Typography.Text type="secondary">
          {t('Group by a dimension to enable per-series styling.')}
        </Typography.Text>
      </Form.Item>
    );
  }

  const write = (next: Record<string, SeriesStyleValue>) =>
    handleChange(path, next);

  const removeOverride = (key: string) => {
    const next = { ...values };
    delete next[key];
    write(next);
  };

  const addOverride = (key: string) => {
    write({
      ...values,
      [key]: seriesDefaults(seriesSchema.properties?.[key], theme.colorText),
    });
  };

  return (
    <Form.Item label={label}>
      <Collapse
        ghost
        size="small"
        items={[
          {
            key: 'series-overrides',
            label: t(
              '%s series · %s customized',
              keys.length,
              customizedKeys.length,
            ),
            children: (
              <Flex vertical gap="small">
                {customizedKeys.map(key => {
                  const value = values[key];
                  const bounds =
                    seriesSchema.properties?.[key]?.properties?.sizeScale;
                  return (
                    <Flex key={key} align="center" gap="small">
                      <ColorPicker
                        value={value.color}
                        onChange={next =>
                          write({
                            ...values,
                            [key]: { ...value, color: next.toHexString() },
                          })
                        }
                      >
                        <button
                          type="button"
                          aria-label={t('%s color', key)}
                          style={{
                            width: 20,
                            height: 20,
                            borderRadius: 4,
                            border: '1px solid rgba(0, 0, 0, 0.15)',
                            background: value.color,
                            cursor: 'pointer',
                            padding: 0,
                          }}
                        />
                      </ColorPicker>
                      <div
                        style={{
                          flex: 1,
                          minWidth: 0,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {key}
                      </div>
                      <InputNumber
                        size="small"
                        aria-label={t('%s size scale', key)}
                        value={value.sizeScale}
                        min={bounds?.minimum ?? 0.25}
                        max={bounds?.maximum ?? 4}
                        step={0.25}
                        style={{ width: 64 }}
                        onChange={next =>
                          write({
                            ...values,
                            [key]: {
                              ...value,
                              sizeScale: typeof next === 'number' ? next : 1,
                            },
                          })
                        }
                      />
                      <Button
                        buttonSize="xsmall"
                        buttonStyle="link"
                        aria-label={t('Reset %s to default', key)}
                        icon={<Icons.CloseOutlined iconSize="s" />}
                        onClick={() => removeOverride(key)}
                      />
                    </Flex>
                  );
                })}
                {availableKeys.length > 0 && (
                  // Remounted on every pick: rc-select otherwise keeps
                  // showing the just-picked option's label internally even
                  // once it's gone from `options` (a controlled `value` of
                  // `null`/`undefined` doesn't clear that cache on its own —
                  // see `ReferenceMultiList`'s identical, pre-existing gap).
                  <Select
                    key={availableKeys.length}
                    value={null}
                    placeholder={t('Add a series override…')}
                    ariaLabel={t('Add %s override', label)}
                    options={availableKeys.map(key => ({
                      value: key,
                      label: key,
                    }))}
                    onChange={next => addOverride(next as string)}
                    css={{ width: '100%' }}
                  />
                )}
              </Flex>
            ),
          },
        ]}
      />
    </Form.Item>
  );
}

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
    { datasetId?: number } | undefined;
  return dataBinding?.datasetId;
}

/**
 * True when a column/metric-reference control should fail open to the raw
 * JSON editor (`CodeControl`) rather than render its picker: no dataset is
 * bound yet, or the dataset fetch failed. Deliberately does NOT cover the
 * in-flight loading state (`metadata` still `null`, no `error` yet) — that's
 * the normal case while a bound dataset's metadata is fetched, and the
 * picker renders as usual with its own `loading` flag set.
 */
function shouldFallBackToCode(
  datasetId: number | undefined,
  error: string | null,
): boolean {
  return datasetId === undefined || error !== null;
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
        ariaLabel={label}
        value={value}
        onChange={next => onChange((next as string | undefined) ?? undefined)}
        options={options}
        loading={loading}
        disabled={disabled}
        allowClear
        css={{ width: '100%' }}
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
    <Form.Item label={label}>
      <Flex vertical gap="small">
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
            ariaLabel={t('Add %s', label)}
            options={available}
            loading={loading}
            disabled={disabled}
            onChange={next => onChange([...values, next as string])}
            css={{ width: '100%' }}
          />
        )}
      </Flex>
    </Form.Item>
  );
}

/**
 * `x-control: "column"` — a single column reference. Falls back to the raw
 * JSON editor when no dataset is bound (or its fetch failed), or when the
 * existing value isn't a string — e.g. an object hand-authored into the
 * field through the Inspector's JSON tab, which `Select` can't render as a
 * `value` and JsonForms would otherwise crash on.
 */
function ColumnControl(props: ControlProps): ReactElement {
  const datasetId = useBoundDatasetId(props);
  const { metadata, loading, error } = useDatasetMetadata(datasetId);
  const allowedTypes = (props.schema as Record<string, unknown>)[
    'x-column-types'
  ] as string[] | undefined;

  if (
    shouldFallBackToCode(datasetId, error) ||
    (props.data !== undefined && typeof props.data !== 'string')
  ) {
    return <CodeControl {...props} />;
  }

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

/**
 * `x-control: "column-multi"` — an ordered list of column references. Falls
 * back to the raw JSON editor when no dataset is bound (or its fetch
 * failed), or when an existing entry isn't a string — e.g. an object
 * hand-authored into the field through the Inspector's JSON tab, which
 * `ReferenceMultiList` can't render as a list entry.
 */
function ColumnMultiControl(props: ControlProps): ReactElement {
  const datasetId = useBoundDatasetId(props);
  const { metadata, loading, error } = useDatasetMetadata(datasetId);
  const allowedTypes = (props.schema as Record<string, unknown>)[
    'x-column-types'
  ] as string[] | undefined;
  const values = Array.isArray(props.data) ? (props.data as unknown[]) : [];
  const hasNonStringEntry = values.some(value => typeof value !== 'string');

  if (shouldFallBackToCode(datasetId, error) || hasNonStringEntry) {
    return <CodeControl {...props} />;
  }

  return (
    <ReferenceMultiList
      label={props.label}
      values={values as string[]}
      options={columnOptions(metadata, allowedTypes)}
      loading={loading}
      disabled={!props.enabled}
      onChange={next => props.handleChange(props.path, next)}
    />
  );
}

/**
 * Metric options for a `metric-multi` control: the dataset's saved metrics,
 * shown with the same Sigma icon Explore's metric picker uses.
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

/**
 * `x-control: "metric-multi"` — an ordered list of metric references. Falls
 * back to the raw JSON editor (`CodeControl`) whenever no dataset is bound
 * (or its fetch failed), or an existing entry isn't expressible as a
 * saved-metric pick, e.g. an ad-hoc aggregate object authored through the
 * JSON tab.
 */
function MetricMultiControl(props: ControlProps): ReactElement {
  const datasetId = useBoundDatasetId(props);
  const { metadata, loading, error } = useDatasetMetadata(datasetId);
  const values = Array.isArray(props.data) ? (props.data as unknown[]) : [];

  // Before `metadata` loads, `hasAdvancedMetric` can't be run (it needs the
  // dataset's saved-metric names), but a non-string entry (an ad-hoc
  // aggregate object) still can't be handed to `ReferenceMultiList` — it
  // isn't a string, so it can't be rendered as one. Fall back on the
  // type check alone until metadata is available, then use the full check.
  const isAdvanced = metadata
    ? hasAdvancedMetric(values, metadata)
    : values.some(value => typeof value !== 'string');

  if (shouldFallBackToCode(datasetId, error) || isAdvanced) {
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

/**
 * The value the dataset picker needs for an already-bound dataset. Bare —
 * just the id (composite-encoded per below) — while the name is still
 * resolving: `AsyncSelect` prefers a *labeled* value's own label over a
 * matching loaded option's, so handing it a stale `String(datasetId)` label
 * here would overwrite the real name the moment the matching option
 * arrives, replaying the exact stuck-on-the-numeric-id symptom this control
 * exists to avoid — instead, letting `AsyncSelect` fall back to the id on
 * its own leaves it free to prefer a loaded option's label the instant one
 * matches. Once `tableName` resolves, the explicit label takes over.
 *
 * `value` carries the composite `"ds:<id>"` encoding when the Semantic
 * Layers flag is on, matching what `loadDatasetOptions` encodes its own
 * options as in that mode (see `resolveDatasetPick` below) — an option and
 * a bound value in two different encodings never match, which is what
 * leaves a genuinely-selected dataset showing as unselected.
 */
export function toDatasetSelectValue(
  datasetId: number | undefined,
  tableName: string | undefined,
  useSemanticLayers: boolean,
): { label: string; value: number | string } | number | string | undefined {
  if (datasetId === undefined) {
    return undefined;
  }
  const value = useSemanticLayers ? toCompositeValue(datasetId) : datasetId;
  return tableName ? { label: tableName, value } : value;
}

/**
 * The numeric dataset id a picked option resolves to, or `undefined` when
 * the pick should be rejected outright: a semantic view, which
 * `DataBinding.datasetId` has no way to represent (SIP-182's `kind` is a
 * connection-level concept, not a per-field one on this schema). Handles
 * both encodings `loadDatasetOptions` can produce — a plain number when the
 * Semantic Layers flag is off, or, flag on, a composite `"ds:<id>"` /
 * `"sv:<id>"` string for every option (not only semantic views: with the
 * flag on, ordinary datasets are composite-encoded too).
 */
export function resolveDatasetPick(
  value: number | string | undefined,
): number | undefined {
  if (value === undefined || typeof value === 'number') {
    return value;
  }
  return kindFromComposite(value) === 'semantic_view'
    ? undefined
    : fromCompositeValue(value);
}

/**
 * `loadDatasetOptions` filtered down to plain datasets. `DataBinding` has no
 * way to represent a semantic view (SIP-182's `kind` is a connection-level
 * concept, not a per-field one on this schema), so rather than let one be
 * picked and then reject it after the fact — leaving the closed select
 * showing a value the widget never actually bound — it is never offered.
 *
 * Module-level, not a closure defined inside `DatasetControl`: `AsyncSelect`
 * treats a change in its `options` function's identity as a reason to wipe
 * its own fetched-options cache, and a fresh arrow function on every render
 * would do exactly that.
 *
 * `totalCount` is passed through unfiltered — it counts datasets and
 * semantic views together, same as the page `data` was drawn from before
 * this function's own filter ran. With the Semantic Layers flag on and
 * enough semantic views sorted ahead of the wanted datasets on the current
 * search, a page that filters down to nothing still reports more rows
 * exist, but `AsyncSelect` only requests the next page on scroll — and a
 * dropdown with nothing to scroll never gets the chance. Narrow (flag off,
 * the filter is a no-op and this never applies) and not addressed here;
 * paging forward internally past an empty filtered page, or asking the
 * backend to exclude semantic views from the query in the first place,
 * would close it.
 */
async function loadDatasetOnlyOptions(
  search: string,
  page: number,
  pageSize: number,
) {
  const { data, totalCount } = await loadDatasetOptions(search, page, pageSize);
  return {
    data: data.filter(option => option.kind !== 'semantic_view'),
    totalCount,
  };
}

/**
 * A `datasetId` field — a searchable picker over every dataset the author
 * can see. Calls `AsyncSelect`/`loadDatasetOnlyOptions` directly rather than
 * through the native filters config modal's `DatasetSelect` wrapper: that
 * wrapper memoizes its rendered element with an empty dependency array
 * (`FiltersConfigForm/DatasetSelect.tsx`'s `MemoizedSelect`), which freezes
 * every prop — including `value` — at first render. Fine for that modal's
 * own call site, where the value is known synchronously; fatal here, where
 * the resolved label from `useDatasetMetadata` never arrives until after a
 * fetch, so the picker would show the raw numeric id forever.
 *
 * Fetches the bound dataset's own metadata purely to read its name for the
 * label; `ColumnControl`/`MetricMultiControl` on the same widget make the
 * identical call, so this rides their cache rather than adding a second
 * fetch. The hook runs unconditionally, before the fail-open branch below —
 * a hook called only on some renders (here, only when `props.data` is
 * already a number) is exactly what React's "Rendered fewer hooks than
 * expected" crash guards against, the same reason every sibling control in
 * this file keeps its hooks ahead of its own fail-open check.
 */
function DatasetControl(props: ControlProps): ReactElement {
  const datasetId = typeof props.data === 'number' ? props.data : undefined;
  const { metadata } = useDatasetMetadata(datasetId);
  const useSemanticLayers = isFeatureEnabled(FeatureFlag.SemanticLayers);
  const value = useMemo(
    () =>
      toDatasetSelectValue(datasetId, metadata?.tableName, useSemanticLayers),
    [datasetId, metadata?.tableName, useSemanticLayers],
  );

  if (props.data !== undefined && typeof props.data !== 'number') {
    return <CodeControl {...props} />;
  }

  return (
    <Form.Item label={props.label}>
      <AsyncSelect
        ariaLabel={props.label}
        value={value}
        options={loadDatasetOnlyOptions}
        optionFilterProps={['table_name']}
        disabled={!props.enabled}
        placeholder={t('Search datasets…')}
        notFoundContent={t('No matching datasets')}
        onChange={next => {
          // `AsyncSelect` always runs in `labelInValue` mode internally
          // (`AsyncSelect.tsx`'s own `<Select labelInValue />`), so a single
          // pick here is always a `{value, label}` object at runtime — the
          // wider type on `onChange` covers modes (multi-select, raw value)
          // this call site never uses. `resolveDatasetPick`'s semantic-view
          // rejection is a second line of defence past the options filter
          // above, not the primary one — belt and suspenders, not the belt.
          if (next && typeof next === 'object' && !Array.isArray(next)) {
            const datasetPick = resolveDatasetPick(next.value);
            if (datasetPick !== undefined) {
              props.handleChange(props.path, datasetPick);
            }
          }
        }}
      />
    </Form.Item>
  );
}

/** Base Semantic-Layer renderers plus the widget-control ones above. */
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
    tester: rankWith(1000, isDynamicSeries),
    renderer: withJsonFormsControlProps(SeriesOverridesControl),
  },
  {
    tester: rankWith(1000, xControlIs('column')),
    renderer: withJsonFormsControlProps(ColumnControl),
  },
  {
    tester: rankWith(1000, xControlIs('column-multi')),
    renderer: withJsonFormsControlProps(ColumnMultiControl),
  },
  {
    tester: rankWith(1000, xControlIs('metric-multi')),
    renderer: withJsonFormsControlProps(MetricMultiControl),
  },
  {
    // `scopeEndIs` matches the scope's exact final path segment (unlike
    // `scopeEndsWith`, a raw string suffix check that would also match a
    // future `sourceDatasetId` or similar). `schemaTypeIs('integer')` is a
    // second guard against an unrelated field ever sharing the name — but
    // it would silently stop matching, with no error, if `dataset_id` ever
    // became `Optional[int]`: Pydantic then emits `anyOf`, which jsonforms'
    // schema-type derivation does not flatten. It is a required field
    // (`superset/widgets/controls.py`), so this is latent, not live.
    tester: rankWith(
      1000,
      and(scopeEndIs('datasetId'), schemaTypeIs('integer')),
    ),
    renderer: withJsonFormsControlProps(DatasetControl),
  },
];
