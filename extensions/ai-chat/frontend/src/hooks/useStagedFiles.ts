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
import { translation } from '@apache-superset/core';
import {
  Attachment,
  MAX_ATTACHMENTS,
  readAttachment,
} from '../utils/attachments';

const { t } = translation;

export interface StagedFiles {
  /** Files read and waiting to travel with the next message. */
  files: Attachment[];
  /** Why the last pick was refused in part, if it was. */
  error: string | null;
  add: (picked: FileList | null) => Promise<void>;
  remove: (id: string) => void;
  clear: () => void;
}

/**
 * Files picked for the next message, held beside the conversation rather than
 * inside the composer.
 *
 * They belong to the conversation the way dropped objects do, so the panel
 * owns both and discards both together: a file staged for a conversation that
 * has been cleared was never sent and has nothing left to attach to.
 */
export function useStagedFiles(): StagedFiles {
  const [files, setFiles] = useState<Attachment[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Not memoized: it reports overflow against what is staged right now,
  // which a callback frozen on an empty list would get wrong.
  const add = async (picked: FileList | null) => {
    if (!picked?.length) return;
    const overflow =
      picked.length > MAX_ATTACHMENTS - files.length
        ? t('You can attach up to %s files per message.', MAX_ATTACHMENTS)
        : null;
    const results = await Promise.allSettled(
      Array.from(picked).slice(0, MAX_ATTACHMENTS).map(readAttachment),
    );
    const added = results
      .filter(
        (result): result is PromiseFulfilledResult<Attachment> =>
          result.status === 'fulfilled',
      )
      .map(result => result.value);
    const rejected = results.find(result => result.status === 'rejected') as
      PromiseRejectedResult | undefined;
    // Reading a file takes long enough for a second pick to start before this
    // one lands, so the limit applies to the state being replaced rather than
    // to the count captured when the picker opened. Files beyond it are
    // dropped instead of replacing what is already staged.
    setFiles(current => {
      const room = MAX_ATTACHMENTS - current.length;
      return room > 0 ? [...current, ...added.slice(0, room)] : current;
    });
    setError(rejected ? String(rejected.reason.message) : overflow);
  };

  const remove = useCallback(
    (id: string) => setFiles(current => current.filter(file => file.id !== id)),
    [],
  );

  const clear = useCallback(() => {
    setFiles([]);
    setError(null);
  }, []);

  return { files, error, add, remove, clear };
}
