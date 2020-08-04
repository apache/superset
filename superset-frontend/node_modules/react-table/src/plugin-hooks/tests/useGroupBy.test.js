import React from 'react'
import { render, fireEvent } from '../../../test-utils/react-testing'
import { useTable } from '../../hooks/useTable'
import { useGroupBy } from '../useGroupBy'
import { useExpanded } from '../useExpanded'

const data = [
  {
    firstName: 'tanner',
    lastName: 'linsley',
    age: 29,
    visits: 100,
    status: 'In Relationship',
    progress: 50,
  },
  {
    firstName: 'derek',
    lastName: 'perkins',
    age: 40,
    visits: 40,
    status: 'Single',
    progress: 80,
  },
  {
    firstName: 'joe',
    lastName: 'bergevin',
    age: 45,
    visits: 20,
    status: 'Complicated',
    progress: 10,
  },
  {
    firstName: 'joe',
    lastName: 'dirt',
    age: 20,
    visits: 5,
    status: 'Complicated',
    progress: 97,
  },
  {
    firstName: 'jaylen',
    lastName: 'linsley',
    age: 26,
    visits: 99,
    status: 'In Relationship',
    progress: 70,
  },
]

const defaultColumn = {
  Cell: ({ value, column: { id } }) => `${id}: ${value}`,
  Filter: ({ filterValue, setFilter }) => (
    <input
      value={filterValue || ''}
      onChange={e => {
        setFilter(e.target.value || undefined) // Set undefined to remove the filter entirely
      }}
      placeholder="Search..."
    />
  ),
}

function Table({ columns, data }) {
  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    rows,
    prepareRow,
  } = useTable(
    {
      columns,
      data,
      defaultColumn,
      initialState: {
        groupBy: ["Column Doesn't Exist"],
      },
    },
    useGroupBy,
    useExpanded
  )

  return (
    <table {...getTableProps()}>
      <thead>
        {headerGroups.map(headerGroup => (
          <tr {...headerGroup.getHeaderGroupProps()}>
            {headerGroup.headers.map(column => (
              <th {...column.getHeaderProps()}>
                {column.canGroupBy ? (
                  // If the column can be grouped, let's add a toggle
                  <span {...column.getGroupByToggleProps()}>
                    {column.isGrouped ? 'Ungroup' : 'Group'} {column.id}
                  </span>
                ) : null}
                {column.render('Header')}
              </th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody {...getTableBodyProps()}>
        {rows.map(
          (row, i) =>
            prepareRow(row) || (
              <tr {...row.getRowProps()}>
                {row.cells.map(cell => {
                  return (
                    <td {...cell.getCellProps()}>
                      {cell.isGrouped ? (
                        <>
                          <span
                            style={{
                              cursor: 'pointer',
                            }}
                            onClick={() => row.toggleRowExpanded()}
                          >
                            {row.isExpanded ? '👇' : '👉'}
                          </span>
                          {cell.render('Cell')} ({row.subRows.length})
                        </>
                      ) : cell.isAggregated ? (
                        cell.render('Aggregated')
                      ) : cell.isPlaceholder ? null : (
                        cell.render('Cell')
                      )}
                    </td>
                  )
                })}
              </tr>
            )
        )}
      </tbody>
    </table>
  )
}

// This is a custom aggregator that
// takes in an array of leaf values and
// returns the rounded median
function roundedMedian(leafValues) {
  let min = leafValues[0] || 0
  let max = leafValues[0] || 0

  leafValues.forEach(value => {
    min = Math.min(min, value)
    max = Math.max(max, value)
  })

  return Math.round((min + max) / 2)
}

function App() {
  const columns = React.useMemo(
    () => [
      {
        Header: 'Name',
        columns: [
          {
            Header: 'First Name',
            accessor: 'firstName',
            aggregate: 'count',
            Aggregated: ({ value }) =>
              `First Name Aggregated: ${value} Names`,
          },
          {
            Header: 'Last Name',
            accessor: 'lastName',
            aggregate: 'uniqueCount',
            Aggregated: ({ value }) =>
              `Last Name Aggregated: ${value} Unique Names`,
          },
        ],
      },
      {
        Header: 'Info',
        columns: [
          {
            Header: 'Age',
            accessor: 'age',
            aggregate: 'average',
            Aggregated: ({ value }) =>
              `Age Aggregated: ${value} (avg)`,
          },
          {
            Header: 'Visits',
            accessor: 'visits',
            aggregate: 'sum',
            Aggregated: ({ value }) =>
              `Visits Aggregated: ${value} (total)`,
          },
          {
            Header: 'Min Visits',
            id: 'minVisits',
            accessor: 'visits',
            aggregate: 'min',
            Aggregated: ({ value }) =>
              `Visits Aggregated: ${value} (min)`,
          },
          {
            Header: 'Max Visits',
            id: 'maxVisits',
            accessor: 'visits',
            aggregate: 'max',
            Aggregated: ({ value }) =>
              `Visits Aggregated: ${value} (max)`,
          },
          {
            Header: 'Min/Max Visits',
            id: 'minMaxVisits',
            accessor: 'visits',
            aggregate: 'minMax',
            Aggregated: ({ value }) =>
              `Visits Aggregated: ${value} (minMax)`,
          },
          {
            Header: 'Status',
            accessor: 'status',
            aggregate: 'unique',
            Aggregated: ({ value }) =>
              `Visits Aggregated: ${value.join(', ')} (unique)`,
          },
          {
            Header: 'Profile Progress (Median)',
            accessor: 'progress',
            id: 'progress',
            aggregate: 'median',
            Aggregated: ({ value }) =>
              `Process Aggregated: ${value} (median)`,
          },
          {
            Header: 'Profile Progress (Rounded Median)',
            accessor: 'progress',
            id: 'progressRounded',
            aggregate: roundedMedian,
            Aggregated: ({ value }) =>
              `Process Aggregated: ${value} (rounded median)`,
          },
        ],
      },
    ],
    []
  )

  return <Table columns={columns} data={data} />
}

test('renders a groupable table', () => {
  const rendered = render(<App />)

  fireEvent.click(rendered.getByText('Group lastName'))

  rendered.getByText('lastName: linsley (2)')

  fireEvent.click(rendered.getByText('Group visits'))

  fireEvent.click(rendered.getByText('Ungroup lastName'))

  rendered.getByText('visits: 100 (1)')

  fireEvent.click(rendered.getByText('Ungroup visits'))

  fireEvent.click(rendered.getByText('Group firstName'))

  rendered.getByText('firstName: tanner (1)')

  rendered.debugDiff(false)
  fireEvent.click(rendered.getByText('Group age'))

  rendered.getByText('Last Name Aggregated: 2 Unique Names')
})
