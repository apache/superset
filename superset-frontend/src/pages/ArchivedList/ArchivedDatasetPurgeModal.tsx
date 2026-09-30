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
import { useState } from 'react';
import { t } from '@apache-superset/core/translation';
import { styled } from '@apache-superset/core/theme';
import { Button, DeleteModal } from '@superset-ui/core/components';
import type {
  ArchivedDatasetPurgeModalState,
  PurgeImpactCollection,
  PurgeImpactItem,
} from './types';

const ImpactSection = styled.section`
  ${({ theme }) => `
    margin-top: ${theme.sizeUnit * 4}px;
  `}
`;

const ImpactHeading = styled.h4`
  margin-bottom: ${({ theme }) => theme.sizeUnit * 2}px;
`;

const ImpactList = styled.ul`
  margin-bottom: ${({ theme }) => theme.sizeUnit * 2}px;
  padding-left: ${({ theme }) => theme.sizeUnit * 5}px;
`;

const ArchivedMarker = styled.span`
  ${({ theme }) => `
    color: ${theme.colorTextSecondary};
    margin-left: ${theme.sizeUnit}px;
  `}
`;

const Message = styled.p`
  margin-top: ${({ theme }) => theme.sizeUnit * 3}px;
`;

const DEFAULT_VISIBLE_ITEMS = 5;

function ImpactItem({ item }: { item: PurgeImpactItem }) {
  // Only link server-issued application paths; anything else (absolute or
  // scheme-relative URLs, javascript: and data: schemes) renders as text.
  const isSafeAppPath = Boolean(
    item.url && item.url.startsWith('/') && !item.url.startsWith('//'),
  );
  const label =
    item.url && isSafeAppPath && !item.archived ? (
      <a href={item.url}>{item.name}</a>
    ) : (
      item.name
    );

  return (
    <li>
      {label}
      {item.archived && (
        <ArchivedMarker aria-label={t('Archived')}>
          {t('(archived)')}
        </ArchivedMarker>
      )}
    </li>
  );
}

function ImpactCollection({
  collection,
  singular,
  plural,
}: {
  collection: PurgeImpactCollection;
  singular: string;
  plural: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const visibleItems = expanded
    ? collection.result
    : collection.result.slice(0, DEFAULT_VISIBLE_ITEMS);
  const hasMore = collection.result.length > DEFAULT_VISIBLE_ITEMS;

  return (
    <ImpactSection>
      <ImpactHeading>
        {t('%(count)s %(label)s', {
          count: collection.count,
          label: collection.count === 1 ? singular : plural,
        })}
      </ImpactHeading>
      {collection.count === 0 ? (
        <p>{t('No affected %(label)s.', { label: plural.toLowerCase() })}</p>
      ) : (
        <>
          {visibleItems.length > 0 && (
            <ImpactList>
              {visibleItems.map(item => (
                <ImpactItem key={item.uuid} item={item} />
              ))}
            </ImpactList>
          )}
          {collection.restricted_count > 0 && (
            <p>
              {t('%(count)s additional restricted %(label)s', {
                count: collection.restricted_count,
                label: collection.restricted_count === 1 ? singular : plural,
              })}
            </p>
          )}
          {hasMore && (
            <Button
              buttonStyle="link"
              onClick={() => setExpanded(value => !value)}
            >
              {expanded ? t('Show fewer') : t('Show all')}
            </Button>
          )}
        </>
      )}
    </ImpactSection>
  );
}

export interface ArchivedDatasetPurgeModalProps {
  state: Exclude<ArchivedDatasetPurgeModalState, { status: 'closed' }>;
  onConfirm: () => void;
  onHide: () => void;
  onRetry: () => void;
}

export function ArchivedDatasetPurgeModal({
  state,
  onConfirm,
  onHide,
  onRetry,
}: ArchivedDatasetPurgeModalProps) {
  const name = String(state.item.table_name ?? '');
  const hasImpact =
    state.status === 'ready' ||
    state.status === 'submitting' ||
    state.status === 'changed';
  const impact = hasImpact ? state.impact : undefined;
  const unavailable = state.status === 'error';

  return (
    <DeleteModal
      open
      name="archived-dataset-purge"
      title={t('Delete permanently %(name)s?', { name })}
      description={
        <div aria-live="polite">
          {state.status === 'loading' && (
            <p>{t('Checking charts and dashboards that use this dataset…')}</p>
          )}
          {state.status === 'changed' && (
            <Message role="alert">
              {t(
                'The affected charts or dashboards changed. Review the updated impact and type DELETE again to continue.',
              )}
            </Message>
          )}
          {unavailable && (
            <>
              <Message role="alert">
                {t(
                  'The deletion impact could not be determined. This dataset cannot be permanently deleted until the check succeeds.',
                )}
              </Message>
              <Button onClick={onRetry}>{t('Retry')}</Button>
            </>
          )}
          {impact && (
            <>
              <p>
                {t(
                  'Deleting this dataset is permanent. The affected charts and dashboards will remain, but they may no longer work.',
                )}
              </p>
              <ImpactCollection
                collection={impact.charts}
                singular={t('Chart')}
                plural={t('Charts')}
              />
              <ImpactCollection
                collection={impact.dashboards}
                singular={t('Dashboard')}
                plural={t('Dashboards')}
              />
            </>
          )}
        </div>
      }
      disablePrimaryButton={state.status === 'loading' || unavailable}
      loading={state.status === 'submitting'}
      confirmationResetKey={
        impact ? `${state.status}:${impact.impact_token}` : state.status
      }
      onConfirm={onConfirm}
      onHide={onHide}
    />
  );
}
