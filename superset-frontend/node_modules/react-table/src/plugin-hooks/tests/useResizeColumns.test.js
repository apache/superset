import React from 'react'
import { render, fireEvent } from '@testing-library/react'
import { useTable } from '../../hooks/useTable'
import { useBlockLayout } from '../useBlockLayout'
import { useResizeColumns } from '../useResizeColumns'

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
]
function Table({ columns, data }) {
  const defaultColumn = React.useMemo(
    () => ({
      minWidth: 30,
      width: 150,
      maxWidth: 400,
    }),
    []
  )

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
    useBlockLayout,
    useResizeColumns
  )

  return (
    <div {...getTableProps()} className="table">
      <div>
        {headerGroups.map(headerGroup => (
          <div {...headerGroup.getHeaderGroupProps()} className="tr">
            {headerGroup.headers.map(column => (
              <div {...column.getHeaderProps()} className="th">
                {column.render('Header')}
                {/* Use column.getResizerProps to hook up the events correctly */}
                <div
                  {...column.getResizerProps()}
                  className={`resizer${column.isResizing ? ' isResizing' : ''}`}
                />
              </div>
            ))}
          </div>
        ))}
      </div>

      <div {...getTableBodyProps()}>
        {rows.map((row, i) => {
          prepareRow(row)
          return (
            <div {...row.getRowProps()} className="tr">
              {row.cells.map(cell => {
                return (
                  <div {...cell.getCellProps()} className="td">
                    {cell.render('Cell')}
                  </div>
                )
              })}
            </div>
          )
        })}
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
            width: 50,
          },
          {
            Header: 'Visits',
            accessor: 'visits',
            width: 60,
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

const start = 20
const move = 100
const end = 100

const sizesBefore = [
  '300px',
  '410px',
  '150px',
  '150px',
  '50px',
  '60px',
  '150px',
  '150px',
]

const sizesAfter = [
  '300px',
  '490px',
  '150px',
  '150px',
  '59.75609756097561px',
  '71.70731707317073px',
  '179.26829268292684px',
  '179.26829268292684px',
]

test('table can be resized by a mouse', () => {
  const rtl = render(<App />)

  const infoResizer = rtl
    .getAllByRole('separator')
    .find(d => d.previousSibling.textContent === 'Info')

  expect(rtl.getAllByRole('columnheader').map(d => d.style.width)).toEqual(
    sizesBefore
  )

  fireEvent.mouseDown(infoResizer, { clientX: start })
  fireEvent.mouseMove(infoResizer, { clientX: move })
  fireEvent.mouseUp(infoResizer, { clientX: end })

  expect(rtl.getAllByRole('columnheader').map(d => d.style.width)).toEqual(
    sizesAfter
  )
})

test('table can be resized by a touch device', () => {
  const rtl = render(<App />)

  const infoResizer = rtl
    .getAllByRole('separator')
    .find(d => d.previousSibling.textContent === 'Info')

  expect(rtl.getAllByRole('columnheader').map(d => d.style.width)).toEqual(
    sizesBefore
  )

  fireEvent.touchStart(infoResizer, { touches: [{ clientX: start }] })
  fireEvent.touchMove(infoResizer, { touches: [{ clientX: move }] })
  fireEvent.touchEnd(infoResizer, { touches: [{ clientX: end }] })

  expect(rtl.getAllByRole('columnheader').map(d => d.style.width)).toEqual(
    sizesAfter
  )
})

test('table can not be resized with multiple touches', () => {
  const rtl = render(<App />)

  const infoResizer = rtl
    .getAllByRole('separator')
    .find(d => d.previousSibling.textContent === 'Info')

  expect(rtl.getAllByRole('columnheader').map(d => d.style.width)).toEqual(
    sizesBefore
  )

  fireEvent.touchStart(infoResizer, {
    touches: [{ clientX: start }, { clientX: start }],
  })
  fireEvent.touchMove(infoResizer, {
    touches: [{ clientX: move }, { clientX: move }],
  })
  fireEvent.touchEnd(infoResizer, {
    touches: [{ clientX: end }, { clientX: end }],
  })

  expect(rtl.getAllByRole('columnheader').map(d => d.style.width)).toEqual(
    sizesBefore
  )
})
