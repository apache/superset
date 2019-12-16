import React from 'react';

export default function TableCollection({
  getTableProps,
  getTableBodyProps,
  prepareRow,
  headerGroups,
  rows,
  loading,
}: any) {
  return (
    <table {...getTableProps()} className="table table-hover">
      <thead>
        {headerGroups.map((headerGroup: any) => (
          <tr {...headerGroup.getHeaderGroupProps()}>
            {headerGroup.headers.map((column: any) => (
              <th {...column.getHeaderProps(column.getSortByToggleProps())}>
                {column.render('Header')}
                {'  '}
                {column.sortable && (
                  <i
                    className={`text-primary fa fa-${
                      column.isSorted
                        ? column.isSortedDesc
                          ? 'sort-down'
                          : 'sort-up'
                        : 'sort'
                    }`}
                  />
                )}
              </th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody {...getTableBodyProps()}>
        {rows.map((row: any) => {
          prepareRow(row);
          const loadingProps = loading ? { className: 'table-row-loader' } : {};
          return (
            <tr
              {...row.getRowProps()}
              {...loadingProps}
              onMouseEnter={() => row.setState({ hover: true })}
              onMouseLeave={() => row.setState({ hover: false })}
            >
              {row.cells.map((cell: any) => {
                const columnCellProps = cell.column.cellProps || {};

                return (
                  <td {...cell.getCellProps()} {...columnCellProps}>
                    <span>{cell.render('Cell')}</span>
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
