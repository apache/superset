/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements. See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership. The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License. You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import buildQuery from '../src/buildQuery';

describe('Advanced column filters (additional cases)', () => {
  it('sanitizes SQL where parts for OR logic to drop injections', () => {
    const formData: any = {
      viz_type: 'table',
      datasource: '11__table',
      slice_id: 'slice-adv-xss',
      server_pagination: true,
      temporal_columns_lookup: {},
    };
    const { queries } = buildQuery(formData as any, {
      ownState: {
        advancedFilters: {
          status: {
            logic: 'OR',
            conditions: [
              { op: 'equals', value: "ok'); DROP TABLE users;--" },
              { op: 'contains', value: '<script>alert(1)</script>' },
            ],
          },
        },
      },
    } as any);
    const where = String((queries?.[0] as any)?.extras?.where || '');
    // No statement separators or comment tokens should remain
    expect(where).not.toMatch(/;/);
    expect(where).not.toMatch(/--/);
    expect(where).not.toMatch(/\/\*/);
    expect(where).not.toMatch(/\*\//);
    // Contains sanitized equals (quotes doubled), without statement separators
    expect(where).toMatch(/status\s*=\s*'ok''/);
    // Contains ILIKE with the provided content (no additional separators)
    expect(where).toMatch(/ILIKE/);
    expect(where.toLowerCase()).toContain('script');
  });
});
