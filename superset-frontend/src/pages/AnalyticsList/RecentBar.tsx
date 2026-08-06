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
import { useEffect, useState } from 'react';
import { SupersetClient } from '@superset-ui/core';
import { styled } from '@apache-superset/core/theme';
import { t } from '@apache-superset/core/translation';
import { Icons } from '@superset-ui/core/components/Icons';
import { Tooltip } from '@superset-ui/core/components';
import rison from 'rison';

interface RecentItem {
  action: string;
  item_type: 'dashboard' | 'slice' | null;
  item_url: string | null;
  item_title: string | null;
  time_delta_humanized: string;
}

const RecentBarWrapper = styled.div`
  ${({ theme }) => `
    display: flex;
    align-items: center;
    gap: ${theme.sizeUnit * 2}px;
    padding: ${theme.sizeUnit * 2}px ${theme.sizeUnit * 4}px;
    overflow-x: auto;
    white-space: nowrap;

    &::-webkit-scrollbar {
      height: 4px;
    }
    &::-webkit-scrollbar-thumb {
      background: ${theme.colorBorderSecondary};
      border-radius: 2px;
    }
  `}
`;

const SectionLabel = styled.span`
  ${({ theme }) => `
    font-weight: ${theme.fontWeightStrong};
    font-size: ${theme.fontSizeSM}px;
    color: ${theme.colorTextSecondary};
    flex-shrink: 0;
  `}
`;

const RecentCard = styled.a`
  ${({ theme }) => `
    display: inline-flex;
    align-items: center;
    gap: ${theme.sizeUnit}px;
    padding: ${theme.sizeUnit}px ${theme.sizeUnit * 2}px;
    border: 1px solid ${theme.colorBorderSecondary};
    border-radius: ${theme.borderRadius}px;
    background: ${theme.colorBgContainer};
    color: ${theme.colorText};
    text-decoration: none;
    flex-shrink: 0;
    max-width: 200px;
    cursor: pointer;
    transition: border-color 0.2s;

    &:hover {
      border-color: ${theme.colorPrimary};
      color: ${theme.colorPrimary};
    }
  `}
`;

const CardTitle = styled.span`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const TimeAgo = styled.span`
  ${({ theme }) => `
    font-size: ${theme.fontSizeXS}px;
    color: ${theme.colorTextSecondary};
    flex-shrink: 0;
  `}
`;

export default function RecentBar() {
  const [items, setItems] = useState<RecentItem[]>([]);

  useEffect(() => {
    const q = rison.encode({
      page: 0,
      page_size: 10,
      distinct: true,
    });
    SupersetClient.get({
      endpoint: `/api/v1/log/recent_activity/?q=${q}`,
    }).then(
      ({ json }) => {
        const results = (json?.result ?? []) as RecentItem[];
        setItems(results.filter(r => r.item_url && r.item_title).slice(0, 8));
      },
      () => {},
    );
  }, []);

  if (items.length === 0) {
    return null;
  }

  return (
    <RecentBarWrapper>
      <SectionLabel>{t('Recent')}</SectionLabel>
      {items.map((item, idx) => (
        <Tooltip
          key={`${item.item_url}-${idx}`}
          title={`${item.item_title} — ${item.time_delta_humanized}`}
        >
          <RecentCard href={item.item_url ?? '#'}>
            {item.item_type === 'dashboard' ? (
              <Icons.LayoutOutlined iconSize="s" />
            ) : (
              <Icons.LineChartOutlined iconSize="s" />
            )}
            <CardTitle>{item.item_title}</CardTitle>
            <TimeAgo>{item.time_delta_humanized}</TimeAgo>
          </RecentCard>
        </Tooltip>
      ))}
    </RecentBarWrapper>
  );
}
