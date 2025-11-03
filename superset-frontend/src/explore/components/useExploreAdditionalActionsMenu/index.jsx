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
import { useCallback, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useDebounceValue } from 'src/hooks/useDebounceValue';
import {
  css,
  isFeatureEnabled,
  FeatureFlag,
  styled,
  t,
  useTheme,
  VizType,
} from '@superset-ui/core';
import {
  Icons,
  ModalTrigger,
  Button,
  Input,
} from '@superset-ui/core/components';
import { Menu } from '@superset-ui/core/components/Menu';
import { useToasts } from 'src/components/MessageToasts/withToasts';
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
import ViewQueryModal from '../controls/ViewQueryModal';
import EmbedCodeContent from '../EmbedCodeContent';
import { useDashboardsMenuItems } from './DashboardsSubMenu';

export const SEARCH_THRESHOLD = 10;

const MENU_KEYS = {
  EDIT_PROPERTIES: 'edit_properties',
  DASHBOARDS_ADDED_TO: 'dashboards_added_to',
  DOWNLOAD_SUBMENU: 'download_submenu',
  EXPORT_TO_CSV: 'export_to_csv',
  EXPORT_TO_CSV_PIVOTED: 'export_to_csv_pivoted',
  EXPORT_TO_JSON: 'export_to_json',
  EXPORT_TO_XLSX: 'export_to_xlsx',
  DOWNLOAD_AS_IMAGE: 'download_as_image',
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
  EXPORT_TO_PIVOT_XLSX: 'export_to_pivot_xlsx',
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

export const useExploreAdditionalActionsMenu = (
  latestQueryFormData,
  canDownloadCSV,
  slice,
  onOpenInEditor,
  onOpenPropertiesModal,
  ownState,
  dashboards,
  showReportModal,
  setCurrentReportDeleting,
  ...rest
) => {
  const theme = useTheme();
  const { addDangerToast, addSuccessToast } = useToasts();
  const dispatch = useDispatch();
  const [isDropdownVisible, setIsDropdownVisible] = useState(false);
  const [dashboardSearchTerm, setDashboardSearchTerm] = useState('');
  const debouncedDashboardSearchTerm = useDebounceValue(
    dashboardSearchTerm,
    300,
  );
  const chart = useSelector(
    state => state.charts?.[getChartKey(state.explore)],
  );

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

  const showDashboardSearch = dashboards?.length > SEARCH_THRESHOLD;

  const shareByEmail = useCallback(async () => {
    try {
      const subject = t('Superset Chart');
      const url = await getChartPermalink(latestQueryFormData);
      const body = encodeURIComponent(t('%s%s', 'Check out this chart: ', url));
      window.location.href = `mailto:?Subject=${subject}%20&Body=${body}`;
    } catch (error) {
      addDangerToast(t('Sorry, something went wrong. Try again later.'));
    }
  }, [addDangerToast, latestQueryFormData]);

  const exportCSV = useCallback(
    () =>
      canDownloadCSV
        ? exportChart({
            formData: latestQueryFormData,
            ownState,
            resultType: 'full',
            resultFormat: 'csv',
          })
        : null,
    [canDownloadCSV, latestQueryFormData],
  );

  const exportCSVPivoted = useCallback(
    () =>
      canDownloadCSV
        ? exportChart({
            formData: latestQueryFormData,
            resultType: 'post_processed',
            resultFormat: 'csv',
          })
        : null,
    [canDownloadCSV, latestQueryFormData],
  );

  const exportJson = useCallback(
    () =>
      canDownloadCSV
        ? exportChart({
            formData: latestQueryFormData,
            resultType: 'results',
            resultFormat: 'json',
          })
        : null,
    [canDownloadCSV, latestQueryFormData],
  );

  const exportExcel = useCallback(
    () =>
      canDownloadCSV
        ? exportChart({
            formData: latestQueryFormData,
            resultType: 'results',
            resultFormat: 'xlsx',
          })
        : null,
    [canDownloadCSV, latestQueryFormData],
  );

  const copyLink = useCallback(async () => {
    try {
      if (!latestQueryFormData) {
        throw new Error();
      }
      await copyTextToClipboard(() => getChartPermalink(latestQueryFormData));
      addSuccessToast(t('Copied to clipboard!'));
    } catch (error) {
      addDangerToast(t('Sorry, something went wrong. Try again later.'));
    }
  }, [addDangerToast, addSuccessToast, latestQueryFormData]);

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
      type: 'submenu',
      label: t('On dashboards'),
      children: dashboardsChildren,
      popupStyle: {
        maxHeight: '300px',
        overflow: 'auto',
      },
    });

    // Divider
    menuItems.push({ type: 'divider' });

    // Download submenu
    const downloadChildren = [];

    if (VIZ_TYPES_PIVOTABLE.includes(latestQueryFormData.viz_type)) {
      downloadChildren.push(
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
      downloadChildren.push({
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

    downloadChildren.push(
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
        key: MENU_KEYS.DOWNLOAD_AS_IMAGE,
        label: t('Download as image'),
        icon: <Icons.FileImageOutlined />,
        onClick: e => {
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

    menuItems.push({
      key: MENU_KEYS.DOWNLOAD_SUBMENU,
      type: 'submenu',
      label: t('Download'),
      children: downloadChildren,
    });

    // Share submenu
    const shareChildren = [
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
      type: 'submenu',
      label: t('Share'),
      children: shareChildren,
    });

    // Divider
    menuItems.push({ type: 'divider' });

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
            <ViewQueryModal latestQueryFormData={latestQueryFormData} />
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
        onClick: e => {
          onOpenInEditor(latestQueryFormData, e.domEvent.metaKey);
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
  ]);

  return [menu, isDropdownVisible, setIsDropdownVisible];
};
