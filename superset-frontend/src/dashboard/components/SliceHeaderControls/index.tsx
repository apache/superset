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
  MouseEvent,
  Key,
  ReactChild,
  useState,
  useCallback,
} from 'react';
import {
  Link,
  RouteComponentProps,
  useHistory,
  withRouter,
} from 'react-router-dom';
import moment from 'moment';
import {
  css,
  FeatureFlag,
  QueryFormData,
  styled,
  t,
  useTheme,
} from '@superset-ui/core';
import { Menu } from 'src/components/Menu';
import { NoAnimationDropdown } from 'src/components/Dropdown';
import ShareMenuItems from 'src/dashboard/components/menu/ShareMenuItems';
import downloadAsImage from 'src/utils/downloadAsImage';
import { isFeatureEnabled } from 'src/featureFlags';
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

const MENU_KEYS = {
  DOWNLOAD_AS_IMAGE: 'download_as_image',
  EXPLORE_CHART: 'explore_chart',
  EXPORT_CSV: 'export_csv',
  EXPORT_FULL_CSV: 'export_full_csv',
  FORCE_REFRESH: 'force_refresh',
  FULLSCREEN: 'fullscreen',
  TOGGLE_CHART_DESCRIPTION: 'toggle_chart_description',
  VIEW_QUERY: 'view_query',
  VIEW_RESULTS: 'view_results',
  DRILL_TO_DETAIL: 'drill_to_detail',
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
  exportFullCSV?: (sliceId: number) => void;
  handleToggleFullSize: () => void;

  addDangerToast: (message: string) => void;
  addSuccessToast: (message: string) => void;

  supersetCanExplore?: boolean;
  supersetCanShare?: boolean;
  supersetCanCSV?: boolean;
  sliceCanEdit?: boolean;

  crossFiltersEnabled?: boolean;
}
type SliceHeaderControlsPropsWithRouter = SliceHeaderControlsProps &
  RouteComponentProps;
interface State {
  showControls: boolean;
}

const dropdownIconsStyles = css`
  &&.anticon > .anticon:first-child {
    margin-right: 0;
    vertical-align: 0;
  }
`;

const ViewResultsModalTrigger = ({
  exploreUrl,
  triggerNode,
  modalTitle,
  modalBody,
}: {
  exploreUrl: string;
  triggerNode: ReactChild;
  modalTitle: ReactChild;
  modalBody: ReactChild;
}) => {
  const [showModal, setShowModal] = useState(false);
  const openModal = useCallback(() => setShowModal(true), []);
  const closeModal = useCallback(() => setShowModal(false), []);
  const history = useHistory();
  const exploreChart = () => history.push(exploreUrl);
  const theme = useTheme();

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
          title={modalTitle}
          footer={
            <>
              <Button
                buttonStyle="secondary"
                buttonSize="small"
                onClick={exploreChart}
              >
                {t('Edit chart')}
              </Button>
              <Button
                buttonStyle="primary"
                buttonSize="small"
                onClick={closeModal}
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

class SliceHeaderControls extends React.PureComponent<
  SliceHeaderControlsPropsWithRouter,
  State
> {
  constructor(props: SliceHeaderControlsPropsWithRouter) {
    super(props);
    this.toggleControls = this.toggleControls.bind(this);
    this.refreshChart = this.refreshChart.bind(this);
    this.handleMenuClick = this.handleMenuClick.bind(this);

    this.state = {
      showControls: false,
    };
  }

  refreshChart() {
    if (this.props.updatedDttm) {
      this.props.forceRefresh(
        this.props.slice.slice_id,
        this.props.dashboardId,
      );
    }
  }

  toggleControls() {
    this.setState(prevState => ({
      showControls: !prevState.showControls,
    }));
  }

  handleMenuClick({
    key,
    domEvent,
  }: {
    key: Key;
    domEvent: MouseEvent<HTMLElement>;
  }) {
    switch (key) {
      case MENU_KEYS.FORCE_REFRESH:
        this.refreshChart();
        this.props.addSuccessToast(t('Data refreshed'));
        break;
      case MENU_KEYS.TOGGLE_CHART_DESCRIPTION:
        // eslint-disable-next-line no-unused-expressions
        this.props.toggleExpandSlice?.(this.props.slice.slice_id);
        break;
      case MENU_KEYS.EXPLORE_CHART:
        // eslint-disable-next-line no-unused-expressions
        this.props.logExploreChart?.(this.props.slice.slice_id);
        break;
      case MENU_KEYS.EXPORT_CSV:
        // eslint-disable-next-line no-unused-expressions
        this.props.exportCSV?.(this.props.slice.slice_id);
        break;
      case MENU_KEYS.FULLSCREEN:
        this.props.handleToggleFullSize();
        break;
      case MENU_KEYS.EXPORT_FULL_CSV:
        // eslint-disable-next-line no-unused-expressions
        this.props.exportFullCSV?.(this.props.slice.slice_id);
        break;
      case MENU_KEYS.DOWNLOAD_AS_IMAGE: {
        // menu closes with a delay, we need to hide it manually,
        // so that we don't capture it on the screenshot
        const menu = document.querySelector(
          '.ant-dropdown:not(.ant-dropdown-hidden)',
        ) as HTMLElement;
        menu.style.visibility = 'hidden';
        downloadAsImage(
          getScreenshotNodeSelector(this.props.slice.slice_id),
          this.props.slice.slice_name,
          true,
          // @ts-ignore
        )(domEvent).then(() => {
          menu.style.visibility = 'visible';
        });
        this.props.logEvent?.(LOG_ACTIONS_CHART_DOWNLOAD_AS_IMAGE, {
          chartId: this.props.slice.slice_id,
        });
        break;
      }
      default:
        break;
    }
  }

  render() {
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
    } = this.props;
    const isTable = slice.viz_type === 'table';
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

    const menu = (
      <Menu
        onClick={this.handleMenuClick}
        selectable={false}
        data-test={`slice_${slice.slice_id}-menu`}
      >
        <Menu.Item
          key={MENU_KEYS.FORCE_REFRESH}
          disabled={this.props.chartStatus === 'loading'}
          style={{ height: 'auto', lineHeight: 'initial' }}
          data-test="refresh-chart-menu-item"
        >
          {t('Force refresh')}
          <RefreshTooltip data-test="dashboard-slice-refresh-tooltip">
            {refreshTooltip}
          </RefreshTooltip>
        </Menu.Item>

        <Menu.Item key={MENU_KEYS.FULLSCREEN}>{fullscreenLabel}</Menu.Item>

        <Menu.Divider />

        {slice.description && (
          <Menu.Item key={MENU_KEYS.TOGGLE_CHART_DESCRIPTION}>
            {this.props.isDescriptionExpanded
              ? t('Hide chart description')
              : t('Show chart description')}
          </Menu.Item>
        )}

        {this.props.supersetCanExplore && (
          <Menu.Item key={MENU_KEYS.EXPLORE_CHART}>
            <Link to={this.props.exploreUrl}>
              <Tooltip
                title={getSliceHeaderTooltip(this.props.slice.slice_name)}
              >
                {t('Edit chart')}
              </Tooltip>
            </Link>
          </Menu.Item>
        )}

        {this.props.supersetCanExplore && (
          <Menu.Item key={MENU_KEYS.VIEW_QUERY}>
            <ModalTrigger
              triggerNode={
                <span data-test="view-query-menu-item">{t('View query')}</span>
              }
              modalTitle={t('View query')}
              modalBody={
                <ViewQueryModal latestQueryFormData={this.props.formData} />
              }
              draggable
              resizable
              responsive
            />
          </Menu.Item>
        )}

        {this.props.supersetCanExplore && (
          <Menu.Item key={MENU_KEYS.VIEW_RESULTS}>
            <ViewResultsModalTrigger
              exploreUrl={this.props.exploreUrl}
              triggerNode={
                <span data-test="view-query-menu-item">
                  {t('View as table')}
                </span>
              }
              modalTitle={t('Chart Data: %s', slice.slice_name)}
              modalBody={
                <ResultsPaneOnDashboard
                  queryFormData={this.props.formData}
                  queryForce={false}
                  dataSize={20}
                  isRequest
                  isVisible
                />
              }
            />
          </Menu.Item>
        )}

        {isFeatureEnabled(FeatureFlag.DRILL_TO_DETAIL) &&
          this.props.supersetCanExplore && (
            <DrillDetailMenuItems
              chartId={slice.slice_id}
              formData={this.props.formData}
            />
          )}

        {(slice.description || this.props.supersetCanExplore) && (
          <Menu.Divider />
        )}

        {supersetCanShare && (
          <Menu.SubMenu title={t('Share')}>
            <ShareMenuItems
              dashboardId={dashboardId}
              dashboardComponentId={componentId}
              copyMenuItemTitle={t('Copy permalink to clipboard')}
              emailMenuItemTitle={t('Share chart by email')}
              emailSubject={t('Superset chart')}
              emailBody={t('Check out this chart: ')}
              addSuccessToast={addSuccessToast}
              addDangerToast={addDangerToast}
            />
          </Menu.SubMenu>
        )}

        {this.props.slice.viz_type !== 'filter_box' &&
          this.props.supersetCanCSV && (
            <Menu.SubMenu title={t('Download')}>
              <Menu.Item
                key={MENU_KEYS.EXPORT_CSV}
                icon={<Icons.FileOutlined css={dropdownIconsStyles} />}
              >
                {t('Export to .CSV')}
              </Menu.Item>

              {this.props.slice.viz_type !== 'filter_box' &&
                isFeatureEnabled(FeatureFlag.ALLOW_FULL_CSV_EXPORT) &&
                this.props.supersetCanCSV &&
                isTable && (
                  <Menu.Item
                    key={MENU_KEYS.EXPORT_FULL_CSV}
                    icon={<Icons.FileOutlined css={dropdownIconsStyles} />}
                  >
                    {t('Export to full .CSV')}
                  </Menu.Item>
                )}

              <Menu.Item
                key={MENU_KEYS.DOWNLOAD_AS_IMAGE}
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
              this.props.handleToggleFullSize();
            }}
          />
        )}
        <NoAnimationDropdown
          overlay={menu}
          trigger={['click']}
          placement="bottomRight"
        >
          <span
            css={css`
              display: flex;
              align-items: center;
            `}
            id={`slice_${slice.slice_id}-controls`}
            role="button"
            aria-label="More Options"
          >
            <VerticalDotsTrigger />
          </span>
        </NoAnimationDropdown>
      </>
    );
  }
}

export default withRouter(SliceHeaderControls);
