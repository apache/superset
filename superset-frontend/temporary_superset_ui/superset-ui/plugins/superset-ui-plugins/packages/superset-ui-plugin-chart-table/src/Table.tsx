import React, { CSSProperties } from 'react';
import DataTable from '@airbnb/lunar/lib/components/DataTable';
import { Renderers, RendererProps } from '@airbnb/lunar/lib/components/DataTable/types';
import { HEIGHT_TO_PX } from '@airbnb/lunar/lib/components/DataTable/constants';
import { FormDataMetric, Metric } from '@superset-ui/chart';

type ColumnType = {
  key: string;
  label: string;
  format?: (value: any) => string;
  type: 'metric' | 'string';
  maxValue?: number;
  minValue?: number;
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

  static getDerivedStateFromProps: React.GetDerivedStateFromProps<TableProps, TableState> = (
    props: TableProps,
    state: TableState,
  ) => {
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
  };

  render() {
    const {
      metrics,
      timeseriesLimitMetric,
      orderDesc,
      data,
      alignPositiveNegative,
      colorPositiveNegative,
      columns,
      tableFilter,
    } = this.props;
    const { selectedCells } = this.state;

    const sortByKey =
      timeseriesLimitMetric &&
      ((timeseriesLimitMetric as Metric).label || (timeseriesLimitMetric as string));

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
          width = Math.abs(
            Math.round((value / Math.max(column.maxValue!, Math.abs(column.minValue!))) * 100),
          );
        } else {
          const posExtent = Math.abs(Math.max(column.maxValue!, 0));
          const negExtent = Math.abs(Math.min(column.minValue!, 0));
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
      } else {
        Parent = ({ children }: { children: React.ReactNode }) => (
          <React.Fragment>{children}</React.Fragment>
        );
      }

      return (
        <div
          onClick={this.handleCellSelected({
            key,
            value,
          })}
        >
          <Parent>{column.format ? column.format(value) : value}</Parent>
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
