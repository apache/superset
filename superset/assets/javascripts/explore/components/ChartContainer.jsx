import $ from 'jquery';
import React from 'react';
import PropTypes from 'prop-types';
import Mustache from 'mustache';
import { connect } from 'react-redux';
import { Alert, Collapse, Panel } from 'react-bootstrap';
import visMap from '../../../visualizations/main';
import { d3format } from '../../modules/utils';
import ExploreActionButtons from './ExploreActionButtons';
import EditableTitle from '../../components/EditableTitle';
import FaveStar from '../../components/FaveStar';
import TooltipWrapper from '../../components/TooltipWrapper';
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

  getMockedSliceObject() {
    const props = this.props;
    const getHeight = () => {
      const headerHeight = props.standalone ? 0 : 100;
      return parseInt(props.height, 10) - headerHeight;
    };
    return {
      viewSqlQuery: props.queryResponse.query,
      containerId: props.containerId,
      datasource: props.datasource,
      selector: this.state.selector,
      formData: props.formData,
      container: {
        html: (data) => {
          // this should be a callback to clear the contents of the slice container
          $(this.state.selector).html(data);
        },
        css: (property, value) => {
          $(this.state.selector).css(property, value);
        },
        height: getHeight,
        show: () => { },
        get: n => ($(this.state.selector).get(n)),
        find: classname => ($(this.state.selector).find(classname)),
      },

      width: () => this.chartContainerRef.getBoundingClientRect().width,

      height: getHeight,

      render_template: (s) => {
        const context = {
          width: this.width,
          height: this.height,
        };
        return Mustache.render(s, context);
      },

      setFilter: () => {},

      getFilters: () => (
        // return filter objects from viz.formData
        {}
      ),

      addFilter: () => {},

      removeFilter: () => {},

      done: () => {},
      clearError: () => {
        // no need to do anything here since Alert is closable
        // query button will also remove Alert
      },
      error() {},

      d3format: (col, number) => {
        // mock d3format function in Slice object in superset.js
        const format = props.column_formats[col];
        return d3format(format, number);
      },

      data: {
        csv_endpoint: getExploreUrl(props.formData, 'csv'),
        json_endpoint: getExploreUrl(props.formData, 'json'),
        standalone_endpoint: getExploreUrl(props.formData, 'standalone'),
      },

    };
  }

  removeAlert() {
    this.props.actions.removeChartAlert();
  }

  runQuery() {
    this.props.actions.runQuery(this.props.formData, true, this.props.timeout);
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

  renderChartTitle() {
    let title;
    if (this.props.slice) {
      title = this.props.slice.slice_name;
    } else {
      title = t('%s - untitled', this.props.table_name);
    }
    return title;
  }

  renderViz() {
    this.props.actions.renderTriggered();
    const mockSlice = this.getMockedSliceObject();
    this.setState({ mockSlice });
    const viz = visMap[this.props.viz_type];
    try {
      viz(mockSlice, this.props.queryResponse, this.props.actions.setControlValue);
    } catch (e) {
      this.props.actions.chartRenderingFailed(e);
    }
  }

  renderAlert() {
    /* eslint-disable react/no-danger */
    const msg = (
      <div>
        <i
          className="fa fa-close pull-right"
          onClick={this.removeAlert.bind(this)}
          style={{ cursor: 'pointer' }}
        />
        <p
          dangerouslySetInnerHTML={{ __html: this.props.alert }}
        />
      </div>);
    return (
      <div>
        <Alert
          bsStyle="warning"
          onClick={() => this.setState({ showStackTrace: !this.state.showStackTrace })}
        >
          {msg}
        </Alert>
        {this.props.queryResponse && this.props.queryResponse.stacktrace &&
          <Collapse in={this.state.showStackTrace}>
            <pre>
              {this.props.queryResponse.stacktrace}
            </pre>
          </Collapse>
        }
      </div>);
  }

  renderChart() {
    if (this.props.alert) {
      return this.renderAlert();
    }
    const loading = this.props.chartStatus === 'loading';
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
        <div
          id={this.props.containerId}
          ref={(ref) => { this.chartContainerRef = ref; }}
          className={this.props.viz_type}
          style={{
            opacity: loading ? '0.25' : '1',
          }}
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
                    sliceId={this.props.slice.slice_id}
                    actions={this.props.actions}
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
                  slice={this.state.mockSlice}
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
