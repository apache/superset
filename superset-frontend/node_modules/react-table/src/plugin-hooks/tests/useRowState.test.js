import React from 'react'
import { render, fireEvent } from '../../../test-utils/react-testing'
import { useTable } from '../../hooks/useTable'
import { useRowState } from '../useRowState'

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

const defaultColumn = {
  Cell: ({ column, cell, row }) => (
    <div>
      Row {row.id} Cell {column.id} Count {cell.state.count}{' '}
      <button
        onClick={() => cell.setState(old => ({ ...old, count: old.count + 1 }))}
      >
        Row {row.id} Cell {column.id} Toggle
      </button>
    </div>
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
      initialRowStateAccessor: () => ({ count: 0 }),
      initialCellStateAccessor: () => ({ count: 0 }),
    },
    useRowState
  )

  return (
    <table {...getTableProps()}>
      <thead>
        {headerGroups.map(headerGroup => (
          <tr {...headerGroup.getHeaderGroupProps()}>
            {headerGroup.headers.map(column => (
              <th {...column.getHeaderProps()}>{column.render('Header')}</th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody {...getTableBodyProps()}>
        {rows.map(
          (row, i) =>
            prepareRow(row) || (
              <tr {...row.getRowProps()}>
                <td>
                  <pre>Row Count {row.state.count}</pre>
                  <button
                    onClick={() =>
                      row.setState(old => ({
                        ...old,
                        count: old.count + 1,
                      }))
                    }
                  >
                    Row {row.id} Toggle
                  </button>
                </td>
                {row.cells.map(cell => (
                  <td {...cell.getCellProps()}>{cell.render('Cell')}</td>
                ))}
              </tr>
            )
        )}
      </tbody>
    </table>
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

test('renders a filterable table', () => {
  const rendered = render(<App />)

  fireEvent.click(rendered.getByText('Row 1 Toggle'))
  fireEvent.click(rendered.getByText('Row 1 Toggle'))

  rendered.getByText('Row Count 2')

  fireEvent.click(rendered.getByText('Row 1 Cell firstName Toggle'))

  rendered.getByText('Row 1 Cell firstName Count 1')

  fireEvent.click(rendered.getByText('Row 2 Cell lastName Toggle'))
  fireEvent.click(rendered.getByText('Row 2 Cell lastName Toggle'))

  rendered.getByText('Row 2 Cell lastName Count 2')

  fireEvent.click(rendered.getByText('Row 3 Cell age Toggle'))
  fireEvent.click(rendered.getByText('Row 3 Cell age Toggle'))
  fireEvent.click(rendered.getByText('Row 3 Cell age Toggle'))

  rendered.getByText('Row 3 Cell age Count 3')

  fireEvent.click(rendered.getByText('Row 1 Toggle'))
  fireEvent.click(rendered.getByText('Row 1 Toggle'))

  rendered.getByText('Row Count 4')
})
