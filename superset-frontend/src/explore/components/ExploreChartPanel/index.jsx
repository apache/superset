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
import { useState, useEffect, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import Split from 'react-split';
import {
  css,
  DatasourceType,
  ensureIsArray,
  isFeatureEnabled,
  FeatureFlag,
  getChartMetadataRegistry,
  styled,
  SupersetClient,
  t,
  useTheme,
} from '@superset-ui/core';
import { chartPropShape } from 'src/dashboard/util/propShapes';
import ChartContainer from 'src/components/Chart/ChartContainer';
import {
  getItem,
  setItem,
  LocalStorageKeys,
} from 'src/utils/localStorageHelpers';
import Alert from 'src/components/Alert';
import { SaveDatasetModal } from 'src/SqlLab/components/SaveDatasetModal';
import { getDatasourceAsSaveableDataset } from 'src/utils/datasourceUtils';
import { buildV1ChartDataPayload } from 'src/explore/exploreUtils';
import { getChartRequiredFieldsMissingMessage } from 'src/utils/getChartRequiredFieldsMissingMessage';
import { DataTablesPane } from '../DataTablesPane';
import { ChartPills } from '../ChartPills';
import { ExploreAlert } from '../ExploreAlert';
import useResizeDetectorByObserver from './useResizeDetectorByObserver';

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
  standalone: PropTypes.bool,
  force: PropTypes.bool,
  timeout: PropTypes.number,
  chartIsStale: PropTypes.bool,
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
    display: ${({ showSplite }) => (showSplite ? 'block' : 'none')};
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
  actions,
  timeout,
  standalone,
  chartIsStale,
  chartAlert,
  can_download: canDownload,
}) => {
  const theme = useTheme();
  const gutterMargin = theme.gridUnit * GUTTER_SIZE_FACTOR;
  const gutterHeight = theme.gridUnit * GUTTER_SIZE_FACTOR;
  const {
    ref: chartPanelRef,
    observerRef: resizeObserverRef,
    width: chartPanelWidth,
    height: chartPanelHeight,
  } = useResizeDetectorByObserver();
  const [splitSizes, setSplitSizes] = useState(
    isFeatureEnabled(FeatureFlag.DatapanelClosedByDefault)
      ? INITIAL_SIZES
      : getItem(LocalStorageKeys.ChartSplitSizes, INITIAL_SIZES),
  );
  const [showSplite, setShowSplit] = useState(
    isFeatureEnabled(FeatureFlag.DatapanelClosedByDefault)
      ? false
      : getItem(LocalStorageKeys.IsDatapanelOpen, false),
  );

  const [showDatasetModal, setShowDatasetModal] = useState(false);

  const metaDataRegistry = getChartMetadataRegistry();
  const { useLegacyApi } = metaDataRegistry.get(vizType) ?? {};
  const vizTypeNeedsDataset =
    useLegacyApi && datasource.type !== DatasourceType.Table;
  // added boolean column to below show boolean so that the errors aren't overlapping
  const showAlertBanner =
    !chartAlert &&
    chartIsStale &&
    !vizTypeNeedsDataset &&
    chart.chartStatus !== 'failed' &&
    ensureIsArray(chart.queriesResponse).length > 0;

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
    setItem(LocalStorageKeys.ChartSplitSizes, splitSizes);
  }, [splitSizes]);

  const onDragEnd = useCallback(sizes => {
    setSplitSizes(sizes);
  }, []);

  const refreshCachedQuery = useCallback(() => {
    actions.setForceQuery(true);
    actions.postChartFormData(
      formData,
      true,
      timeout,
      chart.id,
      undefined,
      ownState,
    );
    actions.updateQueryFormData(formData, chart.id);
  }, [actions, chart.id, formData, ownState, timeout]);

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
    setShowSplit(isOpen);
  }, []);

  const renderChart = useCallback(
    () => (
      <div
        css={css`
          min-height: 0;
          flex: 1;
          overflow: auto;
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
            latestQueryFormData={chart.latestQueryFormData}
            onQuery={onQuery}
            queriesResponse={chart.queriesResponse}
            chartIsStale={chartIsStale}
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
      chart.latestQueryFormData,
      chart.queriesResponse,
      chart.triggerQuery,
      chartIsStale,
      chartPanelHeight,
      chartPanelRef,
      chartPanelWidth,
      datasource,
      errorMessage,
      force,
      formData,
      onQuery,
      ownState,
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
        ref={resizeObserverRef}
      >
        {vizTypeNeedsDataset && (
          <Alert
            message={t('Chart type requires a dataset')}
            type="error"
            css={theme => css`
              margin: 0 0 ${theme.gridUnit * 4}px 0;
            `}
            description={
              <>
                {t(
                  'This chart type is not supported when using an unsaved query as a chart source. ',
                )}
                <span
                  role="button"
                  tabIndex={0}
                  onClick={() => setShowDatasetModal(true)}
                  css={{ textDecoration: 'underline' }}
                >
                  {t('Create a dataset')}
                </span>
                {t(' to visualize your data.')}
              </>
            }
          />
        )}
        {showAlertBanner && (
          <ExploreAlert
            title={
              errorMessage
                ? t('Required control values have been removed')
                : t('Your chart is not up to date')
            }
            bodyText={
              errorMessage ? (
                getChartRequiredFieldsMissingMessage(false)
              ) : (
                <span>
                  {t(
                    'You updated the values in the control panel, but the chart was not updated automatically. Run the query by clicking on the "Update chart" button or',
                  )}{' '}
                  <span role="button" tabIndex={0} onClick={onQuery}>
                    {t('click here')}
                  </span>
                  .
                </span>
              )
            }
            type="warning"
            css={theme => css`
              margin: 0 0 ${theme.gridUnit * 4}px 0;
            `}
          />
        )}
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
    [
      resizeObserverRef,
      showAlertBanner,
      errorMessage,
      onQuery,
      chart.queriesResponse,
      chart.chartStatus,
      chart.chartUpdateStartTime,
      chart.chartUpdateEndTime,
      refreshCachedQuery,
      formData?.row_limit,
      renderChart,
    ],
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

  const elementStyle = useCallback(
    (dimension, elementSize, gutterSize) => ({
      [dimension]: `calc(${elementSize}% - ${gutterSize + gutterMargin}px)`,
    }),
    [gutterMargin],
  );

  if (standalone) {
    // dom manipulation hack to get rid of the bootstrap theme's body background
    const standaloneClass = 'background-transparent';
    const bodyClasses = document.body.className.split(' ');
    if (!bodyClasses.includes(standaloneClass)) {
      document.body.className += ` ${standaloneClass}`;
    }
    return (
      <div id="app" data-test="standalone-app" ref={resizeObserverRef}>
        {standaloneChartBody}
      </div>
    );
  }

  return (
    <Styles
      className="panel panel-default chart-container"
      showSplite={showSplite}
    >
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
          datasource={datasource}
          queryForce={force}
          onCollapseChange={onCollapseChange}
          chartStatus={chart.chartStatus}
          errorMessage={errorMessage}
          actions={actions}
          canDownload={canDownload}
        />
      </Split>
      {showDatasetModal && (
        <SaveDatasetModal
          visible={showDatasetModal}
          onHide={() => setShowDatasetModal(false)}
          buttonTextOnSave={t('Save')}
          buttonTextOnOverwrite={t('Overwrite')}
          datasource={getDatasourceAsSaveableDataset(datasource)}
          openWindow={false}
          formData={formData}
        />
      )}
    </Styles>
  );
};

ExploreChartPanel.propTypes = propTypes;

export default ExploreChartPanel;
