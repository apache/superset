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
import { useTheme } from '@apache-superset/core/theme';
import { Button, Tabs } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import { provider, useDashboardRevision } from 'src/core/dashboard/store';
import Inspector from './Inspector';
import Outline from './Outline';
import Palette from './Palette';

type PanelTab = 'blocks' | 'properties' | 'outline';

/**
 * How wide the panel opens, and how far it may be dragged.
 *
 * The default is set by the Properties tab, which holds a block's whole set
 * of fields and is the widest thing here; the palette and the outline are
 * narrow whatever they are given. The ceiling leaves a usable canvas on a
 * small screen.
 */
const DEFAULT_WIDTH = 500;
const MIN_WIDTH = 280;
const MAX_WIDTH = 800;
/** How far one arrow press moves the edge. */
const KEYBOARD_STEP = 16;

const clampWidth = (width: number): number =>
  Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, width));

/**
 * The authoring panel: one rail, three ways of working on a dashboard.
 *
 * Placing a block, editing one and finding one are the same activity at
 * different moments, and an author is only ever doing one of them. Giving
 * each its own permanent rail would spend the canvas on a choice made moment
 * to moment, so they share a rail and the canvas keeps the room.
 */
export default function EditorPanel({
  onAdd,
}: {
  onAdd: (type: string) => void;
}): ReactElement {
  useDashboardRevision();
  const theme = useTheme();
  const [tab, setTab] = useState<PanelTab>('blocks');
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
   * palette with a block still selected stays there, because nothing changed.
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
    if (selection !== undefined && tab === 'blocks') {
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
      <aside
        data-test="editor-panel"
        aria-label={t('Editor panel')}
        style={{
          flexShrink: 0,
          display: 'flex',
          justifyContent: 'center',
          padding: theme.sizeUnit,
          borderRight: `1px solid ${theme.colorBorder}`,
          background: theme.colorBgContainer,
        }}
      >
        <Button
          size="small"
          buttonStyle="link"
          data-test="panel-expand"
          aria-label={t('Show the editor panel')}
          aria-expanded={false}
          tooltip={t('Show the editor panel')}
          placement="right"
          onClick={() => setClosed(false)}
          style={{
            height: theme.controlHeightSM,
            paddingInline: theme.sizeUnit,
          }}
        >
          <Icons.MenuUnfoldOutlined iconSize="m" />
        </Button>
      </aside>
    );
  }

  return (
    <aside
      ref={panel}
      data-test="editor-panel"
      aria-label={t('Editor panel')}
      style={{
        width,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        // The panel is a fixed-height column and the scrolling happens inside
        // the tab body, so the tab bar stays put however long a form gets.
        overflow: 'hidden',
        padding: theme.sizeUnit * 2,
        borderRight: `1px solid ${theme.colorBorder}`,
        background: theme.colorBgContainer,
      }}
    >
      <Tabs
        activeKey={tab}
        onChange={key => setTab(key as PanelTab)}
        size="small"
        style={{ flex: 1, minHeight: 0 }}
        // Riding the tab bar rather than sitting above it: closing the panel
        // is done to the panel, and a row of its own for one icon would cost
        // the height of a row on every screen that never uses it.
        tabBarExtraContent={{
          right: (
            <Button
              size="small"
              buttonStyle="link"
              data-test="panel-collapse"
              aria-label={t('Hide the editor panel')}
              aria-expanded
              tooltip={t('Hide the editor panel')}
              placement="bottom"
              onClick={() => setClosed(true)}
              style={{
                height: theme.controlHeightSM,
                paddingInline: theme.sizeUnit,
              }}
            >
              <Icons.MenuFoldOutlined iconSize="m" />
            </Button>
          ),
        }}
        items={[
          {
            key: 'blocks',
            label: t('Building blocks'),
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
      <div
        // eslint-disable-next-line jsx-a11y/prefer-tag-over-role
        role="separator"
        tabIndex={0}
        data-test="panel-resize"
        aria-orientation="vertical"
        aria-label={t('Resize the editor panel')}
        aria-valuenow={width}
        aria-valuemin={MIN_WIDTH}
        aria-valuemax={MAX_WIDTH}
        onPointerDown={startDrag}
        onPointerMove={drag}
        onPointerUp={endDrag}
        onKeyDown={nudge}
        onPointerEnter={() => setGripped(true)}
        onPointerLeave={() => setGripped(from.current !== null)}
        onFocus={() => setGripped(true)}
        onBlur={() => setGripped(false)}
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          // Wide enough to be worth aiming at, sitting over the panel's own
          // border so the edge is the target rather than a strip beside it.
          width: theme.sizeUnit * 2,
          zIndex: 1,
          cursor: 'col-resize',
          // The cursor alone only answers an author who already suspected the
          // edge could move. Colouring it under the pointer — and on focus,
          // where there is no cursor to read — is what says so first.
          background: gripped ? theme.colorPrimaryBorder : 'transparent',
          transition: `background ${theme.motionDurationMid}`,
          touchAction: 'none',
        }}
      />
    </aside>
  );
}
