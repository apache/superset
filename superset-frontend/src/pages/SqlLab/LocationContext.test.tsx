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
import { MemoryRouter } from 'react-router-dom';
import { render, screen } from 'spec/helpers/testing-library';

import { LocationProvider, useLocationState } from './LocationContext';

const Probe = () => {
  const { requestedQuery } = useLocationState();
  return (
    <>
      <span data-test="autorun">{String(requestedQuery?.autorun)}</span>
      <span data-test="sql">{String(requestedQuery?.sql)}</span>
    </>
  );
};

const setup = (initialEntry: string | { pathname: string; state: object }) =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <LocationProvider>
        <Probe />
      </LocationProvider>
    </MemoryRouter>,
  );

test('never derives autorun from the URL querystring', () => {
  // Regression test: a crafted cross-site GET link must not be able to
  // auto-execute SQL in the victim's session (top-level navigation sends
  // SameSite=Lax session cookies).
  setup('/sqllab?dbid=1&sql=SELECT%20%2A%20FROM%20t&autorun=true');
  expect(screen.getByTestId('autorun')).toHaveTextContent('false');
  // The deep link still prefills the editor with the requested SQL.
  expect(screen.getByTestId('sql')).toHaveTextContent('SELECT * FROM t');
});

test('querystring autorun stays false even when spread from raw params', () => {
  // `...Object.fromEntries(queryParams)` must not reintroduce the raw
  // `autorun` string value.
  setup('/sqllab?sql=SELECT%201&autorun=true');
  expect(screen.getByTestId('autorun')).toHaveTextContent('false');
});

test('honors autorun from in-app location.state navigations', () => {
  setup({
    pathname: '/sqllab',
    state: { requestedQuery: { sql: 'SELECT 1', autorun: true } },
  });
  expect(screen.getByTestId('autorun')).toHaveTextContent('true');
});
