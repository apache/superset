import React from 'react';
import DataTable from '@airbnb/lunar/lib/components/DataTable';
import Input from '@airbnb/lunar/lib/components/Input';
import withStyles, { css, WithStylesProps } from '@airbnb/lunar/lib/composers/withStyles';
import { Renderers, ParentRow } from '@airbnb/lunar/lib/components/DataTable/types';
import { getRenderer, ColumnType, heightType, Cell } from './renderer';

type Props = {
  data: ParentRow[];
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

function NOOP(key: string, value: number[]) {}

const defaultProps = {
  alignPositiveNegative: false,
  colorPositiveNegative: false,
  filters: {},
  includeSearch: false,
  onAddFilter: NOOP,
  onRemoveFilter: NOOP,
};

export type TableProps = Props & Readonly<typeof defaultProps>;

type InternalTableProps = TableProps & WithStylesProps;

type TableState = {
  selectedCells: Set<string>;
  searchKeyword: string;
  filteredRows: ParentRow[];
};

function getCellHash(cell: Cell) {
  return `${cell.key}#${cell.value}`;
}

class TableVis extends React.PureComponent<InternalTableProps, TableState> {
  static defaultProps = defaultProps;

  constructor(props: InternalTableProps) {
    super(props);
    this.state = {
      selectedCells: new Set(),
      searchKeyword: '',
      filteredRows: [],
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
      onRemoveFilter(cell.key, [cell.value as number]);
    } else {
      newSelectedCells.add(cellHash);
      onAddFilter(cell.key, [cell.value as number]);
    }
    this.setState({
      selectedCells: newSelectedCells,
    });
  };

  isSelected = (cell: Cell) => {
    const { selectedCells } = this.state;
    return selectedCells.has(getCellHash(cell));
  };

  handleSearch = (value: string) => {
    console.log(value);
    const { searchKeyword } = this.state;
    const { data } = this.props;
    if (searchKeyword !== value) {
      const filteredRows = data.filter(row => {
        const content = Object.values(row.data)
          .join('|')
          .toLowerCase();
        return content.indexOf(value) >= 0;
      });
      console.log(filteredRows);
      this.setState({
        searchKeyword: value,
        filteredRows,
      });
    }
  };

  static getDerivedStateFromProps: React.GetDerivedStateFromProps<
    InternalTableProps,
    TableState
  > = (props: InternalTableProps, state: TableState) => {
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
      styles,
      includeSearch,
    } = this.props;

    const { filteredRows, searchKeyword } = this.state;

    const renderers: Renderers = {};

    const dataToRender = searchKeyword !== '' ? filteredRows : data;

    console.log(dataToRender);

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
      <React.Fragment>
        {includeSearch && (
          <div {...css(styles.searchBar)}>
            <Input
              name="search"
              label=""
              placeholder="Search"
              onChange={this.handleSearch}
              compact
              value={searchKeyword}
            />
          </div>
        )}
        <DataTable
          data={dataToRender}
          zebra
          rowHeight={heightType}
          renderers={renderers}
          height={height}
        />
      </React.Fragment>
    );
  }
}

export default withStyles(() => ({
  searchBar: {
    display: 'flex',
    flexDirection: 'row-reverse',
  },
}))(TableVis);
