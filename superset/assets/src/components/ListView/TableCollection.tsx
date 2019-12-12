import React from 'react';
import Loading from 'src/components/Loading';

export default function TableCollection({
  getTableProps,
  getTableBodyProps,
  prepareRow,
  headerGroups,
  rows,
  loading,
}: any) {
  if (loading) {
    return (
      <div style={{ height: '500px' }}>
        <Loading />
      </div>
    );
  }
  return (
    <table {...getTableProps()} className="table">
      <thead>
        {headerGroups.map((headerGroup: any) => (
          <tr {...headerGroup.getHeaderGroupProps()}>
            {headerGroup.headers.map((column: any) => (
              <th {...column.getHeaderProps(column.getSortByToggleProps())}>
                {column.render('Header')}
                {'  '}
                <i
                  className={`text-primary fa fa-${
                    column.isSorted
                      ? column.isSortedDesc
                        ? 'sort-down'
                        : 'sort-up'
                      : 'sort'
                  }`}
                />
              </th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody {...getTableBodyProps()}>
        {rows.map((row: any) => {
          prepareRow(row);
          return (
            <tr {...row.getRowProps()}>
              {row.cells.map((cell: any) => {
                return <td {...cell.getCellProps()}>{cell.render('Cell')}</td>;
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
