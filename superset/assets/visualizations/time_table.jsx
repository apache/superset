import ReactDOM from 'react-dom';
import React from 'react';
import { Table, Thead, Th } from 'reactable';
import d3 from 'd3';
import { Sparkline, LineSeries, PointSeries } from '@data-ui/sparkline';

import MetricOption from '../javascripts/components/MetricOption';
import { d3format, brandColor } from '../javascripts/modules/utils';
import InfoTooltipWithTrigger from '../javascripts/components/InfoTooltipWithTrigger';
import './time_table.css';

const SPARK_MARGIN = 3;

function viz(slice, payload) {
  const metrics = payload.data.columns;
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
  const tableData = metrics.map((metric) => {
    let leftCell;
    if (!payload.data.is_group_by) {
      leftCell = <MetricOption metric={metricMap[metric]} showFormula={false} />;
    } else {
      leftCell = metric;
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
        row[c.label] = (
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
            <PointSeries
              points={['min', 'max', 'last']}
              fill={brandColor}
            />
          </Sparkline>);
      } else {
        const recent = reversedData[0][metric];
        let v;
        if (c.colType === 'time') {
          // Time lag ratio
          v = reversedData[parseInt(c.timeLag, 10)][metric];
          if (c.comparisonType === 'diff') {
            v -= recent;
          } else if (c.comparisonType === 'perc') {
            v /= recent;
          } else if (c.comparisonType === 'perc_change') {
            v = (v / recent) - 1;
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
            .range(['red', 'orange', 'green']);
          color = scaler(v);
        }
        row[c.label] = (
          <span style={{ color }}>
            {c.d3format ? d3format(c.d3format, v) : v}
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
          <Th column={c.label} key={c.key} width={c.colType === 'spark' ? '1%' : null}>
            {c.label} {c.tooltip && (
              <InfoTooltipWithTrigger
                tooltip={c.tooltip}
                label={`tt-col-${i}`}
                placement="top"
              />
            )}
          </Th>))}
      </Thead>
    </Table>
    ,
    document.getElementById(slice.containerId),
  );
}

module.exports = viz;
