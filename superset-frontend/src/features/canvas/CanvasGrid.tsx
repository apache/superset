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
import type {
  CanvasChild,
  CanvasColors,
  CanvasEvent,
  FilterValue,
  ScopeKind,
} from 'src/core/canvas/types';
import { t } from '@apache-superset/core/translation';
import { css, styled, SupersetTheme } from '@apache-superset/core/theme';
import { ErrorBoundary } from 'src/components/ErrorBoundary';
import { useWidgetRenderers } from 'src/core';
import CanvasGridSurface from './CanvasGridSurface';
import type { CanvasLayout } from './useCanvasLayout';
import { CanvasDefinitionResult, DraftChange } from './types';
import { CONTENT } from './changeMarks';
import { CanvasDraftContext, CanvasVersionContext } from './useWidgetRows';
import { CanvasDragProvider } from './useCanvasDrag';
import { useCanvasLogger } from './useCanvasLogger';
import { LOG_ACTIONS_CANVAS_ERROR } from 'src/logger/LogUtils';
import { fitPlacements } from './resolveGrid';
import { CARD_PADDING_UNITS } from './widgetChrome';

/** Current values set by nodes, per scope kind, by node id. */
export type ScopeValues = Record<ScopeKind, Record<string, unknown>>;

export const emptyScopeValues = (): ScopeValues => ({
  filter: {},
  crossFilter: {},
  customization: {},
});

/** Current values published under other kinds, by kind, by node id. */
export type EventValues = Record<string, Record<string, unknown>>;

const SCOPE_KINDS: ReadonlySet<string> = new Set<ScopeKind>([
  'filter',
  'crossFilter',
  'customization',
]);

const NO_VALUES: FilterValue[] = [];
const NO_EVENTS: CanvasEvent[] = [];
const NO_MARKS: Record<string, DraftChange['kind']> = {};

/** Leaf widgets that label themselves rather than take the card's title row. */
const SELF_TITLED: ReadonlySet<string> = new Set(['filter.select']);

/** The key the root grid's child order is reported under. */
const ROOT_NODE_ID = 'root';

/** For each node, the values that reach it from the nodes whose scope includes it. */
function valuesByNode(
  scopes: Record<string, string[]>,
  values: Record<string, unknown>,
): Record<string, FilterValue[]> {
  const byNode: Record<string, FilterValue[]> = {};
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
): Record<string, CanvasEvent[]> {
  const byNode: Record<string, CanvasEvent[]> = {};
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

const GridRoot = styled.div``;

const Stack = styled.div`
  ${({ theme }) => css`
    display: flex;
    flex-direction: column;
    gap: ${theme.sizeUnit * 2}px;
  `}
`;

type CardMark = Extract<DraftChange['kind'], 'new' | 'edited'>;

const CARD_MARK_BORDER: Record<CardMark, (theme: SupersetTheme) => string> = {
  new: theme => theme.colorSuccess,
  edited: theme => theme.colorInfo,
};

/**
 * The surface a leaf widget sits on, styled like a dashboard tile. Not
 * positioned, so a widget's chrome anchors to the grid cell around it.
 */
const Card = styled.div<{ $mark?: CardMark }>`
  ${({ theme, $mark }) => css`
    height: 100%;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: ${theme.marginXS}px;
    padding: ${theme.sizeUnit * CARD_PADDING_UNITS}px;
    background-color: ${theme.dashboardTileBg ?? theme.colorBgContainer};
    border: ${
      theme.dashboardTileBorder ??
      `${theme.lineWidth}px ${theme.lineType} ${theme.colorBorder}`
    };
    border-radius: ${theme.dashboardTileBorderRadius ?? theme.borderRadius}px;
    box-shadow: ${theme.dashboardTileBoxShadow ?? 'none'};
    ${
      $mark &&
      css`
        border-color: ${CARD_MARK_BORDER[$mark](theme)};
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
 * The title row. It reserves no room for the handles and the change mark: the
 * surface draws those over the row on their own backdrop, centred on it.
 *
 * The alignment is the row's rather than the text's, as `display.titleAlign`
 * asks.
 */
const TitleRow = styled.div<{ $align: 'left' | 'center' | 'right' }>`
  ${({ $align }) => css`
    flex: none;
    display: flex;
    align-items: center;
    justify-content: ${ALIGNMENT[$align]};
    min-width: 0;
  `}
`;

/** A widget's name, cut short rather than wrapped onto a second line. */
const WidgetTitle = styled.div`
  ${({ theme }) => css`
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

const CardBody = styled.div`
  flex: 1;
  min-height: 0;
  overflow: auto;
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
  onValueChange: (kind: ScopeKind, nodeId: string, value: unknown) => void;
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
  const log = useCanvasLogger(canvasId, {
    isDraft: Boolean(draftToken),
    versionUuid,
  });
  const {
    definition,
    widgetTypes,
    gridColumns,
    chromeRows = {},
    titles = {},
    widgets = {},
  } = result;
  // Span limits come from the layout rather than the fetched definition: a
  // container's row minimum follows the rows its children occupy, so a write
  // that moves a child moves the minimum with it.
  // Scopes come from the layout for the same reason: a scope follows the
  // tree, so a widget dragged from one group into another is driven by the
  // second group's filters from the moment the write lands -- not from the
  // next refetch, which a canvas with polling off never makes. Events
  // included: left on the fetched definition they were the one kind of wiring
  // that stayed behind with the old container.
  const {
    placements,
    layouts,
    childOrder,
    layoutConstraints,
    filterScopes,
    crossFilterScopes,
    customizationScopes,
    eventScopes,
    // What each widget is tagged with comes from the layout, which every
    // write updates, and not from the fetched definition, which does not
    // catch up until the next poll -- five seconds by default. The banner
    // beside it was moved for this reason and the marks were left behind, so
    // the count said one change while the widget still wore the tag of
    // whatever was done to it last time.
    changes,
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
    // An id the layout knows but the definition does not yet (a widget an
    // agent just added) is skipped until the next fetch brings its node.
    (childOrder?.[nodeId] ?? children).filter(
      child => !removed.has(child) && definition.nodes[child] !== undefined,
    );
  // Props and schema version live on the placement for a structural widget,
  // and with the widget entity otherwise.
  const contentOf = (nodeId: string) => {
    const node = definition.nodes[nodeId];
    return node.widgetId ? widgets[node.widgetId] : node;
  };
  const { gap, rowUnit, columns } = definition.root.layout;
  const { colors, display, crossFilters } = definition.settings;
  const sharedColors = useMemo<CanvasColors>(
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
  const found = useMemo(() => {
    const byNode: Record<string, DraftChange['kind']> = {};
    (changes ?? []).forEach(({ nodeId, kind }) => {
      const held = byNode[nodeId];
      if (held && (CONTENT.has(held) || !CONTENT.has(kind))) return;
      byNode[nodeId] = kind;
    });
    return byNode;
  }, [changes]);
  const rootChildren = orderOf(ROOT_NODE_ID, definition.root.children);
  // Everything on a never-saved canvas is new, so marking it says nothing.
  const neverSaved =
    rootChildren.length > 0 && rootChildren.every(id => found[id] === 'new');
  const marks = neverSaved ? NO_MARKS : found;
  /** Whether a node holds no other widgets, and so sits on a card. */
  const isLeaf = (nodeId: string) =>
    definition.nodes[nodeId]?.children === undefined &&
    gridColumns[nodeId] === undefined;

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
      chromeRows={chromeRows[parentId] ?? 0}
      childIds={childIds}
      columns={gridColumnCount}
      gap={gap}
      rowUnit={rowUnit}
      isContainer={nodeId => gridColumns[nodeId] !== undefined}
      isCard={isLeaf}
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
      marks={marks}
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
      // Its extension isn't loaded on this page, say: the type id means
      // nothing to a viewer.
      return (
        <Placeholder>
          <span>{t('This widget is unavailable')}</span>
        </Placeholder>
      );
    }

    // Built on first read: a grid container renders its children through
    // `renderGrid` and never reads `element`, so building it eagerly doubled
    // the work at every level of nesting.
    const childNodes: CanvasChild[] = childIds.map(childId => {
      let element: ReactNode | undefined;
      return {
        nodeId: childId,
        widgetType: widgetTypes[childId],
        props: contentOf(childId)?.props,
        layout: definition.nodes[childId].layout,
        get element() {
          element ??= renderNode(childId, depth + 1);
          return element;
        },
      };
    });
    const childGridColumns = gridColumns[nodeId];
    const title = titles[nodeId];
    const widget = (
      // A widget that throws during render is otherwise reported nowhere:
      // `ErrorBoundary` renders an alert and tells no one. Only the error's
      // name and the widget's identity are recorded -- a component stack from
      // a data-bound widget routinely embeds the values it was rendering.
      <ErrorBoundary
        onError={(error: Error) =>
          log(LOG_ACTIONS_CANVAS_ERROR, {
            scope: 'widget_render',
            error_type: error.name,
            widget_type: widgetType,
            placement_id: nodeId,
            has_err: true,
          })
        }
      >
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
    if (!isLeaf(nodeId)) return widget;
    // The change tag is the surface's, drawn over the title row beside the
    // handles; see `CanvasGridSurface`.
    const mark = marks[nodeId];
    return (
      <Card
        $mark={mark === 'new' || mark === 'edited' ? mark : undefined}
        data-test="canvas-widget-card"
        data-change={mark}
      >
        {title && !SELF_TITLED.has(widgetType) && (
          <TitleRow $align={display.titleAlign ?? 'left'}>
            <WidgetTitle title={title} data-test="canvas-widget-title">
              {title}
            </WidgetTitle>
          </TitleRow>
        )}
        <CardBody data-test="canvas-widget-body">{widget}</CardBody>
      </Card>
    );
  }

  return (
    <CanvasDraftContext.Provider value={draftToken}>
      {/* One drag at a time, shared by every grid: dragging a widget out of
          its container is a conversation between two of them. */}
      <CanvasDragProvider>
        <CanvasVersionContext.Provider value={versionUuid}>
          <GridRoot data-test="canvas-grid">
            {renderGrid(ROOT_NODE_ID, rootChildren, columns, renderNode, 0)}
          </GridRoot>
        </CanvasVersionContext.Provider>
      </CanvasDragProvider>
    </CanvasDraftContext.Provider>
  );
}
