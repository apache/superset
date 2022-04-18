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
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import Split from 'react-split';
import { css, styled, SupersetClient, useTheme } from '@superset-ui/core';
import { useResizeDetector } from 'react-resize-detector';
import { chartPropShape } from 'src/dashboard/util/propShapes';
import ChartContainer from 'src/components/Chart/ChartContainer';
import {
  getItem,
  setItem,
  LocalStorageKeys,
} from 'src/utils/localStorageHelpers';
import { DataTablesPane } from './DataTablesPane';
import { buildV1ChartDataPayload } from '../exploreUtils';
import { ChartPills } from './ChartPills';

const propTypes = {
  actions: PropTypes.object.isRequired,
  onQuery: PropTypes.func,
  can_overwrite: PropTypes.bool.isRequired,
  can_download: PropTypes.bool.isRequired,
  datasource: PropTypes.object,
  dashboardId: PropTypes.number,
  column_formats: PropTypes.object,
  containerId: PropTypes.string.isRequired,
  isStarred: PropTypes.bool.isRequired,
  slice: PropTypes.object,
  sliceName: PropTypes.string,
  table_name: PropTypes.string,
  vizType: PropTypes.string.isRequired,
  form_data: PropTypes.object,
  ownState: PropTypes.object,
  standalone: PropTypes.number,
  force: PropTypes.bool,
  timeout: PropTypes.number,
  refreshOverlayVisible: PropTypes.bool,
  chart: chartPropShape,
  errorMessage: PropTypes.node,
  triggerRender: PropTypes.bool,
};

const GUTTER_SIZE_FACTOR = 1.25;

const INITIAL_SIZES = [100, 0];
const MIN_SIZES = [300, 65];
const DEFAULT_SOUTH_PANE_HEIGHT_PERCENT = 40;

const Styles = styled.div`
  display: flex;
  flex-direction: column;
  align-items: stretch;
  align-content: stretch;
  overflow: auto;
  box-shadow: none;
  height: 100%;

  & > div {
    height: 100%;
  }

  .gutter {
    border-top: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
    border-bottom: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
    width: ${({ theme }) => theme.gridUnit * 9}px;
    margin: ${({ theme }) => theme.gridUnit * GUTTER_SIZE_FACTOR}px auto;
  }

  .gutter.gutter-vertical {
    cursor: row-resize;
  }

  .ant-collapse {
    .ant-tabs {
      height: 100%;
      .ant-tabs-nav {
        padding-left: ${({ theme }) => theme.gridUnit * 5}px;
        margin: 0;
      }
      .ant-tabs-content-holder {
        overflow: hidden;
        .ant-tabs-content {
          height: 100%;
        }
      }
    }
  }
`;

const ExploreChartPanel = ({
  chart,
  slice,
  vizType,
  ownState,
  triggerRender,
  force,
  datasource,
  errorMessage,
  form_data: formData,
  onQuery,
  refreshOverlayVisible,
  actions,
  timeout,
  standalone,
}) => {
  const theme = useTheme();
  const gutterMargin = theme.gridUnit * GUTTER_SIZE_FACTOR;
  const gutterHeight = theme.gridUnit * GUTTER_SIZE_FACTOR;
  const {
    width: chartPanelWidth,
    height: chartPanelHeight,
    ref: chartPanelRef,
  } = useResizeDetector({
    refreshMode: 'debounce',
    refreshRate: 300,
  });
  const [splitSizes, setSplitSizes] = useState(
    getItem(LocalStorageKeys.chart_split_sizes, INITIAL_SIZES),
  );
  const updateQueryContext = useCallback(
    async function fetchChartData() {
      if (slice && slice.query_context === null) {
        const queryContext = buildV1ChartDataPayload({
          formData: slice.form_data,
          force,
          resultFormat: 'json',
          resultType: 'full',
          setDataMask: null,
          ownState: null,
        });

        await SupersetClient.put({
          endpoint: `/api/v1/chart/${slice.slice_id}`,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query_context: JSON.stringify(queryContext),
            query_context_generation: true,
          }),
        });
      }
    },
    [slice],
  );

  useEffect(() => {
    updateQueryContext();
  }, [updateQueryContext]);

  useEffect(() => {
    setItem(LocalStorageKeys.chart_split_sizes, splitSizes);
  }, [splitSizes]);

  const onDragEnd = sizes => {
    setSplitSizes(sizes);
  };

  const refreshCachedQuery = () => {
    actions.postChartFormData(
      formData,
      true,
      timeout,
      chart.id,
      undefined,
      ownState,
    );
  };

  const onCollapseChange = useCallback(isOpen => {
    let splitSizes;
    if (!isOpen) {
      splitSizes = INITIAL_SIZES;
    } else {
      splitSizes = [
        100 - DEFAULT_SOUTH_PANE_HEIGHT_PERCENT,
        DEFAULT_SOUTH_PANE_HEIGHT_PERCENT,
      ];
    }
    setSplitSizes(splitSizes);
  }, []);

  const renderChart = useCallback(
    () => (
      <div
        css={css`
          min-height: 0;
          flex: 1;
        `}
        ref={chartPanelRef}
      >
        {chartPanelWidth && chartPanelHeight && (
          <ChartContainer
            width={Math.floor(chartPanelWidth)}
            height={chartPanelHeight}
            ownState={ownState}
            annotationData={chart.annotationData}
            chartAlert={chart.chartAlert}
            chartStackTrace={chart.chartStackTrace}
            chartId={chart.id}
            chartStatus={chart.chartStatus}
            triggerRender={triggerRender}
            force={force}
            datasource={datasource}
            errorMessage={errorMessage}
            formData={formData}
            onQuery={onQuery}
            queriesResponse={chart.queriesResponse}
            refreshOverlayVisible={refreshOverlayVisible}
            setControlValue={actions.setControlValue}
            timeout={timeout}
            triggerQuery={chart.triggerQuery}
            vizType={vizType}
          />
        )}
      </div>
    ),
    [
      actions.setControlValue,
      chart.annotationData,
      chart.chartAlert,
      chart.chartStackTrace,
      chart.chartStatus,
      chart.id,
      chart.queriesResponse,
      chart.triggerQuery,
      chartPanelHeight,
      chartPanelRef,
      chartPanelWidth,
      datasource,
      errorMessage,
      force,
      formData,
      onQuery,
      ownState,
      refreshOverlayVisible,
      timeout,
      triggerRender,
      vizType,
    ],
  );

  const panelBody = useMemo(
    () => (
      <div
        className="panel-body"
        css={css`
          display: flex;
          flex-direction: column;
        `}
      >
        <ChartPills
          queriesResponse={chart.queriesResponse}
          chartStatus={chart.chartStatus}
          chartUpdateStartTime={chart.chartUpdateStartTime}
          chartUpdateEndTime={chart.chartUpdateEndTime}
          refreshCachedQuery={refreshCachedQuery}
          rowLimit={formData?.row_limit}
        />
        {renderChart()}
      </div>
    ),
    [chartPanelRef, renderChart],
  );

  const standaloneChartBody = useMemo(() => renderChart(), [renderChart]);

  const [queryFormData, setQueryFormData] = useState(chart.latestQueryFormData);

  useEffect(() => {
    // only update when `latestQueryFormData` changes AND `triggerRender`
    // is false. No update should be done when only `triggerRender` changes,
    // as this can trigger a query downstream based on incomplete form data.
    // (`latestQueryFormData` is only updated when a a valid request has been
    // triggered).
    if (!triggerRender) {
      setQueryFormData(chart.latestQueryFormData);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chart.latestQueryFormData]);

  if (standalone) {
    // dom manipulation hack to get rid of the boostrap theme's body background
    const standaloneClass = 'background-transparent';
    const bodyClasses = document.body.className.split(' ');
    if (!bodyClasses.includes(standaloneClass)) {
      document.body.className += ` ${standaloneClass}`;
    }
    return standaloneChartBody;
  }

  const elementStyle = (dimension, elementSize, gutterSize) => ({
    [dimension]: `calc(${elementSize}% - ${gutterSize + gutterMargin}px)`,
  });

  return (
    <Styles className="panel panel-default chart-container">
      {vizType === 'filter_box' ? (
        panelBody
      ) : (
        <Split
          sizes={splitSizes}
          minSize={MIN_SIZES}
          direction="vertical"
          gutterSize={gutterHeight}
          onDragEnd={onDragEnd}
          elementStyle={elementStyle}
          expandToMin
        >
          {panelBody}
          <DataTablesPane
            ownState={ownState}
            queryFormData={queryFormData}
            onCollapseChange={onCollapseChange}
            chartStatus={chart.chartStatus}
            errorMessage={errorMessage}
            queriesResponse={chart.queriesResponse}
          />
        </Split>
      )}
    </Styles>
  );
};

ExploreChartPanel.propTypes = propTypes;

export default ExploreChartPanel;
