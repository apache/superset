import React, { PropTypes } from 'react';
import * as V from 'victory';
import theme from '../../../components/VictoryTheme';
import moment from 'moment';
import { schemeCategory20c } from 'd3-scale';
import Legend from './Legend';

const propTypes = {
  data: PropTypes.array.isRequired,
  xAxisLabel: PropTypes.string.isRequired,
  yAxisLabel: PropTypes.string.isRequired,
};

export default class TimeSeriesLineChart extends React.Component {
  constructor(props) {
    super(props);
    this.keysToColorsMap = this.mapKeysToColors(props.data);
  }

  mapKeysToColors(data) {
    // todo: what if there are more lines than colors in schemeCategory20c?
    const keysToColorsMap = {};
    data.forEach((d, i) => {
      keysToColorsMap[d.key] = schemeCategory20c[i];
    });
    return keysToColorsMap;
  }

  renderLines() {
    return this.props.data.map((d) => (
      <V.VictoryLine
        key={d.key}
        data={d.values}
        interpolation="cardinal"
        style={{ data: { stroke: this.keysToColorsMap[d.key] } }}
      />
    ));
  }

  render() {
    return (
      <div style={{ height: '80%', width: '100%' }}>
        <V.VictoryChart
          theme={theme}
        >
          {this.renderLines()}
          <V.VictoryAxis
            label={this.props.yAxisLabel}
            orientation="left"
          />
          <V.VictoryAxis
            dependentAxis
            label={this.props.xAxisLabel}
            orientation="bottom"
            tickValues={this.props.data[0].values.map((d) => d.x)}
            tickFormat={(x) => moment(new Date(x)).format('YYYY')}
            fixLabelOverlap
          />
        </V.VictoryChart>
        <Legend
          data={this.props.data}
          keysToColorsMap={this.keysToColorsMap}
        />
      </div>
    );
  }
}

TimeSeriesLineChart.propTypes = propTypes;
