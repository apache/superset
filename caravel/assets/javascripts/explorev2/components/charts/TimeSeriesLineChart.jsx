import React, { PropTypes } from 'react';
import * as V from 'victory';
import theme from '../../../components/VictoryTheme';
import moment from 'moment';
import { schemeCategory20c } from 'd3-scale';

const propTypes = {
  data: PropTypes.array.isRequired,
  sliceObj: PropTypes.object.isRequired,
  label1: PropTypes.string.isRequired,
};

export default class TimeSeriesLineChart extends React.Component {
  renderLines() {
    // todo: when rendering lines, call a function to generate the legend
    return this.props.data.map((d, i) => {
      return (
        <V.VictoryLine
          key={d.key}
          data={d.values}
          interpolation="cardinal"
          style={{ data: { stroke: schemeCategory20c[i] } }}
        />
      );
    });
  }

  render() {
    return (
      <V.VictoryChart theme={theme}>
        {this.renderLines()}
        <V.VictoryAxis
          label={this.props.label1}
          orientation="left"
        />
        <V.VictoryAxis
          dependentAxis
          label={this.props.sliceObj.form_data.granularity_sqla}
          orientation="bottom"
          tickValues={this.props.data[0].values.map((d) => d.x)}
          tickFormat={(x) => moment(new Date(x)).format('YYYY')}
          fixLabelOverlap
        />
      </V.VictoryChart>
    );
  }
}

TimeSeriesLineChart.propTypes = propTypes;
