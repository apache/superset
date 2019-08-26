import React from 'react';
import DataTable from '@airbnb/lunar/lib/components/DataTable';
import Text from '@airbnb/lunar/lib/components/Text';
import Input from '@airbnb/lunar/lib/components/Input';
import withStyles, { WithStylesProps } from '@airbnb/lunar/lib/composers/withStyles';
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

const NOOP = () => {};

const defaultProps = {
  alignPositiveNegative: false,
  colorPositiveNegative: false,
  filters: {},
  includeSearch: false,
  onAddFilter: NOOP,
  onRemoveFilter: NOOP,
};

const SEARCH_BAR_HEIGHT = 40;

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
      filteredRows: [],
      // eslint-disable-next-line react/no-unused-state
      filters: props.filters,
      searchKeyword: '',
      selectedCells: new Set(),
    };
  }

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
        filters,
        selectedCells: newSelectedCells,
      };
    }

    return state;
  };

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
        const content = Object.keys(row.data)
          .map(key => row.data[key])
          .join('|')
          .toLowerCase();

        return content.indexOf(value.toLowerCase()) >= 0;
      });
      this.setState({
        filteredRows,
        searchKeyword: value,
      });
    }
  };

  render() {
    const {
      cx,
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

    const dataToRender = searchKeyword === '' ? data : filteredRows;
    const columnMetadata: ColumnMetadata = {};

    columns.forEach(column => {
      renderers[column.key] = getRenderer({
        alignPositiveNegative,
        colorPositiveNegative,
        column,
        enableFilter: tableFilter,
        handleCellSelected: this.handleCellSelected,
        isSelected: this.isSelected,
      });
      if (column.type === 'metric') {
        columnMetadata[column.key] = {
          rightAlign: 1,
        };
      }
    });

    const tableHeight = includeSearch ? height - SEARCH_BAR_HEIGHT : height;

    return (
      <div className={cx(styles.container)}>
        {includeSearch && (
          <div className={cx(styles.searchBar)}>
            <div className={cx(styles.searchBox)}>
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
          keys={dataToRender && dataToRender.length > 0 ? Object.keys(dataToRender[0].data) : []}
          columnMetadata={columnMetadata}
          zebra
          rowHeight={heightType}
          renderers={renderers}
          height={tableHeight}
        />
      </div>
    );
  }
}

export default withStyles(({ unit }) => ({
  container: {
    display: 'grid',
  },
  searchBar: {
    alignItems: 'baseline',
    display: 'flex',
    flexDirection: 'row-reverse',
    flexGrow: 0,
    marginBottom: unit,
  },
  searchBox: {
    marginLeft: unit,
    // eslint-disable-next-line no-magic-numbers
    width: 25 * unit,
  },
}))(TableVis);
