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
  ReactChild,
  useState,
  useRef,
  RefObject,
  useCallback,
  ReactElement,
} from 'react';

import { RouteComponentProps, useHistory, withRouter } from 'react-router-dom';
import moment from 'moment';
import {
  Behavior,
  css,
  isFeatureEnabled,
  FeatureFlag,
  getChartMetadataRegistry,
  QueryFormData,
  styled,
  t,
  useTheme,
  ensureIsArray,
} from '@superset-ui/core';
import { useSelector } from 'react-redux';
import {
  MenuItemKeyEnum,
  Menu,
  MenuItemChildType,
  isAntdMenuItem,
  isAntdMenuItemRef,
  isSubMenuOrItemType,
  isAntdMenuSubmenu,
} from 'src/components/Menu';
import { NoAnimationDropdown } from 'src/components/Dropdown';
import ShareMenuItems from 'src/dashboard/components/menu/ShareMenuItems';
import downloadAsImage from 'src/utils/downloadAsImage';
import { getSliceHeaderTooltip } from 'src/dashboard/util/getSliceHeaderTooltip';
import { Tooltip } from 'src/components/Tooltip';
import Icons from 'src/components/Icons';
import ModalTrigger from 'src/components/ModalTrigger';
import Button from 'src/components/Button';
import ViewQueryModal from 'src/explore/components/controls/ViewQueryModal';
import { ResultsPaneOnDashboard } from 'src/explore/components/DataTablesPane';
import Modal from 'src/components/Modal';
import { DrillDetailMenuItems } from 'src/components/Chart/DrillDetail';
import { LOG_ACTIONS_CHART_DOWNLOAD_AS_IMAGE } from 'src/logger/LogUtils';
import { MenuKeys, RootState } from 'src/dashboard/types';
import { findPermission } from 'src/utils/findPermission';
import { useCrossFiltersScopingModal } from '../nativeFilters/FilterBar/CrossFilters/ScopingModal/useCrossFiltersScopingModal';

const ACTION_KEYS = {
  enter: 'Enter',
  spacebar: 'Spacebar',
  space: ' ',
};

const NAV_KEYS = {
  tab: 'Tab',
  escape: 'Escape',
  up: 'ArrowUp',
  down: 'ArrowDown',
};

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

export interface SliceHeaderControlsProps {
  slice: {
    description: string;
    viz_type: string;
    slice_name: string;
    slice_id: number;
    slice_description: string;
    datasource: string;
  };

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

/**
 * A MenuItem can be recognized in the tree by the presence of a ref
 *
 * @param children
 * @param currentKeys
 * @returns an array of keys
 */
const extractMenuItemRefs = (child: MenuItemChildType): RefObject<any>[] => {
  // check that child has props
  const childProps: Record<string, any> = child?.props;
  // loop through each prop
  if (childProps) {
    const arrayProps = Object.values(childProps);
    // check if any is of type ref MenuItem
    const refs = arrayProps.filter(ref => isAntdMenuItemRef(ref));
    return refs;
  }
  return [];
};
/**
 * Recursively extracts keys from menu items
 *
 * @param children
 * @param currentKeys
 * @returns an array of keys and their refs
 *
 */
const extractMenuItemsKeys = (
  children: MenuItemChildType[],
  currentKeys?: { key: string; ref?: RefObject<any> }[],
): { key: string; ref?: RefObject<any> }[] => {
  const allKeys = currentKeys || [];
  const arrayChildren = ensureIsArray(children);

  arrayChildren.forEach((child: MenuItemChildType) => {
    const isMenuItem = isAntdMenuItem(child);
    const refs = extractMenuItemRefs(child);
    // key is immediately available in a standard MenuItem
    if (isMenuItem) {
      const { key } = child;
      if (key) {
        allKeys.push({
          key,
        });
      }
    }
    // one or more menu items refs are available
    if (refs.length) {
      allKeys.push(
        ...refs.map(ref => ({ key: ref.current.props.eventKey, ref })),
      );
    }

    // continue to extract keys from nested children
    if (child?.props?.children) {
      const childKeys = extractMenuItemsKeys(child.props.children, allKeys);
      allKeys.push(...childKeys);
    }
  });

  return allKeys;
};

/**
 * Generates a map of keys and their types for a MenuItem
 * Individual refs can be given to extract keys from nested items
 * Refs can be used to control the event handlers of the menu items
 *
 * @param itemChildren
 * @param type
 * @returns a map of keys and their types
 */
const extractMenuItemsKeyMap = (
  children: MenuItemChildType,
): Record<string, any> => {
  const keysMap: Record<string, any> = {};
  const childrenArray = ensureIsArray(children);

  childrenArray.forEach((child: MenuItemChildType) => {
    const isMenuItem = isAntdMenuItem(child);
    const isSubmenu = isAntdMenuSubmenu(child);
    const menuItemsRefs = extractMenuItemRefs(child);

    // key is immediately available in MenuItem or SubMenu
    if (isMenuItem || isSubmenu) {
      const directKey = child?.key;
      if (directKey) {
        keysMap[directKey] = {};
        keysMap[directKey].type = isSubmenu
          ? MenuItemKeyEnum.SubMenu
          : MenuItemKeyEnum.MenuItem;
      }
    }

    // one or more menu items refs are available
    if (menuItemsRefs.length) {
      menuItemsRefs.forEach(ref => {
        const key = ref.current.props.eventKey;
        keysMap[key] = {};
        keysMap[key].type = isSubmenu
          ? MenuItemKeyEnum.SubMenu
          : MenuItemKeyEnum.MenuItem;
        keysMap[key].parent = child.key;
        keysMap[key].ref = ref;
      });
    }

    // if it has children must check for the presence of menu items
    if (child?.props?.children) {
      const theChildren = child?.props?.children;
      const childKeys = extractMenuItemsKeys(theChildren);
      childKeys.forEach(keyMap => {
        const k = keyMap.key;
        keysMap[k] = {};
        keysMap[k].type = MenuItemKeyEnum.SubMenuItem;
        keysMap[k].parent = child.key;
        if (keyMap.ref) {
          keysMap[k].ref = keyMap.ref;
        }
      });
    }
  });

  return keysMap;
};

/**
 *
 * Determines the next key to select based on the current key and direction
 *
 * @param keys
 * @param keysMap
 * @param currentKeyIndex
 * @param direction
 * @returns the selected key and the open key
 */
const getNavigationKeys = (
  keys: string[],
  keysMap: Record<string, any>,
  currentKeyIndex: number,
  direction = 'up',
) => {
  const step = direction === 'up' ? -1 : 1;
  const skipStep = direction === 'up' ? -2 : 2;
  const keysLen = direction === 'up' ? 0 : keys.length;
  const mathFn = direction === 'up' ? Math.max : Math.min;
  let openKey: string | undefined;
  let selectedKey = keys[mathFn(currentKeyIndex + step, keysLen)];

  // go to first key if current key is the last
  if (!selectedKey) {
    return { selectedKey: keys[0], openKey: undefined };
  }

  const isSubMenu = keysMap[selectedKey]?.type === MenuItemKeyEnum.SubMenu;
  if (isSubMenu) {
    // this is a submenu, skip to first submenu item
    selectedKey = keys[mathFn(currentKeyIndex + skipStep, keysLen)];
  }
  // re-evaulate if current selected key is a submenu or submenu item
  if (!isSubMenuOrItemType(keysMap[selectedKey].type)) {
    openKey = undefined;
  } else {
    const parentKey = keysMap[selectedKey].parent;
    if (parentKey) {
      openKey = parentKey;
    }
  }
  return { selectedKey, openKey };
};

export const handleDropdownNavigation = (
  e: KeyboardEvent<HTMLElement>,
  dropdownIsOpen: boolean,
  menu: ReactElement,
  toggleDropdown: () => void,
  setSelectedKeys: (keys: string[]) => void,
  setOpenKeys: (keys: string[]) => void,
) => {
  if (e.key === NAV_KEYS.tab && !dropdownIsOpen) {
    return; // if tab, continue with system tab navigation
  }
  const menuProps = menu.props || {};
  const keysMap = extractMenuItemsKeyMap(menuProps.children);
  const keys = Object.keys(keysMap);
  const { selectedKeys = [] } = menuProps;
  const currentKeyIndex = keys.indexOf(selectedKeys[0]);

  switch (e.key) {
    // toggle the dropdown on keypress
    case ACTION_KEYS.enter:
    case ACTION_KEYS.spacebar:
    case ACTION_KEYS.space:
      if (selectedKeys.length) {
        const currentKey = selectedKeys[0];
        const currentKeyConf = keysMap[selectedKeys];
        // when a menu item is selected, then trigger
        // the menu item's onClick handler
        menuProps.onClick?.({ key: currentKey, domEvent: e });
        // trigger click handle on ref
        if (currentKeyConf?.ref) {
          const refMenuItemProps = currentKeyConf.ref.current.props;
          refMenuItemProps.onClick?.({
            key: currentKey,
            domEvent: e,
          });
        }
        // clear out/deselect keys
        setSelectedKeys([]);
        // close submenus
        setOpenKeys([]);
        // put focus back on menu trigger
        e.currentTarget.focus();
      }
      // if nothing was selected, or after selecting new menu item,
      toggleDropdown();
      break;
    // select the menu items going down
    case NAV_KEYS.down:
    case NAV_KEYS.tab && !e.shiftKey: {
      const { selectedKey, openKey } = getNavigationKeys(
        keys,
        keysMap,
        currentKeyIndex,
        'down',
      );
      setSelectedKeys([selectedKey]);
      setOpenKeys(openKey ? [openKey] : []);
      break;
    }
    // select the menu items going up
    case NAV_KEYS.up:
    case NAV_KEYS.tab && e.shiftKey: {
      const { selectedKey, openKey } = getNavigationKeys(
        keys,
        keysMap,
        currentKeyIndex,
        'up',
      );
      setSelectedKeys([selectedKey]);
      setOpenKeys(openKey ? [openKey] : []);
      break;
    }
    case NAV_KEYS.escape:
      // close dropdown menu
      toggleDropdown();
      break;
    default:
      break;
  }
};

const ViewResultsModalTrigger = ({
  canExplore,
  exploreUrl,
  triggerNode,
  modalTitle,
  modalBody,
  showModal = false,
  setShowModal,
}: {
  canExplore?: boolean;
  exploreUrl: string;
  triggerNode: ReactChild;
  modalTitle: ReactChild;
  modalBody: ReactChild;
  showModal: boolean;
  setShowModal: (showModal: boolean) => void;
}) => {
  const history = useHistory();
  const exploreChart = () => history.push(exploreUrl);
  const theme = useTheme();
  const openModal = useCallback(() => setShowModal(true), []);
  const closeModal = useCallback(() => setShowModal(false), []);

  return (
    <>
      <span
        data-test="span-modal-trigger"
        onClick={openModal}
        role="button"
        tabIndex={0}
      >
        {triggerNode}
      </span>
      {(() => (
        <Modal
          css={css`
            .ant-modal-body {
              display: flex;
              flex-direction: column;
            }
          `}
          show={showModal}
          onHide={closeModal}
          closable
          title={modalTitle}
          footer={
            <>
              <Button
                buttonStyle="secondary"
                buttonSize="small"
                onClick={exploreChart}
                disabled={!canExplore}
                tooltip={
                  !canExplore
                    ? t(
                        'You do not have sufficient permissions to edit the chart',
                      )
                    : undefined
                }
              >
                {t('Edit chart')}
              </Button>
              <Button
                buttonStyle="primary"
                buttonSize="small"
                onClick={closeModal}
                css={css`
                  margin-left: ${theme.gridUnit * 2}px;
                `}
              >
                {t('Close')}
              </Button>
            </>
          }
          responsive
          resizable
          resizableConfig={{
            minHeight: theme.gridUnit * 128,
            minWidth: theme.gridUnit * 128,
            defaultSize: {
              width: 'auto',
              height: '75vh',
            },
          }}
          draggable
          destroyOnClose
        >
          {modalBody}
        </Modal>
      ))()}
    </>
  );
};

const SliceHeaderControls = (props: SliceHeaderControlsPropsWithRouter) => {
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
  const canDatasourceSamples = useSelector((state: RootState) =>
    findPermission('can_samples', 'Datasource', state.user?.roles),
  );
  const canDrill = useSelector((state: RootState) =>
    findPermission('can_drill', 'Dashboard', state.user?.roles),
  );
  const canDrillToDetail = (canExplore || canDrill) && canDatasourceSamples;
  const canViewQuery = useSelector((state: RootState) =>
    findPermission('can_view_query', 'Dashboard', state.user?.roles),
  );
  const canViewTable = useSelector((state: RootState) =>
    findPermission('can_view_chart_as_table', 'Dashboard', state.user?.roles),
  );
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
  const isTable = slice.viz_type === 'table';
  const isPivotTable = slice.viz_type === 'pivot_table_v2';
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

export default withRouter(SliceHeaderControls);
