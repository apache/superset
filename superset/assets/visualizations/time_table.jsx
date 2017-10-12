import ReactDOM from 'react-dom';
import React from 'react';
import propTypes from 'prop-types';
import { Table, Thead, Th } from 'reactable';
import d3 from 'd3';
import { Sparkline, LineSeries } from '@data-ui/sparkline';
import Mustache from 'mustache';

import MetricOption from '../javascripts/components/MetricOption';
import TooltipWrapper from '../javascripts/components/TooltipWrapper';
import { d3format, brandColor } from '../javascripts/modules/utils';
import InfoTooltipWithTrigger from '../javascripts/components/InfoTooltipWithTrigger';
import './time_table.css';

const SPARK_MARGIN = 3;
const ACCESSIBLE_COLOR_BOUNDS = ['#ca0020', '#0571b0'];

function FormattedNumber({ num, format }) {
  if (format) {
    return (
      <span title={num}>{d3format(format, num)}</span>
    );
  }
  return <span>{num}</span>;
}
FormattedNumber.propTypes = {
  num: propTypes.number,
  format: propTypes.string,
};

function viz(slice, payload) {
  slice.container.css('overflow', 'auto');
  slice.container.css('height', slice.height());
  const recs = payload.data.records;
  const fd = payload.form_data;
  const data = Object.keys(recs).sort().map((iso) => {
    const o = recs[iso];
    return o;
  });
  const reversedData = data.slice();
  reversedData.reverse();
  const metricMap = {};
  slice.datasource.metrics.forEach((m) => {
    metricMap[m.metric_name] = m;
  });

  let metrics;
  if (payload.data.is_group_by) {
    // Sorting by first column desc
    metrics = payload.data.columns.sort((m1, m2) => (
      reversedData[0][m1] > reversedData[0][m2] ? -1 : 1
    ));
  } else {
    // Using ordering specified in Metrics dropdown
    metrics = payload.data.columns;
  }
  const tableData = metrics.map((metric) => {
    let leftCell;
    const context = Object.assign({}, fd, { metric });
    const url = fd.url ? Mustache.render(fd.url, context) : null;

    if (!payload.data.is_group_by) {
      leftCell = <MetricOption metric={metricMap[metric]} url={url}showFormula={false} />;
    } else {
      leftCell = url ? <a href={url}>{metric}</a> : metric;
    }
    const row = { metric: leftCell };
    fd.column_collection.forEach((c) => {
      if (c.colType === 'spark') {
        let sparkData;
        if (!c.timeRatio) {
          sparkData = data.map(d => d[metric]);
        } else {
          // Period ratio sparkline
          sparkData = [];
          for (let i = c.timeRatio; i < data.length; i++) {
            sparkData.push(data[i][metric] / data[i - c.timeRatio][metric]);
          }
        }
        const extent = d3.extent(sparkData);
        const tooltip = `min: ${d3format(c.d3format, extent[0])}, \
          max: ${d3format(c.d3format, extent[1])}`;
        row[c.key] = (
          <TooltipWrapper label="tt-spark" tooltip={tooltip}>
            <div>
              <Sparkline
                ariaLabel={`spark-${metric}`}
                width={parseInt(c.width, 10) || 300}
                height={parseInt(c.height, 10) || 50}
                margin={{
                  top: SPARK_MARGIN,
                  bottom: SPARK_MARGIN,
                  left: SPARK_MARGIN,
                  right: SPARK_MARGIN,
                }}
                data={sparkData}
              >
                <LineSeries
                  showArea={false}
                  stroke={brandColor}
                />
              </Sparkline>
            </div>
          </TooltipWrapper>);
      } else {
        const recent = reversedData[0][metric];
        let v;
        if (c.colType === 'time') {
          // Time lag ratio
          v = reversedData[parseInt(c.timeLag, 10)][metric];
          if (c.comparisonType === 'diff') {
            v -= recent;
          } else if (c.comparisonType === 'perc') {
            v = recent / v;
          } else if (c.comparisonType === 'perc_change') {
            v = (recent / v) - 1;
          }
        } else if (c.colType === 'contrib') {
          // contribution to column total
          v = recent / Object.keys(reversedData[0])
          .map(k => reversedData[0][k])
          .reduce((a, b) => a + b);
        } else if (c.colType === 'avg') {
          // Average over the last {timeLag}
          v = reversedData
          .map((k, i) => i < c.timeLag ? k[metric] : 0)
          .reduce((a, b) => a + b) / c.timeLag;
        }
        let color;
        if (c.bounds && c.bounds[0] !== null && c.bounds[1] !== null) {
          const scaler = d3.scale.linear()
            .domain([
              c.bounds[0],
              c.bounds[0] + ((c.bounds[1] - c.bounds[0]) / 2),
              c.bounds[1]])
            .range([ACCESSIBLE_COLOR_BOUNDS[0], 'grey', ACCESSIBLE_COLOR_BOUNDS[1]]);
          color = scaler(v);
        } else if (c.bounds && c.bounds[0] !== null) {
          color = v >= c.bounds[0] ? ACCESSIBLE_COLOR_BOUNDS[1] : ACCESSIBLE_COLOR_BOUNDS[0];
        } else if (c.bounds && c.bounds[1] !== null) {
          color = v < c.bounds[1] ? ACCESSIBLE_COLOR_BOUNDS[1] : ACCESSIBLE_COLOR_BOUNDS[0];
        }
        row[c.key] = (
          <span style={{ color }}>
            <FormattedNumber num={v} format={c.d3format} />
          </span>);
      }
    });
    return row;
  });
  ReactDOM.render(
    <Table
      className="table table-condensed"
      data={tableData}
    >
      <Thead>
        <Th column="metric">Metric</Th>
        {fd.column_collection.map((c, i) => (
          <Th column={c.key} key={c.key} width={c.colType === 'spark' ? '1%' : null}>
            {c.label} {c.tooltip && (
              <InfoTooltipWithTrigger
                tooltip={c.tooltip}
                label={`tt-col-${i}`}
                placement="top"
              />
            )}
          </Th>))}
      </Thead>
    </Table>,
    document.getElementById(slice.containerId),
  );
}

module.exports = viz;
