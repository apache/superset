import React from 'react'

import * as aggregations from '../aggregations'

import { getFirstDefined, flattenBy } from '../utils'

import {
  actions,
  makePropGetter,
  ensurePluginOrder,
  useMountedLayoutEffect,
  useGetLatest,
} from '../publicUtils'

const emptyArray = []
const emptyObject = {}

// Actions
actions.resetGroupBy = 'resetGroupBy'
actions.toggleGroupBy = 'toggleGroupBy'

export const useGroupBy = hooks => {
  hooks.getGroupByToggleProps = [defaultGetGroupByToggleProps]
  hooks.stateReducers.push(reducer)
  hooks.visibleColumnsDeps.push((deps, { instance }) => [
    ...deps,
    instance.state.groupBy,
  ])
  hooks.visibleColumns.push(visibleColumns)
  hooks.useInstance.push(useInstance)
  hooks.prepareRow.push(prepareRow)
}

useGroupBy.pluginName = 'useGroupBy'

const defaultGetGroupByToggleProps = (props, { header }) => [
  props,
  {
    onClick: header.canGroupBy
      ? e => {
          e.persist()
          header.toggleGroupBy()
        }
      : undefined,
    style: {
      cursor: header.canGroupBy ? 'pointer' : undefined,
    },
    title: 'Toggle GroupBy',
  },
]

// Reducer
function reducer(state, action, previousState, instance) {
  if (action.type === actions.init) {
    return {
      groupBy: [],
      ...state,
    }
  }

  if (action.type === actions.resetGroupBy) {
    return {
      ...state,
      groupBy: instance.initialState.groupBy || [],
    }
  }

  if (action.type === actions.toggleGroupBy) {
    const { columnId, value: setGroupBy } = action

    const resolvedGroupBy =
      typeof setGroupBy !== 'undefined'
        ? setGroupBy
        : !state.groupBy.includes(columnId)

    if (resolvedGroupBy) {
      return {
        ...state,
        groupBy: [...state.groupBy, columnId],
      }
    }

    return {
      ...state,
      groupBy: state.groupBy.filter(d => d !== columnId),
    }
  }
}

function visibleColumns(
  columns,
  {
    instance: {
      state: { groupBy },
    },
  }
) {
  // Sort grouped columns to the start of the column list
  // before the headers are built

  const groupByColumns = groupBy
    .map(g => columns.find(col => col.id === g))
    .filter(Boolean)

  const nonGroupByColumns = columns.filter(col => !groupBy.includes(col.id))

  columns = [...groupByColumns, ...nonGroupByColumns]

  columns.forEach(column => {
    column.isGrouped = groupBy.includes(column.id)
    column.groupedIndex = groupBy.indexOf(column.id)
  })

  return columns
}

const defaultUserAggregations = {}

function useInstance(instance) {
  const {
    data,
    rows,
    flatRows,
    rowsById,
    allColumns,
    flatHeaders,
    groupByFn = defaultGroupByFn,
    manualGroupBy,
    aggregations: userAggregations = defaultUserAggregations,
    plugins,
    state: { groupBy },
    dispatch,
    autoResetGroupBy = true,
    disableGroupBy,
    defaultCanGroupBy,
    getHooks,
  } = instance

  ensurePluginOrder(plugins, ['useFilters'], 'useGroupBy')

  const getInstance = useGetLatest(instance)

  allColumns.forEach(column => {
    const {
      accessor,
      defaultGroupBy: defaultColumnGroupBy,
      disableGroupBy: columnDisableGroupBy,
    } = column

    column.canGroupBy = accessor
      ? getFirstDefined(
          column.canGroupBy,
          columnDisableGroupBy === true ? false : undefined,
          disableGroupBy === true ? false : undefined,
          true
        )
      : getFirstDefined(
          column.canGroupBy,
          defaultColumnGroupBy,
          defaultCanGroupBy,
          false
        )

    if (column.canGroupBy) {
      column.toggleGroupBy = () => instance.toggleGroupBy(column.id)
    }

    column.Aggregated = column.Aggregated || column.Cell
  })

  const toggleGroupBy = React.useCallback(
    (columnId, value) => {
      dispatch({ type: actions.toggleGroupBy, columnId, value })
    },
    [dispatch]
  )

  flatHeaders.forEach(header => {
    header.getGroupByToggleProps = makePropGetter(
      getHooks().getGroupByToggleProps,
      { instance: getInstance(), header }
    )
  })

  const [
    groupedRows,
    groupedFlatRows,
    groupedRowsById,
    onlyGroupedFlatRows,
    onlyGroupedRowsById,
    nonGroupedFlatRows,
    nonGroupedRowsById,
  ] = React.useMemo(() => {
    if (manualGroupBy || !groupBy.length) {
      return [
        rows,
        flatRows,
        rowsById,
        emptyArray,
        emptyObject,
        flatRows,
        rowsById,
      ]
    }

    // Ensure that the list of filtered columns exist
    const existingGroupBy = groupBy.filter(g =>
      allColumns.find(col => col.id === g)
    )

    // Find the columns that can or are aggregating
    // Uses each column to aggregate rows into a single value
    const aggregateRowsToValues = (leafRows, groupedRows, depth) => {
      const values = {}

      allColumns.forEach(column => {
        // Don't aggregate columns that are in the groupBy
        if (existingGroupBy.includes(column.id)) {
          values[column.id] = groupedRows[0]
            ? groupedRows[0].values[column.id]
            : null
          return
        }

        // Get the columnValues to aggregate
        const groupedValues = groupedRows.map(row => row.values[column.id])

        // Get the columnValues to aggregate
        const leafValues = leafRows.map(row => {
          let columnValue = row.values[column.id]

          if (!depth && column.aggregatedValue) {
            const aggregateValueFn =
              typeof column.aggregateValue === 'function'
                ? column.aggregateValue
                : userAggregations[column.aggregateValue] ||
                  aggregations[column.aggregateValue]

            if (!aggregateValueFn) {
              console.info({ column })
              throw new Error(
                `React Table: Invalid column.aggregateValue option for column listed above`
              )
            }

            columnValue = aggregateValueFn(columnValue, row, column)
          }
          return columnValue
        })

        // Aggregate the values
        let aggregateFn =
          typeof column.aggregate === 'function'
            ? column.aggregate
            : userAggregations[column.aggregate] ||
              aggregations[column.aggregate]

        if (aggregateFn) {
          values[column.id] = aggregateFn(leafValues, groupedValues)
        } else if (column.aggregate) {
          console.info({ column })
          throw new Error(
            `React Table: Invalid column.aggregate option for column listed above`
          )
        } else {
          values[column.id] = null
        }
      })

      return values
    }

    let groupedFlatRows = []
    const groupedRowsById = {}
    const onlyGroupedFlatRows = []
    const onlyGroupedRowsById = {}
    const nonGroupedFlatRows = []
    const nonGroupedRowsById = {}

    // Recursively group the data
    const groupUpRecursively = (rows, depth = 0, parentId) => {
      // This is the last level, just return the rows
      if (depth === existingGroupBy.length) {
        return rows
      }

      const columnId = existingGroupBy[depth]

      // Group the rows together for this level
      let rowGroupsMap = groupByFn(rows, columnId)

      // Peform aggregations for each group
      const aggregatedGroupedRows = Object.entries(rowGroupsMap).map(
        ([groupByVal, groupedRows], index) => {
          let id = `${columnId}:${groupByVal}`
          id = parentId ? `${parentId}>${id}` : id

          // First, Recurse to group sub rows before aggregation
          const subRows = groupUpRecursively(groupedRows, depth + 1, id)

          // Flatten the leaf rows of the rows in this group
          const leafRows = depth
            ? flattenBy(groupedRows, 'leafRows')
            : groupedRows

          const values = aggregateRowsToValues(leafRows, groupedRows, depth)

          const row = {
            id,
            isGrouped: true,
            groupByID: columnId,
            groupByVal,
            values,
            subRows,
            leafRows,
            depth,
            index,
          }

          subRows.forEach(subRow => {
            groupedFlatRows.push(subRow)
            groupedRowsById[subRow.id] = subRow
            if (subRow.isGrouped) {
              onlyGroupedFlatRows.push(subRow)
              onlyGroupedRowsById[subRow.id] = subRow
            } else {
              nonGroupedFlatRows.push(subRow)
              nonGroupedRowsById[subRow.id] = subRow
            }
          })

          return row
        }
      )

      return aggregatedGroupedRows
    }

    const groupedRows = groupUpRecursively(rows)

    groupedRows.forEach(subRow => {
      groupedFlatRows.push(subRow)
      groupedRowsById[subRow.id] = subRow
      if (subRow.isGrouped) {
        onlyGroupedFlatRows.push(subRow)
        onlyGroupedRowsById[subRow.id] = subRow
      } else {
        nonGroupedFlatRows.push(subRow)
        nonGroupedRowsById[subRow.id] = subRow
      }
    })

    // Assign the new data
    return [
      groupedRows,
      groupedFlatRows,
      groupedRowsById,
      onlyGroupedFlatRows,
      onlyGroupedRowsById,
      nonGroupedFlatRows,
      nonGroupedRowsById,
    ]
  }, [
    manualGroupBy,
    groupBy,
    rows,
    flatRows,
    rowsById,
    allColumns,
    userAggregations,
    groupByFn,
  ])

  const getAutoResetGroupBy = useGetLatest(autoResetGroupBy)

  useMountedLayoutEffect(() => {
    if (getAutoResetGroupBy()) {
      dispatch({ type: actions.resetGroupBy })
    }
  }, [dispatch, manualGroupBy ? null : data])

  Object.assign(instance, {
    preGroupedRows: rows,
    preGroupedFlatRow: flatRows,
    preGroupedRowsById: rowsById,
    groupedRows,
    groupedFlatRows,
    groupedRowsById,
    onlyGroupedFlatRows,
    onlyGroupedRowsById,
    nonGroupedFlatRows,
    nonGroupedRowsById,
    rows: groupedRows,
    flatRows: groupedFlatRows,
    rowsById: groupedRowsById,
    toggleGroupBy,
  })
}

function prepareRow(row) {
  row.allCells.forEach(cell => {
    // Grouped cells are in the groupBy and the pivot cell for the row
    cell.isGrouped = cell.column.isGrouped && cell.column.id === row.groupByID
    // Placeholder cells are any columns in the groupBy that are not grouped
    cell.isPlaceholder = !cell.isGrouped && cell.column.isGrouped
    // Aggregated cells are not grouped, not repeated, but still have subRows
    cell.isAggregated = !cell.isGrouped && !cell.isPlaceholder && row.canExpand
  })
}

export function defaultGroupByFn(rows, columnId) {
  return rows.reduce((prev, row, i) => {
    // TODO: Might want to implement a key serializer here so
    // irregular column values can still be grouped if needed?
    const resKey = `${row.values[columnId]}`
    prev[resKey] = Array.isArray(prev[resKey]) ? prev[resKey] : []
    prev[resKey].push(row)
    return prev
  }, {})
}
