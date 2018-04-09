import React from 'react';
import PropTypes from 'prop-types';
import cx from 'classnames';
import moment from 'moment';
import { DropdownButton } from 'react-bootstrap';

import { ActionMenuItem } from './ActionMenuItem';
import { t } from '../../locales';

const propTypes = {
  slice: PropTypes.object.isRequired,
  isCached: PropTypes.bool,
  isExpanded: PropTypes.bool,
  cachedDttm: PropTypes.string,
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
};

class SliceHeaderControls extends React.PureComponent {
  constructor(props) {
    super(props);
    this.exportCSV = this.props.exportCSV.bind(this, 'slice_' + this.props.slice.slice_id);
    this.exploreChart = this.props.exploreChart.bind(this, 'slice_' + this.props.slice.slice_id);
    this.forceRefresh = this.props.forceRefresh.bind(this, this.props.slice.slice_id);
    this.toggleExpandSlice = this.props.toggleExpandSlice.bind(this, this.props.slice);
    this.toggleControls = this.toggleControls.bind(this);

    this.state = {
      showControls: false,
    };
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
    const refreshTooltip = isCached ?
      t('Served from data cached %s . Click to force refresh.', cachedWhen) :
      t('Force refresh data');

    return (
      <DropdownButton
        title=""
        id={`slice_${slice.slice_id}-controls`}
        className={cx('slice-header-controls-trigger', 'fa fa-ellipsis-v', { 'is-cached': isCached })}
        pullRight
        noCaret
      >
        <ActionMenuItem
          text={t('Force refresh data')}
          tooltip={refreshTooltip}
          onClick={this.forceRefresh}
        />

        {slice.description &&
          <ActionMenuItem
            text={t('Toggle chart description')}
            tooltip={t('Toggle chart description')}
            onClick={() => { this.toggleExpandSlice(!this.props.isExpanded) }}
          />
        }

        <ActionMenuItem
          text={t('Edit chart')}
          tooltip={t('Edit the chart\'s properties')}
          href={slice.edit_url}
          target="_blank"
        />

        <ActionMenuItem
          text={t('Export CSV')}
          tooltip={t('Export CSV')}
          onClick={this.exportCSV}
        />

        <ActionMenuItem
          text={t('Explore chart')}
          tooltip={t('Explore chart')}
          onClick={this.exploreChart}
        />
      </DropdownButton>
    );
  }
}

SliceHeaderControls.propTypes = propTypes;
SliceHeaderControls.defaultProps = defaultProps;

export default SliceHeaderControls;
