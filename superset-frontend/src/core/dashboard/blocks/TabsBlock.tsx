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
import { useLayoutEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { t } from '@apache-superset/core/translation';
import { css, styled } from '@apache-superset/core/theme';
import { ActionButton } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import { provider, useDashboardRevision } from '../store';
import { FlowContent } from './flowContent';

/**
 * A pane's own child type — not registered as a building block in its own
 * right (see `registerBuiltInBuildingBlocks`), since nothing ever resolves
 * one through `resolveBuildingBlockView`: this component renders a pane's
 * `children` directly rather than rendering the pane node itself through
 * `BuildingBlockView`. It only needs to be a *container* type (so
 * `addBuildingBlock` gives it a `children` array) — see
 * `registerContainerType` in `DashboardProvider`.
 */
export const TAB_TYPE = 'tab';

/**
 * The negative margin is what keeps the tab bar full-width.
 *
 * `BuildingBlockView` now insets every block's content by the card's own
 * padding (see its own comment) — right for a chart or a table, which is a
 * single thing filling the card, but wrong for a strip of tabs, which reads
 * as cut short the moment it does not reach the card's edges the way a
 * header would. `FlowContent` keeps its own inset (see its own comment) for
 * the content flowed into a pane, which is the single-thing case the
 * padding was written for; this cancels that same padding for the chrome
 * around it — on three sides only. The top is not the card's own padding to
 * begin with:
 * this box starts right where the header already ends, not at the card's
 * true top edge, so cancelling it as well pulled the tab bar up past the
 * header instead of just to the card's left/right/bottom edges, overlapping
 * the two.
 */
const Root = styled.div`
  ${({ theme }) => css`
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    margin: 0 -${theme.padding}px -${theme.padding}px;
  `}
`;

const TabBar = styled.div`
  ${({ theme }) => css`
    display: flex;
    align-items: center;
    gap: ${theme.sizeUnit}px;
    flex: 0 0 auto;
    padding: 0 ${theme.sizeUnit * 2}px;
    border-bottom: 1px solid ${theme.colorBorderSecondary};
    overflow-x: auto;
  `}
`;

const TabButton = styled.button<{ $active: boolean }>`
  ${({ theme, $active }) => css`
    appearance: none;
    border: none;
    background: none;
    flex: 0 0 auto;
    padding: ${theme.sizeUnit * 2}px ${theme.sizeUnit * 3}px;
    font-size: ${theme.fontSizeSM}px;
    font-weight: ${$active ? theme.fontWeightStrong : theme.fontWeightNormal};
    color: ${$active ? theme.colorPrimaryText : theme.colorTextSecondary};
    border-bottom: 2px solid ${$active ? theme.colorPrimary : 'transparent'};
    white-space: nowrap;
    cursor: pointer;
    transition:
      color ${theme.motionDurationMid},
      border-color ${theme.motionDurationMid};

    &:hover {
      color: ${theme.colorPrimaryText};
    }

    &:focus-visible {
      outline: 2px solid ${theme.colorPrimaryBorder};
      outline-offset: -2px;
    }
  `}
`;

/**
 * A tab and its own remove control, as siblings rather than one nested
 * inside the other.
 *
 * `TabButton` is a real `<button>` — switching tabs is what most presses on
 * it mean, and a button is what answers Enter/Space and reads as one to a
 * screen reader. The remove control is `ActionButton`, itself a `<button>`,
 * and a button inside a button is invalid HTML that nothing downstream can
 * reliably navigate into. Wrapped here as two controls sharing a row
 * instead, the same shape `BuildingBlockView`'s own header takes for a name
 * and its own remove control.
 */
const TabItem = styled.span`
  display: flex;
  align-items: center;
  flex: 0 0 auto;
`;

/** What a pane is called before an author (or the assistant) names it. */
const untitledLabel = (index: number): string => t('Tab %s', index + 1);

/**
 * The built-in `tabs` building block — a container whose own children (each
 * a `tab` pane, itself a container) are switchable rather than all shown at
 * once. Registered like any other block (see `registerBuiltInBuildingBlocks`),
 * it holds children of its own like the root's own grid does — but unlike
 * the root, it has no grid: which pane is showing is this component's own
 * concern, not a `layout` fact the document carries. Per the
 * composition/layout design doc, that's the point — a container answers
 * "how do I arrange what's inside me" for itself, and this is simply one
 * answer among many, no more privileged than the root's own grid.
 *
 * Which pane is *active* is intentionally not persisted: it's a fact about
 * who's looking at the dashboard right now, not about the dashboard itself
 * (the same reasoning `DashboardProvider`'s own `selection` field is
 * host-internal rather than part of a node). It resets to the first pane
 * whenever the previously active one no longer exists — most commonly right
 * after that pane is removed, or on a first render with no pane yet.
 */
export default function TabsBlock({
  nodeId,
}: {
  nodeId: string;
}): ReactElement | null {
  useDashboardRevision();
  const node = provider.getNode(nodeId);
  const panes = node?.children ?? [];

  const [activeTabId, setActiveTabId] = useState<string | undefined>(panes[0]);
  const activeIsValid =
    activeTabId !== undefined && panes.includes(activeTabId);
  if (!activeIsValid && activeTabId !== panes[0]) {
    setActiveTabId(panes[0]);
  }

  const addTab = (): void => {
    const id = provider.addBuildingBlock(nodeId, panes.length, {
      type: TAB_TYPE,
      props: { label: untitledLabel(panes.length) },
    });
    setActiveTabId(id);
  };

  // A tabs block with nothing in it yet has nothing to switch between —
  // the first thing anyone would do with one is press + once anyway, so
  // this does it for them. An effect rather than done inline during render:
  // render must not mutate the document itself, only read it. Laid out
  // rather than a plain effect so the fill-in happens before the browser
  // ever paints the empty state, which would otherwise flash for one frame
  // on every block placed from the palette.
  useLayoutEffect(() => {
    if (node && panes.length === 0) {
      addTab();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeId, node, panes.length]);

  if (!node) return null;

  return (
    <Root data-test={`tabs-${nodeId}`}>
      <TabBar role="tablist" aria-label={t('Tabs')}>
        {panes.map((paneId, index) => {
          const pane = provider.getNode(paneId);
          const label =
            (pane?.props?.label as string | undefined) || untitledLabel(index);
          const active = paneId === activeTabId;
          return (
            <TabItem key={paneId}>
              <TabButton
                type="button"
                role="tab"
                tabIndex={0}
                aria-selected={active}
                $active={active}
                data-test={`tab-${paneId}`}
                onClick={() => setActiveTabId(paneId)}
              >
                {label}
              </TabButton>
              {/* Offered once there is a second tab to fall back to —
                  removing the only one just left a blank tabs block the
                  effect above would immediately refill, which reads as the
                  control having silently done nothing. */}
              {panes.length > 1 && (
                <ActionButton
                  label={t('Remove tab')}
                  tooltip={t('Remove tab')}
                  placement="bottom"
                  dataTest={`tab-remove-${paneId}`}
                  icon={<Icons.CloseOutlined iconSize="s" />}
                  onClick={() => provider.removeBuildingBlock(paneId)}
                />
              )}
            </TabItem>
          );
        })}
        <ActionButton
          label={t('Add tab')}
          tooltip={t('Add tab')}
          placement="bottom"
          dataTest={`tabs-add-${nodeId}`}
          icon={<Icons.PlusOutlined iconSize="s" />}
          onClick={addTab}
        />
      </TabBar>
      {/* `activeTabId` is only briefly undefined, on the very first render
          before the layout effect above fills the tabs block in — skipping
          `FlowContent` for that one tick is what keeps this from ever
          needing a pane id it does not have yet. */}
      {activeTabId && (
        <FlowContent
          containerId={activeTabId}
          emptyTitle={t('Nothing in this tab yet')}
          emptyDescription={t('Ask the assistant to add something here.')}
          dataTest={`tabs-panes-${nodeId}`}
        />
      )}
    </Root>
  );
}
