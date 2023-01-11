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
import React from 'react';
import { render, screen } from 'spec/helpers/testing-library';
import QueryHistory from 'src/SqlLab/components/QueryHistory';

const mockedProps = {
  queries: [],
  displayLimit: 1000,
  latestQueryId: 'yhMUZCGb',
};

const setup = (overrides = {}) => (
  <QueryHistory {...mockedProps} {...overrides} />
);

describe('QueryHistory', () => {
  it('Renders an empty state for query history', () => {
    render(setup());

    const emptyStateText = screen.getByText(
      /run a query to display query history/i,
    );

    expect(emptyStateText).toBeVisible();
  });
});
