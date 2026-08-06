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
import { t } from '@apache-superset/core/translation';
import { useTheme } from '@apache-superset/core/theme';
import { Input } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import { views } from 'src/core/views';
import { DASHBOARD_BUILDING_BLOCKS_LOCATION } from 'src/core/dashboard/resolveBuildingBlockView';
import { isContainerType } from 'src/core/dashboard/DashboardProvider';
import { PALETTE_MIME } from 'src/core/dashboard/placement';

/**
 * Which shelf a block sits on.
 *
 * Derived from the one distinction this fork actually records: whether
 * placing the type produces something other blocks can go inside. That is a
 * checkable property of the node the provider builds, not a category anybody
 * maintains, so a block registered by an extension tomorrow is shelved
 * correctly without this file learning its name.
 *
 * There is deliberately no Extensions shelf. A registered `View` carries an
 * id, a name and a description and nothing that says who contributed it, so
 * built-in and extension-contributed blocks are genuinely indistinguishable
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

/** Everything registered as a building block, in the order it was registered. */
export const paletteEntries = (): readonly PaletteEntry[] =>
  (views.getViews(DASHBOARD_BUILDING_BLOCKS_LOCATION) ?? []).map(view => ({
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
}): ReactElement => {
  const theme = useTheme();
  return (
    <div data-test={`palette-shelf-${name.toLowerCase()}`}>
      <button
        type="button"
        aria-expanded={open}
        // The caret carries an `aria-label` of its own, which would otherwise
        // join the shelf's name and announce the shape of the arrow first.
        aria-label={name}
        onClick={onToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: theme.sizeUnit,
          width: '100%',
          padding: `${theme.sizeUnit}px 0`,
          border: 0,
          background: 'none',
          color: theme.colorTextSecondary,
          fontSize: theme.fontSizeSM,
          textAlign: 'left',
          cursor: 'pointer',
        }}
      >
        {open ? (
          <Icons.CaretDownOutlined iconSize="s" />
        ) : (
          <Icons.CaretRightOutlined iconSize="s" />
        )}
        {name}
      </button>
      {open && <div style={{ marginLeft: theme.sizeUnit * 3 }}>{children}</div>}
    </div>
  );
};

/**
 * The building blocks, as things to place.
 *
 * The list is the registry's — `views.getViews('dashboard.buildingBlocks')`,
 * the same call `BuildingBlockView` resolves a renderer through. Registering
 * a block makes it placeable and unregistering one removes it, with no list
 * here to keep in agreement.
 */
export default function Palette({
  onAdd,
}: {
  onAdd: (type: string) => void;
}): ReactElement {
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const [closed, setClosed] = useState<ReadonlySet<string>>(new Set());

  const entries = useMemo(paletteEntries, []);
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
    <div
      data-test="palette"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: theme.sizeUnit,
        // Set down from the tab bar and in from the panel edge: a search
        // field flush against both reads as part of the chrome around the
        // list rather than the way into it.
        padding: `${theme.sizeUnit * 3}px ${theme.sizeUnit}px 0`,
      }}
    >
      <Input
        size="small"
        allowClear
        value={query}
        aria-label={t('Search components')}
        placeholder={t('Search components…')}
        data-test="palette-search"
        prefix={<Icons.SearchOutlined iconSize="s" />}
        style={{ marginBottom: theme.sizeUnit }}
        onChange={event => setQuery(event.target.value)}
      />
      {found.length === 0 ? (
        <p
          data-test="palette-empty"
          style={{
            margin: `${theme.sizeUnit * 2}px 0 0`,
            fontSize: theme.fontSizeSM,
            color: theme.colorTextTertiary,
          }}
        >
          {t('No building block matches “%s”.', query)}
        </p>
      ) : (
        SHELVES.map(shelf => {
          const onShelf = found.filter(entry => entry.shelf === shelf.key);
          // An empty shelf is not a shelf: it would imply something failed to
          // register rather than that nothing of that kind exists.
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
                <button
                  key={entry.type}
                  type="button"
                  draggable
                  title={entry.description}
                  data-test={`palette-${entry.type}`}
                  onClick={() => onAdd(entry.type)}
                  // The grip beside the label promised this and did not
                  // deliver it: the rows carried the affordance of a drag
                  // without the drag. Clicking still appends to whatever is
                  // selected; dragging is how an author says *where*.
                  onDragStart={event => {
                    event.dataTransfer.setData(PALETTE_MIME, entry.type);
                    event.dataTransfer.effectAllowed = 'copy';
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: theme.sizeUnit,
                    width: '100%',
                    textAlign: 'left',
                    padding: `${theme.sizeUnit}px ${theme.sizeUnit * 2}px`,
                    marginBottom: theme.sizeUnit,
                    border: `1px solid ${theme.colorBorder}`,
                    borderRadius: theme.borderRadius,
                    background: theme.colorBgContainer,
                    color: theme.colorText,
                    fontSize: theme.fontSizeSM,
                    cursor: 'grab',
                  }}
                >
                  {entry.label}
                  {/* Decoration: the row already carries the name, so
                      announcing the grip again would only repeat it. */}
                  <Icons.HolderOutlined
                    aria-hidden
                    iconSize="s"
                    iconColor={theme.colorTextTertiary}
                  />
                </button>
              ))}
            </Disclosure>
          );
        })
      )}
    </div>
  );
}
