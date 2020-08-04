import React from 'react'
import { useTable } from '../../hooks/useTable'
import { useFlexLayout } from '../useFlexLayout'
import { render } from '../../../test-utils/react-testing'

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
    useFlexLayout
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
  const rendered = render(<App />)

  const [headerRow, , firstRow] = rendered.queryAllByRole('row')

  expect(headerRow.getAttribute('style')).toEqual(
    'display: flex; flex: 1 0 auto; min-width: 800px;'
  )

  expect(
    Array.from(firstRow.children).map(d => d.getAttribute('style'))
  ).toEqual([
    'box-sizing: border-box; flex: 0 0 auto; min-width: 100px; width: 250px;',
    'box-sizing: border-box; flex: 0 0 auto; min-width: 100px; width: 300px;',
    'box-sizing: border-box; flex: 0 0 auto; min-width: 300px; width: 300px;',
    'box-sizing: border-box; flex: 0 0 auto; min-width: 100px; width: 150px;',
    'box-sizing: border-box; flex: 0 0 auto; min-width: 100px; width: 200px;',
    'box-sizing: border-box; flex: 0 0 auto; min-width: 100px; width: 200px;',
  ])
})
