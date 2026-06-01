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
import { memo, useCallback, useMemo } from 'react';
import { css, useTheme } from '@apache-superset/core/theme';
import { t } from '@apache-superset/core/translation';
import { Dropdown, Icons, Tag, Tooltip } from '@superset-ui/core/components';
import type { MenuProps } from '@superset-ui/core/components/Menu';
import { EntityType } from '../types';
import { ActivitySaveRow } from '../utils/groupActivity';
import { formatChangeTitle } from '../utils/formatChangeTitle';
import {
  formatVersionDate,
  formatVersionUser,
  isAiAuthor,
} from '../utils/formatVersionUser';
import { iconForSave, totalChartImpact } from '../utils/changeKindIcon';

interface Props {
  entityType: EntityType;
  save: ActivitySaveRow;
  selected: boolean;
  isCurrent: boolean;
  // Accept the row identity so the parent can pass a single stable
  // callback per list instead of per-row lambdas — keeps ``memo()``
  // below honest, otherwise every panel re-render breaks the bail-out
  // and re-renders every row.
  onSelect: (versionUuid: string) => void;
  onRestore: (save: ActivitySaveRow) => void;
  onOpenAsNew?: (save: ActivitySaveRow) => void;
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

  const handleSelect = useCallback(
    () => onSelect(save.version_uuid),
    [onSelect, save.version_uuid],
  );
  const handleRestoreClick = useCallback(
    () => onRestore(save),
    [onRestore, save],
  );
  const handleOpenAsNewClick = useCallback(() => {
    if (onOpenAsNew) onOpenAsNew(save);
  }, [onOpenAsNew, save]);

  const menuItems = useMemo<MenuProps['items']>(() => {
    const items: NonNullable<MenuProps['items']> = [];
    if (!isCurrent) {
      items.push({
        key: 'restore',
        label: t('Restore this version'),
        onClick: ({ domEvent }) => {
          domEvent.stopPropagation();
          handleRestoreClick();
        },
      });
    }
    if (onOpenAsNew) {
      items.push({
        key: 'open-as-new',
        label: openAsNewLabel,
        onClick: ({ domEvent }) => {
          domEvent.stopPropagation();
          handleOpenAsNewClick();
        },
      });
    }
    return items;
  }, [
    isCurrent,
    onOpenAsNew,
    handleRestoreClick,
    handleOpenAsNewClick,
    openAsNewLabel,
  ]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleSelect();
    }
  };

  const aiAuthored = isAiAuthor(save.changed_by);
  // Prefer a backend-supplied summary if any leaf record carries one
  // (rare for self records — they normally reconstruct via
  // ``formatChangeTitle`` — but the contract leaves it possible).
  const titleText = useMemo(() => {
    const supplied = save.changes.find(r => r.summary)?.summary;
    return supplied || formatChangeTitle(save.changes);
  }, [save.changes]);
  const leadingIcon = useMemo(() => iconForSave(save.changes), [save.changes]);
  const impactCharts = useMemo(
    () => totalChartImpact(save.changes),
    [save.changes],
  );

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
        onClick={handleSelect}
        onKeyDown={handleKeyDown}
        data-test="version-history-item"
        aria-selected={selected}
        css={css`
          flex: 1;
          min-width: 0;
          text-align: left;
          cursor: pointer;
          display: flex;
          gap: ${theme.sizeUnit * 2}px;
          &:focus {
            outline: 2px solid ${theme.colorPrimary};
            outline-offset: -2px;
          }
        `}
      >
        <div
          aria-hidden
          data-test="version-item-icon"
          css={css`
            display: inline-flex;
            align-items: center;
            color: ${theme.colorIcon};
            flex-shrink: 0;
          `}
        >
          {leadingIcon}
        </div>
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
            title={titleText}
          >
            <span
              css={css`
                overflow: hidden;
                text-overflow: ellipsis;
              `}
            >
              {titleText}
            </span>
            {impactCharts > 0 && (
              <Tooltip
                title={t('This affected %(count)s charts', {
                  count: impactCharts,
                })}
              >
                <span
                  role="img"
                  aria-label={t('Impact: %(count)s charts', {
                    count: impactCharts,
                  })}
                  data-test="version-item-impact"
                  css={css`
                    display: inline-flex;
                    color: ${theme.colorIcon};
                  `}
                >
                  <Icons.InfoCircleOutlined iconSize="s" />
                </span>
              </Tooltip>
            )}
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
