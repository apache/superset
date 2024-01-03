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
import Icons from '../Icons';
import { Checkbox } from 'antd';
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
} from './dvt-table.module';
import DvtPopper from '../DvtPopper';

interface HeaderProps {
  id: number;
  title: string;
  field?: string;
  icon?: string;
  iconActive?: string;
  iconClick?: () => {};
  onLink?: boolean;
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
  isFavoriteData?: any[];
  setFavoriteData?: (isFavorite: any[]) => void;
}

const DvtTable: React.FC<DvtTableProps> = ({
  data,
  header,
  onRowClick,
  selected = [],
  setSelected = () => {},
  checkboxActiveField = 'id',
  isFavoriteData,
  setFavoriteData,
}) => {
  const [openRow, setOpenRow] = useState<number | null>(null);

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

  const checkAll = data.length === selected.length;

  const indeterminate = selected.length > 0 && selected.length < data.length;

  const onCheckAllChange = (e: CheckboxChangeEvent) => {
    setSelected(e.target.checked ? data.slice() : []);
  };

  const onFavoriteChange = (row: any) => {
    const updatedData = data.map(item => {
      if (item[checkboxActiveField] === row[checkboxActiveField]) {
        return { ...item, isFavorite: !item.isFavorite };
      }
      return item;
    });
  
    setFavoriteData && setFavoriteData(updatedData);
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
          {data.map((row, rowIndex) => (
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
                      <div onClick={() => onFavoriteChange(row)}>
                        {isFavoriteData &&
                        isFavoriteData.some(data => data.id === row.id) ? (
                          isFavoriteData.find(data => data.id === row.id)
                            ?.isFavorite ? (
                            <Icons.StarFilled
                              iconSize="xl"
                              iconColor={supersetTheme.colors.alert.base}
                            />
                          ) : (
                            <Icons.StarOutlined
                              iconSize="xl"
                              iconColor={supersetTheme.colors.dvt.text.bold}
                            />
                          )
                        ) : row.isFavorite ? (
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
                      </div>
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

                        {column.field !== 'action' && column.field && (
                          <>{row[column.field]}</>
                        )}
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
