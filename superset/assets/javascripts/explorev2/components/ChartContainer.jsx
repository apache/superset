import React, { PropTypes } from 'react';
import { connect } from 'react-redux';
import { Panel } from 'react-bootstrap';
import { getFormDataFromControls } from '../stores/store';
import Chart from './Chart';
import ChartHeader from './ChartHeader';

const propTypes = {
  actions: PropTypes.object.isRequired,
  alert: PropTypes.string,
  can_download: PropTypes.bool.isRequired,
  chartStatus: PropTypes.string,
  chartUpdateEndTime: PropTypes.number,
  chartUpdateStartTime: PropTypes.number.isRequired,
  datasource: PropTypes.object,
  height: PropTypes.string.isRequired,
  isStarred: PropTypes.bool.isRequired,
  slice: PropTypes.object,
  table_name: PropTypes.string,
  formData: PropTypes.object,
  latestQueryFormData: PropTypes.object,
};

class ChartContainer extends React.PureComponent {
  render() {
    if (this.props.standalone) {
      return this.renderChart();
    }
    const queryResponse = this.props.queryResponse;
    const query = queryResponse && queryResponse.query ? queryResponse.query : null;
    return (
      <div className="chart-container">
        <Panel
          style={{ height: this.props.height }}
          header={<ChartHeader />}
        >
        {this.props.datasource &&
          <Chart
            actions={this.props.actions}
            alert={this.props.alert}
            chartStatus={this.props.chartStatus}
            datasource={this.props.datasource}
            height={this.props.height}
            formData={this.props.formData}
            queryResponse={this.props.queryResponse}
            triggerRender={this.props.triggerRender}
          />
        }
        </Panel>
      </div>
    );
  }
}

ChartContainer.propTypes = propTypes;

function mapStateToProps(state) {
  const formData = getFormDataFromControls(state.controls);
  return {
    alert: state.chartAlert,
    can_download: state.can_download,
    chartStatus: state.chartStatus,
    chartUpdateEndTime: state.chartUpdateEndTime,
    chartUpdateStartTime: state.chartUpdateStartTime,
    datasource: state.datasource,
    formData,
    latestQueryFormData: state.latestQueryFormData,
    isStarred: state.isStarred,
    queryResponse: state.queryResponse,
    slice: state.slice,
    standalone: state.standalone,
    table_name: formData.datasource_name,
    triggerRender: state.triggerRender,
    datasourceType: state.datasource ? state.datasource.type : null,
  };
}

export default connect(mapStateToProps, () => ({}))(ChartContainer);
