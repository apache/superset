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
import {
  emptyQueryResults,
  clearQueryEditors,
} from 'src/SqlLab/utils/reduxStateToLocalStorageHelper';
import { LOCALSTORAGE_MAX_QUERY_AGE_MS } from 'src/SqlLab/constants';
import { queries, defaultQueryEditor } from '../fixtures';

jest.mock('src/SqlLab/constants', () => ({
  ...jest.requireActual('src/SqlLab/constants'),
  LOCALSTORAGE_MAX_QUERY_RESULTS_KB: 1,
}));

describe('reduxStateToLocalStorageHelper', () => {
  const queriesObj = {};
  beforeEach(() => {
    queries.forEach(q => {
      queriesObj[q.id] = q;
    });
  });

  it('should empty query.results if query.startDttm is > LOCALSTORAGE_MAX_QUERY_AGE_MS', () => {
    // make sure sample data contains old query
    const oldQuery = queries[0];
    const { id, startDttm } = oldQuery;
    expect(Date.now() - startDttm).toBeGreaterThan(
      LOCALSTORAGE_MAX_QUERY_AGE_MS,
    );
    expect(Object.keys(oldQuery.results)).toContain('data');

    const emptiedQuery = emptyQueryResults(queriesObj);
    expect(emptiedQuery[id].startDttm).toBe(startDttm);
    expect(emptiedQuery[id].results).toEqual({});
  });

  it('should empty query.results if query,.results size is greater than LOCALSTORAGE_MAX_QUERY_RESULTS_KB', () => {
    const reasonableSizeQuery = {
      ...queries[0],
      startDttm: Date.now(),
      results: { data: [{ a: 1 }] },
    };
    const largeQuery = {
      ...queries[1],
      startDttm: Date.now(),
      results: {
        data: [
          {
            test: 1123123123123,
            stringValue:
              'Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industrys standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book. It has survived not only five centuries, but also the leap into electronic typesetting, remaining essentially unchanged. It was popularised in the 1960s with the release of Letraset sheets containing Lorem Ipsum passages, and more recently with desktop publishing software like Aldus PageMaker including versions of Lorem Ipsum',
            jsonValue:
              '{"a":1234234234234234,"b":21234123412341234,"c":31234123412341234,"str":"something long text goes here"}',
          },
        ],
      },
    };
    expect(Object.keys(largeQuery.results)).toContain('data');
    const emptiedQuery = emptyQueryResults({
      [reasonableSizeQuery.id]: reasonableSizeQuery,
      [largeQuery.id]: largeQuery,
    });
    expect(emptiedQuery[largeQuery.id].results).toEqual({});
    expect(emptiedQuery[reasonableSizeQuery.id].results).toEqual(
      reasonableSizeQuery.results,
    );
  });

  it('should only return selected keys for query editor', () => {
    const queryEditors = [defaultQueryEditor];
    expect(Object.keys(queryEditors[0])).toContain('schemaOptions');

    const clearedQueryEditors = clearQueryEditors(queryEditors);
    expect(Object.keys(clearedQueryEditors)[0]).not.toContain('schemaOptions');
  });
});
