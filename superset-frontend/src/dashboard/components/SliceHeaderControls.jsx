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
import PropTypes from 'prop-types';
import moment from 'moment';
import { DropdownButton } from 'react-bootstrap';
import { styled, t } from '@superset-ui/core';
import { Menu } from 'src/common/components';
import URLShortLinkModal from '../../components/URLShortLinkModal';
import downloadAsImage from '../../utils/downloadAsImage';
import getDashboardUrl from '../util/getDashboardUrl';
import { getActiveFilters } from '../util/activeDashboardFilters';

const propTypes = {
  slice: PropTypes.object.isRequired,
  componentId: PropTypes.string.isRequired,
  dashboardId: PropTypes.number.isRequired,
  addDangerToast: PropTypes.func.isRequired,
  isCached: PropTypes.bool,
  isExpanded: PropTypes.bool,
  cachedDttm: PropTypes.string,
  updatedDttm: PropTypes.number,
  supersetCanExplore: PropTypes.bool,
  supersetCanCSV: PropTypes.bool,
  sliceCanEdit: PropTypes.bool,
  toggleExpandSlice: PropTypes.func,
  forceRefresh: PropTypes.func,
  exploreChart: PropTypes.func,
  exportCSV: PropTypes.func,
};

const defaultProps = {
  forceRefresh: () => ({}),
  toggleExpandSlice: () => ({}),
  exploreChart: () => ({}),
  exportCSV: () => ({}),
  cachedDttm: null,
  updatedDttm: null,
  isCached: false,
  isExpanded: false,
  supersetCanExplore: false,
  supersetCanCSV: false,
  sliceCanEdit: false,
};

const MENU_KEYS = {
  FORCE_REFRESH: 'force_refresh',
  TOGGLE_CHART_DESCRIPTION: 'toggle_chart_description',
  EXPLORE_CHART: 'explore_chart',
  EXPORT_CSV: 'export_csv',
  RESIZE_LABEL: 'resize_label',
  SHARE_CHART: 'share_chart',
  DOWNLOAD_AS_IMAGE: 'download_as_image',
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

const VerticalDotsTrigger = () => (
  <VerticalDotsContainer>
    <span className="dot" />
    <span className="dot" />
    <span className="dot" />
  </VerticalDotsContainer>
);

class SliceHeaderControls extends React.PureComponent {
  constructor(props) {
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

  handleMenuClick({ key, domEvent }) {
    switch (key) {
      case MENU_KEYS.FORCE_REFRESH:
        this.refreshChart();
        break;
      case MENU_KEYS.TOGGLE_CHART_DESCRIPTION:
        this.props.toggleExpandSlice(this.props.slice.slice_id);
        break;
      case MENU_KEYS.EXPLORE_CHART:
        this.props.exploreChart(this.props.slice.slice_id);
        break;
      case MENU_KEYS.EXPORT_CSV:
        this.props.exportCSV(this.props.slice.slice_id);
        break;
      case MENU_KEYS.RESIZE_LABEL:
        this.props.handleToggleFullSize();
        break;
      case MENU_KEYS.DOWNLOAD_AS_IMAGE:
        downloadAsImage(
          '.dashboard-component-chart-holder',
          this.props.slice.slice_name,
        )(domEvent);
        break;
      default:
        break;
    }
  }

  render() {
    const {
      slice,
      isCached,
      cachedDttm,
      updatedDttm,
      componentId,
      addDangerToast,
      isFullSize,
    } = this.props;
    const cachedWhen = moment.utc(cachedDttm).fromNow();
    const updatedWhen = updatedDttm ? moment.utc(updatedDttm).fromNow() : '';
    const refreshTooltip = isCached
      ? t('Cached %s', cachedWhen)
      : (updatedWhen && t('Fetched %s', updatedWhen)) || '';
    const resizeLabel = isFullSize ? t('Minimize') : t('Maximize');
    return (
      <DropdownButton
        id={`slice_${slice.slice_id}-controls`}
        pullRight
        noCaret
        title={<VerticalDotsTrigger />}
        style={{ padding: 0 }}
        // react-bootstrap handles visibility, but call toggle to force a re-render
        // and update the fetched/cached timestamps
        onToggle={this.toggleControls}
      >
        <Menu onClick={this.handleMenuClick} selectable={false}>
          <Menu.Item
            key={MENU_KEYS.FORCE_REFRESH}
            disabled={this.props.chartStatus === 'loading'}
            style={{ height: 'auto', lineHeight: 'initial' }}
          >
            {t('Force refresh')}
            <div
              className="refresh-tooltip"
              data-test="dashboard-slice-refresh-tooltip"
            >
              {refreshTooltip}
            </div>
          </Menu.Item>

          <Menu.Divider />

          {slice.description && (
            <Menu.Item key={MENU_KEYS.TOGGLE_CHART_DESCRIPTION}>
              {t('Toggle chart description')}
            </Menu.Item>
          )}

          {this.props.supersetCanExplore && (
            <Menu.Item key={MENU_KEYS.EXPLORE_CHART}>
              {t('Explore chart')}
            </Menu.Item>
          )}

          {this.props.supersetCanCSV && (
            <Menu.Item key={MENU_KEYS.EXPORT_CSV}>{t('Export CSV')}</Menu.Item>
          )}

          <Menu.Item key={MENU_KEYS.RESIZE_LABEL}>{resizeLabel}</Menu.Item>

          <Menu.Item key={MENU_KEYS.SHARE_CHART}>
            <URLShortLinkModal
              url={getDashboardUrl(
                window.location.pathname,
                getActiveFilters(),
                componentId,
              )}
              addDangerToast={addDangerToast}
              title={t('Share chart')}
              triggerNode={<span>{t('Share chart')}</span>}
            />
          </Menu.Item>

          <Menu.Item key={MENU_KEYS.DOWNLOAD_AS_IMAGE}>
            {t('Download as image')}
          </Menu.Item>
        </Menu>
      </DropdownButton>
    );
  }
}

SliceHeaderControls.propTypes = propTypes;
SliceHeaderControls.defaultProps = defaultProps;

export default SliceHeaderControls;
