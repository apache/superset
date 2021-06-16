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
import React from 'react';
import Select, { OptionsType, SelectProps } from './AntdSelect';

export default {
  title: 'Select',
  component: Select,
};

const options = [
  {
    label: 'Such an incredibly awesome long long label',
    value: 'Such an incredibly awesome long long label',
  },
  {
    label: 'Another incredibly awesome long long label',
    value: 'Another incredibly awesome long long label',
  },
  { label: 'Just a label', value: 'Just a label' },
  { label: 'A', value: 'A' },
  { label: 'B', value: 'B' },
  { label: 'C', value: 'C' },
  { label: 'D', value: 'D' },
  { label: 'E', value: 'E' },
  { label: 'F', value: 'F' },
  { label: 'G', value: 'G' },
  { label: 'H', value: 'H' },
  { label: 'I', value: 'I' },
];

const selectPositions = [
  {
    id: 'topLeft',
    style: { top: '0', left: '0' },
  },
  {
    id: 'topRight',
    style: { top: '0', right: '0' },
  },
  {
    id: 'bottomLeft',
    style: { bottom: '0', left: '0' },
  },
  {
    id: 'bottomRight',
    style: { bottom: '0', right: '0' },
  },
];

export const AtEveryCorner = () => (
  <>
    {selectPositions.map(position => (
      <div
        key={position.id}
        style={{
          ...position.style,
          width: '120px',
          position: 'absolute',
        }}
      >
        <Select ariaLabel={`gallery-${position.id}`} options={options} />
      </div>
    ))}
  </>
);

AtEveryCorner.story = {
  parameters: {
    actions: {
      disable: true,
    },
    controls: {
      disable: true,
    },
    knobs: {
      disable: true,
    },
  },
};

async function fetchUserList(search: string, page = 0): Promise<OptionsType> {
  const username = search.trim().toLowerCase();
  return new Promise(resolve => {
    const users = [
      'John',
      'Liam',
      'Olivia',
      'Emma',
      'Noah',
      'Ava',
      'Oliver',
      'Elijah',
      'Charlotte',
      'Diego',
      'Evan',
      'Michael',
      'Giovanni',
      'Luca',
      'Paolo',
      'Francesca',
      'Chiara',
      'Sara',
      'Valentina',
      'Jessica',
      'Angelica',
      'Mario',
      'Marco',
      'Andrea',
      'Luigi',
      'Quarto',
      'Quinto',
      'Sesto',
      'Franco',
      'Sandro',
      'Alehandro',
      'Johnny',
      'Nikole',
      'Igor',
      'Sipatha',
      'Thami',
      'Munei',
      'Guilherme',
      'Umair',
      'Ashfaq',
      'Amna',
      'Irfan',
      'George',
      'Naseer',
      'Mohammad',
      'Rick',
      'Saliya',
      'Claire',
      'Benedetta',
      'Ilenia',
    ];

    let results: { label: string; value: string }[] = [];

    if (!username) {
      results = users.map(u => ({
        label: u,
        value: u,
      }));
    } else {
      const foundUsers = users.find(u => u.toLowerCase().includes(username));
      if (foundUsers && Array.isArray(foundUsers)) {
        results = foundUsers.map(u => ({ label: u, value: u }));
      }
      if (foundUsers && typeof foundUsers === 'string') {
        const u = foundUsers;
        results = [{ label: u, value: u }];
      }
    }
    const offset = !page ? 0 : page * 10;
    const resultsNum = !page ? 10 : (page + 1) * 10;
    results = results.length ? results.splice(offset, resultsNum) : [];

    // eslint-disable-next-line no-console
    console.warn(
      `Emulating network request for search string: ${
        username || '"empty"'
      } and page: ${page} with results: [${results
        .map(u => u.value)
        .join(', ')}]`,
    );

    setTimeout(() => {
      resolve(results);
    }, 500);
  });
}

async function fetchUserListError(): Promise<OptionsType> {
  return new Promise((_, reject) => {
    // eslint-disable-next-line prefer-promise-reject-errors
    reject('This is an error');
  });
}

export const AsyncSelect = (args: SelectProps & { withError: boolean }) => (
  <Select
    {...args}
    options={args.withError ? fetchUserListError : fetchUserList}
  />
);

AsyncSelect.args = {
  withError: false,
  allowNewOptions: false,
  paginatedFetch: false,
};

AsyncSelect.argTypes = {
  mode: {
    control: { type: 'select', options: ['single', 'multiple', 'tags'] },
  },
};

AsyncSelect.story = {
  parameters: {
    knobs: {
      disable: true,
    },
  },
};

export const InteractiveSelect = (args: SelectProps) => <Select {...args} />;

InteractiveSelect.args = {
  allowNewOptions: false,
  options,
  showSearch: false,
};

InteractiveSelect.argTypes = {
  mode: {
    control: { type: 'select', options: ['single', 'multiple', 'tags'] },
  },
};

InteractiveSelect.story = {
  parameters: {
    knobs: {
      disable: true,
    },
  },
};
