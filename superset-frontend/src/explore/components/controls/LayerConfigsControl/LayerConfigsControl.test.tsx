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
import LayerConfigsControl from './LayerConfigsControl';
import { LayerConf } from './types';

const wms = (title: string, url: string): LayerConf => ({
  type: 'WMS',
  version: '1.3.0',
  title,
  url,
  layersParam: 'roads',
});

const existing = [wms('Roads', 'https://maps.example.com/wms')];

const setup = (value?: LayerConf[]) => {
  const onChange = jest.fn();
  render(
    <LayerConfigsControl
      name="layer_configs"
      label="Layers"
      value={value}
      onChange={onChange}
    />,
  );
  return { onChange };
};

test('renders the label and the add button', () => {
  setup([]);
  expect(screen.getByText('Layers')).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: /Click to add new layer/ }),
  ).toBeInTheDocument();
});

test('lists each configured layer with its type and title', () => {
  setup([...existing, wms('Rivers', 'https://x.example.com')]);
  expect(screen.getAllByRole('button', { name: 'WMS' })).toHaveLength(2);
  expect(screen.getByRole('button', { name: 'Roads' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Rivers' })).toBeInTheDocument();
});

test('removing a layer emits the list without it', async () => {
  const { onChange } = setup([
    wms('Roads', 'https://a.example.com'),
    wms('Rivers', 'https://b.example.com'),
  ]);
  const [removeRoads] = screen.getAllByRole('button', { name: /close/i });
  await userEvent.click(removeRoads);
  expect(onChange).toHaveBeenCalledWith([
    wms('Rivers', 'https://b.example.com'),
  ]);
});

test('adding a layer opens the form and prepends the saved layer', async () => {
  const { onChange } = setup(existing);
  await userEvent.click(
    screen.getByRole('button', { name: /Click to add new layer/ }),
  );
  expect(await screen.findByText('Add Layer')).toBeInTheDocument();

  await userEvent.type(
    screen.getByPlaceholderText('Insert Layer URL'),
    'https://new.example.com/wms',
  );
  await userEvent.type(
    screen.getByPlaceholderText('Insert Layer title'),
    'Parcels',
  );
  await userEvent.type(screen.getByPlaceholderText('Layer Name'), 'parcels');
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));

  expect(onChange).toHaveBeenCalledTimes(1);
  expect(onChange).toHaveBeenCalledWith([
    {
      type: 'WMS',
      version: '1.3.0',
      title: 'Parcels',
      url: 'https://new.example.com/wms',
      layersParam: 'parcels',
      attribution: undefined,
    },
    ...existing,
  ]);
});

test('editing a layer prefills the form and replaces the layer in place', async () => {
  const { onChange } = setup([
    wms('Roads', 'https://a.example.com'),
    wms('Rivers', 'https://b.example.com'),
  ]);
  await userEvent.click(screen.getByRole('button', { name: 'Rivers' }));
  const title = await screen.findByPlaceholderText('Insert Layer title');
  expect(title).toHaveValue('Rivers');

  await userEvent.clear(title);
  await userEvent.type(title, 'Lakes');
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));

  expect(onChange).toHaveBeenCalledTimes(1);
  const saved = onChange.mock.calls[0][0];
  expect(saved).toHaveLength(2);
  expect(saved[0].title).toBe('Roads');
  expect(saved[1]).toMatchObject({
    title: 'Lakes',
    url: 'https://b.example.com',
  });
});

test('closing the form does not emit a change', async () => {
  const { onChange } = setup(existing);
  await userEvent.click(
    screen.getByRole('button', { name: /Click to add new layer/ }),
  );
  await screen.findByText('Add Layer');
  await userEvent.click(screen.getByRole('button', { name: 'Close' }));
  expect(onChange).not.toHaveBeenCalled();
});
