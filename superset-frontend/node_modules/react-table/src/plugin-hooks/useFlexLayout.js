export function useFlexLayout(hooks) {
  hooks.getTableProps.push(getTableProps)
  hooks.getRowProps.push(getRowStyles)
  hooks.getHeaderGroupProps.push(getRowStyles)
  hooks.getHeaderProps.push(getHeaderProps)
  hooks.getCellProps.push(getCellProps)
}

useFlexLayout.pluginName = 'useFlexLayout'

const getTableProps = (props, { instance }) => [
  props,
  {
    style: {
      minWidth: `${instance.totalColumnsWidth}px`,
    },
  },
]

const getRowStyles = (props, { instance }) => [
  props,
  {
    style: {
      display: 'flex',
      flex: '1 0 auto',
      minWidth: `${instance.totalColumnsMinWidth}px`,
    },
  },
]

const getHeaderProps = (props, { column }) => [
  props,
  {
    style: {
      boxSizing: 'border-box',
      flex: column.totalFlexWidth
        ? `${column.totalFlexWidth} 0 auto`
        : undefined,
      minWidth: `${column.totalMinWidth}px`,
      width: `${column.totalWidth}px`,
    },
  },
]

const getCellProps = (props, { cell }) => [
  props,
  {
    style: {
      boxSizing: 'border-box',
      flex: `${cell.column.totalFlexWidth} 0 auto`,
      minWidth: `${cell.column.totalMinWidth}px`,
      width: `${cell.column.totalWidth}px`,
    },
  },
]
