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
import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  t,
  styled,
  css,
  getChartControlPanelRegistry,
  QueryFormData,
  DatasourceType,
  JsonValue,
  NO_TIME_RANGE,
  usePrevious,
} from '@superset-ui/core';
import {
  JsonFormsControlPanel,
  JsonFormsControlPanelConfig,
  customRenderers,
  supersetControlRenderers,
} from '@superset-ui/chart-controls';
import { JsonForms } from '@jsonforms/react';
import { useSelector } from 'react-redux';
import { Modal } from '@superset-ui/core/components';
import { PluginContext } from 'src/components';
import { ExploreActions } from 'src/explore/actions/exploreActions';
import { ChartState, ExplorePageState } from 'src/explore/types';
import { RunQueryButton } from './RunQueryButton';
import { Operators } from '../constants';
import { Clauses } from './controls/FilterControl/types';
import StashFormDataContainer from './StashFormDataContainer';

const { confirm } = Modal;

const Container = styled.div`
  ${({ theme }: any) => css`
    padding: ${theme.gridUnit * 4}px;
    height: 100%;
    overflow-y: auto;

    .jsonforms-container {
      max-width: 1200px;
      margin: 0 auto;
    }

    .ant-collapse {
      margin-bottom: ${theme.gridUnit * 3}px;
      border: none;
      background: transparent;

      .ant-collapse-item {
        border: 1px solid ${theme.colors.grayscale.light2};
        border-radius: ${theme.borderRadius}px;
        margin-bottom: ${theme.gridUnit * 2}px;

        .ant-collapse-header {
          font-weight: ${theme.typography.weights.bold};
          background: ${theme.colors.grayscale.light5};
          border-radius: ${theme.borderRadius}px ${theme.borderRadius}px 0 0;
        }

        .ant-collapse-content {
          background: white;
        }
      }
    }

    .ant-tabs {
      .ant-tabs-nav {
        margin-bottom: ${theme.gridUnit * 3}px;
      }
    }
  `}
`;

const QueryButtonContainer = styled.div`
  position: sticky;
  bottom: 0;
  padding: ${({ theme }) => theme.gridUnit * 3}px;
  background: ${({ theme }) => theme.colors.grayscale.light5};
  border-top: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

export type ControlPanelsContainerProps = {
  exploreState: ExplorePageState['explore'];
  actions: ExploreActions;
  datasource_type: DatasourceType;
  chart: ChartState;
  form_data: QueryFormData;
  isDatasourceMetaLoading: boolean;
  errorMessage?: React.ReactNode;
  onQuery: () => void;
  onStop: () => void;
  canStopQuery: boolean;
  chartIsStale: boolean;
};

/**
 * Control Panels Container using JSON Forms
 * This replaces the legacy array-based control panel system
 */
export const ControlPanelsContainer = (props: ControlPanelsContainerProps) => {
  const pluginContext = useContext(PluginContext);
  const [formData, setFormData] = useState(props.form_data);
  const { actions, exploreState } = props;
  const { setControlValue } = actions;

  const defaultTimeFilter = useSelector<ExplorePageState>(
    state => state.common?.conf?.DEFAULT_TIME_FILTER || NO_TIME_RANGE,
  );

  // Get the control panel configuration from the registry
  const controlPanelConfig = useMemo(() => {
    const vizType = props.form_data.viz_type;
    if (!vizType) return null;

    const registry = getChartControlPanelRegistry();
    const config = registry.get(vizType);

    // Check if it's a JSON Forms config
    if (config && 'schema' in config && 'uischema' in config) {
      return config as JsonFormsControlPanelConfig;
    }

    // Legacy config - should be migrated
    console.warn(
      `Control panel for ${vizType} is using legacy format. Please migrate to JSON Forms.`,
    );
    return null;
  }, [props.form_data.viz_type]);

  // Handle form data changes
  const handleChange = useCallback(
    ({ data, errors }: any) => {
      // Update each changed field
      Object.keys(data).forEach(key => {
        if (data[key] !== formData[key]) {
          setControlValue(key, data[key]);
        }
      });
      setFormData(data);
    },
    [formData, setControlValue],
  );

  // Handle X-axis temporal filter
  const previousXAxis = usePrevious(formData.x_axis);
  useEffect(() => {
    const { x_axis, adhoc_filters } = formData;

    if (
      x_axis &&
      x_axis !== previousXAxis &&
      exploreState.datasource &&
      'columns' in exploreState.datasource
    ) {
      // Check if x_axis is temporal
      const column = exploreState.datasource.columns?.find(
        col => col.column_name === x_axis,
      );

      if (column?.is_dttm) {
        const noFilter = !adhoc_filters?.find(
          (filter: any) =>
            filter.expressionType === 'SIMPLE' &&
            filter.operator === Operators.TemporalRange &&
            filter.subject === x_axis,
        );

        if (noFilter) {
          confirm({
            title: t('The X-axis is not on the filters list'),
            content: t(
              'The X-axis is not on the filters list which will prevent it from being used in ' +
                'time range filters in dashboards. Would you like to add it to the filters list?',
            ),
            onOk: () => {
              setControlValue('adhoc_filters', [
                ...(adhoc_filters || []),
                {
                  clause: Clauses.Where,
                  subject: x_axis,
                  operator: Operators.TemporalRange,
                  comparator: defaultTimeFilter,
                  expressionType: 'SIMPLE',
                },
              ]);
            },
          });
        }
      }
    }
  }, [
    formData.x_axis,
    previousXAxis,
    exploreState.datasource,
    defaultTimeFilter,
    setControlValue,
  ]);

  // Combine renderers
  const allRenderers = useMemo(
    () => [...supersetControlRenderers, ...customRenderers],
    [],
  );

  if (!controlPanelConfig) {
    return (
      <Container>
        <div>No control panel configuration found for this chart type.</div>
      </Container>
    );
  }

  return (
    <>
      <Container>
        <StashFormDataContainer />
        <div className="jsonforms-container">
          <JsonForms
            schema={controlPanelConfig.schema}
            uischema={controlPanelConfig.uischema}
            data={formData}
            renderers={allRenderers}
            onChange={handleChange}
          />
        </div>
      </Container>

      <QueryButtonContainer>
        <RunQueryButton
          onQuery={props.onQuery}
          onStop={props.onStop}
          canStopQuery={props.canStopQuery}
          loading={props.chart.chartStatus === 'loading'}
          chartIsStale={props.chartIsStale}
          errorMessage={props.errorMessage}
        />
      </QueryButtonContainer>
    </>
  );
};

export default ControlPanelsContainer;
