/* eslint camelcase: 0 */
import $ from 'jquery';
import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';

import { Panel } from 'react-bootstrap';
import visMap from '../../../visualizations/main';
import Slice from '../../dashboard/components/Slice';
import ExploreActionButtons from './ExploreActionButtons';
import EditableTitle from '../../components/EditableTitle';
import FaveStar from '../../components/FaveStar';
import TooltipWrapper from '../../components/TooltipWrapper';
import StackTraceMessage from '../../components/StackTraceMessage';
import Timer from '../../components/Timer';
import { getExploreUrl } from '../exploreUtils';
import { getFormDataFromControls } from '../stores/store';
import CachedLabel from '../../components/CachedLabel';
import { t } from '../../locales';

const CHART_STATUS_MAP = {
  failed: 'danger',
  loading: 'warning',
  success: 'success',
};

const propTypes = {
  actions: PropTypes.object.isRequired,
  alert: PropTypes.string,
  can_overwrite: PropTypes.bool.isRequired,
  can_download: PropTypes.bool.isRequired,
  datasource: PropTypes.object,
  chartStatus: PropTypes.string,
  chartUpdateEndTime: PropTypes.number,
  chartUpdateStartTime: PropTypes.number.isRequired,
  column_formats: PropTypes.object,
  containerId: PropTypes.string.isRequired,
  height: PropTypes.string.isRequired,
  width: PropTypes.string.isRequired,
  isStarred: PropTypes.bool.isRequired,
  slice: PropTypes.object,
  table_name: PropTypes.string,
  viz_type: PropTypes.string.isRequired,
  formData: PropTypes.object,
  latestQueryFormData: PropTypes.object,
  queryResponse: PropTypes.object,
  triggerRender: PropTypes.bool,
  standalone: PropTypes.bool,
  datasourceType: PropTypes.string,
  datasourceId: PropTypes.number,
  timeout: PropTypes.number,
};

class ChartContainer extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      selector: `#${props.containerId}`,
      showStackTrace: false,
    };
  }

  componentDidUpdate(prevProps) {
    if (
        this.props.queryResponse &&
        (
          prevProps.queryResponse !== this.props.queryResponse ||
          prevProps.height !== this.props.height ||
          prevProps.width !== this.props.width ||
          this.props.triggerRender
        ) && !this.props.queryResponse.error
        && this.props.chartStatus !== 'failed'
        && this.props.chartStatus !== 'stopped'
        && this.props.chartStatus !== 'loading'
      ) {
      this.renderViz();
    }
  }

  // start sub-component callbacks
  getHeight() {
    const headerHeight = this.props.standalone ? 0 : 100;
    return parseInt(this.props.height, 10) - headerHeight;
  }

  updateChartTitleOrSaveSlice(newTitle) {
    const isNewSlice = !this.props.slice;
    const params = {
      slice_name: newTitle,
      action: isNewSlice ? 'saveas' : 'overwrite',
    };
    const saveUrl = getExploreUrl(this.props.formData, 'base', false, null, params);
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

  removeAlert() {
    this.props.actions.removeChartAlert();
  }

  runQuery() {
    this.props.actions.runQuery(this.props.formData, true, this.props.timeout);
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
  // end slice callbacks

  renderViz() {
    this.props.actions.renderTriggered();

    const viz = visMap[this.props.viz_type];
    try {
      viz(this.sliceEl, this.props.queryResponse, this.props.actions.setControlValue);
    } catch (e) {
      this.props.actions.chartRenderingFailed(e);
    }
  }

  renderChart() {
    if (this.props.alert) {
      return (
        <StackTraceMessage
          message={this.props.alert}
          queryResponse={this.props.queryResponse}
          removeAlert={this.removeAlert.bind(this)}
        />
      );
    }

    const loading = this.props.chartStatus === 'loading';
    const containerId = this.props.slice ?
      `slice-container-${this.props.slice.slice_id}` :
      'slice-container';
    return (
      <div>
        {loading &&
          <img
            alt="loading"
            width="25"
            src="/static/assets/images/loading.gif"
            style={{ position: 'absolute' }}
          />
        }
        <Slice
          containerId={containerId}
          datasource={this.props.datasource}
          formData={this.props.formData}
          height={this.getHeight.bind(this)}
          ref={(sliceEl) => { this.sliceEl = sliceEl; }}
        />
      </div>
    );
  }

  render() {
    if (this.props.standalone) {
      // dom manipulation hack to get rid of the boostrap theme's body background
      $('body').addClass('background-transparent');
      return this.renderChart();
    }
    const queryResponse = this.props.queryResponse;
    const data = {
      csv_endpoint: getExploreUrl(this.props.formData, 'csv'),
      json_endpoint: getExploreUrl(this.props.formData, 'json'),
      standalone_endpoint: getExploreUrl(this.props.formData, 'standalone'),
    };
    return (
      <div className="chart-container">
        <Panel
          style={{ height: this.props.height }}
          header={
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

              <div className="pull-right">
                {this.props.chartStatus === 'success' &&
                this.props.queryResponse &&
                this.props.queryResponse.is_cached &&
                  <CachedLabel
                    onClick={this.runQuery.bind(this)}
                    cachedTimestamp={queryResponse.cached_dttm}
                  />
                }
                <Timer
                  startTime={this.props.chartUpdateStartTime}
                  endTime={this.props.chartUpdateEndTime}
                  isRunning={this.props.chartStatus === 'loading'}
                  status={CHART_STATUS_MAP[this.props.chartStatus]}
                  style={{ fontSize: '10px', marginRight: '5px' }}
                />
                <ExploreActionButtons
                  slice={Object.assign({}, this.props.slice, { data })}
                  canDownload={this.props.can_download}
                  chartStatus={this.props.chartStatus}
                  queryResponse={queryResponse}
                  queryEndpoint={getExploreUrl(this.props.latestQueryFormData, 'query')}
                />
              </div>
            </div>
          }
        >
          {this.renderChart()}
        </Panel>
      </div>
    );
  }
}

ChartContainer.propTypes = propTypes;

function mapStateToProps({ explore, chart }) {
  const formData = getFormDataFromControls(explore.controls);
  return {
    alert: chart.chartAlert,
    can_overwrite: !!explore.can_overwrite,
    can_download: !!explore.can_download,
    datasource: explore.datasource,
    column_formats: explore.datasource ? explore.datasource.column_formats : null,
    containerId: explore.slice ? `slice-container-${explore.slice.slice_id}` : 'slice-container',
    formData,
    isStarred: explore.isStarred,
    slice: explore.slice,
    standalone: explore.standalone,
    table_name: formData.datasource_name,
    viz_type: formData.viz_type,
    triggerRender: explore.triggerRender,
    datasourceType: explore.datasource.type,
    datasourceId: explore.datasource_id,
    chartStatus: chart.chartStatus,
    chartUpdateEndTime: chart.chartUpdateEndTime,
    chartUpdateStartTime: chart.chartUpdateStartTime,
    latestQueryFormData: chart.latestQueryFormData,
    queryResponse: chart.queryResponse,
    timeout: explore.common.conf.SUPERSET_WEBSERVER_TIMEOUT,
  };
}

export default connect(mapStateToProps, () => ({}))(ChartContainer);
