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
 * A dynamic field can also depend on a plain sibling control value instead of
 * `series` (e.g. `filter.select`'s `column` enum depends on `datasetId`) — an
 * edit to that value debounces a schema re-fetch carrying the new value along
 * (`maybeRefreshSchema`), the same dependency-driven refresh
 * `SemanticLayerModal` runs for the Semantic Layer's own dynamic fields.
 *
 * NOTE: must be rendered bare — NOT inside an antd `Form`, which would bind the
 * generated `Form.Item`s to its own store and swallow the edits. The Inspector
 * renders it bare for exactly this reason (see `PropsEditor`).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SupersetClient } from '@superset-ui/core';
import { Loading, Typography } from '@superset-ui/core/components';
import { JsonForms } from '@jsonforms/react';
import type { JsonSchema } from '@jsonforms/core';
import { cellRegistryEntries } from '@great-expectations/jsonforms-antd-renderers';
import type { dashboard as dashboardApi } from '@apache-superset/core';
import {
  areDependenciesSatisfied,
  buildUiSchema,
  getDynamicDependencies,
  sanitizeSchema,
  serializeDependencyValues,
  SCHEMA_REFRESH_DEBOUNCE_MS,
} from 'src/features/semanticLayers/jsonFormsHelpers';
import { provider, useDashboardRevision } from 'src/core/dashboard/store';
import { fetchQueryData } from 'src/core/dashboard/chartData';
import { FormShell } from './PropsForm';
import { schemaControlRenderers } from './schemaControlRenderers';
import {
  commitWidgetProps,
  describeError,
  type ControlValidationError,
} from './controlValueValidation';

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

/** True once a binding has enough to run a grouped query. */
function canQuery(
  binding: DataBindingSpec | undefined,
): binding is DataBindingSpec {
  return Boolean(
    binding?.datasetId && binding.metrics?.length && binding.dimensions?.length,
  );
}

/**
 * Drops any top-level property tagged `x-hidden-in-form` (e.g. echarts'
 * `echartsOptions` — already fully editable via the Inspector's JSON tab, so
 * a second raw-JSON box here would just duplicate it) before the schema
 * reaches JsonForms, so no control is generated for it. The property stays
 * in `data`/`node.props` untouched — this only changes what's rendered, not
 * what's stored, so the JSON tab (which reads the whole record) still shows
 * and edits it.
 */
function hideFlaggedFields(schema: JsonSchema): JsonSchema {
  const { properties } = schema as { properties?: Record<string, unknown> };
  if (!properties) return schema;
  const visible = Object.fromEntries(
    Object.entries(properties).filter(
      ([, propSchema]) =>
        !(propSchema as Record<string, unknown>)['x-hidden-in-form'],
    ),
  );
  if (Object.keys(visible).length === Object.keys(properties).length) {
    return schema;
  }
  return { ...schema, properties: visible } as JsonSchema;
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
  const [formKey, setFormKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<
    ControlValidationError[]
  >([]);
  // Guards against an earlier, slower validation round-trip landing after a
  // later one — e.g. two edits typed close together — and overwriting the
  // more recent result with a stale one.
  const validateSeqRef = useRef(0);
  // A validation error belongs to the widget it was raised for; selecting a
  // different one shouldn't leave a stale message on screen.
  useEffect(() => setValidationErrors([]), [nodeId]);
  // Whether a debounced re-fetch triggered by a dynamic field's own
  // dependency (see `maybeRefreshSchema` below) is in flight — surfaced to
  // the renderers via `config` so a dependent field (e.g. `column`) can show
  // a loading state instead of briefly offering its previous, now-stale
  // options.
  const [refreshingSchema, setRefreshingSchema] = useState(false);

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

  // Field name -> the other fields it depends on (e.g. `column` depends on
  // `datasetId`), read off whatever schema is currently applied. Recomputed
  // each time a schema arrives — including from the debounced refresh below
  // — since enrichment can change which fields are dynamic.
  const dynamicDepsRef = useRef<Record<string, string[]>>({});
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastDepSnapshotRef = useRef<string>('');

  // (Re)fetch the schema when the selected node, its widget type, or its
  // discovered series change. `nodeId` has to be here too, not just
  // `widgetType`/`seriesKey`: selecting a different node of the *same* type
  // that happens to resolve to the same series (e.g. neither has a color
  // dimension yet, so both are `[]`) would otherwise skip this effect
  // entirely and keep rendering the previous node's enriched schema — its
  // per-metric override controls, discovered series, whatever the enricher
  // built from props this node never had.
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
          dynamicDepsRef.current = getDynamicDependencies(result);
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
  }, [nodeId, widgetType, seriesKey]);

  // The effect above only reacts to `widgetType`/`series` — an edit to a
  // plain control value (e.g. picking `datasetId`) needs its own trigger so
  // a field that depends on it (`column`'s enum) gets re-enriched. Debounced,
  // and skipped whenever the dependency values haven't actually changed,
  // mirroring `SemanticLayerModal`'s identical rule for the Semantic Layer's
  // own dynamic fields.
  const maybeRefreshSchema = useCallback(
    (data: WidgetProps) => {
      const dynamicDeps = dynamicDepsRef.current;
      if (Object.keys(dynamicDeps).length === 0) return;

      const hasSatisfiedDeps = Object.values(dynamicDeps).some(deps =>
        areDependenciesSatisfied(deps, data, schema ?? undefined),
      );
      if (!hasSatisfiedDeps) {
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
          debounceTimerRef.current = null;
        }
        setRefreshingSchema(false);
        lastDepSnapshotRef.current = '';
        return;
      }

      const snapshot = serializeDependencyValues(dynamicDeps, data);
      if (snapshot === lastDepSnapshotRef.current) return;
      lastDepSnapshotRef.current = snapshot;

      // Flip the loading state immediately so the dependent field shows it
      // through the debounce window, rather than keeping its stale options
      // on screen for the debounce's duration before the request even fires.
      setRefreshingSchema(true);
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        fetchControlSchema(widgetType, data, series)
          .then(result => {
            setSchema(sanitizeSchema(result));
            dynamicDepsRef.current = getDynamicDependencies(result);
            // JsonForms keeps its own schema/data state after mount. A
            // dependency refresh can add or replace controls, so remount it
            // with the accepted node props and the newly enriched schema.
            setFormKey(key => key + 1);
            setError(null);
          })
          .catch(async e => setError(await describeError(e)))
          .finally(() => setRefreshingSchema(false));
      }, SCHEMA_REFRESH_DEBOUNCE_MS);
    },
    [widgetType, series, schema],
  );

  useEffect(
    () => () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    },
    [],
  );

  // JsonForms seeds its internal state from `data` at mount and does NOT
  // re-apply later `data` prop changes — so an external edit (e.g. the
  // assistant updating props) updates the schema-driven bits but not the field
  // values. Remount the form (via key) when props change from outside, while
  // skipping the initial mount and our own onChange edits (which would
  // otherwise drop input focus mid-typing).
  const propsKey = JSON.stringify(props);
  const mountedRef = useRef(false);
  const selfEditRef = useRef(false);
  // What sibling controls (e.g. a metric/column picker reading the widget's
  // `dataBinding.datasetId` off `config.formData`) see as this field's
  // current value — updated synchronously on every edit, whether or not it
  // ends up validating. `props` alone can't serve this: `dataBinding` and its
  // required siblings (`datasetId`, `metrics`) can only ever be committed
  // together, so a freshly placed widget's very first pick is always
  // individually rejected — if sibling controls only saw the last *accepted*
  // props, none of them would ever see that pick and the widget could never
  // be built up field by field. Reset to `props` on the same external-change
  // path the resync effect below already distinguishes from a self-triggered
  // one.
  const [liveData, setLiveData] = useState<WidgetProps>(props);
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
    setLiveData(props);
    // `propsKey` is `props`'s own stable, value-equality-comparable proxy —
    // see its own comment just above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propsKey]);

  const formSchema = useMemo(
    () => (schema ? hideFlaggedFields(schema) : undefined),
    [schema],
  );
  const uiSchema = useMemo(
    () => (formSchema ? buildUiSchema(formSchema) : undefined),
    [formSchema],
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
            schema={formSchema}
            uischema={uiSchema}
            data={props}
            renderers={schemaControlRenderers}
            cells={cellRegistryEntries}
            config={{ refreshingSchema, formData: liveData }}
            validationMode="ValidateAndHide"
            // Column/metric-reference controls need the widget's
            // `dataBinding.datasetId`, which lives outside their own field —
            // `config.formData` is how a JsonForms control reaches sibling
            // data (mirrors `SemanticLayerModal`'s `config={{ formData }}`).
            onChange={({ data }) => {
              const nextRaw = data as WidgetProps;
              if (JSON.stringify(nextRaw) === propsKey) return;

              // A field that depends on another (e.g. `column` on
              // `datasetId`) shouldn't keep a value the new dependency no
              // longer supports — clear it rather than carry a stale
              // selection across the switch. Mirrors `SemanticLayerModal`'s
              // identical rule.
              const dynamicDeps = dynamicDepsRef.current;
              let next = nextRaw;
              if (Object.keys(dynamicDeps).length > 0) {
                const cleared: WidgetProps = {};
                Object.entries(dynamicDeps).forEach(([field, deps]) => {
                  const externalDeps = deps.filter(dep => dep !== field);
                  if (externalDeps.length === 0) return;
                  const depsChanged = externalDeps.some(
                    dep =>
                      JSON.stringify(props[dep]) !==
                      JSON.stringify(nextRaw[dep]),
                  );
                  if (
                    depsChanged &&
                    nextRaw[field] !== undefined &&
                    nextRaw[field] !== ''
                  ) {
                    cleared[field] = undefined;
                  }
                });
                if (Object.keys(cleared).length > 0) {
                  next = { ...nextRaw, ...cleared };
                }
              }

              // Before validation even starts: sibling controls read this
              // off `config.formData` on every render (unlike `data`, which
              // JsonForms only reads at mount), so a control depending on
              // this field sees the pick immediately, regardless of whether
              // it ends up accepted.
              setLiveData(next);

              validateSeqRef.current += 1;
              const seq = validateSeqRef.current;
              commitWidgetProps(nodeId, widgetType, next, {
                // Runs immediately before the actual `updateProps` write, so
                // a superseded validation (a newer edit already bumped
                // `validateSeqRef`) is vetoed here rather than after the
                // fact — by the time `.then()` below can check `seq`, a
                // committed write can no longer be un-committed. Only once
                // accepted does it set the flag telling the resync effect
                // "this `props` change was mine", so it never remounts the
                // form and drops input focus for an edit it made itself.
                onBeforeCommit: () => {
                  if (validateSeqRef.current !== seq) return false;
                  selfEditRef.current = true;
                  return true;
                },
              })
                .then(result => {
                  if (validateSeqRef.current !== seq) return;
                  setValidationErrors(result.ok ? [] : result.errors);
                  // A rejected pick is deliberately left in place — both in
                  // JsonForms' own (uncontrolled) field and in `liveData` —
                  // rather than reverted: `dataBinding`'s required fields can
                  // only ever validate together, so building up a fresh
                  // widget means picking one, seeing it rejected, and then
                  // picking the next one the sibling control can now offer
                  // (thanks to `liveData` already reflecting the first pick).
                  // Reverting on every individual rejection would undo each
                  // step as soon as it's made, and a new widget could never
                  // reach a valid state at all.
                  if (result.ok) maybeRefreshSchema(next);
                })
                .catch(async e => {
                  if (validateSeqRef.current !== seq) return;
                  const message = await describeError(e);
                  setValidationErrors([{ loc: [], message }]);
                });
            }}
          />
        </FormShell>
      )}
      {validationErrors.length > 0 && (
        <div data-test="schema-control-panel-validation-errors">
          {validationErrors.map(err => (
            <Typography.Text
              key={`${err.loc.join('.')}:${err.message}`}
              type="danger"
            >
              {err.loc.length > 0 ? `${err.loc.join('.')}: ` : ''}
              {err.message}
            </Typography.Text>
          ))}
        </div>
      )}
    </>
  );
}
