import React from 'react';
import { Panel } from 'react-bootstrap';
import * as V from 'victory';
import theme from '../../components/VictoryTheme';
import dataForThreeLines from '../stores/dataForThreeLines';
import moment from 'moment';

const chartContainerStyle = {
  position: 'fixed',
  width: '73%',
};

export default class ChartContainer extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      params: this.getParamsFromUrl(),
      data: dataForThreeLines().data,
      height: window.innerHeight - 100,
    };
    this.getSliceData();
  }

  getSliceData() {
    console.log('this.state', this.state)
    const datasourceType = this.state.params.datasource_type;
    const datasourceId = this.state.params.datasource_id;
    const sliceId = this.state.params.slice_id;
    const url = `/caravel/explore/${datasourceType}/${datasourceId}/${sliceId}/`;
    console.log('url', url)
    fetch(url, {
      credentials: 'same-origin',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      method: 'JSON',
      data: { myNameIs: 'alanna' }
    }).then((response) => {
      console.log('response', response)
    }).then((body) => {
      console.log('body', body)
    });
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
            <div className="panel-title">{this.state.params.slice_name}</div>
          }
        >
          <V.VictoryChart theme={theme}>
            <V.VictoryLine
              data={this.formatDates(this.state.data[0].values)}
            />
            <V.VictoryLine
              data={this.formatDates(this.state.data[1].values)}
            />
            <V.VictoryLine
              data={this.formatDates(this.state.data[2].values)}
            />
            <V.VictoryAxis
              label="label 1"
              orientation="left"
              padding={40}
            />
            <V.VictoryAxis
              dependentAxis
              label="label 2"
              orientation="bottom"
              padding={40}
              fixLabelOverlap
            />
          </V.VictoryChart>
        </Panel>
      </div>
    );
  }
}
