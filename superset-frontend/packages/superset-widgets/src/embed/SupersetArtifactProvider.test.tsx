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
import { render, screen, waitFor } from 'spec/helpers/testing-library';
import { useWidgetDataClient } from '../dataClient';
import { SupersetArtifactProvider } from './SupersetArtifactProvider';

function ClientProbe() {
  const client = useWidgetDataClient();
  return <div data-test="probe">{typeof client.fetchData}</div>;
}

test('explains itself when the page cannot use connectors', () => {
  render(
    <SupersetArtifactProvider server="Superset" mcp={null}>
      <ClientProbe />
    </SupersetArtifactProvider>,
  );

  expect(screen.getByRole('status')).toHaveTextContent(
    'Superset widgets need to run inside a Claude artifact that can use the Superset connector.',
  );
  expect(screen.queryByTestId('probe')).not.toBeInTheDocument();
});

test('provides an MCP data client to widgets when the runtime is available', async () => {
  const mcp = { callTool: jest.fn() };

  render(
    <SupersetArtifactProvider server="Superset" mcp={mcp}>
      <ClientProbe />
    </SupersetArtifactProvider>,
  );

  await waitFor(() =>
    expect(screen.getByTestId('probe')).toHaveTextContent('function'),
  );
});

test('resolves the runtime from window.claude and shows the fallback meanwhile', async () => {
  const mcp = { callTool: jest.fn() };
  let answer: (value: unknown) => void = () => {};
  const use = jest.fn(
    () =>
      new Promise(resolve => {
        answer = resolve;
      }),
  );
  (window as unknown as { claude?: unknown }).claude = { use };

  try {
    render(
      <SupersetArtifactProvider
        server="Superset"
        fallback={<div data-test="waiting">waiting</div>}
      >
        <ClientProbe />
      </SupersetArtifactProvider>,
    );

    expect(screen.getByTestId('waiting')).toBeInTheDocument();
    answer(mcp);
    await waitFor(() =>
      expect(screen.getByTestId('probe')).toBeInTheDocument(),
    );
    expect(use).toHaveBeenCalledWith('mcp');
  } finally {
    delete (window as unknown as { claude?: unknown }).claude;
  }
});
