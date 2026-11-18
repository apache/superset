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
 * artifact's box, with its bindings run through the saved widget's own data
 * endpoint. A scaffold.
 *
 * The login stays with this page, under the viewer's own session; the box
 * loads from a short-lived link and never gets it.
 */

// TODO: guest-token mode, with a guest token scoped to the artifact.

import { useCallback, useMemo } from 'react';
import {
  components,
  theme as themeApi,
  translation,
} from '@apache-superset/core';
import type { FrameRequest, FrameState } from '@superset-oss/artifacts-sdk';
import { BindingSource, checkQuery } from '../data/bindings';
import useBindings from '../data/useBindings';
import { fetchPageFrame } from '../frames/api';
import FrameHost from '../frames/FrameHost';
import { frameTheme } from '../frames/theme';
import useFrameLink from '../frames/useFrameLink';

const { Alert } = components;
const { t } = translation;
const { useTheme } = themeApi;

const NO_FILTERS: never[] = [];

export default function HostPage({ widgetId }: { widgetId: string }) {
  const fetchLink = useCallback(() => fetchPageFrame(widgetId), [widgetId]);
  const { link, error, onHandshakeTimeout } = useFrameLink(fetchLink, widgetId);
  const source = useMemo<BindingSource>(
    () => ({ kind: 'widget', widgetId }),
    [widgetId],
  );
  const {
    bindings,
    status,
    error: dataError,
    refresh,
    rerun,
  } = useBindings(link?.manifest, source, NO_FILTERS);

  const theme = useTheme();
  const state = useMemo<FrameState>(
    () => ({
      status,
      filters: [],
      theme: frameTheme(theme),
      ...(dataError === undefined ? {} : { error: dataError }),
    }),
    [status, theme, dataError],
  );

  // A page of its own has no canvas to cross-filter, so the grant leaves
  // that out; the manifest is checked here.
  const onRequest = useCallback(
    (request: FrameRequest) => {
      if (!link) return;
      if (request.type === 'refresh') refresh();
      if (request.type === 'query') {
        const checked = checkQuery(link.manifest, request);
        if (checked.ok) rerun(checked.value).catch(() => undefined);
      }
    },
    [link, refresh, rerun],
  );

  if (error) {
    return (
      <Alert type="warning" closable={false}>
        {error}
      </Alert>
    );
  }
  if (!link) return null;
  return (
    <div style={{ width: '100%', height: '100%' }}>
      <FrameHost
        url={link.url}
        grant={link.capabilities}
        limits={link.limits}
        state={state}
        bindings={bindings}
        title={link.manifest.title ?? t('Artifact')}
        onRequest={onRequest}
        onError={() => undefined}
        onHandshakeTimeout={onHandshakeTimeout}
      />
    </div>
  );
}
