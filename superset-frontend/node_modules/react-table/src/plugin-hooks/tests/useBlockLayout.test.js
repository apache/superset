import React from 'react'
import { render } from '@testing-library/react'
import { useTable } from '../../hooks/useTable'
import { useBlockLayout } from '../useBlockLayout'

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
    age: 30,
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
]

const defaultColumn = {
  Cell: ({ value, column: { id } }) => `${id}: ${value}`,
  width: 200,
  minWidth: 100,
  maxWidth: 300,
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
    },
    useBlockLayout
  )

  return (
    <div {...getTableProps()} className="table">
      <div>
        {headerGroups.map(headerGroup => (
          <div {...headerGroup.getHeaderGroupProps()} className="row">
            {headerGroup.headers.map(column => (
              <div {...column.getHeaderProps()} className="cell header">
                {column.render('Header')}
              </div>
            ))}
          </div>
        ))}
      </div>

      <div {...getTableBodyProps()}>
        {rows.map(
          (row, i) =>
            prepareRow(row) || (
              <div {...row.getRowProps()} className="row">
                {row.cells.map(cell => {
                  return (
                    <div {...cell.getCellProps()} className="cell">
                      {cell.render('Cell')}
                    </div>
                  )
                })}
              </div>
            )
        )}
      </div>
    </div>
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
            width: 250,
          },
          {
            Header: 'Last Name',
            accessor: 'lastName',
            width: 350,
          },
        ],
      },
      {
        Header: 'Info',
        columns: [
          {
            Header: 'Age',
            accessor: 'age',
            minWidth: 300,
          },
          {
            Header: 'Visits',
            accessor: 'visits',
            maxWidth: 150,
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

test('renders a table', () => {
  const rtl = render(<App />)

  expect(
    rtl
      .getAllByRole('columnheader')
      .every(d => d.style.display === 'inline-block')
  ).toBe(true)

  expect(rtl.getAllByRole('row').every(d => d.style.display === 'flex')).toBe(
    true
  )

  expect(
    rtl.getAllByRole('columnheader').map(d => d.style.width)
  ).toStrictEqual([
    '550px',
    '850px',
    '250px',
    '300px',
    '300px',
    '150px',
    '200px',
    '200px',
  ])
})
