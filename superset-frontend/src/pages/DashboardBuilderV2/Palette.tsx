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
import { useMemo, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import type { views as viewsApi } from '@apache-superset/core';
import { t } from '@apache-superset/core/translation';
import { css, styled } from '@apache-superset/core/theme';
import { EmptyState, Input } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import { useViews } from 'src/core/views';
import { DASHBOARD_WIDGETS_LOCATION } from 'src/core/dashboard/resolveWidgetView';
import { isContainerType } from 'src/core/dashboard/DashboardProvider';
import { PALETTE_MIME } from 'src/core/dashboard/placement';

type View = viewsApi.View;

/**
 * Which shelf a widget sits on.
 *
 * Derived from the one distinction this fork actually records: whether
 * placing the type produces something other widgets can go inside. That is a
 * checkable property of the node the provider builds, not a category anybody
 * maintains, so a widget registered by an extension tomorrow is shelved
 * correctly without this file learning its name.
 *
 * There is deliberately no Extensions shelf. A registered `View` carries an
 * id, a name and a description and nothing that says who contributed it, so
 * built-in and extension-contributed widgets are genuinely indistinguishable
 * here. Splitting them on a dotted-id naming convention would be a guess
 * dressed as a fact; the shelf can be added the day provenance is.
 */
const SHELVES: readonly {
  readonly key: 'structure' | 'content';
  readonly name: string;
}[] = [
  { key: 'structure', name: t('Structure') },
  { key: 'content', name: t('Content') },
];

export interface PaletteEntry {
  readonly type: string;
  readonly label: string;
  readonly description?: string;
  readonly shelf: 'structure' | 'content';
}

/**
 * Everything registered as a widget, in the order it was registered.
 *
 * No filtering needed for the root's own type: `grid` is not registered
 * here at all (see `registerBuiltInWidgets`), since the root is not a
 * Widget — nothing to exclude by name, because it was never in this
 * list to begin with.
 */
export const paletteEntries = (
  registered: readonly View[] | undefined,
): readonly PaletteEntry[] =>
  (registered ?? []).map(view => ({
    type: view.id,
    label: view.name,
    description: view.description,
    shelf: isContainerType(view.id) ? 'structure' : 'content',
  }));

const matches = (entry: PaletteEntry, query: string): boolean => {
  if (query === '') {
    return true;
  }
  const needle = query.toLowerCase();
  return (
    entry.label.toLowerCase().includes(needle) ||
    (entry.description ?? '').toLowerCase().includes(needle)
  );
};

/**
 * The panel's own scroll column.
 *
 * The search field stays put and the shelves move under it: a list long enough
 * to scroll is exactly when the field that filters it must not scroll away.
 */
const Column = styled.div`
  ${({ theme }) => css`
    display: flex;
    flex-direction: column;
    /* The field is not the first item of the list it filters, and at a tighter
       gap it read as one — the shelf below it sat as close to it as its own
       tiles sit to each other. The space is what separates searching the
       palette from reading it. */
    gap: ${theme.sizeUnit * 5}px;
    min-height: 0;
    /* Set down from the tab bar and in from the panel edge: a search field
       flush against both reads as part of the chrome around the list rather
       than the way into it. */
    padding: ${theme.sizeUnit * 3}px ${theme.sizeUnit}px 0;
  `}
`;

const Shelves = styled.div`
  ${({ theme }) => css`
    display: flex;
    flex-direction: column;
    gap: ${theme.sizeUnit}px;
    overflow-y: auto;
    min-height: 0;
  `}
`;

/**
 * A shelf's name, heavier than what is on the shelf.
 *
 * Set in the secondary colour it came out lighter than the rows beneath it,
 * which reads as the shelf belonging to the list rather than the list to the
 * shelf. Same size as its rows and heavier, the same trade the Inspector's
 * section headings make.
 *
 * The hover is a wash rather than the fill a row takes, because a shelf that
 * lights the way a row lights is a row: this one opens and closes a group, and
 * should not look like something to place.
 */
const ShelfButton = styled.button`
  ${({ theme }) => css`
    display: flex;
    align-items: center;
    gap: ${theme.sizeUnit * 2}px;
    width: 100%;
    padding: ${theme.sizeUnit}px;
    border: 0;
    border-radius: ${theme.borderRadiusSM}px;
    background: none;
    color: ${theme.colorText};
    font-size: ${theme.fontSizeSM}px;
    font-weight: ${theme.fontWeightStrong};
    text-align: left;
    cursor: pointer;
    transition: background-color ${theme.motionDurationMid};

    /* The toggle is the shelf's state made visible — plus for shut, minus for
       open — and it is quieter than the name it sits beside, which is what is
       actually being read. */
    .palette-toggle {
      display: flex;
      flex: 0 0 auto;
      color: ${theme.colorTextTertiary};
    }

    &:hover {
      background-color: ${theme.colorFillQuaternary};
    }

    &:focus-visible {
      outline: 2px solid ${theme.colorPrimaryBorder};
      outline-offset: -2px;
    }
  `}
`;

/**
 * What ties a shelf to the widgets on it.
 *
 * The tiles are indented under their shelf, and indentation alone leaves the
 * eye to infer the grouping from an edge that is not drawn. The guide down the
 * left is that edge, and each tile reaches back to it with a stub — so a tile
 * belongs to the shelf above it visibly rather than by inference.
 *
 * The guide is drawn by the tiles rather than here (see `BlockTile`), because
 * where it has to stop is the middle of the last tile and this element cannot
 * know where that is. Drawn in `colorBorder`, which is what this app draws one
 * thing off from another with — the same one the tiles are drawn with, so the
 * guide and what it holds are one weight of line.
 */
const Branch = styled.div`
  ${({ theme }) => css`
    display: flex;
    flex-direction: column;
    gap: ${theme.sizeUnit}px;
    margin-left: ${theme.sizeUnit * 2}px;
    padding-left: ${theme.sizeUnit * 3}px;
  `}
`;

/**
 * A widget, as a tile to pick up.
 *
 * A bordered tile rather than a bare row: what these are is a set of things
 * that get dragged onto a canvas and become boxes there, and a tile with an
 * edge is a thing you can take hold of in a way a line of text is not. The
 * grip states the same thing in the same place on every one of them.
 *
 * The stub reaching left is what joins the tile to its shelf's guide — see
 * `Branch`. It is drawn from the tile rather than by the shelf because only
 * the tile knows where its own middle is.
 *
 * `grab` becoming `grabbing`, and the border taking the accent under the
 * pointer, are the two halves of saying this can be dragged. The focus ring is
 * the same answer for a keyboard, which the row had no visible reply to at all.
 * Every colour here is a token: the tile has to hold up in both themes, and a
 * literal only ever suits the one it was picked in.
 */
const BlockTile = styled.button`
  ${({ theme }) => css`
    position: relative;
    display: flex;
    align-items: center;
    gap: ${theme.sizeUnit * 2}px;
    width: 100%;
    padding: ${theme.sizeUnit * 2}px;
    border: 1px solid ${theme.colorBorder};
    /* The same radius the canvas draws a placed widget's own card at, so a
       tile reads as the same kind of object before and after it is placed. */
    border-radius: ${theme.borderRadiusLG}px;
    background-color: ${theme.colorFillQuaternary};
    color: ${theme.colorText};
    font-size: ${theme.fontSizeSM}px;
    text-align: left;
    cursor: grab;
    transition:
      border-color ${theme.motionDurationMid},
      background-color ${theme.motionDurationMid};

    /* The shelf's guide, and this tile's stub back to it.
       The vertical runs from above the tile — bridging the gap to the one
       before it — down to the tile's own bottom, so the segments meet and read
       as one line. The last tile stops it at the stub: a guide that carries on
       past the final tile reads as a shelf with something still to come. */
    &::before,
    &::after {
      content: '';
      position: absolute;
      left: -${theme.sizeUnit * 3}px;
      background-color: ${theme.colorBorder};
    }

    &::before {
      top: -${theme.sizeUnit}px;
      bottom: 0;
      width: 1px;
    }

    &:last-child::before {
      bottom: 50%;
    }

    &::after {
      top: 50%;
      width: ${theme.sizeUnit * 3}px;
      height: 1px;
    }

    &:hover {
      border-color: ${theme.colorPrimaryBorderHover};
      background-color: ${theme.colorFillTertiary};
    }

    &:active {
      cursor: grabbing;
      border-color: ${theme.colorPrimary};
    }

    &:focus-visible {
      outline: 2px solid ${theme.colorPrimaryBorder};
      outline-offset: -2px;
    }

    /* The grip is part of the tile's answer rather than a control of its own,
       so it strengthens with the tile rather than on its own hover. */
    .palette-grip {
      display: flex;
      flex: 0 0 auto;
      color: ${theme.colorTextQuaternary};
      transition: color ${theme.motionDurationMid};
    }

    &:hover .palette-grip,
    &:focus-visible .palette-grip {
      color: ${theme.colorTextTertiary};
    }
  `}
`;

/**
 * A disclosure the palette drives rather than the browser, so a search can
 * reveal through a shelf the author collapsed and give it back on clearing.
 */
const Disclosure = ({
  name,
  open,
  onToggle,
  children,
}: {
  name: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}): ReactElement => (
  <div data-test={`palette-shelf-${name.toLowerCase()}`}>
    <ShelfButton
      type="button"
      aria-expanded={open}
      // The toggle carries an `aria-label` of its own, which would otherwise
      // join the shelf's name and announce the shape of the glyph first.
      aria-label={name}
      onClick={onToggle}
    >
      <span className="palette-toggle" aria-hidden>
        {open ? (
          <Icons.MinusSquareOutlined iconSize="s" />
        ) : (
          <Icons.PlusSquareOutlined iconSize="s" />
        )}
      </span>
      {name}
    </ShelfButton>
    {open && <Branch>{children}</Branch>}
  </div>
);

/**
 * The widgets, as things to place.
 *
 * The list is the registry's — `useViews('dashboard.widgets')`, the
 * same location `WidgetView` resolves a renderer through for anything
 * other than the root. Registering a widget makes it placeable and
 * unregistering one removes it, with no list here to keep in agreement.
 *
 * `useViews` rather than a one-time read: an extension's own widget
 * registers itself only once its remote module has actually loaded, which
 * is asynchronous (a network fetch for its bundle, then Module Federation's
 * own init) and near-certain to still be in flight on this component's first
 * render. A snapshot taken then would permanently miss every
 * extension-contributed widget that hadn't finished loading yet — built-ins
 * never hit this because `registerBuiltInWidgets` runs synchronously
 * at import time, well before anything here renders.
 */
export default function Palette({
  onAdd,
}: {
  onAdd: (type: string) => void;
}): ReactElement {
  const [query, setQuery] = useState('');
  const [closed, setClosed] = useState<ReadonlySet<string>>(new Set());

  const registered = useViews(DASHBOARD_WIDGETS_LOCATION);
  const entries = useMemo(() => paletteEntries(registered), [registered]);
  const found = entries.filter(entry => matches(entry, query));
  const searching = query.trim() !== '';
  const isOpen = (key: string): boolean => searching || !closed.has(key);
  const toggle = (key: string): void =>
    setClosed(previous => {
      const next = new Set(previous);
      if (!next.delete(key)) {
        next.add(key);
      }
      return next;
    });

  return (
    <Column data-test="palette">
      {/* At the default height rather than `small`. This is the way into the
          whole palette and the only thing on the tab that is typed into, and
          at the smallest step it was shorter than the tiles it filters — the
          one control on the panel read as the least of them. */}
      <Input
        allowClear
        value={query}
        aria-label={t('Search components')}
        placeholder={t('Search components…')}
        data-test="palette-search"
        prefix={<Icons.SearchOutlined iconSize="s" />}
        onChange={event => setQuery(event.target.value)}
      />
      {found.length === 0 ? (
        <div data-test="palette-empty">
          <EmptyState
            size="small"
            image="filter-results.svg"
            title={t('No matching widgets')}
            description={t('Nothing here is called “%s”.', query)}
          />
        </div>
      ) : (
        <Shelves>
          {SHELVES.map(shelf => {
            const onShelf = found.filter(entry => entry.shelf === shelf.key);
            // An empty shelf is not a shelf: it would imply something failed
            // to register rather than that nothing of that kind exists.
            if (onShelf.length === 0) {
              return null;
            }
            return (
              <Disclosure
                key={shelf.key}
                name={shelf.name}
                open={isOpen(shelf.key)}
                onToggle={() => toggle(shelf.key)}
              >
                {onShelf.map(entry => (
                  <BlockTile
                    key={entry.type}
                    type="button"
                    draggable
                    title={entry.description}
                    data-test={`palette-${entry.type}`}
                    onClick={() => onAdd(entry.type)}
                    // The grip beside the label promised this and did not
                    // deliver it: the tiles carried the affordance of a drag
                    // without the drag. Clicking still appends to whatever is
                    // selected; dragging is how an author says *where*.
                    onDragStart={event => {
                      event.dataTransfer.setData(PALETTE_MIME, entry.type);
                      event.dataTransfer.effectAllowed = 'copy';
                    }}
                  >
                    {/* Beside what it drags rather than at the far edge of
                        the tile: the panel is resizable, and a handle pinned
                        right drifts further from its label the wider it is
                        pulled. Decoration — the tile already carries the name,
                        so announcing the grip again would only repeat it. */}
                    <span className="palette-grip" aria-hidden>
                      <Icons.HolderOutlined iconSize="s" />
                    </span>
                    {entry.label}
                  </BlockTile>
                ))}
              </Disclosure>
            );
          })}
        </Shelves>
      )}
    </Column>
  );
}
