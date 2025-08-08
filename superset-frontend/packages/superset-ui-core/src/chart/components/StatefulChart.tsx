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

import { Component } from 'react';
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
import SuperChart from './SuperChart';

type LoadingState = 'uninitialized' | 'loading' | 'loaded' | 'error';

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

interface StatefulChartState {
  status: LoadingState;
  data?: QueryData[];
  error?: Error;
  formData?: QueryFormData;
}

export default class StatefulChart extends Component<
  StatefulChartProps,
  StatefulChartState
> {
  private chartClient: ChartClient;

  private abortController?: AbortController;

  constructor(props: StatefulChartProps) {
    super(props);
    this.state = {
      status: 'uninitialized',
    };
    this.chartClient = new ChartClient({ client: props.client });
  }

  componentDidMount() {
    this.fetchData();
  }

  componentDidUpdate(prevProps: StatefulChartProps) {
    const { chartId, formData, formDataOverrides, force } = this.props;

    if (
      chartId !== prevProps.chartId ||
      formData !== prevProps.formData ||
      formDataOverrides !== prevProps.formDataOverrides ||
      force !== prevProps.force
    ) {
      this.fetchData();
    }
  }

  componentWillUnmount() {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  private async fetchData() {
    const { chartId, formData, formDataOverrides, onError, onLoad } =
      this.props;

    // Cancel any in-flight requests
    if (this.abortController) {
      this.abortController.abort();
    }

    // Create new abort controller
    this.abortController = new AbortController();

    this.setState({ status: 'loading', error: undefined });

    try {
      let finalFormData: QueryFormData;

      if (chartId && !formData) {
        // Load formData from chartId
        finalFormData = await this.chartClient.loadFormData(
          { sliceId: chartId },
          { signal: this.abortController.signal } as RequestConfig,
        );
      } else if (formData) {
        // Use provided formData
        finalFormData = formData;
      } else {
        throw new Error('Either chartId or formData must be provided');
      }

      // Apply overrides if provided
      if (formDataOverrides) {
        finalFormData = { ...finalFormData, ...formDataOverrides };
      }

      // Ensure viz_type is set
      const vizType = finalFormData.viz_type || this.props.chartType;
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
        signal: this.abortController.signal,
        ...(this.props.timeout && { timeout: this.props.timeout * 1000 }),
      };

      if (useLegacyApi) {
        requestConfig.postPayload = {
          form_data: {
            ...finalFormData,
            ...(this.props.force && { force: true }),
          },
        };
      } else {
        requestConfig.jsonPayload = {
          ...queryContext,
          ...(this.props.force && { force: true }),
        };
      }

      const response = await this.chartClient.client.post(requestConfig);
      let data = Array.isArray(response.json) ? response.json : [response.json];

      // Handle the nested result structure from the new API
      if (!useLegacyApi && data[0]?.result) {
        data = data[0].result;
      }

      this.setState({
        status: 'loaded',
        data,
        formData: finalFormData,
      });

      if (onLoad) {
        onLoad(data);
      }
    } catch (error) {
      // Ignore abort errors
      if (error.name === 'AbortError') {
        return;
      }

      this.setState({
        status: 'error',
        error: error as Error,
      });

      if (onError) {
        onError(error as Error);
      }
    }
  }

  render() {
    const { status, data, formData, error } = this.state;
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
    } = this.props;

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
          hooks={this.props.hooks}
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
}
