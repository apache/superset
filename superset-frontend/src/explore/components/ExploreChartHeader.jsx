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
import { t } from '@superset-ui/translation';

import { chartPropShape } from '../../dashboard/util/propShapes';
import ExploreActionButtons from './ExploreActionButtons';
import RowCountLabel from './RowCountLabel';
import EditableTitle from '../../components/EditableTitle';
import AlteredSliceTag from '../../components/AlteredSliceTag';
import FaveStar from '../../components/FaveStar';
import TooltipWrapper from '../../components/TooltipWrapper';
import Timer from '../../components/Timer';
import CachedLabel from '../../components/CachedLabel';

const CHART_STATUS_MAP = {
  failed: 'danger',
  loading: 'warning',
  success: 'success',
};

const propTypes = {
  actions: PropTypes.object.isRequired,
  addHistory: PropTypes.func,
  can_overwrite: PropTypes.bool.isRequired,
  can_download: PropTypes.bool.isRequired,
  isStarred: PropTypes.bool.isRequired,
  slice: PropTypes.object,
  table_name: PropTypes.string,
  form_data: PropTypes.object,
  timeout: PropTypes.number,
  chart: chartPropShape,
};

class ExploreChartHeader extends React.PureComponent {
  postChartFormData() {
    this.props.actions.postChartFormData(
      this.props.form_data,
      true,
      this.props.timeout,
      this.props.chart.id,
    );
  }

  updateChartTitleOrSaveSlice(newTitle) {
    const isNewSlice = !this.props.slice;
    const currentFormData = isNewSlice
      ? this.props.form_data
      : this.props.slice.form_data;

    const params = {
      slice_name: newTitle,
      action: isNewSlice ? 'saveas' : 'overwrite',
    };
    // this.props.slice hold the original slice params stored in slices table
    // when chart is saved or overwritten, the explore view will reload page
    // to make sure sync with updated query params
    this.props.actions.saveSlice(currentFormData, params).then(json => {
      const { data } = json;
      if (isNewSlice) {
        this.props.actions.updateChartId(data.slice.slice_id, 0);
        this.props.actions.createNewSlice(
          data.can_add,
          data.can_download,
          data.can_overwrite,
          data.slice,
          data.form_data,
        );
        this.props.addHistory({
          isReplace: true,
          title: `[chart] ${data.slice.slice_name}`,
        });
      } else {
        this.props.actions.updateChartTitle(newTitle);
      }
    });
  }

  renderChartTitle() {
    let title;
    if (this.props.slice) {
      title = this.props.slice.slice_name;
    } else {
      title = t('%s - untitled', this.props.table_name);
    }
    return title;
  }

  render() {
    const formData = this.props.form_data;
    const {
      chartStatus,
      chartUpdateEndTime,
      chartUpdateStartTime,
      latestQueryFormData,
      queryResponse,
    } = this.props.chart;
    const chartFinished = ['failed', 'rendered', 'success'].includes(
      this.props.chart.chartStatus,
    );
    return (
      <div id="slice-header" className="clearfix panel-title-large">
        <EditableTitle
          title={this.renderChartTitle()}
          canEdit={!this.props.slice || this.props.can_overwrite}
          onSaveTitle={this.updateChartTitleOrSaveSlice.bind(this)}
        />

        {this.props.slice && (
          <span>
            <FaveStar
              itemId={this.props.slice.slice_id}
              fetchFaveStar={this.props.actions.fetchFaveStar}
              saveFaveStar={this.props.actions.saveFaveStar}
              isStarred={this.props.isStarred}
            />

            <TooltipWrapper
              label="edit-desc"
              tooltip={t('Edit chart properties')}
            >
              <a
                className="edit-desc-icon"
                href={`/chart/edit/${this.props.slice.slice_id}`}
              >
                <i className="fa fa-edit" />
              </a>
            </TooltipWrapper>
          </span>
        )}
        {this.props.chart.sliceFormData && (
          <AlteredSliceTag
            origFormData={this.props.chart.sliceFormData}
            currentFormData={formData}
          />
        )}
        <div className="pull-right">
          {chartFinished && queryResponse && (
            <RowCountLabel
              rowcount={queryResponse.rowcount}
              limit={formData.row_limit}
            />
          )}
          {chartFinished && queryResponse && queryResponse.is_cached && (
            <CachedLabel
              onClick={this.postChartFormData.bind(this)}
              cachedTimestamp={queryResponse.cached_dttm}
            />
          )}
          <Timer
            startTime={chartUpdateStartTime}
            endTime={chartUpdateEndTime}
            isRunning={chartStatus === 'loading'}
            status={CHART_STATUS_MAP[chartStatus]}
            style={{ fontSize: '10px', marginRight: '5px' }}
          />
          <ExploreActionButtons
            actions={this.props.actions}
            slice={this.props.slice}
            canDownload={this.props.can_download}
            chartStatus={chartStatus}
            latestQueryFormData={latestQueryFormData}
            queryResponse={queryResponse}
          />
        </div>
      </div>
    );
  }
}

ExploreChartHeader.propTypes = propTypes;

export default ExploreChartHeader;
