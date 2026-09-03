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
import { EmptyState } from '@superset-ui/core/components';
import { views } from 'src/core/views';
import { DASHBOARD_WIDGETS_LOCATION } from 'src/core/dashboard/resolveWidgetView';
import { provider, useDashboardRevision } from 'src/core/dashboard/store';

/** How long a label may run before it is cut. */
const LABEL_LIMIT = 40;

/**
 * What a node is called in the outline.
 *
 * A registered widget's own name first, because that is what the author chose
 * it by in the palette. Markdown gets its opening words instead — a list of
 * five rows all reading "Markdown" identifies nothing, and the content is the
 * only thing that tells them apart.
 */
const labelOf = (type: string, props: Record<string, unknown> | undefined) => {
  const content = props?.content;
  if (typeof content === 'string' && content.trim() !== '') {
    const text = content.trim().replace(/\s+/g, ' ');
    return text.length > LABEL_LIMIT ? `${text.slice(0, LABEL_LIMIT)}…` : text;
  }
  const registered = views
    .getViews(DASHBOARD_WIDGETS_LOCATION)
    ?.find(view => view.id === type);
  return registered?.name ?? type;
};

/**
 * Selects a node and shows it where it lives.
 *
 * Marking a widget as selected is only half of reaching it: the rows this
 * panel exists for are the ones for widgets the canvas is currently not
 * offering, and an outline that selected something off screen would leave an
 * author looking at a canvas that appears not to have answered. The widget's
 * own element carries `data-node-id` (see `WidgetView`), so the canvas
 * needs no wiring back to here.
 *
 * `nearest` rather than `center`: this fires on every row, and reading down a
 * list of widgets that are already in view should not move the canvas under
 * them. Nothing happens at all when the element is absent — a node can be in
 * the tree without being rendered — and selection has already been set by
 * then either way.
 */
const select = (nodeId: string): void => {
  provider.setSelection(nodeId);
  document
    .querySelector(`[data-node-id="${nodeId}"]`)
    ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
};

/**
 * A node, as a tile to read and to reach through.
 *
 * The same tile the palette is built from, because the two panels are the same
 * kind of thing seen twice: a tree of widgets, one of widgets you could place
 * and one of widgets you did. A widget that is a bordered tile with a name in
 * the Widgets tab and a bare line of text in the Outline reads as two
 * different kinds of object.
 *
 * What it does not borrow is the grip: these do not drag. What it adds is
 * selection, which the palette has no equivalent of — the accent border and
 * fill, kept through hover so a pointer passing over the selected tile does
 * not read as unselecting it.
 */
const OutlineTile = styled.div<{ $selected: boolean }>`
  ${({ theme, $selected }) => css`
    position: relative;
    display: flex;
    align-items: center;
    gap: ${theme.sizeUnit * 2}px;
    padding: ${theme.sizeUnit * 2}px;
    border: 1px solid ${$selected ? theme.colorPrimary : theme.colorBorder};
    /* The same radius the canvas draws the widget itself at, and the
       Palette draws its tile at — one rounding language, not three. */
    border-radius: ${theme.borderRadiusLG}px;
    background-color: ${
      $selected ? theme.colorPrimaryBg : theme.colorFillQuaternary
    };
    font-size: ${theme.fontSizeSM}px;
    color: ${$selected ? theme.colorPrimaryText : theme.colorText};
    cursor: pointer;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    transition:
      border-color ${theme.motionDurationMid},
      background-color ${theme.motionDurationMid};

    &:hover {
      border-color: ${
        $selected ? theme.colorPrimary : theme.colorPrimaryBorderHover
      };
      background-color: ${
        $selected ? theme.colorPrimaryBgHover : theme.colorFillTertiary
      };
    }

    &:focus-visible {
      outline: 2px solid ${theme.colorPrimaryBorder};
      outline-offset: -2px;
    }
  `}
`;

/** The tree itself: the reset, and the space between what is at its top. */
const List = styled.ul`
  ${({ theme }) => css`
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: ${theme.sizeUnit}px;
  `}
`;

/**
 * A node's children, and the guide that says they are its.
 *
 * The same treatment the palette gives a shelf, for the same reason and at the
 * same measurements: indentation alone leaves the eye to infer the grouping
 * from an edge that is not drawn, and here the nesting can run deeper than the
 * palette's single level, so there is that much more to infer.
 *
 * Drawn from here rather than from the tile, because unlike the palette a tile
 * in this tree may itself hold a branch — and the guide has to clear that
 * whole subtree to reach the sibling below it. So the vertical is drawn on the
 * list item, which is the tile *and* everything under it; only the last item
 * draws it on its own tile instead, stopping at the stub. A guide that carries
 * on past the final tile reads as a branch with something still to come; one
 * drawn on every tile would break wherever a node had children.
 */
const Branch = styled(List)`
  ${({ theme }) => css`
    margin-top: ${theme.sizeUnit}px;
    margin-left: ${theme.sizeUnit * 2}px;
    padding-left: ${theme.sizeUnit * 3}px;

    & > li {
      position: relative;
    }

    /* The vertical, past everything this item holds, to the one below it. */
    & > li:not(:last-child)::before,
    /* The last item's, stopping where its own stub meets it. */
    & > li:last-child > [role='treeitem']::before,
    /* Every item's stub back to the guide. */
    & > li > [role='treeitem']::after {
      content: '';
      position: absolute;
      left: -${theme.sizeUnit * 3}px;
      background-color: ${theme.colorBorder};
    }

    & > li:not(:last-child)::before {
      top: -${theme.sizeUnit}px;
      bottom: -${theme.sizeUnit}px;
      width: 1px;
    }

    & > li:last-child > [role='treeitem']::before {
      top: -${theme.sizeUnit}px;
      bottom: 50%;
      width: 1px;
    }

    & > li > [role='treeitem']::after {
      top: 50%;
      width: ${theme.sizeUnit * 3}px;
      height: 1px;
    }
  `}
`;

/**
 * Set down from the tab bar and in from the panel edge, the same step the
 * palette and the inspector take from theirs. Flush against the tabs, the
 * first row read as a caption hanging off them rather than as the top of a
 * list — and the three tabs of one panel should start on one line.
 */
const Panel = styled.div`
  ${({ theme }) => css`
    padding: ${theme.sizeUnit * 3}px ${theme.sizeUnit}px 0;
  `}
`;

const Row = ({
  nodeId,
  depth,
}: {
  nodeId: string;
  depth: number;
}): ReactElement | null => {
  const node = provider.getNode(nodeId);
  if (!node) {
    return null;
  }
  const selected = provider.getSelection() === nodeId;
  const children = node.children ?? [];

  return (
    <li role="none">
      <OutlineTile
        role="treeitem"
        aria-level={depth + 1}
        aria-selected={selected}
        tabIndex={selected ? 0 : -1}
        data-test={`outline-row-${nodeId}`}
        $selected={selected}
        onClick={() => select(nodeId)}
        onKeyDown={event => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            select(nodeId);
          }
        }}
      >
        {labelOf(node.type, node.props)}
      </OutlineTile>
      {children.length > 0 && (
        <Branch
          // The tags the rule suggests are document sections, not tree
          // structure. `group` inside `tree` is the pattern WAI-ARIA
          // specifies for a treeitem's children, and a screen reader's tree
          // navigation reads it — no semantic element means this.
          // eslint-disable-next-line jsx-a11y/prefer-tag-over-role
          role="group"
        >
          {children.map(childId => (
            <Row key={childId} nodeId={childId} depth={depth + 1} />
          ))}
        </Branch>
      )}
    </li>
  );
};

/**
 * The dashboard's structure, as something to read and to reach into.
 *
 * The canvas shows what a dashboard looks like; this shows what it is made
 * of. That matters most for exactly the widgets the canvas is worst at
 * offering — one nested inside a container, one scrolled out of view, one
 * sized so small there is nothing to click.
 *
 * Choosing a row selects it and leaves the author here. Reading a structure
 * means going through it, and a panel that ejected to Properties on the first
 * row would hide the very row it had just marked as selected.
 */
export default function Outline(): ReactElement {
  useDashboardRevision();
  const root = provider.getRoot();
  const children = root.children ?? [];

  if (children.length === 0) {
    return (
      <Panel data-test="outline-empty">
        <EmptyState
          size="small"
          image="empty-dashboard.svg"
          title={t('Nothing on the dashboard yet')}
          description={t(
            'Widgets you place show up here, in the order they sit on the canvas.',
          )}
        />
      </Panel>
    );
  }

  return (
    <Panel>
      <List role="tree" aria-label={t('Dashboard outline')} data-test="outline">
        {children.map(childId => (
          <Row key={childId} nodeId={childId} depth={0} />
        ))}
      </List>
    </Panel>
  );
}
