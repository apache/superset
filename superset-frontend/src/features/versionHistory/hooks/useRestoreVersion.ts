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
import { useCallback, useState } from 'react';
import { SupersetClient, getClientErrorObject } from '@superset-ui/core';
import { logging } from '@apache-superset/core/utils';
import { EntityType } from '../types';

export interface RestoreResult {
  ok: boolean;
  error: string | null;
}

interface UseRestoreVersionResult {
  restore: (versionUuid: string) => Promise<RestoreResult>;
  restoring: boolean;
}

export function useRestoreVersion(
  entityType: EntityType,
  uuid: string | null | undefined,
): UseRestoreVersionResult {
  const [restoring, setRestoring] = useState(false);

  const restore = useCallback(
    async (versionUuid: string): Promise<RestoreResult> => {
      if (!uuid) return { ok: false, error: null };
      setRestoring(true);
      try {
        await SupersetClient.post({
          endpoint: `/api/v1/${entityType}/${uuid}/versions/${versionUuid}/restore`,
        });
        return { ok: true, error: null };
      } catch (e) {
        logging.error('Version restore failed', e);
        const detail = await getClientErrorObject(e);
        return {
          ok: false,
          error: detail?.error ?? detail?.message ?? String(e),
        };
      } finally {
        setRestoring(false);
      }
    },
    [entityType, uuid],
  );

  return { restore, restoring };
}
