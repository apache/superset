const cellStyles = {
  position: 'absolute',
  top: 0,
}

export const useAbsoluteLayout = hooks => {
  hooks.getTableBodyProps.push(getRowStyles)
  hooks.getRowProps.push(getRowStyles)
  hooks.getHeaderGroupProps.push(getRowStyles)

  hooks.getHeaderProps.push((props, { column }) => [
    props,
    {
      style: {
        ...cellStyles,
        left: `${column.totalLeft}px`,
        width: `${column.totalWidth}px`,
      },
    },
  ])

  hooks.getCellProps.push((props, { cell }) => [
    props,
    {
      style: {
        ...cellStyles,
        left: `${cell.column.totalLeft}px`,
        width: `${cell.column.totalWidth}px`,
      },
    },
  ])
}

useAbsoluteLayout.pluginName = 'useAbsoluteLayout'

const getRowStyles = (props, { instance }) => [
  props,
  {
    style: {
      position: 'relative',
      width: `${instance.totalColumnsWidth}px`,
    },
  },
]
