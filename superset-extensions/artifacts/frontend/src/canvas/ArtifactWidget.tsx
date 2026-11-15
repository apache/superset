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
 * The placement's props name an artifact and, optionally, a pinned version.
 * The renderer asks the backend for a frame link to the version this viewer
 * may see, opens the sandboxed frame on it, sends the frame its state (the
 * bindings' data, the filters that reach it, the theme) and acts on the
 * frame's requests only after checking them against the manifest:
 * `setCrossFilter` through the canvas, `emit` through `publish`, `refresh` and
 * `query` by fetching again.
 */

// TODO: standard event kinds for every widget; artifact events are published
// under this extension's own prefix until then.
// TODO: a render-complete signal, and cross-filter values accepted only from
// the data the host delivered.

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  canvas,
  components,
  theme as themeApi,
  translation,
} from '@apache-superset/core';
import type {
  BindingData,
  Capability,
  ChannelError,
  FrameRequest,
  FrameState,
} from '@apache-superset/artifact-sdk';
import PublishRequest from '../authoring/PublishRequest';
import { EVENT_KIND_PREFIX } from '../constants';
import {
  artifactFilters,
  checkEvent,
  checkQuery,
  crossFilterValue,
  fetchBinding,
  fetchBindings,
  runtimeFilters,
} from '../data/bindings';
import { fetchPlacementFrame, FrameLink } from '../frames/api';
import FrameHost from '../frames/FrameHost';
import { frameTheme } from '../frames/theme';
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
  props,
  title,
  filters,
  crossFilters,
  crossFiltersEnabled,
  setCrossFilter,
  publish,
  refreshKey,
  draftToken,
}: canvas.CanvasWidgetProps) {
  const artifactId =
    typeof props?.artifact_id === 'string' ? props.artifact_id : undefined;
  const pinned = typeof props?.version === 'string' ? props.version : undefined;

  const [frame, setFrame] = useState<OpenFrame>();
  const [linkError, setLinkError] = useState<string>();
  const [linkNonce, setLinkNonce] = useState(0);

  // A link is single-use, so every change that needs a new frame fetches a
  // new link, the grant included.
  useEffect(() => {
    if (!artifactId) {
      setFrame(undefined);
      setLinkError(t('This widget names no artifact.'));
      return undefined;
    }
    let cancelled = false;
    setLinkError(undefined);
    fetchPlacementFrame({
      canvasId,
      placementId: nodeId,
      draftToken,
      // While the canvas shows a draft, the artifact's owners see the
      // artifact's draft, so that they can check it before they publish it;
      // the server serves everyone else a published version. The bindings
      // run from the same version, as their requests carry the draft token.
      draft: Boolean(draftToken),
    })
      .then(link => {
        if (cancelled) return;
        setFrame({
          ...link,
          grant: link.capabilities.filter(
            capability => capability !== 'cross_filter' || crossFiltersEnabled,
          ),
        });
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setFrame(undefined);
        setLinkError(errorMessage(reason));
      });
    return () => {
      cancelled = true;
    };
  }, [
    canvasId,
    nodeId,
    artifactId,
    pinned,
    draftToken,
    crossFiltersEnabled,
    linkNonce,
  ]);

  const manifest = frame?.manifest;
  const selected = useMemo(
    () => runtimeFilters([...filters, ...crossFilters]),
    [filters, crossFilters],
  );
  const selectedKey = JSON.stringify(selected);
  const [bindings, setBindings] = useState<Record<string, BindingData>>({});
  const [status, setStatus] = useState<FrameState['status']>('loading');
  const [dataError, setDataError] = useState<string>();
  const [dataNonce, setDataNonce] = useState(0);

  useEffect(() => {
    if (!manifest) return undefined;
    if (Object.keys(manifest.bindings ?? {}).length === 0) {
      setBindings({});
      setStatus('ok');
      setDataError(undefined);
      return undefined;
    }
    let cancelled = false;
    setStatus('loading');
    fetchBindings(manifest, {
      canvasId,
      placementId: nodeId,
      draftToken,
      filters: selected,
    })
      .then(data => {
        if (cancelled) return;
        setBindings(data);
        setStatus('ok');
        setDataError(undefined);
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setStatus('error');
        setDataError(errorMessage(reason));
      });
    return () => {
      cancelled = true;
    };
    // `selectedKey` stands in for `selected`, a new array on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    manifest,
    canvasId,
    nodeId,
    draftToken,
    selectedKey,
    refreshKey,
    dataNonce,
  ]);

  const theme = useTheme();
  const themeForFrame = useMemo(() => frameTheme(theme), [theme]);
  const state = useMemo<FrameState>(
    () => ({
      status,
      bindings,
      filters: artifactFilters(filters, crossFilters),
      theme: themeForFrame,
      ...(dataError === undefined ? {} : { error: dataError }),
    }),
    [status, bindings, filters, crossFilters, themeForFrame, dataError],
  );

  const [notice, setNotice] = useState<string>();
  const refuse = useCallback((reason: string) => {
    setNotice(t('The artifact asked for something it may not do: %s', reason));
  }, []);

  const refetchBinding = useCallback(
    (binding: string) => {
      fetchBinding({
        canvasId,
        placementId: nodeId,
        binding,
        draftToken,
        filters: selected,
      })
        .then(data => setBindings(current => ({ ...current, [binding]: data })))
        .catch((reason: unknown) => setNotice(errorMessage(reason)));
    },
    [canvasId, nodeId, draftToken, selected],
  );

  // The channel has checked the grant; the manifest is checked here.
  const onRequest = useCallback(
    (request: FrameRequest) => {
      if (!manifest) return;
      switch (request.type) {
        case 'query': {
          const checked = checkQuery(manifest, request);
          if (checked.ok) refetchBinding(checked.value);
          else refuse(checked.reason);
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
        case 'emit': {
          const kind = `${EVENT_KIND_PREFIX}${request.kind}`;
          if (request.value === null) {
            publish(kind, undefined);
            break;
          }
          const checked = checkEvent(manifest, request.kind, request.value);
          if (checked.ok) publish(kind, checked.value);
          else refuse(checked.reason);
          break;
        }
        case 'refresh':
          setDataNonce(nonce => nonce + 1);
          break;
        default:
          break;
      }
    },
    [manifest, publish, refetchBinding, refuse, setCrossFilter],
  );

  // Errors are the author's to fix, so only the artifact's owners see them.
  // Which of them may reach an agent is still to decide.
  const onError = useCallback(
    (error: ChannelError) => {
      if (frame?.can_edit) setNotice(error.message);
    },
    [frame?.can_edit],
  );

  const shownTitle = title ?? manifest?.title ?? t('Artifact');

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
          onPublished={() => setLinkNonce(nonce => nonce + 1)}
        />
      )}
      <div style={{ flex: 1, minHeight: 0 }}>
        {frame ? (
          <FrameHost
            url={frame.url}
            grant={frame.grant}
            state={state}
            title={shownTitle}
            onRequest={onRequest}
            onError={onError}
          />
        ) : (
          linkError && (
            <Alert type="warning" closable={false}>
              {linkError}
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
