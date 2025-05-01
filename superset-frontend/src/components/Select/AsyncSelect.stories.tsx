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
import { ReactNode, useState, useCallback, useRef, useMemo } from 'react';
import Button from 'src/components/Button';
import AsyncSelect from './AsyncSelect';
import {
  AsyncSelectProps,
  AsyncSelectRef,
  SelectOptionsTypePage,
} from './types';

export default {
  title: 'AsyncSelect',
  component: AsyncSelect,
};

const DEFAULT_WIDTH = 200;

const ARG_TYPES = {
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
  oneLine: {
    defaultValue: false,
    description: `Sets maxTagCount to 1. The overflow tag is always displayed in
       the same line, line wrapping is disabled.
       When the dropdown is open, sets maxTagCount to 0,
       displays only the overflow tag.
       Requires '"mode=multiple"'.
     `,
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

export const AsynchronousSelect = ({
  fetchOnlyOnSearch,
  withError,
  withInitialValue,
  responseTime,
  ...rest
}: AsyncSelectProps & {
  withError: boolean;
  withInitialValue: boolean;
  responseTime: number;
}) => {
  const [requests, setRequests] = useState<ReactNode[]>([]);
  const ref = useRef<AsyncSelectRef>(null);

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
    ): Promise<SelectOptionsTypePage> => {
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

  const fetchUserListError = async (): Promise<SelectOptionsTypePage> =>
    new Promise((_, reject) => {
      reject(new Error('Error while fetching the names from the server'));
    });

  const initialValue = useMemo(
    () => ({ label: 'Valentina', value: 'Valentina' }),
    [],
  );

  return (
    <>
      <div
        style={{
          width: DEFAULT_WIDTH,
        }}
      >
        <AsyncSelect
          {...rest}
          ref={ref}
          fetchOnlyOnSearch={fetchOnlyOnSearch}
          options={withError ? fetchUserListError : fetchUserListPage}
          placeholder={fetchOnlyOnSearch ? 'Type anything' : 'AsyncSelect...'}
          value={withInitialValue ? initialValue : undefined}
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
      <Button
        style={{
          position: 'absolute',
          top: 452,
          left: DEFAULT_WIDTH + 580,
        }}
        onClick={() => {
          ref.current?.clearCache();
          setRequests([]);
        }}
      >
        Clear cache
      </Button>
    </>
  );
};

AsynchronousSelect.args = {
  allowClear: false,
  allowNewOptions: false,
  fetchOnlyOnSearch: false,
  pageSize: 10,
  withError: false,
  withInitialValue: false,
  tokenSeparators: ['\n', '\t', ';'],
};

AsynchronousSelect.argTypes = {
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
