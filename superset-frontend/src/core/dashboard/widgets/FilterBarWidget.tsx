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

import type { ReactElement } from 'react';
import { t } from '@apache-superset/core/translation';
import { useTheme } from '@apache-superset/core/theme';
import { Button, EmptyState, Typography } from '@superset-ui/core/components';
import { ErrorBoundary } from 'src/components';
import { provider, useDashboardRevision } from '../store';
import { resolveWidgetView } from '../resolveWidgetView';
import { FILTER_BAR_APPLY_EVENT } from '../filterVocabulary';

/** One filter's own footprint: a name caption plus its (uncompacted) Select — see `FilterSelectWidget`'s own render. */
const FILTER_ITEM_HEIGHT = 88;

/** How wide one filter sits when the bar lays its children out side by side. */
const FILTER_ITEM_WIDTH = 220;

export type FilterBarOrientation = 'horizontal' | 'vertical';

/**
 * The built-in `filter.bar` widget — a plain arranging container for
 * `filter.*` children, registered like any other container type (see
 * `registerBuiltInWidgets`). It holds ordinary filter nodes, added/
 * removed/reordered the same way any other container's children are — by
 * dragging from the Palette and reordering in the Outline, not through a
 * bespoke Inspector UI — and lays them out — that's the entire job. It has
 * no data logic of its own: a filter inside this bar resolves and emits
 * exactly the way a standalone one does (see `FilterSelectWidget`); the
 * only thing this container changes is *when* a filter's own emit happens,
 * by way of the Apply button below — not anything this component itself
 * does.
 *
 * A child renders as just its name and its own control — no card, no
 * header, no per-filter remove button (removing one is the Outline's job).
 * That's deliberately *not* `WidgetView` (every other container's children
 * go through it) — its whole point is the card, header and remove button
 * drawn around a widget's content (see its own doc comment: "the card...
 * drawn here [is] the only place it can be drawn from"), which is exactly
 * the chrome a filter bar's filters don't want. `resolveWidgetView` is the
 * one piece of that worth reusing on its own: the same registry lookup
 * that turns a node's `type` into a rendered element, without the wrapper
 * built around it.
 *
 * `FlowContent` (the shared child-rendering helper `tabs`/`collapsible`/
 * `carousel` all reuse) is deliberately not used here either: it lays
 * children out as a full-width vertical stack with a resize grip on each
 * one, tuned for widgets that want real height (a chart, a table). A filter
 * is a small fixed-footprint control that wants to sit *beside* its
 * siblings at least as often as above them, which is the entire reason
 * this container exists over just dropping several `filter.select` widgets
 * directly on the root — so it gets its own much simpler flex layout
 * instead, sized to what a filter actually needs rather than resizable per
 * child.
 */
export default function FilterBarWidget({
  nodeId,
}: {
  nodeId: string;
}): ReactElement | null {
  useDashboardRevision();
  const theme = useTheme();
  const node = provider.getNode(nodeId);
  if (!node) return null;

  const orientation =
    (node.props?.orientation as FilterBarOrientation | undefined) ??
    'horizontal';
  const childIds = node.children ?? [];
  const horizontal = orientation === 'horizontal';

  return (
    <div
      data-test={`filter-bar-${nodeId}`}
      data-orientation={orientation}
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: horizontal ? 'row' : 'column',
        flexWrap: horizontal ? 'wrap' : 'nowrap',
        alignItems: horizontal ? 'flex-start' : 'center',
        gap: theme.sizeUnit * 4,
        padding: theme.sizeUnit * 3,
        overflow: 'auto',
        boxSizing: 'border-box',
      }}
    >
      {childIds.length === 0 && (
        <EmptyState
          size="small"
          image="empty.svg"
          title={t('No filters yet')}
          description={t(
            'Drag a Filter widget in from the Palette, or ask the assistant.',
          )}
        />
      )}
      {childIds.map(childId => {
        const childNode = provider.getNode(childId);
        // A filter's own target column, e.g. "region" — the closest thing
        // to a name it has today (there's no authored display-label prop
        // on filter.select), and the one fact that actually tells a viewer
        // apart which filter is which at a glance.
        const label =
          (childNode?.props?.column as string | undefined) ?? t('Filter');
        return (
          <div
            key={childId}
            data-node-id={childId}
            style={{
              width: horizontal ? FILTER_ITEM_WIDTH : '100%',
              height: FILTER_ITEM_HEIGHT,
              flex: '0 0 auto',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <Typography.Text
              ellipsis
              style={{
                fontSize: theme.fontSizeSM,
                color: theme.colorTextSecondary,
                marginBottom: theme.sizeUnit,
              }}
            >
              {label}
            </Typography.Text>
            <div style={{ flex: '1 1 auto', minHeight: 0 }}>
              <ErrorBoundary>
                {childNode ? resolveWidgetView(childNode.type, childId) : null}
              </ErrorBoundary>
            </div>
          </div>
        );
      })}
      {childIds.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            marginLeft: horizontal ? 'auto' : undefined,
          }}
        >
          {horizontal && (
            // Matches a filter item's own label exactly — same component,
            // same styles, same content height, just invisible — so this
            // wrapper's own vertical structure mirrors a filter item's
            // (label height, then control) and the button below lands
            // flush with the *selects*, not with the empty space a plain
            // `alignSelf: 'center'` would center against instead (the
            // whole item's box, label included, which the button has no
            // counterpart for).
            <Typography.Text
              aria-hidden
              style={{
                fontSize: theme.fontSizeSM,
                marginBottom: theme.sizeUnit,
                visibility: 'hidden',
              }}
            >
              {' '}
            </Typography.Text>
          )}
          <Button
            buttonSize="small"
            buttonStyle="primary"
            data-test={`filter-bar-apply-${nodeId}`}
            onClick={() => provider.emit(nodeId, FILTER_BAR_APPLY_EVENT, {})}
          >
            {t('Apply')}
          </Button>
        </div>
      )}
    </div>
  );
}
