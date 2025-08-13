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
import React, { useMemo } from 'react';
import { styled, css, getChartControlPanelRegistry } from '@superset-ui/core';
import { ChartState, ExplorePageState } from 'src/explore/types';
import { ExploreActions } from 'src/explore/actions/exploreActions';
import { RunQueryButton } from './RunQueryButton';

const Container = styled.div`
  ${({ theme }: any) => css`
    padding: ${theme.gridUnit * 4}px;
    height: 100%;
    overflow-y: auto;

    .control-panel {
      max-width: 1200px;
      margin: 0 auto;
    }
  `}
`;

const QueryButtonContainer = styled.div`
  position: sticky;
  bottom: 0;
  padding: ${({ theme }: any) => theme.gridUnit * 3}px;
  background: ${({ theme }: any) => theme.colors.grayscale.light5};
  border-top: 1px solid ${({ theme }: any) => theme.colors.grayscale.light2};
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

export interface ControlPanelsContainerProps {
  exploreState: ExplorePageState['explore'];
  actions: ExploreActions;
  form_data: any;
  chart: ChartState;
  errorMessage?: React.ReactNode;
  isDatasourceMetaLoading: boolean;
  onQuery: () => void;
  onStop: () => void;
  canStopQuery: boolean;
  chartIsStale: boolean;
}

/**
 * New Control Panels Container that supports React component control panels
 */
export const ControlPanelsContainerNew: React.FC<
  ControlPanelsContainerProps
> = ({
  form_data,
  chart,
  onQuery,
  onStop,
  canStopQuery,
  chartIsStale,
  errorMessage,
}) => {
  // Get the control panel component from the registry
  const ControlPanelComponent = useMemo(() => {
    const vizType = form_data.viz_type;
    console.log('ControlPanelsContainerNew - viz_type:', vizType);
    if (!vizType) return null;

    const registry = getChartControlPanelRegistry();
    const config = registry.get(vizType);
    console.log('ControlPanelsContainerNew - config:', config);

    // Check if it has a ControlPanel property that's a React component
    if (
      config &&
      config.ControlPanel &&
      typeof config.ControlPanel === 'function'
    ) {
      console.log(
        'ControlPanelsContainerNew - Found React component in ControlPanel property',
      );
      return config.ControlPanel;
    }

    // For React components, the config itself IS the component
    if (config && typeof config === 'function') {
      console.log('ControlPanelsContainerNew - Found React component');
      return config;
    }

    console.log('ControlPanelsContainerNew - No React component found');
    return null;
  }, [form_data.viz_type]);

  if (!ControlPanelComponent) {
    return (
      <Container>
        <div>No control panel found for chart type: {form_data.viz_type}</div>
      </Container>
    );
  }

  return (
    <>
      <Container>
        <ControlPanelComponent />
      </Container>

      <QueryButtonContainer>
        <RunQueryButton
          onQuery={onQuery}
          onStop={onStop}
          canStopQuery={canStopQuery}
          loading={chart.chartStatus === 'loading'}
          chartIsStale={chartIsStale}
          errorMessage={errorMessage}
          isNewChart={!chart.queriesResponse}
        />
      </QueryButtonContainer>
    </>
  );
};

export default ControlPanelsContainerNew;
