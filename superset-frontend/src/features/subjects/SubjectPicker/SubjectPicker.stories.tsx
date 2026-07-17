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
import { useCallback, useState } from 'react';
import { AsyncSelect } from '@superset-ui/core/components';
import { SubjectType } from 'src/types/Subject';
import {
  SubjectSelectLabel,
  SUBJECT_TEXT_LABEL_PROP,
  SUBJECT_DETAIL_PROP,
  SUBJECT_OPTION_FILTER_PROPS,
} from 'src/features/subjects/SubjectSelectLabel';
import type { SubjectPickerValue } from './utils';

export default {
  title: 'SubjectPicker',
};

const MOCK_SUBJECTS = [
  {
    id: 1,
    text: 'Alice Smith',
    type: SubjectType.User,
    secondary_label: 'alice@example.com',
  },
  {
    id: 2,
    text: 'Bob Jones',
    type: SubjectType.User,
    secondary_label: 'bob@example.com',
  },
  { id: 3, text: 'Admin', type: SubjectType.Role, secondary_label: '' },
  { id: 4, text: 'Editor', type: SubjectType.Role, secondary_label: '' },
  { id: 5, text: 'Viewer', type: SubjectType.Role, secondary_label: '' },
  {
    id: 6,
    text: 'Engineering',
    type: SubjectType.Group,
    secondary_label: 'eng-team',
  },
  {
    id: 7,
    text: 'Data Science',
    type: SubjectType.Group,
    secondary_label: 'ds-team',
  },
  {
    id: 8,
    text: 'Carol White',
    type: SubjectType.User,
    secondary_label: 'carol@example.com',
  },
  {
    id: 9,
    text: 'Dave Brown',
    type: SubjectType.User,
    secondary_label: 'dave@example.com',
  },
  { id: 10, text: 'Gamma', type: SubjectType.Role, secondary_label: '' },
  {
    id: 11,
    text: 'Marketing',
    type: SubjectType.Group,
    secondary_label: 'mktg-team',
  },
  {
    id: 12,
    text: 'Eve Black',
    type: SubjectType.User,
    secondary_label: 'eve@example.com',
  },
];

export const InteractiveSubjectPicker = {
  render: (args: {
    placeholder: string;
    disabled: boolean;
    allowClear: boolean;
  }) => {
    const [value, setValue] = useState<SubjectPickerValue[]>([]);

    const loadOptions = useCallback(
      (search: string, page: number, pageSize: number) => {
        const query = search.trim().toLowerCase();
        const filtered = query
          ? MOCK_SUBJECTS.filter(
              s =>
                s.text.toLowerCase().includes(query) ||
                (s.secondary_label &&
                  s.secondary_label.toLowerCase().includes(query)),
            )
          : MOCK_SUBJECTS;

        const totalCount = filtered.length;
        const start = page * pageSize;
        const data = filtered.slice(start, start + pageSize).map(item => {
          const detail = item.secondary_label || undefined;
          return {
            value: item.id,
            label: SubjectSelectLabel({
              label: item.text,
              type: item.type,
              secondaryLabel: detail,
            }),
            [SUBJECT_TEXT_LABEL_PROP]: item.text,
            [SUBJECT_DETAIL_PROP]: detail ?? '',
          };
        });

        return new Promise<{ data: typeof data; totalCount: number }>(
          resolve => {
            setTimeout(() => resolve({ data, totalCount }), 300);
          },
        );
      },
      [],
    );

    return (
      <div style={{ width: 400 }}>
        <AsyncSelect
          ariaLabel="Editors"
          mode="multiple"
          value={value}
          options={loadOptions}
          onChange={v => setValue(v as SubjectPickerValue[])}
          placeholder={args.placeholder}
          disabled={args.disabled}
          allowClear={args.allowClear}
          optionFilterProps={SUBJECT_OPTION_FILTER_PROPS}
        />
      </div>
    );
  },
  args: {
    placeholder: 'Search editors',
    disabled: false,
    allowClear: true,
  },
  argTypes: {
    placeholder: {
      control: 'text',
      description: 'Placeholder text when no value is selected',
    },
    disabled: {
      control: 'boolean',
      description: 'Whether the picker is disabled',
    },
    allowClear: {
      control: 'boolean',
      description: 'Whether to allow clearing the selection',
    },
  },
};
