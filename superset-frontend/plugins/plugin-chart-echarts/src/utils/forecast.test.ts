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

import { addLabelMapToVerboseMap } from './forecast';

describe('echarts forecast', () => {
  it('Should add label map to verbose map correctly', () => {
    const result = addLabelMapToVerboseMap(
      {
        testing_count: ['testing_count'],
        'testing_count, 1 day ago': ['testing_count', '1 day ago'],
        'testing_count, 1 week ago': ['testing_count', '1 week ago'],
        'testing_count, count, account, 1 week ago': [
          'testing_count',
          'count',
          'account',
          '1 week ago',
        ],
        'count, account, testing_count, account, 1 week ago': [
          'testing_count',
          'count',
          'account',
          '1 week ago',
        ],
      },
      {
        testing_count: 'Testing count',
        count: 'Total Count',
        account: 'User Account',
      },
    );

    expect(result).toEqual({
      account: 'User Account',
      count: 'Total Count',
      testing_count: 'Testing count',
      'testing_count, 1 day ago': 'Testing count, 1 day ago',
      'testing_count, 1 week ago': 'Testing count, 1 week ago',
      'testing_count, count, account, 1 week ago':
        'Testing count, Total Count, User Account, 1 week ago',
      'count, account, testing_count, account, 1 week ago':
        'Total Count, User Account, Testing count, User Account, 1 week ago',
    });
  });
});
