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
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'spec/helpers/testing-library';
import { useDroppable } from '@dnd-kit/core';
import { useSortable } from '@dnd-kit/sortable';
import { supersetTheme } from '@apache-superset/core/theme';
import type {
  TreeLevel,
  TreeMirrors,
} from '@superset-ui/plugin-chart-ag-grid-table';
import {
  DroppableData,
  resolveDragEnd,
} from 'src/explore/components/ExploreContainer/ExploreDndContext';
import { DndItemType } from 'src/explore/components/DndItemType';
import type { SortableItemData } from 'src/explore/components/controls/DndColumnSelectControl/dndTestUtils';
import { DndLabelsContainer } from 'src/explore/components/controls/OptionControls';
import LevelsControl, { LevelsControlProps } from '.';

jest.mock('@dnd-kit/core', () => ({
  ...jest.requireActual('@dnd-kit/core'),
  useDroppable: jest.fn(),
}));
jest.mock('@dnd-kit/sortable', () => ({
  ...jest.requireActual('@dnd-kit/sortable'),
  useSortable: jest.fn(),
}));

const droppables = new Map<string, DroppableData>();
const sortables = new Map<string, SortableItemData>();
beforeAll(function preloadDropZoneBaseStyles() {
  render(
    <DndLabelsContainer canDrop={false} isOver={false} isDragging={false} />,
  );
});
beforeEach(() => {
  droppables.clear();
  sortables.clear();
  (useDroppable as jest.Mock).mockImplementation(
    ({ id, data }: { id: string; data: DroppableData }) => {
      droppables.set(id, data);
      return {
        setNodeRef: () => {},
        isOver: false,
        active: null,
        rect: { current: null },
        node: { current: null },
        over: null,
      };
    },
  );
  (useSortable as jest.Mock).mockImplementation(
    ({ id, data }: { id: string; data: SortableItemData }) => {
      sortables.set(id, data);
      return {
        attributes: {},
        listeners: {},
        setNodeRef: () => {},
        transform: null,
        transition: undefined,
        isDragging: false,
        setActivatorNodeRef: () => {},
      };
    },
  );
});

const chip = (field: string, index: number) => {
  const entry = [...sortables].find(
    ([id, data]) => id.includes(`_${field}_`) && data.dragIndex === index,
  );
  return { id: entry![0], data: { current: entry![1] } };
};
const dropColumn = (field: string, columnName: string) =>
  resolveDragEnd(
    {
      id: 'datasource-column',
      data: {
        current: {
          type: DndItemType.Column,
          value: { column_name: columnName },
        },
      },
    },
    {
      id: `dropzone-${field}`,
      data: { current: droppables.get(`dropzone-${field}`) },
    },
  );

const columns = [
  { column_name: 'session_id' },
  { column_name: 'channel' },
  { column_name: 'duration_ms', verbose_name: 'Duration' },
  { column_name: 'session_started_at', is_dttm: true },
  { column_name: 'step_id' },
  { column_name: 'step' },
];

const initialState = {
  explore: {
    datasource: { type: 'table', id: 1, columns },
    form_data: {},
    controls: {},
  },
};

const emptyLevels: TreeLevel[] = [
  { key: 'level-1', name: '', id_column: '', columns: [], detail_fields: [] },
  {
    key: 'level-2',
    name: '',
    id_column: '',
    columns: [],
    detail_fields: [],
    children_shown: 100,
    apply_date_filter: false,
  },
];

const session: TreeLevel = {
  key: 'level-1',
  name: 'Session',
  id_column: 'session_id',
  time_column: 'session_started_at',
  columns: ['channel', 'duration_ms'],
  detail_fields: [],
  sort: ['duration_ms', false],
};

const step: TreeLevel = {
  key: 'level-2',
  name: 'Step',
  name_plural: 'Steps',
  id_column: 'step_id',
  parent_column: 'session_id',
  columns: ['step'],
  detail_fields: [],
  children_shown: 100,
  apply_date_filter: false,
};

const fakeMirrors = (levels: TreeLevel[]): TreeMirrors => ({
  tree_columns: levels.map(level => level.id_column),
  tree_metrics: [],
  tree_orderby: levels.map(level => [level.id_column, true]),
});

test('absent levels seed once; saved levels and an intentionally empty list are preserved', () => {
  const onChange = jest.fn();
  const setControlValue = jest.fn();
  const props: LevelsControlProps = {
    name: 'levels',
    initialLevels: emptyLevels,
    mirrorsOf: fakeMirrors,
    onChange,
    actions: { setControlValue },
  };
  const { rerender, unmount } = render(<LevelsControl {...props} />, {
    useRedux: true,
  });
  expect(onChange).toHaveBeenCalledTimes(1);
  expect(onChange).toHaveBeenCalledWith(emptyLevels);
  expect(setControlValue.mock.calls).toEqual(
    Object.entries(fakeMirrors(emptyLevels)),
  );
  rerender(<LevelsControl {...props} value={emptyLevels} />);
  expect(onChange).toHaveBeenCalledTimes(1);
  unmount();
  onChange.mockClear();
  const saved = render(<LevelsControl {...props} value={[session, step]} />, {
    useRedux: true,
  });
  expect(onChange).not.toHaveBeenCalled();
  saved.unmount();
  render(<LevelsControl {...props} value={[]} />, { useRedux: true });
  expect(onChange).not.toHaveBeenCalled();
});

function setup(props: Partial<LevelsControlProps> = {}) {
  const value = props.value ?? emptyLevels;
  const allProps: LevelsControlProps = {
    name: 'levels',
    label: 'Levels',
    value,
    onChange: jest.fn(),
    actions: { setControlValue: jest.fn() },
    mirrorsOf: fakeMirrors,
    datasourceColumns: columns.map(c => c.column_name),
    columnOptions: columns,
    temporalOptions: columns.filter(c => c.is_dttm),
    formMirrors: fakeMirrors(value ?? []),
    ...props,
  };
  const view = render(<LevelsControl {...allProps} />, {
    useDndKit: true,
    useRedux: true,
    initialState,
  });
  return {
    rerenderLevels: (levels: TreeLevel[]) =>
      view.rerender(<LevelsControl {...allProps} value={levels} />),
    onChange: allProps.onChange as jest.Mock,
    setControlValue: allProps.actions.setControlValue as jest.Mock,
  };
}

const fieldLabels = (key: string) =>
  Array.from(screen.getByTestId(key).querySelectorAll(`[data-test^="${key}_"]`))
    .filter(
      field => !field.matches('.ControlHeader') && field.querySelector('label'),
    )
    .map(field => field.querySelector('label')?.textContent?.trim() ?? '');

const removeButtons = () =>
  screen.getAllByRole('button', { name: /^Remove level/ });

const lastLevels = (onChange: jest.Mock): TreeLevel[] =>
  onChange.mock.calls[onChange.mock.calls.length - 1][0];

test.each(['name', 'id_column'] as const)(
  'the real border reflects required-field validation for %s',
  key => {
    const { rerenderLevels } = setup({ value: [{ ...session, [key]: '' }] });
    const field = screen.getByTestId(`level-1_${key}`);
    const bordered = () =>
      key === 'name'
        ? within(field).getByRole('textbox')
        : within(field).getByTestId('dnd-labels-container');
    const reference = document.createElement('div');
    reference.style.borderColor = supersetTheme.colorError;
    document.body.appendChild(reference);
    const errorColor = getComputedStyle(reference).borderTopColor;
    reference.remove();
    expect(getComputedStyle(bordered()).borderTopColor).toBe(errorColor);
    rerenderLevels([session]);
    expect(getComputedStyle(bordered()).borderTopColor).not.toBe(errorColor);
  },
);

test.each(['Session', ''])(
  'the level header has a keyboard-accessible remove button: %j',
  async name => {
    const { onChange } = setup({ value: [{ ...session, name }] });
    const level = screen.getByTestId('level-1');
    const button = within(level).getByRole('button', {
      name: `Remove level ${name || 'Level 1'}`,
    });
    expect(level.firstElementChild).toContainElement(button);
    await userEvent.hover(button);
    expect(
      await screen.findByRole('tooltip', { name: 'Remove level' }),
    ).toBeInTheDocument();
    button.focus();
    expect(button).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(lastLevels(onChange)).toEqual([]);
  },
);

test('each level field offers a short help tooltip', async () => {
  setup({ value: [session, step] });
  const descriptions = [
    ['level-1_name', 'Name one item at this level.'],
    ['level-1_name_plural', 'Name a group of items at this level.'],
    [
      'level-1_id_column',
      'Choose the column that identifies an item at this level.',
    ],
    [
      'level-2_parent_column',
      "Choose the column at this level that matches the parent level's ID.",
    ],
    [
      'level-1_time_column',
      'Choose the date or time column used to filter this level.',
    ],
    [
      'level-2_time_column',
      'Choose the date or time column that "Apply date filter to children" uses for this level.',
    ],
    ['level-1_columns', "Choose the columns shown in this level's table."],
    [
      'level-1_detail_fields',
      'Choose the fields shown when an item is expanded.',
    ],
    [
      'level-2_children_shown',
      'Choose how many children to load at a time for each parent.',
    ],
    ['level-1_sort', 'Choose the initial row order for this level.'],
    [
      'level-2_apply_date_filter',
      "Apply the level 1 date range to this level's time column.",
    ],
  ];
  for (const [field, description] of descriptions) {
    const icon = within(screen.getByTestId(field)).getByRole('button', {
      name: 'Show info tooltip',
    });
    await userEvent.hover(icon);
    expect(await screen.findByText(description)).toBeInTheDocument();
    await userEvent.unhover(icon);
  }
});

test('two empty levels show level 1 fields 1-4 and 6-9, level 2 fields 1-11', () => {
  setup();
  expect(fieldLabels('level-1')).toEqual([
    'Name',
    'Plural name',
    'ID column',
    'Time column',
    'Columns',
    'Detail fields',
    'Default sort',
  ]);
  expect(fieldLabels('level-2')).toEqual([
    'Name',
    'Plural name',
    'ID column',
    'Linked to parent by',
    'Time column',
    'Columns',
    'Detail fields',
    'Rows shown per parent',
    'Default sort',
    'Apply date filter to children',
  ]);
  expect(screen.getByText('Level 1')).toBeInTheDocument();
  expect(screen.getByText('Level 2')).toBeInTheDocument();
});

test('an empty level shows the ghost buttons of its single selects', () => {
  setup();
  const level1 = screen.getByTestId('level-1');
  expect(within(level1).getByText('Drop a column here or click')).toBeVisible();
  expect(
    within(level1).getByText('Drop a temporal column here or click'),
  ).toBeVisible();
  expect(
    within(level1).queryByText(/might be incompatible/),
  ).not.toBeInTheDocument();
});

test('every control name is unique per level', () => {
  setup();
  [
    'name',
    'name_plural',
    'id_column',
    'time_column',
    'columns',
    'detail_fields',
    'sort',
  ].forEach(field => {
    expect(screen.getByTestId(`level-1_${field}`)).toBeInTheDocument();
    expect(screen.getByTestId(`level-2_${field}`)).toBeInTheDocument();
  });
  expect(screen.getByTestId('level-2_parent_column')).toBeInTheDocument();
});

test('labels use the names as typed', () => {
  setup({ value: [session, step] });
  expect(screen.getByText('1 Session')).toBeInTheDocument();
  expect(screen.getByText('2 Steps')).toBeInTheDocument();
  expect(screen.getByText('Linked to Session by')).toBeInTheDocument();
  expect(screen.getByText('Steps shown per Session')).toBeInTheDocument();
});

test('typing a name calls onChange, then sets the three mirrors', async () => {
  const { onChange, setControlValue } = setup();
  setControlValue.mockClear();
  await userEvent.type(
    within(screen.getByTestId('level-1_name')).getByRole('textbox'),
    'Session',
  );
  await waitFor(() => expect(onChange).toHaveBeenCalled());
  const levels = lastLevels(onChange);
  expect(levels[0].name).toBe('Session');
  expect(levels[1]).toEqual(emptyLevels[1]);
  const mirrors = fakeMirrors(levels);
  expect(setControlValue.mock.calls.slice(-3)).toEqual([
    ['tree_columns', mirrors.tree_columns],
    ['tree_metrics', mirrors.tree_metrics],
    ['tree_orderby', mirrors.tree_orderby],
  ]);
  expect(onChange.mock.invocationCallOrder[0]).toBeLessThan(
    setControlValue.mock.invocationCallOrder[0],
  );
});

test('picking an ID column calls onChange, then sets the three mirrors', async () => {
  const { onChange, setControlValue } = setup();
  setControlValue.mockClear();
  await userEvent.click(
    within(screen.getByTestId('level-1_id_column')).getByText(
      'Drop a column here or click',
    ),
  );
  await userEvent.click(
    await screen.findByRole('combobox', { name: /Columns and metrics/i }),
  );
  await userEvent.click(
    await screen.findByRole('option', { name: 'session_id' }),
  );
  const save = await screen.findByTestId('ColumnEdit#save');
  await waitFor(() => expect(save).toBeEnabled());
  await userEvent.click(save);
  await waitFor(() => expect(onChange).toHaveBeenCalled());
  const levels = lastLevels(onChange);
  expect(levels[0].id_column).toBe('session_id');
  const mirrors = fakeMirrors(levels);
  expect(setControlValue.mock.calls).toEqual([
    ['tree_columns', mirrors.tree_columns],
    ['tree_metrics', mirrors.tree_metrics],
    ['tree_orderby', mirrors.tree_orderby],
  ]);
});

test('Add level appends a child level with its defaults', async () => {
  const { onChange } = setup({ value: [session, step] });
  await userEvent.click(screen.getByRole('button', { name: 'Add level' }));
  const levels = lastLevels(onChange);
  expect(levels).toHaveLength(3);
  expect(levels[2]).toEqual({
    key: expect.any(String),
    name: '',
    id_column: '',
    columns: [],
    detail_fields: [],
    children_shown: 100,
    apply_date_filter: false,
  });
  expect(levels[2].key).not.toBe(levels[1].key);
});

test('a chart with no levels asks for one; Add level gives a level 1 without child fields', async () => {
  const { onChange, setControlValue } = setup({ value: [] });
  expect(screen.queryByTestId('level-1')).not.toBeInTheDocument();
  expect(setControlValue).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Add level' }));
  expect(lastLevels(onChange)).toEqual([
    {
      key: expect.any(String),
      name: '',
      id_column: '',
      columns: [],
      detail_fields: [],
    },
  ]);
});

test.each([
  ['0', 1],
  ['-5', 1],
  ['1001', 1000],
  ['', 100],
  ['-', 100],
  ['.', 100],
  ['25', 25],
  ['5.5', 6],
])(
  'the child batch input commits %s as %s on blur',
  async (typed, expected) => {
    const { onChange } = setup({ value: [session, step] });
    const input = screen.getByRole('spinbutton', {
      name: 'Steps shown per Session',
    });
    await userEvent.clear(input);
    if (typed) await userEvent.type(input, typed);
    await userEvent.tab();
    expect(lastLevels(onChange)[1].children_shown).toBe(expected);
    expect(input).toHaveValue(String(expected));
  },
);

test('removing level 1 drops the child-only fields of the new level 1', async () => {
  const { onChange } = setup({ value: [session, step] });
  await userEvent.click(removeButtons()[0]);
  expect(lastLevels(onChange)).toEqual([
    {
      key: 'level-2',
      name: 'Step',
      name_plural: 'Steps',
      id_column: 'step_id',
      columns: ['step'],
      detail_fields: [],
    },
  ]);
});

test.each(['', '   '])(
  'an empty Name is highlighted and clears its error when filled: %j',
  name => {
    const { rerenderLevels } = setup({ value: [{ ...session, name }] });
    const field = screen.getByTestId('level-1_name');
    expect(field).toHaveAttribute('data-invalid', 'true');
    expect(field).not.toHaveAttribute('aria-invalid');
    expect(within(field).getByTestId('error-tooltip')).toBeInTheDocument();
    rerenderLevels([session]);
    expect(screen.getByTestId('level-1_name')).not.toHaveAttribute(
      'data-invalid',
    );
    expect(
      within(screen.getByTestId('level-1_name')).queryByTestId('error-tooltip'),
    ).toBeNull();
  },
);

test('a self-link highlights its Linked to field and clears its error after correction', () => {
  const { rerenderLevels } = setup({
    value: [session, { ...step, parent_column: step.id_column }],
  });
  const field = screen.getByTestId('level-2_parent_column');
  expect(field).toHaveAttribute('data-invalid', 'true');
  expect(field).not.toHaveAttribute('aria-invalid');
  expect(within(field).getByTestId('error-tooltip')).toBeInTheDocument();
  rerenderLevels([session, step]);
  expect(screen.getByTestId('level-2_parent_column')).not.toHaveAttribute(
    'data-invalid',
  );
  expect(
    within(screen.getByTestId('level-2_parent_column')).queryByTestId(
      'error-tooltip',
    ),
  ).toBeNull();
});

test('removing a middle level clears Linked to on the level that moves up', async () => {
  const third: TreeLevel = {
    ...step,
    key: 'level-3',
    name: 'Action',
    id_column: 'action_id',
    parent_column: 'step_id',
  };
  const { onChange, rerenderLevels } = setup({ value: [session, step, third] });
  await userEvent.click(removeButtons()[1]);
  const levels = lastLevels(onChange);
  expect(levels.map(level => level.key)).toEqual(['level-1', 'level-3']);
  expect(levels[1]).not.toHaveProperty('parent_column');
  expect(levels[1].children_shown).toBe(100);
  rerenderLevels(levels);
  const field = screen.getByTestId('level-3_parent_column');
  expect(within(field).getByText('Linked to Session by')).toBeInTheDocument();
  expect(field).toHaveAttribute('data-invalid', 'true');
  expect(field).not.toHaveAttribute('aria-invalid');
  expect(within(field).getByTestId('error-tooltip')).toBeInTheDocument();
  expect(screen.getByTestId('level-3_id_column')).not.toHaveAttribute(
    'data-invalid',
  );
});

test('removing the last level left gives an empty list', async () => {
  const { onChange } = setup({ value: [session] });
  expect(removeButtons()).toHaveLength(1);
  await userEvent.click(removeButtons()[0]);
  expect(lastLevels(onChange)).toEqual([]);
});

test('mount with stale mirrors sets them once', () => {
  const { setControlValue } = setup({
    value: [session, step],
    formMirrors: {},
  });
  const mirrors = fakeMirrors([session, step]);
  expect(setControlValue.mock.calls).toEqual([
    ['tree_columns', mirrors.tree_columns],
    ['tree_metrics', mirrors.tree_metrics],
    ['tree_orderby', mirrors.tree_orderby],
  ]);
});

test('mount with matching mirrors sets nothing', () => {
  const mirrors = fakeMirrors([session, step]);
  const { setControlValue } = setup({
    value: [session, step],
    formMirrors: {
      tree_orderby: mirrors.tree_orderby,
      tree_metrics: mirrors.tree_metrics,
      tree_columns: mirrors.tree_columns,
    },
  });
  expect(setControlValue).not.toHaveBeenCalled();
});

test('the default sort shows its JSON choice and stores a pair', async () => {
  const { onChange } = setup({ value: [session, step] });
  const sort = screen.getByTestId('level-1_sort');
  expect(within(sort).getByText('Duration · descending')).toBeInTheDocument();
  await userEvent.click(within(sort).getByRole('combobox'));
  expect(
    await screen.findByRole('option', { name: 'session_id · descending' }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('option', { name: 'channel · ascending' }),
  ).toBeInTheDocument();
  await userEvent.click(
    screen.getByRole('option', { name: 'session_id · ascending' }),
  );
  await waitFor(() =>
    expect(lastLevels(onChange)[0].sort).toEqual(['session_id', true]),
  );
});

test('with no sort the placeholder shows the ID column ascending', () => {
  setup({ value: [{ ...session, sort: undefined }, step] });
  expect(
    within(screen.getByTestId('level-1_sort')).getByText(
      'session_id · ascending',
    ),
  ).toBeInTheDocument();
});

test('clearing the default sort drops the sort key', async () => {
  const { onChange } = setup({ value: [session, step] });
  await userEvent.click(
    within(screen.getByTestId('level-1_sort')).getByLabelText('close-circle'),
  );
  await waitFor(() => expect(onChange).toHaveBeenCalled());
  expect(lastLevels(onChange)[0]).not.toHaveProperty('sort');
});

test('removing the sort column from Columns clears the sort', async () => {
  const { onChange } = setup({ value: [session, step] });
  const columnsField = screen.getByTestId('level-1_columns');
  const durationChip = within(columnsField).getByText('Duration');
  const option = durationChip.closest('[data-test="option-label"]')
    ?.parentElement as HTMLElement;
  await userEvent.click(within(option).getByTestId('remove-control-button'));
  await waitFor(() => expect(onChange).toHaveBeenCalled());
  const levels = lastLevels(onChange);
  expect(levels[0].columns).toEqual(['channel']);
  expect(levels[0]).not.toHaveProperty('sort');
});

test('ticking Apply date filter stores it on the child level', async () => {
  const { onChange } = setup({ value: [session, step] });
  await userEvent.click(
    within(screen.getByTestId('level-2_apply_date_filter')).getByRole(
      'checkbox',
    ),
  );
  expect(lastLevels(onChange)[1].apply_date_filter).toBe(true);
});

test('dragging a Columns chip reorders that level only, then sets the mirrors', () => {
  const { onChange, setControlValue } = setup({ value: [session, step] });
  setControlValue.mockClear();
  resolveDragEnd(chip('level-1_columns', 0), chip('level-1_columns', 1));
  const levels = lastLevels(onChange);
  expect(levels[0].columns).toEqual(['duration_ms', 'channel']);
  expect(levels[1]).toEqual(step);
  const mirrors = fakeMirrors(levels);
  expect(setControlValue.mock.calls).toEqual([
    ['tree_columns', mirrors.tree_columns],
    ['tree_metrics', mirrors.tree_metrics],
    ['tree_orderby', mirrors.tree_orderby],
  ]);
});

test('a chip dragged onto a chip of another level changes nothing', () => {
  const twoColumns = { ...step, columns: ['step', 'channel'] };
  const { onChange } = setup({ value: [session, twoColumns] });
  expect(chip('level-1_columns', 0).data.current.type).not.toBe(
    chip('level-2_columns', 1).data.current.type,
  );
  resolveDragEnd(chip('level-1_columns', 0), chip('level-2_columns', 1));
  expect(onChange).not.toHaveBeenCalled();
});

test('a column already in Columns is not dropped twice; a new one is added', () => {
  const { onChange } = setup({ value: [session, step] });
  dropColumn('level-1_columns', 'channel');
  expect(onChange).not.toHaveBeenCalled();
  dropColumn('level-1_columns', 'step');
  expect(lastLevels(onChange)[0].columns).toEqual([
    'channel',
    'duration_ms',
    'step',
  ]);
});
