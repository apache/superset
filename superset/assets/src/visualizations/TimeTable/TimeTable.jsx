import ReactDOM from 'react-dom';
import React from 'react';
import PropTypes from 'prop-types';
import { Table, Thead, Th, Tr, Td } from 'reactable';
import d3 from 'd3';
import Mustache from 'mustache';

import MetricOption from '../../components/MetricOption';
import { formatDateThunk } from '../../modules/dates';
import { d3format } from '../../modules/utils';
import InfoTooltipWithTrigger from '../../components/InfoTooltipWithTrigger';
import FormattedNumber from './FormattedNumber';
import SparklineCell from './SparklineCell';
import './TimeTable.css';

const ACCESSIBLE_COLOR_BOUNDS = ['#ca0020', '#0571b0'];

function colorFromBounds(value, bounds, colorBounds = ACCESSIBLE_COLOR_BOUNDS) {
  if (bounds) {
    const [min, max] = bounds;
    const [minColor, maxColor] = colorBounds;
    if (min !== null && max !== null) {
      const colorScale = d3.scale.linear()
        .domain([
          min,
          (max + min) / 2,
          max,
        ])
        .range([minColor, 'grey', maxColor]);
      return colorScale(value);
    } else if (min !== null) {
      return value >= min ? maxColor : minColor;
    } else if (bounds[1] !== null) {
      return value < max ? maxColor : minColor;
    }
  }
  return null;
}

const propTypes = {
  className: PropTypes.string,
  data: PropTypes.shape({
    columns: PropTypes.arrayOf(PropTypes.string),
    records: PropTypes.object,
  }),
  columnCollection: PropTypes.arrayOf(PropTypes.object),
  isGroupBy: PropTypes.bool,
  metrics: PropTypes.array,
  metricMap: PropTypes.object,
  url: PropTypes.string,
};
const defaultProps = {
  className: '',
};

class TimeTable extends React.PureComponent {
  renderLeftCell(metric) {
    const { isGroupBy, metricMap, url } = this.props;
    // const context = { ...fd, metric };
    const context = { metric };
    const fullUrl = url ? Mustache.render(url, context) : null;

    if (!isGroupBy) {
      const metricData = typeof metric === 'object'
        ? metric
        : metricMap[metric];
      return (
        <MetricOption
          metric={metricData}
          url={fullUrl}
          showFormula={false}
          openInNewWindow
        />
      );
    }

    const metricLabel = metric.label || metric;

    if (fullUrl) {
      return (
        <a
          href={fullUrl}
          rel="noopener noreferrer"
          target="_blank"
        >
          {metricLabel}
        </a>
      );
    }
    return metricLabel;
  }

  renderSparklineCell(metricLabel, column, entries) {
    let sparkData;
    if (column.timeRatio) {
      // Period ratio sparkline
      sparkData = [];
      for (let i = column.timeRatio; i < entries.length; i++) {
        const prevData = entries[i - column.timeRatio][metricLabel];
        if (prevData && prevData !== 0) {
          sparkData.push(entries[i][metricLabel] / prevData);
        } else {
          sparkData.push(null);
        }
      }
    } else {
      sparkData = entries.map(d => d[metricLabel]);
    }

    const formatDate = formatDateThunk(column.dateFormat);

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
          ariaLabel={`spark-${metricLabel}`}
          numberFormat={column.d3format}
          yAxisBounds={column.yAxisBounds}
          showYAxis={column.showYAxis}
          renderTooltip={({ index }) => (
            <div>
              <strong>{d3format(column.d3Format, sparkData[index])}</strong>
              <div>{formatDate(entries[index].time)}</div>
            </div>
          )}
        />
      </Td>
    );
  }

  renderValueCell(metricLabel, column, reversedEntries) {
    const recent = reversedEntries[0][metricLabel];
    let v;
    let errorMsg;
    if (column.colType === 'time') {
      // Time lag ratio
      const timeLag = parseInt(column.timeLag, 10);
      const totalLag = Object.keys(reversedEntries).length;
      if (timeLag > totalLag) {
        errorMsg = `The time lag set at ${timeLag} exceeds the length of data at ${reversedData.length}. No data available.`;
      } else {
        v = reversedEntries[timeLag][metricLabel];
      }
      if (column.comparisonType === 'diff') {
        v = recent - v;
      } else if (column.comparisonType === 'perc') {
        v = recent / v;
      } else if (column.comparisonType === 'perc_change') {
        v = (recent / v) - 1;
      }
    } else if (column.colType === 'contrib') {
      // contribution to column total
      v = recent / Object.keys(reversedEntries[0])
        .map(k => k !== 'time' ? reversedEntries[0][k] : null)
        .reduce((a, b) => a + b);
    } else if (column.colType === 'avg') {
      // Average over the last {timeLag}
      v = reversedEntries
        .map((k, i) => i < column.timeLag ? k[metricLabel] : 0)
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
    const { columnCollection } = this.props;
    const metricLabel = row.label || row;
    const leftCell = this.renderLeftCell(row);

    return (
      <Tr key={leftCell}>
        <Td column="metric" data={leftCell}>
          {leftCell}
        </Td>
        {columnCollection.map(c => c.colType === 'spark'
          ? this.renderSparklineCell(metricLabel, c, entries)
          : this.renderValueCell(metricLabel, c, reversedEntries))}
      </Tr>
    );
  }

  render() {
    const {
      className,
      data,
      columnCollection,
      isGroupBy,
      metrics,
    } = this.props;

    const { records, columns } = data;

    const entries = Object.keys(records)
      .sort()
      .map(time => ({ ...records[time], time }));
    const reversedEntries = entries.concat().reverse();

    let rows;
    let defaultSort = false;
    if (isGroupBy) {
      rows = columns;
      defaultSort = {
        column: columnCollection[0].key,
        direction: 'desc',
      };
    } else {
      rows = metrics;
    }

    return (
      <Table
        className={`table table-no-hover ${className}`}
        defaultSort={defaultSort}
        sortBy={defaultSort}
        sortable={columnCollection.map(c => c.key)}
      >
        <Thead>
          <Th column="metric">Metric</Th>
          {columnCollection.map((c, i) => (
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
    );
  }
}

TimeTable.propTypes = propTypes;
TimeTable.defaultProps = defaultProps;

function adaptor(slice, payload) {
  console.log('slice.formData, payload.data', slice.formData, payload.form_data, payload.data);

  const { containerId, formData, datasource } = slice;
  const {
    column_collection: columnCollection,
    metrics,
    url,
  } = formData;

  const metricMap = {};
  datasource.metrics.forEach((m) => {
    metricMap[m.metric_name] = m;
  });

  // slice.container.css('height', slice.height());

  ReactDOM.render(
    <TimeTable
      data={payload.data}
      columnCollection={columnCollection}
      isGroupBy={payload.data.is_group_by}
      metrics={metrics}
      metricMap={metricMap}
      url={url}
    />,
    document.getElementById(containerId),
  );
}

export default adaptor;
