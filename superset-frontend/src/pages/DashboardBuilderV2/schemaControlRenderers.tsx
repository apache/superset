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
 *   - `colorDimension` (matched by name, like `datasetId`) → a column
 *     picker constrained to the sibling `dataBinding.dimensions`, since the
 *     backend only accepts a colorDimension that's already grouped.
 *
 * `code` and `color` fall back to the field's schema `default`, since
 * JsonForms does not write defaults into the data until a field is touched.
 *
 * Every control here surfaces the field's backend-authored `description` as
 * its `Form.Item`'s tooltip, the same way `label` already flows through —
 * JsonForms resolves both from the schema, so no control needs to read
 * `schema.description` itself.
 */
import { useMemo, useRef, useState } from 'react';
import type {
  ChangeEvent,
  KeyboardEvent,
  ReactElement,
  ReactNode,
} from 'react';
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
import type { AdhocMetric as CoreAdhocMetric } from '@superset-ui/core';
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
  Switch,
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
  type DatasetColumnMeta,
  type DatasetMetadata,
} from 'src/core/dashboard/datasetMetadata';
import {
  fromCoreAdhocMetric,
  isDictionaryForAdhocMetric,
} from 'src/explore/components/controls/MetricControl/AdhocMetric';
import AdhocMetricEditor from './AdhocMetricEditor';

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
  description,
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
    <Form.Item label={label} tooltip={description}>
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
  description,
}: ControlProps) {
  const theme = useTheme();
  const value = (data ??
    (schema as Record<string, unknown>).default ??
    theme.colorText) as string;
  return (
    <Form.Item label={label} tooltip={description}>
      <input
        type="color"
        value={value}
        onChange={event => handleChange(path, event.target.value)}
      />
    </Form.Item>
  );
}

interface SeriesEntryPropertySchema {
  type?: string;
  title?: string;
  default?: unknown;
  minimum?: number;
  maximum?: number;
  'x-control'?: string;
  'x-step'?: number;
}

interface SeriesEntrySchema {
  properties?: Record<string, SeriesEntryPropertySchema>;
}

interface SeriesMapSchema {
  properties?: Record<string, SeriesEntrySchema>;
}

type SeriesOverrideValue = Record<string, unknown>;

/** Turns a camelCase field key into the lowercase, space-separated phrase
 * an aria-label reads naturally with (`sizeScale` → `size scale`). */
function humanizeFieldKey(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .toLowerCase()
    .trim();
}

/** The value a not-yet-customized series entry starts from, read purely off
 * its own enriched sub-schema — every widget's per-series entry shape
 * (Balloons' `{color, sizeScale}`, echarts' `{color, visible, displayName}`,
 * or any future one) declares its own field defaults; this has no
 * hard-coded opinion of what those fields are. `fallbackColor` only backs a
 * `color` field the backend never defaulted — not expected to happen, but a
 * theme token beats a literal black. */
export function seriesDefaults(
  entrySchema: SeriesEntrySchema | undefined,
  fallbackColor: string,
): SeriesOverrideValue {
  const properties = entrySchema?.properties ?? {};
  const value: SeriesOverrideValue = Object.fromEntries(
    Object.entries(properties).map(([key, prop]) => [key, prop.default]),
  );
  if (value.color === undefined && 'color' in properties) {
    value.color = fallbackColor;
  }
  return value;
}

/** One property of a customized series entry, rendered by its schema shape
 * — not by a hard-coded field name — so a new per-series entry model (e.g.
 * echarts' `{color, visible, displayName}`) needs no renderer of its own:
 *   - `x-control: "color"` (or the property key `color`) → a color swatch.
 *   - `type: "boolean"` → a toggle.
 *   - `type: "number"` / `"integer"` → a bounded numeric input.
 *   - anything else → a text input.
 */
function SeriesEntryPropertyControl({
  seriesKey,
  propKey,
  propSchema,
  value,
  onChange,
}: {
  seriesKey: string;
  propKey: string;
  propSchema: SeriesEntryPropertySchema | undefined;
  value: unknown;
  onChange: (next: unknown) => void;
}): ReactElement {
  const theme = useTheme();
  const fieldLabel = `${seriesKey} ${humanizeFieldKey(propKey)}`;

  if (propSchema?.['x-control'] === 'color' || propKey === 'color') {
    const color = (value as string) || theme.colorText;
    return (
      <ColorPicker
        value={color}
        onChange={next => onChange(next.toHexString())}
      >
        <button
          type="button"
          aria-label={t('%s color', seriesKey)}
          style={{
            width: 20,
            height: 20,
            borderRadius: 4,
            border: '1px solid rgba(0, 0, 0, 0.15)',
            background: color,
            cursor: 'pointer',
            padding: 0,
          }}
        />
      </ColorPicker>
    );
  }
  if (propSchema?.type === 'boolean') {
    return (
      <Switch
        aria-label={fieldLabel}
        checked={value !== false}
        onChange={onChange}
      />
    );
  }
  if (propSchema?.type === 'number' || propSchema?.type === 'integer') {
    return (
      <InputNumber
        size="small"
        aria-label={fieldLabel}
        value={value as number}
        min={propSchema?.minimum}
        max={propSchema?.maximum}
        step={propSchema?.['x-step'] ?? 1}
        style={{ width: 64 }}
        onChange={next => onChange(typeof next === 'number' ? next : value)}
      />
    );
  }
  return (
    <Input
      size="small"
      aria-label={fieldLabel}
      value={(value as string) ?? ''}
      onChange={event => onChange(event.target.value)}
      style={{ width: 140 }}
    />
  );
}

/**
 * `x-dynamic: true` on a dict-of-objects field (e.g. Balloons'
 * `customize.series`, one entry per distinct color-dimension value, or
 * echarts' `customize.series`, one entry per `dataBinding` metric): an
 * overrides list, collapsed by default, rather than the upstream renderer's
 * one always-expanded group per possible entry — which turns a real
 * grouping column into thousands of pixels of identical, unstyled controls.
 *
 * The backend enriches this field's schema with one inlined per-key
 * sub-schema (a title and, where the entry shape has one, a palette-defaulted
 * `color`), but leaves the *data* untouched until an author actually edits a
 * value — so "has an entry in `data`" already means "has been customized",
 * with no comparison against the schema's own defaults needed. Which fields
 * an entry has, and how each renders, comes entirely from that per-key
 * sub-schema (see `SeriesEntryPropertyControl`) — this component has no
 * opinion of its own on the entry shape.
 */
function SeriesOverridesControl(props: ControlProps): ReactElement {
  const { data, handleChange, path, schema, label, description } = props;
  const theme = useTheme();
  const seriesSchema = schema as SeriesMapSchema;
  const keys = useMemo(
    () => Object.keys(seriesSchema.properties ?? {}),
    [seriesSchema],
  );
  const values = (data ?? {}) as Record<string, SeriesOverrideValue>;
  const customizedKeys = keys.filter(key => values[key] !== undefined);
  const availableKeys = keys.filter(key => values[key] === undefined);

  if (keys.length === 0) {
    return (
      <Form.Item label={label} tooltip={description}>
        <Typography.Text type="secondary">
          {t('No series available to customize yet.')}
        </Typography.Text>
      </Form.Item>
    );
  }

  const write = (next: Record<string, SeriesOverrideValue>) =>
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
    <Form.Item label={label} tooltip={description}>
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
                  const entryProperties =
                    seriesSchema.properties?.[key]?.properties ?? {};
                  const otherPropKeys = Object.keys(entryProperties).filter(
                    propKey => propKey !== 'color',
                  );
                  return (
                    <Flex key={key} align="center" gap="small">
                      {'color' in entryProperties && (
                        <SeriesEntryPropertyControl
                          seriesKey={key}
                          propKey="color"
                          propSchema={entryProperties.color}
                          value={value.color}
                          onChange={next =>
                            write({
                              ...values,
                              [key]: { ...value, color: next },
                            })
                          }
                        />
                      )}
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
                      {otherPropKeys.map(propKey => (
                        <SeriesEntryPropertyControl
                          key={propKey}
                          seriesKey={key}
                          propKey={propKey}
                          propSchema={entryProperties[propKey]}
                          value={value[propKey]}
                          onChange={next =>
                            write({
                              ...values,
                              [key]: { ...value, [propKey]: next },
                            })
                          }
                        />
                      ))}
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

/** The sibling `dataBinding.dimensions` list, read the same way. */
function useBoundDimensions(props: ControlProps): string[] {
  const formData = (
    props.config as { formData?: Record<string, unknown> } | undefined
  )?.formData;
  const dataBinding = formData?.dataBinding as
    { dimensions?: string[] } | undefined;
  return dataBinding?.dimensions ?? [];
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
  description,
  value,
  options,
  loading,
  disabled,
  placeholder,
  onChange,
}: {
  label: string;
  description: string | undefined;
  value: string | undefined;
  options: ReferenceOption[];
  loading: boolean;
  disabled: boolean;
  placeholder?: string;
  onChange: (next: string | undefined) => void;
}): ReactElement {
  return (
    <Form.Item label={label} tooltip={description}>
      <Select
        ariaLabel={label}
        value={value}
        onChange={next => onChange((next as string | undefined) ?? undefined)}
        options={options}
        loading={loading}
        disabled={disabled}
        placeholder={placeholder}
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
  description,
  values,
  options,
  loading,
  disabled,
  onChange,
}: {
  label: string;
  description: string | undefined;
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
    <Form.Item label={label} tooltip={description}>
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
              {/* Keyboard-operable equivalent of the drag handle above: that
                  handle isn't itself focusable, so reordering — which
                  decides e.g. the default color dimension — had no
                  non-mouse path at all. */}
              <Button
                buttonSize="xsmall"
                buttonStyle="link"
                aria-label={t('Move %s up', value)}
                disabled={index === 0}
                icon={<Icons.UpOutlined iconSize="s" />}
                onClick={() => move(index, index - 1)}
              />
              <Button
                buttonSize="xsmall"
                buttonStyle="link"
                aria-label={t('Move %s down', value)}
                disabled={index === values.length - 1}
                icon={<Icons.DownOutlined iconSize="s" />}
                onClick={() => move(index, index + 1)}
              />
              <Button
                buttonSize="xsmall"
                buttonStyle="link"
                aria-label={t('Remove %s', value)}
                icon={<Icons.CloseOutlined iconSize="s" />}
                onClick={() => onChange(values.filter((_, i) => i !== index))}
              />
            </Flex>
          );
        })}
        {available.length > 0 && (
          // Remounted on every pick — see `SeriesOverridesControl`'s
          // identical picker for why a controlled `value` of `undefined`
          // alone doesn't stop rc-select echoing the just-picked label.
          <Select
            key={available.length}
            value={null}
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
      description={props.description}
      value={props.data as string | undefined}
      options={columnOptions(metadata, allowedTypes)}
      loading={loading}
      disabled={!props.enabled}
      onChange={value => props.handleChange(props.path, value)}
    />
  );
}

/**
 * The `colorDimension` field specifically: a column reference, but not to
 * any column — the widget only colors by a dimension it already groups by
 * (Balloons' `_color_dimension_must_be_grouped` validator rejects anything
 * else). Offering all of a dataset's columns, most of which the backend
 * will reject, taught nothing about which one was actually valid; this
 * intersects the picker's options with the sibling `dataBinding.dimensions`
 * instead, and disables it with an explanatory placeholder when there's
 * nothing grouped yet to color by.
 */
function ColorDimensionControl(props: ControlProps): ReactElement {
  const datasetId = useBoundDatasetId(props);
  const dimensions = useBoundDimensions(props);
  const { metadata, loading, error } = useDatasetMetadata(datasetId);

  if (
    shouldFallBackToCode(datasetId, error) ||
    (props.data !== undefined && typeof props.data !== 'string')
  ) {
    return <CodeControl {...props} />;
  }

  const options = columnOptions(metadata, undefined).filter(option =>
    dimensions.includes(option.value),
  );

  return (
    <ReferenceSelect
      label={props.label}
      description={props.description}
      value={props.data as string | undefined}
      options={options}
      loading={loading}
      disabled={!props.enabled || dimensions.length === 0}
      placeholder={
        dimensions.length === 0 ? t('Group a dimension first') : undefined
      }
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
      description={props.description}
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
 * True for a metric entry this control has no row to draw at all: neither a
 * plain saved-metric-name string nor a structurally valid ad-hoc metric
 * object — e.g. malformed data hand-authored through the JSON tab. Only
 * this case still drops the *whole* field to the raw JSON editor; a
 * well-formed mix of saved and ad-hoc entries renders as a mixed list
 * instead (see `MetricEntryList`).
 */
export function isUnrepresentableMetric(value: unknown): boolean {
  return typeof value !== 'string' && !isDictionaryForAdhocMetric(value);
}

/** Whether the bound dataset's own settings forbid ad-hoc metrics entirely
 * (a dataset-level admin setting, not a per-field one) — read the same raw
 * `extra` JSON the legacy metric editor reads it from. */
export function disallowsAdhocMetrics(
  metadata: DatasetMetadata | null,
): boolean {
  if (!metadata?.extra) return false;
  try {
    return Boolean(
      (JSON.parse(metadata.extra) as { disallow_adhoc_metrics?: boolean })
        .disallow_adhoc_metrics,
    );
  } catch {
    return false;
  }
}

type MetricEntry = string | CoreAdhocMetric;

/** A metric entry's own display label: a saved metric's verbose name (or
 * its raw name if the dataset's metric list hasn't loaded/matched yet), or
 * an ad-hoc metric's own label — computed the same way the legacy editor
 * derives one (`(AVG)(price)`, etc.) when the author hasn't set a custom one. */
function metricEntryLabel(
  entry: MetricEntry,
  metadata: DatasetMetadata | null,
): ReactNode {
  if (typeof entry === 'string') {
    const known = metadata?.metrics.find(metric => metric.name === entry);
    return known?.verboseName ?? entry;
  }
  return fromCoreAdhocMetric(entry).label;
}

/** Sentinel option value picked from the "Add field" select to start a new
 * ad-hoc metric, distinct from any real saved-metric name. */
const ADD_CUSTOM_METRIC = '__custom_metric__';

/**
 * An ordered list of metric references, each entry rendered by its own
 * kind: a saved metric as a plain row (unchanged from `ReferenceMultiList`),
 * an ad-hoc metric (SIMPLE or SQL) as a row whose label opens
 * `AdhocMetricEditor` for just that entry. "Add field" offers both a saved
 * metric to pick and, unless the dataset disallows it, a blank ad-hoc draft.
 */
function MetricEntryList({
  label,
  description,
  values,
  metadata,
  columns,
  datasourceId,
  datasourceType,
  disallowAdhoc,
  disabled,
  onChange,
}: {
  label: string;
  description: string | undefined;
  values: MetricEntry[];
  metadata: DatasetMetadata | null;
  columns: DatasetColumnMeta[];
  datasourceId: number | undefined;
  datasourceType: string | undefined;
  disallowAdhoc: boolean;
  disabled: boolean;
  onChange: (next: MetricEntry[]) => void;
}): ReactElement {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [addingNew, setAddingNew] = useState(false);

  const pickedSavedNames = values.filter(
    (value): value is string => typeof value === 'string',
  );
  const availableSaved = metricOptions(metadata).filter(
    option => !pickedSavedNames.includes(option.value),
  );
  const addOptions = [
    ...availableSaved,
    ...(disallowAdhoc
      ? []
      : [{ value: ADD_CUSTOM_METRIC, label: t('Custom metric…') }]),
  ];

  const move = (from: number, to: number) => {
    const next = [...values];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  };

  return (
    <Form.Item label={label} tooltip={description}>
      <Flex vertical gap="small">
        {values.map((value, index) => {
          const isAdhoc = typeof value !== 'string';
          const canEdit = isAdhoc && !disallowAdhoc;
          const key =
            typeof value === 'string'
              ? value
              : (value.optionName ?? `adhoc-${index}`);
          // Event handlers only attached at all when `canEdit` — a static
          // div with an onClick/onKeyDown regardless of role is what the
          // a11y linter (rightly) objects to, not just a style choice.
          const interactiveProps = canEdit
            ? {
                role: 'button' as const,
                tabIndex: 0,
                onClick: () => setEditingIndex(index),
                onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setEditingIndex(index);
                  }
                },
              }
            : {};
          const rowLabel = (
            <div
              style={{
                flex: 1,
                minWidth: 0,
                cursor: canEdit ? 'pointer' : 'default',
              }}
              {...interactiveProps}
            >
              <Flex align="center" gap="small">
                <ColumnTypeLabel type="metric" />
                {metricEntryLabel(value, metadata)}
              </Flex>
            </div>
          );
          return (
            <Flex key={key} align="center" gap="small">
              <Icons.HolderOutlined iconSize="s" />
              {isAdhoc ? (
                <AdhocMetricEditor
                  value={value}
                  columns={columns}
                  datasourceId={datasourceId}
                  datasourceType={datasourceType}
                  open={editingIndex === index}
                  onOpenChange={open => {
                    // `Popover`'s own `trigger="click"` opens on any click to
                    // its children regardless of what the row's own onClick
                    // does — `canEdit` has to gate here too, or a disallowed
                    // dataset's rows would still open on click.
                    if (canEdit) setEditingIndex(open ? index : null);
                  }}
                  onSave={next => {
                    const updated = [...values];
                    updated[index] = next;
                    onChange(updated);
                  }}
                >
                  {rowLabel}
                </AdhocMetricEditor>
              ) : (
                rowLabel
              )}
              <Button
                buttonSize="xsmall"
                buttonStyle="link"
                aria-label={t('Move metric %s up', index + 1)}
                disabled={index === 0}
                icon={<Icons.UpOutlined iconSize="s" />}
                onClick={() => move(index, index - 1)}
              />
              <Button
                buttonSize="xsmall"
                buttonStyle="link"
                aria-label={t('Move metric %s down', index + 1)}
                disabled={index === values.length - 1}
                icon={<Icons.DownOutlined iconSize="s" />}
                onClick={() => move(index, index + 1)}
              />
              <Button
                buttonSize="xsmall"
                buttonStyle="link"
                aria-label={t('Remove metric %s', index + 1)}
                icon={<Icons.CloseOutlined iconSize="s" />}
                onClick={() => onChange(values.filter((_, i) => i !== index))}
              />
            </Flex>
          );
        })}
        {addOptions.length > 0 && (
          <Select
            key={`${availableSaved.length}-${values.length}`}
            value={null}
            placeholder={t('Add field')}
            ariaLabel={t('Add %s', label)}
            options={addOptions}
            disabled={disabled}
            onChange={next => {
              if (next === ADD_CUSTOM_METRIC) {
                setAddingNew(true);
              } else {
                onChange([...values, next as string]);
              }
            }}
          />
        )}
        {addingNew && (
          <AdhocMetricEditor
            value={undefined}
            columns={columns}
            datasourceId={datasourceId}
            datasourceType={datasourceType}
            open={addingNew}
            onOpenChange={setAddingNew}
            onSave={next => {
              onChange([...values, next]);
              setAddingNew(false);
            }}
          >
            {/* Zero-size trigger: opening this popover is driven entirely
                by picking "Custom metric…" above, not by a click here. */}
            <span />
          </AdhocMetricEditor>
        )}
      </Flex>
    </Form.Item>
  );
}

/**
 * `x-control: "metric-multi"` — an ordered list of metric references. Falls
 * back to the raw JSON editor (`CodeControl`) whenever no dataset is bound
 * (or its fetch failed), or an entry is genuinely unrepresentable (see
 * `isUnrepresentableMetric`); a well-formed mix of saved and ad-hoc metrics
 * renders as `MetricEntryList`, not raw JSON.
 */
function MetricMultiControl(props: ControlProps): ReactElement {
  const datasetId = useBoundDatasetId(props);
  const { metadata, loading, error } = useDatasetMetadata(datasetId);
  const values = Array.isArray(props.data) ? (props.data as unknown[]) : [];
  const hasUnrepresentable = values.some(isUnrepresentableMetric);

  if (shouldFallBackToCode(datasetId, error) || hasUnrepresentable) {
    return <CodeControl {...props} />;
  }

  return (
    <MetricEntryList
      label={props.label}
      description={props.description}
      values={values as MetricEntry[]}
      metadata={metadata}
      columns={metadata?.columns ?? []}
      datasourceId={datasetId}
      datasourceType={metadata?.datasourceType}
      disallowAdhoc={disallowsAdhocMetrics(metadata)}
      disabled={!props.enabled || loading}
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
    <Form.Item label={props.label} tooltip={props.description}>
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

interface SelectOptionsSchema {
  'x-options'?: string[];
  enum?: string[];
}

/**
 * `x-control: "select"` — a plain, nullable single-select. Reads its options
 * from `x-options` rather than relying on JsonForms' own enum introspection:
 * an optional field (e.g. echarts' `chartType`, `Literal[...] | None`) emits
 * `anyOf`, which JsonForms' schema-type derivation doesn't flatten (see the
 * `datasetId` tester's comment below) — `x-options` sidesteps that entirely.
 * `allowClear` maps the cleared state to `null` (Custom/unset), not `""`.
 */
function SelectControl(props: ControlProps): ReactElement {
  const { data, handleChange, path, schema, label, description } = props;
  const options = (schema as SelectOptionsSchema)['x-options'] ?? [];
  return (
    <Form.Item label={label} tooltip={description}>
      <Select
        allowClear
        ariaLabel={label}
        value={(data as string | undefined) ?? undefined}
        options={options.map(option => ({ value: option, label: option }))}
        onChange={next => handleChange(path, next ?? null)}
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
    tester: rankWith(1000, xControlIs('select')),
    renderer: withJsonFormsControlProps(SelectControl),
  },
  {
    tester: rankWith(1000, isDynamicSeries),
    renderer: withJsonFormsControlProps(SeriesOverridesControl),
  },
  {
    // Ranked above the generic `column` tester below so this field's own,
    // narrower control wins the match — both would otherwise tie at 1000.
    tester: rankWith(
      1001,
      and(scopeEndIs('colorDimension'), schemaTypeIs('string')),
    ),
    renderer: withJsonFormsControlProps(ColorDimensionControl),
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
