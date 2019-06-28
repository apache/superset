import React from 'react';
import DataTable from '@airbnb/lunar/lib/components/DataTable';
import Text from '@airbnb/lunar/lib/components/Text';
import Input from '@airbnb/lunar/lib/components/Input';
import withStyles, { css, WithStylesProps } from '@airbnb/lunar/lib/composers/withStyles';
import { Renderers, ParentRow, ColumnMetadata } from '@airbnb/lunar/lib/components/DataTable/types';
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
  filters: {
    [key: string]: (string | number)[];
  };
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
      filters: props.filters,
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
    const { searchKeyword } = this.state;
    const { data } = this.props;
    if (searchKeyword !== value) {
      const filteredRows = data.filter(row => {
        const content = Object.values(row.data)
          .join('|')
          .toLowerCase();
        return content.indexOf(value.toLowerCase()) >= 0;
      });
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
    const { selectedCells, filters: prevFilters } = state;
    if (prevFilters !== filters) {
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
    }
    return state;
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
    const columnMetadata: ColumnMetadata = {};

    columns.forEach(column => {
      renderers[column.key] = getRenderer({
        column,
        alignPositiveNegative,
        colorPositiveNegative,
        enableFilter: tableFilter,
        isSelected: this.isSelected,
        handleCellSelected: this.handleCellSelected,
      });
      if (column.type == 'metric') {
        columnMetadata[column.key] = {
          rightAlign: 1,
        };
      }
    });

    return (
      <React.Fragment>
        {includeSearch && (
          <div {...css(styles.searchBar)}>
            <div {...css(styles.searchBox)}>
              <Input
                name="search"
                label=""
                placeholder="Search"
                onChange={this.handleSearch}
                compact
                value={searchKeyword}
              />
            </div>
            <Text small>
              Showing {dataToRender.length} out of {data.length} rows
            </Text>
          </div>
        )}
        <DataTable
          data={dataToRender}
          columnMetadata={columnMetadata}
          zebra
          rowHeight={heightType}
          renderers={renderers}
          height={height}
        />
      </React.Fragment>
    );
  }
}

export default withStyles(({ unit }) => ({
  searchBar: {
    display: 'flex',
    flexGrow: 0,
    flexDirection: 'row-reverse',
    marginBottom: unit,
    alignItems: 'baseline',
  },
  searchBox: {
    width: 25 * unit,
    marginLeft: unit,
  },
}))(TableVis);
