import React from 'react';
import { Panel } from 'react-bootstrap';
import * as V from 'victory';
import theme from '../../components/VictoryTheme';
import moment from 'moment';
import sliceJSON from '../stores/sliceJSON';

const chartContainerStyle = {
  // position: 'fixed',
  // width: '73%',
};

export default class ChartContainer extends React.Component {
  constructor(props) {
    super(props);
    const sliceObj = sliceJSON();
    console.log('sliceObj', sliceObj)
    this.state = {
      params: this.getParamsFromUrl(),
      data: sliceObj.data,
      height: 1000,
      lineData: sliceObj.data[0],
      label1: 'Label 1',
      sliceObj
    };
    this.getSliceData();
  }

  getSliceData() {
    // const datasourceType = this.state.params.datasource_type;
    // const datasourceId = this.state.params.datasource_id;
    // const sliceId = this.state.params.slice_id;
    // const url = `/caravel/explore/${datasourceType}/${datasourceId}/${sliceId}/?format=json`;
    const url ='/caravel/explore/table/2/?slice_name=Growth+Rate&row_limit=50000&metric=sum__SP_POP_TOTL&show_bubbles=y&entity=country_code&secondary_metric=sum__SP_POP_TOTL&viz_type=line&since=1960-01-01&json=true&until=2014-01-01&datasource_id=1&format=json&metrics=sum__SP_POP_TOTL&datasource_name=birth_names&country_fieldtype=cca3&granularity=year&slice_id=7&num_period_compare=10&datasource_type=table&compare_lag=10&limit=25&markup_type=markdown&compare_suffix=o10Y&where=&groupby=country_name';
    fetch(url, {
      credentials: 'same-origin',
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

  changeData() {
    const lineIndex = Math.floor(Math.random() * this.state.data.length);
    this.setState({ lineData: this.state.data[lineIndex] });
  }

  handleLabelChange(e) {
    this.setState({ label1: e.currentTarget.value })
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
          <V.VictoryChart theme={theme}>
            <V.VictoryLine
              data={this.state.lineData.values}
            />
            <V.VictoryAxis
              label={this.state.label1}
              orientation="left"
              padding={40}
            />
            <V.VictoryAxis
              dependentAxis
              label={this.state.lineData.key}
              orientation="bottom"
              padding={40}
              fixLabelOverlap
            />
          </V.VictoryChart>
          <button className="btn btn-primary" onClick={this.changeData.bind(this)}>
            Update Line Data
          </button>
          <br/><br/>
          <div>
            <label>Update Label 1
              <input type="text" name="label-1" onChange={this.handleLabelChange.bind(this)} />
            </label>
          </div>
        </Panel>
      </div>
    );
  }
}
