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
import React from 'react';
import moment from 'moment';
import {
  Behavior,
  getChartMetadataRegistry,
  styled,
  t,
} from '@superset-ui/core';
import { Menu, NoAnimationDropdown } from 'src/common/components';
import ShareMenuItems from 'src/dashboard/components/menu/ShareMenuItems';
import downloadAsImage from 'src/utils/downloadAsImage';
import getDashboardUrl from 'src/dashboard/util/getDashboardUrl';
import { getActiveFilters } from 'src/dashboard/util/activeDashboardFilters';
import { FeatureFlag, isFeatureEnabled } from 'src/featureFlags';
import CrossFilterScopingModal from 'src/dashboard/components/CrossFilterScopingModal/CrossFilterScopingModal';
import Icons from 'src/components/Icons';
import ModalTrigger from 'src/components/ModalTrigger';
import ViewQueryModal from 'src/explore/components/controls/ViewQueryModal';

const MENU_KEYS = {
  CROSS_FILTER_SCOPING: 'cross_filter_scoping',
  DOWNLOAD_AS_IMAGE: 'download_as_image',
  EXPLORE_CHART: 'explore_chart',
  EXPORT_CSV: 'export_csv',
  EXPORT_FULL_CSV: 'export_full_csv',
  FORCE_REFRESH: 'force_refresh',
  RESIZE_LABEL: 'resize_label',
  TOGGLE_CHART_DESCRIPTION: 'toggle_chart_description',
  VIEW_QUERY: 'view_query',
};

const VerticalDotsContainer = styled.div`
  padding: ${({ theme }) => theme.gridUnit / 4}px
    ${({ theme }) => theme.gridUnit * 1.5}px;

  .dot {
    display: block;
  }

  &:hover {
    cursor: pointer;
  }
`;

const RefreshTooltip = styled.div`
  height: auto;
  margin: ${({ theme }) => theme.gridUnit}px 0;
  color: ${({ theme }) => theme.colors.grayscale.base};
  line-height: ${({ theme }) => theme.typography.sizes.m * 1.5}px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: flex-start;
`;

const SCREENSHOT_NODE_SELECTOR = '.dashboard-component-chart-holder';

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
    form_data?: { emit_filter?: boolean };
  };

  componentId: string;
  dashboardId: number;
  chartStatus: string;
  isCached: boolean[];
  cachedDttm: string[] | null;
  isExpanded?: boolean;
  updatedDttm: number | null;
  isFullSize?: boolean;
  formData: object;
  exploreUrl?: string;

  forceRefresh: (sliceId: number, dashboardId: number) => void;
  logExploreChart?: (sliceId: number) => void;
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
}
interface State {
  showControls: boolean;
  showCrossFilterScopingModal: boolean;
}

class SliceHeaderControls extends React.PureComponent<
  SliceHeaderControlsProps,
  State
> {
  constructor(props: SliceHeaderControlsProps) {
    super(props);
    this.toggleControls = this.toggleControls.bind(this);
    this.refreshChart = this.refreshChart.bind(this);
    this.handleMenuClick = this.handleMenuClick.bind(this);

    this.state = {
      showControls: false,
      showCrossFilterScopingModal: false,
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
    key: React.Key;
    domEvent: React.MouseEvent<HTMLElement>;
  }) {
    switch (key) {
      case MENU_KEYS.FORCE_REFRESH:
        this.refreshChart();
        break;
      case MENU_KEYS.CROSS_FILTER_SCOPING:
        this.setState({ showCrossFilterScopingModal: true });
        break;
      case MENU_KEYS.TOGGLE_CHART_DESCRIPTION:
        // eslint-disable-next-line no-unused-expressions
        this.props.toggleExpandSlice &&
          this.props.toggleExpandSlice(this.props.slice.slice_id);
        break;
      case MENU_KEYS.EXPLORE_CHART:
        // eslint-disable-next-line no-unused-expressions
        this.props.logExploreChart &&
          this.props.logExploreChart(this.props.slice.slice_id);
        break;
      case MENU_KEYS.EXPORT_CSV:
        // eslint-disable-next-line no-unused-expressions
        this.props.exportCSV && this.props.exportCSV(this.props.slice.slice_id);
        break;
      case MENU_KEYS.RESIZE_LABEL:
        this.props.handleToggleFullSize();
        break;
      case MENU_KEYS.EXPORT_FULL_CSV:
        // eslint-disable-next-line no-unused-expressions
        this.props.exportFullCSV &&
          this.props.exportFullCSV(this.props.slice.slice_id);
        break;
      case MENU_KEYS.DOWNLOAD_AS_IMAGE: {
        // menu closes with a delay, we need to hide it manually,
        // so that we don't capture it on the screenshot
        const menu = document.querySelector(
          '.ant-dropdown:not(.ant-dropdown-hidden)',
        ) as HTMLElement;
        menu.style.visibility = 'hidden';
        downloadAsImage(
          SCREENSHOT_NODE_SELECTOR,
          this.props.slice.slice_name,
          // @ts-ignore
        )(domEvent).then(() => {
          menu.style.visibility = 'visible';
        });
        break;
      }
      default:
        break;
    }
  }

  render() {
    const {
      slice,
      isFullSize,
      componentId,
      cachedDttm = [],
      updatedDttm = null,
      addSuccessToast = () => {},
      addDangerToast = () => {},
      supersetCanShare = false,
      isCached = [],
    } = this.props;
    const crossFilterItems = getChartMetadataRegistry().items;
    const isTable = slice.viz_type === 'table';
    const isCrossFilter = Object.entries(crossFilterItems)
      // @ts-ignore
      .filter(([, { value }]) =>
        value.behaviors?.includes(Behavior.INTERACTIVE_CHART),
      )
      .find(([key]) => key === slice.viz_type);
    const canEmitCrossFilter = slice.form_data?.emit_filter;

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
          ? `${t('Query')} ${index + 1}: ${item}`
          : item}
      </div>
    ));
    const resizeLabel = isFullSize ? t('Minimize chart') : t('Maximize chart');
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

        <Menu.Divider />

        {slice.description && (
          <Menu.Item key={MENU_KEYS.TOGGLE_CHART_DESCRIPTION}>
            {t('Toggle chart description')}
          </Menu.Item>
        )}

        {this.props.supersetCanExplore && (
          <Menu.Item key={MENU_KEYS.EXPLORE_CHART}>
            <a href={this.props.exploreUrl} rel="noopener noreferrer">
              {t('View chart in Explore')}
            </a>
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

        {supersetCanShare && (
          <ShareMenuItems
            url={getDashboardUrl({
              pathname: window.location.pathname,
              filters: getActiveFilters(),
              hash: componentId,
            })}
            copyMenuItemTitle={t('Copy chart URL')}
            emailMenuItemTitle={t('Share chart by email')}
            emailSubject={t('Superset chart')}
            emailBody={t('Check out this chart: ')}
            addSuccessToast={addSuccessToast}
            addDangerToast={addDangerToast}
          />
        )}

        <Menu.Item key={MENU_KEYS.RESIZE_LABEL}>{resizeLabel}</Menu.Item>

        <Menu.Item key={MENU_KEYS.DOWNLOAD_AS_IMAGE}>
          {t('Download as image')}
        </Menu.Item>

        {this.props.supersetCanCSV && (
          <Menu.Item key={MENU_KEYS.EXPORT_CSV}>{t('Export CSV')}</Menu.Item>
        )}
        {isFeatureEnabled(FeatureFlag.ALLOW_FULL_CSV_EXPORT) &&
          this.props.supersetCanCSV &&
          isTable && (
            <Menu.Item key={MENU_KEYS.EXPORT_FULL_CSV}>
              {t('Export full CSV')}
            </Menu.Item>
          )}
        {isFeatureEnabled(FeatureFlag.DASHBOARD_CROSS_FILTERS) &&
          isCrossFilter &&
          canEmitCrossFilter && (
            <Menu.Item key={MENU_KEYS.CROSS_FILTER_SCOPING}>
              {t('Cross-filter scoping')}
            </Menu.Item>
          )}
      </Menu>
    );

    return (
      <>
        <CrossFilterScopingModal
          chartId={slice.slice_id}
          isOpen={this.state.showCrossFilterScopingModal}
          onClose={() => this.setState({ showCrossFilterScopingModal: false })}
        />
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
          getPopupContainer={triggerNode =>
            triggerNode.closest(SCREENSHOT_NODE_SELECTOR) as HTMLElement
          }
        >
          <span
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

export default SliceHeaderControls;
