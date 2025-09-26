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
import isInDifferentFilterScopes from './isInDifferentFilterScopes';

test('returns false when no dashboard filters are provided', () => {
  const result = isInDifferentFilterScopes({
    dashboardFilters: {},
    source: ['tab1', 'tab2'],
    destination: ['tab2', 'tab3'],
  });

  expect(result).toBe(false);
});

test('returns false when source and destination are in same filter scopes', () => {
  const dashboardFilters = {
    filter1: {
      chartId: 123,
      scopes: {
        column1: {
          scope: ['tab1', 'tab2'],
        },
        column2: {
          scope: ['tab3', 'tab4'],
        },
      },
    },
  };

  const result = isInDifferentFilterScopes({
    dashboardFilters,
    source: ['tab1'],
    destination: ['tab1'],
  });

  expect(result).toBe(false);
});

test('returns true when source and destination are in different filter scopes', () => {
  const dashboardFilters = {
    filter1: {
      chartId: 123,
      scopes: {
        column1: {
          scope: ['tab1', 'tab2'],
        },
      },
    },
  };

  const result = isInDifferentFilterScopes({
    dashboardFilters,
    source: ['tab1'],
    destination: ['tab3'],
  });

  expect(result).toBe(true);
});

test('returns true when one is in scope and the other is not', () => {
  const dashboardFilters = {
    filter1: {
      chartId: 123,
      scopes: {
        column1: {
          scope: ['tab1'],
        },
      },
    },
  };

  const result = isInDifferentFilterScopes({
    dashboardFilters,
    source: ['tab1'], // in scope
    destination: ['tab2'], // not in scope
  });

  expect(result).toBe(true);
});

test('handles multiple filters with complex scopes', () => {
  const dashboardFilters = {
    filter1: {
      chartId: 123,
      scopes: {
        column1: {
          scope: ['tab1', 'tab2'],
        },
        column2: {
          scope: ['tab3'],
        },
      },
    },
    filter2: {
      chartId: 456,
      scopes: {
        column1: {
          scope: ['tab2', 'tab4'],
        },
      },
    },
  };

  const result = isInDifferentFilterScopes({
    dashboardFilters,
    source: ['tab1'],
    destination: ['tab4'],
  });

  expect(result).toBe(true);
});

test('handles empty source and destination arrays', () => {
  const dashboardFilters = {
    filter1: {
      chartId: 123,
      scopes: {
        column1: {
          scope: ['tab1'],
        },
      },
    },
  };

  const result = isInDifferentFilterScopes({
    dashboardFilters,
    source: [],
    destination: [],
  });

  expect(result).toBe(false);
});

test('uses default parameters when not provided', () => {
  const result = isInDifferentFilterScopes({});

  expect(result).toBe(false);
});

test('returns true when source and destination have different presence in filter scopes', () => {
  const dashboardFilters = {
    filter1: {
      chartId: 123,
      scopes: {
        column1: {
          scope: ['tab1', 'tab2', 'tab3'],
        },
      },
    },
  };

  const result = isInDifferentFilterScopes({
    dashboardFilters,
    source: ['tab1', 'tab2'],
    destination: ['tab2', 'tab3'],
  });

  // tab1 is in source but not destination, tab3 is in destination but not source
  expect(result).toBe(true);
});

test('returns false when both source and destination contain same tabs', () => {
  const dashboardFilters = {
    filter1: {
      chartId: 123,
      scopes: {
        column1: {
          scope: ['tab1', 'tab2'],
        },
      },
    },
  };

  const result = isInDifferentFilterScopes({
    dashboardFilters,
    source: ['tab1'],
    destination: ['tab1'],
  });

  expect(result).toBe(false);
});
