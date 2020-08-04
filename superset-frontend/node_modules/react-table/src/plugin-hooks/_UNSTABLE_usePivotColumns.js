/* istanbul ignore file */

import {
  actions,
  makePropGetter,
  ensurePluginOrder,
  useMountedLayoutEffect,
  useGetLatest,
} from '../publicUtils'

import { flattenColumns, getFirstDefined } from '../utils'

// Actions
actions.resetPivot = 'resetPivot'
actions.togglePivot = 'togglePivot'

export const _UNSTABLE_usePivotColumns = hooks => {
  hooks.getPivotToggleProps = [defaultGetPivotToggleProps]
  hooks.stateReducers.push(reducer)
  hooks.useInstanceAfterData.push(useInstanceAfterData)
  hooks.allColumns.push(allColumns)
  hooks.accessValue.push(accessValue)
  hooks.materializedColumns.push(materializedColumns)
  hooks.materializedColumnsDeps.push(materializedColumnsDeps)
  hooks.visibleColumns.push(visibleColumns)
  hooks.visibleColumnsDeps.push(visibleColumnsDeps)
  hooks.useInstance.push(useInstance)
  hooks.prepareRow.push(prepareRow)
}

_UNSTABLE_usePivotColumns.pluginName = 'usePivotColumns'

const defaultPivotColumns = []

const defaultGetPivotToggleProps = (props, { header }) => [
  props,
  {
    onClick: header.canPivot
      ? e => {
          e.persist()
          header.togglePivot()
        }
      : undefined,
    style: {
      cursor: header.canPivot ? 'pointer' : undefined,
    },
    title: 'Toggle Pivot',
  },
]

// Reducer
function reducer(state, action, previousState, instance) {
  if (action.type === actions.init) {
    return {
      pivotColumns: defaultPivotColumns,
      ...state,
    }
  }

  if (action.type === actions.resetPivot) {
    return {
      ...state,
      pivotColumns: instance.initialState.pivotColumns || defaultPivotColumns,
    }
  }

  if (action.type === actions.togglePivot) {
    const { columnId, value: setPivot } = action

    const resolvedPivot =
      typeof setPivot !== 'undefined'
        ? setPivot
        : !state.pivotColumns.includes(columnId)

    if (resolvedPivot) {
      return {
        ...state,
        pivotColumns: [...state.pivotColumns, columnId],
      }
    }

    return {
      ...state,
      pivotColumns: state.pivotColumns.filter(d => d !== columnId),
    }
  }
}

function useInstanceAfterData(instance) {
  instance.allColumns.forEach(column => {
    column.isPivotSource = instance.state.pivotColumns.includes(column.id)
  })
}

function allColumns(columns, { instance }) {
  columns.forEach(column => {
    column.isPivotSource = instance.state.pivotColumns.includes(column.id)
    column.uniqueValues = new Set()
  })
  return columns
}

function accessValue(value, { column }) {
  if (column.uniqueValues && typeof value !== 'undefined') {
    column.uniqueValues.add(value)
  }
  return value
}

function materializedColumns(materialized, { instance }) {
  const { allColumns, state } = instance

  if (!state.pivotColumns.length || !state.groupBy || !state.groupBy.length) {
    return materialized
  }

  const pivotColumns = state.pivotColumns
    .map(id => allColumns.find(d => d.id === id))
    .filter(Boolean)

  const sourceColumns = allColumns.filter(
    d =>
      !d.isPivotSource &&
      !state.groupBy.includes(d.id) &&
      !state.pivotColumns.includes(d.id)
  )

  const buildPivotColumns = (depth = 0, parent, pivotFilters = []) => {
    const pivotColumn = pivotColumns[depth]

    if (!pivotColumn) {
      return sourceColumns.map(sourceColumn => {
        // TODO: We could offer support here for renesting pivoted
        // columns inside copies of their header groups. For now,
        // that seems like it would be (1) overkill on nesting, considering
        // you already get nesting for every pivot level and (2)
        // really hard. :)

        return {
          ...sourceColumn,
          canPivot: false,
          isPivoted: true,
          parent,
          depth: depth,
          id: `${parent ? `${parent.id}.${sourceColumn.id}` : sourceColumn.id}`,
          accessor: (originalRow, i, row) => {
            if (pivotFilters.every(filter => filter(row))) {
              return row.values[sourceColumn.id]
            }
          },
        }
      })
    }

    const uniqueValues = Array.from(pivotColumn.uniqueValues).sort()

    return uniqueValues.map(uniqueValue => {
      const columnGroup = {
        ...pivotColumn,
        Header:
          pivotColumn.PivotHeader || typeof pivotColumn.header === 'string'
            ? `${pivotColumn.Header}: ${uniqueValue}`
            : uniqueValue,
        isPivotGroup: true,
        parent,
        depth,
        id: parent
          ? `${parent.id}.${pivotColumn.id}.${uniqueValue}`
          : `${pivotColumn.id}.${uniqueValue}`,
        pivotValue: uniqueValue,
      }

      columnGroup.columns = buildPivotColumns(depth + 1, columnGroup, [
        ...pivotFilters,
        row => row.values[pivotColumn.id] === uniqueValue,
      ])

      return columnGroup
    })
  }

  const newMaterialized = flattenColumns(buildPivotColumns())

  return [...materialized, ...newMaterialized]
}

function materializedColumnsDeps(
  deps,
  {
    instance: {
      state: { pivotColumns, groupBy },
    },
  }
) {
  return [...deps, pivotColumns, groupBy]
}

function visibleColumns(visibleColumns, { instance: { state } }) {
  visibleColumns = visibleColumns.filter(d => !d.isPivotSource)

  if (state.pivotColumns.length && state.groupBy && state.groupBy.length) {
    visibleColumns = visibleColumns.filter(
      column => column.isGrouped || column.isPivoted
    )
  }

  return visibleColumns
}

function visibleColumnsDeps(deps, { instance }) {
  return [...deps, instance.state.pivotColumns, instance.state.groupBy]
}

function useInstance(instance) {
  const {
    columns,
    allColumns,
    flatHeaders,
    // pivotFn = defaultPivotFn,
    // manualPivot,
    getHooks,
    plugins,
    dispatch,
    autoResetPivot = true,
    manaulPivot,
    disablePivot,
    defaultCanPivot,
  } = instance

  ensurePluginOrder(plugins, ['useGroupBy'], 'usePivotColumns')

  const getInstance = useGetLatest(instance)

  allColumns.forEach(column => {
    const {
      accessor,
      defaultPivot: defaultColumnPivot,
      disablePivot: columnDisablePivot,
    } = column

    column.canPivot = accessor
      ? getFirstDefined(
          column.canPivot,
          columnDisablePivot === true ? false : undefined,
          disablePivot === true ? false : undefined,
          true
        )
      : getFirstDefined(
          column.canPivot,
          defaultColumnPivot,
          defaultCanPivot,
          false
        )

    if (column.canPivot) {
      column.togglePivot = () => instance.togglePivot(column.id)
    }

    column.Aggregated = column.Aggregated || column.Cell
  })

  const togglePivot = (columnId, value) => {
    dispatch({ type: actions.togglePivot, columnId, value })
  }

  flatHeaders.forEach(header => {
    header.getPivotToggleProps = makePropGetter(
      getHooks().getPivotToggleProps,
      {
        instance: getInstance(),
        header,
      }
    )
  })

  const getAutoResetPivot = useGetLatest(autoResetPivot)

  useMountedLayoutEffect(() => {
    if (getAutoResetPivot()) {
      dispatch({ type: actions.resetPivot })
    }
  }, [dispatch, manaulPivot ? null : columns])

  Object.assign(instance, {
    togglePivot,
  })
}

function prepareRow(row) {
  row.allCells.forEach(cell => {
    // Grouped cells are in the pivotColumns and the pivot cell for the row
    cell.isPivoted = cell.column.isPivoted
  })
}
