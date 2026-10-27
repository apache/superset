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
import { useCallback, useEffect, useState } from 'react';
import { t } from '@apache-superset/core/translation';
import { styled } from '@apache-superset/core/theme';
import { isFeatureEnabled, FeatureFlag } from '@superset-ui/core';
import { Badge, Popover } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import { fetchList, fetchPendingCount } from './api';
import { approvalsPath } from './approvalsPath';
import { ago, isStale } from './display';
import { displayName } from './types';
import type { ChangeRequest, PendingCount } from './types';

const Trigger = styled.button`
  ${({ theme }) => `
    background: none;
    border: none;
    cursor: pointer;
    padding: 0 ${theme.sizeUnit * 2}px;
    display: flex;
    align-items: center;
    color: ${theme.colorTextSecondary};
    &:hover { color: ${theme.colorText}; }
  `}
`;

const PanelBody = styled.div`
  width: 360px;
  max-height: 420px;
  overflow-y: auto;
`;

const GroupTitle = styled.div`
  ${({ theme }) => `
    text-transform: uppercase;
    letter-spacing: 0.04em;
    font-size: ${theme.fontSizeSM}px;
    color: ${theme.colorTextTertiary};
    padding: ${theme.sizeUnit * 2}px ${theme.sizeUnit * 3}px ${theme.sizeUnit}px;
  `}
`;

const Item = styled.a`
  ${({ theme }) => `
    display: block;
    padding: ${theme.sizeUnit * 2}px ${theme.sizeUnit * 3}px;
    color: ${theme.colorText};
    &:hover { background: ${theme.colorBgTextHover}; color: ${theme.colorText}; }
  `}
`;

const Meta = styled.div<{ stale?: boolean }>`
  ${({ theme, stale }) => `
    font-size: ${theme.fontSizeSM}px;
    color: ${stale ? theme.colorWarningText : theme.colorTextTertiary};
  `}
`;

const Footer = styled.div`
  ${({ theme }) => `
    border-top: 1px solid ${theme.colorSplit};
    padding: ${theme.sizeUnit * 2}px ${theme.sizeUnit * 3}px;
    text-align: center;
  `}
`;

const Empty = styled.div`
  ${({ theme }) => `
    padding: ${theme.sizeUnit * 6}px;
    text-align: center;
    color: ${theme.colorTextTertiary};
  `}
`;

const ASSET_PATH: Record<string, string> = {
  dashboard: '/superset/dashboard',
  chart: '/explore/?slice_id=',
  dataset: '/tablemodelview/list',
};

function linkTo(changeRequest: ChangeRequest): string {
  if (changeRequest.asset_type === 'dashboard') {
    return `${ASSET_PATH.dashboard}/${changeRequest.asset_id}/`;
  }
  if (changeRequest.asset_type === 'chart') {
    return `${ASSET_PATH.chart}${changeRequest.asset_id}`;
  }
  return ASSET_PATH.dataset;
}

/**
 * The review bell.
 *
 * The number counts only what needs *this* person: reviews waiting on them
 * plus their own changes that came back. Not things they merely participated
 * in, and not unread events -- a badge that mixes to-dos with activity stops
 * meaning anything and stops being actionable (Decision 9). Hidden entirely
 * at zero, and there is no mark-as-read: the count drops when the underlying
 * state changes, which is the only thing that should clear it.
 */
export default function NotificationBell() {
  const enabled = isFeatureEnabled(FeatureFlag.ChangeManagement);
  const [count, setCount] = useState<PendingCount>({
    needs_me: 0,
    returned: 0,
  });
  const [items, setItems] = useState<ChangeRequest[]>([]);
  const [returned, setReturned] = useState<ChangeRequest[]>([]);

  const refreshCount = useCallback(async () => {
    if (!enabled) return;
    try {
      setCount(await fetchPendingCount());
    } catch {
      // A count that cannot be read is not worth an error in the navbar.
      setCount({ needs_me: 0, returned: 0 });
    }
  }, [enabled]);

  useEffect(() => {
    refreshCount();
  }, [refreshCount]);

  const loadItems = useCallback(async () => {
    try {
      const [forMe, mine] = await Promise.all([
        fetchList('for_me'),
        fetchList('submitted_by_me'),
      ]);
      setItems(forMe);
      setReturned(mine.filter(c => c.status === 'changes_requested'));
    } catch {
      setItems([]);
      setReturned([]);
    }
  }, []);

  if (!enabled) return null;

  const total = count.needs_me + count.returned;

  const content = (
    <PanelBody data-test="review-bell-panel">
      {items.length === 0 && returned.length === 0 ? (
        <Empty>{t("You're all caught up")}</Empty>
      ) : null}

      {items.length > 0 ? (
        <>
          <GroupTitle>{t('Needs your review')}</GroupTitle>
          {items.map(c => (
            <Item key={`r-${c.id}`} href={linkTo(c)}>
              <div>{c.asset_title ?? `${c.asset_type} ${c.asset_id}`}</div>
              <Meta stale={isStale(c)}>
                {t(
                  '%s · waiting %s',
                  displayName(c.author),
                  ago(c.submitted_at),
                )}
              </Meta>
            </Item>
          ))}
        </>
      ) : null}

      {returned.length > 0 ? (
        <>
          <GroupTitle>{t('Returned to you')}</GroupTitle>
          {returned.map(c => (
            <Item key={`b-${c.id}`} href={linkTo(c)}>
              <div>{c.asset_title ?? `${c.asset_type} ${c.asset_id}`}</div>
              <Meta>
                {t(
                  '%s requested changes · %s',
                  displayName(c.reviewer),
                  ago(c.decided_at),
                )}
              </Meta>
            </Item>
          ))}
        </>
      ) : null}

      <Footer>
        <a href={approvalsPath()}>{t('View all approvals')}</a>
      </Footer>
    </PanelBody>
  );

  return (
    <Popover
      // Antd clones this child and attaches its own click handler, which
      // replaces any onClick set here -- an earlier attempt to load the
      // items from the button's own onClick never ran for that reason, and
      // the panel always rendered its empty state. The load belongs in
      // onOpenChange, which is antd's own hook and does fire.
      onOpenChange={next => {
        if (next) loadItems();
        else refreshCount();
      }}
      trigger="click"
      placement="bottomRight"
      content={content}
    >
      <Trigger
        aria-label={
          total > 0
            ? t(
                'Notifications · %s changes need your review · %s returned',
                count.needs_me,
                count.returned,
              )
            : t('Notifications')
        }
        data-test="review-bell"
      >
        <Badge count={total} size="small" overflowCount={9}>
          <Icons.BellOutlined iconSize="l" />
        </Badge>
      </Trigger>
    </Popover>
  );
}
