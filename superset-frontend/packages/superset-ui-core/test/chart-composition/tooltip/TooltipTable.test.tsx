/*
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

import '@testing-library/jest-dom';
import { screen, render } from '@testing-library/react';
import { TooltipTable } from '@superset-ui/core';

describe('TooltipTable', () => {
  it('sets className', () => {
    const { container } = render(<TooltipTable className="test-class" />);
    expect(container.querySelector('[class="test-class"]')).toBeInTheDocument();
  });

  it('renders empty table', () => {
    const { container } = render(<TooltipTable />);
    expect(container.querySelector('tbody')).toBeInTheDocument();
    expect(container.querySelector('tr')).not.toBeInTheDocument();
  });

  it('renders table with content', async () => {
    render(
      <TooltipTable
        data={[
          {
            key: 'Cersei',
            keyColumn: 'Cersei',
            keyStyle: { padding: '10' },
            valueColumn: 2,
            valueStyle: { textAlign: 'right' },
          },
          {
            key: 'Jaime',
            keyColumn: 'Jaime',
            keyStyle: { padding: '10' },
            valueColumn: 1,
            valueStyle: { textAlign: 'right' },
          },
          {
            key: 'Tyrion',
            keyStyle: { padding: '10' },
            valueColumn: 2,
          },
        ]}
      />,
    );
    let keyCell;
    let valueCell;

    keyCell = await screen.findByText('Cersei');
    valueCell = keyCell?.nextSibling as HTMLElement;
    expect(keyCell).toBeInTheDocument();
    expect(valueCell?.textContent).toEqual('2');
    expect(valueCell?.getAttribute('style')).toEqual(
      'padding-left: 8px; text-align: right;',
    );

    keyCell = await screen.findByText('Jaime');
    valueCell = keyCell?.nextSibling as HTMLElement;
    expect(keyCell).toBeInTheDocument();
    expect(valueCell?.textContent).toEqual('1');
    expect(valueCell?.getAttribute('style')).toEqual(
      'padding-left: 8px; text-align: right;',
    );

    keyCell = await screen.findByText('Tyrion');
    valueCell = keyCell?.nextSibling as HTMLElement;
    expect(keyCell).toBeInTheDocument();
    expect(valueCell?.textContent).toEqual('2');
    expect(valueCell?.getAttribute('style')).toEqual(
      'padding-left: 8px; text-align: right;',
    );
  });
});
