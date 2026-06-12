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
import { t } from '@apache-superset/core/translation';
import { styled } from '@apache-superset/core/theme';
import { Button, Dropdown, Icons } from '@superset-ui/core/components';
import type { SaveGroup, VersionedEntityType } from './types';
import { classifySaveGroup } from './grouping';
import { formatAuthor, formatRelativeTime, groupHeadline } from './display';
import ActionRow from './ActionRow';

const Container = styled.div<{ isPreviewed: boolean }>`
  ${({ theme, isPreviewed }) => `
    border-bottom: 1px solid ${theme.colorSplit};
    background-color: ${isPreviewed ? theme.colorSuccessBg : 'transparent'};
    padding-bottom: ${theme.sizeUnit}px;
  `}
`;

const Header = styled.div`
  ${({ theme }) => `
    display: flex;
    align-items: center;
    gap: ${theme.sizeUnit * 2}px;
    padding: ${theme.sizeUnit * 2}px;
    cursor: pointer;
    &:hover {
      background-color: ${theme.colorBgTextHover};
    }
  `}
`;

const HeaderText = styled.div`
  flex: 1;
  min-width: 0;
`;

const Headline = styled.div`
  ${({ theme }) => `
    font-size: ${theme.fontSizeSM}px;
    font-weight: ${theme.fontWeightStrong};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `}
`;

const Meta = styled.div`
  ${({ theme }) => `
    color: ${theme.colorTextTertiary};
    font-size: ${theme.fontSizeSM}px;
  `}
`;

const CaretWrapper = styled.span`
  ${({ theme }) => `
    color: ${theme.colorTextSecondary};
    display: flex;
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
  const menuItems = [
    {
      key: 'restore',
      label: t('Restore this version'),
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
      <Button
        buttonSize="xsmall"
        buttonStyle="link"
        aria-label={t('More actions')}
        onClick={event => event.stopPropagation()}
      >
        <Icons.MoreOutlined iconSize="m" />
      </Button>
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
  const headline = groupHeadline(entityType, group);
  const meta = `${formatAuthor(group.changedBy)} · ${formatRelativeTime(
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
          <CaretWrapper>
            <CategoryIcon iconSize="m" />
          </CaretWrapper>
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
        {hasRecords && (
          <CaretWrapper>
            {expanded ? (
              <Icons.DownOutlined iconSize="s" />
            ) : (
              <Icons.RightOutlined iconSize="s" />
            )}
          </CaretWrapper>
        )}
        <HeaderText>
          <Headline title={headline}>{headline}</Headline>
          <Meta>{meta}</Meta>
        </HeaderText>
      </Header>
      {expanded &&
        group.records.map(record => (
          <ActionRow
            key={`${record.kind}-${record.operation}-${JSON.stringify(
              record.path,
            )}`}
            entityType={entityType}
            record={record}
            onPreview={() => onPreview(group)}
            onRestore={() => onRestore(group)}
            onOpenAsNew={() => onOpenAsNew(group)}
          />
        ))}
    </Container>
  );
}
