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
import React, {
  ReactElement,
  useCallback,
  useMemo,
  useState,
  Dispatch,
  SetStateAction,
} from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useDebounceValue } from 'src/hooks/useDebounceValue';
import {
  isFeatureEnabled,
  FeatureFlag,
  VizType,
  JsonObject,
  LatestQueryFormData,
  QueryFormData,
  Behavior,
} from '@superset-ui/core';
import { css, styled, useTheme, t } from '@apache-superset/core/ui';
import {
  Icons,
  ModalTrigger,
  Button,
  Input,
} from '@superset-ui/core/components';
import { getChartMetadataRegistry } from '@superset-ui/core';
import { Menu, MenuProps } from '@superset-ui/core/components/Menu';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import { DEFAULT_CSV_STREAMING_ROW_THRESHOLD } from 'src/constants';
import { exportChart, getChartKey } from 'src/explore/exploreUtils';
import downloadAsImage from 'src/utils/downloadAsImage';
import { getChartPermalink } from 'src/utils/urlUtils';
import copyTextToClipboard from 'src/utils/copy';
import { useHeaderReportMenuItems } from 'src/features/reports/ReportModal/HeaderReportDropdown';
import { logEvent } from 'src/logger/actions';
import {
  LOG_ACTIONS_CHART_DOWNLOAD_AS_IMAGE,
  LOG_ACTIONS_CHART_DOWNLOAD_AS_JSON,
  LOG_ACTIONS_CHART_DOWNLOAD_AS_CSV,
  LOG_ACTIONS_CHART_DOWNLOAD_AS_CSV_PIVOTED,
  LOG_ACTIONS_CHART_DOWNLOAD_AS_XLS,
} from 'src/logger/LogUtils';
import exportPivotExcel from 'src/utils/downloadAsPivotExcel';
import {
  useStreamingExport,
  StreamingProgress,
} from 'src/components/StreamingExportModal';
import { Slice } from 'src/types/Chart';
import { ChartState, ExplorePageInitialData } from 'src/explore/types';
import { ReportObject } from 'src/features/reports/types';
import ViewQueryModal from '../controls/ViewQueryModal';
import EmbedCodeContent from '../EmbedCodeContent';
import { useDashboardsMenuItems } from './DashboardsSubMenu';

export const SEARCH_THRESHOLD = 10;

const MENU_KEYS = {
  EDIT_PROPERTIES: 'edit_properties',
  DASHBOARDS_ADDED_TO: 'dashboards_added_to',
  DOWNLOAD_SUBMENU: 'download_submenu',
  DATA_EXPORT_OPTIONS: 'data_export_options',
  EXPORT_ALL_DATA_GROUP: 'export_all_data_group',
  EXPORT_CURRENT_VIEW_GROUP: 'export_current_view_group',
  EXPORT_TO_CSV_PIVOTED: 'export_to_csv_pivoted',
  EXPORT_TO_PIVOT_XLSX: 'export_to_pivot_xlsx',
  EXPORT_TO_CSV: 'export_to_csv',
  EXPORT_TO_JSON: 'export_to_json',
  EXPORT_TO_XLSX: 'export_to_xlsx',
  EXPORT_ALL_SCREENSHOT: 'export_all_screenshot',
  EXPORT_CURRENT_TO_CSV: 'export_current_to_csv',
  EXPORT_CURRENT_TO_JSON: 'export_current_to_json',
  EXPORT_CURRENT_SCREENSHOT: 'export_current_screenshot',
  EXPORT_CURRENT_XLSX: 'export_current_xlsx',
  SHARE_SUBMENU: 'share_submenu',
  COPY_PERMALINK: 'copy_permalink',
  EMBED_CODE: 'embed_code',
  SHARE_BY_EMAIL: 'share_by_email',
  REPORT_SUBMENU: 'report_submenu',
  SET_UP_REPORT: 'set_up_report',
  SET_REPORT_ACTIVE: 'set_report_active',
  EDIT_REPORT: 'edit_report',
  DELETE_REPORT: 'delete_report',
  VIEW_QUERY: 'view_query',
  RUN_IN_SQL_LAB: 'run_in_sql_lab',
};

const VIZ_TYPES_PIVOTABLE = [VizType.PivotTable];

export const MenuItemWithCheckboxContainer = styled.div`
  ${({ theme }) => css`
    display: flex;
    align-items: center;

    & svg {
      width: ${theme.sizeUnit * 3}px;
      height: ${theme.sizeUnit * 3}px;
    }

    & span[role='checkbox'] {
      display: inline-flex;
      margin-right: ${theme.sizeUnit}px;
    }
  `}
`;

export const MenuTrigger = styled(Button)`
  ${({ theme }) => css`
    width: ${theme.sizeUnit * 8}px;
    height: ${theme.sizeUnit * 8}px;
    padding: 0;
    border: 1px solid ${theme.colorPrimary};

    &.ant-btn > span.anticon {
      line-height: 0;
      transition: inherit;
    }

    &:hover:not(:focus) > span.anticon {
      color: ${theme.colorPrimary};
    }
  `}
`;

interface ClientViewColumn {
  key: string;
  label?: string;
}

interface ClientViewRow {
  [key: string]: unknown;
}

interface OwnStateWithClientView extends JsonObject {
  clientView?: {
    rows?: ClientViewRow[];
    columns?: ClientViewColumn[];
  };
}

export interface StreamingExportState {
  isVisible: boolean;
  progress: StreamingProgress;
  onCancel: () => void;
  onRetry: () => void;
  onDownload: () => void;
}

interface ExploreSlice {
  slice?: Slice | null;
  form_data?: Partial<QueryFormData>;
}

interface ExploreState {
  charts?: Record<number, ChartState>;
  explore?: ExploreSlice;
  common?: {
    conf?: {
      CSV_STREAMING_ROW_THRESHOLD?: number;
    };
  };
}

export type UseExploreAdditionalActionsMenuReturn = [
  ReactElement,
  boolean,
  Dispatch<SetStateAction<boolean>>,
  StreamingExportState,
];

export const useExploreAdditionalActionsMenu = (
  latestQueryFormData: LatestQueryFormData,
  canDownloadCSV: boolean,
  slice: Slice | null | undefined,
  onOpenInEditor: (
    formData: LatestQueryFormData,
    openNewWindow?: boolean,
  ) => void,
  onOpenPropertiesModal: () => void,
  ownState: OwnStateWithClientView | undefined,
  dashboards:
    | NonNullable<ExplorePageInitialData['metadata']>['dashboards']
    | undefined,
  showReportModal: () => void,
  setCurrentReportDeleting: Dispatch<SetStateAction<ReportObject | null>>,
  ...rest: MenuProps[]
): UseExploreAdditionalActionsMenuReturn => {
  const theme = useTheme();
  const { addDangerToast, addSuccessToast } = useToasts();
  const dispatch = useDispatch();
  const [isDropdownVisible, setIsDropdownVisible] = useState(false);
  const [dashboardSearchTerm, setDashboardSearchTerm] = useState('');
  const debouncedDashboardSearchTerm = useDebounceValue(
    dashboardSearchTerm,
    300,
  );
  const chart = useSelector<ExploreState, ChartState | undefined>(state =>
    state.explore ? state.charts?.[getChartKey(state.explore)] : undefined,
  );
  const streamingThreshold = useSelector<ExploreState, number>(
    state =>
      state.common?.conf?.CSV_STREAMING_ROW_THRESHOLD ||
      DEFAULT_CSV_STREAMING_ROW_THRESHOLD,
  );

  // Streaming export state and handlers
  const [isStreamingModalVisible, setIsStreamingModalVisible] = useState(false);
  const {
    progress,
    isExporting: _isExporting,
    startExport,
    cancelExport: _cancelExport,
    resetExport,
    retryExport,
  } = useStreamingExport({
    onComplete: () => {
      // Don't show toast here - wait for user to click Download button
    },
    onError: () => {
      addDangerToast(t('Export failed - please try again'));
    },
  });

  const handleCloseStreamingModal = useCallback(() => {
    setIsStreamingModalVisible(false);
    resetExport();
  }, [resetExport]);

  const handleDownloadComplete = useCallback(() => {
    addSuccessToast(t('CSV file downloaded successfully'));
  }, [addSuccessToast]);

  // Use the updated report menu items hook
  const reportMenuItem = useHeaderReportMenuItems({
    chart,
    showReportModal,
    setCurrentReportDeleting,
  });

  const { datasource } = latestQueryFormData;

  // Get dashboard menu items using the hook
  const dashboardMenuItems = useDashboardsMenuItems({
    chartId: slice?.slice_id,
    dashboards,
    searchTerm: debouncedDashboardSearchTerm,
  });

  const showDashboardSearch = (dashboards?.length ?? 0) > SEARCH_THRESHOLD;
  const vizType = latestQueryFormData?.viz_type;
  const meta = vizType ? getChartMetadataRegistry().get(vizType) : undefined;

  // Detect if the chart plugin exposes the export-current-view behavior
  const hasExportCurrentView = !!meta?.behaviors?.includes(
    'EXPORT_CURRENT_VIEW' as Behavior,
  );

  const shareByEmail = useCallback(async () => {
    try {
      const subject = t('Superset Chart');
      if (!latestQueryFormData?.datasource) {
        throw new Error('No datasource available');
      }
      const result = await getChartPermalink(
        latestQueryFormData as Pick<QueryFormData, 'datasource'>,
      );
      if (!result?.url) {
        throw new Error('Failed to generate permalink');
      }
      const body = encodeURIComponent(
        t('%s%s', 'Check out this chart: ', result.url),
      );
      window.location.href = `mailto:?Subject=${subject}%20&Body=${body}`;
    } catch (error) {
      addDangerToast(t('Sorry, something went wrong. Try again later.'));
    }
  }, [addDangerToast, latestQueryFormData]);

  const exportCSV = useCallback(() => {
    if (!canDownloadCSV) return null;

    // Determine row count for streaming threshold check
    let actualRowCount;
    const isTableViz = latestQueryFormData?.viz_type === 'table';
    const queriesResponse = chart?.queriesResponse;

    if (
      isTableViz &&
      queriesResponse &&
      queriesResponse.length > 1 &&
      queriesResponse[1]?.data?.[0]?.rowcount
    ) {
      actualRowCount = queriesResponse[1].data[0].rowcount;
    } else if (queriesResponse && queriesResponse[0]?.sql_rowcount != null) {
      actualRowCount = queriesResponse[0].sql_rowcount;
    } else if (queriesResponse && queriesResponse[0]?.rowcount != null) {
      actualRowCount = queriesResponse[0].rowcount;
    } else {
      actualRowCount = latestQueryFormData?.row_limit;
    }

    // Check if streaming should be used
    const shouldUseStreaming =
      actualRowCount && actualRowCount >= streamingThreshold;

    let filename: string | undefined;
    if (shouldUseStreaming) {
      const now = new Date();
      const date = now.toISOString().slice(0, 10);
      const time = now.toISOString().slice(11, 19).replace(/:/g, '');
      const timestamp = `_${date}_${time}`;
      const chartName =
        slice?.slice_name || latestQueryFormData.viz_type || 'chart';
      const safeChartName = chartName.replace(/[^a-zA-Z0-9_-]/g, '_');
      filename = `${safeChartName}${timestamp}.csv`;
    }

    return exportChart({
      formData: latestQueryFormData as QueryFormData,
      ownState,
      resultType: 'full',
      resultFormat: 'csv',
      onStartStreamingExport: shouldUseStreaming
        ? exportParams => {
            if (exportParams.url) {
              setIsStreamingModalVisible(true);
              startExport({
                ...exportParams,
                url: exportParams.url,
                filename,
                expectedRows: actualRowCount,
                exportType: exportParams.exportType as 'csv' | 'xlsx',
              });
            }
          }
        : null,
    });
  }, [
    canDownloadCSV,
    latestQueryFormData,
    ownState,
    chart,
    streamingThreshold,
    slice,
    startExport,
  ]);

  const exportCSVPivoted = useCallback(
    () =>
      canDownloadCSV
        ? exportChart({
            formData: latestQueryFormData as QueryFormData,
            ownState,
            resultType: 'post_processed',
            resultFormat: 'csv',
          })
        : null,
    [canDownloadCSV, latestQueryFormData, ownState],
  );

  const exportJson = useCallback(
    () =>
      canDownloadCSV
        ? exportChart({
            formData: latestQueryFormData as QueryFormData,
            ownState,
            resultType: 'results',
            resultFormat: 'json',
          })
        : null,
    [canDownloadCSV, latestQueryFormData, ownState],
  );

  const exportExcel = useCallback(
    () =>
      canDownloadCSV
        ? exportChart({
            formData: latestQueryFormData as QueryFormData,
            ownState,
            resultType: 'results',
            resultFormat: 'xlsx',
          })
        : null,
    [canDownloadCSV, latestQueryFormData, ownState],
  );

  const copyLink = useCallback(async () => {
    try {
      if (!latestQueryFormData?.datasource) {
        throw new Error('No datasource available');
      }
      await copyTextToClipboard(async () => {
        const result = await getChartPermalink(
          latestQueryFormData as Pick<QueryFormData, 'datasource'>,
        );
        if (!result?.url) {
          throw new Error('Failed to generate permalink');
        }
        return result.url;
      });
      addSuccessToast(t('Copied to clipboard!'));
    } catch (error) {
      addDangerToast(t('Sorry, something went wrong. Try again later.'));
    }
  }, [addDangerToast, addSuccessToast, latestQueryFormData]);

  // Minimal client-side CSV builder used for "Current View" when pagination is disabled
  const downloadClientCSV = (
    rows: ClientViewRow[],
    columns: ClientViewColumn[],
    filename: string,
  ) => {
    if (!rows?.length || !columns?.length) return;
    const esc = (v: unknown): string => {
      if (v === null || v === undefined) return '';
      const s = String(v);
      const wrapped = /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      return wrapped;
    };
    const header = columns.map(c => esc(c.label ?? c.key ?? '')).join(',');
    const body = rows
      .map(r => columns.map(c => esc(r[c.key])).join(','))
      .join('\n');
    const csv = `${header}\n${body}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename || 'current_view'}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  // Robust client-side JSON for "Current View"
  const downloadClientJSON = (
    rows: ClientViewRow[],
    columns: ClientViewColumn[],
    filename: string,
  ) => {
    if (!rows?.length || !columns?.length) return;

    const norm = (v: unknown): unknown => {
      if (v instanceof Date) return v.toISOString();
      if (v && typeof v === 'object' && 'input' in v && 'formatter' in v) {
        const typedV = v as {
          input?: unknown;
          value?: unknown;
          toString?: () => string;
        };
        const dv = typedV.input ?? typedV.value ?? typedV.toString?.() ?? '';
        return dv instanceof Date ? dv.toISOString() : dv;
      }
      return v;
    };

    const data = rows.map(r => {
      const out: Record<string, unknown> = {};
      columns.forEach(c => {
        out[c.key] = norm(r[c.key]);
      });
      return out;
    });

    const meta = {
      columns: columns.map(c => ({
        key: c.key,
        label: c.label ?? c.key,
      })),
      count: rows.length,
    };

    const payload = { meta, data };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8;',
    });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename || 'current_view'}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  // Client-side XLSX for "Current View" (uses 'xlsx' already in deps)
  const downloadClientXLSX = async (
    rows: ClientViewRow[],
    columns: ClientViewColumn[],
    filename: string,
  ) => {
    if (!rows?.length || !columns?.length) return;
    try {
      const XLSX = (await import(/* webpackChunkName: "xlsx" */ 'xlsx'))
        .default;

      // Build a flat array of objects keyed by backend column key
      const data = rows.map(r => {
        const o: Record<string, unknown> = {};
        columns.forEach(c => {
          const v = r[c.key];
          if (v && typeof v === 'object' && 'input' in v && 'formatter' in v) {
            const typedV = v as { input?: unknown; value?: unknown };
            o[c.label ?? c.key] =
              typedV.input instanceof Date
                ? typedV.input.toISOString()
                : (typedV.input ?? typedV.value ?? '');
          } else if (v instanceof Date) {
            o[c.label ?? c.key] = v.toISOString();
          } else {
            o[c.label ?? c.key] = v;
          }
        });
        return o;
      });

      const ws = XLSX.utils.json_to_sheet(data, { skipHeader: false });
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Current View');

      // Autosize columns (roughly) by header length
      const colWidths = Object.keys(data[0] || {}).map(h => ({
        wch: Math.max(10, String(h).length + 2),
      }));
      ws['!cols'] = colWidths;

      XLSX.writeFile(wb, `${filename || 'current_view'}.xlsx`);
    } catch {
      // If xlsx isn't available for some reason, fall back to CSV
      downloadClientCSV(rows, columns, filename || 'current_view');
      addDangerToast?.(
        t('Falling back to CSV; Excel export library not available.'),
      );
    }
  };

  const menu = useMemo(() => {
    const menuItems = [];

    // Edit chart properties
    if (slice) {
      menuItems.push({
        key: MENU_KEYS.EDIT_PROPERTIES,
        label: t('Edit chart properties'),
        onClick: () => {
          onOpenPropertiesModal();
          setIsDropdownVisible(false);
        },
      });
    }

    // On dashboards submenu
    const dashboardsChildren = [];

    // Add search input if needed
    if (showDashboardSearch) {
      dashboardsChildren.push({
        key: 'dashboard-search',
        label: (
          <Input
            allowClear
            placeholder={t('Search')}
            prefix={<Icons.SearchOutlined iconSize="l" />}
            css={css`
              width: 220px;
              margin: ${theme.sizeUnit * 2}px ${theme.sizeUnit * 3}px;
            `}
            value={dashboardSearchTerm}
            onChange={e => setDashboardSearchTerm(e.currentTarget.value)}
            onClick={e => e.stopPropagation()}
          />
        ),
        disabled: true, // Prevent clicks on the search input from closing menu
      });
    }

    // Add dashboard items
    dashboardMenuItems.forEach(item => {
      dashboardsChildren.push(item);
    });

    menuItems.push({
      key: MENU_KEYS.DASHBOARDS_ADDED_TO,
      type: 'submenu' as const,
      label: t('On dashboards'),
      children: dashboardsChildren,
      popupStyle: {
        maxHeight: '300px',
        overflow: 'auto',
      },
    });

    // Divider
    menuItems.push({ type: 'divider' as const });

    // Download submenu
    const allDataChildren = [];

    if (
      latestQueryFormData.viz_type &&
      VIZ_TYPES_PIVOTABLE.includes(latestQueryFormData.viz_type as VizType)
    ) {
      allDataChildren.push(
        {
          key: MENU_KEYS.EXPORT_TO_CSV,
          label: t('Export to original .CSV'),
          icon: <Icons.FileOutlined />,
          disabled: !canDownloadCSV,
          onClick: () => {
            exportCSV();
            setIsDropdownVisible(false);
            dispatch(
              logEvent(LOG_ACTIONS_CHART_DOWNLOAD_AS_CSV, {
                chartId: slice?.slice_id,
                chartName: slice?.slice_name,
              }),
            );
          },
        },
        {
          key: MENU_KEYS.EXPORT_TO_CSV_PIVOTED,
          label: t('Export to pivoted .CSV'),
          icon: <Icons.FileOutlined />,
          disabled: !canDownloadCSV,
          onClick: () => {
            exportCSVPivoted();
            setIsDropdownVisible(false);
            dispatch(
              logEvent(LOG_ACTIONS_CHART_DOWNLOAD_AS_CSV_PIVOTED, {
                chartId: slice?.slice_id,
                chartName: slice?.slice_name,
              }),
            );
          },
        },
        {
          key: MENU_KEYS.EXPORT_TO_PIVOT_XLSX,
          label: t('Export to Pivoted Excel'),
          icon: <Icons.FileOutlined />,
          disabled: !canDownloadCSV,
          onClick: () => {
            const sliceSelector = `#chart-id-${slice?.slice_id}`;
            exportPivotExcel(
              `${sliceSelector} .pvtTable`,
              slice?.slice_name ?? t('pivoted_xlsx'),
            );
            setIsDropdownVisible(false);
            dispatch(
              logEvent(LOG_ACTIONS_CHART_DOWNLOAD_AS_XLS, {
                chartId: slice?.slice_id,
                chartName: slice?.slice_name,
              }),
            );
          },
        },
      );
    } else {
      allDataChildren.push({
        key: MENU_KEYS.EXPORT_TO_CSV,
        label: t('Export to .CSV'),
        icon: <Icons.FileOutlined />,
        disabled: !canDownloadCSV,
        onClick: () => {
          exportCSV();
          setIsDropdownVisible(false);
          dispatch(
            logEvent(LOG_ACTIONS_CHART_DOWNLOAD_AS_CSV, {
              chartId: slice?.slice_id,
              chartName: slice?.slice_name,
            }),
          );
        },
      });
    }

    allDataChildren.push(
      {
        key: MENU_KEYS.EXPORT_TO_JSON,
        label: t('Export to .JSON'),
        icon: <Icons.FileOutlined />,
        disabled: !canDownloadCSV,
        onClick: () => {
          exportJson();
          setIsDropdownVisible(false);
          dispatch(
            logEvent(LOG_ACTIONS_CHART_DOWNLOAD_AS_JSON, {
              chartId: slice?.slice_id,
              chartName: slice?.slice_name,
            }),
          );
        },
      },
      {
        key: MENU_KEYS.EXPORT_ALL_SCREENSHOT,
        label: t('Export screenshot (jpeg)'),
        icon: <Icons.FileImageOutlined />,
        onClick: (e: { domEvent: React.MouseEvent | React.KeyboardEvent }) => {
          downloadAsImage(
            '.panel-body .chart-container',
            slice?.slice_name ?? t('New chart'),
            true,
            theme,
          )(e.domEvent);
          setIsDropdownVisible(false);
          dispatch(
            logEvent(LOG_ACTIONS_CHART_DOWNLOAD_AS_IMAGE, {
              chartId: slice?.slice_id,
              chartName: slice?.slice_name,
            }),
          );
        },
      },
      {
        key: MENU_KEYS.EXPORT_TO_XLSX,
        label: t('Export to Excel'),
        icon: <Icons.FileOutlined />,
        disabled: !canDownloadCSV,
        onClick: () => {
          exportExcel();
          setIsDropdownVisible(false);
          dispatch(
            logEvent(LOG_ACTIONS_CHART_DOWNLOAD_AS_XLS, {
              chartId: slice?.slice_id,
              chartName: slice?.slice_name,
            }),
          );
        },
      },
    );

    const currentViewChildren = [
      {
        key: MENU_KEYS.EXPORT_CURRENT_TO_CSV,
        label: t('Export to .CSV'),
        icon: <Icons.FileOutlined />,
        disabled: !canDownloadCSV,
        onClick: () => {
          // Use 'results' to export the *current view* (as opposed to 'full').
          // Pass ownState so client/UI state (e.g., filters) can be respected when supported.
          if (
            !latestQueryFormData?.server_pagination &&
            ownState?.clientView?.rows?.length &&
            ownState?.clientView?.columns?.length
          ) {
            const { rows, columns } = ownState.clientView;
            downloadClientCSV(
              rows,
              columns,
              slice?.slice_name || 'current_view',
            );
          } else {
            exportChart({
              formData: latestQueryFormData as QueryFormData,
              ownState,
              resultType: 'results',
              resultFormat: 'csv',
            });
          }
          setIsDropdownVisible(false);
          dispatch(
            logEvent(LOG_ACTIONS_CHART_DOWNLOAD_AS_CSV, {
              chartId: slice?.slice_id,
              chartName: slice?.slice_name,
            }),
          );
        },
      },
      {
        key: MENU_KEYS.EXPORT_CURRENT_TO_JSON,
        label: t('Export to .JSON'),
        icon: <Icons.FileOutlined />,
        disabled: !canDownloadCSV,
        onClick: () => {
          if (
            !latestQueryFormData?.server_pagination &&
            ownState?.clientView?.rows?.length &&
            ownState?.clientView?.columns?.length
          ) {
            const { rows, columns } = ownState.clientView;
            downloadClientJSON(
              rows,
              columns,
              slice?.slice_name || 'current_view',
            );
          } else {
            exportJson();
          }
          setIsDropdownVisible(false);
          dispatch(
            logEvent(LOG_ACTIONS_CHART_DOWNLOAD_AS_JSON, {
              chartId: slice?.slice_id,
              chartName: slice?.slice_name,
            }),
          );
        },
      },
      {
        key: MENU_KEYS.EXPORT_CURRENT_SCREENSHOT,
        label: t('Export screenshot (jpeg)'),
        icon: <Icons.FileImageOutlined />,
        onClick: (e: { domEvent: React.MouseEvent | React.KeyboardEvent }) => {
          downloadAsImage(
            '.panel-body .chart-container',
            slice?.slice_name ?? t('New chart'),
            true,
            theme,
          )(e.domEvent);
          setIsDropdownVisible(false);
          dispatch(
            logEvent(LOG_ACTIONS_CHART_DOWNLOAD_AS_IMAGE, {
              chartId: slice?.slice_id,
              chartName: slice?.slice_name,
            }),
          );
        },
      },
      {
        key: MENU_KEYS.EXPORT_CURRENT_XLSX,
        label: t('Export to Excel'),
        icon: <Icons.FileOutlined />,
        disabled: !canDownloadCSV,
        onClick: async () => {
          if (
            !latestQueryFormData?.server_pagination &&
            ownState?.clientView?.rows?.length &&
            ownState?.clientView?.columns?.length
          ) {
            // Client-side filtered view → XLSX
            const { rows, columns } = ownState.clientView;
            await downloadClientXLSX(
              rows,
              columns,
              slice?.slice_name || 'current_view',
            );
          } else {
            // Server path (respects backend filters/pagination)
            await exportExcel();
          }
          setIsDropdownVisible(false);
          dispatch(
            logEvent(LOG_ACTIONS_CHART_DOWNLOAD_AS_XLS, {
              chartId: slice?.slice_id,
              chartName: slice?.slice_name,
            }),
          );
        },
      },
    ];

    menuItems.push({
      key: MENU_KEYS.DATA_EXPORT_OPTIONS,
      type: 'submenu' as const,
      label: t('Data Export Options'),
      children: [
        {
          key: MENU_KEYS.EXPORT_ALL_DATA_GROUP,
          type: 'submenu' as const,
          label: t('Export All Data'),
          children: allDataChildren,
        },
        ...(hasExportCurrentView
          ? [
              {
                key: MENU_KEYS.EXPORT_CURRENT_VIEW_GROUP,
                type: 'submenu' as const,
                label: t('Export Current View'),
                children: currentViewChildren,
              },
            ]
          : []),
      ],
    });

    // Share submenu
    const shareChildren: Array<{
      key: string;
      label: React.ReactNode;
      onClick: () => void;
    }> = [
      {
        key: MENU_KEYS.COPY_PERMALINK,
        label: t('Copy permalink to clipboard'),
        onClick: () => {
          copyLink();
          setIsDropdownVisible(false);
        },
      },
      {
        key: MENU_KEYS.SHARE_BY_EMAIL,
        label: t('Share chart by email'),
        onClick: () => {
          shareByEmail();
          setIsDropdownVisible(false);
        },
      },
    ];

    if (isFeatureEnabled(FeatureFlag.EmbeddableCharts)) {
      shareChildren.push({
        key: MENU_KEYS.EMBED_CODE,
        label: (
          <ModalTrigger
            triggerNode={
              <div data-test="embed-code-button">{t('Embed code')}</div>
            }
            modalTitle={t('Embed code')}
            modalBody={
              <EmbedCodeContent
                formData={latestQueryFormData}
                addDangerToast={addDangerToast}
              />
            }
            maxWidth={`${theme.sizeUnit * 100}px`}
            destroyOnHidden
            responsive
          />
        ),
        onClick: () => setIsDropdownVisible(false),
      });
    }

    menuItems.push({
      key: MENU_KEYS.SHARE_SUBMENU,
      type: 'submenu' as const,
      label: t('Share'),
      children: shareChildren,
    });

    // Divider
    menuItems.push({ type: 'divider' as const });

    // Report menu item
    if (reportMenuItem) {
      menuItems.push(reportMenuItem);
    }

    // View query
    menuItems.push({
      key: MENU_KEYS.VIEW_QUERY,
      label: (
        <ModalTrigger
          triggerNode={
            <div data-test="view-query-menu-item">{t('View query')}</div>
          }
          modalTitle={t('View query')}
          modalBody={
            <ViewQueryModal
              latestQueryFormData={latestQueryFormData as QueryFormData}
            />
          }
          draggable
          resizable
          responsive
        />
      ),
      onClick: () => setIsDropdownVisible(false),
    });

    // Run in SQL Lab
    if (datasource) {
      menuItems.push({
        key: MENU_KEYS.RUN_IN_SQL_LAB,
        label: t('Run in SQL Lab'),
        onClick: (e: { domEvent?: React.MouseEvent | React.KeyboardEvent }) => {
          onOpenInEditor(
            latestQueryFormData,
            !!(e.domEvent as React.MouseEvent | undefined)?.metaKey,
          );
          setIsDropdownVisible(false);
        },
      });
    }

    return <Menu selectable={false} items={menuItems} {...rest} />;
  }, [
    addDangerToast,
    canDownloadCSV,
    copyLink,
    dashboards,
    dashboardMenuItems,
    dashboardSearchTerm,
    debouncedDashboardSearchTerm,
    datasource,
    dispatch,
    exportCSV,
    exportCSVPivoted,
    exportExcel,
    exportJson,
    latestQueryFormData,
    onOpenInEditor,
    onOpenPropertiesModal,
    reportMenuItem,
    shareByEmail,
    showDashboardSearch,
    slice,
    theme.sizeUnit,
    ownState,
    hasExportCurrentView,
  ]);

  // Return streaming modal state and handlers for parent to render
  const streamingExportState = {
    isVisible: isStreamingModalVisible,
    progress,
    onCancel: handleCloseStreamingModal,
    onRetry: retryExport,
    onDownload: handleDownloadComplete,
  };

  return [menu, isDropdownVisible, setIsDropdownVisible, streamingExportState];
};
