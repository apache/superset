/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import React from 'react';
import PropTypes from 'prop-types';
import Mustache from 'mustache';
import { scaleLinear } from 'd3-scale';
import { Table, Thead, Th, Tr, Td } from 'reactable-arc';
import { formatNumber } from '@superset-ui/number-format';
import { formatTime } from '@superset-ui/time-format';
import moment from 'moment';

import MetricOption from '../../components/MetricOption';
import InfoTooltipWithTrigger from '../../components/InfoTooltipWithTrigger';
import FormattedNumber from './FormattedNumber';
import SparklineCell from './SparklineCell';
import './TimeTable.less';

const ACCESSIBLE_COLOR_BOUNDS = ['#ca0020', '#0571b0'];

function colorFromBounds(value, bounds, colorBounds = ACCESSIBLE_COLOR_BOUNDS) {
  if (bounds) {
    const [min, max] = bounds;
    const [minColor, maxColor] = colorBounds;
    if (min !== null && max !== null) {
      const colorScale = scaleLinear()
        .domain([min, (max + min) / 2, max])
        .range([minColor, 'grey', maxColor]);
      return colorScale(value);
    } else if (min !== null) {
      return value >= min ? maxColor : minColor;
    } else if (max !== null) {
      return value < max ? maxColor : minColor;
    }
  }
  return null;
}

const propTypes = {
  className: PropTypes.string,
  height: PropTypes.number,
  // Example
  // {'2018-04-14 00:00:00': { 'SUM(metric_value)': 80031779.40047 }}
  data: PropTypes.objectOf(PropTypes.objectOf(PropTypes.number)).isRequired,
  columnConfigs: PropTypes.arrayOf(PropTypes.shape({
    colType: PropTypes.string,
    comparisonType: PropTypes.string,
    d3format: PropTypes.string,
    key: PropTypes.string,
    label: PropTypes.string,
    timeLag: PropTypes.number,
  })).isRequired,
  rows: PropTypes.arrayOf(PropTypes.oneOfType([
    PropTypes.shape({
      label: PropTypes.string,
    }),
    PropTypes.shape({
      metric_name: PropTypes.string,
    }),
  ])).isRequired,
  rowType: PropTypes.oneOf(['column', 'metric']).isRequired,
  url: PropTypes.string,
};
const defaultProps = {
  className: '',
  height: undefined,
  url: '',
};

class TimeTable extends React.PureComponent {
  renderLeftCell(row) {
    const { rowType, url } = this.props;
    const context = { metric: row };
    const fullUrl = url ? Mustache.render(url, context) : null;

    if (rowType === 'column') {
      const column = row;
      if (fullUrl) {
        return (
          <a
            href={fullUrl}
            rel="noopener noreferrer"
            target="_blank"
          >
            {column.label}
          </a>
        );
      }
      return column.label;
    }

    const metric = row;
    return (
      <MetricOption
        metric={metric}
        url={fullUrl}
        showFormula={false}
        openInNewWindow
      />
    );
  }

  renderSparklineCell(valueField, column, entries) {
    let sparkData;
    if (column.timeRatio) {
      // Period ratio sparkline
      sparkData = [];
      for (let i = column.timeRatio; i < entries.length; i++) {
        const prevData = entries[i - column.timeRatio][valueField];
        if (prevData && prevData !== 0) {
          sparkData.push(entries[i][valueField] / prevData);
        } else {
          sparkData.push(null);
        }
      }
    } else {
      sparkData = entries.map(d => d[valueField]);
    }

    return (
      <Td
        column={column.key}
        key={column.key}
        value={sparkData[sparkData.length - 1]}
      >
        <SparklineCell
          width={parseInt(column.width, 10) || 300}
          height={parseInt(column.height, 10) || 50}
          data={sparkData}
          ariaLabel={`spark-${valueField}`}
          numberFormat={column.d3format}
          yAxisBounds={column.yAxisBounds}
          showYAxis={column.showYAxis}
          renderTooltip={({ index }) => (
            <div>
              <strong>{formatNumber(column.d3format, sparkData[index])}</strong>
              <div>{formatTime(column.dateFormat, moment.utc(entries[index].time).toDate())}</div>
            </div>
          )}
        />
      </Td>
    );
  }

  renderValueCell(valueField, column, reversedEntries) {
    const recent = reversedEntries[0][valueField];
    let v;
    let errorMsg;
    if (column.colType === 'time') {
      // Time lag ratio
      const { timeLag } = column;
      const totalLag = Object.keys(reversedEntries).length;
      if (timeLag >= totalLag) {
        errorMsg = `The time lag set at ${timeLag} is too large for the length of data at ${reversedEntries.length}. No data available.`;
      } else {
        v = reversedEntries[timeLag][valueField];
      }
      if (column.comparisonType === 'diff') {
        v = recent - v;
      } else if (column.comparisonType === 'perc') {
        v = recent / v;
      } else if (column.comparisonType === 'perc_change') {
        v = (recent / v) - 1;
      }
      v = v || 0;
    } else if (column.colType === 'contrib') {
      // contribution to column total
      v = recent / Object.keys(reversedEntries[0])
        .map(k => k !== 'time' ? reversedEntries[0][k] : null)
        .reduce((a, b) => a + b);
    } else if (column.colType === 'avg') {
      // Average over the last {timeLag}
      v = reversedEntries
        .map((k, i) => i < column.timeLag ? k[valueField] : 0)
        .reduce((a, b) => a + b) / column.timeLag;
    }

    const color = colorFromBounds(v, column.bounds);

    return (
      <Td
        column={column.key}
        key={column.key}
        value={v}
        style={color && {
          boxShadow: `inset 0px -2.5px 0px 0px ${color}`,
          borderRight: '2px solid #fff',
        }}
      >
        {errorMsg
          ? (<div>{errorMsg}</div>)
          : (<div style={{ color }}>
            <FormattedNumber num={v} format={column.d3format} />
          </div>)}
      </Td>
    );
  }

  renderRow(row, entries, reversedEntries) {
    const { columnConfigs } = this.props;
    const valueField = row.label || row.metric_name;
    const leftCell = this.renderLeftCell(row);

    return (
      <Tr key={leftCell}>
        <Td column="metric" data={leftCell}>
          {leftCell}
        </Td>
        {columnConfigs.map(c => c.colType === 'spark'
          ? this.renderSparklineCell(valueField, c, entries)
          : this.renderValueCell(valueField, c, reversedEntries))}
      </Tr>
    );
  }

  render() {
    const {
      className,
      height,
      data,
      columnConfigs,
      rowType,
      rows,
    } = this.props;

    const entries = Object.keys(data)
      .sort()
      .map(time => ({ ...data[time], time }));
    const reversedEntries = entries.concat().reverse();

    const defaultSort = rowType === 'column' && columnConfigs.length ? {
      column: columnConfigs[0].key,
      direction: 'desc',
    } : false;

    return (
      <div
        className={`time-table ${className}`}
        style={{ height }}
      >
        <Table
          className="table table-no-hover"
          defaultSort={defaultSort}
          sortBy={defaultSort}
          sortable={columnConfigs.map(c => c.key)}
        >
          <Thead>
            <Th column="metric">Metric</Th>
            {columnConfigs.map((c, i) => (
              <Th
                key={c.key}
                column={c.key}
                width={c.colType === 'spark' ? '1%' : null}
              >
                {c.label} {c.tooltip && (
                  <InfoTooltipWithTrigger
                    tooltip={c.tooltip}
                    label={`tt-col-${i}`}
                    placement="top"
                  />
                )}
              </Th>))}
          </Thead>
          {rows.map(row => this.renderRow(row, entries, reversedEntries))}
        </Table>
      </div>
    );
  }
}

TimeTable.propTypes = propTypes;
TimeTable.defaultProps = defaultProps;

export default TimeTable;
