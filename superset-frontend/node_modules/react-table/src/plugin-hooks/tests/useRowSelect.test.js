import React from 'react'
import { render, fireEvent } from '@testing-library/react'
import { useTable } from '../../hooks/useTable'
import { useRowSelect } from '../useRowSelect'
import { useExpanded } from '../useExpanded'

const dataPiece = [
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
    expanded: true,
    subRows: [
      {
        firstName: 'bob',
        lastName: 'ross',
        age: 52,
        visits: 40,
        status: 'In Relationship',
        progress: 30,
      },
      {
        firstName: 'john',
        lastName: 'smith',
        age: 21,
        visits: 30,
        status: 'Single',
        progress: 60,
      },
    ],
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

const data = [
  ...dataPiece,
  ...dataPiece,
  ...dataPiece,
  ...dataPiece,
  ...dataPiece,
  ...dataPiece,
]

function Table({ columns, data }) {
  // Use the state and functions returned from useTable to build your UI
  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    rows,
    prepareRow,
    state: { selectedRowIds },
  } = useTable(
    {
      columns,
      data,
    },
    useRowSelect,
    useExpanded,
    hooks => {
      hooks.visibleColumns.push(columns => [
        // Let's make a column for selection
        {
          id: 'selection',
          // The header can use the table's getToggleAllRowsSelectedProps method
          // to render a checkbox
          Header: ({ getToggleAllRowsSelectedProps }) => (
            <div>
              <label>
                <IndeterminateCheckbox {...getToggleAllRowsSelectedProps()} />{' '}
                Select All
              </label>
            </div>
          ),
          // The cell can use the individual row's getToggleRowSelectedProps method
          // to the render a checkbox
          Cell: ({ row }) => (
            <div>
              <label>
                <IndeterminateCheckbox {...row.getToggleRowSelectedProps()} />{' '}
                Select Row
              </label>
            </div>
          ),
        },
        ...columns,
      ])
    }
  )

  // Render the UI for your table
  return (
    <>
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
                  {row.cells.map(cell => {
                    return (
                      <td {...cell.getCellProps()}>{cell.render('Cell')}</td>
                    )
                  })}
                </tr>
              )
          )}
        </tbody>
      </table>
    </>
  )
}

const IndeterminateCheckbox = React.forwardRef(
  ({ indeterminate, ...rest }, ref) => {
    const defaultRef = React.useRef()
    const resolvedRef = ref || defaultRef

    React.useEffect(() => {
      resolvedRef.current.indeterminate = indeterminate
    }, [resolvedRef, indeterminate])

    return <input type="checkbox" ref={resolvedRef} {...rest} />
  }
)

function App() {
  const columns = React.useMemo(
    () => [
      {
        id: 'selectedStatus',
        Cell: ({ row }) =>
          row.isSelected ? (
            <div>
              <div>Selected</div>
              <div>Row {row.id}</div>
            </div>
          ) : null,
      },
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

test('renders a table with selectable rows', () => {
  const rtl = render(<App />)

  fireEvent.click(rtl.getByLabelText('Select All'))

  expect(rtl.getAllByText('Selected').length).toBe(24)

  fireEvent.click(rtl.getAllByLabelText('Select Row')[2])

  expect(rtl.queryAllByText('Selected').length).toBe(23)

  fireEvent.click(rtl.getByLabelText('Select All'))

  expect(rtl.queryAllByText('Selected').length).toBe(24)

  fireEvent.click(rtl.getByLabelText('Select All'))

  expect(rtl.queryAllByText('Selected').length).toBe(0)

  fireEvent.click(rtl.getAllByLabelText('Select Row')[0])
  fireEvent.click(rtl.getAllByLabelText('Select Row')[2])

  rtl.getByText('Row 0')
  rtl.getByText('Row 2')

  fireEvent.click(rtl.getAllByLabelText('Select Row')[2])

  expect(rtl.queryByText('Row 2')).toBeNull()

  fireEvent.click(rtl.getAllByLabelText('Select Row')[3])

  rtl.queryByText('Row 3')

  fireEvent.click(rtl.getAllByLabelText('Select Row')[4])

  rtl.queryByText('Row 4')

  fireEvent.click(rtl.getAllByLabelText('Select Row')[4])

  expect(rtl.queryByText('Row 4')).toBeNull()
})
