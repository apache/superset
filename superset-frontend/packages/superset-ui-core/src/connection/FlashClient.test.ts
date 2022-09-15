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
const mockFlashClient = () => ({
  data: {
    totalCount: 1,
    results: [
      {
        id: 4,
        domainName: 'test',
        serviceName: 'test',
        datasetName: 'test_bookings',
        datastoreId: 1,
        tableName: 'trip__bookings__test_bookings_3',
        owner: 'testuser@test.com',
        sqlQuery: 'SELECT * from test',
        flashType: 'ShortTerm',
        status: 'New',
        ttl: '2022-10-11',
        scheduleType: 'Daily',
        scheduleStartTime: '2022-08-01 12:00:00',
        teamSlackChannel: '#chat_test',
        teamSlackHandle: '@test_platform',
        cdomain: 'test',
        cservice: 'test',
      },
    ],
  },
});

describe('FlashClient', () => {
  it('will fetch flash objects', () => {
    const flashObjects = mockFlashClient();
    expect(flashObjects.data).toBeDefined();
    expect(flashObjects.data.totalCount).toBeDefined();
    expect(flashObjects.data.results).toBeDefined();
  });
});
