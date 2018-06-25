import React from 'react';
import PropTypes from 'prop-types';
import cx from 'classnames';
import moment from 'moment';
import { Dropdown, MenuItem } from 'react-bootstrap';
import {
  Logger,
  LOG_ACTIONS_EXPLORE_DASHBOARD_CHART,
  LOG_ACTIONS_EXPORT_CSV_DASHBOARD_CHART,
  LOG_ACTIONS_REFRESH_CHART,
} from '../../logger';

import { t } from '../../locales';

const propTypes = {
  slice: PropTypes.object.isRequired,
  isCached: PropTypes.bool,
  isExpanded: PropTypes.bool,
  cachedDttm: PropTypes.string,
  supersetCanExplore: PropTypes.bool,
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
  isCached: false,
  isExpanded: false,
  supersetCanExplore: false,
  sliceCanEdit: false,
};

const VerticalDotsTrigger = () => (
  <div className="vertical-dots-container">
    <span className="dot" />
    <span className="dot" />
    <span className="dot" />
  </div>
);

class SliceHeaderControls extends React.PureComponent {
  constructor(props) {
    super(props);
    this.exportCSV = this.exportCSV.bind(this);
    this.exploreChart = this.exploreChart.bind(this);
    this.toggleControls = this.toggleControls.bind(this);
    this.refreshChart = this.refreshChart.bind(this);
    this.toggleExpandSlice = this.props.toggleExpandSlice.bind(
      this,
      this.props.slice.slice_id,
    );

    this.state = {
      showControls: false,
    };
  }

  exportCSV() {
    this.props.exportCSV(this.props.slice.slice_id);
    Logger.append(
      LOG_ACTIONS_EXPORT_CSV_DASHBOARD_CHART,
      {
        slice_id: this.props.slice.slice_id,
        is_cached: this.props.isCached,
      },
      true,
    );
  }

  exploreChart() {
    this.props.exploreChart(this.props.slice.slice_id);
    Logger.append(
      LOG_ACTIONS_EXPLORE_DASHBOARD_CHART,
      {
        slice_id: this.props.slice.slice_id,
        is_cached: this.props.isCached,
      },
      true,
    );
  }

  refreshChart() {
    this.props.forceRefresh(this.props.slice.slice_id);
    Logger.append(LOG_ACTIONS_REFRESH_CHART, {
      slice_id: this.props.slice.slice_id,
      is_cached: this.props.isCached,
    });
  }

  toggleControls() {
    this.setState({
      showControls: !this.state.showControls,
    });
  }

  render() {
    const slice = this.props.slice;
    const isCached = this.props.isCached;
    const cachedWhen = moment.utc(this.props.cachedDttm).fromNow();
    const refreshTooltip = isCached ? t('Cached %s', cachedWhen) : '';

    // @TODO account for
    //  dashboard.dashboard.superset_can_explore
    //  dashboard.dashboard.slice_can_edit
    return (
      <Dropdown
        id={`slice_${slice.slice_id}-controls`}
        className={cx(isCached && 'is-cached')}
        pullRight
      >
        <Dropdown.Toggle className="slice-header-controls-trigger" noCaret>
          <VerticalDotsTrigger />
        </Dropdown.Toggle>

        <Dropdown.Menu>
          <MenuItem onClick={this.refreshChart}>
            {isCached && <span className="dot" />}
            {t('Force refresh')}
            {isCached && (
              <div className="refresh-tooltip">{refreshTooltip}</div>
            )}
          </MenuItem>

          <MenuItem divider />

          {slice.description && (
            <MenuItem onClick={this.toggleExpandSlice}>
              {t('Toggle chart description')}
            </MenuItem>
          )}

          {this.props.sliceCanEdit && (
            <MenuItem href={slice.edit_url} target="_blank">
              {t('Edit chart metadata')}
            </MenuItem>
          )}

          <MenuItem onClick={this.exportCSV}>{t('Export CSV')}</MenuItem>

          {this.props.supersetCanExplore && (
            <MenuItem onClick={this.exploreChart}>
              {t('Explore chart')}
            </MenuItem>
          )}
        </Dropdown.Menu>
      </Dropdown>
    );
  }
}

SliceHeaderControls.propTypes = propTypes;
SliceHeaderControls.defaultProps = defaultProps;

export default SliceHeaderControls;
