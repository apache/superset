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

import { useEffect, useState } from 'react';
import { SupersetClient } from '@superset-ui/core';
import { t } from '@apache-superset/core/translation';
import { styled } from '@apache-superset/core/theme';
import { Loading } from '@superset-ui/core/components';
import { CanvasRenderer } from './CanvasRenderer';
import { createSupersetQueryRunner } from './queryRunner';
import { CanvasDefinition } from './types';

const runner = createSupersetQueryRunner();

const Page = styled.div<{ $maxWidth: string }>`
  /* width:100% so the page fills the app's flex main area instead of
     collapsing to its content width. The cap is canvas-controlled
     (envelope.canvasWidth); default 'full' → no cap, matching dashboards. */
  width: 100%;
  max-width: ${({ $maxWidth }) => $maxWidth};
  margin: 0 auto;
  padding: ${({ theme }) => theme.sizeUnit * 6}px;

  /* There is no global border-box reset in this codebase, so any node that
     combines width:100% with author-supplied padding would overflow and force
     horizontal scrolling. Scope the reset to the canvas subtree. */
  &,
  & *,
  & *::before,
  & *::after {
    box-sizing: border-box;
  }
`;

const Title = styled.h1`
  font-size: ${({ theme }) => theme.fontSizeXL}px;
  font-weight: ${({ theme }) => theme.fontWeightStrong};
  margin-bottom: ${({ theme }) => theme.sizeUnit * 4}px;
`;

interface CanvasResponse {
  result: {
    name?: string;
    // The REST API returns the CDL as a stored JSON string.
    definition: CanvasDefinition | string;
  };
}

const parseDefinition = (
  definition: CanvasDefinition | string,
): CanvasDefinition =>
  typeof definition === 'string' ? JSON.parse(definition) : definition;

interface ViewerState {
  loading: boolean;
  error?: string;
  title?: string;
  definition?: CanvasDefinition;
}

/**
 * Loads a saved Canvas by id/uuid from the REST API and renders it against real
 * data. The route element supplies `idOrUuid` from the URL.
 */
export function CanvasViewer({ idOrUuid }: { idOrUuid: string }) {
  const [state, setState] = useState<ViewerState>({ loading: true });

  useEffect(() => {
    let live = true;
    setState({ loading: true });
    SupersetClient.get({ endpoint: `/api/v1/canvas/${idOrUuid}` })
      .then(({ json }) => {
        if (!live) return;
        const { result } = json as unknown as CanvasResponse;
        setState({
          loading: false,
          title: result.name,
          definition: parseDefinition(result.definition),
        });
      })
      .catch((error: unknown) => {
        if (!live) return;
        setState({
          loading: false,
          error: error instanceof Error ? error.message : String(error),
        });
      });
    return () => {
      live = false;
    };
  }, [idOrUuid]);

  if (state.loading) {
    return <Loading />;
  }
  if (state.error || !state.definition) {
    return (
      <Page $maxWidth="760px">
        {t('Could not load canvas: %s', state.error ?? 'not found')}
      </Page>
    );
  }

  // Default to full-bleed (like a dashboard); a canvas opts into a narrower
  // reading measure via envelope.canvasWidth (e.g. "820px").
  const width = state.definition.canvasWidth;
  const maxWidth = !width || width === 'full' ? 'none' : width;

  return (
    <Page $maxWidth={maxWidth}>
      {state.title && <Title>{state.title}</Title>}
      <CanvasRenderer definition={state.definition} queryRunner={runner} />
    </Page>
  );
}
