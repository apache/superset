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
import { Tag } from '@superset-ui/core/components';
import { userHasPermission } from 'src/dashboard/util/permissionUtils';
import type { UserWithPermissionsAndRoles } from 'src/types/bootstrapTypes';
import { fetchList } from './api';
import { approvalsPath } from './approvalsPath';
import { ago, age, assetUrl, isStale } from './display';
import { displayName, STATUS_LABEL } from './types';
import type { ApprovalsView, ChangeRequest } from './types';

const Bar = styled.div`
  ${({ theme }) => `
    display: flex;
    align-items: center;
    gap: ${theme.sizeUnit * 3}px;
    margin-bottom: ${theme.sizeUnit * 3}px;
  `}
`;

const Switch = styled.button<{ active: boolean }>`
  ${({ theme, active }) => `
    background: ${active ? theme.colorPrimaryBg : 'transparent'};
    color: ${active ? theme.colorPrimary : theme.colorTextSecondary};
    font-weight: ${active ? theme.fontWeightStrong : theme.fontWeightNormal};
    border: none;
    cursor: pointer;
    padding: ${theme.sizeUnit}px ${theme.sizeUnit * 2}px;
    border-radius: ${theme.borderRadius}px;
  `}
`;

const Cards = styled.div`
  ${({ theme }) => `
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: ${theme.sizeUnit * 3}px;
  `}
`;

const Card = styled.a`
  ${({ theme }) => `
    display: block;
    border: 1px solid ${theme.colorSplit};
    border-radius: ${theme.borderRadius}px;
    padding: ${theme.sizeUnit * 3}px;
    color: ${theme.colorText};
    &:hover {
      border-color: ${theme.colorPrimary};
      color: ${theme.colorText};
    }
  `}
`;

const Title = styled.div`
  ${({ theme }) => `
    font-weight: ${theme.fontWeightStrong};
    margin-bottom: ${theme.sizeUnit}px;
    word-break: break-word;
  `}
`;

const Meta = styled.div<{ stale?: boolean }>`
  ${({ theme, stale }) => `
    font-size: ${theme.fontSizeSM}px;
    color: ${stale ? theme.colorWarningText : theme.colorTextTertiary};
    margin-top: ${theme.sizeUnit}px;
  `}
`;

const Empty = styled.div`
  ${({ theme }) => `
    padding: ${theme.sizeUnit * 6}px;
    text-align: center;
    color: ${theme.colorTextTertiary};
  `}
`;

const Footer = styled.div`
  ${({ theme }) => `
    margin-top: ${theme.sizeUnit * 3}px;
  `}
`;

/**
 * The asset kinds a change can be made to, and so reviewed on.
 *
 * Review is between editors of an asset, and editing one needs the right to
 * write it. A principal with none of these (a viewer) can neither submit a
 * change nor approve one, so a reviewer's queue is not theirs to be shown.
 */
const REVIEWABLE_VIEWS = ['Dashboard', 'Chart', 'Dataset'] as const;

/**
 * Whether this person could take part in review at all.
 *
 * Not "is there anything pending": an editor with an empty queue is a normal
 * state and gets an empty message. This is the other question, whether the
 * section has any business on their Home. The page uses it to leave the
 * section out entirely, because hiding the body of a section leaves its
 * header behind, collapsed over nothing.
 */
export function canTakePartInReview(
  user: UserWithPermissionsAndRoles | undefined,
): boolean {
  if (!user) return false;
  return REVIEWABLE_VIEWS.some(view => userHasPermission(user, view, 'can_write'));
}

type Load = 'loading' | 'ready' | 'failed';

/**
 * Pending reviews on Home.
 *
 * Two of the four Approvals views, because these are the two a person has a
 * reason to look at unprompted: what needs them, and what they are waiting
 * on. The other two are a destination, not a homepage glance, and the
 * footer link goes there.
 */
export default function PendingReviews({
  user,
}: {
  /** When given, someone who cannot take part in review is shown nothing. */
  user?: UserWithPermissionsAndRoles;
}) {
  const [view, setView] = useState<ApprovalsView>('for_me');
  const [rows, setRows] = useState<ChangeRequest[]>([]);
  const [status, setStatus] = useState<Load>('loading');
  const participates = user === undefined || canTakePartInReview(user);

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const all = await fetchList(view);
      setRows(view === 'submitted_by_me' ? all.filter(r => r.is_open) : all);
      setStatus('ready');
    } catch {
      // A queue that could not be read is not an empty one. It used to say
      // "Nothing needs you right now", which tells a reviewer with work
      // waiting that there is none.
      setRows([]);
      setStatus('failed');
    }
  }, [view]);

  useEffect(() => {
    // A viewer has no queue, so none is asked for.
    if (participates) load();
  }, [load, participates]);

  if (!participates) return null;

  return (
    <div data-test="home-pending-reviews">
      <Bar>
        <Switch
          active={view === 'for_me'}
          onClick={() => setView('for_me')}
          data-test="home-reviews-for-me"
        >
          {t('For me')}
        </Switch>
        <Switch
          active={view === 'submitted_by_me'}
          onClick={() => setView('submitted_by_me')}
          data-test="home-reviews-mine"
        >
          {t('Submitted by me')}
        </Switch>
      </Bar>

      {status === 'loading' ? (
        <Empty data-test="home-reviews-loading">{t('Loading…')}</Empty>
      ) : status === 'failed' ? (
        <Empty data-test="home-reviews-failed">
          {t('Pending reviews could not be loaded. Try again shortly.')}
        </Empty>
      ) : rows.length === 0 ? (
        <Empty data-test="home-reviews-empty">
          {view === 'for_me'
            ? t('Nothing needs you right now')
            : t('You have no changes in flight')}
        </Empty>
      ) : (
        <Cards>
          {rows.map(row => (
            <Card key={row.id} href={assetUrl(row)}>
              <Title>
                {row.asset_title ?? `${row.asset_type} ${row.asset_id}`}
              </Title>
              <Tag>{STATUS_LABEL[row.status]}</Tag>
              <Meta stale={row.status === 'pending' && isStale(row)}>
                {row.status === 'pending'
                  ? t(
                      '%s · waiting %s',
                      displayName(row.author),
                      age(row.submitted_at),
                    )
                  : t('%s · %s', displayName(row.author), ago(row.changed_on))}
              </Meta>
            </Card>
          ))}
        </Cards>
      )}

      <Footer>
        <a href={approvalsPath()}>{t('View all approvals')}</a>
      </Footer>
    </div>
  );
}
