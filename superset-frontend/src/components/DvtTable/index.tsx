import React, { useState } from 'react';
import { SupersetTheme, supersetTheme } from '@superset-ui/core';
import { FolderOutlined, HeartOutlined } from '@ant-design/icons';
import DvtPagination from '../DvtPagination';
import {
  StyledTable,
  StyledTableTable,
  StyledTabletHead,
  StyledTableTr,
  StyledTableTh,
  StyledTableTbody,
  StyledTableTd,
  StyledTablePagination,
  StyledTableTitle,
  StyledTableIcon,
} from './dvt-table.module';
import Icon from '../Icons/Icon';

export interface DvtTableProps {
  data: any[];
  header: {
    title: string;
    field: string;
    folderIcon?: boolean;
    heartIcon?: boolean;
    onLink?: boolean;
    flex?: number;
    clicks?: [];
    showHover: boolean;
  }[];
  onRowClick?: (row: any) => void;
  itemsPerPage?: number;
  currentPage: number;
  setcurrentPage: (newPage: number) => void;
  pagination?: boolean;
}

const DvtTable: React.FC<DvtTableProps> = ({
  data,
  header,
  onRowClick,
  itemsPerPage = 10,
  currentPage,
  setcurrentPage,
  pagination = false,
}) => {
  const itemsPerPageValue = itemsPerPage;
  const indexOfLastItem = currentPage * itemsPerPageValue;
  const indexOfFirstItem = (currentPage - 1) * itemsPerPageValue;
  const currentItems = data.slice(indexOfFirstItem, indexOfLastItem);
  const [openRow, setOpenRow] = useState<number | null>(null);

  const paginate = (pageNumber: number) => {
    setcurrentPage(pageNumber);
  };

  const formatDateTime = (dateTimeString: string) => {
    const [datePart, timePart] = dateTimeString.split(' ');
    const [day, month, year] = datePart.split('.');
    const [hour, minute, second] = timePart.split(':');

    const formattedDate = `${day}.${month}.${year}`;
    const formattedTime = `${hour}:${minute}:${second}`;

    return {
      date: formattedDate,
      time: formattedTime,
    };
  };
  const totalFlex = header.reduce(
    (total, header) => total + (header.flex || 1),
    0,
  );

  const columnsWithDefaults = 100 / totalFlex;

  return (
    <StyledTable>
      <StyledTableTable>
        <StyledTabletHead>
          <StyledTableTitle>
            {header.map((column, columnIndex) => (
              <StyledTableTh
                key={columnIndex}
                flex={(column.flex || 1) * columnsWithDefaults}
              >
                {column.title}
              </StyledTableTh>
            ))}
          </StyledTableTitle>
        </StyledTabletHead>
        <StyledTableTbody>
          {currentItems.map((row, rowIndex) => (
            <StyledTableTr
              key={rowIndex}
              onClick={() => onRowClick?.(row)}
              onMouseOver={() => setOpenRow(rowIndex)}
              onMouseOut={() => setOpenRow(null)}
            >
              {header.map((column, columnIndex) => (
                <StyledTableTd
                  key={columnIndex}
                  $onLink={column.onLink || false}
                >
                  <StyledTableIcon>
                    {column.folderIcon && (
                      <FolderOutlined
                        css={(theme: SupersetTheme) => ({
                          color: theme.colors.grayscale.dark2,
                          marginRight: '14px',
                          fontSize: '20px',
                        })}
                      />
                    )}
                    {column.heartIcon && (
                      <HeartOutlined
                        css={(theme: SupersetTheme) => ({
                          color: theme.colors.grayscale.dark2,
                          marginRight: '14px',
                          fontSize: '20px',
                        })}
                      />
                    )}
                    {column.field === 'date' ? (
                      <>
                        {formatDateTime(row[column.field]).date}
                        <br />
                        {formatDateTime(row[column.field]).time}
                      </>
                    ) : (
                      <>
                        {column.clicks?.map(
                          (
                            clicks: {
                              icon: string;
                              click: () => void;
                              colour: string;
                            },
                            index,
                          ) => (
                            <Icon
                              key={index}
                              onClick={clicks.click}
                              fileName={clicks.icon}
                              iconColor={
                                clicks.colour ||
                                supersetTheme.colors.grayscale.dark2
                              }
                              iconSize="xl"
                              style={{
                                marginRight: 3.6,
                                visibility: column.showHover
                                  ? openRow === rowIndex
                                    ? 'visible'
                                    : 'hidden'
                                  : 'visible',
                              }}
                            />
                          ),
                        )}
                        {column.field !== 'action' && <>{row[column.field]}</>}
                      </>
                    )}
                  </StyledTableIcon>
                </StyledTableTd>
              ))}
            </StyledTableTr>
          ))}
        </StyledTableTbody>
      </StyledTableTable>
      {pagination && (
        <StyledTablePagination>
          <DvtPagination
            page={currentPage || 1}
            setPage={paginate}
            itemSize={data.length}
            pageItemSize={itemsPerPageValue}
          />
        </StyledTablePagination>
      )}
    </StyledTable>
  );
};

export default DvtTable;
