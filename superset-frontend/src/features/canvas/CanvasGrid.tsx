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
import { CanvasDefinitionResult, GridPlacement } from './types';
import { CanvasDraftContext, CanvasVersionContext } from './useWidgetRows';

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

interface GridMetrics {
  columns: number;
  gap: number;
  rowUnit: number;
}

const Grid = styled.div<GridMetrics>`
  display: grid;
  grid-template-columns: repeat(${({ columns }) => columns}, minmax(0, 1fr));
  grid-auto-rows: ${({ rowUnit }) => rowUnit}px;
  gap: ${({ gap }) => gap}px;
`;

const GridItem = styled.div<{ placement?: GridPlacement }>`
  min-width: 0;
  min-height: 0;
  ${({ placement }) =>
    placement &&
    css`
      grid-column: ${placement.col} / span ${placement.colSpan};
      grid-row: ${placement.row} / span ${placement.rowSpan};
    `}
`;

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
  draftToken,
  versionUuid,
}: CanvasGridProps) {
  const getRenderer = useWidgetRenderers();
  const {
    definition,
    placements,
    widgetTypes,
    gridColumns,
    filterScopes,
    crossFilterScopes,
    customizationScopes,
    eventScopes,
    titles = {},
    widgets = {},
  } = result;
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

  const renderGrid = (
    childIds: string[],
    gridColumnCount: number,
    render: (nodeId: string) => ReactNode,
  ) => (
    <Grid columns={gridColumnCount} gap={gap} rowUnit={rowUnit}>
      {childIds.map(childId => (
        <GridItem
          key={childId}
          placement={placements[childId]}
          data-test="canvas-node"
          data-node-id={childId}
        >
          {render(childId)}
        </GridItem>
      ))}
    </Grid>
  );

  function renderNode(nodeId: string): ReactNode {
    const node = definition.nodes[nodeId];
    const childIds = node.children ?? [];
    const widgetType = widgetTypes[nodeId];

    if (widgetType === undefined) {
      return (
        <Placeholder>
          <span>{t('This widget is unavailable')}</span>
          {childIds.length > 0 && (
            <Stack>
              {childIds.map(childId => (
                <div key={childId}>{renderNode(childId)}</div>
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
      element: renderNode(childId),
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
          renderGrid={() =>
            childGridColumns !== undefined ? (
              renderGrid(childIds, childGridColumns, renderNode)
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
      <CanvasVersionContext.Provider value={versionUuid}>
        <div data-test="canvas-grid">
          {renderGrid(definition.root.children, columns, renderNode)}
        </div>
      </CanvasVersionContext.Provider>
    </CanvasDraftContext.Provider>
  );
}
