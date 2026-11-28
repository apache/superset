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
import { render, screen } from 'spec/helpers/testing-library';
import { EmbeddedUiConfigProvider, useUiConfig } from '.';

const ShowDataFreshness = () => (
  <span>{String(useUiConfig().showDataFreshness)}</span>
);

const renderAt = (search: string, isEmbedded?: boolean) => {
  window.history.pushState({}, '', `/dashboard/1/${search}`);
  render(
    <EmbeddedUiConfigProvider isEmbedded={isEmbedded}>
      <ShowDataFreshness />
    </EmbeddedUiConfigProvider>,
  );
};

afterEach(() => {
  window.history.pushState({}, '', '/');
});

test('showDataFreshness is on outside the embedded app', () => {
  renderAt('');
  expect(screen.getByText('true')).toBeInTheDocument();
});

test('embedded hosts opt into showDataFreshness with bit 64', () => {
  renderAt('?uiConfig=1', true);
  expect(screen.getByText('false')).toBeInTheDocument();
});

test('embedded showDataFreshness is read from bit 64', () => {
  renderAt('?uiConfig=65', true);
  expect(screen.getByText('true')).toBeInTheDocument();
});
