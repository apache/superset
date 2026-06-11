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
import { styled } from '@apache-superset/core/theme';
import { Button, Dropdown, Icons } from '@superset-ui/core/components';
import type { ActivityRecord, VersionedEntityType } from './types';
import { describeRecord } from './display';

const Row = styled.div`
  ${({ theme }) => `
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: ${theme.sizeUnit}px;
    padding: ${theme.sizeUnit}px ${theme.sizeUnit * 2}px
      ${theme.sizeUnit}px ${theme.sizeUnit * 6}px;
    cursor: pointer;
    border-radius: ${theme.borderRadius}px;
    &:hover {
      background-color: ${theme.colorBgTextHover};
    }
  `}
`;

const Label = styled.span`
  ${({ theme }) => `
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: ${theme.fontSizeSM}px;
  `}
`;

export interface ActionRowProps {
  entityType: VersionedEntityType;
  record: ActivityRecord;
  onPreview: () => void;
  onRestore: () => void;
  onOpenAsNew: () => void;
}

export default function ActionRow({
  entityType,
  record,
  onPreview,
  onRestore,
  onOpenAsNew,
}: ActionRowProps) {
  const label = describeRecord(record);
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
        onRestore();
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
      <Label title={label}>{label}</Label>
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
    </Row>
  );
}
