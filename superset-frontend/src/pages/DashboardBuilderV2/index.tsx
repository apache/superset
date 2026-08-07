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
import { t } from '@apache-superset/core/translation';
import { css, styled } from '@apache-superset/core/theme';
import { EmptyState, Flex } from '@superset-ui/core/components';
import { dashboard, useDashboardRevision } from 'src/core/dashboard';
import { provider } from 'src/core/dashboard/store';
import { placeBlock } from 'src/core/dashboard/placement';
import BuildingBlockView from 'src/core/dashboard/BuildingBlockView';
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

/**
 * The dashboard with nothing on it, as something to aim at.
 *
 * A dashed frame is what the rest of the app draws around a place a thing can
 * be dropped, and this is one — the palette drags land here. It is also the
 * only way to select the root on a blank canvas, so it answers a pointer and a
 * Tab the way anything clickable does: the frame firms up and the surface
 * lifts, rather than a dashed box that never reacts to being pressed.
 */
const CanvasPlaceholder = styled(Flex)`
  ${({ theme }) => css`
    width: 100%;
    height: 100%;
    border: 2px dashed ${theme.colorBorder};
    border-radius: ${theme.borderRadiusLG}px;
    color: ${theme.colorTextTertiary};
    cursor: pointer;
    transition:
      border-color ${theme.motionDurationMid},
      background-color ${theme.motionDurationMid};

    &:hover {
      border-color: ${theme.colorPrimaryBorderHover};
      background-color: ${theme.colorFillQuaternary};
    }

    &:focus-visible {
      outline: 2px solid ${theme.colorPrimaryBorder};
      outline-offset: 2px;
    }
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
              {/* The dashboard itself, standing in for a canvas that has
                  nothing on it yet. It selects the root because that is the
                  only thing there is to select here, and because how the
                  canvas is arranged is asked in the root's properties — a
                  blank dashboard is exactly when that is asked, since
                  whatever is placed next lands in the mode already chosen.
                  Without this the mode would be unreachable until something
                  had already been placed and then rearranged. */}
              <CanvasPlaceholder
                vertical
                align="center"
                justify="center"
                // eslint-disable-next-line jsx-a11y/prefer-tag-over-role
                role="button"
                tabIndex={0}
                aria-label={t('Dashboard')}
                data-test="empty-canvas"
                onClick={() => provider.setSelection(root.id)}
                onKeyDown={event => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    provider.setSelection(root.id);
                  }
                }}
              >
                <EmptyState
                  image="empty-dashboard.svg"
                  title={t('Start building')}
                  description={t(
                    'Drag a building block from the panel, or ask the assistant for one.',
                  )}
                />
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
