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
import { Dropdown, MenuItem } from 'react-bootstrap';
import { t } from '@superset-ui/translation';
import URLShortLinkModal from '../../components/URLShortLinkModal';
import getDashboardUrl from '../util/getDashboardUrl';

const propTypes = {
  slice: PropTypes.object.isRequired,
  componentId: PropTypes.string.isRequired,
  filters: PropTypes.object.isRequired,
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
  }

  exploreChart() {
    this.props.exploreChart(this.props.slice.slice_id);
  }

  refreshChart() {
    if (this.props.updatedDttm) {
      this.props.forceRefresh(this.props.slice.slice_id);
    }
  }

  toggleControls() {
    this.setState({
      showControls: !this.state.showControls,
    });
  }

  render() {
    const {
      slice,
      isCached,
      cachedDttm,
      updatedDttm,
      filters,
      componentId,
      addDangerToast,
    } = this.props;
    const cachedWhen = moment.utc(cachedDttm).fromNow();
    const updatedWhen = updatedDttm ? moment.utc(updatedDttm).fromNow() : '';
    const refreshTooltip = isCached
      ? t('Cached %s', cachedWhen)
      : (updatedWhen && t('Fetched %s', updatedWhen)) || '';

    return (
      <Dropdown
        id={`slice_${slice.slice_id}-controls`}
        pullRight
        // react-bootstrap handles visibility, but call toggle to force a re-render
        // and update the fetched/cached timestamps
        onToggle={this.toggleControls}
      >
        <Dropdown.Toggle className="slice-header-controls-trigger" noCaret>
          <VerticalDotsTrigger />
        </Dropdown.Toggle>

        <Dropdown.Menu>
          <MenuItem onClick={this.refreshChart} disabled={!updatedDttm}>
            {t('Force refresh')}
            <div className="refresh-tooltip">{refreshTooltip}</div>
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

          {this.props.supersetCanCSV && (
            <MenuItem onClick={this.exportCSV}>{t('Export CSV')}</MenuItem>
          )}

          {this.props.supersetCanExplore && (
            <MenuItem onClick={this.exploreChart}>
              {t('Explore chart')}
            </MenuItem>
          )}

          <URLShortLinkModal
            url={getDashboardUrl(
              window.location.pathname,
              filters,
              componentId,
            )}
            addDangerToast={addDangerToast}
            isMenuItem
            title={t('Share chart')}
            triggerNode={<span>{t('Share chart')}</span>}
          />
        </Dropdown.Menu>
      </Dropdown>
    );
  }
}

SliceHeaderControls.propTypes = propTypes;
SliceHeaderControls.defaultProps = defaultProps;

export default SliceHeaderControls;
