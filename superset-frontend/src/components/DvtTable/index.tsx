/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import React, { useState } from 'react';
import type { CheckboxChangeEvent } from 'antd/es/checkbox';
import { SupersetTheme, supersetTheme } from '@superset-ui/core';
import { Checkbox } from 'antd';
import Icons from '../Icons';
import Icon from '../Icons/Icon';
import {
  StyledTable,
  StyledTableTable,
  StyledTabletHead,
  StyledTableTr,
  StyledTableTh,
  StyledTableTbody,
  StyledTableTd,
  StyledTableTitle,
  StyledTableIcon,
  StyledTableCheckbox,
  StyledTableUrl,
} from './dvt-table.module';
import DvtPopper from '../DvtPopper';
import { useHistory } from 'react-router-dom';

interface HeaderProps {
  id: number;
  title: string;
  field?: string;
  icon?: string;
  iconActive?: string;
  iconClick?: () => {};
  urlField?: string;
  flex?: number;
  clicks?: {
    icon: string;
    click: (row: any) => void;
    colour?: string;
    popperLabel?: string;
  }[];
  showHover?: boolean;
  checkbox?: boolean;
  isFavorite?: boolean;
}

export interface DvtTableProps {
  data: any[];
  header: HeaderProps[];
  onRowClick?: (row: any) => void;
  selected?: any[];
  setSelected?: (newSelected: any[]) => void;
  checkboxActiveField?: string;
  setFavoriteData?: (item: any) => void;
}

const DvtTable: React.FC<DvtTableProps> = ({
  data,
  header,
  onRowClick,
  selected = [],
  setSelected = () => {},
  checkboxActiveField = 'id',
  setFavoriteData,
}) => {
  const [openRow, setOpenRow] = useState<number | null>(null);
  const [newData, setNewData] = useState<any[]>(
    data.sort((a, b) => a.id - b.id),
  );

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

  const history = useHistory();

  const columnsWithDefaults = 100 / totalFlex;

  const checkAll = newData.length === selected.length;

  const indeterminate = selected.length > 0 && selected.length < newData.length;

  const onCheckAllChange = (e: CheckboxChangeEvent) => {
    setSelected(e.target.checked ? newData.slice() : []);
  };

  const handleFavouriteData = (item: any) => {
    const findItem = newData.find(row => row.id === item.id);
    const findItemRemovedData = newData.filter(row => row.id !== item.id);
    setNewData(
      [
        ...findItemRemovedData,
        { ...findItem, isFavorite: !item.isFavorite },
      ].sort((a, b) => a.id - b.id),
    );
  };

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
                {column.checkbox && (
                  <StyledTableCheckbox>
                    <Checkbox
                      indeterminate={indeterminate}
                      onChange={onCheckAllChange}
                      checked={checkAll}
                    />
                  </StyledTableCheckbox>
                )}
                {column.title}
              </StyledTableTh>
            ))}
          </StyledTableTitle>
        </StyledTabletHead>
        <StyledTableTbody>
          {newData.map((row, rowIndex) => (
            <StyledTableTr
              key={rowIndex}
              onClick={() => onRowClick?.(row)}
              onMouseOver={() => setOpenRow(rowIndex)}
              onMouseOut={() => setOpenRow(null)}
            >
              {header.map((column, columnIndex) => (
                <StyledTableTd key={columnIndex}>
                  <StyledTableIcon>
                    {column.checkbox && columnIndex === 0 && (
                      <StyledTableCheckbox>
                        <Checkbox
                          checked={selected.some(
                            item =>
                              item[checkboxActiveField] ===
                              row[checkboxActiveField],
                          )}
                          onChange={e => {
                            const checkedRows = e.target.checked
                              ? [...selected, row]
                              : selected.filter(
                                  item =>
                                    item[checkboxActiveField] !==
                                    row[checkboxActiveField],
                                );
                            setSelected(checkedRows);
                          }}
                        />
                      </StyledTableCheckbox>
                    )}
                    {column.icon && (
                      <Icon
                        onClick={column.iconClick}
                        fileName={
                          row.active
                            ? column.iconActive || 'dvt-folder-active'
                            : column.icon || 'dvt-folder'
                        }
                        iconSize="xl"
                        css={(theme: SupersetTheme) => ({
                          color: theme.colors.grayscale.dark2,
                          marginRight: '14px',
                          fontSize: '20px',
                        })}
                      />
                    )}
                    {column.isFavorite && (
                      <StyledTableTbody onClick={() => handleFavouriteData(row)}>
                        {row.isFavorite ? (
                          <Icons.StarFilled
                            iconSize="xl"
                            iconColor={supersetTheme.colors.alert.base}
                          />
                        ) : (
                          <Icons.StarOutlined
                            iconSize="xl"
                            iconColor={supersetTheme.colors.dvt.text.bold}
                          />
                        )}
                      </StyledTableTbody>
                    )}
                    {column.urlField && column.field && (
                      <StyledTableUrl
                        onClick={() => {
                          column.urlField
                            ? history.push(row[column.urlField])
                            : '';
                        }}
                      >
                        {row[column.field]}
                      </StyledTableUrl>
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
                              click: (row: any) => void;
                              colour: string;
                              popperLabel?: string;
                            },
                            index,
                          ) => (
                            <React.Fragment key={index}>
                              {clicks.popperLabel && (
                                <DvtPopper label={clicks.popperLabel}>
                                  <Icon
                                    onClick={() => clicks.click(row)}
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
                                      height: '56px',
                                      display: 'flex',
                                      alignItems: 'center',
                                    }}
                                  />
                                </DvtPopper>
                              )}
                              {!clicks.popperLabel && (
                                <Icon
                                  onClick={() => clicks.click(row)}
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
                              )}
                            </React.Fragment>
                          ),
                        )}

                        {column.field !== 'action' &&
                          column.field &&
                          !column.urlField && <>{row[column.field]}</>}
                      </>
                    )}
                  </StyledTableIcon>
                </StyledTableTd>
              ))}
            </StyledTableTr>
          ))}
        </StyledTableTbody>
      </StyledTableTable>
    </StyledTable>
  );
};

export default DvtTable;
