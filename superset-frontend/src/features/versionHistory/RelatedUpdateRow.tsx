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
import { ComponentType } from 'react';
import { t } from '@apache-superset/core/translation';
import { styled } from '@apache-superset/core/theme';
import { Icons } from '@superset-ui/core/components';
import type { IconType } from '@superset-ui/core/components/Icons/types';
import type { ActivityEntityKind, ActivityRecord } from './types';
import {
  entityDisplayName,
  formatAuthor,
  formatVersionDateTimeShort,
  relatedHeadline,
} from './display';

const ENTITY_ICON: Record<ActivityEntityKind, ComponentType<IconType>> = {
  chart: Icons.BarChartOutlined,
  dashboard: Icons.DashboardOutlined,
  dataset: Icons.TableOutlined,
};

const Row = styled.div`
  ${({ theme }) => `
    display: flex;
    align-items: flex-start;
    gap: ${theme.sizeUnit * 2}px;
    padding: ${theme.sizeUnit * 2}px 0 ${theme.sizeUnit * 4}px;
    border-bottom: 1px solid ${theme.colorBorderSecondary};
  `}
`;

// The icon centers within the first text line (one line-height tall)
// so it tracks the headline, not the middle of the two-line block.
const IconWrapper = styled.span`
  ${({ theme }) => `
    color: ${theme.colorTextSecondary};
    display: flex;
    align-items: center;
    height: ${theme.fontSize * theme.lineHeight}px;
  `}
`;

const Content = styled.div`
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
    overflow-wrap: anywhere;
  `}
`;

const NameLink = styled.button`
  ${({ theme }) => `
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    color: ${theme.colorPrimary};
    font-size: ${theme.fontSize}px;
    &:hover {
      text-decoration: underline;
    }
  `}
`;

const Meta = styled.div`
  ${({ theme }) => `
    color: ${theme.colorTextQuaternary};
    font-size: ${theme.fontSizeSM}px;
    line-height: ${theme.lineHeightSM};
  `}
`;

export interface RelatedUpdateRowProps {
  record: ActivityRecord;
  onOpen?: (record: ActivityRecord) => void;
}

export default function RelatedUpdateRow({
  record,
  onOpen,
}: RelatedUpdateRowProps) {
  const Icon = ENTITY_ICON[record.entity_kind] ?? Icons.FileOutlined;
  const headline = relatedHeadline(record);
  const entityName = entityDisplayName(record);
  const linkable = !record.entity_deleted && Boolean(onOpen);
  // Both the server summary and the impact-aware phrasing end with the
  // entity name; split it out so the name can render as a link. Records
  // without a name can't be split (the empty string matches anywhere).
  const nameIndex =
    linkable && record.entity_name
      ? headline.lastIndexOf(record.entity_name)
      : -1;

  return (
    <Row data-test="version-history-related-row">
      <IconWrapper>
        <Icon iconSize="l" />
      </IconWrapper>
      <Content>
        <Headline>
          {nameIndex >= 0 ? (
            <>
              {headline.slice(0, nameIndex)}
              <NameLink type="button" onClick={() => onOpen?.(record)}>
                {entityName}
              </NameLink>
              {headline.slice(nameIndex + record.entity_name.length)}
            </>
          ) : (
            headline
          )}
          {record.entity_deleted && ` (${t('deleted')})`}
        </Headline>
        <Meta>
          {formatAuthor(record.changed_by)} ·{' '}
          {formatVersionDateTimeShort(record.issued_at)}
        </Meta>
      </Content>
    </Row>
  );
}
