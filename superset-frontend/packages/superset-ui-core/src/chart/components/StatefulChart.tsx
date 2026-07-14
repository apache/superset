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

import { useState, useEffect, useRef, useCallback } from 'react';
import { isEqual } from 'lodash';
import { ParentSize } from '@visx/responsive';
import { t } from '@apache-superset/core/translation';
import {
  QueryFormData,
  QueryData,
  JsonObject,
  SupersetClientInterface,
  buildQueryContext,
  RequestConfig,
  getClientErrorObject,
  ensureIsArray,
} from '../..';
import { Loading } from '../../components/Loading';
import ChartClient from '../clients/ChartClient';
import getChartBuildQueryRegistry from '../registries/ChartBuildQueryRegistrySingleton';
import getChartMetadataRegistry from '../registries/ChartMetadataRegistrySingleton';
import getChartControlPanelRegistry from '../registries/ChartControlPanelRegistrySingleton';
import SuperChart from './SuperChart';

// Using more specific states that align with chart loading process
type LoadingState = 'uninitialized' | 'loading' | 'loaded' | 'error';

/**
 * Known shared controls that have renderTrigger: true.
 * These are controls defined in sharedControls that only affect rendering,
 * not data fetching. When these controls change, we should re-render
 * without refetching data.
 *
 * This list is needed because string-based control references (e.g., ['zoomable'])
 * cannot be introspected for their renderTrigger property without importing
 * sharedControls, which would create a circular dependency.
 */
const RENDER_TRIGGER_SHARED_CONTROLS = new Set([
  'zoomable',
  'color_scheme',
  'time_shift_color',
  'y_axis_format',
  'currency_format',
]);

/**
 * Helper function to determine if data should be refetched based on formData changes
 * @param prevFormData Previous formData
 * @param nextFormData New formData
 * @param vizType Chart visualization type
 * @returns true if data should be refetched, false if only re-render is needed
 */
function shouldRefetchData(
  prevFormData: QueryFormData | undefined,
  nextFormData: QueryFormData | undefined,
  vizType: string | undefined,
): boolean {
  // If no previous formData or viz types don't match, always refetch
  if (!prevFormData || !nextFormData || !vizType) {
    return true;
  }

  // If viz_type changed, always refetch
  if (prevFormData.viz_type !== nextFormData.viz_type) {
    return true;
  }

  try {
    // Try to get control panel configuration
    const controlPanel = getChartControlPanelRegistry().get(vizType);
    if (!controlPanel || !controlPanel.controlPanelSections) {
      // If no control panel config available, be conservative and refetch
      return true;
    }

    // Build a map of control names to their renderTrigger status
    const renderTriggerControls = new Set<string>();
    controlPanel.controlPanelSections.forEach((section: any) => {
      if (section.controlSetRows) {
        section.controlSetRows.forEach((row: any) => {
          row.forEach((control: any) => {
            // Handle string references to shared controls with renderTrigger
            if (
              typeof control === 'string' &&
              RENDER_TRIGGER_SHARED_CONTROLS.has(control)
            ) {
              renderTriggerControls.add(control);
            } else if (control && typeof control === 'object') {
              const controlName = control.name || control.config?.name;
              if (controlName && control.config?.renderTrigger === true) {
                renderTriggerControls.add(controlName);
              }
            }
          });
        });
      }
    });

    // Check which fields changed
    const changedFields = Object.keys(nextFormData).filter(
      key =>
        JSON.stringify(prevFormData[key]) !== JSON.stringify(nextFormData[key]),
    );

    // If no fields changed, no need to refetch
    if (changedFields.length === 0) {
      return false;
    }

    // Check if all changed fields are renderTrigger controls
    const allChangesAreRenderTrigger = changedFields.every(field =>
      renderTriggerControls.has(field),
    );

    // Only skip refetch if ALL changes are renderTrigger-only
    return !allChangesAreRenderTrigger;
  } catch (error) {
    // If there's any error accessing the registry, be conservative and refetch
    return true;
  }
}

export interface StatefulChartProps {
  // Option 1: Provide chartId to load saved chart
  chartId?: number;

  // Option 2: Provide formData directly
  formData?: QueryFormData;

  // Option 3: Override specific formData fields
  formDataOverrides?: Partial<QueryFormData>;

  // Chart type (required if using formData without viz_type)
  chartType?: string;

  // Chart dimensions
  width?: number | string;
  height?: number | string;

  // Event handlers
  onLoad?: (data: QueryData[]) => void;
  onError?: (error: Error) => void;
  onRenderSuccess?: () => void;
  onRenderFailure?: (error: Error) => void;

  // Data fetching options
  force?: boolean;
  timeout?: number;

  // UI options
  showLoading?: boolean;
  loadingComponent?: React.ComponentType;
  errorComponent?: React.ComponentType<{ error: Error }>;
  noDataComponent?: React.ComponentType;

  // Advanced options
  client?: SupersetClientInterface;
  disableErrorBoundary?: boolean;
  enableNoResults?: boolean;

  // Additional SuperChart props
  id?: string;
  className?: string;

  // Hooks for chart interactions (drill, cross-filter, etc.)
  hooks?: any;
}

export default function StatefulChart(props: StatefulChartProps) {
  const [status, setStatus] = useState<LoadingState>('uninitialized');
  const [data, setData] = useState<QueryData[]>();
  const [error, setError] = useState<Error>();
  const [formData, setFormData] = useState<QueryFormData>();

  const chartClientRef = useRef<ChartClient>();
  const abortControllerRef = useRef<AbortController>();

  // fetchData is memoized with an empty dep list, so it would otherwise close
  // over the first render's props. Keep the latest props in a ref so refetches
  // (triggered by updated filters/formData/overrides) use current values.
  const propsRef = useRef(props);
  propsRef.current = props;

  // Initialize chart client
  if (!chartClientRef.current) {
    chartClientRef.current = new ChartClient({ client: props.client });
  }

  const fetchData = useCallback(async () => {
    const {
      chartId,
      formData: propsFormData,
      formDataOverrides,
      chartType,
      force,
      timeout,
      hooks,
    } = propsRef.current;

    // Cancel any in-flight requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller (kept in a local so we can detect when this
    // request has been superseded by a newer one, even across async awaits).
    const controller = new AbortController();
    abortControllerRef.current = controller;

    // A request is superseded if it was aborted, or if the props changed in a
    // data-affecting way since it began - including switching between chartId
    // and direct-formData modes. Props are captured during render but the abort
    // happens in a passive effect, so the abort signal alone can let a stale
    // success or error slip through in the render->effect gap. This mirrors the
    // effect's own refetch decision; render-only changes are intentionally not
    // treated as superseding.
    const isSuperseded = () => {
      if (controller.signal.aborted) {
        return true;
      }
      const latest = propsRef.current;
      const vizTypeForCompare = latest.formData?.viz_type || latest.chartType;
      return (
        latest.chartId !== chartId ||
        // Deep compare overrides: callers commonly pass a fresh object with the
        // same contents each render, which should not count as superseding.
        !isEqual(latest.formDataOverrides, formDataOverrides) ||
        latest.force !== force ||
        Boolean(propsFormData) !== Boolean(latest.formData) ||
        (!!propsFormData &&
          !!latest.formData &&
          latest.formData !== propsFormData &&
          shouldRefetchData(propsFormData, latest.formData, vizTypeForCompare))
      );
    };

    setStatus('loading');
    setError(undefined);

    try {
      let finalFormData: QueryFormData;

      if (chartId && !propsFormData) {
        // Load formData from chartId
        finalFormData = await chartClientRef.current!.loadFormData(
          { sliceId: chartId },
          { signal: controller.signal } as RequestConfig,
        );
      } else if (propsFormData) {
        // Use provided formData
        finalFormData = propsFormData;
      } else {
        throw new Error('Either chartId or formData must be provided');
      }

      // Apply overrides if provided
      if (formDataOverrides) {
        finalFormData = { ...finalFormData, ...formDataOverrides };
      }

      // Ensure viz_type is set
      const vizType = finalFormData.viz_type || chartType;
      if (!vizType) {
        throw new Error('Chart type (viz_type) must be specified');
      }
      finalFormData.viz_type = vizType;

      // Get chart metadata
      const { useLegacyApi } = getChartMetadataRegistry().get(vizType) || {};

      // Build query using the chart's buildQuery function
      const buildQuery = await getChartBuildQueryRegistry().get(vizType);
      let queryContext;

      if (buildQuery) {
        queryContext = buildQuery(finalFormData);
      } else {
        // Fallback to default query context builder
        queryContext = buildQueryContext(finalFormData);
      }

      // Ensure query_context is properly formatted for new API
      if (!useLegacyApi && !queryContext.queries) {
        queryContext = { queries: [queryContext] };
      }
      const endpoint = useLegacyApi ? '/explore_json/' : '/api/v1/chart/data';

      const requestConfig: RequestConfig = {
        endpoint,
        signal: controller.signal,
        ...(timeout && { timeout: timeout * 1000 }),
      };

      if (useLegacyApi) {
        requestConfig.postPayload = {
          form_data: {
            ...finalFormData,
            ...(force && { force: true }),
          },
        };
      } else {
        requestConfig.jsonPayload = {
          ...queryContext,
          ...(force && { force: true }),
        };
      }

      const clientResponse =
        await chartClientRef.current!.client.post(requestConfig);

      // A newer request may have started while the POST was in flight; discard
      // this stale response so it can't overwrite the newer chart data.
      if (isSuperseded()) {
        return;
      }

      const rawResponse = clientResponse.response as Response | undefined;

      let responseData: QueryData[];
      if (rawResponse?.status === 202) {
        // With GLOBAL_ASYNC_QUERIES the query is dispatched to a Celery worker
        // and the 202 body is job metadata (channel_id, job_id, result_url),
        // not chart data. Delegate to the injected handler, which polls the
        // async event channel and resolves the cached results. Without a
        // handler we fail loudly rather than rendering the job metadata as if
        // it were an (empty) result set.
        if (!hooks?.handleAsyncChartData) {
          throw new Error(
            'Received an async chart data response (HTTP 202) but no async ' +
              'handler was provided, so results cannot be retrieved. Wire up ' +
              'the async handler or disable GLOBAL_ASYNC_QUERIES for this chart.',
          );
        }
        // The async handler (handleChartDataResponse) expects the V1 chart data
        // response signature. The legacy endpoint returns a flat body, so wrap
        // it as { result: [body] } exactly like legacyChartDataRequest does for
        // the standard chart path; the V1 body is already correctly shaped.
        const asyncPayload = useLegacyApi
          ? ({ result: [clientResponse.json] } as JsonObject)
          : (clientResponse.json as JsonObject);
        responseData = ensureIsArray(
          await hooks.handleAsyncChartData(
            rawResponse,
            asyncPayload,
            useLegacyApi,
            controller.signal,
          ),
        );

        // Async results can resolve well after a newer request began polling.
        if (isSuperseded()) {
          return;
        }
      } else {
        const rows = (
          Array.isArray(clientResponse.json)
            ? clientResponse.json
            : [clientResponse.json]
        ) as JsonObject[];

        // Handle the nested result structure from the new API
        responseData = (
          !useLegacyApi && rows[0]?.result ? rows[0].result : rows
        ) as QueryData[];
      }

      // Don't pair this request's data with newer props or fire a stale onLoad
      // if it has been superseded (see isSuperseded).
      if (isSuperseded()) {
        return;
      }

      const latestProps = propsRef.current;
      setStatus('loaded');
      setData(responseData);
      // Render the resolved data with the latest formData so a render-only
      // change made while the request was in flight isn't reverted.
      setFormData(
        latestProps.formData
          ? {
              ...latestProps.formData,
              ...(latestProps.formDataOverrides || {}),
              viz_type: finalFormData.viz_type,
            }
          : finalFormData,
      );

      // Read onLoad from the latest props (like setFormData above) so a stale
      // callback captured at request start isn't invoked.
      if (latestProps.onLoad) {
        latestProps.onLoad(responseData);
      }
    } catch (err) {
      // Ignore aborted requests, whether they threw AbortError or were
      // superseded by a newer request (including the render->effect gap).
      if ((err as Error)?.name === 'AbortError' || isSuperseded()) {
        return;
      }

      // waitForAsyncData rejects with an array of already-parsed client-error
      // objects; unwrap the first element so its detailed message survives.
      const rawError = Array.isArray(err) ? err[0] : err;

      let errorMessage: string | undefined;
      if (
        rawError &&
        typeof rawError === 'object' &&
        !(rawError instanceof Error) &&
        !(rawError instanceof Response) &&
        typeof (rawError as { error?: unknown }).error === 'string'
      ) {
        // Already a parsed client-error object (e.g. from the async handler);
        // getClientErrorObject would discard its `error` field, so read it here.
        const parsed = rawError as { error?: string; message?: string };
        errorMessage = parsed.error || parsed.message;
      } else {
        const parsedError = await getClientErrorObject(
          rawError as Parameters<typeof getClientErrorObject>[0],
        );
        errorMessage = parsedError.error || parsedError.message;
      }

      const errorObj = new Error(errorMessage || 'An error occurred');

      // The request may have been superseded while its error response was being
      // parsed above (or in the render->effect gap before its abort ran); don't
      // set stale error state or call onError in that case.
      if (isSuperseded()) {
        return;
      }

      setStatus('error');
      setError(errorObj);

      // Read onError from the latest props so a stale callback captured at
      // request start isn't invoked.
      const { onError } = propsRef.current;
      if (onError) {
        onError(errorObj);
      }
    }
  }, []);

  // Combined effect for all prop changes and lifecycle
  const prevPropsRef = useRef<StatefulChartProps>();
  useEffect(() => {
    const currentProps = props;
    const prevProps = prevPropsRef.current;

    // Update ref for next render
    prevPropsRef.current = currentProps;

    // Initial mount or fundamental props changed - always refetch
    if (
      !prevProps ||
      currentProps.chartId !== prevProps.chartId ||
      currentProps.formDataOverrides !== prevProps.formDataOverrides ||
      currentProps.force !== prevProps.force
    ) {
      fetchData();
      return;
    }

    // Check if formData changed
    if (currentProps.formData !== prevProps.formData) {
      // Determine the viz type
      const vizType = currentProps.formData?.viz_type || currentProps.chartType;

      // Check if we need to refetch data or just re-render
      if (
        shouldRefetchData(prevProps.formData, currentProps.formData, vizType)
      ) {
        fetchData();
      } else {
        // Just update the state to trigger re-render without fetching
        setFormData(currentProps.formData);
      }
    }
  }, [
    props.chartId,
    props.formData,
    props.formDataOverrides,
    props.force,
    props.chartType,
  ]);

  // Cleanup effect
  useEffect(
    () => () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    },
    [],
  );

  // Render logic
  const {
    width = '100%',
    height = 400,
    showLoading = true,
    loadingComponent: LoadingComponent,
    errorComponent: ErrorComponent,
    noDataComponent: NoDataComponent,
    disableErrorBoundary,
    enableNoResults = true,
    id,
    className,
    onRenderSuccess,
    onRenderFailure,
    hooks,
  } = props;

  if (status === 'loading' && showLoading) {
    if (LoadingComponent) {
      return <LoadingComponent />;
    }

    // If using percentage sizing, wrap Loading in a container
    if (width === '100%' || height === '100%') {
      return (
        <div style={{ width, height, position: 'relative' }}>
          <Loading position="floating" />
        </div>
      );
    }

    return (
      <div
        style={{
          width: typeof width === 'number' ? `${width}px` : width,
          height: typeof height === 'number' ? `${height}px` : height,
          position: 'relative',
        }}
      >
        <Loading position="floating" />
      </div>
    );
  }

  if (status === 'error' && error) {
    if (ErrorComponent) {
      return <ErrorComponent error={error} />;
    }

    const errorDiv = (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          width: '100%',
          color: 'var(--danger-color)',
          fontSize: '14px',
          padding: '16px',
          textAlign: 'center',
        }}
      >
        {t('Error')}: {error.message}
      </div>
    );

    // If using percentage sizing, wrap in a container
    if (width === '100%' || height === '100%') {
      return <div style={{ width, height }}>{errorDiv}</div>;
    }

    return (
      <div
        style={{
          width: typeof width === 'number' ? `${width}px` : width,
          height: typeof height === 'number' ? `${height}px` : height,
        }}
      >
        {errorDiv}
      </div>
    );
  }

  if (status === 'loaded' && formData && data) {
    // Check if we need dynamic sizing
    const needsDynamicSizing = width === '100%' || height === '100%';

    const renderChart = (
      chartWidth: number | string,
      chartHeight: number | string,
    ) => (
      <SuperChart
        id={id}
        className={className}
        chartType={formData.viz_type}
        width={chartWidth}
        height={chartHeight}
        formData={formData}
        queriesData={data}
        disableErrorBoundary={disableErrorBoundary}
        enableNoResults={enableNoResults}
        noResults={NoDataComponent && <NoDataComponent />}
        onRenderSuccess={onRenderSuccess}
        onRenderFailure={onRenderFailure}
        hooks={hooks}
      />
    );

    if (needsDynamicSizing) {
      return (
        <div style={{ width: '100%', height: '100%' }}>
          <ParentSize>
            {({ width: parentWidth, height: parentHeight }) => {
              const finalWidth = width === '100%' ? parentWidth : width;
              const finalHeight = height === '100%' ? parentHeight : height;
              return renderChart(finalWidth, finalHeight);
            }}
          </ParentSize>
        </div>
      );
    }

    return renderChart(width, height);
  }

  return null;
}
