import React from 'react';
import DataTable from '@airbnb/lunar/lib/components/DataTable';
import { Renderers } from '@airbnb/lunar/lib/components/DataTable/types';
import { getRenderer, ColumnType, heightType, Cell } from './renderer';

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
  onAddFilter?: (key: string, value: number[]) => void;
  onRemoveFilter?: (key: string, value: number[]) => void;
  tableFilter: boolean;
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

type TableState = {
  selectedCells: Set<string>;
};

function getCellHash(cell: Cell) {
  return `${cell.key}#${cell.value}`;
}

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
    const cellHash = getCellHash(cell);
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

  isSelected = (cell: Cell) => {
    const { selectedCells } = this.state;
    return selectedCells.has(getCellHash(cell));
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
        newSelectedCells.add(
          getCellHash({
            key,
            value,
          }),
        );
      });
    });
    return {
      ...state,
      selectedCells: newSelectedCells,
    };
  };

  render() {
    const {
      data,
      columns,
      alignPositiveNegative,
      colorPositiveNegative,
      height,
      tableFilter,
    } = this.props;

    const renderers: Renderers = {};

    columns.forEach(column => {
      renderers[column.key] = getRenderer({
        column,
        alignPositiveNegative,
        colorPositiveNegative,
        enableFilter: tableFilter,
        isSelected: this.isSelected,
        handleCellSelected: this.handleCellSelected,
      });
    });

    return (
      <DataTable data={data} zebra rowHeight={heightType} renderers={renderers} height={height} />
    );
  }
}

export default TableVis;
