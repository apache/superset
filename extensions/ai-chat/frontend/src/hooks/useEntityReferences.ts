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
import { useCallback, useRef, useState } from 'react';
import { translation } from '@apache-superset/core';
import { fetchResourceName } from '../api/resourceName';
import {
  MAX_REFERENCES,
  parseEntityUrl,
  referenceKey,
} from '../utils/entityRef';
import type { ResourceContext } from '../types';

const { t } = translation;

export interface EntityReferences {
  /** Objects pinned to the conversation, newest last. */
  references: ResourceContext[];
  /** Why the last drop was refused, if it was. */
  error: string | null;
  /** Attach whatever a drop carried; returns false when it named nothing. */
  add: (text: string) => boolean;
  remove: (key: string) => void;
  clear: () => void;
  dismissError: () => void;
}

/**
 * Superset objects dropped into the chat, kept until the user removes them.
 *
 * They stay attached across messages on purpose: someone comparing three
 * dashboards asks several questions about the same set, and re-dragging
 * before every message would be the tedious part. They ride along as page
 * context, so the model always receives the current set.
 */
export function useEntityReferences(): EntityReferences {
  const [references, setReferences] = useState<ResourceContext[]>([]);
  const [error, setError] = useState<string | null>(null);
  // Read inside the async name lookup, which must not resurrect a reference
  // the user removed while it was in flight.
  const liveKeys = useRef(new Set<string>());

  const add = useCallback((text: string): boolean => {
    const parsed = parseEntityUrl(text);
    if (!parsed) {
      setError(
        t('Drop a Superset dashboard, chart or dataset to add it as context.'),
      );
      return false;
    }

    // The ref, not the state, decides: two drops in quick succession are
    // handled before either re-render lands.
    const key = referenceKey(parsed);
    if (liveKeys.current.has(key)) {
      // Already attached. Dropping it again is a no-op, not an error.
      setError(null);
      return false;
    }
    if (liveKeys.current.size >= MAX_REFERENCES) {
      setError(t('You can attach up to %s items as context.', MAX_REFERENCES));
      return false;
    }
    liveKeys.current.add(key);
    setReferences(current => [...current, parsed]);
    setError(null);

    // The name makes the chip and the prompt readable. Nothing waits on it:
    // a slow or forbidden lookup just leaves the object identified by id.
    fetchResourceName(parsed).then(name => {
      if (!name || !liveKeys.current.has(key)) return;
      setReferences(current =>
        current.map(entry =>
          referenceKey(entry) === key ? { ...entry, name } : entry,
        ),
      );
    });
    return true;
  }, []);

  const remove = useCallback((key: string) => {
    liveKeys.current.delete(key);
    setReferences(current =>
      current.filter(entry => referenceKey(entry) !== key),
    );
  }, []);

  const clear = useCallback(() => {
    liveKeys.current.clear();
    setReferences([]);
  }, []);

  const dismissError = useCallback(() => setError(null), []);

  return { references, error, add, remove, clear, dismissError };
}
