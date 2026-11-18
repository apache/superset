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
 * @fileoverview The standalone host page: a thin shell that opens one
 * artifact's box. A scaffold.
 *
 * The login stays with this page, under the viewer's own session; the box
 * loads from a short-lived link and never gets it.
 */

// TODO: a route that renders this page at /embedded/artifact/<uuid>;
// extensions can't contribute pages or routes, so nothing renders it yet.
// TODO: guest-token mode, with a guest token scoped to the artifact.
// TODO: bindings here need a data endpoint that runs an artifact's binding
// without a canvas placement; until then the page sends no data.

import { useEffect, useMemo, useState } from 'react';
import {
  components,
  theme as themeApi,
  translation,
} from '@apache-superset/core';
import type { FrameState } from '@superset-oss/artifacts-sdk';
import { fetchStandaloneFrame, FrameLink } from '../frames/api';
import FrameHost from '../frames/FrameHost';
import { frameTheme } from '../frames/theme';
import { errorMessage } from '../http';

const { Alert } = components;
const { t } = translation;
const { useTheme } = themeApi;

export default function HostPage({ artifactId }: { artifactId: string }) {
  const [frame, setFrame] = useState<FrameLink>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    fetchStandaloneFrame(artifactId)
      .then(link => {
        if (!cancelled) setFrame(link);
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(errorMessage(reason));
      });
    return () => {
      cancelled = true;
    };
  }, [artifactId]);

  const theme = useTheme();
  const bound = Object.keys(frame?.manifest.bindings ?? {}).length > 0;
  const state = useMemo<FrameState>(
    () => ({
      status: bound ? 'error' : 'ok',
      bindings: {},
      filters: [],
      theme: frameTheme(theme),
      ...(bound
        ? { error: t('Data is not available on a standalone page yet.') }
        : {}),
    }),
    [bound, theme],
  );

  if (error) {
    return (
      <Alert type="warning" closable={false}>
        {error}
      </Alert>
    );
  }
  if (!frame) return null;
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <FrameHost
        url={frame.url}
        grant={frame.capabilities}
        state={state}
        title={frame.manifest.title ?? t('Artifact')}
        // A standalone page has no canvas to filter, and no data yet to
        // refresh or query.
        onRequest={() => undefined}
        onError={() => undefined}
      />
    </div>
  );
}
