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
import { useCallback, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent, ReactElement } from 'react';
import { t } from '@apache-superset/core/translation';
import { css, styled } from '@apache-superset/core/theme';
import { Button, Tabs } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import { provider, useDashboardRevision } from 'src/core/dashboard/store';
import DataPanel from './DataPanel';
import Inspector from './Inspector';
import Outline from './Outline';
import Palette from './Palette';

type PanelTab = 'data' | 'widgets' | 'properties' | 'outline';

/**
 * How wide the panel opens, and how far it may be dragged.
 *
 * The default is set by the Properties tab, which holds a widget's whole set
 * of fields and is the widest thing here; Data, the palette, and the outline
 * are narrow whatever they are given. The floor is set by the Outline instead:
 * a nested row loses width to every ancestor's own indent, and below this a
 * name a few levels deep has nothing left to ellipsize into. The ceiling
 * leaves a usable canvas on a small screen.
 */
const DEFAULT_WIDTH = 400;
const MIN_WIDTH = 320;
const MAX_WIDTH = 800;
/** How far one arrow press moves the edge. */
const KEYBOARD_STEP = 16;

const clampWidth = (width: number): number =>
  Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, width));

/**
 * The rail, open or shut.
 *
 * Separated from the canvas with `colorSplit`, the same hairline the header
 * rules itself off with, so the three edges of the authoring shell are one
 * line and not three weights of one.
 */
const Rail = styled.aside`
  ${({ theme }) => css`
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    position: relative;
    /* The panel is a fixed-height column and the scrolling happens inside the
       tab body, so the tab bar stays put however long a form gets. */
    overflow: hidden;
    padding: ${theme.sizeUnit * 2}px;
    border-right: 1px solid ${theme.colorSplit};
    background-color: ${theme.colorBgContainer};
  `}
`;

const ClosedRail = styled.aside`
  ${({ theme }) => css`
    flex-shrink: 0;
    display: flex;
    justify-content: center;
    padding: ${theme.sizeUnit}px;
    border-right: 1px solid ${theme.colorSplit};
    background-color: ${theme.colorBgContainer};
  `}
`;

/**
 * The edge, as something to take hold of.
 *
 * The hit area is wide enough to aim at and the line inside it is not: a band
 * of colour the width of the target announced itself as a bar being added to
 * the layout rather than as the edge answering. What lights is a rule down the
 * middle, which is the edge the pointer is already on.
 *
 * Coloured on focus as well as on hover, because focus is the state with no
 * cursor to read — and the width of the authoring surface must be reachable
 * without a pointer at all.
 */
const Grip = styled.div<{ $active: boolean }>`
  ${({ theme, $active }) => css`
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    /* Wide enough to be worth aiming at, sitting over the panel's own border
       so the edge is the target rather than a strip beside it. */
    width: ${theme.sizeUnit * 2}px;
    z-index: 1;
    cursor: col-resize;
    touch-action: none;

    /* Sat at the edge itself rather than a few pixels inside it: what lights
       has to be the line the panel already ends on, or it reads as a second
       rule appearing beside the first. */
    &::after {
      content: '';
      position: absolute;
      top: 0;
      bottom: 0;
      right: 0;
      width: 2px;
      background-color: ${$active ? theme.colorPrimary : 'transparent'};
      transition: background-color ${theme.motionDurationMid};
    }

    &:focus-visible {
      outline: none;
    }
  `}
`;

/**
 * `allowOverflow={false}` asks `Tabs` for a scrolling body — needed so a tall
 * form doesn't bleed past the rail — but its own rule scrolls both axes at
 * once. Properties reuses sections built for a modal (see
 * `DashboardProperties`), where a control can be a little wider than it needs
 * to be with room to spare; in this rail that width is what was tipping the
 * body over into a sideways scrollbar the panel never needed. `&&` doubles
 * the selector so this wins over `Tabs`'s own rule regardless of which one
 * the stylesheet happens to insert second.
 */
const PanelTabs = styled(Tabs)`
  && .ant-tabs-body-holder {
    overflow-x: hidden;
  }
`;

/**
 * The authoring panel: one rail, four ways of working on a dashboard.
 *
 * Placing a widget, editing one and finding one are the same activity at
 * different moments, and an author is only ever doing one of them —
 * Building Blocks, Properties and Outline are that activity's three faces.
 * Browsing data is a different activity: checking what a dataset holds is
 * not a moment of placing, editing or finding a widget, which is why it gets
 * a tab of its own rather than folding into one of the other three. Giving
 * every tab its own permanent rail would still spend the canvas on a choice
 * made moment to moment, so all four share one rail and the canvas keeps
 * the room.
 */
export default function EditorPanel({
  onAdd,
}: {
  onAdd: (type: string) => void;
}): ReactElement {
  useDashboardRevision();
  const [tab, setTab] = useState<PanelTab>('widgets');
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  /** Whether the rail is out of the way. The width it had is kept either way. */
  const [closed, setClosed] = useState(false);
  /** Whether the grip is showing itself — under the pointer, or focused. */
  const [gripped, setGripped] = useState(false);
  const panel = useRef<HTMLElement | null>(null);
  /** Where a drag started, so a slow drag and a fast one land the same place. */
  const from = useRef<{ x: number; width: number } | null>(null);

  /**
   * Selecting something shows it, and that is a response to the selection
   * changing rather than to it existing: an author who goes back to the
   * palette with a widget still selected stays there, because nothing changed.
   *
   * A selection made in the Outline is the exception. Reading a structure
   * means going through it, and a tab that ejected on the first row would
   * hide the very row it had just marked as selected — so the Outline sets
   * the selection without moving anyone, and every other route brings
   * Properties forward.
   */
  const selection = provider.getSelection();
  const [shown, setShown] = useState(selection);
  if (selection !== shown) {
    setShown(selection);
    if (selection !== undefined && tab !== 'outline') {
      setTab('properties');
    }
  }

  /**
   * A name for the list of tabs. antd forwards unknown props to its own root
   * element rather than to the `role="tablist"` it renders inside, so the
   * only place this name can be put is on that element.
   */
  useEffect(() => {
    panel.current
      ?.querySelector('[role="tablist"]')
      ?.setAttribute('aria-label', t('Editor panel views'));
  }, []);

  /**
   * Resizing, by pointer and by key.
   *
   * The pointer is captured on the handle, so a drag faster than the browser
   * can paint does not slip off a small target and strand the panel mid-width.
   * Each move is measured from where the drag began rather than from the last
   * position, so a drag that leaves the window and comes back resumes instead
   * of drifting.
   *
   * The keys are not a convenience: a grip only a mouse can move makes the
   * width of the authoring surface unreachable to anyone driving this from
   * the keyboard, and the width is the whole of what the control does.
   */
  const startDrag = useCallback(
    (event: PointerEvent<HTMLDivElement>): void => {
      from.current = { x: event.clientX, width };
      event.currentTarget.setPointerCapture?.(event.pointerId);
    },
    [width],
  );

  const drag = (event: PointerEvent<HTMLDivElement>): void => {
    if (from.current !== null) {
      setWidth(clampWidth(from.current.width + event.clientX - from.current.x));
    }
  };

  const endDrag = (event: PointerEvent<HTMLDivElement>): void => {
    from.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  const nudge = (event: KeyboardEvent<HTMLDivElement>): void => {
    const moves: Record<string, (current: number) => number> = {
      ArrowRight: current => current + KEYBOARD_STEP,
      ArrowLeft: current => current - KEYBOARD_STEP,
      Home: () => MIN_WIDTH,
      End: () => MAX_WIDTH,
    };
    const move = moves[event.key];
    if (move !== undefined) {
      // Arrow and Home/End would otherwise scroll the panel out from under
      // the author while they are sizing it.
      event.preventDefault();
      setWidth(current => clampWidth(move(current)));
    }
  };

  /**
   * Out of the way, and back.
   *
   * The canvas is the work and this rail is how an author acts on it — but
   * reading a dashboard, or showing one to someone, wants the whole width.
   * Closing keeps `width` untouched rather than zeroing it, so reopening
   * restores the width the author chose instead of silently discarding it.
   *
   * Closed, the panel is a strip carrying one control rather than nothing at
   * all: a rail that vanished with no way back is a rail an author loses.
   * The strip has no edge to drag, because it has no size to choose.
   */
  if (closed) {
    return (
      <ClosedRail data-test="editor-panel" aria-label={t('Editor panel')}>
        <Button
          buttonSize="xsmall"
          buttonStyle="link"
          data-test="panel-expand"
          aria-label={t('Show the editor panel')}
          aria-expanded={false}
          tooltip={t('Show the editor panel')}
          placement="right"
          onClick={() => setClosed(false)}
        >
          <Icons.MenuUnfoldOutlined iconSize="m" />
        </Button>
      </ClosedRail>
    );
  }

  return (
    <Rail
      ref={panel}
      data-test="editor-panel"
      aria-label={t('Editor panel')}
      // The one thing that cannot be a class: it is a value the author sets by
      // dragging, and a class per pixel is a stylesheet per drag.
      style={{ width }}
    >
      <PanelTabs
        activeKey={tab}
        onChange={key => setTab(key as PanelTab)}
        size="small"
        style={{ flex: 1, minHeight: 0 }}
        // Without this, the tab body's own overflow stays `visible` (the
        // component's default) and a tall form or widget list bleeds past the
        // rail's bottom edge instead of scrolling — the rail's `overflow:
        // hidden` then clips it silently rather than offering a scrollbar.
        allowOverflow={false}
        // Riding the tab bar rather than sitting above it: closing the panel
        // is done to the panel, and a row of its own for one icon would cost
        // the height of a row on every screen that never uses it.
        tabBarExtraContent={{
          right: (
            <Button
              buttonSize="xsmall"
              buttonStyle="link"
              data-test="panel-collapse"
              aria-label={t('Hide the editor panel')}
              aria-expanded
              tooltip={t('Hide the editor panel')}
              placement="bottom"
              onClick={() => setClosed(true)}
            >
              <Icons.MenuFoldOutlined iconSize="m" />
            </Button>
          ),
        }}
        items={[
          {
            key: 'data',
            label: t('Data'),
            children: <DataPanel />,
          },
          {
            key: 'widgets',
            label: t('Building Blocks'),
            children: <Palette onAdd={onAdd} />,
          },
          {
            key: 'properties',
            label: t('Properties'),
            children: <Inspector />,
          },
          {
            key: 'outline',
            label: t('Outline'),
            children: <Outline />,
          },
        ]}
      />
      {/* The rule's suggested `hr` is the static kind of separator: it takes
          neither focus nor a value, and both are what make this one a
          splitter an author can reach without a pointer. */}
      <Grip
        // eslint-disable-next-line jsx-a11y/prefer-tag-over-role
        role="separator"
        tabIndex={0}
        data-test="panel-resize"
        aria-orientation="vertical"
        aria-label={t('Resize the editor panel')}
        aria-valuenow={width}
        aria-valuemin={MIN_WIDTH}
        aria-valuemax={MAX_WIDTH}
        $active={gripped}
        onPointerDown={startDrag}
        onPointerMove={drag}
        onPointerUp={endDrag}
        onKeyDown={nudge}
        onPointerEnter={() => setGripped(true)}
        onPointerLeave={() => setGripped(from.current !== null)}
        onFocus={() => setGripped(true)}
        onBlur={() => setGripped(false)}
      />
    </Rail>
  );
}
