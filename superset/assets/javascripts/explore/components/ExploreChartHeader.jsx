import React from 'react';
import PropTypes from 'prop-types';

import { chartPropType } from '../../chart/chartReducer';
import ExploreActionButtons from './ExploreActionButtons';
import EditableTitle from '../../components/EditableTitle';
import AlteredSliceTag from '../../components/AlteredSliceTag';
import FaveStar from '../../components/FaveStar';
import TooltipWrapper from '../../components/TooltipWrapper';
import Timer from '../../components/Timer';
import { getExploreUrl } from '../exploreUtils';
import CachedLabel from '../../components/CachedLabel';
import { t } from '../../locales';

const CHART_STATUS_MAP = {
  failed: 'danger',
  loading: 'warning',
  success: 'success',
};

const propTypes = {
  actions: PropTypes.object.isRequired,
  can_overwrite: PropTypes.bool.isRequired,
  can_download: PropTypes.bool.isRequired,
  isStarred: PropTypes.bool.isRequired,
  slice: PropTypes.object,
  table_name: PropTypes.string,
  form_data: PropTypes.object,
  timeout: PropTypes.number,
  chart: PropTypes.shape(chartPropType),
};

class ExploreChartHeader extends React.PureComponent {
  runQuery() {
    this.props.actions.runQuery(this.props.form_data, true,
      this.props.timeout, this.props.chart.chartKey);
  }

  updateChartTitleOrSaveSlice(newTitle) {
    const isNewSlice = !this.props.slice;
    const params = {
      slice_name: newTitle,
      action: isNewSlice ? 'saveas' : 'overwrite',
    };
    const saveUrl = getExploreUrl(this.props.form_data, 'base', false, null, params);
    this.props.actions.saveSlice(saveUrl)
      .then((data) => {
        if (isNewSlice) {
          this.props.actions.createNewSlice(
            data.can_add, data.can_download, data.can_overwrite,
            data.slice, data.form_data);
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
    const queryResponse = this.props.chart.queryResponse;
    const data = {
      csv_endpoint: getExploreUrl(this.props.form_data, 'csv'),
      json_endpoint: getExploreUrl(this.props.form_data, 'json'),
      standalone_endpoint: getExploreUrl(this.props.form_data, 'standalone'),
    };

    return (
      <div
        id="slice-header"
        className="clearfix panel-title-large"
      >
        <EditableTitle
          title={this.renderChartTitle()}
          canEdit={!this.props.slice || this.props.can_overwrite}
          onSaveTitle={this.updateChartTitleOrSaveSlice.bind(this)}
        />

        {this.props.slice &&
        <span>
          <FaveStar
            itemId={this.props.slice.slice_id}
            fetchFaveStar={this.props.actions.fetchFaveStar}
            saveFaveStar={this.props.actions.saveFaveStar}
            isStarred={this.props.isStarred}
          />

          <TooltipWrapper
            label="edit-desc"
            tooltip={t('Edit slice properties')}
          >
            <a
              className="edit-desc-icon"
              href={`/slicemodelview/edit/${this.props.slice.slice_id}`}
            >
              <i className="fa fa-edit" />
            </a>
          </TooltipWrapper>
        </span>
        }
        {this.props.chart.sliceFormData &&
          <AlteredSliceTag
            origFormData={this.props.chart.sliceFormData}
            currentFormData={this.props.form_data}
          />
        }
        <div className="pull-right">
          {this.props.chart.chartStatus === 'success' &&
          queryResponse &&
          queryResponse.is_cached &&
          <CachedLabel
            onClick={this.runQuery.bind(this)}
            cachedTimestamp={queryResponse.cached_dttm}
          />
          }
          <Timer
            startTime={this.props.chart.chartUpdateStartTime}
            endTime={this.props.chart.chartUpdateEndTime}
            isRunning={this.props.chart.chartStatus === 'loading'}
            status={CHART_STATUS_MAP[this.props.chart.chartStatus]}
            style={{ fontSize: '10px', marginRight: '5px' }}
          />
          <ExploreActionButtons
            slice={Object.assign({}, this.props.slice, { data })}
            canDownload={this.props.can_download}
            chartStatus={this.props.chart.chartStatus}
            queryResponse={queryResponse}
            queryEndpoint={getExploreUrl(this.props.form_data, 'query')}
          />
        </div>
      </div>
    );
  }
}

ExploreChartHeader.propTypes = propTypes;

export default ExploreChartHeader;
