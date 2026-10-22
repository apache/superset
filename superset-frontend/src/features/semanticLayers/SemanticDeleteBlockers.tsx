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
import { t } from '@apache-superset/core/translation';
import { Alert } from '@apache-superset/core/components';
import { ensureAppRoot } from 'src/utils/navigationUtils';

interface Dependent {
  type: string;
  id: number;
  name: string;
  archived?: boolean;
}

export interface SemanticDeleteError {
  error: string;
  total?: number;
  archived_count?: number;
  inaccessible_count?: number;
  dependents?: Dependent[];
}

const typeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    chart: t('chart'),
    dashboard: t('dashboard'),
    alert: t('alert'),
    report: t('report'),
  };
  return labels[type] ?? type;
};

const LIVE_LINKS: Record<string, (id: number) => string> = {
  chart: id => `/explore/?slice_id=${id}`,
  dashboard: id => `/superset/dashboard/${id}/`,
};

/** The refusal shown inside a semantic layer or view delete dialog. */
export default function SemanticDeleteBlockers({
  error,
}: {
  error: SemanticDeleteError;
}) {
  const dependents = error.dependents ?? [];
  const hidden = error.inaccessible_count ?? 0;
  const unlisted = (error.total ?? 0) - hidden - dependents.length;
  const counted =
    typeof error.total === 'number' && typeof error.archived_count === 'number';
  const summary = counted
    ? t(
        'Deletion is blocked by %s dependent assets (%s archived). Remove or repoint them before deleting.',
        error.total,
        error.archived_count,
      )
    : error.error;
  // Archived assets have no page to open; Recently Archived lists them.
  const href = (item: Dependent): string | undefined =>
    item.archived ? undefined : LIVE_LINKS[item.type]?.(item.id);
  return (
    <Alert
      type="error"
      showIcon
      message={summary}
      description={
        <>
          {dependents.length > 0 && (
            <ul>
              {dependents.map(item => (
                <li key={`${item.type}-${item.id}`}>
                  {href(item) ? (
                    <a href={ensureAppRoot(href(item) as string)}>
                      {item.name}
                    </a>
                  ) : (
                    item.name
                  )}{' '}
                  (
                  {item.archived
                    ? t('archived %s', typeLabel(item.type))
                    : typeLabel(item.type)}
                  )
                </li>
              ))}
            </ul>
          )}
          {unlisted > 0 && <p>{t('and %s more', unlisted)}</p>}
          {hidden > 0 && (
            <p>
              {t(
                "%s dependent asset(s) you can't see. Ask an admin for help.",
                hidden,
              )}
            </p>
          )}
          <a href={ensureAppRoot('/archived/')}>{t('Recently Archived')}</a>
        </>
      }
    />
  );
}
