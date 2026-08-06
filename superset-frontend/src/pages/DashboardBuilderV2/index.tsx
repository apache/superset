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
import { useEffect } from 'react';
import { t } from '@apache-superset/core/translation';
import { css, styled } from '@apache-superset/core/theme';
import { Flex, Typography } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import { dashboard, useDashboardRevision } from 'src/core/dashboard';
import { provider } from 'src/core/dashboard/store';
import { placeBlock } from 'src/core/dashboard/placement';
import { chat } from 'src/core/chat';
import BuildingBlockView from 'src/core/dashboard/BuildingBlockView';
import { dashboardClientTools } from './clientTools';
import DashboardHeader from './DashboardHeader';
import EditorPanel from './EditorPanel';

const PageContainer = styled(Flex)`
  ${({ theme }) => css`
    flex: 1 1 auto;
    height: 100%;
    min-height: 0;
    background-color: ${theme.colorBgLayout};
  `}
`;

const Canvas = styled.div`
  ${({ theme }) => css`
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: ${theme.paddingLG}px;
  `}
`;

const Workspace = styled.div`
  display: flex;
  flex: 1 1 auto;
  min-height: 0;
`;

const EmptyCanvasWrapper = styled.div`
  ${({ theme }) => css`
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: ${theme.paddingXL}px;
  `}
`;

const CanvasPlaceholder = styled(Flex)`
  ${({ theme }) => css`
    width: 100%;
    height: 100%;
    border: 2px dashed ${theme.colorBorderSecondary};
    border-radius: ${theme.borderRadiusLG}px;
    color: ${theme.colorTextTertiary};
  `}
`;

/**
 * Prototype entry point for SIP item 7.1 (AI-Native Dashboards, section 7.1
 * of the design doc): a canvas paired with the chat panel, so the
 * building-block schema/renderer/platform-API work can be iterated on with a
 * real natural-language chat loop rather than a mock. Does not persist
 * anything yet — layout/style state lives only in memory for this demo.
 *
 * The chat panel itself isn't forced open here — it behaves exactly as it
 * does everywhere else in the app (whatever display mode/open state the
 * user already has), via the same global ChatPanelHost/ChatFloatingHost
 * mounted in App.tsx.
 *
 * Rendering the tree itself is entirely delegated to `BuildingBlockView` —
 * this page owns only its own chrome (the empty state) and knows nothing
 * about node types, built-in or extension-contributed alike. There's no
 * page-level title chrome: a title is just a `markdown` building block like
 * any other, placed at the top of the canvas the same way the rest of the
 * dashboard's content is.
 */
export default function DashboardBuilderV2() {
  // Ticks on every dashboard.* mutation so this tree re-renders to reflect
  // whatever the chat agent (or any other caller of the dashboard API) did.
  useDashboardRevision();
  useEffect(() => {
    const registration = chat.registerClientTools(dashboardClientTools);
    return () => registration.dispose();
  }, []);
  const root = dashboard.getRoot();
  const isEmpty = !root.children || root.children.length === 0;

  /**
   * Places a block from the palette.
   *
   * Into whatever is selected when that can hold children, and into the root
   * otherwise. An author who has just selected a section and reaches for a
   * chart means to put it in that section; one who has selected a chart means
   * to put the next thing beside it, not inside it.
   *
   * A drag from the palette says where for itself — the container it was
   * dropped on takes it — so only the click needs a target chosen for it.
   * Both then go through the same `placeBlock`, because two copies of what a
   * freshly placed block looks like is how the two paths quietly diverge.
   */
  const addBlock = (type: string): void => {
    const selected = provider.getSelection();
    const selectedNode =
      selected === undefined ? undefined : provider.getNode(selected);
    placeBlock(
      selectedNode?.children !== undefined ? selectedNode.id : root.id,
      type,
    );
  };

  return (
    <PageContainer vertical>
      <DashboardHeader />
      <Workspace>
        <EditorPanel onAdd={addBlock} />
        <Canvas
          data-test="canvas"
          onClick={event => {
            // A click that reached the canvas itself passed every block on
            // the way, so it is the one gesture that unambiguously means
            // "nothing". A click on a block stops before here.
            if (event.target === event.currentTarget) {
              provider.setSelection(undefined);
            }
          }}
        >
          {isEmpty ? (
            <EmptyCanvasWrapper>
              <CanvasPlaceholder
                vertical
                align="center"
                justify="center"
                gap="small"
              >
                <Icons.AppstoreOutlined iconSize="xl" />
                <Typography.Text type="secondary">
                  {t('Add a building block, or ask the assistant to start')}
                </Typography.Text>
              </CanvasPlaceholder>
            </EmptyCanvasWrapper>
          ) : (
            <BuildingBlockView nodeId={root.id} />
          )}
        </Canvas>
      </Workspace>
    </PageContainer>
  );
}
