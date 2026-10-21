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
import { GenericDataType } from '@apache-superset/core/common';
import { render, screen } from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
import { ColumnConfig, ColumnConfigInfo } from './types';
import ColumnConfigControl from './ColumnConfigControl';

jest.mock('./ColumnConfigItem', () => ({
  __esModule: true,
  default: ({
    column,
    onChange,
  }: {
    column: ColumnConfigInfo;
    onChange: (config: ColumnConfig) => void;
  }) => (
    <button
      type="button"
      onClick={() => onChange({ ...column.config, columnWidth: 50 })}
    >
      Configure {column.name}
    </button>
  ),
}));

const columnsPropsObject = {
  colnames: ['Main revenue', '# revenue', 'region'],
  coltypes: [
    GenericDataType.Numeric,
    GenericDataType.Numeric,
    GenericDataType.String,
  ],
};

test('renders nothing without queried columns', () => {
  const { container } = render(
    <ColumnConfigControl name="column_config" value={{ region: {} }} />,
  );

  expect(container).toBeEmptyDOMElement();
});

test('keeps remapped Main column settings when another column is edited', async () => {
  const onChange = jest.fn();
  render(
    <ColumnConfigControl
      name="column_config"
      value={{
        'Principale revenue': { columnWidth: 300 },
        leftover: { d3NumberFormat: '.2f' },
      }}
      onChange={onChange}
      columnsPropsObject={columnsPropsObject}
    />,
  );

  expect(
    screen.getByRole('button', { name: 'Configure Main revenue' }),
  ).toBeInTheDocument();

  await userEvent.click(
    screen.getByRole('button', { name: 'Configure region' }),
  );

  expect(onChange).toHaveBeenCalledWith({
    'Main revenue': { columnWidth: 300 },
    region: { columnWidth: 50 },
  });
});
