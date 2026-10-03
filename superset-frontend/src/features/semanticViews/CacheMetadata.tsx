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
import { useEffect, useRef, useState } from 'react';
import { t } from '@apache-superset/core/translation';
import { SupersetClient } from '@superset-ui/core';
import { Button } from '@superset-ui/core/components';

type CacheKind = 'catalog' | 'compatibility';
interface CacheEntryInfo {
  kind: CacheKind;
  state: 'present' | 'missing' | 'disabled' | 'unsupported' | 'unavailable';
  inspected_at: string;
  created_at: string | null;
  source_observed_at: string | null;
  expiry_kind: 'finite' | 'none' | 'unknown';
  expires_at: string | null;
  remaining_ttl_seconds: number | null;
  expires_at_is_estimate: boolean;
}
type Entry = { kind: CacheKind; info?: CacheEntryInfo };
type Inspection =
  | { status: 'idle' | 'loading' }
  | { status: 'done'; entries: Entry[] };

/** On-demand observations; inspection never acquires or refreshes metadata. */
export default function CacheMetadata({ viewUuid }: { viewUuid: string }) {
  const [inspection, setInspection] = useState<Inspection>({ status: 'idle' });
  const request = useRef(0);
  const busy = useRef(false);
  useEffect(
    () => () => {
      request.current += 1;
    },
    [],
  );
  const inspect = async () => {
    if (busy.current) return;
    busy.current = true;
    request.current += 1;
    const { current } = request;
    setInspection({ status: 'loading' });
    const entries = await Promise.all(
      (['catalog', 'compatibility'] as const).map(async kind => {
        try {
          const { json } = await SupersetClient.post({
            endpoint: `/api/v1/semantic_view/${viewUuid}/cache_metadata/`,
            jsonPayload:
              kind === 'catalog'
                ? { kind }
                : { kind, selected_metrics: [], selected_dimensions: [] },
          });
          return { kind, info: json.result as CacheEntryInfo };
        } catch {
          return { kind };
        }
      }),
    );
    if (current !== request.current) return;
    busy.current = false;
    setInspection({ status: 'done', entries });
  };
  const states = {
    present: t('Present'),
    missing: t('Missing'),
    disabled: t('Disabled'),
    unsupported: t('Unsupported'),
    unavailable: t('Unavailable'),
  };
  return (
    <>
      <p>
        {t(
          'Inspect catalog and compatibility cache timing. Compatibility is inspected with no metrics or dimensions selected. No metadata is fetched from the provider.',
        )}
      </p>
      <Button
        aria-label={t('Inspect cache metadata')}
        buttonSize="small"
        onClick={inspect}
        disabled={inspection.status === 'loading'}
        loading={inspection.status === 'loading'}
      >
        {t('Inspect cache metadata')}
      </Button>
      {inspection.status === 'loading' && (
        <output>{t('Inspecting cache metadata…')}</output>
      )}
      {inspection.status === 'done' &&
        inspection.entries.map(({ kind, info }) => (
          <section
            key={kind}
            aria-label={
              kind === 'catalog' ? t('Catalog cache') : t('Compatibility cache')
            }
          >
            <h4>
              {kind === 'catalog'
                ? t('Catalog cache')
                : t('Compatibility cache')}
            </h4>
            {!info ? (
              <p role="alert">
                {t('Unable to inspect this cache. Try again later.')}
              </p>
            ) : (
              <dl>
                <dt>{t('State')}</dt>
                <dd>{states[info.state] ?? t('Unknown')}</dd>
                <dt>{t('Inspected at')}</dt>
                <dd>{info.inspected_at ?? t('Unknown')}</dd>
                <dt>{t('Created at')}</dt>
                <dd>{info.created_at ?? t('Unknown')}</dd>
                <dt>{t('Source observed at')}</dt>
                <dd>{info.source_observed_at ?? t('Unknown')}</dd>
                <dt>
                  {info.expires_at_is_estimate && info.expiry_kind === 'finite'
                    ? t('Estimated expiry')
                    : t('Expiry')}
                </dt>
                <dd>
                  {info.expiry_kind === 'none'
                    ? t('No expiry')
                    : info.expiry_kind === 'finite'
                      ? (info.expires_at ?? t('Unknown'))
                      : t('Unknown')}
                </dd>
                <dt>{t('Remaining seconds at inspection')}</dt>
                <dd>{info.remaining_ttl_seconds ?? t('Unknown')}</dd>
              </dl>
            )}
          </section>
        ))}
    </>
  );
}
