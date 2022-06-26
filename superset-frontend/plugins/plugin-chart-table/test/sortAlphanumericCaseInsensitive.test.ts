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

import { defaultOrderByFn, Row } from 'react-table';
import { sortAlphanumericCaseInsensitive } from '../src/DataTable/utils/sortAlphanumericCaseInsensitive';

type RecursivePartial<T> = {
  [P in keyof T]?: T[P] | RecursivePartial<T[P]>;
};

const testData = [
  {
    values: {
      col: 'test value',
    },
  },
  {
    values: {
      col: 'a lowercase test value',
    },
  },
  {
    values: {
      col: '5',
    },
  },
  {
    values: {
      col: NaN,
    },
  },
  {
    values: {
      col: '1234',
    },
  },
  {
    values: {
      col: Infinity,
    },
  },
  {
    values: {
      col: '.!# value starting with non-letter characters',
    },
  },
  {
    values: {
      col: 'An uppercase test value',
    },
  },
  {
    values: {
      col: undefined,
    },
  },
  {
    values: {
      col: null,
    },
  },
];

describe('sortAlphanumericCaseInsensitive', () => {
  it('Sort rows', () => {
    const sorted = [...testData].sort((a, b) =>
      // @ts-ignore
      sortAlphanumericCaseInsensitive(a, b, 'col'),
    );

    expect(sorted).toEqual([
      {
        values: {
          col: null,
        },
      },
      {
        values: {
          col: undefined,
        },
      },
      {
        values: {
          col: Infinity,
        },
      },
      {
        values: {
          col: NaN,
        },
      },
      {
        values: {
          col: '.!# value starting with non-letter characters',
        },
      },
      {
        values: {
          col: '1234',
        },
      },
      {
        values: {
          col: '5',
        },
      },
      {
        values: {
          col: 'a lowercase test value',
        },
      },
      {
        values: {
          col: 'An uppercase test value',
        },
      },
      {
        values: {
          col: 'test value',
        },
      },
    ]);
  });
});

const testDataMulti: Array<RecursivePartial<Row<object>>> = [
  {
    values: {
      colA: 'group 1',
      colB: '10',
    },
  },
  {
    values: {
      colA: 'group 1',
      colB: '15',
    },
  },
  {
    values: {
      colA: 'group 1',
      colB: '20',
    },
  },
  {
    values: {
      colA: 'group 2',
      colB: '10',
    },
  },
  {
    values: {
      colA: 'group 3',
      colB: '10',
    },
  },
  {
    values: {
      colA: 'group 3',
      colB: '15',
    },
  },
  {
    values: {
      colA: 'group 3',
      colB: '10',
    },
  },
];

describe('sortAlphanumericCaseInsensitiveMulti', () => {
  it('Sort rows', () => {
    const sorted = defaultOrderByFn(
      [...testDataMulti] as Array<Row<object>>,
      [
        (a, b) => sortAlphanumericCaseInsensitive(a, b, 'colA'),
        (a, b) => sortAlphanumericCaseInsensitive(a, b, 'colB'),
      ],
      [true, false],
    );

    expect(sorted).toEqual([
      {
        values: {
          colA: 'group 1',
          colB: '20',
        },
      },
      {
        values: {
          colA: 'group 1',
          colB: '15',
        },
      },
      {
        values: {
          colA: 'group 1',
          colB: '10',
        },
      },
      {
        values: {
          colA: 'group 2',
          colB: '10',
        },
      },
      {
        values: {
          colA: 'group 3',
          colB: '15',
        },
      },
      {
        values: {
          colA: 'group 3',
          colB: '10',
        },
      },
      {
        values: {
          colA: 'group 3',
          colB: '10',
        },
      },
    ]);
  });
});
