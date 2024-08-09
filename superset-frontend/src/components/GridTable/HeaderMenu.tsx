import { useCallback } from 'react';
import { css, t } from '@superset-ui/core';
import type { Column, ColumnPinnedType, GridApi } from 'ag-grid-community';

import Icons from 'src/components/Icons';
import { Dropdown, DropdownProps } from 'src/components/Dropdown';
import { Menu } from 'src/components/Menu';
import copyTextToClipboard from 'src/utils/copy';

type Params = {
  colId: string;
  column?: Column;
  api: GridApi;
  pinnedLeft?: boolean;
  pinnedRight?: boolean;
  invisibleColumns: Column[];
  isMain?: boolean;
  onVisibleChange: DropdownProps['onVisibleChange'];
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
      api.setColumnPinned(colId, pinLoc);
    },
    [api, colId],
  );

  const unHideAction = invisibleColumns.length > 0 && (
    <Menu.SubMenu
      title={
        <>
          <Icons.EyeOutlined iconSize="m" />
          {t('Unhide')}
        </>
      }
    >
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
          onClick={() => {
            api.setColumnVisible(c.getColId(), true);
          }}
        >
          {c.getColDef().headerName}
        </Menu.Item>
      ))}
    </Menu.SubMenu>
  );

  if (isMain) {
    return (
      <Dropdown
        placement="bottomLeft"
        trigger={['click']}
        onVisibleChange={onVisibleChange}
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
              css={css`
                display: flex;
                align-items: center;
              `}
            >
              <Icons.CopyOutlined iconSize="m" /> {t('Copy the current data')}
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
              css={css`
                display: flex;
                align-items: center;
              `}
            >
              <Icons.DownloadOutlined iconSize="m" /> {t('Download to CSV')}
            </Menu.Item>
            {invisibleColumns.length > 0 && <Menu.Divider />}
            {unHideAction}
          </Menu>
        }
      />
    );
  }

  return (
    <Dropdown
      placement="bottomRight"
      trigger={['click']}
      onVisibleChange={onVisibleChange}
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
            css={css`
              display: flex;
              align-items: center;
            `}
          >
            <Icons.CopyOutlined iconSize="m" /> {t('Copy')}
          </Menu.Item>
          {(pinnedLeft || pinnedRight) && (
            <Menu.Item
              onClick={() => pinColumn(null)}
              css={css`
                display: flex;
                align-items: center;
              `}
            >
              <Icons.UnlockOutlined iconSize="m" /> {t('Unpin')}
            </Menu.Item>
          )}
          {!pinnedLeft && (
            <Menu.Item
              onClick={() => pinColumn('left')}
              css={css`
                display: flex;
                align-items: center;
              `}
            >
              <Icons.VerticalRightOutlined iconSize="m" />
              {t('Pin Left')}
            </Menu.Item>
          )}
          {!pinnedRight && (
            <Menu.Item
              onClick={() => pinColumn('right')}
              css={css`
                display: flex;
                align-items: center;
              `}
            >
              <Icons.VerticalLeftOutlined iconSize="m" />
              {t('Pin Right')}
            </Menu.Item>
          )}
          <Menu.Divider />
          <Menu.Item
            onClick={() => {
              api.setColumnVisible(colId, false);
            }}
            css={css`
              display: flex;
              align-items: center;
            `}
            disabled={api.getColumns()?.length === invisibleColumns.length + 1}
          >
            <Icons.EyeInvisibleOutlined iconSize="m" />
            {t('Hide Column')}
          </Menu.Item>
          {unHideAction}
        </Menu>
      }
    />
  );
};

export default HeaderMenu;
