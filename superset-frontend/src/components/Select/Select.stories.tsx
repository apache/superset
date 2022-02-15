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
import ControlHeader from 'src/explore/components/ControlHeader';
import Select, { SelectProps, OptionsTypePage } from './Select';

export default {
  title: 'Select',
  component: Select,
};

const DEFAULT_WIDTH = 200;

const options = [
  {
    label: 'Such an incredibly awesome long long label',
    value: 'Such an incredibly awesome long long label',
    custom: 'Secret custom prop',
  },
  {
    label: 'Another incredibly awesome long long label',
    value: 'Another incredibly awesome long long label',
  },
  {
    label: 'JSX Label',
    customLabel: <div style={{ color: 'red' }}>JSX Label</div>,
    value: 'JSX Label',
  },
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

const ARG_TYPES = {
  options: {
    defaultValue: options,
    description: `It defines the options of the Select.
      The options can be static, an array of options.
      The options can also be async, a promise that returns an array of options.
    `,
  },
  ariaLabel: {
    description: `It adds the aria-label tag for accessibility standards.
      Must be plain English and localized.
    `,
  },
  labelInValue: {
    defaultValue: true,
    table: {
      disable: true,
    },
  },
  name: {
    table: {
      disable: true,
    },
  },
  notFoundContent: {
    table: {
      disable: true,
    },
  },
  mode: {
    description: `It defines whether the Select should allow for
      the selection of multiple options or single. Single by default.
    `,
    defaultValue: 'single',
    control: {
      type: 'inline-radio',
      options: ['single', 'multiple'],
    },
  },
  allowNewOptions: {
    description: `It enables the user to create new options.
      Can be used with standard or async select types.
      Can be used with any mode, single or multiple. False by default.
    `,
  },
  invertSelection: {
    description: `It shows a stop-outlined icon at the far right of a selected
      option instead of the default checkmark.
      Useful to better indicate to the user that by clicking on a selected
      option it will be de-selected. False by default.
    `,
  },
  optionFilterProps: {
    description: `It allows to define which properties of the option object
      should be looked for when searching.
      By default label and value.
    `,
  },
};

const mountHeader = (type: String) => {
  let header;
  if (type === 'text') {
    header = 'Text header';
  } else if (type === 'control') {
    header = (
      <ControlHeader
        label="Control header"
        warning="Example of warning messsage"
      />
    );
  }
  return header;
};

export const InteractiveSelect = (args: SelectProps & { header: string }) => (
  <div
    style={{
      width: DEFAULT_WIDTH,
    }}
  >
    <Select {...args} header={mountHeader(args.header)} />
  </div>
);

InteractiveSelect.args = {
  autoFocus: false,
  allowNewOptions: false,
  allowClear: false,
  showSearch: false,
  disabled: false,
  invertSelection: false,
  placeholder: 'Select ...',
  optionFilterProps: ['value', 'label', 'custom'],
};

InteractiveSelect.argTypes = {
  ...ARG_TYPES,
  header: {
    defaultValue: 'none',
    description: `It adds a header on top of the Select. Can be any ReactNode.`,
    control: { type: 'inline-radio', options: ['none', 'text', 'control'] },
  },
  pageSize: {
    description: `It defines how many results should be included in the query response.
      Works in async mode only (See the options property).
    `,
  },
  fetchOnlyOnSearch: {
    description: `It fires a request against the server only after searching.
      Works in async mode only (See the options property).
      Undefined by default.
    `,
  },
};

InteractiveSelect.story = {
  parameters: {
    knobs: {
      disable: true,
    },
  },
};

export const AtEveryCorner = () => (
  <>
    {selectPositions.map(position => (
      <div
        key={position.id}
        style={{
          ...position.style,
          margin: 30,
          width: DEFAULT_WIDTH,
          position: 'absolute',
        }}
      >
        <Select
          ariaLabel={`gallery-${position.id}`}
          options={options}
          labelInValue
        />
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

export const PageScroll = () => (
  <div style={{ height: 2000, overflowY: 'auto' }}>
    <div
      style={{
        width: DEFAULT_WIDTH,
        position: 'absolute',
        top: 30,
        right: 30,
      }}
    >
      <Select ariaLabel="page-scroll-select-1" options={options} labelInValue />
    </div>
    <div
      style={{
        width: DEFAULT_WIDTH,
        position: 'absolute',
        bottom: 30,
        right: 30,
      }}
    >
      <Select ariaLabel="page-scroll-select-2" options={options} />
    </div>
    <p
      style={{
        position: 'absolute',
        top: '40%',
        left: 30,
        width: 500,
      }}
    >
      The objective of this panel is to show how the Select behaves when there's
      a scroll on the page. In particular, how the drop-down is displayed.
    </p>
  </div>
);

PageScroll.story = {
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
].sort();

export const AsyncSelect = ({
  fetchOnlyOnSearch,
  withError,
  withInitialValue,
  responseTime,
  ...rest
}: SelectProps & {
  withError: boolean;
  withInitialValue: boolean;
  responseTime: number;
}) => {
  const [requests, setRequests] = useState<ReactNode[]>([]);

  const getResults = (username?: string) => {
    let results: { label: string; value: string }[] = [];

    if (!username) {
      results = USERS.map(u => ({
        label: u,
        value: u,
      }));
    } else {
      const foundUsers = USERS.filter(u => u.toLowerCase().includes(username));
      if (foundUsers) {
        results = foundUsers.map(u => ({ label: u, value: u }));
      } else {
        results = [];
      }
    }
    return results;
  };

  const setRequestLog = (results: number, total: number, username?: string) => {
    const request = (
      <>
        Emulating network request with search <b>{username || 'empty'}</b> ...{' '}
        <b>
          {results}/{total}
        </b>{' '}
        results
      </>
    );

    setRequests(requests => [request, ...requests]);
  };

  const fetchUserListPage = useCallback(
    (
      search: string,
      page: number,
      pageSize: number,
    ): Promise<OptionsTypePage> => {
      const username = search.trim().toLowerCase();
      return new Promise(resolve => {
        let results = getResults(username);
        const totalCount = results.length;
        const start = page * pageSize;
        const deleteCount =
          start + pageSize < totalCount ? pageSize : totalCount - start;
        results = results.splice(start, deleteCount);
        setRequestLog(start + results.length, totalCount, username);
        setTimeout(() => {
          resolve({ data: results, totalCount });
        }, responseTime * 1000);
      });
    },
    [responseTime],
  );

  const fetchUserListError = async (): Promise<OptionsTypePage> =>
    new Promise((_, reject) => {
      reject(new Error('Error while fetching the names from the server'));
    });

  return (
    <>
      <div
        style={{
          width: DEFAULT_WIDTH,
        }}
      >
        <Select
          {...rest}
          fetchOnlyOnSearch={fetchOnlyOnSearch}
          options={withError ? fetchUserListError : fetchUserListPage}
          placeholder={fetchOnlyOnSearch ? 'Type anything' : 'Select...'}
          value={
            withInitialValue
              ? { label: 'Valentina', value: 'Valentina' }
              : undefined
          }
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
        {requests.map((request, index) => (
          <p key={`request-${index}`}>{request}</p>
        ))}
      </div>
    </>
  );
};

AsyncSelect.args = {
  allowClear: false,
  allowNewOptions: false,
  fetchOnlyOnSearch: false,
  pageSize: 10,
  withError: false,
  withInitialValue: false,
};

AsyncSelect.argTypes = {
  ...ARG_TYPES,
  header: {
    table: {
      disable: true,
    },
  },
  invertSelection: {
    table: {
      disable: true,
    },
  },
  pageSize: {
    defaultValue: 10,
    control: {
      type: 'range',
      min: 10,
      max: 50,
      step: 10,
    },
  },
  responseTime: {
    defaultValue: 0.5,
    name: 'responseTime (seconds)',
    control: {
      type: 'range',
      min: 0.5,
      max: 5,
      step: 0.5,
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
