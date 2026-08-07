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
  fireEvent,
  render,
  screen,
  selectOption,
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import { JsonForms } from '@jsonforms/react';
import type { JsonSchema } from '@jsonforms/core';
import { cellRegistryEntries } from '@great-expectations/jsonforms-antd-renderers';
import { renderers, buildUiSchema, sanitizeSchema } from './jsonFormsHelpers';

/**
 * Real-render smoke test for @great-expectations/jsonforms-antd-renderers.
 *
 * The package has NO antd 6 release — it is pinned onto antd 6 via a
 * package.json override — and it renders forms from runtime schemas, so a
 * breaking antd change in its renderers is invisible to TypeScript. The
 * SemanticLayerModal tests mock <JsonForms /> away, leaving this the only
 * coverage that the vendor's renderers actually mount against antd 6.
 * Renders exactly the way the modal does (same renderers, cells, and
 * uischema builder).
 */

const schema = sanitizeSchema({
  type: 'object',
  properties: {
    account: {
      type: 'string',
      title: 'Account',
    },
    warehouse: {
      type: 'string',
      title: 'Warehouse',
      enum: ['wh_small', 'wh_large'],
    },
    use_ssl: {
      type: 'boolean',
      title: 'Use SSL',
    },
    port: {
      type: 'number',
      title: 'Port',
    },
  },
  required: ['account'],
} as JsonSchema);

const setup = (data: Record<string, unknown> = {}) => {
  const onChange = jest.fn();
  render(
    <JsonForms
      schema={schema}
      uischema={buildUiSchema(schema)}
      data={data}
      renderers={renderers}
      cells={cellRegistryEntries}
      validationMode="ValidateAndHide"
      onChange={onChange}
    />,
  );
  return onChange;
};

test('renders string, enum, boolean, and number controls from a schema', () => {
  setup();

  // string + number → real inputs with their schema titles as labels
  expect(screen.getByLabelText('Account')).toBeInTheDocument();
  expect(screen.getByLabelText('Port')).toBeInTheDocument();
  // enum → an antd select (combobox role)
  expect(screen.getByRole('combobox', { name: 'Warehouse' })).toBeVisible();
  // boolean control renders with its title
  expect(screen.getByText('Use SSL')).toBeInTheDocument();
});

test('typing into a text control propagates through onChange', async () => {
  const onChange = setup();

  const input = screen.getByLabelText('Account');
  await userEvent.type(input, 'acme');
  // commit the value; avoid userEvent.tab() — the vendor's checkbox id
  // ("#/properties/use_ssl-input") breaks nwsapi's focusable-element scan
  fireEvent.blur(input);
  await waitFor(() =>
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ account: 'acme' }),
      }),
    ),
  );
});

test('enum control opens an antd 6 dropdown and selects an option', async () => {
  const onChange = setup();

  await selectOption('wh_large', 'Warehouse');

  await waitFor(() =>
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ warehouse: 'wh_large' }),
      }),
    ),
  );
});
