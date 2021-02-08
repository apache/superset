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
import isDashboardEmpty from 'src/dashboard/util/isDashboardEmpty';
import getEmptyLayout from 'src/dashboard/util/getEmptyLayout';

describe('isDashboardEmpty', () => {
  const emptyLayout: object = getEmptyLayout();
  const testLayout: object = {
    ...emptyLayout,
    'MARKDOWN-IhTGLhyiTd': {
      children: [],
      id: 'MARKDOWN-IhTGLhyiTd',
      meta: { code: 'test me', height: 50, width: 4 },
      parents: ['ROOT_ID', 'GRID_ID', 'ROW-uPjcKNYJQy'],
      type: 'MARKDOWN',
    },
  };

  it('should return true for empty dashboard', () => {
    expect(isDashboardEmpty(emptyLayout)).toBe(true);
  });

  it('should return false for non-empty dashboard', () => {
    expect(isDashboardEmpty(testLayout)).toBe(false);
  });
});
