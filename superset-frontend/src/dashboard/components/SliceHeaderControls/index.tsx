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
  MouseEvent,
  Key,
  KeyboardEvent,
  useState,
  useRef,
  RefObject,
} from 'react';

import { RouteComponentProps, useHistory } from 'react-router-dom';
import { extendedDayjs } from '@superset-ui/core/utils/dates';
import {
  Behavior,
  css,
  isFeatureEnabled,
  FeatureFlag,
  useTheme,
  getChartMetadataRegistry,
  styled,
  t,
  VizType,
  BinaryQueryObjectFilterClause,
  QueryFormData,
} from '@superset-ui/core';
import { useSelector } from 'react-redux';
import { Menu, MenuItem } from '@superset-ui/core/components/Menu';
import {
  NoAnimationDropdown,
  Tooltip,
  Button,
  ModalTrigger,
} from '@superset-ui/core/components';
import { useShareMenuItems } from 'src/dashboard/components/menu/ShareMenuItems';
import downloadAsImage from 'src/utils/downloadAsImage';
import { getSliceHeaderTooltip } from 'src/dashboard/util/getSliceHeaderTooltip';
import { Icons } from '@superset-ui/core/components/Icons';
import ViewQueryModal from 'src/explore/components/controls/ViewQueryModal';
import { ResultsPaneOnDashboard } from 'src/explore/components/DataTablesPane';
import { useDrillDetailMenuItems } from 'src/components/Chart/useDrillDetailMenuItems';
import { LOG_ACTIONS_CHART_DOWNLOAD_AS_IMAGE } from 'src/logger/LogUtils';
import { MenuKeys, RootState } from 'src/dashboard/types';
import DrillDetailModal from 'src/components/Chart/DrillDetail/DrillDetailModal';
import { usePermissions } from 'src/hooks/usePermissions';
import { useDatasetDrillInfo } from 'src/hooks/apiResources/datasets';
import { ResourceStatus } from 'src/hooks/apiResources/apiResources';
import { useCrossFiltersScopingModal } from '../nativeFilters/FilterBar/CrossFilters/ScopingModal/useCrossFiltersScopingModal';
import { ViewResultsModalTrigger } from './ViewResultsModalTrigger';

const RefreshTooltip = styled.div`
  ${({ theme }) => css`
    height: auto;
    margin: ${theme.sizeUnit}px 0;
    color: ${theme.colorTextLabel};
    line-height: 21px;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: flex-start;
  `}
`;

const getScreenshotNodeSelector = (chartId: string | number) =>
  `.dashboard-chart-id-${chartId}`;

const VerticalDotsTrigger = () => {
  const theme = useTheme();
  return (
    <Icons.EllipsisOutlined
      css={css`
        transform: rotate(90deg);
        &:hover {
          cursor: pointer;
        }
      `}
      iconSize="xl"
      iconColor={theme.colorTextLabel}
      className="dot"
    />
  );
};

export interface SliceHeaderControlsProps {
  slice: {
    description: string;
    viz_type: string;
    slice_name: string;
    slice_id: number;
    slice_description: string;
    datasource: string;
  };

  defaultOpen?: boolean;
  componentId: string;
  dashboardId: number;
  chartStatus: string;
  isCached: boolean[];
  cachedDttm: string[] | null;
  isExpanded?: boolean;
  updatedDttm: number | null;
  isFullSize?: boolean;
  isDescriptionExpanded?: boolean;
  formData: QueryFormData;
  exploreUrl: string;

  forceRefresh: (sliceId: number, dashboardId: number) => void;
  logExploreChart?: (sliceId: number) => void;
  logEvent?: (eventName: string, eventData?: object) => void;
  toggleExpandSlice?: (sliceId: number) => void;
  exportCSV?: (sliceId: number) => void;
  exportPivotCSV?: (sliceId: number) => void;
  exportFullCSV?: (sliceId: number) => void;
  exportXLSX?: (sliceId: number) => void;
  exportFullXLSX?: (sliceId: number) => void;
  handleToggleFullSize: () => void;
  exportPivotExcel?: (tableSelector: string, sliceName: string) => void;

  addDangerToast: (message: string) => void;
  addSuccessToast: (message: string) => void;

  supersetCanExplore?: boolean;
  supersetCanShare?: boolean;
  supersetCanCSV?: boolean;

  crossFiltersEnabled?: boolean;
}
type SliceHeaderControlsPropsWithRouter = SliceHeaderControlsProps &
  RouteComponentProps;

const dropdownIconsStyles = css`
  &&.anticon > .anticon:first-child {
    margin-right: 0;
    vertical-align: 0;
  }
`;

const SliceHeaderControls = (
  props: SliceHeaderControlsPropsWithRouter | SliceHeaderControlsProps,
) => {
  const [drillModalIsOpen, setDrillModalIsOpen] = useState(false);
  // setting openKeys undefined falls back to uncontrolled behaviour
  const [isDropdownVisible, setIsDropdownVisible] = useState(false);
  const [openScopingModal, scopingModal] = useCrossFiltersScopingModal(
    props.slice.slice_id,
  );
  const history = useHistory();

  const queryMenuRef: RefObject<any> = useRef(null);
  const resultsMenuRef: RefObject<any> = useRef(null);

  const [modalFilters, setFilters] = useState<BinaryQueryObjectFilterClause[]>(
    [],
  );
  const theme = useTheme();

  const canEditCrossFilters =
    useSelector<RootState, boolean>(
      ({ dashboardInfo }) => dashboardInfo.dash_edit_perm,
    ) &&
    getChartMetadataRegistry()
      .get(props.slice.viz_type)
      ?.behaviors?.includes(Behavior.InteractiveChart);
  const canExplore = props.supersetCanExplore;
  const { canDrillToDetail, canViewQuery, canViewTable } = usePermissions();

  const datasetResource = useDatasetDrillInfo(
    props.slice.datasource,
    props.dashboardId,
    props.formData,
    !canDrillToDetail,
  );

  const datasetWithVerboseMap =
    datasetResource.status === ResourceStatus.Complete
      ? datasetResource.result
      : undefined;

  const refreshChart = () => {
    if (props.updatedDttm) {
      props.forceRefresh(props.slice.slice_id, props.dashboardId);
    }
  };

  const handleMenuClick = ({
    key,
    domEvent,
  }: {
    key: Key;
    domEvent: MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>;
  }) => {
    switch (key) {
      case MenuKeys.ForceRefresh:
        refreshChart();
        props.addSuccessToast(t('Data refreshed'));
        break;
      case MenuKeys.ToggleChartDescription:
        // eslint-disable-next-line no-unused-expressions
        props.toggleExpandSlice?.(props.slice.slice_id);
        break;
      case MenuKeys.ExploreChart:
        // eslint-disable-next-line no-unused-expressions
        props.logExploreChart?.(props.slice.slice_id);
        if (domEvent.metaKey || domEvent.ctrlKey) {
          domEvent.preventDefault();
          window.open(props.exploreUrl, '_blank');
        } else {
          history.push(props.exploreUrl);
        }
        break;
      case MenuKeys.ExportCsv:
        // eslint-disable-next-line no-unused-expressions
        props.exportCSV?.(props.slice.slice_id);
        break;
      case MenuKeys.ExportPivotCsv:
        // eslint-disable-next-line no-unused-expressions
        props.exportPivotCSV?.(props.slice.slice_id);
        break;
      case MenuKeys.Fullscreen:
        props.handleToggleFullSize();
        break;
      case MenuKeys.ExportFullCsv:
        // eslint-disable-next-line no-unused-expressions
        props.exportFullCSV?.(props.slice.slice_id);
        break;
      case MenuKeys.ExportFullXlsx:
        // eslint-disable-next-line no-unused-expressions
        props.exportFullXLSX?.(props.slice.slice_id);
        break;
      case MenuKeys.ExportXlsx:
        // eslint-disable-next-line no-unused-expressions
        props.exportXLSX?.(props.slice.slice_id);
        break;
      case MenuKeys.DownloadAsImage: {
        // menu closes with a delay, we need to hide it manually,
        // so that we don't capture it on the screenshot
        const menu = document.querySelector(
          '.ant-dropdown:not(.ant-dropdown-hidden)',
        ) as HTMLElement;
        if (menu) {
          menu.style.visibility = 'hidden';
        }
        downloadAsImage(
          getScreenshotNodeSelector(props.slice.slice_id),
          props.slice.slice_name,
          true,
          theme,
        )(domEvent).then(() => {
          if (menu) {
            menu.style.visibility = 'visible';
          }
        });
        props.logEvent?.(LOG_ACTIONS_CHART_DOWNLOAD_AS_IMAGE, {
          chartId: props.slice.slice_id,
        });
        break;
      }
      case MenuKeys.ExportPivotXlsx: {
        const sliceSelector = `#chart-id-${props.slice.slice_id}`;
        props.exportPivotExcel?.(
          `${sliceSelector} .pvtTable`,
          props.slice.slice_name,
        );
        break;
      }
      case MenuKeys.CrossFilterScoping: {
        openScopingModal();
        break;
      }
      case MenuKeys.ViewResults: {
        if (resultsMenuRef.current && !resultsMenuRef.current.showModal) {
          resultsMenuRef.current.open(domEvent);
        }
        break;
      }
      case MenuKeys.DrillToDetail: {
        setDrillModalIsOpen(!drillModalIsOpen);
        break;
      }
      case MenuKeys.ViewQuery: {
        if (queryMenuRef.current && !queryMenuRef.current.showModal) {
          queryMenuRef.current.open(domEvent);
        }
        break;
      }
      default:
        break;
    }
    setIsDropdownVisible(false);
  };

  const {
    componentId,
    dashboardId,
    slice,
    isFullSize,
    cachedDttm = [],
    updatedDttm = null,
    addSuccessToast = () => {},
    addDangerToast = () => {},
    supersetCanShare = false,
    isCached = [],
  } = props;
  const isTable = slice.viz_type === VizType.Table;
  const isPivotTable = slice.viz_type === VizType.PivotTable;
  const cachedWhen = (cachedDttm || []).map(itemCachedDttm =>
    extendedDayjs.utc(itemCachedDttm).fromNow(),
  );
  const updatedWhen = updatedDttm
    ? extendedDayjs.utc(updatedDttm).fromNow()
    : '';
  const getCachedTitle = (itemCached: boolean) => {
    if (itemCached) {
      return t('Cached %s', cachedWhen);
    }
    if (updatedWhen) {
      return t('Fetched %s', updatedWhen);
    }
    return '';
  };
  const refreshTooltipData = [...new Set(isCached.map(getCachedTitle) || '')];
  // If all queries have same cache time we can unit them to one
  const refreshTooltip = refreshTooltipData.map((item, index) => (
    <div key={`tooltip-${index}`}>
      {refreshTooltipData.length > 1
        ? t('Query %s: %s', index + 1, item)
        : item}
    </div>
  ));
  const fullscreenLabel = isFullSize
    ? t('Exit fullscreen')
    : t('Enter fullscreen');

  // @z-index-below-dashboard-header (100) - 1 = 99 for !isFullSize and 101 for isFullSize
  const dropdownOverlayStyle = {
    zIndex: isFullSize ? 101 : 99,
    animationDuration: '0s',
  };

  const newMenuItems: MenuItem[] = [
    {
      key: MenuKeys.ForceRefresh,
      label: (
        <>
          {t('Force refresh')}
          <RefreshTooltip data-test="dashboard-slice-refresh-tooltip">
            {refreshTooltip}
          </RefreshTooltip>
        </>
      ),
      disabled: props.chartStatus === 'loading',
      style: { height: 'auto', lineHeight: 'initial' },
      ...{ 'data-test': 'refresh-chart-menu-item' }, // Typescript hack to get around MenuItem type
    },
    {
      key: MenuKeys.Fullscreen,
      label: fullscreenLabel,
    },
    {
      type: 'divider',
    },
  ];

  if (slice.description) {
    newMenuItems.push({
      key: MenuKeys.ToggleChartDescription,
      label: props.isDescriptionExpanded
        ? t('Hide chart description')
        : t('Show chart description'),
    });
  }

  if (canExplore) {
    newMenuItems.push({
      key: MenuKeys.ExploreChart,
      label: (
        <Tooltip title={getSliceHeaderTooltip(props.slice.slice_name)}>
          {t('Edit chart')}
        </Tooltip>
      ),
      ...{ 'data-test-edit-chart-name': slice.slice_name },
    });
  }

  if (canEditCrossFilters) {
    newMenuItems.push({
      key: MenuKeys.CrossFilterScoping,
      label: t('Cross-filtering scoping'),
    });
  }

  if (canExplore || canEditCrossFilters) {
    newMenuItems.push({ type: 'divider' });
  }

  if (canExplore || canViewQuery) {
    newMenuItems.push({
      key: MenuKeys.ViewQuery,
      label: (
        <ModalTrigger
          triggerNode={
            <div data-test="view-query-menu-item">{t('View query')}</div>
          }
          modalTitle={t('View query')}
          modalBody={<ViewQueryModal latestQueryFormData={props.formData} />}
          draggable
          resizable
          responsive
          ref={queryMenuRef}
        />
      ),
    });
  }

  if (canExplore || canViewTable) {
    newMenuItems.push({
      key: MenuKeys.ViewResults,
      label: (
        <ViewResultsModalTrigger
          canExplore={props.supersetCanExplore}
          exploreUrl={props.exploreUrl}
          triggerNode={
            <div data-test="view-query-menu-item">{t('View as table')}</div>
          }
          modalRef={resultsMenuRef}
          modalTitle={t('Chart Data: %s', slice.slice_name)}
          modalBody={
            <ResultsPaneOnDashboard
              queryFormData={props.formData}
              queryForce={false}
              dataSize={20}
              isRequest
              isVisible
              canDownload={!!props.supersetCanCSV}
            />
          }
        />
      ),
    });
  }

  const drillDetailMenuItems = useDrillDetailMenuItems({
    formData: props.formData,
    filters: modalFilters,
    setFilters,
    setShowModal: setDrillModalIsOpen,
    key: MenuKeys.DrillToDetail,
  });

  const shareMenuItems = useShareMenuItems({
    dashboardId,
    dashboardComponentId: componentId,
    copyMenuItemTitle: t('Copy permalink to clipboard'),
    emailMenuItemTitle: t('Share chart by email'),
    emailSubject: t('Superset chart'),
    emailBody: t('Check out this chart: '),
    addSuccessToast,
    addDangerToast,
    title: t('Share'),
  });

  if (isFeatureEnabled(FeatureFlag.DrillToDetail) && canDrillToDetail) {
    newMenuItems.push(...drillDetailMenuItems);
  }

  if (slice.description || canExplore) {
    newMenuItems.push({ type: 'divider' });
  }

  if (supersetCanShare) {
    newMenuItems.push(shareMenuItems);
  }

  if (props.supersetCanCSV) {
    newMenuItems.push({
      type: 'submenu',
      key: MenuKeys.Download,
      label: t('Download'),
      children: [
        {
          key: MenuKeys.ExportCsv,
          label: t('Export to .CSV'),
          icon: <Icons.FileOutlined css={dropdownIconsStyles} />,
        },
        ...(isPivotTable
          ? [
              {
                key: MenuKeys.ExportPivotCsv,
                label: t('Export to Pivoted .CSV'),
                icon: <Icons.FileOutlined css={dropdownIconsStyles} />,
              },
              {
                key: MenuKeys.ExportPivotXlsx,
                label: t('Export to Pivoted Excel'),
                icon: <Icons.FileOutlined css={dropdownIconsStyles} />,
              },
            ]
          : []),
        {
          key: MenuKeys.ExportXlsx,
          label: t('Export to Excel'),
          icon: <Icons.FileOutlined css={dropdownIconsStyles} />,
        },
        ...(isFeatureEnabled(FeatureFlag.AllowFullCsvExport) &&
        props.supersetCanCSV &&
        isTable
          ? [
              {
                key: MenuKeys.ExportFullCsv,
                label: t('Export to full .CSV'),
                icon: <Icons.FileOutlined css={dropdownIconsStyles} />,
              },
              {
                key: MenuKeys.ExportFullXlsx,
                label: t('Export to full Excel'),
                icon: <Icons.FileOutlined css={dropdownIconsStyles} />,
              },
            ]
          : []),
        {
          key: MenuKeys.DownloadAsImage,
          label: t('Download as image'),
          icon: <Icons.FileImageOutlined css={dropdownIconsStyles} />,
        },
      ],
    });
  }

  return (
    <>
      {isFullSize && (
        <Icons.FullscreenExitOutlined
          style={{ fontSize: 22 }}
          onClick={() => {
            props.handleToggleFullSize();
          }}
        />
      )}
      <NoAnimationDropdown
        popupRender={() => (
          <Menu
            onClick={handleMenuClick}
            data-test={`slice_${slice.slice_id}-menu`}
            id={`slice_${slice.slice_id}-menu`}
            selectable={false}
            items={newMenuItems}
          />
        )}
        overlayStyle={dropdownOverlayStyle}
        trigger={['click']}
        placement="bottomRight"
        open={isDropdownVisible}
        onOpenChange={visible => setIsDropdownVisible(visible)}
      >
        <Button
          id={`slice_${slice.slice_id}-controls`}
          buttonStyle="link"
          aria-label="More Options"
          aria-haspopup="true"
          css={theme => css`
            padding: ${theme.sizeUnit * 2}px;
            padding-right: 0px;
          `}
        >
          <VerticalDotsTrigger />
        </Button>
      </NoAnimationDropdown>
      <DrillDetailModal
        formData={props.formData}
        initialFilters={[]}
        onHideModal={() => {
          setDrillModalIsOpen(false);
        }}
        chartId={slice.slice_id}
        showModal={drillModalIsOpen}
        dataset={datasetWithVerboseMap}
      />

      {canEditCrossFilters && scopingModal}
    </>
  );
};

export default SliceHeaderControls;
