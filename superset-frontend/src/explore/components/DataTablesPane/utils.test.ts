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
import { transformTableData } from './utils';
import { QueryResultInterface } from './types';

const mockedQueryResults: ReadonlyArray<
  QueryResultInterface & { label_map?: Record<string, string[]> }
> = [
  {
    rowcount: 44,
    label_map: {
      ds: ['ds'],
      'sum__num, boy, CA': ['sum__num', 'boy', 'CA'],
      'sum__num, boy, FL': ['sum__num', 'boy', 'FL'],
      'sum__num, girl, CA': ['sum__num', 'girl', 'CA'],
      'sum__num, girl, FL': ['sum__num', 'girl', 'FL'],
      'testing_count, boy, CA': ['testing_count', 'boy', 'CA'],
      'testing_count, boy, FL': ['testing_count', 'boy', 'FL'],
      'testing_count, girl, CA': ['testing_count', 'girl', 'CA'],
      'testing_count, girl, FL': ['testing_count', 'girl', 'FL'],
      gender: ['gender'],
      state: ['state'],
      sum__num: ['sum__num'],
      'Testing count': ['testing_count'],
    },
    colnames: [
      'ds',
      'sum__num, boy, CA',
      'sum__num, boy, FL',
      'sum__num, girl, CA',
      'sum__num, girl, FL',
      'testing_count, boy, CA',
      'testing_count, boy, FL',
      'testing_count, girl, CA',
      'testing_count, girl, FL',
    ],
    coltypes: [2, 0, 0, 0, 0, 0, 0, 0, 0],
    data: [
      {
        ds: -157766400000,
        'sum__num, boy, CA': 110334,
        'sum__num, boy, FL': 30628,
        'sum__num, girl, CA': 81367,
        'sum__num, girl, FL': 23627,
        'testing_count, boy, CA': 65,
        'testing_count, boy, FL': 60,
        'testing_count, girl, CA': 73,
        'testing_count, girl, FL': 67,
      } as any,
      {
        ds: -126230400000,
        'sum__num, boy, CA': 106402,
        'sum__num, boy, FL': 30233,
        'sum__num, girl, CA': 78271,
        'sum__num, girl, FL': 22929,
        'testing_count, boy, CA': 66,
        'testing_count, boy, FL': 62,
        'testing_count, girl, CA': 75,
        'testing_count, girl, FL': 67,
      } as any,
    ],
  },
];

describe('utils', () => {
  it('Should format query result successfully', async () => {
    const result = transformTableData(mockedQueryResults);

    expect(result[0].colnames).toEqual([
      'ds',
      'sum__num, boy, CA',
      'sum__num, boy, FL',
      'sum__num, girl, CA',
      'sum__num, girl, FL',
      'Testing count, boy, CA',
      'Testing count, boy, FL',
      'Testing count, girl, CA',
      'Testing count, girl, FL',
    ]);
    expect(result[0].data).toEqual([
      {
        'Testing count, boy, CA': 65,
        'Testing count, boy, FL': 60,
        'Testing count, girl, CA': 73,
        'Testing count, girl, FL': 67,
        ds: -157766400000,
        'sum__num, boy, CA': 110334,
        'sum__num, boy, FL': 30628,
        'sum__num, girl, CA': 81367,
        'sum__num, girl, FL': 23627,
        'testing_count, boy, CA': 65,
        'testing_count, boy, FL': 60,
        'testing_count, girl, CA': 73,
        'testing_count, girl, FL': 67,
      },
      {
        'Testing count, boy, CA': 66,
        'Testing count, boy, FL': 62,
        'Testing count, girl, CA': 75,
        'Testing count, girl, FL': 67,
        ds: -126230400000,
        'sum__num, boy, CA': 106402,
        'sum__num, boy, FL': 30233,
        'sum__num, girl, CA': 78271,
        'sum__num, girl, FL': 22929,
        'testing_count, boy, CA': 66,
        'testing_count, boy, FL': 62,
        'testing_count, girl, CA': 75,
        'testing_count, girl, FL': 67,
      },
    ]);
  });
});
