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
import { ParentSize } from '@visx/responsive';
import {
  QueryFormData,
  QueryData,
  SupersetClientInterface,
  buildQueryContext,
  RequestConfig,
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
            if (control && typeof control === 'object') {
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

  // Initialize chart client
  if (!chartClientRef.current) {
    chartClientRef.current = new ChartClient({ client: props.client });
  }

  const fetchData = useCallback(async () => {
    const {
      chartId,
      formData: propsFormData,
      formDataOverrides,
      onError,
      onLoad,
      chartType,
      force,
      timeout,
    } = props;

    // Cancel any in-flight requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController();

    setStatus('loading');
    setError(undefined);

    try {
      let finalFormData: QueryFormData;

      if (chartId && !propsFormData) {
        // Load formData from chartId
        finalFormData = await chartClientRef.current!.loadFormData(
          { sliceId: chartId },
          { signal: abortControllerRef.current.signal } as RequestConfig,
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
      const endpoint = useLegacyApi
        ? '/superset/explore_json/'
        : '/api/v1/chart/data';

      const requestConfig: RequestConfig = {
        endpoint,
        signal: abortControllerRef.current.signal,
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

      const response = await chartClientRef.current!.client.post(requestConfig);
      let responseData = Array.isArray(response.json)
        ? response.json
        : [response.json];

      // Handle the nested result structure from the new API
      if (!useLegacyApi && responseData[0]?.result) {
        responseData = responseData[0].result;
      }

      setStatus('loaded');
      setData(responseData);
      setFormData(finalFormData);

      if (onLoad) {
        onLoad(responseData);
      }
    } catch (err) {
      // Ignore abort errors
      if (err.name === 'AbortError') {
        return;
      }

      const errorObj = err as Error;
      setStatus('error');
      setError(errorObj);

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
        Error: {error.message}
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
