import React from 'react'

import {
  getFilterMethod,
  shouldAutoRemoveFilter,
  getFirstDefined,
} from '../utils'

import {
  actions,
  useMountedLayoutEffect,
  functionalUpdate,
  useGetLatest,
} from '../publicUtils'

import * as filterTypes from '../filterTypes'

// Actions
actions.resetGlobalFilter = 'resetGlobalFilter'
actions.setGlobalFilter = 'setGlobalFilter'

export const useGlobalFilter = hooks => {
  hooks.stateReducers.push(reducer)
  hooks.useInstance.push(useInstance)
}

useGlobalFilter.pluginName = 'useGlobalFilter'

function reducer(state, action, previousState, instance) {
  if (action.type === actions.resetGlobalFilter) {
    return {
      ...state,
      globalFilter: instance.initialState.globalFilter || undefined,
    }
  }

  if (action.type === actions.setGlobalFilter) {
    const { filterValue } = action
    const { userFilterTypes } = instance

    const filterMethod = getFilterMethod(
      instance.globalFilter,
      userFilterTypes || {},
      filterTypes
    )

    const newFilter = functionalUpdate(filterValue, state.globalFilter)

    //
    if (shouldAutoRemoveFilter(filterMethod.autoRemove, newFilter)) {
      const { globalFilter, ...stateWithoutGlobalFilter } = state
      return stateWithoutGlobalFilter
    }

    return {
      ...state,
      globalFilter: newFilter,
    }
  }
}

function useInstance(instance) {
  const {
    data,
    rows,
    flatRows,
    rowsById,
    allColumns,
    filterTypes: userFilterTypes,
    globalFilter,
    manualGlobalFilter,
    state: { globalFilter: globalFilterValue },
    dispatch,
    autoResetGlobalFilter = true,
    disableGlobalFilter,
  } = instance

  const setGlobalFilter = React.useCallback(
    filterValue => {
      dispatch({ type: actions.setGlobalFilter, filterValue })
    },
    [dispatch]
  )

  // TODO: Create a filter cache for incremental high speed multi-filtering
  // This gets pretty complicated pretty fast, since you have to maintain a
  // cache for each row group (top-level rows, and each row's recursive subrows)
  // This would make multi-filtering a lot faster though. Too far?

  const [
    globalFilteredRows,
    globalFilteredFlatRows,
    globalFilteredRowsById,
  ] = React.useMemo(() => {
    if (manualGlobalFilter || typeof globalFilterValue === 'undefined') {
      return [rows, flatRows, rowsById]
    }

    const filteredFlatRows = []
    const filteredRowsById = {}

    const filterMethod = getFilterMethod(
      globalFilter,
      userFilterTypes || {},
      filterTypes
    )

    if (!filterMethod) {
      console.warn(`Could not find a valid 'globalFilter' option.`)
      return rows
    }

    allColumns.forEach(column => {
      const { disableGlobalFilter: columnDisableGlobalFilter } = column

      column.canFilter = getFirstDefined(
        columnDisableGlobalFilter === true ? false : undefined,
        disableGlobalFilter === true ? false : undefined,
        true
      )
    })

    const filterableColumns = allColumns.filter(c => c.canFilter === true)

    // Filters top level and nested rows
    const filterRows = filteredRows => {
      filteredRows = filterMethod(
        filteredRows,
        filterableColumns.map(d => d.id),
        globalFilterValue
      )

      filteredRows.forEach(row => {
        filteredFlatRows.push(row)
        filteredRowsById[row.id] = row

        row.subRows =
          row.subRows && row.subRows.length
            ? filterRows(row.subRows)
            : row.subRows
      })

      return filteredRows
    }

    return [filterRows(rows), filteredFlatRows, filteredRowsById]
  }, [
    manualGlobalFilter,
    globalFilterValue,
    globalFilter,
    userFilterTypes,
    allColumns,
    rows,
    flatRows,
    rowsById,
    disableGlobalFilter,
  ])

  const getAutoResetGlobalFilter = useGetLatest(autoResetGlobalFilter)

  useMountedLayoutEffect(() => {
    if (getAutoResetGlobalFilter()) {
      dispatch({ type: actions.resetGlobalFilter })
    }
  }, [dispatch, manualGlobalFilter ? null : data])

  Object.assign(instance, {
    preGlobalFilteredRows: rows,
    preGlobalFilteredFlatRows: flatRows,
    preGlobalFilteredRowsById: rowsById,
    globalFilteredRows,
    globalFilteredFlatRows,
    globalFilteredRowsById,
    rows: globalFilteredRows,
    flatRows: globalFilteredFlatRows,
    rowsById: globalFilteredRowsById,
    setGlobalFilter,
    disableGlobalFilter,
  })
}
