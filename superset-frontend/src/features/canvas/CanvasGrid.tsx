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
import { Tag } from '@superset-ui/core/components';
import { ErrorBoundary } from 'src/components/ErrorBoundary';
import { useWidgetRenderers } from 'src/core';
import CanvasGridSurface from './CanvasGridSurface';
import type { CanvasLayout } from './useCanvasLayout';
import { CanvasDefinitionResult, DraftChange } from './types';
import { MARKS, OUTLINED } from './changeMarks';
import { CanvasDraftContext, CanvasVersionContext } from './useWidgetRows';
import { CanvasDragProvider } from './useCanvasDrag';
import { fitPlacements } from './resolveGrid';

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

/** Never squeezed by a long title, and no taller than the row it sits in. */
const Mark = styled(Tag)`
  ${({ theme }) => css`
    flex: none;
    margin: 0;
    line-height: ${theme.sizeUnit * 5}px;
  `}
`;

const Titled = styled.div<{ $mark?: DraftChange['kind'] }>`
  ${({ theme, $mark }) => css`
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: ${theme.sizeUnit}px;
    ${
      $mark &&
      OUTLINED.has($mark) &&
      css`
        /* Inset, so marking a widget moves nothing on the grid around it. */
        box-shadow: inset 0 0 0 2px
          ${$mark === 'new' ? theme.colorSuccess : theme.colorPrimary};
        border-radius: ${theme.borderRadius}px;
      `
    }
  `}
`;

/** Where the title sits across the strip, as `display.titleAlign` asks. */
const ALIGNMENT = {
  left: 'flex-start',
  center: 'center',
  right: 'flex-end',
} as const;

/**
 * The title row: the widget's name, and what just happened to it.
 *
 * The same strip the handles occupy, and the same height as them
 * (`sizeUnit * 8`, see `Grip`), so the name, the tag, the grip, the remove
 * button and the menu all sit on one line. Left to its content height the row
 * hugged the widget's top edge and the text read as sitting on the border
 * rather than inside it.
 *
 * The clearances are the row's rather than the title's, because the handles
 * float over the row as a whole: an unnamed widget's tag would otherwise
 * start under the grip, and a long name would push the tag under the remove
 * button.
 *
 * The alignment is the row's rather than the text's for the same reason: the
 * name and the tag beside it read as one thing, and centring the text inside
 * its own box would leave the tag stranded at the far edge of the widget.
 */
const TitleRow = styled.div<{ $align: 'left' | 'center' | 'right' }>`
  ${({ theme, $align }) => css`
    display: flex;
    align-items: center;
    justify-content: ${ALIGNMENT[$align]};
    gap: ${theme.sizeUnit * 2}px;
    min-width: 0;
    min-height: ${theme.sizeUnit * 8}px;
    /* Clear of the grip: 4 units of corner, then its own 8. */
    padding-left: ${theme.sizeUnit * 12}px;
    /* Clear of the menu (5 units in, 8 wide) and the remove button beside it. */
    padding-right: ${theme.sizeUnit * 21}px;
  `}
`;

/**
 * A widget's name, in the strip its handles share.
 *
 * The grip sits at the top left and the remove button and menu at the top
 * right, all absolutely positioned over this row, so the title is inset past
 * both rather than running under them. Horizontal room rather than a band of
 * its own: a tile is short, and a reserved strip above every title would cost
 * more of it than the handles do.
 */
const WidgetTitle = styled.div`
  ${({ theme }) => css`
    /* Shrinks so the tag beside it is never the thing that gets cut. */
    min-width: 0;
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
    chromeRows = {},
    eventScopes,
    titles = {},
    changes,
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
    remove,
    removed,
  } = layout;
  /**
   * The placements with every container grown to hold what is in it.
   *
   * The server does this on the write (`_fit`), but a layout written here
   * lands optimistically and the response does not come back for a round
   * trip. A container clips what does not fit, so without this a widget
   * dropped past a group's last row is drawn cut in half at the group's edge
   * until the server says what the client could already work out.
   *
   * Falls through to the server's own answer whenever nothing needed growing,
   * which is almost always: re-deriving placements that are already right
   * gains nothing and gives the two somewhere to disagree.
   */
  const fitted = useMemo(
    () =>
      fitPlacements(
        {
          childOrder: childOrder ?? {},
          columns: gridColumns,
          chromeRows,
        },
        layouts,
        ROOT_NODE_ID,
        definition.root.layout.columns,
      ) ?? placements,
    [
      childOrder,
      gridColumns,
      chromeRows,
      layouts,
      placements,
      definition.root.layout.columns,
    ],
  );

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
    (childOrder?.[nodeId] ?? children).filter(child => !removed.has(child));
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

  /**
   * What to mark each widget with, from the draft's list of changes.
   *
   * Content wins over layout where a widget has both: a chart that was
   * recoloured and then nudged is still a chart whose numbers changed, and
   * marking it "Moved" would hide that. Within a kind the newest wins, and
   * the list arrives newest first.
   */
  const marks = useMemo(() => {
    const found: Record<string, DraftChange['kind']> = {};
    (changes ?? []).forEach(({ nodeId, kind }) => {
      const held = found[nodeId];
      if (held && (OUTLINED.has(held) || !OUTLINED.has(kind))) return;
      found[nodeId] = kind;
    });
    return found;
  }, [changes]);

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
      placements={fitted}
      layouts={layouts}
      constraints={layoutConstraints}
      editable={editable}
      onPlace={place}
      onSwap={swap}
      onMove={move}
      onRemove={remove}
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
          title={title}
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
    const mark = marks[nodeId];
    // A widget with neither a name nor a change has no row to draw.
    if (!title && !mark) return widget;
    return (
      <Titled $mark={mark}>
        <TitleRow $align={display.titleAlign ?? 'left'}>
          {title && (
            <WidgetTitle title={title} data-test="canvas-widget-title">
              {title}
            </WidgetTitle>
          )}
          {mark && mark !== 'removed' && (
            <Mark color={MARKS[mark].color} data-test="canvas-widget-mark">
              {MARKS[mark].label()}
            </Mark>
          )}
        </TitleRow>
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
