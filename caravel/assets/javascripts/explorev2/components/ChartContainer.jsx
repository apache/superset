import React from 'react';
import { Panel } from 'react-bootstrap';
import sliceJSON from '../stores/sliceJSON';
import TimeSeriesLineChart from './charts/TimeSeriesLineChart';

const chartContainerStyle = {
  // position: 'fixed',
  // width: '73%',
};

export default class ChartContainer extends React.Component {
  constructor(props) {
    super(props);
    const sliceObj = sliceJSON();
    this.state = {
      params: this.getParamsFromUrl(),
      data: sliceObj.data,
      height: 1000,
      label1: 'Label 1',
      sliceObj,
    };
  }

  getParamsFromUrl() {
    const hash = window.location.search;
    const params = hash.split('?')[1].split('&');
    const newParams = {};
    params.forEach((p) => {
      const value = p.split('=')[1].replace(/\+/g, ' ');
      const key = p.split('=')[0];
      newParams[key] = value;
    });
    return newParams;
  }

  formatDates(values) {
    const newValues = values.map((val) => {
      return {
        x: moment(new Date(val.x)).format('MMM D'),
        y: val.y,
      };
    });
    return newValues;
  }

  render() {
    console.log('this.state', this.state)
    return (
      <div className="chart-container" style={chartContainerStyle}>
        <Panel
          style={{ height: this.state.height }}
          header={
            <div className="panel-title">Growth Rate</div>
          }
        >
          <TimeSeriesLineChart
            data={this.state.sliceObj.data}
            sliceObj={this.state.sliceObj}
            label1="Percentage"
          />
        </Panel>
      </div>
    );
  }
}
