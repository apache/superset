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
import { useCallback } from 'react';
import { styled, t } from '@superset-ui/core';
import type { Column, ColumnPinnedType, GridApi } from 'ag-grid-community';

import { Icons } from 'src/components/Icons';
import { MenuDotsDropdown, DropdownProps } from 'src/components/Dropdown';
import { Menu } from 'src/components/Menu';
import copyTextToClipboard from 'src/utils/copy';
import { PIVOT_COL_ID } from './constants';

const IconEmpty = styled.span`
  width: 14px;
`;

type Params = {
  colId: string;
  column?: Column;
  api: GridApi;
  pinnedLeft?: boolean;
  pinnedRight?: boolean;
  invisibleColumns: Column[];
  isMain?: boolean;
  onVisibleChange: DropdownProps['onOpenChange'];
};

const HeaderMenu: React.FC<Params> = ({
  colId,
  api,
  pinnedLeft,
  pinnedRight,
  invisibleColumns,
  isMain,
  onVisibleChange,
}: Params) => {
  const pinColumn = useCallback(
    (pinLoc: ColumnPinnedType) => {
      api.setColumnsPinned([colId], pinLoc);
    },
    [api, colId],
  );

  const unHideAction = invisibleColumns.length > 0 && (
    <Menu.SubMenu title={t('Unhide')} icon={<Icons.EyeOutlined iconSize="m" />}>
      {invisibleColumns.length > 1 && (
        <Menu.Item
          onClick={() => {
            api.setColumnsVisible(invisibleColumns, true);
          }}
        >
          <b>{t('All %s hidden columns', invisibleColumns.length)}</b>
        </Menu.Item>
      )}
      {invisibleColumns.map(c => (
        <Menu.Item
          key={c.getColId()}
          onClick={() => {
            api.setColumnsVisible([c.getColId()], true);
          }}
        >
          {c.getColDef().headerName}
        </Menu.Item>
      ))}
    </Menu.SubMenu>
  );

  if (isMain) {
    return (
      <MenuDotsDropdown
        placement="bottomLeft"
        trigger={['click']}
        onOpenChange={onVisibleChange}
        overlay={
          <Menu style={{ width: 250 }} mode="vertical">
            <Menu.Item
              onClick={() => {
                copyTextToClipboard(
                  () =>
                    new Promise((resolve, reject) => {
                      const data = api.getDataAsCsv({
                        columnKeys: api
                          .getAllDisplayedColumns()
                          .map(c => c.getColId())
                          .filter(id => id !== colId),
                        suppressQuotes: true,
                        columnSeparator: '\t',
                      });
                      if (data) {
                        resolve(data);
                      } else {
                        reject();
                      }
                    }),
                );
              }}
              icon={<Icons.CopyOutlined iconSize="m" />}
            >
              {t('Copy the current data')}
            </Menu.Item>
            <Menu.Item
              onClick={() => {
                api.exportDataAsCsv({
                  columnKeys: api
                    .getAllDisplayedColumns()
                    .map(c => c.getColId())
                    .filter(id => id !== colId),
                });
              }}
              icon={<Icons.DownloadOutlined iconSize="m" />}
            >
              {t('Download to CSV')}
            </Menu.Item>
            <Menu.Divider />
            <Menu.Item
              onClick={() => {
                api.autoSizeAllColumns();
              }}
              icon={<Icons.ColumnWidthOutlined iconSize="m" />}
            >
              {t('Autosize all columns')}
            </Menu.Item>
            {unHideAction}
            <Menu.Divider />
            <Menu.Item
              onClick={() => {
                api.setColumnsVisible(invisibleColumns, true);
                const columns = api.getColumns();
                if (columns) {
                  const pinnedColumns = columns.filter(
                    c => c.getColId() !== PIVOT_COL_ID && c.isPinned(),
                  );
                  api.setColumnsPinned(pinnedColumns, null);
                  api.moveColumns(columns, 0);
                  const firstColumn = columns.find(
                    c => c.getColId() !== PIVOT_COL_ID,
                  );
                  if (firstColumn) {
                    api.ensureColumnVisible(firstColumn, 'start');
                  }
                }
              }}
              icon={<IconEmpty className="anticon" />}
            >
              {t('Reset columns')}
            </Menu.Item>
          </Menu>
        }
      />
    );
  }

  return (
    <MenuDotsDropdown
      placement="bottomRight"
      trigger={['click']}
      onOpenChange={onVisibleChange}
      overlay={
        <Menu style={{ width: 180 }} mode="vertical">
          <Menu.Item
            onClick={() => {
              copyTextToClipboard(
                () =>
                  new Promise((resolve, reject) => {
                    const data = api.getDataAsCsv({
                      columnKeys: [colId],
                      suppressQuotes: true,
                    });
                    if (data) {
                      resolve(data);
                    } else {
                      reject();
                    }
                  }),
              );
            }}
            icon={<Icons.CopyOutlined iconSize="m" />}
          >
            {t('Copy')}
          </Menu.Item>
          {(pinnedLeft || pinnedRight) && (
            <Menu.Item
              onClick={() => pinColumn(null)}
              icon={<Icons.UnlockOutlined iconSize="m" />}
            >
              {t('Unpin')}
            </Menu.Item>
          )}
          {!pinnedLeft && (
            <Menu.Item
              onClick={() => pinColumn('left')}
              icon={<Icons.VerticalRightOutlined iconSize="m" />}
            >
              {t('Pin Left')}
            </Menu.Item>
          )}
          {!pinnedRight && (
            <Menu.Item
              onClick={() => pinColumn('right')}
              icon={<Icons.VerticalLeftOutlined iconSize="m" />}
            >
              {t('Pin Right')}
            </Menu.Item>
          )}
          <Menu.Divider />
          <Menu.Item
            onClick={() => {
              api.autoSizeColumns([colId]);
            }}
            icon={<Icons.ColumnWidthOutlined iconSize="m" />}
          >
            {t('Autosize Column')}
          </Menu.Item>
          <Menu.Item
            onClick={() => {
              api.setColumnsVisible([colId], false);
            }}
            disabled={api.getColumns()?.length === invisibleColumns.length + 1}
            icon={<Icons.EyeInvisibleOutlined iconSize="m" />}
          >
            {t('Hide Column')}
          </Menu.Item>
          {unHideAction}
        </Menu>
      }
    />
  );
};

export default HeaderMenu;
