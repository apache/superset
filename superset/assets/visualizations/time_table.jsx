import ReactDOM from 'react-dom';
import React from 'react';
import propTypes from 'prop-types';
import { Table, Thead, Th, Tr, Td } from 'reactable';
import d3 from 'd3';
import Mustache from 'mustache';
import { Sparkline, LineSeries, PointSeries, VerticalReferenceLine, WithTooltip } from '@data-ui/sparkline';

import MetricOption from '../javascripts/components/MetricOption';
import { d3format } from '../javascripts/modules/utils';
import { formatDateThunk } from '../javascripts/modules/dates';
import InfoTooltipWithTrigger from '../javascripts/components/InfoTooltipWithTrigger';
import './time_table.css';

const SPARKLINE_MARGIN = {
  top: 8,
  right: 8,
  bottom: 8,
  left: 8,
};
const sparklineTooltipProps = {
  style: {
    opacity: 0.8,
  },
  offsetTop: 0,
};

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
  slice.container.css('height', slice.height());
  const records = payload.data.records;
  const fd = payload.form_data;
  const data = Object.keys(records).sort().map(iso => ({ ...records[iso], iso }));
  const reversedData = [...data].reverse();
  const metricMap = {};
  slice.datasource.metrics.forEach((m) => {
    metricMap[m.metric_name] = m;
  });

  let metrics;
  let defaultSort = false;
  if (payload.data.is_group_by) {
    metrics = payload.data.columns;
    defaultSort = { column: fd.column_collection[0].key, direction: 'desc' };
  } else {
    metrics = fd.metrics;
  }
  const tableData = metrics.map((metric) => {
    let leftCell;
    const context = { ...fd, metric };
    const url = fd.url ? Mustache.render(fd.url, context) : null;
    if (!payload.data.is_group_by) {
      leftCell = (
        <MetricOption metric={metricMap[metric]} url={url} showFormula={false} openInNewWindow />
      );
    } else {
      leftCell = url ? <a href={url} target="_blank">{metric}</a> : metric;
    }
    const row = { metric: leftCell };
    fd.column_collection.forEach((column) => {
      if (column.colType === 'spark') {
        let sparkData;
        if (!column.timeRatio) {
          sparkData = data.map(d => d[metric]);
        } else {
          // Period ratio sparkline
          sparkData = [];
          for (let i = column.timeRatio; i < data.length; i++) {
            const prevData = data[i - column.timeRatio][metric];
            if (prevData && prevData !== 0) {
              sparkData.push(data[i][metric] / prevData);
            } else {
              sparkData.push(null);
            }
          }
        }
        const formatDate = formatDateThunk(column.dateFormat);
        row[column.key] = {
          data: sparkData[sparkData.length - 1],
          display: (
            <WithTooltip
              tooltipProps={sparklineTooltipProps}
              hoverStyles={null}
              renderTooltip={({ index }) => (
                <div>
                  <strong>{d3format(column.d3format, sparkData[index])}</strong>
                  <div>{formatDate(data[index].iso)}</div>
                </div>
              )}
            >
              {({ onMouseLeave, onMouseMove, tooltipData }) => (
                <Sparkline
                  ariaLabel={`spark-${metric}`}
                  width={parseInt(column.width, 10) || 300}
                  height={parseInt(column.height, 10) || 50}
                  margin={SPARKLINE_MARGIN}
                  data={sparkData}
                  onMouseLeave={onMouseLeave}
                  onMouseMove={onMouseMove}
                >
                  <LineSeries
                    showArea={false}
                    stroke="#767676"
                  />
                  {tooltipData &&
                    <VerticalReferenceLine
                      reference={tooltipData.index}
                      strokeDasharray="3 3"
                      strokeWidth={1}
                    />}
                  {tooltipData &&
                    <PointSeries
                      points={[tooltipData.index]}
                      fill="#767676"
                      strokeWidth={1}
                    />}
                </Sparkline>
              )}
            </WithTooltip>
          ),
        };
      } else {
        const recent = reversedData[0][metric];
        let v;
        if (column.colType === 'time') {
          // Time lag ratio
          v = reversedData[parseInt(column.timeLag, 10)][metric];
          if (column.comparisonType === 'diff') {
            v = recent - v;
          } else if (column.comparisonType === 'perc') {
            v = recent / v;
          } else if (column.comparisonType === 'perc_change') {
            v = (recent / v) - 1;
          }
        } else if (column.colType === 'contrib') {
          // contribution to column total
          v = recent / Object.keys(reversedData[0])
            .map(k => k !== 'iso' ? reversedData[0][k] : null)
            .reduce((a, b) => a + b);
        } else if (column.colType === 'avg') {
          // Average over the last {timeLag}
          v = reversedData
          .map((k, i) => i < column.timeLag ? k[metric] : 0)
          .reduce((a, b) => a + b) / column.timeLag;
        }
        let color;
        if (column.bounds && column.bounds[0] !== null && column.bounds[1] !== null) {
          const scaler = d3.scale.linear()
            .domain([
              column.bounds[0],
              column.bounds[0] + ((column.bounds[1] - column.bounds[0]) / 2),
              column.bounds[1],
            ])
            .range([ACCESSIBLE_COLOR_BOUNDS[0], 'grey', ACCESSIBLE_COLOR_BOUNDS[1]]);
          color = scaler(v);
        } else if (column.bounds && column.bounds[0] !== null) {
          color = v >= column.bounds[0] ? ACCESSIBLE_COLOR_BOUNDS[1] : ACCESSIBLE_COLOR_BOUNDS[0];
        } else if (column.bounds && column.bounds[1] !== null) {
          color = v < column.bounds[1] ? ACCESSIBLE_COLOR_BOUNDS[1] : ACCESSIBLE_COLOR_BOUNDS[0];
        }
        row[column.key] = {
          data: v,
          display: (
            <div style={{ color }}>
              <FormattedNumber num={v} format={column.d3format} />
            </div>
          ),
          style: color && {
            boxShadow: `inset 0px -2.5px 0px 0px ${color}`,
            borderRight: '2px solid #fff',
          },
        };
      }
    });
    return row;
  });
  ReactDOM.render(
    <Table
      className="table table-no-hover"
      defaultSort={defaultSort}
      sortBy={defaultSort}
      sortable={fd.column_collection.map(c => c.key)}
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
      {tableData.map(row => (
        <Tr key={row.metric}>
          <Td column="metric" data={row.metric}>{row.metric}</Td>
          {fd.column_collection.map(c => (
            <Td
              column={c.key}
              key={c.key}
              value={row[c.key].data}
              style={row[c.key].style}
            >
              {row[c.key].display}
            </Td>))}
        </Tr>))}
    </Table>,
    document.getElementById(slice.containerId),
  );
}

module.exports = viz;
