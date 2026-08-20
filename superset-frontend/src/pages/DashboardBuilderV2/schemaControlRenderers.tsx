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
 *
 * `code` and `color` fall back to the field's schema `default`, since
 * JsonForms does not write defaults into the data until a field is touched.
 */
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

const xControlIs = (value: string) =>
  schemaMatches(
    (schema: JsonSchema) =>
      (schema as Record<string, unknown>)['x-control'] === value,
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
    <Flex vertical gap="small">
      <Typography.Text strong>{label}</Typography.Text>
      <textarea
        value={text}
        onChange={onChange}
        rows={12}
        spellCheck={false}
        style={{ fontFamily: 'monospace', fontSize: 12, width: '100%' }}
      />
      {error && <Typography.Text type="danger">{error}</Typography.Text>}
    </Flex>
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
    <Flex align="center" gap="small">
      <input
        type="color"
        value={value}
        onChange={event => handleChange(path, event.target.value)}
      />
      <Typography.Text>{label}</Typography.Text>
    </Flex>
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
          ariaLabel={t('Add %s', label)}
          options={available}
          loading={loading}
          disabled={disabled}
          onChange={next => onChange([...values, next as string])}
          css={{ width: '100%' }}
        />
      )}
    </Flex>
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
];
