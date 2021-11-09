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
import Mustache from 'mustache';
import { scaleLinear } from 'd3-scale';
import { Table, Thead, Th, Tr, Td } from 'reactable-arc';
import { formatNumber, formatTime, styled } from '@superset-ui/core';
import {
  InfoTooltipWithTrigger,
  MetricOption,
} from '@superset-ui/chart-controls';
import moment from 'moment';

import FormattedNumber from './FormattedNumber';
import SparklineCell from './SparklineCell';

const ACCESSIBLE_COLOR_BOUNDS = ['#ca0020', '#0571b0'];
interface ColorFromBoundProps {
  value: number;
  bounds: Array<string>;
  colorBounds: Array<string>;
}
function colorFromBounds(
  value: number,
  bounds: number[],
  colorBounds = ACCESSIBLE_COLOR_BOUNDS,
): ColorFromBoundProps | null {
  if (bounds) {
    const [min, max] = bounds;
    const [minColor, maxColor] = colorBounds;
    if (min !== null && max !== null) {
      const colorScale = scaleLinear()
        .domain([min, (max + min) / 2, max])
        // @ts-ignore
        .range([minColor, 'grey', maxColor]);

      // @ts-ignore
      return colorScale(value);
    }
    if (min !== null) {
      // @ts-ignore
      return value >= min ? maxColor : minColor;
    }
    if (max !== null) {
      // @ts-ignore
      return value < max ? maxColor : minColor;
    }
  }
  return null;
}

interface ColumnConfigProps {
  colType: string;
  comparisonType: string;
  d3format: string;
  key: string;
  label: string;
  timeLag: number;
  tooltip: any;
  bounds: number[];
  dateFormat: string;
  width: string;
  height: string;
  yAxisBounds: number[];
  showYAxis: boolean;
  timeRatio: number;
}

interface RowData {
  label: string;
  // eslint-disable-next-line camelcase
  metric_name: string;
}

interface ChartProps {
  className: string | undefined;
  columnConfigs: Array<ColumnConfigProps>;
  data: object;
  height: number;
  rows: Array<RowData>;
  rowType: string;
  url: string;
  row: Array<unknown>;
}
interface Entry {
  [key: string]: number;
}

class TimeTable extends React.PureComponent<ChartProps, {}> {
  renderLeftCell(row: RowData) {
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
        openInNewWindow
        metric={row}
        url={fullUrl}
        showFormula={false}
      />
    );
  }

  // eslint-disable-next-line class-methods-use-this
  renderSparklineCell(
    valueField: string,
    column: ColumnConfigProps,
    entries: Entry[],
  ) {
    let sparkData: number[];
    if (column.timeRatio) {
      // Period ratio sparkline
      sparkData = [];
      for (let i = column.timeRatio; i < entries.length; i += 1) {
        const prevData = entries[i - column.timeRatio][valueField];
        if (prevData && prevData !== 0) {
          sparkData.push(entries[i][valueField] / prevData);
        } else {
          // @ts-ignore
          sparkData.push(null);
        }
      }
    } else {
      sparkData = entries.map(d => d[valueField]);
    }

    return (
      <Td
        key={column.key}
        column={column.key}
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
          renderTooltip={({ index }: { index: number }) => (
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
      </Td>
    );
  }

  // eslint-disable-next-line class-methods-use-this
  renderValueCell(
    valueField: string,
    column: ColumnConfigProps,
    reversedEntries: Entry[],
  ) {
    const recent = reversedEntries[0][valueField];
    let v = 0;
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
          .map(k => (k === 'time' ? 0 : reversedEntries[0][k]))
          .reduce((a, b) => a + b);
    } else if (column.colType === 'avg') {
      // Average over the last {timeLag}
      v =
        reversedEntries
          .map((k: Entry, i: number) =>
            i < column.timeLag ? k[valueField] : 0,
          )
          .reduce((a: number, b: number) => a + b) / column.timeLag;
    }

    const color = colorFromBounds(v, column.bounds);

    return (
      <Td
        key={column.key}
        column={column.key}
        value={v}
        style={
          color && {
            boxShadow: `inset 0px -2.5px 0px 0px ${color}`,
            borderRight: '2px solid #fff',
          }
        }
      >
        {errorMsg ? (
          <div>{errorMsg}</div>
        ) : (
          // @ts-ignore
          <div style={{ color }}>
            <FormattedNumber num={v} format={column.d3format} />
          </div>
        )}
      </Td>
    );
  }

  renderRow(row: RowData, entries: Entry[], reversedEntries: Entry[]) {
    const { columnConfigs } = this.props;
    const valueField: string = row.label || row.metric_name;
    const leftCell = this.renderLeftCell(row);
    return (
      <Tr key={leftCell}>
        <Td column="metric" data={leftCell}>
          {leftCell}
        </Td>
        {columnConfigs.map(c =>
          c.colType === 'spark'
            ? this.renderSparklineCell(valueField, c, entries)
            : this.renderValueCell(valueField, c, reversedEntries),
        )}
      </Tr>
    );
  }

  render() {
    const { className, height, data, columnConfigs, rowType, rows } =
      this.props;
    const entries = Object.keys(data)
      .sort()
      // @ts-ignore
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      .map(time => ({ ...data[time], time }));

    const reversedEntries = entries.concat().reverse();

    const defaultSort =
      rowType === 'column' && columnConfigs.length > 0
        ? {
            column: columnConfigs[0].key,
            direction: 'desc',
          }
        : false;

    return (
      <div className={`time-table ${className}`} style={{ height }}>
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
                {c?.label}{' '}
                {c?.tooltip && (
                  <InfoTooltipWithTrigger
                    tooltip={c?.tooltip}
                    label={`tt-col-${i}`}
                    placement="top"
                  />
                )}
              </Th>
            ))}
          </Thead>
          {rows.map(row => this.renderRow(row, entries, reversedEntries))}
        </Table>
      </div>
    );
  }
}

export default styled(TimeTable)`
  .time-table {
    overflow: auto;
  }
`;
