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
import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { t } from '@apache-superset/core/translation';
import { css, styled } from '@apache-superset/core/theme';
import type { canvas as canvasApi } from '@apache-superset/core';
import {
  CertifiedBadge,
  EmptyState,
  Loading,
} from '@superset-ui/core/components';
import { Alert } from '@apache-superset/core/components';
import { chat, setActiveCanvas, useChat } from 'src/core';
import CrudThemeProvider from 'src/components/CrudThemeProvider';
import injectCustomCss from 'src/dashboard/util/injectCustomCss';
import { useApiV1Resource } from 'src/hooks/apiResources';
import { ResourceStatus } from 'src/hooks/apiResources/apiResources';
import CanvasGrid, {
  emptyScopeValues,
  ScopeValues,
} from 'src/features/canvas/CanvasGrid';
import {
  CanvasDefinitionResult,
  CanvasMetadata,
} from 'src/features/canvas/types';
import { useCanvasDefinition } from 'src/features/canvas/useCanvasDefinition';
import { registerBuiltinRenderers } from 'src/features/canvas/builtinRenderers';
import { useCanvasId } from 'src/features/canvas/useCanvasId';
import { useCanvasRefresh } from 'src/features/canvas/useCanvasRefresh';
import { useCanvasLayout } from 'src/features/canvas/useCanvasLayout';

registerBuiltinRenderers();

const Page = styled.div`
  ${({ theme }) => css`
    padding: ${theme.sizeUnit * 4}px;
    display: flex;
    flex-direction: column;
    gap: ${theme.sizeUnit * 4}px;
  `}
`;

const Header = styled.header`
  ${({ theme }) => css`
    display: flex;
    flex-direction: column;
    gap: ${theme.sizeUnit}px;
  `}
`;

const Title = styled.h1`
  ${({ theme }) => css`
    margin: 0;
    color: ${theme.colorTextHeading};
    font-size: ${theme.fontSizeHeading3}px;
    font-weight: ${theme.fontWeightStrong};
    line-height: ${theme.lineHeightHeading3};
  `}
`;

const Description = styled.p`
  ${({ theme }) => css`
    margin: 0;
    color: ${theme.colorTextSecondary};
  `}
`;

/**
 * Opens the registered chat as a side panel once, when a canvas is shown and a
 * chat is available. Canvas is AI-first: changes come from the chat.
 */
function useOpenChatPanel() {
  const { chat: registeredChat } = useChat();
  const opened = useRef(false);
  useEffect(() => {
    if (!registeredChat || opened.current) return;
    opened.current = true;
    chat.setDisplayMode('panel');
    chat.open();
  }, [registeredChat]);
}

const notFound = (
  <EmptyState
    size="large"
    title={t('This canvas does not exist, or you do not have access to it')}
  />
);

interface CanvasBodyProps {
  canvasId: number;
  result: CanvasDefinitionResult;
  reload: () => void;
  values: ScopeValues;
  onValueChange: (
    kind: canvasApi.ScopeKind,
    nodeId: string,
    value: unknown,
  ) => void;
  refreshKeys: Record<string, number>;
}

/**
 * The canvas itself, once its definition has loaded. Drag and resize persist
 * from here; a write that doesn't land says so and leaves the layout where the
 * server still has it.
 */
function CanvasBody({
  canvasId,
  result,
  reload,
  values,
  onValueChange,
  refreshKeys,
}: CanvasBodyProps) {
  const layout = useCanvasLayout(canvasId, result, reload);
  return (
    <>
      {layout.error && (
        <Alert
          type="warning"
          closable
          showIcon
          message={layout.error}
          onClose={layout.dismissError}
          data-test="canvas-layout-error"
        />
      )}
      <CanvasGrid
        canvasId={canvasId}
        result={result}
        values={values}
        onValueChange={onValueChange}
        refreshKeys={refreshKeys}
        layout={layout}
      />
    </>
  );
}

function CanvasContent({ id }: { id: number }) {
  const metadata = useApiV1Resource<CanvasMetadata>(`/api/v1/canvas/${id}`);
  const { state, reload } = useCanvasDefinition(id);
  const [values, setValues] = useState<ScopeValues>(emptyScopeValues);
  const refreshKeys = useCanvasRefresh(
    state.status === 'complete' ? state.result.definition : undefined,
  );

  const onValueChange = useCallback(
    (kind: canvasApi.ScopeKind, nodeId: string, value: unknown) => {
      setValues(previous => {
        const next = { ...previous[kind] };
        if (value === undefined) delete next[nodeId];
        else next[nodeId] = value;
        return { ...previous, [kind]: next };
      });
    },
    [],
  );

  useOpenChatPanel();

  const customCss = metadata.result?.css;
  useEffect(
    () => (customCss ? injectCustomCss(customCss) : undefined),
    [customCss],
  );

  const title = metadata.result?.title;
  const revision =
    state.status === 'complete' ? state.result.revision : undefined;
  useEffect(() => {
    if (title !== undefined && revision !== undefined) {
      setActiveCanvas({ id, title, revision });
    }
  }, [id, title, revision]);
  useEffect(() => () => setActiveCanvas(undefined), [id]);

  if (metadata.status === ResourceStatus.Error || state.status === 'error') {
    return notFound;
  }
  if (
    metadata.status === ResourceStatus.Loading ||
    state.status === 'loading'
  ) {
    return <Loading />;
  }

  const isEmpty = state.result.definition.root.children.length === 0;
  const certifiedBy = metadata.result?.certified_by;
  return (
    <CrudThemeProvider theme={metadata.result?.theme}>
      <Page data-test="canvas-page">
        <Header>
          <Title>
            {certifiedBy && (
              <>
                <CertifiedBadge
                  certifiedBy={certifiedBy}
                  details={metadata.result?.certification_details ?? undefined}
                />{' '}
              </>
            )}
            {title}
          </Title>
          {metadata.result?.description && (
            <Description>{metadata.result.description}</Description>
          )}
        </Header>
        {isEmpty ? (
          <EmptyState
            size="medium"
            title={t('This canvas is empty')}
            description={t('Ask the chat to add widgets to it.')}
          />
        ) : (
          <CanvasBody
            canvasId={id}
            result={state.result}
            reload={reload}
            values={values}
            onValueChange={onValueChange}
            refreshKeys={refreshKeys}
          />
        )}
      </Page>
    </CrudThemeProvider>
  );
}

export default function CanvasPage() {
  const { idOrSlug } = useParams<{ idOrSlug: string }>();
  const canvasId = useCanvasId(idOrSlug);
  if (canvasId.status === 'error') return notFound;
  if (canvasId.status === 'loading') return <Loading />;
  return <CanvasContent id={canvasId.id} />;
}
