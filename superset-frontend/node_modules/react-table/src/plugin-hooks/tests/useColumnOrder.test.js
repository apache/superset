import React from 'react'
import { render, fireEvent } from '@testing-library/react'
import { useTable } from '../../hooks/useTable'
import { useColumnOrder } from '../useColumnOrder'

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
    firstName: 'jaylen',
    lastName: 'linsley',
    age: 26,
    visits: 99,
    status: 'In Relationship',
    progress: 70,
  },
]

function shuffle(arr, mapping) {
  if (arr.length !== mapping.length) {
    throw new Error()
  }
  arr = [...arr]
  mapping = [...mapping]
  const shuffled = []
  while (arr.length) {
    shuffled.push(arr.splice([mapping.shift()], 1)[0])
  }
  return shuffled
}

function Table({ columns, data }) {
  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    rows,
    visibleColumns,
    prepareRow,
    setColumnOrder,
    state,
  } = useTable(
    {
      columns,
      data,
    },
    useColumnOrder
  )

  const testColumnOrder = () => {
    setColumnOrder(
      shuffle(
        visibleColumns.map(d => d.id),
        [1, 4, 2, 0, 3, 5]
      )
    )
  }

  return (
    <>
      <button onClick={() => testColumnOrder({})}>Randomize Columns</button>
      <table {...getTableProps()}>
        <thead>
          {headerGroups.map((headerGroup, i) => (
            <tr {...headerGroup.getHeaderGroupProps()}>
              {headerGroup.headers.map(column => (
                <th {...column.getHeaderProps()}>{column.render('Header')}</th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody {...getTableBodyProps()}>
          {rows.slice(0, 10).map((row, i) => {
            prepareRow(row)
            return (
              <tr {...row.getRowProps()}>
                {row.cells.map((cell, i) => {
                  return <td {...cell.getCellProps()}>{cell.render('Cell')}</td>
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
      <pre>
        <code>{JSON.stringify(state, null, 2)}</code>
      </pre>
    </>
  )
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
          },
          {
            Header: 'Last Name',
            accessor: 'lastName',
          },
        ],
      },
      {
        Header: 'Info',
        columns: [
          {
            Header: 'Age',
            accessor: 'age',
          },
          {
            Header: 'Visits',
            accessor: 'visits',
          },
          {
            Header: 'Status',
            accessor: 'status',
          },
          {
            Header: 'Profile Progress',
            accessor: 'progress',
          },
        ],
      },
    ],
    []
  )

  return <Table columns={columns} data={data} />
}

test('renders a column-orderable table', () => {
  const rtl = render(<App />)

  expect(rtl.getAllByRole('columnheader').map(d => d.textContent)).toEqual([
    'Name',
    'Info',
    'First Name',
    'Last Name',
    'Age',
    'Visits',
    'Status',
    'Profile Progress',
  ])

  fireEvent.click(rtl.getByText('Randomize Columns'))

  expect(rtl.getAllByRole('columnheader').map(d => d.textContent)).toEqual([
    'Name',
    'Info',
    'Name',
    'Info',
    'Last Name',
    'Profile Progress',
    'Visits',
    'First Name',
    'Age',
    'Status',
  ])
})
