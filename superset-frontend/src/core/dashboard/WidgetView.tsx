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
import { css, styled, useTheme } from '@apache-superset/core/theme';
import { ActionButton, Flex, Typography } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import type { MenuItem } from '@superset-ui/core/components/Menu';
import { ErrorBoundary, KebabMenuButton } from 'src/components';
import { provider, useDashboardRevision } from './store';
import { resolveWidgetView } from './resolveWidgetView';
import { widgetLabel } from './widgetLabel';
import { widgetHeaderControl } from './widgetHeaderControl';
import RootGrid from './RootGrid';

/**
 * The overflow menu's contents — the same items, order and grouping as the
 * real per-chart menu (`SliceHeaderControls`), disabled because none of them
 * has anything to act on yet: this widget renders straight to ECharts with
 * no query context, no Redux chart state, and none of the drill/cross-filter/
 * export plumbing the real ones read from. Placeholders rather than omitted
 * entirely, so the menu reads as what's coming next rather than as empty.
 *
 * Not Remove — the bin beside this menu already offers that, and disabling
 * every entry here to make room for the one live action would bury it.
 */
const PLACEHOLDER_MENU_ITEMS: MenuItem[] = [
  { key: 'force-refresh', label: t('Force refresh'), disabled: true },
  { key: 'fullscreen', label: t('Enter fullscreen'), disabled: true },
  { type: 'divider' },
  { key: 'edit-chart', label: t('Edit chart'), disabled: true },
  {
    key: 'cross-filter-scoping',
    label: t('Cross-filtering scoping'),
    disabled: true,
  },
  { type: 'divider' },
  { key: 'view-query', label: t('View query'), disabled: true },
  { key: 'view-as-table', label: t('View as table'), disabled: true },
  { key: 'drill-to-detail', label: t('Drill to detail'), disabled: true },
  { type: 'divider' },
  { key: 'share', label: t('Share'), disabled: true },
  { key: 'download', label: t('Download'), disabled: true },
];

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
        {t('Unsupported widget type:')} {node.type}
      </Typography.Text>
    </Flex>
  );
}

/**
 * A widget's name, and what can be done to the widget.
 *
 * Carries no surface of its own and no rule under it. The card behind this is
 * opaque and unbroken, so a second background here would only draw a seam
 * across it a hand's width below the top edge — the widget would read as a
 * strip and a box rather than as one card with a name on it.
 */
const BlockHeader = styled.div`
  ${({ theme }) => css`
    display: flex;
    align-items: center;
    gap: ${theme.sizeUnit}px;
    height: ${theme.controlHeightSM}px;
    flex: 0 0 auto;
  `}
`;

/**
 * What the remove control (and a type's own extra header control, if it has
 * one — see `widgetHeaderControl`) sit inside together, pushed to the end of
 * the header as one group.
 *
 * Grouped rather than each carrying its own `margin-left: auto`: the two
 * controls have to land beside each other with nothing but the header's own
 * gap between them, which a shared wrapper gives for free and two
 * independently-pushed elements would not (each would land flush against
 * the header's own right edge, stacking on top of one another instead of
 * sitting side by side). Pushed to the end whether or not a name is there
 * to share the row with — an unnamed type (see widgetLabel's UNNAMED set)
 * leaves nothing on the other side to grow and do this instead.
 */
const HeaderTrailingControls = styled.span`
  ${({ theme }) => css`
    display: flex;
    align-items: center;
    gap: ${theme.sizeUnit}px;
    flex: 0 0 auto;
    margin-left: auto;
  `}
`;

/**
 * What a type's own extra header control (see `widgetHeaderControl`) is
 * wrapped in, and why — the identical reasoning `RemoveSlot`, below, is
 * wrapped for: the control itself is an `ActionButton` (or built from one)
 * whose `onClick` carries no event, so the two gestures this sits inside are
 * stopped here instead — a press on it must act rather than select the
 * widget it is drawn on, and a pointer down on it must not start a grid
 * drag.
 *
 * `data-widget-header-control` is the other half of that second one —
 * `RootGrid` names it in the grid's own drag-cancel selector, which matches
 * it up the ancestors, so carrying it here covers the control inside.
 */
const HeaderControlSlot = styled.span`
  display: flex;
  flex: 0 0 auto;
`;

/**
 * What the remove control is wrapped in, and why it is wrapped at all.
 *
 * The control itself is `ActionButton` — the shared component for an icon
 * action carried on a surface that is already something else, and the one the
 * dashboard list uses for its own Delete. It takes an `onClick` with no event,
 * so the two gestures this sits inside are stopped here instead: a click on
 * the bin must remove rather than select the widget it is drawn on, and a
 * pointer down on it must not start a grid drag.
 *
 * `data-widget-remove` is the other half of that second one — `RootGrid`
 * names it in the grid's own drag-cancel selector, which matches it up the
 * ancestors, so carrying it here covers the button inside.
 */
const RemoveSlot = styled.span`
  display: flex;
  flex: 0 0 auto;
`;

/**
 * What the overflow menu is wrapped in, and why — the same reasoning
 * `RemoveSlot` is wrapped for: a click opening the menu must not also select
 * the widget it sits on, and a pointer down on it must not start a grid
 * drag. `data-widget-menu` is the other half of that second one — see
 * `RootGrid`'s own drag-cancel selector.
 */
const MenuSlot = styled.span`
  display: flex;
  flex: 0 0 auto;
`;

interface WidgetViewProps extends HTMLAttributes<HTMLDivElement> {
  nodeId: string;
}

/**
 * The single entry point for rendering a dashboard node. A node's `type` is
 * resolved against `dashboard.widgets` views — built-in types
 * (markdown/echarts/...) and extension-contributed ones are registered
 * identically (see `registerBuiltInWidgets`), so nothing here knows
 * or cares which kind it's rendering. Falls back to a placeholder if the
 * node doesn't exist, or nothing is registered for its `type`.
 *
 * The root is the one exception: it is not a Widget (see the
 * composition/layout design doc), so there is nothing to look up for it in
 * that registry — its renderer, `RootGrid`, is resolved directly instead.
 * `RootGrid` positions/sizes each child by wrapping it in a grid item element
 * of its own and passing this component an explicit `style={{width:'100%',
 * height:'100%'}}` to fill it — the same convention `flowContent.tsx`'s
 * `FlowItem` already used for a flowed widget, which is why this accepts
 * `...rest` (covering that `style` prop, among others) and forwards a `ref`
 * rather than each widget doing that itself. That's deliberate: a widget,
 * built-in or extension-contributed, should only ever need to fill 100% of
 * whatever box it's given, not know it's sitting in a grid at all, let alone
 * that the grid is draggable/resizable. Before this existed, every widget
 * (and every third-party extension) had to resolve its own placement, which
 * meant reimplementing (and risking drifting from) the same parent-lookup
 * logic — see `dashboard-insights`'s own `getParentDirection` for what that
 * duplication looked like from outside the host bundle, where
 * `DashboardProvider` isn't importable at all.
 * `children` (when present) is a widget's own extra content layered on top of
 * it rather than replacing it — see `flowContent.tsx`'s `ResizeGrip` for the
 * one built-in use of this.
 *
 * Wrapped per-node in an ErrorBoundary: a widget's content (e.g. an
 * AI-authored `echartsOptions` that turns out malformed at render/effect
 * time) is untrusted input the same way a dataset value is, and one bad
 * widget must not unmount the rest of the dashboard along with it.
 */
const WidgetView = forwardRef<HTMLDivElement, WidgetViewProps>(
  function WidgetView({ nodeId, children, ...rest }, ref) {
    useDashboardRevision();
    const theme = useTheme();
    const node = provider.getNode(nodeId);
    if (!node) return null;

    const selected = provider.getSelection() === nodeId;
    // The root is the dashboard itself rather than something on it: it has no
    // name of its own to show, and removing it is refused by the provider, so
    // a header there would be a label saying "Grid" over a button that only
    // ever raises an error.
    const chrome = nodeId !== provider.getRoot().id;
    const isRoot = !chrome;
    // The root's renderer is not looked up in the widget registry —
    // see this component's own doc comment — since the root was never
    // registered there in the first place.
    const resolved = isRoot ? (
      <RootGrid nodeId={nodeId} />
    ) : (
      resolveWidgetView(node.type, nodeId)
    );
    // The same token `BlockHeader` is drawn at: the content box below is this
    // element's height minus the band, so the two have to be one number.
    const headerHeight = theme.controlHeightSM;

    return (
      <div
        ref={ref}
        {...rest}
        // Where a node is on screen, for the panels that reach into the
        // canvas from outside it — the Outline scrolls to the widget it just
        // selected by finding it here. Set after the spread so a parent
        // renderer cannot displace a node's own identity.
        data-node-id={nodeId}
        // Every widget is a thing an author selects, so every widget is a
        // control — announced as one, reachable by Tab, and answering the
        // keys a control answers. The outline offers the same selection in a
        // tree, but a widget you can point at and not reach from the keyboard
        // is still a widget half the people using this cannot select.
        // A real `button` is not available: this element carries its own
        // ref and an injected `style` (see this component's own doc
        // comment), and a widget's content is interactive in its own right —
        // a chart, a table — which a `button` may not contain.
        // eslint-disable-next-line jsx-a11y/prefer-tag-over-role
        role="button"
        tabIndex={0}
        aria-pressed={selected}
        aria-label={node.type}
        // The propagation stop is what makes a click on a widget inside a
        // container select the widget rather than the container holding it —
        // both are nodes and both render through here, so the innermost one
        // has to claim the gesture.
        onClick={event => {
          event.stopPropagation();
          provider.setSelection(nodeId);
        }}
        onKeyDown={event => {
          // Only act on Enter/Space that originated on this wrapper itself —
          // not on a bubbled keypress from an interactive descendant (a tab, a
          // header ActionButton). Hijacking those with preventDefault would
          // select the widget instead of switching the tab / firing the button.
          if (event.target !== event.currentTarget) return;
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            event.stopPropagation();
            provider.setSelection(nodeId);
          }
        }}
        // A card that lifts slightly on hover, the way the app already
        // marks a surface as interactive elsewhere (a popover, a toast) —
        // `css`, not `style`, because a hover state has no inline form.
        // Never on the root: it is the canvas, not a card resting on it.
        css={
          !isRoot &&
          css`
            transition: box-shadow ${theme.motionDurationMid};

            &:hover {
              box-shadow: ${theme.boxShadowSecondary};
            }
          `
        }
        style={{
          ...rest.style,
          // A widget's contents are positioned against this element.
          // A caller that already set its own `position` (nothing does
          // today) is kept; `relative` only fills the gap when it did not.
          position: rest.style?.position ?? 'relative',
          // Sized the same way every other widget already is — everything
          // that is not the root gets its width/height from whatever
          // rendered it (`RootGrid`'s grid item wrapper, or `flowContent.tsx`'s
          // `FlowItem`), passed in through `style` and captured above via
          // `...rest.style`. The root gets no such caller — it is rendered
          // directly, with no props — so without this it has no width or
          // height at all and shrinks to whatever its own content happens to
          // be — which is exactly one widget tall, with nothing below it to
          // drop onto and a scrollbar that flickers in and out as that one
          // widget resizes against it.
          width: isRoot ? '100%' : rest.style?.width,
          height: isRoot ? '100%' : rest.style?.height,
          // The card, drawn around the whole of a widget rather than around
          // part of it.
          //
          // This used to be each leaf widget's own — every one of them opened
          // with the same background, border and radius — and a leaf begins
          // below the header, so the card's top edge ran between a widget's
          // name and its contents. The name sat outside the box it names,
          // reading as a caption dropped over a separate card. Drawn here it
          // encloses both, which is also the only place it can be drawn from:
          // whether a node has a header at all is this component's to know,
          // not the leaf's.
          //
          // Opaque for the same reason it is one card: on a free canvas
          // widgets overlap, and anything a widget does not paint is a window
          // onto whatever is behind it.
          //
          // None of this is true of the root. The root is not a widget on the
          // dashboard, it *is* the dashboard — the surface everything else is
          // arranged on, not a card among them — so it gets none of a card's
          // trappings: no fill, no border, no rounded corners of its own.
          backgroundColor: isRoot ? undefined : theme.colorBgContainer,
          border: isRoot
            ? undefined
            : `1px solid ${theme.colorBorderSecondary}`,
          borderRadius: isRoot ? undefined : theme.borderRadiusLG,
          // Nothing reaches past the corners this rounds — a widget's content
          // is square and would otherwise fill them back in. Moot on the
          // root, which rounds nothing.
          overflow: isRoot ? undefined : 'hidden',
          // One inset for the whole card — the name and the content both
          // sit inside it, rather than each drawing its own. `border-box`
          // keeps it inside the pixel box `RootGrid`/`FlowItem` gave this
          // element (a chart resizes to what's left after this is
          // subtracted) instead of adding to it. The root gets none: it is
          // not a card, and RootGrid already fills it exactly.
          padding: isRoot ? undefined : theme.padding,
          boxSizing: 'border-box',
          // Drawn over the widget rather than around it: an outline takes no
          // space, so nothing on screen shifts when a selection moves.
          //
          // Never on the root: it can still be selected (see `EditorPanel`'s
          // own Properties for it), but the root is the canvas itself, not a
          // widget sitting on it, and an outline meant to mark one widget out
          // from its neighbors instead reads as a frame around the entire
          // dashboard when it is the root wearing it.
          outline:
            selected && !isRoot ? `2px solid ${theme.colorPrimary}` : undefined,
          outlineOffset: selected && !isRoot ? -2 : undefined,
        }}
      >
        {/* What this widget is, and how to be rid of it.
            The name comes from `widgetLabel`, the same call the Outline names
            a row by, so a widget is not "Sales by Territory" in one place and
            "ECharts" in the other. A chart's name is authored in its ECharts
            option and ChartWidget stops ECharts drawing it, so it appears here
            once instead of twice.

            `data-widget-remove` is what keeps a press on the button from
            starting a grid drag; see RootGrid's own drag-cancel selector.
            The propagation stops are the same idea for the two gestures it
            sits inside: a click here removes rather than selects, and a
            pointer down here grabs nothing.

            The button is nested inside a control, which is not ideal and is
            the price of the wrapper itself being selectable — the alternative
            was a widget you can delete only from the panel. The keyboard path
            is not this button: the Outline selects any widget with proper tree
            semantics and Properties carries the same Delete. */}
        {chrome && (
          <BlockHeader data-test={`widget-header-${nodeId}`}>
            {/* Skipped entirely for a type `widgetLabel` leaves unnamed
                (markdown, whose rendered body is right below this and needs
                no caption repeating it) — an empty `Typography.Text` would
                still be a blank strip claiming the header's whole left
                side, not nothing. */}
            {widgetLabel(node.type, node.props) && (
              <Typography.Text
                ellipsis
                data-test={`widget-title-${nodeId}`}
                style={{
                  flex: '1 1 auto',
                  // The name of the thing below it, not a note about it. At the
                  // small size in the secondary colour it read as a caption
                  // hanging over the widget — and this is the first thing anyone
                  // scanning a canvas uses to tell one widget from the next, so
                  // it is drawn at the weight that job deserves.
                  fontSize: theme.fontSize,
                  fontWeight: theme.fontWeightStrong,
                  color: theme.colorText,
                }}
              >
                {widgetLabel(node.type, node.props)}
              </Typography.Text>
            )}
            <HeaderTrailingControls>
              {/* A type's own extra header control — e.g. `collapsible`'s
                  expand/collapse toggle — sits beside Remove rather than
                  below the header, so a widget with one of these is still
                  just a title and its content, not a title, a second bar,
                  and its content. See `widgetHeaderControl`. */}
              {widgetHeaderControl(node.type, nodeId) && (
                <HeaderControlSlot
                  data-widget-header-control
                  onMouseDown={event => event.stopPropagation()}
                  onPointerDown={event => event.stopPropagation()}
                  onClick={event => event.stopPropagation()}
                >
                  {widgetHeaderControl(node.type, nodeId)}
                </HeaderControlSlot>
              )}
              <RemoveSlot
                data-widget-remove
                onMouseDown={event => event.stopPropagation()}
                onPointerDown={event => event.stopPropagation()}
                onClick={event => event.stopPropagation()}
              >
                <ActionButton
                  label={t('Remove widget')}
                  tooltip={t('Remove widget')}
                  placement="bottom"
                  dataTest={`widget-remove-${nodeId}`}
                  onClick={() => provider.removeWidget(nodeId)}
                  // A bin rather than a cross. A cross on a card is the gesture
                  // for dismissing the card — closing it, putting it away — and
                  // this does not put the widget away, it takes it off the
                  // dashboard. The bin is what the rest of the app uses to say
                  // so, and it is the same act the panel offers as Delete.
                  //
                  // Quiet at rest and primary under the pointer, which is
                  // `ActionButton`'s own behaviour and the same answer the
                  // dashboard list gives for its Delete: a bin on every widget,
                  // all of them lit red, would make a canvas read as a row of
                  // things about to be deleted.
                  icon={<Icons.DeleteOutlined iconSize="s" />}
                />
              </RemoveSlot>
              {/* To the bin's right, since the bin is the more common action
                  of the two. See `PLACEHOLDER_MENU_ITEMS`. */}
              <MenuSlot
                data-widget-menu
                onMouseDown={event => event.stopPropagation()}
                onPointerDown={event => event.stopPropagation()}
                onClick={event => event.stopPropagation()}
              >
                <KebabMenuButton
                  ariaLabel={t('More actions')}
                  dataTest={`widget-menu-${nodeId}`}
                  buttonSize="xsmall"
                  buttonStyle="link"
                  iconOrientation="vertical"
                  menuItems={PLACEHOLDER_MENU_ITEMS}
                />
              </MenuSlot>
            </HeaderTrailingControls>
          </BlockHeader>
        )}
        {/* The widget's own box, which is the whole of this element's minus
            the band above it. Subtracted in pixels off a percentage rather
            than left to a flex column, because what a leaf widget does with
            the box is resolve `height: 100%` against it — a chart measures
            the result to size its canvas — and that wants a height there is
            no question about. */}
        <div
          data-test={`widget-content-${nodeId}`}
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

export default WidgetView;
