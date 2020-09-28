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
import { formatNumber, formatTime } from '@superset-ui/core';
import {
  InfoTooltipWithTrigger,
  MetricOption,
} from '@superset-ui/chart-controls';
import moment from 'moment';
import ListView from 'src/components/ListView';
import { memoize } from 'lodash-es';
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
    }
    if (min !== null) {
      return value >= min ? maxColor : minColor;
    }
    if (max !== null) {
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
  columnConfigs: PropTypes.arrayOf(
    PropTypes.shape({
      colType: PropTypes.string,
      comparisonType: PropTypes.string,
      d3format: PropTypes.string,
      key: PropTypes.string,
      label: PropTypes.string,
      timeLag: PropTypes.number,
    }),
  ).isRequired,
  rows: PropTypes.arrayOf(
    PropTypes.oneOfType([
      PropTypes.shape({
        label: PropTypes.string,
      }),
      PropTypes.shape({
        metric_name: PropTypes.string,
      }),
    ]),
  ).isRequired,
  rowType: PropTypes.oneOf(['column', 'metric']).isRequired,
  url: PropTypes.string,
};
const defaultProps = {
  className: '',
  height: undefined,
  url: '',
};

class TimeTable extends React.PureComponent {
  memoizedColumns = memoize(() => [
    { accessor: 'metric', Header: 'Metric' },
    ...this.props.columnConfigs.map((columnConfig, i) => ({
      accessor: columnConfig.key,
      cellProps: columnConfig.colType === 'spark' && { style: { width: '1%' } },
      Header: () => (
        <>
          {columnConfig.label}{' '}
          {columnConfig.tooltip && (
            <InfoTooltipWithTrigger
              tooltip={columnConfig.tooltip}
              label={`tt-col-${i}`}
              placement="top"
            />
          )}
        </>
      ),
      sortType: (rowA, rowB, columnId) => {
        const rowAVal = rowA.values[columnId].props['data-value'];
        const rowBVal = rowB.values[columnId].props['data-value'];
        return rowAVal - rowBVal;
      },
    })),
  ]);

  memoizedRows = memoize(() => {
    const entries = Object.keys(this.props.data)
      .sort()
      .map(time => ({ ...this.props.data[time], time }));
    const reversedEntries = entries.concat().reverse();

    return this.props.rows.map(row => {
      const valueField = row.label || row.metric_name;
      const cellValues = this.props.columnConfigs.reduce(
        (acc, columnConfig) => {
          if (columnConfig.colType === 'spark') {
            return {
              ...acc,
              [columnConfig.key]: this.renderSparklineCell(
                valueField,
                columnConfig,
                entries,
              ),
            };
          }
          return {
            ...acc,
            [columnConfig.key]: this.renderValueCell(
              valueField,
              columnConfig,
              reversedEntries,
            ),
          };
        },
        {},
      );
      return { ...row, ...cellValues, metric: this.renderLeftCell(row) };
    });
  });

  initialSort = [{ id: 'metric', desc: false }];

  renderLeftCell(row) {
    const { rowType, url } = this.props;
    const context = { metric: row };
    const fullUrl = url ? Mustache.render(url, context) : null;

    if (rowType === 'column') {
      const column = row;
      if (fullUrl) {
        return (
          <a href={fullUrl} rel="noopener noreferrer" target="_blank">
            {column.label}
          </a>
        );
      }
      return column.label;
    }

    return (
      <MetricOption
        metric={row}
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
      for (let i = column.timeRatio; i < entries.length; i += 1) {
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
      <SparklineCell
        width={parseInt(column.width, 10) || 300}
        height={parseInt(column.height, 10) || 50}
        data={sparkData}
        data-value={sparkData[sparkData.length - 1]}
        ariaLabel={`spark-${valueField}`}
        numberFormat={column.d3format}
        yAxisBounds={column.yAxisBounds}
        showYAxis={column.showYAxis}
        renderTooltip={({ index }) => (
          <div>
            <strong>{formatNumber(column.d3format, sparkData[index])}</strong>
            <div>
              {formatTime(
                column.dateFormat,
                moment.utc(entries[index].time).toDate(),
              )}
            </div>
          </div>
        )}
      />
    );
  }

  renderValueCell(valueField, column, reversedEntries) {
    const recent = reversedEntries[0][valueField];
    let v;
    let errorMsg;
    if (column.colType === 'time') {
      // Time lag ratio
      const timeLag = column.timeLag || 0;
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
        v = recent / v - 1;
      }
      v = v || 0;
    } else if (column.colType === 'contrib') {
      // contribution to column total
      v =
        recent /
        Object.keys(reversedEntries[0])
          .map(k => (k !== 'time' ? reversedEntries[0][k] : null))
          .reduce((a, b) => a + b);
    } else if (column.colType === 'avg') {
      // Average over the last {timeLag}
      v =
        reversedEntries
          .map((k, i) => (i < column.timeLag ? k[valueField] : 0))
          .reduce((a, b) => a + b) / column.timeLag;
    }

    const color = colorFromBounds(v, column.bounds);

    return (
      <span
        key={column.key}
        data-value={v}
        style={
          color && {
            boxShadow: `inset 0px -2.5px 0px 0px ${color}`,
            borderRight: '2px solid #fff',
          }
        }
      >
        {errorMsg ? (
          { errorMsg }
        ) : (
          <span style={{ color }}>
            <FormattedNumber num={v} format={column.d3format} />
          </span>
        )}
      </span>
    );
  }

  render() {
    const { className, height } = this.props;

    return (
      <div className={`time-table ${className}`} style={{ height }}>
        <ListView
          columns={this.memoizedColumns()}
          data={this.memoizedRows()}
          count={0}
          // we don't use pagination
          pageSize={0}
          initialSort={this.initialSort}
          fetchData={() => {}}
          loading={false}
          sticky={false}
          fullHeight
          manualSortBy={false}
        />
      </div>
    );
  }
}

TimeTable.propTypes = propTypes;
TimeTable.defaultProps = defaultProps;

export default TimeTable;
