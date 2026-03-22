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
import { render, selectOption } from 'spec/helpers/testing-library';
import { CurrencyControl } from './CurrencyControl';

test('CurrencyControl renders position and symbol selects', () => {
  const { container } = render(
    <CurrencyControl onChange={jest.fn()} value={{}} />,
    {
      useRedux: true,
      initialState: {
        common: { currencies: ['USD', 'EUR'] },
        explore: { datasource: {} },
      },
    },
  );

  expect(
    container.querySelector('[data-test="currency-control-container"]'),
  ).toBeInTheDocument();
  expect(container.querySelectorAll('.ant-select')).toHaveLength(2);
});

test('CurrencyControl handles string currency value', async () => {
  const onChange = jest.fn();
  const { container } = render(
    <CurrencyControl
      onChange={onChange}
      value='{"symbol":"USD","symbolPosition":"prefix"}'
    />,
    {
      useRedux: true,
      initialState: {
        common: { currencies: ['USD', 'EUR'] },
        explore: { datasource: {} },
      },
    },
  );

  expect(
    container.querySelector('[data-test="currency-control-container"]'),
  ).toBeInTheDocument();

  await selectOption('Suffix', 'Currency prefix or suffix');
  expect(onChange).toHaveBeenLastCalledWith({
    symbol: 'USD',
    symbolPosition: 'suffix',
  });
});
