import React from 'react'

import {
  actions,
  functionalUpdate,
  useGetLatest,
  makePropGetter,
  useMountedLayoutEffect,
} from '../publicUtils'

actions.resetHiddenColumns = 'resetHiddenColumns'
actions.toggleHideColumn = 'toggleHideColumn'
actions.setHiddenColumns = 'setHiddenColumns'
actions.toggleHideAllColumns = 'toggleHideAllColumns'

export const useColumnVisibility = hooks => {
  hooks.getToggleHiddenProps = [defaultGetToggleHiddenProps]
  hooks.getToggleHideAllColumnsProps = [defaultGetToggleHideAllColumnsProps]

  hooks.stateReducers.push(reducer)
  hooks.useInstanceBeforeDimensions.push(useInstanceBeforeDimensions)
  hooks.headerGroupsDeps.push((deps, { instance }) => [
    ...deps,
    instance.state.hiddenColumns,
  ])
  hooks.useInstance.push(useInstance)
}

useColumnVisibility.pluginName = 'useColumnVisibility'

const defaultGetToggleHiddenProps = (props, { column }) => [
  props,
  {
    onChange: e => {
      column.toggleHidden(!e.target.checked)
    },
    style: {
      cursor: 'pointer',
    },
    checked: column.isVisible,
    title: 'Toggle Column Visible',
  },
]

const defaultGetToggleHideAllColumnsProps = (props, { instance }) => [
  props,
  {
    onChange: e => {
      instance.toggleHideAllColumns(!e.target.checked)
    },
    style: {
      cursor: 'pointer',
    },
    checked: !instance.allColumnsHidden && !instance.state.hiddenColumns.length,
    title: 'Toggle All Columns Hidden',
    indeterminate:
      !instance.allColumnsHidden && instance.state.hiddenColumns.length,
  },
]

function reducer(state, action, previousState, instance) {
  if (action.type === actions.init) {
    return {
      hiddenColumns: [],
      ...state,
    }
  }

  if (action.type === actions.resetHiddenColumns) {
    return {
      ...state,
      hiddenColumns: instance.initialState.hiddenColumns || [],
    }
  }

  if (action.type === actions.toggleHideColumn) {
    const should =
      typeof action.value !== 'undefined'
        ? action.value
        : !state.hiddenColumns.includes(action.columnId)

    const hiddenColumns = should
      ? [...state.hiddenColumns, action.columnId]
      : state.hiddenColumns.filter(d => d !== action.columnId)

    return {
      ...state,
      hiddenColumns,
    }
  }

  if (action.type === actions.setHiddenColumns) {
    return {
      ...state,
      hiddenColumns: functionalUpdate(action.value, state.hiddenColumns),
    }
  }

  if (action.type === actions.toggleHideAllColumns) {
    const shouldAll =
      typeof action.value !== 'undefined'
        ? action.value
        : !state.hiddenColumns.length

    return {
      ...state,
      hiddenColumns: shouldAll ? instance.allColumns.map(d => d.id) : [],
    }
  }
}

function useInstanceBeforeDimensions(instance) {
  const {
    headers,
    state: { hiddenColumns },
  } = instance

  const isMountedRef = React.useRef(false)

  if (!isMountedRef.current) {
  }

  const handleColumn = (column, parentVisible) => {
    column.isVisible = parentVisible && !hiddenColumns.includes(column.id)

    let totalVisibleHeaderCount = 0

    if (column.headers && column.headers.length) {
      column.headers.forEach(
        subColumn =>
          (totalVisibleHeaderCount += handleColumn(subColumn, column.isVisible))
      )
    } else {
      totalVisibleHeaderCount = column.isVisible ? 1 : 0
    }

    column.totalVisibleHeaderCount = totalVisibleHeaderCount

    return totalVisibleHeaderCount
  }

  let totalVisibleHeaderCount = 0

  headers.forEach(
    subHeader => (totalVisibleHeaderCount += handleColumn(subHeader, true))
  )
}

function useInstance(instance) {
  const {
    columns,
    flatHeaders,
    dispatch,
    allColumns,
    getHooks,
    state: { hiddenColumns },
    autoResetHiddenColumns = true,
  } = instance

  const getInstance = useGetLatest(instance)

  const allColumnsHidden = allColumns.length === hiddenColumns.length

  const toggleHideColumn = React.useCallback(
    (columnId, value) =>
      dispatch({ type: actions.toggleHideColumn, columnId, value }),
    [dispatch]
  )

  const setHiddenColumns = React.useCallback(
    value => dispatch({ type: actions.setHiddenColumns, value }),
    [dispatch]
  )

  const toggleHideAllColumns = React.useCallback(
    value => dispatch({ type: actions.toggleHideAllColumns, value }),
    [dispatch]
  )

  const getToggleHideAllColumnsProps = makePropGetter(
    getHooks().getToggleHideAllColumnsProps,
    { instance: getInstance() }
  )

  flatHeaders.forEach(column => {
    column.toggleHidden = value => {
      dispatch({
        type: actions.toggleHideColumn,
        columnId: column.id,
        value,
      })
    }

    column.getToggleHiddenProps = makePropGetter(
      getHooks().getToggleHiddenProps,
      {
        instance: getInstance(),
        column,
      }
    )
  })

  const getAutoResetHiddenColumns = useGetLatest(autoResetHiddenColumns)

  useMountedLayoutEffect(() => {
    if (getAutoResetHiddenColumns()) {
      dispatch({ type: actions.resetHiddenColumns })
    }
  }, [dispatch, columns])

  Object.assign(instance, {
    allColumnsHidden,
    toggleHideColumn,
    setHiddenColumns,
    toggleHideAllColumns,
    getToggleHideAllColumnsProps,
  })
}
