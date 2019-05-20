import React, { CSSProperties } from 'react';
import DataTable from '@airbnb/lunar/lib/components/DataTable';
import { Renderers, RendererProps } from '@airbnb/lunar/lib/components/DataTable/types';
import { HEIGHT_TO_PX } from '@airbnb/lunar/lib/components/DataTable/constants';
import { FormDataMetric, Metric } from '@superset-ui/chart';
import { getNumberFormatter, NumberFormats } from '@superset-ui/number-format';
import { getTimeFormatter } from '@superset-ui/time-format';

type ColumnType = {
  key: string;
  label: string;
  format: string;
};

type Props = {
  data: any[];
  height: number;
  alignPositiveNegative?: boolean;
  colorPositiveNegative?: boolean;
  columns: ColumnType[];
  filters?: {
    [key: string]: any[];
  };
  includeSearch?: boolean;
  metrics: FormDataMetric[];
  onAddFilter?: (key: string, value: number[]) => void;
  onRemoveFilter?: (key: string, value: number[]) => void;
  orderDesc: boolean;
  pageLength: number | string;
  percentMetrics: string[];
  tableFilter: boolean;
  tableTimestampFormat: string;
  timeseriesLimitMetric: FormDataMetric;
};

function NOOP(key: string, value: []) {}

const defaultProps = {
  alignPositiveNegative: false,
  colorPositiveNegative: false,
  filters: {},
  includeSearch: false,
  onAddFilter: NOOP,
  onRemoveFilter: NOOP,
};

export type TableProps = Props & Readonly<typeof defaultProps>;

type Cell = {
  key: string;
  value: any;
};

type TableState = {
  selectedCells: Set<string>;
};

const NEGATIVE_COLOR = '#ff8787';
const POSITIVE_COLOR = '#ced4da';

const formatPercent = getNumberFormatter(NumberFormats.PERCENT_3_POINT);

class TableVis extends React.Component<TableProps, TableState> {
  static defaultProps = defaultProps;

  constructor(props: TableProps) {
    super(props);
    this.state = {
      selectedCells: new Set(),
    };
  }

  handleCellSelected = (cell: Cell) => () => {
    const { selectedCells } = this.state;
    const { tableFilter, onRemoveFilter, onAddFilter } = this.props;

    if (!tableFilter) {
      return;
    }
    const newSelectedCells = new Set(Array.from(selectedCells));
    const cellHash = `${cell.key}#${cell.value}`;
    if (newSelectedCells.has(cellHash)) {
      newSelectedCells.delete(cellHash);
      onRemoveFilter(cell.key, [cell.value]);
    } else {
      newSelectedCells.add(cellHash);
      onAddFilter(cell.key, [cell.value]);
    }
    this.setState({
      selectedCells: newSelectedCells,
    });
  };

  static getDerivedStateFromProps(props: TableProps, state: TableState) {
    const { filters } = props;
    const { selectedCells } = state;
    const newSelectedCells = new Set(Array.from(selectedCells));
    Object.keys(filters).forEach(key => {
      filters[key].forEach(value => {
        newSelectedCells.add(`${key}#${value}`);
      });
    });
    return {
      ...state,
      selectedCells: newSelectedCells,
    };
  }

  render() {
    const {
      metrics: rawMetrics,
      timeseriesLimitMetric,
      orderDesc,
      percentMetrics,
      data,
      alignPositiveNegative,
      colorPositiveNegative,
      columns,
      tableTimestampFormat,
      tableFilter,
    } = this.props;
    const { selectedCells } = this.state;
    const metrics = (rawMetrics || [])
      .map(m => (m as Metric).label || (m as string))
      // Add percent metrics
      .concat((percentMetrics || []).map(m => `%${m}`))
      // Removing metrics (aggregates) that are strings
      .filter(m => typeof data[0][m as string] === 'number');
    const dataArray: {
      [key: string]: any;
    } = {};

    const sortByKey =
      timeseriesLimitMetric &&
      ((timeseriesLimitMetric as Metric).label || (timeseriesLimitMetric as string));

    metrics.forEach(metric => {
      const arr = [];
      for (let i = 0; i < data.length; i += 1) {
        arr.push(data[i][metric]);
      }

      dataArray[metric] = arr;
    });

    const maxes: {
      [key: string]: number;
    } = {};
    const mins: {
      [key: string]: number;
    } = {};

    for (let i = 0; i < metrics.length; i += 1) {
      if (alignPositiveNegative) {
        maxes[metrics[i]] = Math.max(...dataArray[metrics[i]].map(Math.abs));
      } else {
        maxes[metrics[i]] = Math.max(...dataArray[metrics[i]]);
        mins[metrics[i]] = Math.min(...dataArray[metrics[i]]);
      }
    }

    // const tsFormatter = getTimeFormatter(tableTimestampFormat);
    let formattedData = data.map(row => ({
      data: row,
    }));

    if (sortByKey) {
      formattedData = formattedData.sort((a, b) => {
        const delta = a.data[sortByKey] - b.data[sortByKey];
        if (orderDesc) {
          return -delta;
        }
        return delta;
      });
      if (metrics.indexOf(sortByKey) < 0) {
        formattedData = formattedData.map(row => {
          const data = { ...row.data };
          delete data[sortByKey];
          return {
            data,
          };
        });
      }
    }

    const tsFormatter = getTimeFormatter(tableTimestampFormat);

    const heightType = 'small';
    const getRenderer = (column: ColumnType) => (props: RendererProps) => {
      const { key } = props;
      let value = props.row.rowData.data[key];
      const cellHash = `${key}#${value}`;
      const isMetric = metrics.indexOf(key) >= 0;
      let Parent;

      if (isMetric) {
        let left = 0;
        let width = 0;
        if (alignPositiveNegative) {
          width = Math.abs(Math.round((value / maxes[key]) * 100));
        } else {
          const posExtent = Math.abs(Math.max(maxes[key], 0));
          const negExtent = Math.abs(Math.min(mins[key], 0));
          const tot = posExtent + negExtent;
          left = Math.round((Math.min(negExtent + value, negExtent) / tot) * 100);
          width = Math.round((Math.abs(value) / tot) * 100);
        }
        const color = colorPositiveNegative && value < 0 ? NEGATIVE_COLOR : POSITIVE_COLOR;
        Parent = ({ children }: { children: React.ReactNode }) => {
          const boxStyle: CSSProperties = {
            margin: '0px -16px',
            backgroundColor: tableFilter && selectedCells.has(cellHash) ? '#ffec99' : undefined,
          };
          const boxContainerStyle: CSSProperties = {
            position: 'relative',
            height: HEIGHT_TO_PX[heightType],
            textAlign: isMetric ? 'right' : 'left',
            display: 'flex',
            alignItems: 'center',
            margin: '0px 16px',
          };
          const barStyle: CSSProperties = {
            background: color,
            width: `${width}%`,
            left: `${left}%`,
            position: 'absolute',
            height: 24,
          };

          return (
            <div style={boxStyle}>
              <div style={boxContainerStyle}>
                <div style={barStyle} />
                <div style={{ zIndex: 10, marginLeft: 'auto' }}>{children}</div>
              </div>
            </div>
          );
        };

        if (key[0] === '%') {
          value = formatPercent(value);
        } else {
          value = getNumberFormatter(column.format)(value);
        }
      } else {
        if (key === '__timestamp') {
          value = tsFormatter(value);
        }
        Parent = ({ children }: { children: React.ReactNode }) => (
          <React.Fragment>{children}</React.Fragment>
        );
      }

      return (
        <div
          onClick={this.handleCellSelected({
            key,
            value: props.row.rowData.data[key],
          })}
        >
          <Parent>{value}</Parent>
        </div>
      );
    };

    const renderers: Renderers = {};

    columns.forEach(column => {
      renderers[column.key] = getRenderer(column);
    });

    return <DataTable data={formattedData} zebra rowHeight={heightType} renderers={renderers} />;
  }
}

export default TableVis;
