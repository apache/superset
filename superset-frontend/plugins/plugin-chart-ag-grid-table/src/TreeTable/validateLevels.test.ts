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
import { ControlState } from '@superset-ui/chart-controls';
import { TreeLevel } from './types';
import { validateLevelColumns, validateLevels } from './validateLevels';

const emptyParent: TreeLevel = {
  key: 'level-1',
  name: '',
  id_column: '',
  columns: [],
  detail_fields: [],
};

const emptyChild: TreeLevel = {
  ...emptyParent,
  key: 'level-2',
  children_shown: 100,
  apply_date_filter: false,
};

const session: TreeLevel = {
  key: 'level-1',
  name: 'Session',
  id_column: 'session_id',
  time_column: 'session_started_at',
  columns: ['channel'],
  detail_fields: ['inbound_number'],
};

const step: TreeLevel = {
  key: 'level-2',
  name: 'Step',
  id_column: 'step_id',
  parent_column: 'session_id',
  columns: ['step'],
  detail_fields: [],
  children_shown: 100,
  apply_date_filter: false,
};

const withColumns = (datasourceColumns: string[]) =>
  ({ datasourceColumns }) as unknown as ControlState;

test('no levels asks for one', () => {
  expect(validateLevels([])).toBe('Add at least one level.');
  expect(validateLevels(null)).toBe('Add at least one level.');
});

test('two empty levels list the required fields of each level', () => {
  expect(validateLevels([emptyParent, emptyChild])).toBe(
    'Level 1 is missing: Name, ID column, Time column. Level 2 is missing: Name, ID column, Linked to parent by.',
  );
});

test('filled levels pass', () => {
  expect(validateLevels([session, step])).toBe(false);
});

test('a child cannot link to its own ID column', () => {
  expect(
    validateLevels([session, { ...step, parent_column: step.id_column }]),
  ).toBe("Level 2: Linked to Session by can't be the level's own ID column.");
});

test('level 1 needs a time column', () => {
  expect(validateLevels([{ ...session, time_column: undefined }])).toBe(
    'Level 1 is missing: Time column.',
  );
});

test('a child level needs a time column only when the date filter applies', () => {
  expect(validateLevels([session, step])).toBe(false);
  expect(validateLevels([session, { ...step, apply_date_filter: true }])).toBe(
    'Level 2 is missing: Time column.',
  );
  expect(
    validateLevels([
      session,
      {
        ...step,
        apply_date_filter: true,
        time_column: 'step_started_at',
        detail_fields: ['step_started_at'],
      },
    ]),
  ).toBe(false);
});

const childRangeMessage = (number: number) =>
  `Level ${number}: with "Apply date filter to children" on, its time column must be one of its Columns or Detail fields.`;

test('with the child date filter on, the time column must be a Column or Detail field', () => {
  const dated = {
    ...step,
    apply_date_filter: true,
    time_column: 'step_started_at',
  };
  expect(validateLevels([session, dated])).toBe(childRangeMessage(2));
  expect(
    validateLevels([
      session,
      { ...dated, detail_fields: ['result', 'step_started_at'] },
    ]),
  ).toBe(false);
  expect(
    validateLevels([
      session,
      { ...dated, columns: ['step', 'step_started_at'] },
    ]),
  ).toBe(false);
  expect(
    validateLevels([session, { ...dated, apply_date_filter: false }]),
  ).toBe(false);
});

test('level 1 time column is not checked against its columns', () => {
  expect(validateLevels([{ ...session, apply_date_filter: true }, step])).toBe(
    false,
  );
});

test('a third level gets its own number', () => {
  const action: TreeLevel = {
    ...step,
    key: 'level-3',
    name: 'Action',
    id_column: 'action_id',
    parent_column: 'step_id',
    apply_date_filter: true,
    time_column: 'action_at',
  };
  expect(validateLevels([session, step, action])).toBe(childRangeMessage(3));
  expect(
    validateLevels([
      session,
      { ...step, apply_date_filter: true, time_column: 'step_started_at' },
      { ...action, name: '' },
    ]),
  ).toBe(
    `${childRangeMessage(2)} Level 3 is missing: Name. ${childRangeMessage(3)}`,
  );
});

test('a child level needs its Linked to column', () => {
  expect(validateLevels([session, { ...step, parent_column: undefined }])).toBe(
    'Level 2 is missing: Linked to Session by.',
  );
});

test('a blank name counts as missing', () => {
  expect(validateLevels([{ ...session, name: '  ' }])).toBe(
    'Level 1 is missing: Name.',
  );
});

test('columns the dataset lacks are listed once', () => {
  expect(
    validateLevelColumns(
      [
        session,
        { ...step, columns: ['step', 'loop'], detail_fields: ['loop'] },
      ],
      withColumns([
        'session_id',
        'session_started_at',
        'inbound_number',
        'step_id',
        'step',
      ]),
    ),
  ).toBe('Not in this dataset: channel, loop.');
});

test('every column the dataset has passes', () => {
  expect(
    validateLevelColumns(
      [session, step],
      withColumns([
        'session_id',
        'session_started_at',
        'channel',
        'inbound_number',
        'step_id',
        'step',
      ]),
    ),
  ).toBe(false);
});

test('no check while the dataset columns are not loaded', () => {
  expect(validateLevelColumns([session], withColumns([]))).toBe(false);
  expect(validateLevelColumns([session], undefined)).toBe(false);
});
