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
import { Icons } from '@superset-ui/core/components/Icons';
import { ErrorBoundary } from 'src/components';
import { provider, useDashboardRevision } from './store';
import { resolveBuildingBlockView } from './resolveBuildingBlockView';
import { blockLabel } from './blockLabel';

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
    // The root is the dashboard itself rather than something on it: it has no
    // name of its own to show, and removing it is refused by the provider, so
    // a header there would be a label saying "Canvas" over a button that only
    // ever raises an error.
    const chrome = nodeId !== provider.getRoot().id;
    const isRoot = !chrome;
    const headerHeight = theme.controlHeightSM;

    return (
      <div
        ref={ref}
        {...rest}
        // Where a node is on screen, for the panels that reach into the
        // canvas from outside it — the Outline scrolls to the block it just
        // selected by finding it here. Set after the spread so a parent
        // renderer cannot displace a node's own identity.
        data-node-id={nodeId}
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
          // A block's contents are positioned against this element.
          // react-grid-layout positions its children itself, so its own value
          // is kept wherever it set one and `relative` only fills the gap
          // when it did not.
          position: rest.style?.position ?? 'relative',
          // The card, drawn around the whole of a block rather than around
          // part of it.
          //
          // This used to be each leaf block's own — every one of them opened
          // with the same background, border and radius — and a leaf begins
          // below the header, so the card's top edge ran between a block's
          // name and its contents. The name sat outside the box it names,
          // reading as a caption dropped over a separate card. Drawn here it
          // encloses both, which is also the only place it can be drawn from:
          // whether a node has a header at all is this component's to know,
          // not the leaf's.
          //
          // Opaque for the same reason it is one card: on a free canvas
          // blocks overlap, and anything a block does not paint is a window
          // onto whatever is behind it.
          backgroundColor: isRoot ? undefined : theme.colorBgContainer,
          border: `1px solid ${theme.colorBorderSecondary}`,
          borderRadius: theme.borderRadiusLG,
          // Nothing reaches past the corners this rounds — a block's content
          // is square and would otherwise fill them back in.
          overflow: isRoot ? undefined : 'hidden',
          // The dashboard's own gutter, and what makes it clickable.
          //
          // The root is drawn by a grid that fills its box edge to edge
          // (`containerPadding={[0, 0]}` in CanvasBlock), which left the
          // dashboard with no pixels of its own. The inset is what an author
          // aims at to select the dashboard rather than something on it — and
          // it is the same inset a block's content sits at, so the two read as
          // one scale rather than two. It carries no surface of its own: this
          // is what everything else is arranged *on*, not a card among them.
          padding: isRoot ? theme.padding : undefined,
          // Drawn over the block rather than around it: an outline takes no
          // space, so nothing on screen shifts when a selection moves.
          outline: selected ? `2px solid ${theme.colorPrimary}` : undefined,
          outlineOffset: selected ? -2 : undefined,
        }}
      >
        {/* What this block is, and how to be rid of it.
            The name comes from `blockLabel`, the same call the Outline names
            a row by, so a block is not "Sales by Territory" in one place and
            "ECharts" in the other. A chart's name is authored in its ECharts
            option and ChartBlock stops ECharts drawing it, so it appears here
            once instead of twice.

            `data-block-remove` is what keeps a press on the button from
            starting a react-grid-layout drag; see CanvasBlock's
            `draggableCancel`. The propagation stops are the same idea for the
            two gestures it sits inside: a click here removes rather than
            selects, and a pointer down here grabs nothing.

            The button is nested inside a control, which is not ideal and is
            the price of the wrapper itself being selectable — the alternative
            was a block you can delete only from the panel. The keyboard path
            is not this button: the Outline selects any block with proper tree
            semantics and Properties carries the same Delete. */}
        {chrome && (
          <div
            data-test={`block-header-${nodeId}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: theme.sizeUnit,
              height: headerHeight,
              // Aligned with the inset every block's own content sits at, so
              // a block's name reads as the head of the box beneath it rather
              // than as something floating loose to its left. The right side
              // stays tight: the remove button is a square target of its own
              // and centres its icon, which is the inset it needs.
              paddingLeft: theme.padding,
              paddingRight: theme.sizeUnit,
              // No surface of its own, and no rule under it. The card behind
              // this is opaque and unbroken, so a second background here
              // would only draw a seam across it a hand's width below the
              // top edge — the block would read as a strip and a box rather
              // than as one card with a name on it.
            }}
          >
            <Typography.Text
              ellipsis
              data-test={`block-title-${nodeId}`}
              style={{
                flex: '1 1 auto',
                // The name of the thing below it, not a note about it. At the
                // small size in the secondary colour it read as a caption
                // hanging over the block — and this is the first thing anyone
                // scanning a canvas uses to tell one block from the next, so
                // it is drawn at the weight that job deserves.
                fontSize: theme.fontSize,
                fontWeight: theme.fontWeightStrong,
                color: theme.colorText,
              }}
            >
              {blockLabel(node.type, node.props)}
            </Typography.Text>
            <button
              type="button"
              data-block-remove
              data-test={`block-remove-${nodeId}`}
              aria-label={t('Remove block')}
              title={t('Remove block')}
              onMouseDown={event => event.stopPropagation()}
              onPointerDown={event => event.stopPropagation()}
              onClick={event => {
                event.stopPropagation();
                provider.removeBuildingBlock(nodeId);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flex: '0 0 auto',
                width: headerHeight,
                height: headerHeight,
                padding: 0,
                border: 'none',
                background: 'none',
                color: theme.colorTextTertiary,
                cursor: 'pointer',
              }}
            >
              <Icons.CloseOutlined iconSize="s" />
            </button>
          </div>
        )}
        {/* The block's own box, which is the whole of this element's minus
            the band above it. Subtracted in pixels off a percentage rather
            than left to a flex column, because what a leaf block does with
            the box is resolve `height: 100%` against it — a chart measures
            the result to size its canvas — and that wants a height there is
            no question about. */}
        <div
          data-test={`block-content-${nodeId}`}
          style={{
            width: '100%',
            height: chrome ? `calc(100% - ${headerHeight}px)` : '100%',
          }}
        >
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
