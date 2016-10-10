import React, { PropTypes } from 'react';
import { connect } from 'react-redux';
import { Panel } from 'react-bootstrap';
import TimeSeriesLineChart from './charts/TimeSeriesLineChart';
import moment from 'moment';

const propTypes = {
  data: PropTypes.array.isRequired,
  sliceName: PropTypes.string.isRequired,
  vizType: PropTypes.string.isRequired,
  height: PropTypes.string.isRequired,
};

class ChartContainer extends React.Component {
  formatDates(values) {
    const newValues = values.map(function (val) {
      return {
        x: moment(new Date(val.x)).format('MMM D'),
        y: val.y,
      };
    });
    return newValues;
  }

  isLineViz() {
    // todo(alanna) generalize this check and map to charts
    return this.props.vizType === 'line';
  }

  render() {
    return (
      <div className="chart-container">
        <Panel
          style={{ height: this.props.height }}
          header={
            <div className="panel-title">{this.props.sliceName}</div>
          }
        >
          {this.isLineViz() &&
            <TimeSeriesLineChart
              data={this.props.data}
              xAxisLabel="xAxisLabel"
              yAxisLabel="yAxisLabel"
            />
          }
        </Panel>
      </div>
    );
  }
}

ChartContainer.propTypes = propTypes;

function mapStateToProps(state) {
  return {
    data: state.viz.data,
    sliceName: state.sliceName,
    vizType: state.viz.formData.vizType,
  };
}

function mapDispatchToProps() {
  return {};
}

export default connect(mapStateToProps, mapDispatchToProps)(ChartContainer);
