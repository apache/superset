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
  BindingData,
  BridgeLimits,
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
  /** What the frame's requests are held to, as the link's policy says. */
  limits?: Partial<BridgeLimits>;
  /** The bindings a refresh fetches again: the manifest's declared ones. */
  refreshQueries?: number;
  /** What the frame may know besides its data; sent whenever it changes. */
  state: FrameState;
  /**
   * Each binding's latest result. Only a result whose object changed is sent
   * again, so replace one binding's result without copying the others'.
   */
  bindings: Readonly<Record<string, BindingData>>;
  /** The iframe's accessible name. */
  title: string;
  /**
   * A request the grant and the limits allow. Check it against the manifest
   * before acting on it: the channel can't.
   */
  onRequest: (request: FrameRequest) => void;
  onError: (error: ChannelError) => void;
  /** The frame never completed its handshake: its link needs replacing. */
  onHandshakeTimeout?: () => void;
}

function postBindings(
  channel: FrameChannel,
  bindings: Readonly<Record<string, BindingData>>,
) {
  Object.entries(bindings).forEach(([name, data]) =>
    channel.postData(name, data),
  );
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
  limits,
  refreshQueries,
  state,
  bindings,
  title,
  onRequest,
  onError,
  onHandshakeTimeout,
}: FrameHostProps) {
  const container = useRef<HTMLDivElement>(null);
  const channel = useRef<FrameChannel>();
  const frame = useRef<HTMLIFrameElement>();
  // The latest values, read by the long-lived effect below without
  // re-creating the frame when only they change.
  const latest = useRef({
    state,
    bindings,
    title,
    grant,
    limits,
    refreshQueries,
    onRequest,
    onError,
    onHandshakeTimeout,
  });
  latest.current = {
    state,
    bindings,
    title,
    grant,
    limits,
    refreshQueries,
    onRequest,
    onError,
    onHandshakeTimeout,
  };
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
      limits: latest.current.limits,
      refreshQueries: latest.current.refreshQueries,
      onRequest: request => latest.current.onRequest(request),
      onError: error => latest.current.onError(error),
      onHandshakeTimeout: () => latest.current.onHandshakeTimeout?.(),
    });
    element.name = opened.name;
    element.src = url;
    postBindings(opened, latest.current.bindings);
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

  // Before the state's effect, so that a state saying `ok` finds its data.
  useEffect(() => {
    if (channel.current) postBindings(channel.current, bindings);
  }, [bindings]);

  useEffect(() => {
    channel.current?.postState(state);
  }, [state]);

  useEffect(() => {
    if (frame.current) frame.current.title = title;
  }, [title]);

  return <div ref={container} style={{ width: '100%', height: '100%' }} />;
}
