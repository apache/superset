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
import { Dropdown, Icons, Tag } from '@superset-ui/core/components';
import type { MenuProps } from '@superset-ui/core/components/Menu';
import { EntityType } from '../types';
import { ActivitySaveRow } from '../utils/groupActivity';
import { formatChangeTitle } from '../utils/formatChangeTitle';
import {
  formatVersionDate,
  formatVersionUser,
  isAiAuthor,
} from '../utils/formatVersionUser';

interface Props {
  entityType: EntityType;
  save: ActivitySaveRow;
  selected: boolean;
  isCurrent: boolean;
  onSelect: () => void;
  onRestore: () => void;
  onOpenAsNew?: () => void;
}

const VersionItem = ({
  entityType,
  save,
  selected,
  isCurrent,
  onSelect,
  onRestore,
  onOpenAsNew,
}: Props) => {
  const theme = useTheme();
  const openAsNewLabel =
    entityType === 'chart'
      ? t('Open as new chart')
      : t('Open as new dashboard');

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
        label: openAsNewLabel,
        onClick: ({ domEvent }) => {
          domEvent.stopPropagation();
          onOpenAsNew();
        },
      });
    }
    return items;
  }, [isCurrent, onOpenAsNew, onRestore, openAsNewLabel]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect();
    }
  };

  const aiAuthored = isAiAuthor(save.changed_by);

  return (
    <div
      css={css`
        display: flex;
        width: 100%;
        gap: ${theme.sizeUnit * 2}px;
        padding: ${theme.sizeUnit * 2}px ${theme.sizeUnit * 3}px;
        background: ${selected ? theme.colorBgTextHover : 'transparent'};
        border-left: 3px solid ${selected ? theme.colorPrimary : 'transparent'};

        &:hover {
          background: ${theme.colorBgTextHover};
        }
      `}
    >
      <div
        role="option"
        tabIndex={0}
        onClick={onSelect}
        onKeyDown={handleKeyDown}
        data-test="version-history-item"
        aria-selected={selected}
        css={css`
          flex: 1;
          min-width: 0;
          text-align: left;
          cursor: pointer;
          &:focus {
            outline: 2px solid ${theme.colorPrimary};
            outline-offset: -2px;
          }
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
          title={formatChangeTitle(save.changes)}
        >
          <span
            css={css`
              overflow: hidden;
              text-overflow: ellipsis;
            `}
          >
            {formatChangeTitle(save.changes)}
          </span>
        </div>
        <div
          css={css`
            display: flex;
            align-items: center;
            gap: ${theme.sizeUnit}px;
            font-size: ${theme.fontSizeSM}px;
            color: ${theme.colorTextSecondary};
          `}
        >
          <span>
            {formatVersionUser(save.changed_by)} ·{' '}
            {formatVersionDate(save.issued_at)}
          </span>
          {aiAuthored && (
            <Tag color="purple" data-test="version-item-ai-tag">
              {t('AI')}
            </Tag>
          )}
        </div>
      </div>
      {menuItems && menuItems.length > 0 && (
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
              align-items: center;
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
      )}
    </div>
  );
};

export default memo(VersionItem);
