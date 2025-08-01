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
import fetchMock from 'fetch-mock';
import rison from 'rison';
import { tagToSelectOption, loadTags } from 'src/components/Tag/utils';

describe('tagToSelectOption', () => {
  test('converts a Tag object with table_name to a SelectTagsValue', () => {
    const tag = {
      id: 1,
      name: 'TagName',
      table_name: 'Table1',
    };

    const expectedSelectTagsValue = {
      value: 1,
      label: 'TagName',
      key: 1,
    };

    expect(tagToSelectOption(tag)).toEqual(expectedSelectTagsValue);
  });
});

describe('loadTags', () => {
  beforeEach(() => {
    fetchMock.reset();
  });

  afterEach(() => {
    fetchMock.restore();
  });

  test('constructs correct API query with custom tag filter', async () => {
    const mockTags = [
      { id: 1, name: 'analytics', type: 1 },
      { id: 2, name: 'finance', type: 1 },
    ];

    fetchMock.get('glob:*/api/v1/tag/*', {
      result: mockTags,
      count: 2,
    });

    await loadTags('analytics', 0, 25);

    // Verify the API was called with correct parameters
    const calls = fetchMock.calls();
    expect(calls).toHaveLength(1);

    const [url] = calls[0];
    expect(url).toContain('/api/v1/tag/?q=');

    // Extract and decode the query parameter
    const urlObj = new URL(url);
    const queryParam = urlObj.searchParams.get('q');
    expect(queryParam).not.toBeNull();
    const decodedQuery = rison.decode(queryParam!) as Record<string, any>;

    // Verify the query structure
    expect(decodedQuery).toEqual({
      filters: [
        { col: 'name', opr: 'ct', value: 'analytics' },
        { col: 'type', opr: 'custom_tag', value: true },
      ],
      page: 0,
      page_size: 25,
      order_column: 'name',
      order_direction: 'asc',
    });
  });

  test('returns correctly transformed data', async () => {
    const mockTags = [
      { id: 1, name: 'analytics', type: 1 },
      { id: 2, name: 'finance', type: 1 },
    ];

    fetchMock.get('glob:*/api/v1/tag/*', {
      result: mockTags,
      count: 2,
    });

    const result = await loadTags('', 0, 25);

    expect(result).toEqual({
      data: [
        { value: 1, label: 'analytics', key: 1 },
        { value: 2, label: 'finance', key: 2 },
      ],
      totalCount: 2,
    });
  });

  test('handles search parameter correctly', async () => {
    fetchMock.get('glob:*/api/v1/tag/*', {
      result: [],
      count: 0,
    });

    await loadTags('financial-data', 0, 25);

    const calls = fetchMock.calls();
    const [url] = calls[0];
    const urlObj = new URL(url);
    const queryParam = urlObj.searchParams.get('q');
    expect(queryParam).not.toBeNull();
    const decodedQuery = rison.decode(queryParam!) as Record<string, any>;

    // Should include the search term in the name filter
    expect(decodedQuery.filters[0]).toEqual({
      col: 'name',
      opr: 'ct',
      value: 'financial-data',
    });
  });

  test('handles pagination parameters correctly', async () => {
    fetchMock.get('glob:*/api/v1/tag/*', {
      result: [],
      count: 0,
    });

    await loadTags('', 2, 10);

    const calls = fetchMock.calls();
    const [url] = calls[0];
    const urlObj = new URL(url);
    const queryParam = urlObj.searchParams.get('q');
    expect(queryParam).not.toBeNull();
    const decodedQuery = rison.decode(queryParam!) as Record<string, any>;

    expect(decodedQuery.page).toBe(2);
    expect(decodedQuery.page_size).toBe(10);
  });

  test('always includes custom tag filter regardless of other parameters', async () => {
    fetchMock.get('glob:*/api/v1/tag/*', {
      result: [],
      count: 0,
    });

    // Test with different combinations of parameters
    await loadTags('', 0, 25);
    await loadTags('search-term', 1, 50);
    await loadTags('another-search', 5, 100);

    const calls = fetchMock.calls();

    // Verify all calls include the custom tag filter
    calls.forEach(call => {
      const [url] = call;
      const urlObj = new URL(url);
      const queryParam = urlObj.searchParams.get('q');
      expect(queryParam).not.toBeNull();
      const decodedQuery = rison.decode(queryParam!) as Record<string, any>;

      // Every call should have the custom tag filter
      expect(decodedQuery.filters).toContainEqual({
        col: 'type',
        opr: 'custom_tag',
        value: true,
      });
    });
  });

  test('maintains correct order specification', async () => {
    fetchMock.get('glob:*/api/v1/tag/*', {
      result: [],
      count: 0,
    });

    await loadTags('test', 0, 25);

    const calls = fetchMock.calls();
    const [url] = calls[0];
    const urlObj = new URL(url);
    const queryParam = urlObj.searchParams.get('q');
    expect(queryParam).not.toBeNull();
    const decodedQuery = rison.decode(queryParam!) as Record<string, any>;

    // Should always order by name ascending
    expect(decodedQuery.order_column).toBe('name');
    expect(decodedQuery.order_direction).toBe('asc');
  });
});
