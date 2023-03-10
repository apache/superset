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
import findTabIndexByComponentId from 'src/dashboard/util/findTabIndexByComponentId';

describe('findTabIndexByComponentId', () => {
  const topLevelTabsComponent = {
    children: ['TAB-0g-5l347I2', 'TAB-qrwN_9VB5'],
    id: 'TABS-MNQQSW-kyd',
    meta: {},
    parents: ['ROOT_ID'],
    type: 'TABS',
  };
  const rowLevelTabsComponent = {
    children: [
      'TAB-TwyUUGp2Bg',
      'TAB-Zl1BQAUvN',
      'TAB-P0DllxzTU',
      'TAB---e53RNei',
    ],
    id: 'TABS-Oduxop1L7I',
    meta: {},
    parents: ['ROOT_ID', 'TABS-MNQQSW-kyd', 'TAB-qrwN_9VB5'],
    type: 'TABS',
  };
  const goodPathToChild = [
    'ROOT_ID',
    'TABS-MNQQSW-kyd',
    'TAB-qrwN_9VB5',
    'TABS-Oduxop1L7I',
    'TAB-P0DllxzTU',
    'ROW-JXhrFnVP8',
    'CHART-dUIVg-ENq6',
  ];
  const badPath = ['ROOT_ID', 'TABS-MNQQSW-kyd', 'TAB-ABC', 'TABS-Oduxop1L7I'];

  it('should return -1 if no directPathToChild', () => {
    expect(
      findTabIndexByComponentId({
        currentComponent: topLevelTabsComponent,
        directPathToChild: [],
      }),
    ).toBe(-1);
  });

  it('should return -1 if not found tab id', () => {
    expect(
      findTabIndexByComponentId({
        currentComponent: topLevelTabsComponent,
        directPathToChild: badPath,
      }),
    ).toBe(-1);
  });

  it('should return children index if matched an id in the path', () => {
    expect(
      findTabIndexByComponentId({
        currentComponent: topLevelTabsComponent,
        directPathToChild: goodPathToChild,
      }),
    ).toBe(1);

    expect(
      findTabIndexByComponentId({
        currentComponent: rowLevelTabsComponent,
        directPathToChild: goodPathToChild,
      }),
    ).toBe(2);
  });
});
