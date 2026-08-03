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
import {
  closeOpenedTab,
  navigateOpenedTab,
  openBlankTab,
} from 'src/utils/navigationUtils';
import type { ActivityEntityKind, ActivityRecord } from './types';
import { resolveEntityId } from './api';

function entityUrl(kind: ActivityEntityKind, id: number): string {
  if (kind === 'chart') {
    return `/explore/?slice_id=${id}`;
  }
  if (kind === 'dashboard') {
    return `/dashboard/${id}/`;
  }
  return `/explore/?datasource_type=table&datasource_id=${id}`;
}

/** Open a related entity's page in a new tab, resolving its uuid to an id. */
export async function openRelatedEntity(
  record: ActivityRecord,
  onError: (message: string) => void,
): Promise<void> {
  if (!record.entity_uuid) {
    onError(t('Could not find %s', record.entity_name));
    return;
  }
  // Claim the tab now, while the click's transient activation is still live:
  // window.open after the resolve await is silently refused on Safari (and on
  // any browser once activation lapses) — the same pitfall openAsNew handles.
  const tab = openBlankTab();
  try {
    const id = await resolveEntityId(record.entity_kind, record.entity_uuid);
    if (id === null) {
      closeOpenedTab(tab);
      onError(t('Could not find %s', record.entity_name));
      return;
    }
    navigateOpenedTab(tab, entityUrl(record.entity_kind, id));
  } catch {
    // Leaving the claimed tab open would strand the user on about:blank.
    closeOpenedTab(tab);
    onError(t('Could not find %s', record.entity_name));
  }
}
