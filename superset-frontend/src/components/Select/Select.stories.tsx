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
import React, { ReactNode, useState, useCallback } from 'react';
import Select, { SelectProps, OptionsPromiseResult } from './Select';

export default {
  title: 'Select',
  component: Select,
};

const DEFAULT_WIDTH = 200;

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
          width: DEFAULT_WIDTH,
          position: 'absolute',
        }}
      >
        <Select ariaLabel={`gallery-${position.id}`} options={options} />
      </div>
    ))}
    <p style={{ position: 'absolute', top: '40%', left: '33%', width: 500 }}>
      The objective of this panel is to show how the Select behaves when in
      touch with the viewport extremities. In particular, how the drop-down is
      displayed and if the tooltips of truncated items are correctly positioned.
    </p>
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

const USERS = [
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

export const AsyncSelect = (
  args: SelectProps & { withError: boolean; responseTime: number },
) => {
  const [requests, setRequests] = useState<ReactNode[]>([]);

  const fetchUserList = useCallback(
    (search: string, page = 0): Promise<OptionsPromiseResult> => {
      const username = search.trim().toLowerCase();
      return new Promise(resolve => {
        let results: { label: string; value: string }[] = [];

        if (!username) {
          results = USERS.map(u => ({
            label: u,
            value: u,
          }));
        } else {
          const foundUsers = USERS.find(u =>
            u.toLowerCase().includes(username),
          );
          if (foundUsers && Array.isArray(foundUsers)) {
            results = foundUsers.map(u => ({ label: u, value: u }));
          }
          if (foundUsers && typeof foundUsers === 'string') {
            const u = foundUsers;
            results = [{ label: u, value: u }];
          }
        }

        const pageSize = 10;
        const offset = !page ? 0 : page * pageSize;
        const resultsNum = !page ? pageSize : (page + 1) * pageSize;
        results = results.length ? results.splice(offset, resultsNum) : [];

        const request = (
          <>
            Emulating network request for page <b>{page}</b> and search{' '}
            <b>{username || 'empty'}</b> ... <b>{resultsNum}</b> results
          </>
        );

        setRequests(requests => [request, ...requests]);

        const totalPages =
          USERS.length / pageSize + (USERS.length % pageSize > 0 ? 1 : 0);

        const result: OptionsPromiseResult = {
          data: results,
          hasMoreData: page + 1 < totalPages,
        };

        setTimeout(() => {
          resolve(result);
        }, args.responseTime * 1000);
      });
    },
    [args.responseTime],
  );

  async function fetchUserListError(): Promise<OptionsPromiseResult> {
    return new Promise((_, reject) => {
      // eslint-disable-next-line prefer-promise-reject-errors
      reject('This is an error');
    });
  }

  return (
    <>
      <div
        style={{
          width: DEFAULT_WIDTH,
        }}
      >
        <Select
          {...args}
          options={args.withError ? fetchUserListError : fetchUserList}
        />
      </div>
      <div
        style={{
          position: 'absolute',
          top: 32,
          left: DEFAULT_WIDTH + 100,
          height: 400,
          width: 600,
          overflowY: 'auto',
          border: '1px solid #d9d9d9',
          padding: 20,
        }}
      >
        {requests.map(request => (
          <p>{request}</p>
        ))}
      </div>
    </>
  );
};

AsyncSelect.args = {
  withError: false,
  allowNewOptions: false,
  paginatedFetch: false,
};

AsyncSelect.argTypes = {
  mode: {
    control: { type: 'select', options: ['single', 'multiple', 'tags'] },
  },
  responseTime: {
    defaultValue: 1,
    name: 'responseTime (seconds)',
    control: {
      type: 'range',
      min: 1,
      max: 5,
    },
  },
};

AsyncSelect.story = {
  parameters: {
    knobs: {
      disable: true,
    },
  },
};

export const InteractiveSelect = (args: SelectProps) => (
  <div
    style={{
      width: DEFAULT_WIDTH,
    }}
  >
    <Select {...args} />
  </div>
);

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
