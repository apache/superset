import React from 'react'
import { renderHook, act } from '@testing-library/react-hooks'
import { render, fireEvent } from '../../../test-utils/react-testing'
import { useTable } from '../../hooks/useTable'
import { usePagination } from '../usePagination'
import { useFilters } from '../useFilters'

const data = [...new Array(1000)].fill(null).map((d, i) => ({
  firstName: `tanner ${i + 1}`,
  lastName: 'linsley',
  age: 29,
  visits: 100,
  status: 'In Relationship',
  progress: 50,
}))

const columns = [
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

function Table({ columns, data }) {
  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    prepareRow,
    page,
    canPreviousPage,
    canNextPage,
    pageOptions,
    pageCount,
    gotoPage,
    nextPage,
    previousPage,
    setPageSize,
    state: { pageIndex, pageSize },
  } = useTable(
    {
      columns,
      data,
      initialState: { pageIndex: 2 },
    },
    usePagination
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
          {page.map(
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
      <div className="pagination">
        <button onClick={() => gotoPage(0)} disabled={!canPreviousPage}>
          {'<<'}
        </button>{' '}
        <button onClick={() => previousPage()} disabled={!canPreviousPage}>
          {'<'}
        </button>{' '}
        <button onClick={() => nextPage()} disabled={!canNextPage}>
          {'>'}
        </button>{' '}
        <button onClick={() => gotoPage(pageCount - 1)} disabled={!canNextPage}>
          {'>>'}
        </button>{' '}
        <span>
          Page{' '}
          <strong>
            {pageIndex + 1} of {pageOptions.length}
          </strong>{' '}
        </span>
        <span>
          | Go to page:{' '}
          <input
            type="number"
            defaultValue={pageIndex + 1}
            onChange={e => {
              const page = e.target.value ? Number(e.target.value) - 1 : 0
              gotoPage(page)
            }}
            style={{ width: '100px' }}
          />
        </span>{' '}
        <select
          value={pageSize}
          onChange={e => {
            setPageSize(Number(e.target.value))
          }}
          data-testid="page-size-select"
        >
          {[10, 20, 30, 40, 50].map(pageSize => (
            <option key={pageSize} value={pageSize}>
              Show {pageSize}
            </option>
          ))}
        </select>
      </div>
    </>
  )
}

function App() {
  return <Table columns={columns} data={data} />
}

test('renders a paginated table', () => {
  const rendered = render(<App />)

  expect(rendered.queryAllByRole('cell')[0].textContent).toEqual('tanner 21')

  fireEvent.click(rendered.getByText('>'))
  expect(rendered.queryAllByRole('cell')[0].textContent).toEqual('tanner 31')

  fireEvent.click(rendered.getByText('>'))
  expect(rendered.queryAllByRole('cell')[0].textContent).toEqual('tanner 41')

  fireEvent.click(rendered.getByText('>>'))
  expect(rendered.queryAllByRole('cell')[0].textContent).toEqual('tanner 991')

  fireEvent.click(rendered.getByText('<<'))
  expect(rendered.queryAllByRole('cell')[0].textContent).toEqual('tanner 1')

  fireEvent.change(rendered.getByTestId('page-size-select'), {
    target: { value: 30 },
  })

  expect(
    rendered
      .queryAllByRole('row')
      .slice(2)
      .reverse()[0].children[0].textContent
  ).toEqual('tanner 30')
})

describe('usePagination', () => {
  test('renders a paginated table', () => {
    const rendered = render(<App />)

    expect(rendered.queryAllByRole('cell')[0].textContent).toEqual('tanner 21')

    fireEvent.click(rendered.getByText('>'))
    expect(rendered.queryAllByRole('cell')[0].textContent).toEqual('tanner 31')

    fireEvent.click(rendered.getByText('>'))
    expect(rendered.queryAllByRole('cell')[0].textContent).toEqual('tanner 41')

    fireEvent.click(rendered.getByText('>>'))
    expect(rendered.queryAllByRole('cell')[0].textContent).toEqual('tanner 991')

    fireEvent.click(rendered.getByText('<<'))
    expect(rendered.queryAllByRole('cell')[0].textContent).toEqual('tanner 1')

    fireEvent.change(rendered.getByTestId('page-size-select'), {
      target: { value: 30 },
    })

    expect(
      rendered
        .queryAllByRole('row')
        .slice(2)
        .reverse()[0].children[0].textContent
    ).toEqual('tanner 30')
  })

  test('changing filters resets pagination', async () => {
    const { result } = renderHook(() =>
      useTable(
        {
          columns,
          data,
        },
        useFilters,
        usePagination
      )
    )

    act(() => result.current.nextPage())
    act(() => result.current.nextPage())
    expect(result.current.state.pageIndex).toEqual(2)
    act(() => result.current.visibleColumns[0].setFilter('tanner'))
    expect(result.current.state.pageIndex).toEqual(0)
  })
})
