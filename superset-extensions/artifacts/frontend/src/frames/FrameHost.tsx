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
 * @fileoverview The frame host: the sandboxed iframe and the host end of its
 * bridge.
 *
 * The iframe is created by hand rather than by React, so that its sandbox,
 * referrer policy and `name` (the channel key and grant) are all set before
 * it starts to load, and so that a re-render never reloads it. Every new link
 * gets a new iframe and a new channel: the link is single-use, and the frame
 * runtime clears the key from `name` once it has read it.
 */

import { useEffect, useRef } from 'react';
import {
  Capability,
  ChannelError,
  createFrameChannel,
  FrameChannel,
  FrameRequest,
  FrameState,
} from '@superset-oss/artifacts-sdk';

export interface FrameHostProps {
  /** The provider's short-lived link to the artifact version. */
  url: string;
  /** The capabilities granted to the frame in this context. */
  grant: readonly Capability[];
  /** What the frame may know; sent again whenever it changes. */
  state: FrameState;
  /** The iframe's accessible name. */
  title: string;
  /**
   * A request the grant allows. Check it against the manifest before acting
   * on it: the channel checks only the capability.
   */
  onRequest: (request: FrameRequest) => void;
  onError: (error: ChannelError) => void;
}

/** Only http(s) links load: never `javascript:`, `data:` or `blob:` ones. */
function isFrameUrl(url: string): boolean {
  try {
    const { protocol } = new URL(url);
    return protocol === 'https:' || protocol === 'http:';
  } catch {
    return false;
  }
}

export default function FrameHost({
  url,
  grant,
  state,
  title,
  onRequest,
  onError,
}: FrameHostProps) {
  const container = useRef<HTMLDivElement>(null);
  const channel = useRef<FrameChannel>();
  const frame = useRef<HTMLIFrameElement>();
  // The latest values, read by the long-lived effect below without
  // re-creating the frame when only they change.
  const latest = useRef({ state, title, grant, onRequest, onError });
  latest.current = { state, title, grant, onRequest, onError };
  const grantKey = [...grant].sort().join(',');

  useEffect(() => {
    const host = container.current;
    if (!host) return undefined;
    if (!isFrameUrl(url)) {
      latest.current.onError({
        source: 'host',
        message: 'refused a frame link that is not http or https',
      });
      return undefined;
    }
    const element = document.createElement('iframe');
    // An opaque origin: scripts run, but no same-origin access, popups,
    // forms or top-level navigation.
    element.setAttribute('sandbox', 'allow-scripts');
    element.referrerPolicy = 'no-referrer';
    element.title = latest.current.title;
    element.style.cssText =
      'border: 0; width: 100%; height: 100%; display: block;';
    const opened = createFrameChannel({
      frame: element,
      grant: latest.current.grant,
      onRequest: request => latest.current.onRequest(request),
      onError: error => latest.current.onError(error),
    });
    element.name = opened.name;
    element.src = url;
    opened.postState(latest.current.state);
    host.appendChild(element);
    channel.current = opened;
    frame.current = element;
    return () => {
      opened.dispose();
      element.remove();
      channel.current = undefined;
      frame.current = undefined;
    };
  }, [url, grantKey]);

  useEffect(() => {
    channel.current?.postState(state);
  }, [state]);

  useEffect(() => {
    if (frame.current) frame.current.title = title;
  }, [title]);

  return <div ref={container} style={{ width: '100%', height: '100%' }} />;
}
