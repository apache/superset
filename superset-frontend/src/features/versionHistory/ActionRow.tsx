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
import { KeyboardEvent } from 'react';
import { t } from '@apache-superset/core/translation';
import { styled, useTheme } from '@apache-superset/core/theme';
import { Button, Dropdown, Icons } from '@superset-ui/core/components';
import type { ActivityRecord, VersionedEntityType } from './types';
import {
  describeRecord,
  formatAuthor,
  formatVersionDateTimeShort,
} from './display';

const Row = styled.div`
  ${({ theme }) => `
    display: flex;
    align-items: stretch;
    gap: ${theme.sizeUnit * 4}px;
    cursor: pointer;
    border-radius: ${theme.borderRadius}px;
    &:hover {
      background-color: ${theme.colorBgTextHover};
    }
  `}
`;

const Rail = styled.div`
  ${({ theme }) => `
    width: ${theme.sizeUnit * 4}px;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding-top: ${theme.sizeUnit * 1.5}px;
  `}
`;

const Dot = styled.span<{ isActive: boolean }>`
  ${({ theme, isActive }) => `
    width: ${theme.sizeUnit * 2.5}px;
    height: ${theme.sizeUnit * 2.5}px;
    flex-shrink: 0;
    border-radius: 50%;
    border: 2px solid ${isActive ? theme.colorPrimary : theme.colorBorder};
    background-color: ${theme.colorBgContainer};
  `}
`;

const Connector = styled.span`
  ${({ theme }) => `
    flex: 1;
    width: 1px;
    margin-top: ${theme.sizeUnit / 2}px;
    background-color: ${theme.colorSplit};
  `}
`;

const Content = styled.div`
  ${({ theme }) => `
    flex: 1;
    min-width: 0;
    padding-bottom: ${theme.sizeUnit * 5}px;
  `}
`;

const Title = styled.div`
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

const KebabWrapper = styled.div`
  ${({ theme }) => `
    padding: ${theme.sizeUnit}px 0;
  `}
`;

export interface ActionRowProps {
  entityType: VersionedEntityType;
  record: ActivityRecord;
  isPreviewed: boolean;
  isLast: boolean;
  onPreview: () => void;
  onRestore: () => void;
  onOpenAsNew: () => void;
}

export default function ActionRow({
  entityType,
  record,
  isPreviewed,
  isLast,
  onPreview,
  onRestore,
  onOpenAsNew,
}: ActionRowProps) {
  const theme = useTheme();
  const label = describeRecord(record);
  const meta = `${formatAuthor(record.changed_by)} · ${formatVersionDateTimeShort(
    record.issued_at,
  )}`;
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
        onRestore();
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
        onOpenAsNew();
      },
    },
  ];

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onPreview();
    }
  };

  return (
    <Row
      role="button"
      tabIndex={0}
      onClick={onPreview}
      onKeyDown={handleKeyDown}
      data-test="version-history-action-row"
    >
      <Rail>
        <Dot isActive={isPreviewed} />
        {!isLast && <Connector />}
      </Rail>
      <Content>
        <Title title={label}>{label}</Title>
        <Meta>{meta}</Meta>
      </Content>
      <KebabWrapper>
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
      </KebabWrapper>
    </Row>
  );
}
