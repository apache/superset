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
import { ReactNode, useMemo } from 'react';
import type { canvas as canvasApi } from '@apache-superset/core';
import { t } from '@apache-superset/core/translation';
import { css, styled } from '@apache-superset/core/theme';
import { ErrorBoundary } from 'src/components/ErrorBoundary';
import { useWidgetRenderers } from 'src/core';
import CanvasGridSurface from './CanvasGridSurface';
import type { CanvasLayout } from './useCanvasLayout';
import { CanvasDefinitionResult } from './types';
import { CanvasDraftContext, CanvasVersionContext } from './useWidgetRows';
import { CanvasDragProvider } from './useCanvasDrag';

/** Current values set by nodes, per scope kind, by node id. */
export type ScopeValues = Record<canvasApi.ScopeKind, Record<string, unknown>>;

export const emptyScopeValues = (): ScopeValues => ({
  filter: {},
  crossFilter: {},
  customization: {},
});

/** Current values published under other kinds, by kind, by node id. */
export type EventValues = Record<string, Record<string, unknown>>;

const SCOPE_KINDS: ReadonlySet<string> = new Set<canvasApi.ScopeKind>([
  'filter',
  'crossFilter',
  'customization',
]);

const NO_VALUES: canvasApi.FilterValue[] = [];
const NO_EVENTS: canvasApi.CanvasEvent[] = [];

/** The key the root grid's child order is reported under. */
const ROOT_NODE_ID = 'root';

/** For each node, the values that reach it from the nodes whose scope includes it. */
function valuesByNode(
  scopes: Record<string, string[]>,
  values: Record<string, unknown>,
): Record<string, canvasApi.FilterValue[]> {
  const byNode: Record<string, canvasApi.FilterValue[]> = {};
  Object.entries(scopes).forEach(([filterNodeId, targets]) => {
    if (values[filterNodeId] === undefined) return;
    targets.forEach(nodeId => {
      (byNode[nodeId] ??= []).push({
        filterNodeId,
        value: values[filterNodeId],
      });
    });
  });
  return byNode;
}

function eventsByNode(
  scopes: Record<string, string[]>,
  events: EventValues,
): Record<string, canvasApi.CanvasEvent[]> {
  const byNode: Record<string, canvasApi.CanvasEvent[]> = {};
  Object.entries(events).forEach(([kind, values]) => {
    Object.entries(valuesByNode(scopes, values)).forEach(
      ([nodeId, reaching]) => {
        reaching.forEach(({ filterNodeId, value }) => {
          (byNode[nodeId] ??= []).push({
            kind,
            sourceNodeId: filterNodeId,
            value,
          });
        });
      },
    );
  });
  return byNode;
}
const Stack = styled.div`
  ${({ theme }) => css`
    display: flex;
    flex-direction: column;
    gap: ${theme.sizeUnit * 2}px;
  `}
`;

const Titled = styled.div`
  ${({ theme }) => css`
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: ${theme.sizeUnit}px;
  `}
`;

const WidgetTitle = styled.div`
  ${({ theme }) => css`
    flex: none;
    overflow: hidden;
    color: ${theme.colorTextHeading};
    font-size: ${theme.fontSizeLG}px;
    font-weight: ${theme.fontWeightStrong};
    line-height: ${theme.lineHeightLG};
    text-overflow: ellipsis;
    white-space: nowrap;
  `}
`;

const TitledBody = styled.div`
  flex: 1;
  min-height: 0;
`;

const Placeholder = styled.div`
  ${({ theme }) => css`
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: ${theme.sizeUnit}px;
    padding: ${theme.sizeUnit * 2}px;
    border: 1px dashed ${theme.colorBorder};
    border-radius: ${theme.borderRadius}px;
    color: ${theme.colorTextSecondary};
    text-align: center;
  `}
`;

export interface CanvasGridProps {
  canvasId: number;
  result: CanvasDefinitionResult;
  values: ScopeValues;
  onValueChange: (
    kind: canvasApi.ScopeKind,
    nodeId: string,
    value: unknown,
  ) => void;
  events?: EventValues;
  onPublish?: (kind: string, nodeId: string, value: unknown) => void;
  /** Per node, how many automatic refreshes have reached it. */
  refreshKeys?: Record<string, number>;
  /** Placements to render and the write path drag and resize commit through. */
  layout: CanvasLayout;
  /**
   * Whether this canvas may be rearranged by hand. Decided by the caller, not
   * read from `canEdit`: having permission is necessary but not sufficient --
   * editing happens in a plan, and the published canvas is read-only.
   */
  editable: boolean;
  /** The draft being shown; widgets read their data from it. */
  draftToken?: string;
  /** The version being previewed; widgets read their data from it. */
  versionUuid?: string;
}

/**
 * Renders a canvas definition: nodes on the root grid, each through the
 * renderer registered for its widget type. Placement comes resolved from the
 * server, so nothing here re-implements auto-placement.
 */
export default function CanvasGrid({
  canvasId,
  result,
  values,
  onValueChange,
  events = {},
  onPublish,
  refreshKeys = {},
  layout,
  editable,
  draftToken,
  versionUuid,
}: CanvasGridProps) {
  const getRenderer = useWidgetRenderers();
  const {
    definition,
    widgetTypes,
    gridColumns,
    eventScopes,
    titles = {},
    widgets = {},
  } = result;
  // Span limits come from the layout rather than the fetched definition: a
  // container's row minimum follows the rows its children occupy, so a write
  // that moves a child moves the minimum with it.
  // Scopes come from the layout for the same reason: a scope follows the
  // tree, so a widget dragged from one group into another is driven by the
  // second group's filters from the moment the write lands -- not from the
  // next refetch, which a canvas with polling off never makes.
  const {
    placements,
    layouts,
    childOrder,
    layoutConstraints,
    filterScopes,
    crossFilterScopes,
    customizationScopes,
    place,
    move,
    swap,
  } = layout;
  /**
   * A grid's children in reading order. The server's order wins where it has
   * one: a `place` reorders them so the dropped widget keeps the spot it
   * landed on, and the fetched definition does not catch up until the next
   * poll. Containers that are not grids (tabs, say) are not reordered, so
   * they keep the definition's order.
   */
  const orderOf = (nodeId: string, children: string[]) =>
    // Tolerant of the field being absent altogether, which is what a response
    // from a server that predates it looks like. Rendering a canvas in the
    // order it was stored in is a stale preview; throwing here would be a
    // blank page.
    childOrder?.[nodeId] ?? children;
  // Props and schema version live on the placement for a structural widget,
  // and with the widget entity otherwise.
  const contentOf = (nodeId: string) => {
    const node = definition.nodes[nodeId];
    return node.widgetId ? widgets[node.widgetId] : node;
  };
  const { gap, rowUnit, columns } = definition.root.layout;
  const { colors, display, crossFilters } = definition.settings;
  const sharedColors = useMemo<canvasApi.CanvasColors>(
    () => ({ scheme: colors.scheme, labelColors: colors.labelColors }),
    [colors.scheme, colors.labelColors],
  );

  const filtersByNode = useMemo(
    () => valuesByNode(filterScopes, values.filter),
    [filterScopes, values.filter],
  );
  const crossFiltersByNode = useMemo(
    () => valuesByNode(crossFilterScopes, values.crossFilter),
    [crossFilterScopes, values.crossFilter],
  );
  const customizationsByNode = useMemo(
    () => valuesByNode(customizationScopes, values.customization),
    [customizationScopes, values.customization],
  );
  const publishedByNode = useMemo(
    () => eventsByNode(eventScopes, events),
    [eventScopes, events],
  );

  // How deeply a grid is nested, so its handles can sit clear of the handles
  // of the widgets inside it: a container's own box starts where its first
  // child's does, and the container's handles are painted last.
  const renderGrid = (
    parentId: string,
    childIds: string[],
    gridColumnCount: number,
    render: (nodeId: string) => ReactNode,
    depth: number,
    // Only the container knows whether it drew anything above its grid, so it
    // is the one that says so; see `stepsAside`.
    chromeAbove = false,
  ) => (
    <CanvasGridSurface
      parentId={parentId}
      chromeAbove={chromeAbove}
      childIds={childIds}
      columns={gridColumnCount}
      gap={gap}
      rowUnit={rowUnit}
      isContainer={nodeId => gridColumns[nodeId] !== undefined}
      // What the widget is, rather than its id: the id is a slug nobody chose.
      labelOf={nodeId => widgetTypes[nodeId] ?? nodeId}
      placements={placements}
      layouts={layouts}
      constraints={layoutConstraints}
      editable={editable}
      onPlace={place}
      onSwap={swap}
      onMove={move}
      renderNode={render}
      depth={depth}
    />
  );

  function renderNode(nodeId: string, depth = 0): ReactNode {
    const node = definition.nodes[nodeId];
    const childIds = orderOf(nodeId, node.children ?? []);
    const widgetType = widgetTypes[nodeId];

    if (widgetType === undefined) {
      return (
        <Placeholder>
          <span>{t('This widget is unavailable')}</span>
          {childIds.length > 0 && (
            <Stack>
              {childIds.map(childId => (
                <div key={childId}>{renderNode(childId, depth + 1)}</div>
              ))}
            </Stack>
          )}
        </Placeholder>
      );
    }

    const Renderer = getRenderer(widgetType);
    if (Renderer === undefined) {
      return (
        <Placeholder>
          {t('No renderer for widget type "%s"', widgetType)}
        </Placeholder>
      );
    }

    const childNodes: canvasApi.CanvasChild[] = childIds.map(childId => ({
      nodeId: childId,
      widgetType: widgetTypes[childId],
      props: contentOf(childId)?.props,
      layout: definition.nodes[childId].layout,
      element: renderNode(childId, depth + 1),
    }));
    const childGridColumns = gridColumns[nodeId];
    const title = titles[nodeId];
    const widget = (
      <ErrorBoundary>
        <Renderer
          canvasId={canvasId}
          nodeId={nodeId}
          widgetType={widgetType}
          widgetId={node.widgetId}
          props={contentOf(nodeId)?.props}
          schemaVersion={contentOf(nodeId)?.schemaVersion}
          filters={filtersByNode[nodeId] ?? NO_VALUES}
          crossFilters={crossFiltersByNode[nodeId] ?? NO_VALUES}
          customizations={customizationsByNode[nodeId] ?? NO_VALUES}
          setFilterValue={value => onValueChange('filter', nodeId, value)}
          setCrossFilter={value => {
            if (crossFilters.enabled) {
              onValueChange('crossFilter', nodeId, value);
            }
          }}
          crossFiltersEnabled={crossFilters.enabled}
          setCustomizationValue={value =>
            onValueChange('customization', nodeId, value)
          }
          events={publishedByNode[nodeId] ?? NO_EVENTS}
          publish={(kind, value) => {
            if (!SCOPE_KINDS.has(kind)) onPublish?.(kind, nodeId, value);
          }}
          colors={sharedColors}
          showTimestamp={display.showTimestamps}
          refreshKey={refreshKeys[nodeId] ?? 0}
          childNodes={childNodes}
          renderGrid={options =>
            childGridColumns !== undefined ? (
              renderGrid(
                nodeId,
                childIds,
                childGridColumns,
                childId => renderNode(childId, depth + 1),
                depth + 1,
                options?.chromeAbove,
              )
            ) : (
              <Stack>
                {childNodes.map(child => (
                  <div key={child.nodeId}>{child.element}</div>
                ))}
              </Stack>
            )
          }
        />
      </ErrorBoundary>
    );
    if (!title) return widget;
    return (
      <Titled>
        <WidgetTitle title={title} data-test="canvas-widget-title">
          {title}
        </WidgetTitle>
        <TitledBody>{widget}</TitledBody>
      </Titled>
    );
  }

  return (
    <CanvasDraftContext.Provider value={draftToken}>
      {/* One drag at a time, shared by every grid: dragging a widget out of
          its container is a conversation between two of them. */}
      <CanvasDragProvider>
        <CanvasVersionContext.Provider value={versionUuid}>
          <div data-test="canvas-grid">
            {renderGrid(
              ROOT_NODE_ID,
              orderOf(ROOT_NODE_ID, definition.root.children),
              columns,
              renderNode,
              0,
            )}
          </div>
        </CanvasVersionContext.Provider>
      </CanvasDragProvider>
    </CanvasDraftContext.Provider>
  );
}
