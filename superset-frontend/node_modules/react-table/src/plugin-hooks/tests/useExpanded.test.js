import React from 'react'
import { render, fireEvent } from '@testing-library/react'
import { useTable } from '../../hooks/useTable'
import { useExpanded } from '../useExpanded'
import makeTestData from '../../../test-utils/makeTestData'

const data = makeTestData(3, 3, 3)

function Table({ columns: userColumns, data, SubComponent }) {
  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    rows,
    prepareRow,
    visibleColumns,
  } = useTable(
    {
      columns: userColumns,
      data,
    },
    useExpanded
  )

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
          {rows.map((row, i) => {
            prepareRow(row)
            const { key, ...rowProps } = row.getRowProps()
            return (
              <React.Fragment key={key}>
                <tr {...rowProps}>
                  {row.cells.map(cell => {
                    return (
                      <td {...cell.getCellProps()}>{cell.render('Cell')}</td>
                    )
                  })}
                </tr>
                {!row.subRows.length && row.isExpanded ? (
                  <tr>
                    <td colSpan={visibleColumns.length}>
                      {SubComponent({ row })}
                    </td>
                  </tr>
                ) : null}
              </React.Fragment>
            )
          })}
        </tbody>
      </table>
    </>
  )
}

function App() {
  const columns = React.useMemo(
    () => [
      {
        Header: () => null,
        id: 'expander',
        Cell: ({ row }) => (
          <span
            style={{
              cursor: 'pointer',
              paddingLeft: `${row.depth * 2}rem`,
            }}
            onClick={() => row.toggleRowExpanded()}
          >
            {row.isExpanded ? 'Collapse' : 'Expand'} Row {row.id}
          </span>
        ),
      },
      {
        Header: 'First Name',
        accessor: 'name',
        Cell: ({ row: { id } }) => `Row ${id}`,
      },
    ],
    []
  )

  return (
    <Table
      columns={columns}
      data={data}
      SubComponent={({ row }) => <span>SubComponent: {row.id}</span>}
    />
  )
}

test('renders an expandable table', () => {
  const rtl = render(<App />)

  rtl.getByText('Row 0')

  fireEvent.click(rtl.getByText('Expand Row 0'))

  rtl.getByText('Row 0.0')
  rtl.getByText('Row 0.1')
  rtl.getByText('Row 0.2')

  fireEvent.click(rtl.getByText('Expand Row 0.1'))

  rtl.getByText('Row 0.1.2')

  fireEvent.click(rtl.getByText('Expand Row 0.1.2'))

  rtl.getByText('SubComponent: 0.1.2')

  fireEvent.click(rtl.getByText('Collapse Row 0'))

  expect(rtl.queryByText('SubComponent: 0.1.2')).toBe(null)
  rtl.getByText('Expand Row 0')
})
