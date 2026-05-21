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
import { memo, useMemo } from 'react';
import { css, useTheme } from '@apache-superset/core/theme';
import { t } from '@apache-superset/core/translation';
import { Dropdown, Icons } from '@superset-ui/core/components';
import { Tag } from 'src/components/Tag';
import type { MenuProps } from '@superset-ui/core/components/Menu';
import { Version } from '../types';
import { formatChangeTitle } from '../utils/formatChangeTitle';
import {
  formatVersionDate,
  formatVersionUser,
  isAiUser,
} from '../utils/formatVersionUser';

interface Props {
  version: Version;
  selected: boolean;
  isCurrent: boolean;
  onSelect: () => void;
  onRestore: () => void;
  onOpenAsNew?: () => void;
}

const VersionItem = ({
  version,
  selected,
  isCurrent,
  onSelect,
  onRestore,
  onOpenAsNew,
}: Props) => {
  const theme = useTheme();
  const ai = isAiUser(version.changed_by);

  const menuItems = useMemo<MenuProps['items']>(() => {
    const items: NonNullable<MenuProps['items']> = [];
    if (!isCurrent) {
      items.push({
        key: 'restore',
        label: t('Restore this version'),
        onClick: ({ domEvent }) => {
          domEvent.stopPropagation();
          onRestore();
        },
      });
    }
    if (onOpenAsNew) {
      items.push({
        key: 'open-as-new',
        label: t('Open as new'),
        onClick: ({ domEvent }) => {
          domEvent.stopPropagation();
          onOpenAsNew();
        },
      });
    }
    return items;
  }, [isCurrent, onOpenAsNew, onRestore]);

  return (
    <button
      type="button"
      onClick={onSelect}
      data-test="version-history-item"
      aria-pressed={selected}
      css={css`
        display: flex;
        width: 100%;
        gap: ${theme.sizeUnit * 2}px;
        padding: ${theme.sizeUnit * 2}px ${theme.sizeUnit * 3}px;
        text-align: left;
        background: ${selected ? theme.colorBgTextHover : 'transparent'};
        border: none;
        border-left: 3px solid ${selected ? theme.colorPrimary : 'transparent'};
        cursor: pointer;

        &:hover {
          background: ${theme.colorBgTextHover};
        }
      `}
    >
      <div
        css={css`
          flex: 1;
          min-width: 0;
        `}
      >
        <div
          css={css`
            display: flex;
            align-items: center;
            gap: ${theme.sizeUnit}px;
            font-weight: ${theme.fontWeightStrong};
            color: ${theme.colorText};
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          `}
          title={formatChangeTitle(version.changes)}
        >
          <span
            css={css`
              overflow: hidden;
              text-overflow: ellipsis;
            `}
          >
            {formatChangeTitle(version.changes)}
          </span>
          {ai && <Tag name={t('AI')} color="purple" />}
        </div>
        <div
          css={css`
            font-size: ${theme.fontSizeSM}px;
            color: ${theme.colorTextSecondary};
          `}
        >
          {formatVersionUser(version.changed_by)} ·{' '}
          {formatVersionDate(version.issued_at)}
        </div>
      </div>
      {menuItems && menuItems.length > 0 && (
        <span
          onClick={e => e.stopPropagation()}
          onKeyDown={e => e.stopPropagation()}
          role="presentation"
          css={css`
            display: inline-flex;
            align-items: center;
          `}
        >
          <Dropdown
            trigger={['click']}
            menu={{ items: menuItems }}
            placement="bottomRight"
          >
            <span
              role="button"
              aria-label={t('Version actions')}
              tabIndex={0}
              css={css`
                display: inline-flex;
                padding: ${theme.sizeUnit}px;
                cursor: pointer;
                color: ${theme.colorIcon};
                &:hover {
                  color: ${theme.colorIconHover};
                }
              `}
            >
              <Icons.MoreOutlined iconSize="l" />
            </span>
          </Dropdown>
        </span>
      )}
    </button>
  );
};

export default memo(VersionItem);
