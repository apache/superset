const defaultGetTableProps = props => ({
  role: 'table',
  ...props,
})

const defaultGetTableBodyProps = props => ({
  role: 'rowgroup',
  ...props,
})

const defaultGetHeaderProps = (props, { column }) => ({
  key: `header_${column.id}`,
  colSpan: column.totalVisibleHeaderCount,
  role: 'columnheader',
  ...props,
})

const defaultGetFooterProps = (props, { column }) => ({
  key: `footer_${column.id}`,
  colSpan: column.totalVisibleHeaderCount,
  ...props,
})

const defaultGetHeaderGroupProps = (props, { index }) => ({
  key: `headerGroup_${index}`,
  role: 'row',
  ...props,
})

const defaultGetFooterGroupProps = (props, { index }) => ({
  key: `footerGroup_${index}`,
  ...props,
})

const defaultGetRowProps = (props, { row }) => ({
  key: `row_${row.id}`,
  role: 'row',
  ...props,
})

const defaultGetCellProps = (props, { cell }) => ({
  key: `cell_${cell.row.id}_${cell.column.id}`,
  role: 'cell',
  ...props,
})

export default function makeDefaultPluginHooks() {
  return {
    useOptions: [],
    stateReducers: [],
    useControlledState: [],
    columns: [],
    columnsDeps: [],
    allColumns: [],
    allColumnsDeps: [],
    accessValue: [],
    materializedColumns: [],
    materializedColumnsDeps: [],
    useInstanceAfterData: [],
    visibleColumns: [],
    visibleColumnsDeps: [],
    headerGroups: [],
    headerGroupsDeps: [],
    useInstanceBeforeDimensions: [],
    useInstance: [],
    prepareRow: [],
    getTableProps: [defaultGetTableProps],
    getTableBodyProps: [defaultGetTableBodyProps],
    getHeaderGroupProps: [defaultGetHeaderGroupProps],
    getFooterGroupProps: [defaultGetFooterGroupProps],
    getHeaderProps: [defaultGetHeaderProps],
    getFooterProps: [defaultGetFooterProps],
    getRowProps: [defaultGetRowProps],
    getCellProps: [defaultGetCellProps],
    useFinalInstance: [],
  }
}
