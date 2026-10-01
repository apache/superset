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
import { EmptyState, Loading, Typography } from '@superset-ui/core/components';
import { chat, setActiveCanvas, useChat } from 'src/core';
import { useApiV1Resource } from 'src/hooks/apiResources';
import { ResourceStatus } from 'src/hooks/apiResources/apiResources';
import CanvasGrid from 'src/features/canvas/CanvasGrid';
import { useCanvasDefinition } from 'src/features/canvas/useCanvasDefinition';

interface CanvasMetadata {
  id: number;
  title: string;
  description?: string | null;
}

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

export default function CanvasPage() {
  const { canvasId } = useParams<{ canvasId: string }>();
  const id = Number(canvasId);
  const metadata = useApiV1Resource<CanvasMetadata>(`/api/v1/canvas/${id}`);
  const { state } = useCanvasDefinition(id);
  const [filterValues, setFilterValues] = useState<Record<string, unknown>>({});

  const onFilterChange = useCallback((filterNodeId: string, value: unknown) => {
    setFilterValues(previous => {
      const next = { ...previous };
      if (value === undefined) delete next[filterNodeId];
      else next[filterNodeId] = value;
      return next;
    });
  }, []);

  useOpenChatPanel();

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
    return (
      <EmptyState
        size="large"
        title={t('This canvas does not exist, or you do not have access to it')}
      />
    );
  }
  if (
    metadata.status === ResourceStatus.Loading ||
    state.status === 'loading'
  ) {
    return <Loading />;
  }

  const isEmpty = state.result.definition.root.children.length === 0;
  return (
    <Page data-test="canvas-page">
      <Header>
        <Typography.Title level={3}>{title}</Typography.Title>
        {metadata.result?.description && (
          <Typography.Text type="secondary">
            {metadata.result.description}
          </Typography.Text>
        )}
      </Header>
      {isEmpty ? (
        <EmptyState
          size="medium"
          title={t('This canvas is empty')}
          description={t('Ask the chat to add widgets to it.')}
        />
      ) : (
        <CanvasGrid
          canvasId={id}
          result={state.result}
          filterValues={filterValues}
          onFilterChange={onFilterChange}
        />
      )}
    </Page>
  );
}
