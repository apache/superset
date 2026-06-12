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
import { KeyboardEvent, useState } from 'react';
import { t, tn } from '@apache-superset/core/translation';
import { styled, useTheme } from '@apache-superset/core/theme';
import { Button, Dropdown, Icons, Tag } from '@superset-ui/core/components';
import type { SaveGroup, VersionedEntityType } from './types';
import { classifySaveGroup } from './grouping';
import {
  formatAuthor,
  formatVersionDateTimeShort,
  groupHeadline,
} from './display';
import ActionRow from './ActionRow';

/**
 * The first chart save serializes the full form_data and can fan out
 * into dozens of records; cap the initially visible rows per group.
 */
// TODO(version-history): backend workaround — remove when upstream stops
// exploding the full form_data into per-field records on the first save.
const VISIBLE_RECORD_LIMIT = 10;

// The highlighted container gains inner padding but extends outward by
// the same amount (negative margin) so its text stays column-aligned
// with non-highlighted neighbors.
const Container = styled.div<{ isPreviewed: boolean }>`
  ${({ theme, isPreviewed }) => {
    const inset = isPreviewed ? theme.sizeUnit * 3 : 0;
    return `
      border-bottom: 1px solid ${theme.colorBorderSecondary};
      background-color: ${isPreviewed ? theme.colorPrimaryBg : 'transparent'};
      border-radius: ${isPreviewed ? theme.borderRadius : 0}px;
      padding: ${theme.sizeUnit * 2}px ${inset}px ${theme.sizeUnit * 4}px;
      margin: 0 ${-inset}px;
    `;
  }}
`;

const Header = styled.div`
  ${({ theme }) => `
    display: flex;
    align-items: flex-start;
    gap: ${theme.sizeUnit * 2}px;
    padding: ${theme.sizeUnit * 3}px 0;
    cursor: pointer;
  `}
`;

const HeaderText = styled.div`
  ${({ theme }) => `
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: ${theme.sizeUnit * 2}px;
  `}
`;

const HeadlineRow = styled.div`
  ${({ theme }) => `
    display: flex;
    align-items: center;
    gap: ${theme.sizeUnit * 2}px;
    min-width: 0;
  `}
`;

const Headline = styled.div`
  ${({ theme }) => `
    font-size: ${theme.fontSize}px;
    line-height: ${theme.lineHeight};
    color: ${theme.colorText};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `}
`;

const Meta = styled.div`
  ${({ theme }) => `
    color: ${theme.colorTextQuaternary};
    font-size: ${theme.fontSizeSM}px;
    line-height: ${theme.lineHeightSM};
  `}
`;

// Icons and trailing controls center within the first text line (one
// line-height tall) so they track the headline, not the middle of a
// two-line header block.
const IconWrapper = styled.span`
  ${({ theme }) => `
    color: ${theme.colorTextSecondary};
    display: flex;
    align-items: center;
    height: ${theme.fontSize * theme.lineHeight}px;
  `}
`;

const ChevronWrapper = styled.span`
  ${({ theme }) => `
    color: ${theme.colorTextTertiary};
    display: flex;
    align-items: center;
    height: ${theme.fontSize * theme.lineHeight}px;
  `}
`;

const KebabSlot = styled.span`
  ${({ theme }) => `
    display: flex;
    align-items: center;
    height: ${theme.fontSize * theme.lineHeight}px;
  `}
`;

// Icon-only trigger: neutral icon color instead of the link-button blue.
const KebabButton = styled(Button)`
  ${({ theme }) => `
    && {
      color: ${theme.colorTextTertiary};
    }
    &&:hover,
    &&:focus {
      color: ${theme.colorText};
    }
  `}
`;

const ExpanderRow = styled.div`
  ${({ theme }) => `
    padding-left: ${theme.sizeUnit * 8}px;
  `}
`;

export interface SaveGroupItemProps {
  entityType: VersionedEntityType;
  group: SaveGroup;
  /** The newest self save: it IS the live state, not a historical one. */
  isCurrent: boolean;
  isPreviewed: boolean;
  onPreview: (group: SaveGroup) => void;
  /** Leave an active historical preview (back to the live version). */
  onExitPreview?: () => void;
  onRestore: (group: SaveGroup) => void;
  onOpenAsNew: (group: SaveGroup) => void;
}

function GroupKebab({
  entityType,
  group,
  isCurrent,
  onRestore,
  onOpenAsNew,
}: Pick<
  SaveGroupItemProps,
  'entityType' | 'group' | 'isCurrent' | 'onRestore' | 'onOpenAsNew'
>) {
  const theme = useTheme();
  const itemStyle = {
    height: theme.controlHeightLG,
    paddingLeft: theme.sizeUnit * 6,
    paddingRight: theme.sizeUnit * 6,
    display: 'flex',
    alignItems: 'center',
  };
  const menuItems = [
    // Restoring the live version is a no-op; offer it only on history.
    ...(isCurrent
      ? []
      : [
          {
            key: 'restore',
            label: t('Restore this version'),
            style: itemStyle,
            onClick: ({
              domEvent,
            }: {
              domEvent: { stopPropagation: () => void };
            }) => {
              domEvent.stopPropagation();
              onRestore(group);
            },
          },
        ]),
    {
      key: 'open-as-new',
      label:
        entityType === 'chart'
          ? t('Open as new chart')
          : t('Open as new dashboard'),
      style: itemStyle,
      onClick: ({
        domEvent,
      }: {
        domEvent: { stopPropagation: () => void };
      }) => {
        domEvent.stopPropagation();
        onOpenAsNew(group);
      },
    },
  ];
  return (
    <KebabSlot>
      <Dropdown menu={{ items: menuItems }} trigger={['click']}>
        <KebabButton
          buttonSize="xsmall"
          buttonStyle="link"
          aria-label={t('More actions')}
          onClick={event => event.stopPropagation()}
        >
          <Icons.MoreOutlined iconSize="m" />
        </KebabButton>
      </Dropdown>
    </KebabSlot>
  );
}

export default function SaveGroupItem({
  entityType,
  group,
  isCurrent,
  isPreviewed,
  onPreview,
  onExitPreview,
  onRestore,
  onOpenAsNew,
}: SaveGroupItemProps) {
  const [expanded, setExpanded] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const headline = groupHeadline(entityType, group);
  const meta = `${formatAuthor(group.changedBy)} · ${formatVersionDateTimeShort(
    group.issuedAt,
  )}`;

  // The current version is the live state: there is nothing to preview,
  // and selecting it while previewing an older version exits the preview.
  const previewIntent = () => {
    if (isCurrent) {
      onExitPreview?.();
    } else {
      onPreview(group);
    }
  };

  const activate =
    (handler: () => void) => (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handler();
      }
    };

  const currentTag = isCurrent ? <Tag>{t('Current')}</Tag> : null;

  if (entityType === 'dashboard') {
    const CategoryIcon =
      classifySaveGroup(group) === 'filters'
        ? Icons.FilterOutlined
        : Icons.EditOutlined;
    return (
      <Container
        isPreviewed={isPreviewed}
        data-test="version-history-save-group"
      >
        <Header
          role="button"
          tabIndex={0}
          onClick={previewIntent}
          onKeyDown={activate(previewIntent)}
          aria-label={headline}
        >
          <IconWrapper>
            <CategoryIcon iconSize="l" />
          </IconWrapper>
          <HeaderText>
            <HeadlineRow>
              <Headline title={headline}>{headline}</Headline>
              {currentTag}
            </HeadlineRow>
            <Meta>{meta}</Meta>
          </HeaderText>
          <GroupKebab
            entityType={entityType}
            group={group}
            isCurrent={isCurrent}
            onRestore={onRestore}
            onOpenAsNew={onOpenAsNew}
          />
        </Header>
      </Container>
    );
  }

  const hasRecords = group.records.length > 0;
  const toggleExpanded = () => {
    if (hasRecords) {
      setExpanded(value => !value);
    }
  };

  const visibleRecords = showAll
    ? group.records
    : group.records.slice(0, VISIBLE_RECORD_LIMIT);
  const hiddenCount = group.records.length - visibleRecords.length;

  return (
    <Container isPreviewed={isPreviewed} data-test="version-history-save-group">
      <Header
        role="button"
        tabIndex={0}
        onClick={toggleExpanded}
        onKeyDown={activate(toggleExpanded)}
        aria-expanded={hasRecords ? expanded : undefined}
        aria-label={headline}
      >
        <IconWrapper>
          <Icons.CalendarOutlined iconSize="l" />
        </IconWrapper>
        <HeaderText>
          <HeadlineRow>
            <Headline title={headline}>{headline}</Headline>
            {currentTag}
          </HeadlineRow>
        </HeaderText>
        {hasRecords && (
          <ChevronWrapper>
            {expanded ? (
              <Icons.UpOutlined iconSize="m" />
            ) : (
              <Icons.DownOutlined iconSize="m" />
            )}
          </ChevronWrapper>
        )}
      </Header>
      {expanded && (
        <>
          {visibleRecords.map((record, index) => (
            <ActionRow
              key={`${record.kind}-${record.operation}-${JSON.stringify(
                record.path,
              )}`}
              entityType={entityType}
              record={record}
              showRestore={!isCurrent}
              isPreviewed={isPreviewed}
              isLast={index === visibleRecords.length - 1 && hiddenCount === 0}
              onPreview={previewIntent}
              onRestore={() => onRestore(group)}
              onOpenAsNew={() => onOpenAsNew(group)}
            />
          ))}
          {hiddenCount > 0 && (
            <ExpanderRow>
              <Button
                buttonSize="xsmall"
                buttonStyle="link"
                onClick={() => setShowAll(true)}
              >
                {tn(
                  'Show %s more change',
                  'Show %s more changes',
                  hiddenCount,
                  hiddenCount,
                )}
              </Button>
            </ExpanderRow>
          )}
        </>
      )}
    </Container>
  );
}
