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
import { render, screen, userEvent } from 'spec/helpers/testing-library';
import SSHTunnelSwitch from './SSHTunnelSwitch';
import { DatabaseForm, DatabaseObject } from '../types';

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  isFeatureEnabled: jest.fn().mockReturnValue(true),
}));

jest.mock('src/components/Switch', () => ({
  Switch: ({
    checked,
    onChange,
  }: {
    checked: boolean;
    onChange: (checked: boolean) => void;
  }) => (
    <button
      onClick={() => onChange(!checked)}
      aria-checked={checked}
      role="switch"
      type="button"
    >
      {checked ? 'ON' : 'OFF'}
    </button>
  ),
}));

const mockChangeMethods = {
  onParametersChange: jest.fn(),
};

const mockDbModel = {
  engine: 'mysql',
  engine_information: {
    disable_ssh_tunneling: false,
  },
} as DatabaseForm;

const defaultDb = {
  parameters: { ssh: false },
  ssh_tunnel: {},
  engine: 'mysql',
} as DatabaseObject;

afterEach(() => {
  jest.clearAllMocks();
});

test('Renders SSH Tunnel switch enabled by default and toggles its state', () => {
  render(
    <SSHTunnelSwitch
      changeMethods={mockChangeMethods}
      clearValidationErrors={jest.fn}
      db={defaultDb}
      dbModel={mockDbModel}
    />,
  );
  const switchButton = screen.getByRole('switch');
  expect(switchButton).toHaveTextContent('OFF');
  userEvent.click(switchButton);
  expect(mockChangeMethods.onParametersChange).toHaveBeenCalledWith({
    target: { type: 'toggle', name: 'ssh', checked: true, value: true },
  });
  expect(switchButton).toHaveTextContent('ON');
});

test('Does not render if SSH Tunnel is disabled', () => {
  render(
    <SSHTunnelSwitch
      changeMethods={mockChangeMethods}
      clearValidationErrors={jest.fn}
      db={defaultDb}
      dbModel={{
        ...mockDbModel,
        engine_information: {
          disable_ssh_tunneling: true,
          supports_file_upload: false,
          supports_dynamic_catalog: false,
        },
      }}
    />,
  );
  expect(screen.queryByRole('switch')).not.toBeInTheDocument();
});

test('Checks the switch based on db.parameters.ssh', () => {
  const dbWithSSHTunnelEnabled = {
    ...defaultDb,
    parameters: { ssh: true },
  } as DatabaseObject;
  render(
    <SSHTunnelSwitch
      changeMethods={mockChangeMethods}
      clearValidationErrors={jest.fn}
      db={dbWithSSHTunnelEnabled}
      dbModel={mockDbModel}
    />,
  );
  expect(screen.getByRole('switch')).toHaveTextContent('ON');
});

test('Calls onParametersChange with true if SSH Tunnel info exists', () => {
  const dbWithSSHTunnelInfo = {
    ...defaultDb,
    parameters: { ssh: undefined },
    ssh_tunnel: { host: 'example.com' },
  } as DatabaseObject;
  render(
    <SSHTunnelSwitch
      changeMethods={mockChangeMethods}
      clearValidationErrors={jest.fn}
      db={dbWithSSHTunnelInfo}
      dbModel={mockDbModel}
    />,
  );
  expect(mockChangeMethods.onParametersChange).toHaveBeenCalledWith({
    target: { type: 'toggle', name: 'ssh', checked: true, value: true },
  });
});

test('Displays tooltip text on hover over the InfoTooltip', async () => {
  const tooltipText = 'SSH Tunnel configuration parameters';
  render(
    <SSHTunnelSwitch
      changeMethods={mockChangeMethods}
      clearValidationErrors={jest.fn}
      db={defaultDb}
      dbModel={mockDbModel}
    />,
  );

  const infoTooltipTrigger = screen.getByRole('img', {
    name: 'info-solid_small',
  });
  expect(infoTooltipTrigger).toBeInTheDocument();

  userEvent.hover(infoTooltipTrigger);

  const tooltip = await screen.findByText(tooltipText);

  expect(tooltip).toBeInTheDocument();
});
