import React from 'react'

import {
  actions,
  functionalUpdate,
  useMountedLayoutEffect,
  useGetLatest,
} from '../publicUtils'

const defaultInitialRowStateAccessor = originalRow => ({})
const defaultInitialCellStateAccessor = originalRow => ({})

// Actions
actions.setRowState = 'setRowState'
actions.setCellState = 'setCellState'
actions.resetRowState = 'resetRowState'

export const useRowState = hooks => {
  hooks.stateReducers.push(reducer)
  hooks.useInstance.push(useInstance)
  hooks.prepareRow.push(prepareRow)
}

useRowState.pluginName = 'useRowState'

function reducer(state, action, previousState, instance) {
  const {
    initialRowStateAccessor = defaultInitialRowStateAccessor,
    initialCellStateAccessor = defaultInitialCellStateAccessor,
    rowsById,
  } = instance

  if (action.type === actions.init) {
    return {
      rowState: {},
      ...state,
    }
  }

  if (action.type === actions.resetRowState) {
    return {
      ...state,
      rowState: instance.initialState.rowState || {},
    }
  }

  if (action.type === actions.setRowState) {
    const { rowId, value } = action

    const oldRowState =
      typeof state.rowState[rowId] !== 'undefined'
        ? state.rowState[rowId]
        : initialRowStateAccessor(rowsById[rowId].original)

    return {
      ...state,
      rowState: {
        ...state.rowState,
        [rowId]: functionalUpdate(value, oldRowState),
      },
    }
  }

  if (action.type === actions.setCellState) {
    const { rowId, columnId, value } = action

    const oldRowState =
      typeof state.rowState[rowId] !== 'undefined'
        ? state.rowState[rowId]
        : initialRowStateAccessor(rowsById[rowId].original)

    const oldCellState =
      typeof oldRowState?.cellState?.[columnId] !== 'undefined'
        ? oldRowState.cellState[columnId]
        : initialCellStateAccessor(rowsById[rowId].original)

    return {
      ...state,
      rowState: {
        ...state.rowState,
        [rowId]: {
          ...oldRowState,
          cellState: {
            ...(oldRowState.cellState || {}),
            [columnId]: functionalUpdate(value, oldCellState),
          },
        },
      },
    }
  }
}

function useInstance(instance) {
  const { autoResetRowState = true, data, dispatch } = instance

  const setRowState = React.useCallback(
    (rowId, value) =>
      dispatch({
        type: actions.setRowState,
        rowId,
        value,
      }),
    [dispatch]
  )

  const setCellState = React.useCallback(
    (rowId, columnId, value) =>
      dispatch({
        type: actions.setCellState,
        rowId,
        columnId,
        value,
      }),
    [dispatch]
  )

  const getAutoResetRowState = useGetLatest(autoResetRowState)

  useMountedLayoutEffect(() => {
    if (getAutoResetRowState()) {
      dispatch({ type: actions.resetRowState })
    }
  }, [data])

  Object.assign(instance, {
    setRowState,
    setCellState,
  })
}

function prepareRow(row, { instance }) {
  const {
    initialRowStateAccessor = defaultInitialRowStateAccessor,
    initialCellStateAccessor = defaultInitialCellStateAccessor,
    state: { rowState },
  } = instance

  if (row.original) {
    row.state =
      typeof rowState[row.id] !== 'undefined'
        ? rowState[row.id]
        : initialRowStateAccessor(row.original)

    row.setState = updater => {
      return instance.setRowState(row.id, updater)
    }

    row.cells.forEach(cell => {
      if (!row.state.cellState) {
        row.state.cellState = {}
      }

      cell.state =
        typeof row.state.cellState[cell.column.id] !== 'undefined'
          ? row.state.cellState[cell.column.id]
          : initialCellStateAccessor(row.original)

      cell.setState = updater => {
        return instance.setCellState(row.id, cell.column.id, updater)
      }
    })
  }
}
