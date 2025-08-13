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
import { useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
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
  QueryFormData,
  JsonObject,
  getExtensionsRegistry,
} from '@superset-ui/core';
import ChartContainer from 'src/components/Chart/ChartContainer';
import {
  getItem,
  setItem,
  LocalStorageKeys,
} from 'src/utils/localStorageHelpers';
import { Alert } from '@superset-ui/core/components';
import { SaveDatasetModal } from 'src/SqlLab/components/SaveDatasetModal';
import { getDatasourceAsSaveableDataset } from 'src/utils/datasourceUtils';
import { buildV1ChartDataPayload } from 'src/explore/exploreUtils';
import { getChartRequiredFieldsMissingMessage } from 'src/utils/getChartRequiredFieldsMissingMessage';
import type { ChartState, Datasource } from 'src/explore/types';
import type { Slice } from 'src/types/Chart';
import { DataTablesPane } from '../DataTablesPane';
import { ChartPills } from '../ChartPills';
import { ExploreAlert } from '../ExploreAlert';
import useResizeDetectorByObserver from './useResizeDetectorByObserver';

const extensionsRegistry = getExtensionsRegistry();
const DefaultHeader: React.FC = ({ children }) => <>{children}</>;

export interface ExploreChartPanelProps {
  actions: {
    setForceQuery: (force: boolean) => void;
    postChartFormData: (
      formData: QueryFormData,
      force: boolean,
      timeout: number,
      chartId: number,
      dashboardId?: number,
      ownState?: JsonObject,
    ) => void;
    updateQueryFormData: (formData: QueryFormData, chartId: number) => void;
    setControlValue: (controlName: string, value: any, chartId: number) => void;
  };
  onQuery?: () => void;
  can_overwrite: boolean;
  can_download: boolean;
  datasource: Datasource;
  dashboardId?: number;
  column_formats?: Record<string, any>;
  containerId: string;
  isStarred: boolean;
  slice?: Slice;
  sliceName?: string;
  table_name?: string;
  vizType: string;
  form_data: QueryFormData;
  ownState?: JsonObject;
  standalone?: boolean;
  force?: boolean;
  timeout?: number;
  chartIsStale?: boolean;
  chart: ChartState;
  errorMessage?: ReactNode;
  triggerRender?: boolean;
  chartAlert?: string;
}

type PanelSizes = [number, number];

const GUTTER_SIZE_FACTOR = 1.25;

const INITIAL_SIZES: PanelSizes = [100, 0];
const MIN_SIZES: PanelSizes = [300, 65];
const DEFAULT_SOUTH_PANE_HEIGHT_PERCENT = 40;

const Styles = styled.div<{ showSplite: boolean }>`
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
    border-top: 1px solid ${({ theme }) => theme.colorSplit};
    border-bottom: 1px solid ${({ theme }) => theme.colorSplit};
    width: ${({ theme }) => theme.sizeUnit * 9}px;
    margin: ${({ theme }) => theme.sizeUnit * GUTTER_SIZE_FACTOR}px auto;
  }

  .gutter.gutter-vertical {
    display: ${({ showSplite }) => (showSplite ? 'block' : 'none')};
    cursor: row-resize;
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
}: ExploreChartPanelProps) => {
  const theme = useTheme();
  const gutterMargin = theme.sizeUnit * GUTTER_SIZE_FACTOR;
  const gutterHeight = theme.sizeUnit * GUTTER_SIZE_FACTOR;
  const {
    ref: chartPanelRef,
    observerRef: resizeObserverRef,
    width: chartPanelWidth,
    height: chartPanelHeight,
  } = useResizeDetectorByObserver();

  const ChartHeaderExtension =
    extensionsRegistry.get('explore.chart.header') ?? DefaultHeader;
  const [splitSizes, setSplitSizes] = useState<PanelSizes>(
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
        const queryContext = await buildV1ChartDataPayload({
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

  const onDragEnd = useCallback((sizes: PanelSizes) => {
    setSplitSizes(sizes);
  }, []);

  const refreshCachedQuery = useCallback(() => {
    actions.setForceQuery(true);
    actions.postChartFormData(
      formData,
      true,
      timeout ?? 0,
      chart.id,
      undefined,
      ownState,
    );
    actions.updateQueryFormData(formData, chart.id);
  }, [actions, chart.id, formData, ownState, timeout]);

  const onCollapseChange = useCallback((isOpen: boolean) => {
    let splitSizes: PanelSizes;
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
            chartId={chart.id}
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
            {...(chart.chartAlert && { chartAlert: chart.chartAlert })}
            {...(chart.chartStackTrace && {
              chartStackTrace: chart.chartStackTrace,
            })}
            {...(chart.chartStatus && { chartStatus: chart.chartStatus })}
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
          padding-top: ${theme.sizeUnit * 2}px;
        `}
        ref={resizeObserverRef}
      >
        {vizTypeNeedsDataset && (
          <Alert
            message={t('Chart type requires a dataset')}
            type="error"
            css={theme => css`
              margin: 0 0 ${theme.sizeUnit * 4}px 0;
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
              margin: 0 0 ${theme.sizeUnit * 4}px 0;
            `}
          />
        )}
        <ChartHeaderExtension
          chartId={chart.id}
          queriesResponse={chart.queriesResponse}
          sliceFormData={slice?.form_data ?? null}
          queryFormData={formData}
          lastRendered={chart.lastRendered}
          latestQueryFormData={chart.latestQueryFormData}
          chartUpdateEndTime={chart.chartUpdateEndTime ?? 0}
          chartUpdateStartTime={chart.chartUpdateStartTime}
          queryController={chart.queryController}
          triggerQuery={chart.triggerQuery}
        >
          <ChartPills
            chartUpdateStartTime={chart.chartUpdateStartTime}
            chartUpdateEndTime={chart.chartUpdateEndTime ?? 0}
            refreshCachedQuery={refreshCachedQuery}
            rowLimit={formData?.row_limit ?? 0}
            {...(chart.queriesResponse && {
              queriesResponse: chart.queriesResponse,
            })}
            {...(chart.chartStatus && { chartStatus: chart.chartStatus })}
          />
        </ChartHeaderExtension>
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
    (
      dimension: 'width' | 'height',
      elementSize: number,
      gutterSize: number,
    ) => ({
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
    <Styles className="chart-container" showSplite={showSplite}>
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
          queryForce={Boolean(force)}
          onCollapseChange={onCollapseChange}
          chartStatus={chart.chartStatus}
          errorMessage={errorMessage}
          setForceQuery={actions.setForceQuery}
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

export default ExploreChartPanel;
