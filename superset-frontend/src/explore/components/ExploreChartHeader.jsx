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
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import PropTypes from 'prop-types';
import { styled, t } from '@superset-ui/core';

import { chartPropShape } from '../../dashboard/util/propShapes';
import ExploreActionButtons from './ExploreActionButtons';
import RowCountLabel from './RowCountLabel';
import EditableTitle from '../../components/EditableTitle';
import AlteredSliceTag from '../../components/AlteredSliceTag';
import FaveStar from '../../components/FaveStar';
import TooltipWrapper from '../../components/TooltipWrapper';
import Timer from '../../components/Timer';
import CachedLabel from '../../components/CachedLabel';
import PropertiesModal from './PropertiesModal';
import { sliceUpdated } from '../actions/exploreActions';

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
  chartHeight: PropTypes.string.isRequired,
  isStarred: PropTypes.bool.isRequired,
  slice: PropTypes.object,
  sliceName: PropTypes.string,
  table_name: PropTypes.string,
  form_data: PropTypes.object,
  timeout: PropTypes.number,
  chart: chartPropShape,
};

const StyledHeader = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  flex-wrap: wrap;

  span[role='button'] {
    display: flex;
    height: 100%;
  }

  .right-button-panel {
    display: flex;
    flex: 1 1 auto;
    align-items: center;
    justify-content: flex-end;

    > .btn-group {
      flex: 0 0 auto;
      margin-left: ${({ theme }) => theme.gridUnit}px;
    }
  }
`;

const StyledButtons = styled.span`
  display: flex;
  align-items: center;
`;

export class ExploreChartHeader extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      isPropertiesModalOpen: false,
    };
    this.openProperiesModal = this.openProperiesModal.bind(this);
    this.closePropertiesModal = this.closePropertiesModal.bind(this);
  }

  getSliceName() {
    return this.props.sliceName || t('%s - untitled', this.props.table_name);
  }

  postChartFormData() {
    this.props.actions.postChartFormData(
      this.props.form_data,
      true,
      this.props.timeout,
      this.props.chart.id,
    );
  }

  openProperiesModal() {
    this.setState({
      isPropertiesModalOpen: true,
    });
  }

  closePropertiesModal() {
    this.setState({
      isPropertiesModalOpen: false,
    });
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
      <StyledHeader id="slice-header" className="clearfix panel-title-large">
        <EditableTitle
          title={this.getSliceName()}
          canEdit={!this.props.slice || this.props.can_overwrite}
          onSaveTitle={this.props.actions.updateChartTitle}
        />

        {this.props.slice && (
          <StyledButtons>
            <FaveStar
              itemId={this.props.slice.slice_id}
              fetchFaveStar={this.props.actions.fetchFaveStar}
              saveFaveStar={this.props.actions.saveFaveStar}
              isStarred={this.props.isStarred}
              showTooltip
            />
            <PropertiesModal
              show={this.state.isPropertiesModalOpen}
              onHide={this.closePropertiesModal}
              onSave={this.props.sliceUpdated}
              slice={this.props.slice}
            />
            <TooltipWrapper
              label="edit-desc"
              tooltip={t('Edit chart properties')}
            >
              <span
                role="button"
                tabIndex={0}
                className="edit-desc-icon"
                onClick={this.openProperiesModal}
              >
                <i className="fa fa-edit" />
              </span>
            </TooltipWrapper>
          </StyledButtons>
        )}
        {this.props.chart.sliceFormData && (
          <AlteredSliceTag
            className="altered"
            origFormData={this.props.chart.sliceFormData}
            currentFormData={formData}
          />
        )}
        <div className="right-button-panel">
          {chartFinished && queryResponse && (
            <RowCountLabel
              rowcount={Number(queryResponse.rowcount) || 0}
              limit={Number(formData.row_limit) || 0}
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
          />
          <ExploreActionButtons
            actions={this.props.actions}
            slice={this.props.slice}
            canDownload={this.props.can_download}
            chartStatus={chartStatus}
            chartHeight={this.props.chartHeight}
            latestQueryFormData={latestQueryFormData}
            queryResponse={queryResponse}
          />
        </div>
      </StyledHeader>
    );
  }
}

ExploreChartHeader.propTypes = propTypes;

function mapDispatchToProps(dispatch) {
  return bindActionCreators({ sliceUpdated }, dispatch);
}

export default connect(null, mapDispatchToProps)(ExploreChartHeader);
