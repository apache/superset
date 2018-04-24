import React from 'react';
import PropTypes from 'prop-types';
import cx from 'classnames';
import moment from 'moment';
import { Dropdown, MenuItem } from 'react-bootstrap';

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
  cachedDttm: null,
  isCached: false,
  isExpanded: false,
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
    this.exportCSV = this.props.exportCSV.bind(this, this.props.slice.slice_id);
    this.exploreChart = this.props.exploreChart.bind(
      this,
      this.props.slice.slice_id,
    );
    this.toggleExpandSlice = this.props.toggleExpandSlice.bind(
      this,
      this.props.slice.slice_id,
    );
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
    const refreshTooltip = isCached ? t('Cached %s', cachedWhen) : '';

    return (
      <Dropdown
        id={`slice_${slice.slice_id}-controls`}
        className={cx(isCached && 'is-cached')}
        pullRight
        noCaret
      >
        <div bsRole="toggle" className="slice-header-controls-trigger">
          <VerticalDotsTrigger />
        </div>

        <Dropdown.Menu>
          <MenuItem onClick={this.props.forceRefresh}>
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

          <MenuItem href={slice.edit_url} target="_blank">
            {t('Edit chart metadata')}
          </MenuItem>

          <MenuItem onClick={this.exportCSV}>{t('Export CSV')}</MenuItem>

          <MenuItem onClick={this.exploreChart}>{t('Explore chart')}</MenuItem>
        </Dropdown.Menu>
      </Dropdown>
    );
  }
}

SliceHeaderControls.propTypes = propTypes;
SliceHeaderControls.defaultProps = defaultProps;

export default SliceHeaderControls;
