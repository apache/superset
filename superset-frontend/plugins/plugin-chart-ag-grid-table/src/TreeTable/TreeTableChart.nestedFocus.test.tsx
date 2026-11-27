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
import {
  Harness,
  SEGMENTS,
  collapseFromMainButton,
  failNextDeepLevel,
  deepKeyboardChart,
  depthOf,
  describeDeep,
  focusToggleCell,
  focusedStop,
  fourLevelProps,
  gridsAtDepth,
  keyboardLevels,
  parentCell,
  pressTab,
  queueRows,
  routeDeep,
  tick,
  toggleOf,
  trackLoadMoreScroll,
  userEvent,
} from '../../test/treeTableChartTestUtils';
import {
  render,
  screen,
  waitFor,
  fireEvent,
  within,
} from '@superset-ui/core/spec';
import { GenericDataType } from '@apache-superset/core/common';
import TreeTableChart from './TreeTableChart';

/** Keyboard focus is on the +/- button of a row, inside its +/- cell. */
const expectToggleFocus = () => {
  expect(document.activeElement?.tagName).toBe('BUTTON');
  expect(focusedStop()).toHaveAttribute('col-id', 'tree_table_expand');
};

/** Q2 -> P also has two interactions, so both P rows show Load more. */
const SEGMENTS_TWO_P = [
  ...SEGMENTS,
  {
    queue: 'Q2',
    agent: 'P',
    interaction_id: 'i5',
    channel: 'i5 voice',
    source_phone: 'i5 phone',
    segment_id: 'i5-s0',
    segment_no: 'i5 no 0',
    disposition: 'done',
  },
];

async function walkDeep(steps: number, shift = false) {
  const log: string[] = [];
  for (let i = 0; i < steps; i += 1) {
    await pressTab(shift);
    log.push(describeDeep());
  }
  return log;
}

async function openS4ThreeDeep() {
  await userEvent.click(toggleOf('Q1'));
  await screen.findByText('2 Agents');
  await userEvent.click(toggleOf('P'));
  await screen.findByText('1 of 2 Interactions');
  await userEvent.click(toggleOf('i1 voice'));
  await screen.findByText('1 of 2 Segments');
  await userEvent.click(toggleOf('i1 no 0'));
  await screen.findByRole('group', { name: 'Segment details', hidden: true });
  await tick();
}

test('keyboard, four levels: Tab enters and leaves every nested grid (headers, cells, a detail-only last level, Load more) and Shift+Tab goes back the same way', async () => {
  routeDeep();
  const { container } = render(deepKeyboardChart());
  await openS4ThreeDeep();
  screen.getByRole('button', { name: 'Before' }).focus();
  const forward = await walkDeep(24);
  expect(forward).toEqual([
    '0 button Expand all',
    '0 button Expand all to level',
    '0 columnheader ',
    '0 columnheader Queue   1',
    '0 gridcell ',
    '0 gridcell Q1',
    '1 columnheader ',
    '1 columnheader agent   1',
    '1 gridcell ',
    '1 gridcell L',
    '1 gridcell ',
    '1 gridcell P',
    '2 columnheader ',
    '2 columnheader channel',
    '2 gridcell ',
    '2 gridcell i1 voice',
    '3 columnheader ',
    '3 columnheader segment_no',
    '3 gridcell ',
    '3 gridcell i1 no 0',
    '3 button Load more',
    '2 button Load more',
    '0 gridcell ',
    '0 gridcell Q2',
  ]);
  expect(await walkDeep(2)).toEqual(['0 combobox Page Size:', '0 li 1']);
  parentCell(container, 'row-1', 'queue').focus();
  const back = await walkDeep(24, true);
  expect(back).toEqual(
    [...forward].reverse().slice(1).concat('0 button Before'),
  );
  expect([...forward, ...back]).not.toContain('BODY');
});

const focusedGrid = () =>
  document.activeElement?.closest('[data-themed-ag-grid]');

const agentToggle = (container: HTMLElement, queueIndex: number) =>
  within(gridsAtDepth(container, 1)[queueIndex] as HTMLElement)
    .getByText('P')
    .closest('[role="row"]')!
    .querySelector<HTMLElement>('[col-id="tree_table_expand"] button')!;

/** Load more buttons of the tables at `depth` (in the areas at that depth). */
const loadMoresAt = (depth: number) =>
  screen
    .getAllByRole('button', { name: 'Load more' })
    .filter(button => depthOf(button) === depth);

async function openBothP(container: HTMLElement) {
  await userEvent.click(toggleOf('Q1'));
  await screen.findByText('2 Agents');
  await userEvent.click(toggleOf('Q2'));
  await waitFor(() => expect(gridsAtDepth(container, 1)).toHaveLength(2));
  await userEvent.click(agentToggle(container, 0));
  await screen.findByText('i1 voice');
  await userEvent.click(agentToggle(container, 1));
  await screen.findByText('i3 voice');
  await tick();
}

test('keyboard: level 3 final Load more focuses the appended row on its own path without scrolling', async () => {
  routeDeep(SEGMENTS_TWO_P);
  const { container } = render(deepKeyboardChart());
  await openBothP(container);
  const loadMores = loadMoresAt(2);
  expect(loadMores).toHaveLength(2);
  const checkScroll = trackLoadMoreScroll(container);
  await userEvent.click(loadMores[1]);
  await screen.findByText('i5 voice');
  await tick();
  checkScroll();
  await waitFor(() =>
    expect(document.activeElement?.closest('[row-id]')).toHaveTextContent(
      'i5 voice',
    ),
  );
  expect(document.activeElement).toHaveClass('ag-cell-focus');
});

test('keyboard, same agent under two queues: Retry in one P area hands focus to that P +/-, not to P under the other queue', async () => {
  routeDeep(SEGMENTS_TWO_P);
  const { container } = render(deepKeyboardChart());
  await userEvent.click(toggleOf('Q1'));
  await screen.findByText('2 Agents');
  await userEvent.click(toggleOf('Q2'));
  await waitFor(() => expect(gridsAtDepth(container, 1)).toHaveLength(2));
  failNextDeepLevel(2);
  await userEvent.click(agentToggle(container, 1));
  await screen.findByText("Couldn't load Interactions —");
  await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
  await screen.findByText('i3 voice');
  await waitFor(() =>
    expect(focusedGrid()).toBe(gridsAtDepth(container, 1)[1]),
  );
  expectToggleFocus();
  expect(
    document.activeElement?.closest('[role="row"]')?.textContent,
  ).toContain('P');
});

test('keyboard: a focused deep row removed by a refresh hands focus to the nearest +/- on its path', async () => {
  routeDeep();
  const value = fourLevelProps({ levels: keyboardLevels });
  const { container, rerender } = render(
    <Harness value={value} onMask={jest.fn()} />,
  );
  await userEvent.click(toggleOf('Q1'));
  await screen.findByText('2 Agents');
  await userEvent.click(toggleOf('P'));
  await screen.findByText('1 of 2 Interactions');
  await userEvent.click(screen.getByRole('button', { name: 'Load more' }));
  await screen.findByText('i2 voice');
  const cell = screen
    .getByText('i2 voice')
    .closest<HTMLElement>('[role="gridcell"]')!;
  await userEvent.click(cell);
  expect(describeDeep()).toBe('2 gridcell i2 voice');
  rerender(
    <Harness value={{ ...value, data: [...queueRows] }} onMask={jest.fn()} />,
  );
  await waitFor(() => expect(screen.queryByText('i2 voice')).toBeNull());
  await waitFor(() =>
    expect(focusedGrid()).toBe(gridsAtDepth(container, 1)[0]),
  );
  expectToggleFocus();
  expect(
    document.activeElement?.closest('[role="row"]')?.textContent,
  ).toContain('P');
});

test('keyboard: a focused deep row removed by a re-sort in another table of its level hands focus to the nearest +/- on its path', async () => {
  routeDeep(SEGMENTS_TWO_P);
  const { container } = render(deepKeyboardChart());
  await openBothP(container);
  await userEvent.click(loadMoresAt(2)[0]);
  await screen.findByText('i2 voice');
  await userEvent.click(
    screen.getByText('i2 voice').closest<HTMLElement>('[role="gridcell"]')!,
  );
  expect(describeDeep()).toBe('2 gridcell i2 voice');
  const otherHeader = gridsAtDepth(container, 2)[1].querySelector<HTMLElement>(
    '[col-id="channel"] .ag-header-cell-label',
  )!;
  fireEvent.click(otherHeader);
  await waitFor(() => expect(screen.queryByText('i2 voice')).toBeNull());
  await waitFor(() =>
    expect(focusedGrid()).toBe(gridsAtDepth(container, 1)[0]),
  );
  expectToggleFocus();
});

test('keyboard: Collapse all keeps focus on itself when it removes a focused deep row', async () => {
  routeDeep();
  render(deepKeyboardChart());
  await openS4ThreeDeep();
  await userEvent.click(
    screen.getByText('i1 no 0').closest<HTMLElement>('[role="gridcell"]')!,
  );
  const collapseAll = await collapseFromMainButton();
  await waitFor(() => expect(screen.queryByText('2 Agents')).toBeNull());
  await tick();
  expect(document.activeElement).toBe(collapseAll);
});

test('rows from Load more inherit Expand all at depth: they open, carry the Collapse label and route Tab into their area', async () => {
  routeDeep(
    SEGMENTS_TWO_P.filter(row => row.queue === 'Q1' && row.agent === 'P'),
  );
  const { container } = render(
    deepKeyboardChart({ data: [{ queue: 'Q1' }], rowcount: 1 }),
  );
  await userEvent.click(
    await screen.findByRole('button', { name: 'Expand all to level' }),
  );
  await userEvent.click(
    await screen.findByRole('menuitem', { name: 'Expand to Interactions' }),
  );
  await waitFor(() =>
    expect(
      screen.getAllByRole('group', {
        name: 'Interaction details',
        hidden: true,
      }),
    ).toHaveLength(1),
  );
  await userEvent.click(loadMoresAt(2)[0]);
  await waitFor(() =>
    expect(
      screen.getAllByRole('group', {
        name: 'Interaction details',
        hidden: true,
      }),
    ).toHaveLength(2),
  );
  const row = screen
    .getByText('i2 voice')
    .closest<HTMLElement>('[role="row"]')!;
  const toggle = row.querySelector('[col-id="tree_table_expand"] button')!;
  expect(toggle).toHaveAttribute('aria-label', 'Collapse i2');
  expect(toggle).toHaveAttribute('aria-expanded', 'true');
  row.querySelector<HTMLElement>('[col-id="channel"]')!.focus();
  expect(await walkDeep(1)).toEqual(['3 columnheader ']);
  expect(gridsAtDepth(container, 3).length).toBeGreaterThan(0);
});

test('wide Load more rows inherit Expand all across duplicate parent paths and route Tab into their area', async () => {
  routeDeep(SEGMENTS_TWO_P);
  const { container } = render(deepKeyboardChart());
  await userEvent.click(
    await screen.findByRole('button', { name: 'Expand all to level' }),
  );
  await userEvent.click(
    await screen.findByRole('menuitem', { name: 'Expand to Interactions' }),
  );
  await waitFor(() =>
    expect(
      screen.getAllByRole('group', {
        name: 'Interaction details',
        hidden: true,
      }),
    ).toHaveLength(3),
  );
  await userEvent.click(loadMoresAt(2)[0]);
  await waitFor(() =>
    expect(
      screen.getAllByRole('group', {
        name: 'Interaction details',
        hidden: true,
      }),
    ).toHaveLength(4),
  );
  const row = screen
    .getByText('i2 voice')
    .closest<HTMLElement>('[role="row"]')!;
  const toggle = row.querySelector('[col-id="tree_table_expand"] button')!;
  expect(toggle).toHaveAttribute('aria-label', 'Collapse i2');
  expect(toggle).toHaveAttribute('aria-expanded', 'true');
  row.querySelector<HTMLElement>('[col-id="channel"]')!.focus();
  expect(await walkDeep(1)).toEqual(['3 columnheader ']);
  expect(gridsAtDepth(container, 3).length).toBeGreaterThan(0);
});

test('a deep detail block reads each label, then its value, in field order', async () => {
  routeDeep();
  render(deepKeyboardChart());
  await openS4ThreeDeep();
  const block = screen.getByRole('group', {
    name: 'Segment details',
    hidden: true,
  });
  expect(block.textContent).toBe('dispositiondone');
});

// Three levels: Channel -> Session -> Step.
const S3_TABLE: Record<string, unknown>[] = [
  ['Voice', 'b', 2],
  ['Voice', 'a', 0],
  ['Chat', 'c', 1],
].flatMap(([channel, session, steps]) =>
  (steps
    ? Array.from({ length: steps as number }, (_, index) => index)
    : [null]
  ).map(index => ({
    channel,
    session_id: session,
    duration_ms: `${session} duration`,
    channel_key: `${session} key`,
    step_id: index === null ? null : `${session}-${index}`,
    item_desc: index === null ? null : `${session} step ${index}`,
    result: 'ok',
  })),
);

const S3_LEVELS = [
  {
    key: 'channel',
    name: 'Channel',
    name_plural: 'Channels',
    id_column: 'channel',
    columns: ['channel'],
    detail_fields: [],
  },
  {
    key: 'session',
    name: 'Session',
    name_plural: 'Sessions',
    id_column: 'session_id',
    parent_column: 'channel',
    columns: ['duration_ms'],
    detail_fields: ['channel_key'],
  },
  {
    key: 'step',
    name: 'Step',
    name_plural: 'Steps',
    id_column: 'step_id',
    parent_column: 'session_id',
    columns: ['item_desc'],
    detail_fields: ['result'],
    children_shown: 1,
  },
];

test('keyboard, three levels: Tab goes through the Sessions and Steps grids, a Session Data block, a Step Detail and Load more, and Shift+Tab goes back the same way', async () => {
  routeDeep(S3_TABLE);
  const { container } = render(
    <>
      <button type="button">Before</button>
      <TreeTableChart
        {...fourLevelProps({
          levels: S3_LEVELS,
          data: [{ channel: 'Voice' }, { channel: 'Chat' }],
          columns: [
            {
              key: 'channel',
              label: 'Channel',
              dataType: GenericDataType.String,
            },
          ],
          colnames: ['channel'],
        })}
      />
      <button type="button">After</button>
    </>,
  );
  await userEvent.click(toggleOf('Voice'));
  await screen.findByText('2 Sessions');
  await userEvent.click(toggleOf('b duration'));
  await screen.findByText('1 of 2 Steps');
  await userEvent.click(toggleOf('b step 0'));
  await screen.findByRole('group', { name: 'Step details', hidden: true });
  await userEvent.click(toggleOf('a duration'));
  await screen.findByText('No Steps');
  await tick();
  screen.getByRole('button', { name: 'Before' }).focus();
  const forward = await walkDeep(19);
  expect(forward).toEqual([
    '0 button Expand all',
    '0 button Expand all to level',
    '0 columnheader ',
    '0 columnheader Channel   1',
    '0 gridcell ',
    '0 gridcell Voice',
    '1 columnheader ',
    '1 columnheader duration_ms',
    '1 gridcell ',
    '1 gridcell a duration',
    '1 gridcell ',
    '1 gridcell b duration',
    '2 columnheader ',
    '2 columnheader item_desc',
    '2 gridcell ',
    '2 gridcell b step 0',
    '2 button Load more',
    '0 gridcell ',
    '0 gridcell Chat',
  ]);
  parentCell(container, 'row-1', 'channel').focus();
  const back = await walkDeep(19, true);
  expect(back).toEqual(
    [...forward].reverse().slice(1).concat('0 button Before'),
  );
  expect([...forward, ...back]).not.toContain('BODY');
});

test('keyboard: when the grid moves focus to a neighbour row because the focused deep row left, focus goes to the nearest +/- on its path', async () => {
  routeDeep();
  const value = fourLevelProps({ levels: keyboardLevels });
  const { container, rerender } = render(
    <Harness value={value} onMask={jest.fn()} />,
  );
  await userEvent.click(toggleOf('Q1'));
  await screen.findByText('2 Agents');
  await userEvent.click(toggleOf('P'));
  await screen.findByText('1 of 2 Interactions');
  await userEvent.click(screen.getByRole('button', { name: 'Load more' }));
  await screen.findByText('i2 voice');
  await userEvent.click(
    screen.getByText('i2 voice').closest<HTMLElement>('[role="gridcell"]')!,
  );
  expect(describeDeep()).toBe('2 gridcell i2 voice');
  await tick();
  await tick();
  await tick();
  await tick();
  const neighbour = screen
    .getByText('i1 voice')
    .closest<HTMLElement>('[role="gridcell"]')!;
  const neighbourFocused = jest.fn();
  neighbour.addEventListener('focus', neighbourFocused);
  rerender(
    <Harness value={{ ...value, data: [...queueRows] }} onMask={jest.fn()} />,
  );
  await waitFor(() => expect(screen.queryByText('i2 voice')).toBeNull());
  await waitFor(() =>
    expect(focusedGrid()).toBe(gridsAtDepth(container, 1)[0]),
  );
  expectToggleFocus();
  expect(neighbourFocused).toHaveBeenCalled();
});

test('a deep row replaced at the focused row ID by a refresh hands focus to the nearest surviving +/- on its path', async () => {
  const table = SEGMENTS.map(row => ({ ...row }));
  routeDeep(table);
  const value = fourLevelProps({ levels: keyboardLevels });
  const { container, rerender } = render(
    <Harness value={value} onMask={jest.fn()} />,
  );
  await userEvent.click(toggleOf('Q1'));
  await screen.findByText('2 Agents');
  await userEvent.click(toggleOf('P'));
  await screen.findByText('1 of 2 Interactions');
  const cell = screen
    .getByText('i1 voice')
    .closest<HTMLElement>('[role="gridcell"]')!;
  await userEvent.click(cell);
  expect(describeDeep()).toBe('2 gridcell i1 voice');
  await tick();
  table.forEach(row => {
    if (row.queue !== 'Q1' || row.agent !== 'P') return;
    const replaced = row.interaction_id === 'i1' ? 'i8' : 'i9';
    Object.assign(row, {
      interaction_id: replaced,
      channel: `${replaced} voice`,
      source_phone: `${replaced} phone`,
    });
  });
  rerender(
    <Harness value={{ ...value, data: [...queueRows] }} onMask={jest.fn()} />,
  );
  await screen.findByText('i8 voice');
  expect(screen.queryByText('i1 voice')).toBeNull();
  await waitFor(() =>
    expect(focusedGrid()).toBe(gridsAtDepth(container, 1)[0]),
  );
  expectToggleFocus();
  expect(
    document.activeElement?.closest('[role="row"]')?.textContent,
  ).toContain('P');
});

test('at levels 1, 2 and 3 a focused +/- cell hands focus to its button; Enter flips Expand / Collapse and aria-expanded once; a held Enter or Space toggles once', async () => {
  routeDeep();
  render(<TreeTableChart {...fourLevelProps()} />);
  await screen.findByText('Q1');
  const levels: [string, RegExp][] = [
    ['Q1', /^2 Agents$/],
    ['P', /^2 Interactions$/],
    ['i1 voice', /Segments$/],
  ];
  for (const [text, loadedText] of levels) {
    const button = toggleOf(text);
    await focusToggleCell(button);
    expect(document.activeElement).toBe(button);
    expect(button).toHaveAccessibleName(/^Expand (?!all\b)/);
    expect(button).toHaveAttribute('aria-expanded', 'false');
    await userEvent.keyboard('{Enter}');
    await waitFor(() =>
      expect(button).toHaveAttribute('aria-expanded', 'true'),
    );
    expect(button).toHaveAccessibleName(/^Collapse (?!all$)/);
    expect(document.activeElement).toBe(button);
    await screen.findAllByText(loadedText);
    await userEvent.keyboard('{Enter>6/}');
    await waitFor(() =>
      expect(button).toHaveAttribute('aria-expanded', 'false'),
    );
    await tick();
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(document.activeElement).toBe(button);
    await userEvent.keyboard('{ >6/}');
    await waitFor(() =>
      expect(button).toHaveAttribute('aria-expanded', 'true'),
    );
    await tick();
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(document.activeElement).toBe(button);
    await screen.findAllByText(loadedText);
  }
});
