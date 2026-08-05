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
import { forwardRef, type HTMLAttributes } from 'react';
import { t } from '@apache-superset/core/translation';
import { useTheme } from '@apache-superset/core/theme';
import { Flex, Typography } from '@superset-ui/core/components';
import { ErrorBoundary } from 'src/components';
import { provider, useDashboardRevision } from './store';
import { resolveBuildingBlockView } from './resolveBuildingBlockView';

function UnsupportedBlockPlaceholder({ nodeId }: { nodeId: string }) {
  const theme = useTheme();
  const node = provider.getNode(nodeId);
  if (!node) return null;

  return (
    <Flex
      vertical
      align="center"
      justify="center"
      style={{
        width: '100%',
        height: '100%',
        border: `1px dashed ${theme.colorBorderSecondary}`,
        borderRadius: theme.borderRadiusLG,
        padding: theme.padding,
        backgroundColor: theme.colorFillQuaternary,
      }}
    >
      <Typography.Text type="secondary">
        {t('Unsupported block type:')} {node.type}
      </Typography.Text>
    </Flex>
  );
}

interface BuildingBlockViewProps extends HTMLAttributes<HTMLDivElement> {
  nodeId: string;
}

/**
 * The single entry point for rendering a dashboard node. A node's `type` is
 * resolved against `dashboard.buildingBlocks` views — built-in types
 * (canvas/markdown/echarts) and extension-contributed ones are registered
 * identically (see `registerBuiltInBuildingBlocks`), so nothing here knows
 * or cares which kind it's rendering. Falls back to a placeholder if the
 * node doesn't exist, or nothing is registered for its `type`.
 *
 * A `canvas` parent (`CanvasBlock`) renders its children through
 * `react-grid-layout`, which positions/sizes each child by cloning it and
 * injecting `ref`/`style`/drag-and-resize handlers directly onto whatever
 * element it renders — hence `forwardRef` and spreading `...rest` onto this
 * component's own root div, rather than each block doing that itself. That's
 * deliberate: a block, built-in or extension-contributed, should only ever
 * need to fill 100% of whatever box it's given, not know it's sitting in a
 * grid at all, let alone that the grid is draggable/resizable. Before this
 * existed, every block (and every third-party extension) had to resolve its
 * own placement, which meant reimplementing (and risking drifting from) the
 * same parent-lookup logic — see `dashboard-insights`'s own
 * `getParentDirection` for what that duplication looked like from outside
 * the host bundle, where `DashboardProvider` isn't importable at all.
 * `children` (when present) is `react-grid-layout`'s own resize-handle
 * element, appended after this node's content rather than replacing it.
 *
 * Wrapped per-node in an ErrorBoundary: a block's content (e.g. an
 * AI-authored `echartsOptions` that turns out malformed at render/effect
 * time) is untrusted input the same way a dataset value is, and one bad
 * block must not unmount the rest of the dashboard along with it.
 */
const BuildingBlockView = forwardRef<HTMLDivElement, BuildingBlockViewProps>(
  function BuildingBlockView({ nodeId, children, ...rest }, ref) {
    useDashboardRevision();
    const theme = useTheme();
    const node = provider.getNode(nodeId);
    if (!node) return null;

    const resolved = resolveBuildingBlockView(node.type, nodeId);
    const selected = provider.getSelection() === nodeId;

    return (
      <div
        ref={ref}
        {...rest}
        // Every block is a thing an author selects, so every block is a
        // control — announced as one, reachable by Tab, and answering the
        // keys a control answers. The outline offers the same selection in a
        // tree, but a block you can point at and not reach from the keyboard
        // is still a block half the people using this cannot select.
        // A real `button` is not available: react-grid-layout clones this
        // element to inject its own ref, style and drag handlers, and a
        // block's content is interactive in its own right — a chart, a
        // table — which a `button` may not contain.
        // eslint-disable-next-line jsx-a11y/prefer-tag-over-role
        role="button"
        tabIndex={0}
        aria-pressed={selected}
        aria-label={node.type}
        // The propagation stop is what makes a click on a block inside a
        // container select the block rather than the container holding it —
        // both are nodes and both render through here, so the innermost one
        // has to claim the gesture.
        onClick={event => {
          event.stopPropagation();
          provider.setSelection(nodeId);
        }}
        onKeyDown={event => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            event.stopPropagation();
            provider.setSelection(nodeId);
          }
        }}
        style={{
          ...rest.style,
          // Drawn over the block rather than around it: an outline takes no
          // space, so nothing on screen shifts when a selection moves.
          outline: selected ? `2px solid ${theme.colorPrimary}` : undefined,
          outlineOffset: selected ? -2 : undefined,
        }}
      >
        <div style={{ width: '100%', height: '100%' }}>
          <ErrorBoundary>
            {resolved ?? <UnsupportedBlockPlaceholder nodeId={nodeId} />}
          </ErrorBoundary>
        </div>
        {children}
      </div>
    );
  },
);

export default BuildingBlockView;
