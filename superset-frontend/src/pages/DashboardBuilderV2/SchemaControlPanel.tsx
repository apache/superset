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
 * A widget's control panel, driven by a backend-owned JSON Schema.
 *
 * The schema is fetched from `/api/v1/widgets`, rendered generically
 * with JsonForms, and edits are written straight back to the node's `props` —
 * the same object the widget reads and the same object an assistant's
 * `updateProps` writes, so a change here and one made in chat are the same edit
 * by different routes. Data is discovered via the v1 chart-data path
 * (`fetchQueryData`).
 *
 * For widgets with an `x-dynamic` sub-schema (e.g. balloons' per-series
 * `customize`), the panel discovers the widget's distinct series values from the
 * query results and posts them back, so the backend can enrich the schema (the
 * SIP's x-dynamic pattern; ignored by schemas that don't declare it).
 *
 * NOTE: must be rendered bare — NOT inside an antd `Form`, which would bind the
 * generated `Form.Item`s to its own store and swallow the edits. The Inspector
 * renders it bare for exactly this reason (see `PropsEditor`).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { SupersetClient } from '@superset-ui/core';
import { Loading, Typography } from '@superset-ui/core/components';
import { JsonForms } from '@jsonforms/react';
import type { JsonSchema } from '@jsonforms/core';
import { cellRegistryEntries } from '@great-expectations/jsonforms-antd-renderers';
import type { dashboard as dashboardApi } from '@apache-superset/core';
import {
  buildUiSchema,
  sanitizeSchema,
} from 'src/features/semanticLayers/jsonFormsHelpers';
import { provider, useDashboardRevision } from 'src/core/dashboard/store';
import { fetchQueryData } from 'src/core/dashboard/chartData';
import { FormShell } from './PropsForm';
import { schemaControlRenderers } from './schemaControlRenderers';

type DataBindingSpec = dashboardApi.DataBindingSpec;
type WidgetProps = Record<string, unknown>;

/**
 * Distinct values of the widget's color dimension, so a schema with an
 * `x-dynamic` per-series section can enumerate them. This must match the
 * dimension the widget colors by (its `colorDimension`, or the last grouping
 * dimension by default — see `BalloonsWidget`), so the customizable series line
 * up with the balloons on screen. Empty when the binding can't be queried.
 */
async function loadSeries(
  binding: DataBindingSpec,
  colorDimension: string,
): Promise<string[]> {
  const { rows } = await fetchQueryData(binding);
  const seen: string[] = [];
  rows.forEach(row => {
    const value = String(row[colorDimension] ?? '');
    if (!seen.includes(value)) seen.push(value);
  });
  return seen;
}

async function fetchControlSchema(
  widgetType: string,
  controlValues: WidgetProps,
  series: string[],
): Promise<JsonSchema> {
  const { json } = await SupersetClient.post({
    endpoint: `/api/v1/widgets/type/${widgetType}/control-schema`,
    jsonPayload: { control_values: controlValues, series },
  });
  return (json as { result: JsonSchema }).result;
}

/**
 * SupersetClient rejects a non-2xx response with the raw, unparsed `Response`
 * object rather than an `Error`, so a plain `String(e)` yields the useless
 * "[object Response]". Pull the actual `{message}`/`{errors:[...]}` body Superset
 * sends back (same shape `chartData.ts` handles).
 */
async function describeError(e: unknown): Promise<string> {
  if (typeof Response !== 'undefined' && e instanceof Response) {
    try {
      const body = await e.clone().json();
      const detail =
        body?.message ??
        (Array.isArray(body?.errors)
          ? body.errors
              .map((err: { message?: string }) => err.message)
              .join('; ')
          : undefined);
      return detail
        ? `${e.status} ${e.statusText}: ${detail}`
        : `${e.status} ${e.statusText}`;
    } catch {
      return `${e.status} ${e.statusText}`;
    }
  }
  return e instanceof Error ? e.message : String(e);
}

/** True once a binding has enough to run a grouped query. */
function canQuery(
  binding: DataBindingSpec | undefined,
): binding is DataBindingSpec {
  return Boolean(
    binding?.datasetId && binding.metrics?.length && binding.dimensions?.length,
  );
}

export default function SchemaControlPanel({ nodeId }: { nodeId: string }) {
  useDashboardRevision();
  const node = provider.getNode(nodeId);
  const widgetType = node?.type ?? '';
  const props = useMemo<WidgetProps>(
    () => (node?.props as WidgetProps) ?? {},
    [node?.props],
  );
  const binding = props.dataBinding as DataBindingSpec | undefined;
  const bindingKey = JSON.stringify(binding ?? null);
  // The dimension whose distinct values become the customizable series: the
  // explicit `colorDimension` when it's one of the grouping dimensions, else the
  // last dimension (mirrors BalloonsWidget's default).
  const dimensions = binding?.dimensions ?? [];
  const explicitColor = props.colorDimension as string | undefined;
  const colorDimension =
    explicitColor && dimensions.includes(explicitColor)
      ? explicitColor
      : dimensions[dimensions.length - 1];

  const [series, setSeries] = useState<string[]>([]);
  const [schema, setSchema] = useState<JsonSchema | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Discover series once the binding has a grouping dimension; empty otherwise.
  // Only relevant to schemas that declare an x-dynamic field, but harmless for
  // the rest (the backend ignores `series` when nothing depends on it).
  useEffect(() => {
    if (!canQuery(binding) || !colorDimension) {
      setSeries([]);
      return undefined;
    }
    let cancelled = false;
    loadSeries(binding, colorDimension)
      .then(result => !cancelled && setSeries(result))
      .catch(() => !cancelled && setSeries([]));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bindingKey, colorDimension]);

  // (Re)fetch the schema when the widget type or discovered series change. The
  // series change is what carries an x-dynamic dependency (e.g. a new grouping
  // dimension) through to a re-enriched schema.
  const seriesKey = JSON.stringify(series);
  useEffect(() => {
    if (!widgetType) return undefined;
    let cancelled = false;
    // Clear any stale error from a previous (failed) fetch so a later success
    // doesn't keep rendering an obsolete failure message.
    setError(null);
    fetchControlSchema(widgetType, props, series)
      .then(result => {
        if (!cancelled) {
          setSchema(sanitizeSchema(result));
          setError(null);
        }
      })
      .catch(async e => {
        const message = await describeError(e);
        if (!cancelled) setError(message);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [widgetType, seriesKey]);

  // JsonForms seeds its internal state from `data` at mount and does NOT
  // re-apply later `data` prop changes — so an external edit (e.g. the
  // assistant updating props) updates the schema-driven bits but not the field
  // values. Remount the form (via key) when props change from outside, while
  // skipping the initial mount and our own onChange edits (which would
  // otherwise drop input focus mid-typing).
  const propsKey = JSON.stringify(props);
  const mountedRef = useRef(false);
  const selfEditRef = useRef(false);
  const [formKey, setFormKey] = useState(0);
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    if (selfEditRef.current) {
      selfEditRef.current = false;
      return;
    }
    setFormKey(key => key + 1);
  }, [propsKey]);

  const uiSchema = useMemo(
    () => (schema ? buildUiSchema(schema) : undefined),
    [schema],
  );

  if (!node) return null;

  return (
    <>
      {error && <Typography.Text type="danger">{error}</Typography.Text>}
      {!schema && !error && <Loading position="inline-centered" size="s" />}
      {schema && (
        // Vertical layout via class, not an antd `Form` wrapper: the renderers
        // read the layout off the nearest `.ant-form` ancestor class, so a real
        // `Form` here would take the edits with it (see `PropsForm`). Wrapped in
        // the same `FormShell` as `PropsForm`'s generic form, so both halves of
        // the Properties tab share one spacing rhythm.
        <FormShell
          className="ant-form ant-form-vertical"
          data-test="schema-control-panel"
        >
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
              if (JSON.stringify(data) !== propsKey) {
                // Our own edit — don't let the resync effect remount the form
                // for it (that would drop input focus mid-typing).
                selfEditRef.current = true;
                provider.updateProps(nodeId, data as WidgetProps);
              }
            }}
          />
        </FormShell>
      )}
    </>
  );
}
