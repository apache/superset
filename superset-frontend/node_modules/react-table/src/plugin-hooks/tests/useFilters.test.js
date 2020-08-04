import React from 'react'
import { render, fireEvent } from '../../../test-utils/react-testing'
import { useTable } from '../../hooks/useTable'
import { useFilters } from '../useFilters'
import { useGlobalFilter } from '../useGlobalFilter'

const makeData = () => [
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
  Cell: ({ value, column: { id } }) => `${id}: ${value}`,
  Filter: ({ column: { filterValue, setFilter } }) => (
    <input
      value={filterValue || ''}
      onChange={e => {
        setFilter(e.target.value || undefined) // Set undefined to remove the filter entirely
      }}
      placeholder="Search..."
    />
  ),
}

function App(props) {
  const [data, setData] = React.useState(makeData)

  const columns = React.useMemo(() => {
    if (props.columns) {
      return props.columns
    }
    return [
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
    ]
  }, [props.columns])

  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    rows,
    prepareRow,
    visibleColumns,
    state,
    setGlobalFilter,
  } = useTable(
    {
      columns,
      data,
      defaultColumn,
    },
    useFilters,
    useGlobalFilter
  )

  const reset = () => setData(makeData())

  return (
    <>
      <button onClick={reset}>Reset Data</button>
      <table {...getTableProps()}>
        <thead>
          {headerGroups.map(headerGroup => (
            <tr {...headerGroup.getHeaderGroupProps()}>
              {headerGroup.headers.map(column => (
                <th {...column.getHeaderProps()}>
                  {column.render('Header')}
                  {column.canFilter ? column.render('Filter') : null}
                </th>
              ))}
            </tr>
          ))}
          <tr>
            <th
              colSpan={visibleColumns.length}
              style={{
                textAlign: 'left',
              }}
            >
              <span>
                <input
                  value={state.globalFilter || ''}
                  onChange={e => {
                    setGlobalFilter(e.target.value || undefined) // Set undefined to remove the filter entirely
                  }}
                  placeholder={`Global search...`}
                  style={{
                    fontSize: '1.1rem',
                    border: '0',
                  }}
                />
              </span>
            </th>
          </tr>
        </thead>
        <tbody {...getTableBodyProps()}>
          {rows.map(
            (row, i) =>
              prepareRow(row) || (
                <tr {...row.getRowProps()}>
                  {row.cells.map(cell => (
                    <td {...cell.getCellProps()}>{cell.render('Cell')}</td>
                  ))}
                </tr>
              )
          )}
        </tbody>
      </table>
    </>
  )
}

test('renders a filterable table', async () => {
  const rendered = render(<App />)

  const resetButton = rendered.getByText('Reset Data')
  const globalFilterInput = rendered.getByPlaceholderText('Global search...')
  const filterInputs = rendered.getAllByPlaceholderText('Search...')

  expect(filterInputs).toHaveLength(6)

  fireEvent.change(filterInputs[1], { target: { value: 'l' } })
  expect(
    rendered
      .queryAllByRole('row')
      .slice(3)
      .map(row => Array.from(row.children)[0].textContent)
  ).toEqual(['firstName: tanner', 'firstName: jaylen'])

  fireEvent.change(filterInputs[1], { target: { value: 'er' } })
  expect(
    rendered
      .queryAllByRole('row')
      .slice(3)
      .map(row => Array.from(row.children)[0].textContent)
  ).toEqual(['firstName: derek', 'firstName: joe'])

  fireEvent.change(filterInputs[2], { target: { value: 'nothing' } })
  expect(
    rendered
      .queryAllByRole('row')
      .slice(3)
      .map(row => Array.from(row.children)[0].textContent)
  ).toEqual([])

  fireEvent.change(filterInputs[1], { target: { value: '' } })
  expect(
    rendered
      .queryAllByRole('row')
      .slice(3)
      .map(row => Array.from(row.children)[0].textContent)
  ).toEqual([])

  fireEvent.change(filterInputs[2], { target: { value: '' } })
  expect(
    rendered
      .queryAllByRole('row')
      .slice(3)
      .map(row => Array.from(row.children)[0].textContent)
  ).toEqual([
    'firstName: tanner',
    'firstName: derek',
    'firstName: joe',
    'firstName: jaylen',
  ])

  fireEvent.change(globalFilterInput, { target: { value: 'li' } })
  expect(
    rendered
      .queryAllByRole('row')
      .slice(3)
      .map(row => Array.from(row.children)[0].textContent)
  ).toEqual(['firstName: tanner', 'firstName: joe', 'firstName: jaylen'])

  fireEvent.click(resetButton)
  expect(
    rendered
      .queryAllByRole('row')
      .slice(3)
      .map(row => Array.from(row.children)[0].textContent)
  ).toEqual([
    'firstName: tanner',
    'firstName: derek',
    'firstName: joe',
    'firstName: jaylen',
  ])
})

test('does not filter columns marked as disableFilters', () => {
  const columns = [
    {
      Header: 'Name',
      columns: [
        {
          Header: 'First Name',
          accessor: 'firstName',
          disableFilters: true,
        },
        {
          Header: 'Last Name',
          accessor: 'lastName',
          disableFilters: true,
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
  ]
  const rendered = render(<App columns={columns} />)

  const filterInputs = rendered.getAllByPlaceholderText('Search...')

  expect(filterInputs).toHaveLength(4)

  // should be Age column
  fireEvent.change(filterInputs[0], { target: { value: '45' } })
  expect(
    rendered
      .queryAllByRole('row')
      .slice(3)
      .map(row => Array.from(row.children)[0].textContent)
  ).toEqual(['firstName: joe'])

  fireEvent.change(filterInputs[0], { target: { value: '' } })
  expect(
    rendered
      .queryAllByRole('row')
      .slice(3)
      .map(row => Array.from(row.children)[0].textContent)
  ).toEqual([
    'firstName: tanner',
    'firstName: derek',
    'firstName: joe',
    'firstName: jaylen',
  ])
})

test('does not filter columns with GlobalFilter if marked disableGlobalFilter', () => {
  const columns = [
    {
      Header: 'Name',
      columns: [
        {
          Header: 'First Name',
          accessor: 'firstName',
          disableGlobalFilter: true,
        },
        {
          Header: 'Last Name',
          accessor: 'lastName',
          disableGlobalFilter: true,
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
  ]
  const rendered = render(<App columns={columns} />)

  const globalFilterInput = rendered.getByPlaceholderText('Global search...')

  fireEvent.change(globalFilterInput, { target: { value: '' } })
  expect(
    rendered
      .queryAllByRole('row')
      .slice(3)
      .map(row => Array.from(row.children)[0].textContent)
  ).toEqual([
    'firstName: tanner',
    'firstName: derek',
    'firstName: joe',
    'firstName: jaylen',
  ])

  // global filter shouldn't apply to firstName or lastName
  fireEvent.change(globalFilterInput, { target: { value: 'li' } })
  expect(
    rendered
      .queryAllByRole('row')
      .slice(3)
      .map(row => Array.from(row.children)[0].textContent)
  ).toEqual(['firstName: joe'])

  // double check global filter ignore (should ignore joe bergevin)
  fireEvent.change(globalFilterInput, { target: { value: 'in' } })
  expect(
    rendered
      .queryAllByRole('row')
      .slice(3)
      .map(row => Array.from(row.children)[0].textContent)
  ).toEqual(['firstName: tanner', 'firstName: derek', 'firstName: jaylen'])
})
