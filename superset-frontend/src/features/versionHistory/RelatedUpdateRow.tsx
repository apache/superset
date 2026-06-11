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
import type { ActivityEntityKind, ActivityRecord } from './types';
import { formatAuthor, formatRelativeTime, relatedHeadline } from './display';

const ENTITY_ICON: Record<ActivityEntityKind, ComponentType<any>> = {
  chart: Icons.BarChartOutlined,
  dashboard: Icons.DashboardOutlined,
  dataset: Icons.TableOutlined,
};

const Row = styled.div`
  ${({ theme }) => `
    display: flex;
    gap: ${theme.sizeUnit * 2}px;
    padding: ${theme.sizeUnit * 2}px;
    border-bottom: 1px solid ${theme.colorSplit};
  `}
`;

const IconWrapper = styled.span`
  ${({ theme }) => `
    color: ${theme.colorTextSecondary};
    padding-top: ${theme.sizeUnit / 2}px;
  `}
`;

const Content = styled.div`
  flex: 1;
  min-width: 0;
`;

const Headline = styled.div`
  ${({ theme }) => `
    font-size: ${theme.fontSizeSM}px;
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
    font-size: ${theme.fontSizeSM}px;
    &:hover {
      text-decoration: underline;
    }
  `}
`;

const Meta = styled.div`
  ${({ theme }) => `
    color: ${theme.colorTextTertiary};
    font-size: ${theme.fontSizeSM}px;
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
  const linkable = !record.entity_deleted && Boolean(onOpen);
  // Both the server summary and the impact-aware phrasing end with the
  // entity name; split it out so the name can render as a link.
  const nameIndex = linkable ? headline.lastIndexOf(record.entity_name) : -1;

  return (
    <Row data-test="version-history-related-row">
      <IconWrapper>
        <Icon iconSize="m" />
      </IconWrapper>
      <Content>
        <Headline>
          {nameIndex >= 0 ? (
            <>
              {headline.slice(0, nameIndex)}
              <NameLink type="button" onClick={() => onOpen?.(record)}>
                {record.entity_name}
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
          {formatRelativeTime(record.issued_at)}
        </Meta>
      </Content>
    </Row>
  );
}
