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

/**
 * @fileoverview A frame link, fetched once more when the frame it opened
 * never completes its handshake.
 *
 * A link is short-lived and single-use, so a frame that never loaded, as when
 * its link expired before the iframe asked for it, needs a new one. A second
 * timeout is reported instead: a third link would fare no better.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { translation } from '@apache-superset/core';
import { errorMessage } from '../http';

const { t } = translation;

export interface FrameLinkState<T> {
  link?: T;
  error?: string;
  /** Fetch a new link, as after a publish changes the version served. */
  reload: () => void;
  /** For the frame host: the frame never completed its handshake. */
  onHandshakeTimeout: () => void;
}

/**
 * The link `fetchLink` answers, fetched again whenever `key` changes; `key`
 * must change whenever `fetchLink` would fetch a different link. Without
 * `fetchLink` there is no link.
 */
export default function useFrameLink<T>(
  fetchLink: (() => Promise<T>) | undefined,
  key: string,
): FrameLinkState<T> {
  const [link, setLink] = useState<T>();
  const [error, setError] = useState<string>();
  const [nonce, setNonce] = useState(0);
  const latestFetch = useRef(fetchLink);
  latestFetch.current = fetchLink;
  const timeouts = useRef({ key, count: 0 });

  useEffect(() => {
    const fetchCurrent = latestFetch.current;
    setError(undefined);
    if (!fetchCurrent) {
      setLink(undefined);
      return undefined;
    }
    let cancelled = false;
    fetchCurrent()
      .then(fetched => {
        if (!cancelled) setLink(fetched);
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setLink(undefined);
        setError(errorMessage(reason));
      });
    return () => {
      cancelled = true;
    };
  }, [key, nonce]);

  const reload = useCallback(() => {
    timeouts.current = { key, count: 0 };
    setNonce(value => value + 1);
  }, [key]);

  const onHandshakeTimeout = useCallback(() => {
    if (timeouts.current.key !== key) timeouts.current = { key, count: 0 };
    timeouts.current.count += 1;
    if (timeouts.current.count === 1) {
      setNonce(value => value + 1);
      return;
    }
    setLink(undefined);
    setError(t('The artifact did not start. Reload the page to try again.'));
  }, [key]);

  return { link, error, reload, onHandshakeTimeout };
}
