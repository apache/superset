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
 * @fileoverview The artifact widget's renderer, and the frame host around its
 * sandbox.
 *
 * The placement holds the artifact's saved widget, whose UUID is the
 * artifact's id. The renderer asks the backend for a frame link to the
 * version this viewer may see, and opens the sandboxed frame on it. It sends
 * the frame each binding's result whenever that changes, and its state (the
 * filters that reach it, the theme) whenever that does, and acts on the
 * frame's requests only after checking them against the manifest:
 * `setCrossFilter` through the canvas, `refresh` and `query` by fetching
 * again.
 */

// TODO: a render-complete signal.

import { useCallback, useMemo, useState } from 'react';
import {
  canvas,
  components,
  theme as themeApi,
  translation,
} from '@apache-superset/core';
import type {
  Capability,
  ChannelError,
  FrameRequest,
  FrameState,
} from '@superset-oss/artifacts-sdk';
import PublishRequest from '../authoring/PublishRequest';
import {
  artifactFilters,
  BindingSource,
  checkQuery,
  crossFilterValue,
  declaredBindings,
  runtimeFilters,
} from '../data/bindings';
import useBindings from '../data/useBindings';
import { fetchPlacementFrame, FrameLink } from '../frames/api';
import FrameHost from '../frames/FrameHost';
import OutOfPolicy from '../frames/OutOfPolicy';
import { frameTheme } from '../frames/theme';
import useFrameLink from '../frames/useFrameLink';
import { errorMessage } from '../http';

const { Alert } = components;
const { t } = translation;
const { useTheme } = themeApi;

interface OpenFrame extends FrameLink {
  /** The grant for this frame: fixed when its link is fetched. */
  grant: Capability[];
}

export default function ArtifactWidget({
  canvasId,
  nodeId,
  widgetId,
  title,
  filters,
  crossFilters,
  crossFiltersEnabled,
  setCrossFilter,
  refreshKey,
  draftToken,
}: canvas.CanvasWidgetProps) {
  // While the canvas shows a draft, the artifact's editors see its draft, so
  // that they can check it before they publish it; the server serves
  // everyone else the published version. The bindings run from the same
  // version, as their requests carry the same draft token.
  const fetchLink = useMemo(
    () =>
      widgetId
        ? async (): Promise<OpenFrame> => {
            const link = await fetchPlacementFrame({
              widgetId,
              canvasId,
              placementId: nodeId,
              draftToken,
            });
            return {
              ...link,
              grant: link.capabilities.filter(
                capability =>
                  capability !== 'cross_filter' || crossFiltersEnabled,
              ),
            };
          }
        : undefined,
    [widgetId, canvasId, nodeId, draftToken, crossFiltersEnabled],
  );
  // A link is single-use, so every change that needs a new frame fetches a
  // new link, the grant included.
  const {
    link: frame,
    error: linkError,
    reload,
    onHandshakeTimeout,
  } = useFrameLink(
    fetchLink,
    JSON.stringify([
      widgetId,
      canvasId,
      nodeId,
      draftToken,
      crossFiltersEnabled,
    ]),
  );

  const manifest = frame?.manifest;
  const source = useMemo<BindingSource>(
    () => ({ kind: 'placement', canvasId, placementId: nodeId, draftToken }),
    [canvasId, nodeId, draftToken],
  );
  const selected = useMemo(
    () => runtimeFilters([...filters, ...crossFilters]),
    [filters, crossFilters],
  );
  const { bindings, status, error, refresh, rerun } = useBindings(
    manifest,
    source,
    selected,
    refreshKey,
  );

  const theme = useTheme();
  const themeForFrame = useMemo(() => frameTheme(theme), [theme]);
  const state = useMemo<FrameState>(
    () => ({
      status,
      filters: artifactFilters(filters, crossFilters),
      theme: themeForFrame,
      ...(error === undefined ? {} : { error }),
    }),
    [status, filters, crossFilters, themeForFrame, error],
  );

  const [notice, setNotice] = useState<string>();
  const refuse = useCallback((reason: string) => {
    setNotice(t('The artifact asked for something it may not do: %s', reason));
  }, []);

  // The channel has checked the grant, its limits and that cross-filter
  // values were delivered; the manifest is checked here.
  const onRequest = useCallback(
    (request: FrameRequest) => {
      if (!manifest) return;
      switch (request.type) {
        case 'query': {
          const checked = checkQuery(manifest, request);
          if (!checked.ok) refuse(checked.reason);
          else {
            rerun(checked.value).catch((reason: unknown) =>
              setNotice(errorMessage(reason)),
            );
          }
          break;
        }
        case 'setCrossFilter': {
          if (request.value === null) {
            setCrossFilter(undefined);
            break;
          }
          const checked = crossFilterValue(manifest, request.value);
          if (checked.ok) setCrossFilter(checked.value);
          else refuse(checked.reason);
          break;
        }
        case 'refresh':
          refresh();
          break;
        default:
          break;
      }
    },
    [manifest, rerun, refresh, refuse, setCrossFilter],
  );

  // Errors are the author's to fix, so only the artifact's editors see them.
  // Which of them may reach an agent is still to decide.
  const onError = useCallback(
    (channelError: ChannelError) => {
      if (frame?.can_edit) setNotice(channelError.message);
    },
    [frame?.can_edit],
  );

  const shownTitle = title ?? manifest?.title ?? t('Artifact');
  const shownLinkError = widgetId
    ? linkError
    : t('This placement holds no saved artifact.');

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
      }}
    >
      {frame?.can_edit && frame.pending_publish && (
        <PublishRequest
          artifactId={frame.artifact_id}
          pending={frame.pending_publish}
          onPublished={reload}
        />
      )}
      {frame && <OutOfPolicy link={frame} />}
      <div style={{ flex: 1, minHeight: 0 }}>
        {frame ? (
          <FrameHost
            url={frame.url}
            grant={frame.grant}
            limits={frame.limits}
            queriesPerRequest={declaredBindings(frame.manifest)}
            state={state}
            bindings={bindings}
            title={shownTitle}
            onRequest={onRequest}
            onError={onError}
            onHandshakeTimeout={onHandshakeTimeout}
          />
        ) : (
          shownLinkError && (
            <Alert type="warning" closable={false}>
              {shownLinkError}
            </Alert>
          )
        )}
      </div>
      {notice && frame?.can_edit && (
        <Alert type="error" onClose={() => setNotice(undefined)}>
          {notice}
        </Alert>
      )}
    </div>
  );
}
