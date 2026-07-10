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
import { render, screen, userEvent } from 'spec/helpers/testing-library';
import { SubjectType } from 'src/types/Subject';
import {
  mapSubjectPickerValuesToIds,
  mapSubjectValuesToIds,
  mapPickerValuesToSubjects,
  mapSubjectsToPickerValues,
  mergeSubjectPickerValues,
  normalizeSubjectsToPickerValues,
} from './utils';

const mockAsyncSelect = jest.fn((props: any) => (
  <div>
    {props.header}
    <input
      aria-label={props.ariaLabel}
      aria-controls="subject-picker-options"
      aria-expanded="false"
      disabled={props.disabled}
      placeholder={props.placeholder}
      role="combobox"
    />
    <button
      type="button"
      onClick={() =>
        props.onChange(
          [{ value: 2, label: 'Admin' }],
          [
            {
              value: 2,
              label: 'Admin',
              textLabel: 'Admin',
              subjectDetail: '',
              type: 2,
            },
          ],
        )
      }
    >
      select subject
    </button>
  </div>
));

jest.mock('@superset-ui/core/components', () => ({
  AsyncSelect: (props: any) => mockAsyncSelect(props),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

test('mapSubjectsToPickerValues maps subjects to picker values', () => {
  const subjects = [
    {
      id: 1,
      label: 'Alice',
      type: SubjectType.User,
      secondary_label: 'alice@example.com',
    },
    { id: 2, label: 'Admin', type: SubjectType.Role },
    {
      id: 3,
      label: 'Team A',
      type: SubjectType.Group,
      secondary_label: 'Engineering',
    },
  ];

  const result = mapSubjectsToPickerValues(subjects);

  expect(result).toHaveLength(3);
  expect(result[0].value).toBe(1);
  expect(result[0].textLabel).toBe('Alice');
  expect(result[0].subjectDetail).toBe('alice@example.com');
  expect(result[1].value).toBe(2);
  expect(result[1].textLabel).toBe('Admin');
  expect(result[1].type).toBe(SubjectType.Role);
  expect(result[2].value).toBe(3);
  expect(result[2].textLabel).toBe('Team A');
  expect(result[2].subjectDetail).toBe('Engineering');
});

test('mergeSubjectPickerValues preserves subject metadata from options', () => {
  const [option] = mapSubjectsToPickerValues([
    { id: 2, label: 'Admin', type: SubjectType.Role },
  ]);
  const [result] = mergeSubjectPickerValues(
    [{ value: 2, label: option.label }],
    [option],
  );

  expect(result.textLabel).toBe('Admin');
  expect(result.type).toBe(SubjectType.Role);
  expect(result.subjectDetail).toBe('');
});

test('mapPickerValuesToSubjects maps selected picker values to subjects', () => {
  const [option] = mapSubjectsToPickerValues([
    {
      id: 3,
      label: 'Team A',
      type: SubjectType.Group,
      secondary_label: 'Engineering',
    },
  ]);
  const [mergedValue] = mergeSubjectPickerValues(
    [{ value: 3, label: option.label }],
    [option],
  );

  expect(mapPickerValuesToSubjects([mergedValue])).toEqual([
    {
      id: 3,
      label: 'Team A',
      type: SubjectType.Group,
      secondary_label: 'Engineering',
    },
  ]);
});

test('mapSubjectsToPickerValues handles empty array', () => {
  const result = mapSubjectsToPickerValues([]);
  expect(result).toEqual([]);
});

test('mapSubjectsToPickerValues handles missing optional fields', () => {
  const subjects = [{ id: 1, type: SubjectType.User }];

  const result = mapSubjectsToPickerValues(subjects);

  expect(result).toHaveLength(1);
  expect(result[0].value).toBe(1);
  expect(result[0].textLabel).toBe('');
  expect(result[0].subjectDetail).toBe('');
});

test('normalizeSubjectsToPickerValues supports API and picker-shaped subjects', () => {
  const result = normalizeSubjectsToPickerValues([
    {
      id: 1,
      label: 'Alice',
      type: SubjectType.User,
      secondary_label: 'alice@example.com',
    },
    {
      value: 2,
      label: 'Admin',
      type: SubjectType.Role,
    },
    {
      id: 3,
      first_name: 'Grace',
      last_name: 'Hopper',
      email: 'grace@example.com',
      type: SubjectType.User,
    },
    {
      label: 'Missing ID',
      type: SubjectType.Group,
    },
  ]);

  expect(result).toHaveLength(3);
  expect(result[0]).toMatchObject({
    value: 1,
    textLabel: 'Alice',
    subjectDetail: 'alice@example.com',
    type: SubjectType.User,
  });
  expect(result[1]).toMatchObject({
    value: 2,
    textLabel: 'Admin',
    type: SubjectType.Role,
  });
  expect(result[2]).toMatchObject({
    value: 3,
    textLabel: 'Grace Hopper',
    subjectDetail: 'grace@example.com',
    type: SubjectType.User,
  });
});

test('mapSubjectPickerValuesToIds returns numeric subject IDs', () => {
  expect(
    mapSubjectPickerValuesToIds([
      { value: 1, label: 'Alice' },
      { value: 2, label: 'Admin' },
    ]),
  ).toEqual([1, 2]);
});

test('mapSubjectValuesToIds supports API and picker-shaped subjects', () => {
  expect(
    mapSubjectValuesToIds([
      { id: 1, label: 'Alice', type: SubjectType.User },
      { value: 2, label: 'Admin', type: SubjectType.Role },
      { label: 'Missing ID', type: SubjectType.Group },
    ]),
  ).toEqual([1, 2]);
});

test('SubjectPicker renders with placeholder', async () => {
  // Lazy import to avoid issues with module mocking
  const { default: SubjectPicker } = await import('.');

  render(
    <SubjectPicker
      relatedUrl="/api/v1/dashboard/related/editors"
      ariaLabel="Editors"
      value={[]}
      onChange={jest.fn()}
      placeholder="Search editors"
    />,
  );

  expect(screen.getByRole('combobox', { name: 'Editors' })).toBeInTheDocument();
});

test('SubjectPicker renders with header', async () => {
  const { default: SubjectPicker } = await import('.');

  render(
    <SubjectPicker
      relatedUrl="/api/v1/dashboard/related/editors"
      ariaLabel="Editors"
      value={[]}
      onChange={jest.fn()}
      header={<span data-test="header">Editors</span>}
    />,
  );

  expect(screen.getByTestId('header')).toBeInTheDocument();
});

test('SubjectPicker renders as disabled', async () => {
  const { default: SubjectPicker } = await import('.');

  render(
    <SubjectPicker
      relatedUrl="/api/v1/dashboard/related/editors"
      ariaLabel="Editors"
      value={[]}
      onChange={jest.fn()}
      disabled
    />,
  );

  const combobox = screen.getByRole('combobox', { name: 'Editors' });
  expect(combobox).toBeDisabled();
});

test('SubjectPicker preserves subject metadata on change', async () => {
  const { default: SubjectPicker } = await import('.');
  const onChange = jest.fn();

  render(
    <SubjectPicker
      relatedUrl="/api/v1/dashboard/related/editors"
      ariaLabel="Editors"
      value={[]}
      onChange={onChange}
    />,
  );

  userEvent.click(screen.getByRole('button', { name: 'select subject' }));

  expect(onChange).toHaveBeenCalledWith([
    expect.objectContaining({
      value: 2,
      textLabel: 'Admin',
      type: SubjectType.Role,
    }),
  ]);
});
