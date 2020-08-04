import React from 'react'
import { render, fireEvent } from '@testing-library/react'
import { useTable } from '../../hooks/useTable'
import { useRowSelect } from '../useRowSelect'
import { useFilters } from '../useFilters'

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
    state,
  } = useTable(
    {
      columns,
      data,
      defaultColumn,
    },
    useFilters,
    useRowSelect
  )

  // Render the UI for your table
  return (
    <>
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
      <p>
        Selected Rows:{' '}
        <span data-testid="selected-count">
          {Object.keys(state.selectedRowIds).length}
        </span>
      </p>
      <pre>
        <code>
          {JSON.stringify({ selectedRowIds: state.selectedRowIds }, null, 2)}
        </code>
      </pre>
    </>
  )
}

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
      {
        id: 'selectedStatus',
        Cell: ({ row }) => (
          <div>
            Row {row.id} {row.isSelected ? 'Selected' : 'Not Selected'}
          </div>
        ),
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
            id: 'visits',
            Header: 'Visits',
            accessor: 'visits',
            filter: 'equals',
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

test('Select/Clear All while filtered only affects visible rows', () => {
  const { getAllByPlaceholderText, getByLabelText, getByTestId } = render(
    <App />
  )
  const selectedCount = getByTestId('selected-count')
  const selectAllCheckbox = getByLabelText('Select All')
  const fe = fireEvent
  const filterInputs = getAllByPlaceholderText('Search...')

  fireEvent.change(filterInputs[3], { target: { value: '40' } })
  expect(selectedCount.textContent).toBe('0') // No selection has been made

  expect(selectAllCheckbox.checked).toBe(false)
  fireEvent.click(selectAllCheckbox)
  expect(selectAllCheckbox.checked).toBe(true)
  expect(selectedCount.textContent).toBe('6') // "Select All" has happened

  // This filter hides all the rows (nothing matches it)
  fireEvent.change(filterInputs[3], { target: { value: '10' } })
  expect(selectedCount.textContent).toBe('6') // Filtering does not alter the selection

  expect(selectAllCheckbox.checked).toBe(false) // None of the selected items are visible, this should be false
  fireEvent.click(selectAllCheckbox) // The selection is is for no rows
  expect(selectAllCheckbox.checked).toBe(false) // So clicking this checkbox does nothing
  expect(selectedCount.textContent).toBe('6') // And does not affect the existing selection

  fireEvent.change(filterInputs[3], { target: { value: '100' } })
  expect(selectAllCheckbox.checked).toBe(false) // None of the selected items are visible, this should be false
  fireEvent.click(selectAllCheckbox)
  expect(selectAllCheckbox.checked).toBe(true) // Now all of the visible rows are ALSO selected
  expect(selectedCount.textContent).toBe('12') // Clearing all should leave the original 6 selected

  // Now deselect all the rows that match the filter
  fireEvent.click(selectAllCheckbox)
  expect(selectAllCheckbox.checked).toBe(false) // Now all of the visible rows are ALSO selected
  expect(selectedCount.textContent).toBe('6') // Clearing all should leave the original 6 selected

  fireEvent.change(filterInputs[3], { target: { value: '' } })
  expect(selectedCount.textContent).toBe('6') // Clearing the Filter does not alter the selection

  expect(selectAllCheckbox.checked).toBe(false) // Only a subset are selected so this button should show indeterminant
  fireEvent.click(selectAllCheckbox)
  expect(selectAllCheckbox.checked).toBe(true) // Now all of the visible rows are ALSO selected
  expect(selectedCount.textContent).toBe(data.length.toString()) // Select All should select ALL of the rows

  fireEvent.click(selectAllCheckbox)
  expect(selectedCount.textContent).toBe('0') // Select All should now clear ALL of the rows
})
