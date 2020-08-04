const cellStyles = {
  display: 'inline-block',
  boxSizing: 'border-box',
}

const getRowStyles = (props, { instance }) => [
  props,
  {
    style: {
      display: 'flex',
      width: `${instance.totalColumnsWidth}px`,
    },
  },
]

export const useBlockLayout = hooks => {
  hooks.getRowProps.push(getRowStyles)
  hooks.getHeaderGroupProps.push(getRowStyles)

  hooks.getHeaderProps.push((props, { column }) => [
    props,
    {
      style: {
        ...cellStyles,
        width: `${column.totalWidth}px`,
      },
    },
  ])

  hooks.getCellProps.push((props, { cell }) => [
    props,
    {
      style: {
        ...cellStyles,
        width: `${cell.column.totalWidth}px`,
      },
    },
  ])
}

useBlockLayout.pluginName = 'useBlockLayout'
