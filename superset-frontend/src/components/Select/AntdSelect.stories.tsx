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
import Select, { SelectProps } from './AntdSelect';

export default {
  title: 'Select',
  component: Select,
};

const options = [
  { label: 'Such an incredibly awesome long long label', value: 'A' },
  { label: 'Another incredibly awesome long long label', value: 'B' },
  { label: 'Just a label', value: 'C' },
  { label: 'D', value: 'D' },
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

async function fetchUserList(username: string, page = 0) {
  return fetch(
    `https://randomuser.me/api/?offset=${page}&search=${username}&results=20`,
  )
    .then(response => response.json())
    .then(body =>
      body.results.map(
        (user: {
          name: { first: string; last: string };
          login: { username: string };
        }) => ({
          label: `${user.name.first} ${user.name.last}`,
          value: user.login.username,
        }),
      ),
    );
}

export const AsyncSelect = () => (
  <Select ariaLabel="async-select" options={fetchUserList} paginatedFetch />
);

AsyncSelect.story = {
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
