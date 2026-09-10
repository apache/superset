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
import { render } from 'spec/helpers/testing-library';
import { JsonForms } from '@jsonforms/react';
import { cellRegistryEntries } from '@great-expectations/jsonforms-antd-renderers';
import { renderers } from 'src/features/semanticLayers/jsonFormsHelpers';
import { FormShell } from './PropsForm';

test('a bounded number keeps its slider and figure on one line', () => {
  render(
    <FormShell className="ant-form ant-form-vertical">
      <JsonForms
        schema={{
          type: 'object',
          properties: {
            decimalPlaces: { type: 'number', minimum: 0, maximum: 5 },
          },
        }}
        data={{ decimalPlaces: 0 }}
        renderers={renderers}
        cells={cellRegistryEntries}
        validationMode="NoValidation"
        onChange={() => {}}
      />
    </FormShell>,
  );

  // The one-column rule is aimed at an array entry's own fields (see
  // `FormShell`'s doc comment) — a lone bounded number's Slider/figure pair
  // must not be caught by it and forced onto two full-width lines.
  const row = document.querySelector(
    '.ant-row:not(.ant-form-item-row)',
  ) as HTMLElement;
  expect(row).not.toHaveStyle({ flexDirection: 'column' });
});
