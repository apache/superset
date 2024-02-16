import React, { useEffect, createRef, useMemo } from 'react';
import { styled } from '@superset-ui/core';
import { useTable, Column , useSortBy} from 'react-table';
import { ChartData, DataType, SupersetPluginChartImmersatableProps, SupersetPluginChartImmersatableStylesProps } from './types';
import { TimeSeriesCell } from './TimeSeries';


const Styles = styled.div<SupersetPluginChartImmersatableStylesProps>`
  padding: ${({ theme }) => theme.gridUnit * 2}px;
  border-radius: ${({ theme }) => theme.gridUnit * 2}px;
  height: ${({ height }) => height}px;
  width: ${({ width }) => width}px;
  overflow: auto;
  h3 {
    /* You can use your props to control CSS! */
    margin-top: 0;
    margin-bottom: ${({ theme }) => theme.gridUnit * 3}px;
    font-size: ${({ theme, headerFontSize }) =>
      theme.typography.sizes[headerFontSize]}px;
    font-weight: ${({ theme, boldText }) =>
      theme.typography.weights[boldText ? 'bold' : 'normal']};
  }

  pre {
    height: ${({ theme, headerFontSize, height }) =>
      height - theme.gridUnit * 12 - theme.typography.sizes[headerFontSize]}px;
  }
`;

const ContainerStyle = styled.div`
  border: 1px solid #d1d5db;
  border-radius: 1rem;
  margin: 10px;
  width: fit-content;
  overflow: hidden;
`;

const HeaderText = styled.div`
  padding: 17px 24px;
  border: 1px solid #d1d5db;
  border-top-left-radius: 1rem;
  border-top-right-radius: 1rem;
  background: #f3f4f6;
  font-size: 1.4rem;
  font-weight: bold !important;
  color: rgb(107, 114, 128);
`;

const TableHeaderGroup = styled.div`
  display: flex;
  background: #f9fafb;
`;

const TableHeader = styled.div`
  width: 220px;
  display: flex;
  position: relative;
  border: 1px solid #d1d5db;
  text-transform: capitalize;
  padding: 0.875rem;
  min-height: 45px;
`;

const TableColumn = styled.div`
  font-size: 0.875rem;
  line-height: 1.25rem;
  text-align: left;
  display: flex;
`;

const TableColumnText = styled.div`
  overflow-wrap: break-word;
  width: 180px;
  font-weight: bold;
`;

const TableRow = styled.div`
 display: flex;
`;

const TableCell = styled.div`
  width: 220px;
  display: flex;
  position: relative;
  border: 1px solid #d1d5db;
  font-size: 0.875rem;
  line-height: 1.25rem;
  max-height: 3rem;
  padding: 0.875rem 1rem;
  text-align: left;
`;

export default function SupersetPluginChartImmersatable(props: SupersetPluginChartImmersatableProps) {

  const { data, height, width } = props;

  const rootElem = createRef<HTMLDivElement>();

 
  useEffect(() => {
    const root = rootElem.current as HTMLElement;
    console.log('Plugin element', root);
  });

  console.log('Plugin props', props);

  const DEFAULT_COLUMN_MIN_WIDTH = 160;

  const columnNames = Object.keys(data[0])
  

  const columnsMetadata = useMemo(()=>{
    return   columnNames.map((metadata)=>{
      return { width: DEFAULT_COLUMN_MIN_WIDTH,
        name:metadata,
        label:metadata,
        minWidth: null,
        maxWidth: null,
        sortable: true,
        sortDescFirst: true,
      }
    })
  },columnNames)

  const columns: Column<DataType>[] = useMemo(() => {
    return columnsMetadata.map((columnMetadata) => {
      return {
        Header: columnMetadata.label,
        accessor: columnMetadata.name,
        Cell: (info: any) => {
          const value = info.value;
          if (
            value &&
            value.toString().includes("[") &&
            Array.isArray(JSON.parse(value as string))
          ) {
            const chartData = JSON.parse(value).map((row: any) => {
              return {
                xAxis: row[0],
                yAxis: row[1],
              };
            });
            return (
              <TimeSeriesCell value="" chartData={chartData as ChartData} />
            );
          } else {
            return value;
          }
        },
      };
    });
  }, [columnsMetadata]);


  const {
  headerGroups,
  rows,
  prepareRow,
  getTableProps,
  getTableBodyProps,
} = useTable({
  columns,
  data,
},useSortBy);

  return (
    <Styles
      ref={rootElem}
      boldText={props.boldText}
      headerFontSize={props.headerFontSize}
      height={height}
      width={width}
    >
      <ContainerStyle>
      <HeaderText>{props.headerText}</HeaderText>
      
      <div {...getTableProps()}>
        {headerGroups.map((headerGroup) => (
        <TableHeaderGroup
          {...headerGroup.getHeaderGroupProps()}
          key={headerGroup.id}
        >
          {headerGroup.headers.map((column) => {
            console.log("column",column)
            return (
            <TableHeader
              key={column.id}
            >
               <div {...column.getHeaderProps(column.getSortByToggleProps())}>
                 <TableColumn>
                  <TableColumnText {...column.getHeaderProps()}
                  >
                {column.render('Header')}
                  </TableColumnText>
                   <span>
                        <div
                          style={{
                            display: "flex",
                            position: "relative",
                          }}
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            style={{
                              height: "1.35rem",
                              width: "1.35rem",
                              color:
                                column.isSorted && !column.isSortedDesc
                                  ? "orange"
                                  : "gray",
                            }}
                          >
                            <path
                              fillRule="evenodd"
                              d="M10 15a.75.75 0 01-.75-.75V7.612L7.29 9.77a.75.75 0 01-1.08-1.04l3.25-3.5a.75.75 0 011.08 0l3.25 3.5a.75.75 0 11-1.08 1.04l-1.96-2.158v6.638A.75.75 0 0110 15z"
                              clipRule="evenodd"
                            />
                          </svg>
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            style={{
                              height: "1.35rem",
                              width: "1.35rem",
                              color:
                                column.isSorted && column.isSortedDesc
                                  ? "orange"
                                  : "gray",
                              marginLeft: "0.4rem",
                              marginTop: "0.25rem",
                              position: "absolute",
                            }}
                          >
                            <path
                              fillRule="evenodd"
                              d="M10 5a.75.75 0 01.75.75v6.638l1.96-2.158a.75.75 0 111.08 1.04l-3.25 3.5a.75.75 0 01-1.08 0l-3.25-3.5a.75.75 0 111.08-1.04l1.96 2.158V5.75A.75.75 0 0110 5z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </div>
                      </span>
                </TableColumn>
               </div>
            </TableHeader>
            )
})}
        </TableHeaderGroup>
      ))}
      </div>
       <div {...getTableBodyProps()}>
     {rows.map((row) => {
  prepareRow(row);
  return (
    <TableRow {...row.getRowProps()}>
      {row.cells.map((cell,index) => (
        <TableCell {...cell.getCellProps()}>
          {cell.render("Cell")}
        </TableCell>
      ))}
    </TableRow>
  );
})}</div>
    </ContainerStyle>
    </Styles>
  );
}




