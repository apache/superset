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
import { Button, Dropdown, Icons } from '@superset-ui/core/components';
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
const VISIBLE_RECORD_LIMIT = 10;

const Container = styled.div<{ isPreviewed: boolean }>`
  ${({ theme, isPreviewed }) => `
    border-bottom: 1px solid ${theme.colorBorderSecondary};
    background-color: ${isPreviewed ? theme.colorPrimaryBg : 'transparent'};
    border-radius: ${isPreviewed ? theme.borderRadius : 0}px;
    padding: ${theme.sizeUnit * 2}px 0 ${theme.sizeUnit * 4}px;
  `}
`;

const Header = styled.div`
  ${({ theme }) => `
    display: flex;
    align-items: center;
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

const IconWrapper = styled.span`
  ${({ theme }) => `
    color: ${theme.colorTextSecondary};
    display: flex;
  `}
`;

const ChevronWrapper = styled.span`
  ${({ theme }) => `
    color: ${theme.colorTextTertiary};
    display: flex;
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
  isPreviewed: boolean;
  onPreview: (group: SaveGroup) => void;
  onRestore: (group: SaveGroup) => void;
  onOpenAsNew: (group: SaveGroup) => void;
}

function GroupKebab({
  entityType,
  group,
  onRestore,
  onOpenAsNew,
}: Pick<
  SaveGroupItemProps,
  'entityType' | 'group' | 'onRestore' | 'onOpenAsNew'
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
  );
}

export default function SaveGroupItem({
  entityType,
  group,
  isPreviewed,
  onPreview,
  onRestore,
  onOpenAsNew,
}: SaveGroupItemProps) {
  const [expanded, setExpanded] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const headline = groupHeadline(entityType, group);
  const meta = `${formatAuthor(group.changedBy)} · ${formatVersionDateTimeShort(
    group.issuedAt,
  )}`;

  const activate =
    (handler: () => void) => (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handler();
      }
    };

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
          onClick={() => onPreview(group)}
          onKeyDown={activate(() => onPreview(group))}
          aria-label={headline}
        >
          <IconWrapper>
            <CategoryIcon iconSize="l" />
          </IconWrapper>
          <HeaderText>
            <Headline title={headline}>{headline}</Headline>
            <Meta>{meta}</Meta>
          </HeaderText>
          <GroupKebab
            entityType={entityType}
            group={group}
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
          <Headline title={headline}>{headline}</Headline>
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
              isPreviewed={isPreviewed}
              isLast={index === visibleRecords.length - 1 && hiddenCount === 0}
              onPreview={() => onPreview(group)}
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
