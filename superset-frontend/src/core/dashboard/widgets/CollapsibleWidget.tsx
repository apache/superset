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
import { css, styled } from '@apache-superset/core/theme';
import { provider, useDashboardRevision } from '../store';
import { FlowContent } from './flowContent';

/**
 * The negative margin is what lets `FlowContent`'s own inset (see its own
 * comment) reach the card's true edges instead of sitting inside it twice —
 * see `TabsWidget`'s identical `Root`, which this mirrors for the identical
 * reason. The top is left alone, since this box already starts below the
 * card's header rather than at its true top edge.
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

/**
 * The built-in `collapsible` widget — a container that holds a
 * single child, shown or hidden behind one toggle. Registered like any
 * other widget (see `registerBuiltInWidgets`), and like `tabs`, it has
 * no grid of its own.
 *
 * The toggle itself is not drawn here: `WidgetView`'s own header
 * already carries this widget's name and its remove control for every widget
 * type, and a second bar in the content below repeating the same idea would
 * make this the only widget type with two header-shaped rows stacked on top
 * of each other. `widgetHeaderControl` puts the toggle in that same header,
 * beside the remove control, so a collapsible widget is — per its own name —
 * a title and its content, nothing else. This component's whole job is
 * therefore just the content half: nothing at all while collapsed (the
 * header above still reads fine on its own), the flowed child once
 * expanded.
 *
 * `props.collapsed` is what `widgetHeaderControl`'s toggle flips, and it also
 * resizes this node's own `layout.rowSpan` down to a header-only height
 * while collapsed (see its own comment) — a fact about the dashboard's own
 * state an author sets deliberately, not a transient fact about who is
 * looking at it right now, so it is persisted rather than kept the way
 * `TabsWidget`'s active pane is.
 *
 * There is no intermediate pane node the way `tabs` has one per tab — one
 * child is already the simplest container `FlowContent` can hold, so
 * `nodeId` itself is the flow area's own `containerId`. `accepts` closes
 * the drop target the moment that one child exists, which is what makes
 * "single child" an actual constraint rather than a suggestion.
 */
export default function CollapsibleWidget({
  nodeId,
}: {
  nodeId: string;
}): ReactElement | null {
  useDashboardRevision();
  const node = provider.getNode(nodeId);
  if (!node) return null;

  const collapsed = Boolean(node.props?.collapsed);
  if (collapsed) return null;

  const children = node.children ?? [];

  return (
    <Root data-test={`collapsible-${nodeId}`}>
      <FlowContent
        containerId={nodeId}
        accepts={children.length === 0}
        emptyTitle={t('Nothing here yet')}
        emptyDescription={t('Ask the assistant to add something here.')}
        dataTest={`collapsible-content-${nodeId}`}
      />
    </Root>
  );
}
