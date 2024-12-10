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
import { MouseEvent, Key, useState, useRef, RefObject } from 'react';

import { useHistory } from 'react-router-dom';
import moment from 'moment';
import {
  Behavior,
  css,
  isFeatureEnabled,
  FeatureFlag,
  getChartMetadataRegistry,
  styled,
  t,
  VizType,
} from '@superset-ui/core';
import { useSelector } from 'react-redux';
import { Menu } from 'src/components/Menu';
import { NoAnimationDropdown } from 'src/components/Dropdown';
import ShareMenuItems from 'src/dashboard/components/menu/ShareMenuItems';
import downloadAsImage from 'src/utils/downloadAsImage';
import { getSliceHeaderTooltip } from 'src/dashboard/util/getSliceHeaderTooltip';
import { Tooltip } from 'src/components/Tooltip';
import Icons from 'src/components/Icons';
import ModalTrigger from 'src/components/ModalTrigger';
import ViewQueryModal from 'src/explore/components/controls/ViewQueryModal';
import { ResultsPaneOnDashboard } from 'src/explore/components/DataTablesPane';
import { DrillDetailMenuItems } from 'src/components/Chart/DrillDetail';
import { LOG_ACTIONS_CHART_DOWNLOAD_AS_IMAGE } from 'src/logger/LogUtils';
import { MenuKeys, RootState } from 'src/dashboard/types';
import { usePermissions } from 'src/hooks/usePermissions';
import { useCrossFiltersScopingModal } from '../nativeFilters/FilterBar/CrossFilters/ScopingModal/useCrossFiltersScopingModal';
import { handleDropdownNavigation } from './utils';
import { ViewResultsModalTrigger } from './ViewResultsModalTrigger';
import { SliceHeaderControlsProps } from './types';

// TODO: replace 3 dots with an icon
const VerticalDotsContainer = styled.div`
  padding: ${({ theme }) => theme.gridUnit / 4}px
    ${({ theme }) => theme.gridUnit * 1.5}px;

  .dot {
    display: block;

    height: ${({ theme }) => theme.gridUnit}px;
    width: ${({ theme }) => theme.gridUnit}px;
    border-radius: 50%;
    margin: ${({ theme }) => theme.gridUnit / 2}px 0;

    background-color: ${({ theme }) => theme.colors.text.label};
  }

  &:hover {
    cursor: pointer;
  }
`;

const RefreshTooltip = styled.div`
  height: auto;
  margin: ${({ theme }) => theme.gridUnit}px 0;
  color: ${({ theme }) => theme.colors.grayscale.base};
  line-height: 21px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: flex-start;
`;

const getScreenshotNodeSelector = (chartId: string | number) =>
  `.dashboard-chart-id-${chartId}`;

const VerticalDotsTrigger = () => (
  <VerticalDotsContainer>
    <span className="dot" />
    <span className="dot" />
    <span className="dot" />
  </VerticalDotsContainer>
);

const dropdownIconsStyles = css`
  &&.anticon > .anticon:first-child {
    margin-right: 0;
    vertical-align: 0;
  }
`;

const SliceHeaderControls = (props: SliceHeaderControlsProps) => {
  const [dropdownIsOpen, setDropdownIsOpen] = useState(false);
  const [tableModalIsOpen, setTableModalIsOpen] = useState(false);
  const [drillModalIsOpen, setDrillModalIsOpen] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  // setting openKeys undefined falls back to uncontrolled behaviour
  const [openKeys, setOpenKeys] = useState<string[] | undefined>(undefined);
  const [openScopingModal, scopingModal] = useCrossFiltersScopingModal(
    props.slice.slice_id,
  );
  const history = useHistory();

  const queryMenuRef: RefObject<any> = useRef(null);
  const menuRef: RefObject<any> = useRef(null);
  const copyLinkMenuRef: RefObject<any> = useRef(null);
  const shareByEmailMenuRef: RefObject<any> = useRef(null);
  const drillToDetailMenuRef: RefObject<any> = useRef(null);

  const toggleDropdown = ({ close }: { close?: boolean } = {}) => {
    setDropdownIsOpen(!(close || dropdownIsOpen));
    // clear selected keys
    setSelectedKeys([]);
    // clear out/deselect submenus
    // setOpenKeys([]);
  };

  const canEditCrossFilters =
    useSelector<RootState, boolean>(
      ({ dashboardInfo }) => dashboardInfo.dash_edit_perm,
    ) &&
    isFeatureEnabled(FeatureFlag.DashboardCrossFilters) &&
    getChartMetadataRegistry()
      .get(props.slice.viz_type)
      ?.behaviors?.includes(Behavior.InteractiveChart);
  const canExplore = props.supersetCanExplore;
  const { canDrillToDetail, canViewQuery, canViewTable } = usePermissions();
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
    domEvent: MouseEvent<HTMLElement>;
  }) => {
    // close menu
    toggleDropdown({ close: true });
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
          // @ts-ignore
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
      case MenuKeys.CrossFilterScoping: {
        openScopingModal();
        break;
      }
      case MenuKeys.ViewResults: {
        if (!tableModalIsOpen) {
          setTableModalIsOpen(true);
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
    moment.utc(itemCachedDttm).fromNow(),
  );
  const updatedWhen = updatedDttm ? moment.utc(updatedDttm).fromNow() : '';
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

  // controlled/uncontrolled behaviour for submenus
  const openKeysProps: Record<string, string[]> = {};
  if (openKeys) {
    openKeysProps.openKeys = openKeys;
  }

  const menu = (
    <Menu
      onClick={handleMenuClick}
      selectable={false}
      data-test={`slice_${slice.slice_id}-menu`}
      selectedKeys={selectedKeys}
      id={`slice_${slice.slice_id}-menu`}
      ref={menuRef}
      // submenus must be rendered for handleDropdownNavigation
      forceSubMenuRender
      {...openKeysProps}
    >
      <Menu.Item
        key={MenuKeys.ForceRefresh}
        disabled={props.chartStatus === 'loading'}
        style={{ height: 'auto', lineHeight: 'initial' }}
        data-test="refresh-chart-menu-item"
      >
        {t('Force refresh')}
        <RefreshTooltip data-test="dashboard-slice-refresh-tooltip">
          {refreshTooltip}
        </RefreshTooltip>
      </Menu.Item>

      <Menu.Item key={MenuKeys.Fullscreen}>{fullscreenLabel}</Menu.Item>

      <Menu.Divider />

      {slice.description && (
        <Menu.Item key={MenuKeys.ToggleChartDescription}>
          {props.isDescriptionExpanded
            ? t('Hide chart description')
            : t('Show chart description')}
        </Menu.Item>
      )}

      {canExplore && (
        <Menu.Item key={MenuKeys.ExploreChart}>
          <Tooltip title={getSliceHeaderTooltip(props.slice.slice_name)}>
            {t('Edit chart')}
          </Tooltip>
        </Menu.Item>
      )}

      {canEditCrossFilters && (
        <Menu.Item key={MenuKeys.CrossFilterScoping}>
          {t('Cross-filtering scoping')}
        </Menu.Item>
      )}

      {(canExplore || canEditCrossFilters) && <Menu.Divider />}

      {(canExplore || canViewQuery) && (
        <Menu.Item key={MenuKeys.ViewQuery}>
          <ModalTrigger
            triggerNode={
              <span data-test="view-query-menu-item">{t('View query')}</span>
            }
            modalTitle={t('View query')}
            modalBody={<ViewQueryModal latestQueryFormData={props.formData} />}
            draggable
            resizable
            responsive
            ref={queryMenuRef}
          />
        </Menu.Item>
      )}

      {(canExplore || canViewTable) && (
        <Menu.Item key={MenuKeys.ViewResults}>
          <ViewResultsModalTrigger
            canExplore={props.supersetCanExplore}
            exploreUrl={props.exploreUrl}
            triggerNode={
              <span data-test="view-query-menu-item">{t('View as table')}</span>
            }
            setShowModal={setTableModalIsOpen}
            showModal={tableModalIsOpen}
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
        </Menu.Item>
      )}

      {isFeatureEnabled(FeatureFlag.DrillToDetail) && canDrillToDetail && (
        <DrillDetailMenuItems
          chartId={slice.slice_id}
          formData={props.formData}
          key={MenuKeys.DrillToDetail}
          showModal={drillModalIsOpen}
          setShowModal={setDrillModalIsOpen}
          drillToDetailMenuRef={drillToDetailMenuRef}
        />
      )}

      {(slice.description || canExplore) && <Menu.Divider />}

      {supersetCanShare && (
        <Menu.SubMenu
          title={t('Share')}
          key={MenuKeys.Share}
          // reset to uncontrolled behaviour
          onTitleMouseEnter={() => setOpenKeys(undefined)}
        >
          <ShareMenuItems
            dashboardId={dashboardId}
            dashboardComponentId={componentId}
            copyMenuItemTitle={t('Copy permalink to clipboard')}
            emailMenuItemTitle={t('Share chart by email')}
            emailSubject={t('Superset chart')}
            emailBody={t('Check out this chart: ')}
            addSuccessToast={addSuccessToast}
            addDangerToast={addDangerToast}
            copyMenuItemRef={copyLinkMenuRef}
            shareByEmailMenuItemRef={shareByEmailMenuRef}
            selectedKeys={selectedKeys.filter(
              key => key === MenuKeys.CopyLink || key === MenuKeys.ShareByEmail,
            )}
          />
        </Menu.SubMenu>
      )}

      {props.supersetCanCSV && (
        <Menu.SubMenu
          title={t('Download')}
          key={MenuKeys.Download}
          onTitleMouseEnter={() => setOpenKeys(undefined)}
        >
          <Menu.Item
            key={MenuKeys.ExportCsv}
            icon={<Icons.FileOutlined css={dropdownIconsStyles} />}
          >
            {t('Export to .CSV')}
          </Menu.Item>
          {isPivotTable && (
            <Menu.Item
              key={MenuKeys.ExportPivotCsv}
              icon={<Icons.FileOutlined css={dropdownIconsStyles} />}
            >
              {t('Export to Pivoted .CSV')}
            </Menu.Item>
          )}
          <Menu.Item
            key={MenuKeys.ExportXlsx}
            icon={<Icons.FileOutlined css={dropdownIconsStyles} />}
          >
            {t('Export to Excel')}
          </Menu.Item>

          {isFeatureEnabled(FeatureFlag.AllowFullCsvExport) &&
            props.supersetCanCSV &&
            isTable && (
              <>
                <Menu.Item
                  key={MenuKeys.ExportFullCsv}
                  icon={<Icons.FileOutlined css={dropdownIconsStyles} />}
                >
                  {t('Export to full .CSV')}
                </Menu.Item>
                <Menu.Item
                  key={MenuKeys.ExportFullXlsx}
                  icon={<Icons.FileOutlined css={dropdownIconsStyles} />}
                >
                  {t('Export to full Excel')}
                </Menu.Item>
              </>
            )}

          <Menu.Item
            key={MenuKeys.DownloadAsImage}
            icon={<Icons.FileImageOutlined css={dropdownIconsStyles} />}
          >
            {t('Download as image')}
          </Menu.Item>
        </Menu.SubMenu>
      )}
    </Menu>
  );

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
        overlay={menu}
        overlayStyle={dropdownOverlayStyle}
        trigger={['click']}
        placement="bottomRight"
        visible={dropdownIsOpen}
        onVisibleChange={status => toggleDropdown({ close: !status })}
        onKeyDown={e =>
          handleDropdownNavigation(
            e,
            dropdownIsOpen,
            menu,
            toggleDropdown,
            setSelectedKeys,
            setOpenKeys,
          )
        }
      >
        <span
          css={() => css`
            display: flex;
            align-items: center;
          `}
          id={`slice_${slice.slice_id}-controls`}
          role="button"
          aria-label="More Options"
          aria-haspopup="true"
          tabIndex={0}
        >
          <VerticalDotsTrigger />
        </span>
      </NoAnimationDropdown>
      {canEditCrossFilters && scopingModal}
    </>
  );
};

export default SliceHeaderControls;
