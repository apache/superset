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
import { styled, useTheme } from '@superset-ui/core';
import { useResizeDetector } from 'react-resize-detector';
import { chartPropShape } from 'src/dashboard/util/propShapes';
import ChartContainer from 'src/chart/ChartContainer';
import {
  getFromLocalStorage,
  setInLocalStorage,
} from 'src/utils/localStorageHelpers';
import ConnectedExploreChartHeader from './ExploreChartHeader';
import { DataTablesPane } from './DataTablesPane';

const propTypes = {
  actions: PropTypes.object.isRequired,
  addHistory: PropTypes.func,
  onQuery: PropTypes.func,
  can_overwrite: PropTypes.bool.isRequired,
  can_download: PropTypes.bool.isRequired,
  datasource: PropTypes.object,
  column_formats: PropTypes.object,
  containerId: PropTypes.string.isRequired,
  height: PropTypes.string.isRequired,
  width: PropTypes.string.isRequired,
  isStarred: PropTypes.bool.isRequired,
  slice: PropTypes.object,
  sliceName: PropTypes.string,
  table_name: PropTypes.string,
  vizType: PropTypes.string.isRequired,
  form_data: PropTypes.object,
  standalone: PropTypes.number,
  timeout: PropTypes.number,
  refreshOverlayVisible: PropTypes.bool,
  chart: chartPropShape,
  errorMessage: PropTypes.node,
  triggerRender: PropTypes.bool,
};

const GUTTER_SIZE_FACTOR = 1.25;

const CHART_PANEL_PADDING = 30;
const HEADER_PADDING = 15;

const STORAGE_KEYS = {
  sizes: 'chart_split_sizes',
};

const INITIAL_SIZES = [90, 10];
const MIN_SIZES = [300, 50];
const DEFAULT_SOUTH_PANE_HEIGHT_PERCENT = 40;

const Styles = styled.div`
  display: flex;
  flex-direction: column;
  align-items: stretch;
  align-content: stretch;
  overflow: auto;
  box-shadow: none;
  height: 100%;

  & > div:last-of-type {
    flex-basis: 100%;
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

const ExploreChartPanel = props => {
  const theme = useTheme();
  const gutterMargin = theme.gridUnit * GUTTER_SIZE_FACTOR;
  const gutterHeight = theme.gridUnit * GUTTER_SIZE_FACTOR;

  const { height: hHeight, ref: headerRef } = useResizeDetector({
    refreshMode: 'debounce',
    refreshRate: 300,
  });
  const { width: chartWidth, ref: chartRef } = useResizeDetector({
    refreshMode: 'debounce',
    refreshRate: 300,
  });
  const [splitSizes, setSplitSizes] = useState(
    getFromLocalStorage(STORAGE_KEYS.sizes, INITIAL_SIZES),
  );

  const calcSectionHeight = useCallback(
    percent => {
      let headerHeight;
      if (props.standalone) {
        headerHeight = 0;
      } else if (hHeight) {
        headerHeight = hHeight + HEADER_PADDING;
      } else {
        headerHeight = 50;
      }
      const containerHeight = parseInt(props.height, 10) - headerHeight;
      return (
        (containerHeight * percent) / 100 - (gutterHeight / 2 + gutterMargin)
      );
    },
    [gutterHeight, gutterMargin, props.height, props.standalone, hHeight],
  );

  const [tableSectionHeight, setTableSectionHeight] = useState(
    calcSectionHeight(INITIAL_SIZES[1]),
  );

  const recalcPanelSizes = useCallback(
    ([, southPercent]) => {
      setTableSectionHeight(calcSectionHeight(southPercent));
    },
    [calcSectionHeight],
  );

  useEffect(() => {
    recalcPanelSizes(splitSizes);
  }, [recalcPanelSizes, splitSizes]);

  useEffect(() => {
    setInLocalStorage(STORAGE_KEYS.sizes, splitSizes);
  }, [splitSizes]);

  const onDragEnd = sizes => {
    setSplitSizes(sizes);
  };

  const onCollapseChange = openPanelName => {
    let splitSizes;
    if (!openPanelName) {
      splitSizes = INITIAL_SIZES;
    } else {
      splitSizes = [
        100 - DEFAULT_SOUTH_PANE_HEIGHT_PERCENT,
        DEFAULT_SOUTH_PANE_HEIGHT_PERCENT,
      ];
    }
    setSplitSizes(splitSizes);
  };

  const renderChart = useCallback(() => {
    const { chart } = props;
    const newHeight = calcSectionHeight(splitSizes[0]) - CHART_PANEL_PADDING;
    return (
      chartWidth > 0 && (
        <ChartContainer
          width={Math.floor(chartWidth)}
          height={newHeight}
          annotationData={chart.annotationData}
          chartAlert={chart.chartAlert}
          chartStackTrace={chart.chartStackTrace}
          chartId={chart.id}
          chartStatus={chart.chartStatus}
          triggerRender={props.triggerRender}
          datasource={props.datasource}
          errorMessage={props.errorMessage}
          formData={props.form_data}
          onQuery={props.onQuery}
          owners={props?.slice?.owners}
          queriesResponse={chart.queriesResponse}
          refreshOverlayVisible={props.refreshOverlayVisible}
          setControlValue={props.actions.setControlValue}
          timeout={props.timeout}
          triggerQuery={chart.triggerQuery}
          vizType={props.vizType}
        />
      )
    );
  }, [calcSectionHeight, chartWidth, props, splitSizes]);

  const panelBody = useMemo(
    () => (
      <div className="panel-body" ref={chartRef}>
        {renderChart()}
      </div>
    ),
    [chartRef, renderChart],
  );

  const standaloneChartBody = useMemo(
    () => <div ref={chartRef}>{renderChart()}</div>,
    [chartRef, renderChart],
  );

  if (props.standalone) {
    // dom manipulation hack to get rid of the boostrap theme's body background
    const standaloneClass = 'background-transparent';
    const bodyClasses = document.body.className.split(' ');
    if (!bodyClasses.includes(standaloneClass)) {
      document.body.className += ` ${standaloneClass}`;
    }
    return standaloneChartBody;
  }

  const header = (
    <ConnectedExploreChartHeader
      actions={props.actions}
      addHistory={props.addHistory}
      can_overwrite={props.can_overwrite}
      can_download={props.can_download}
      chartHeight={props.height}
      isStarred={props.isStarred}
      slice={props.slice}
      sliceName={props.sliceName}
      table_name={props.table_name}
      form_data={props.form_data}
      timeout={props.timeout}
      chart={props.chart}
    />
  );

  const elementStyle = (dimension, elementSize, gutterSize) => ({
    [dimension]: `calc(${elementSize}% - ${gutterSize + gutterMargin}px)`,
  });

  return (
    <Styles className="panel panel-default chart-container">
      <div className="panel-heading" ref={headerRef}>
        {header}
      </div>
      {props.vizType === 'filter_box' ? (
        panelBody
      ) : (
        <Split
          sizes={splitSizes}
          minSize={MIN_SIZES}
          direction="vertical"
          gutterSize={gutterHeight}
          onDragEnd={onDragEnd}
          elementStyle={elementStyle}
        >
          {panelBody}
          <DataTablesPane
            queryFormData={props.chart.latestQueryFormData}
            tableSectionHeight={tableSectionHeight}
            onCollapseChange={onCollapseChange}
            chartStatus={props.chart.chartStatus}
          />
        </Split>
      )}
    </Styles>
  );
};

ExploreChartPanel.propTypes = propTypes;

export default ExploreChartPanel;
