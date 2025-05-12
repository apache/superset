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
import { screen, render, within } from '@testing-library/react';
import { TooltipTable } from '@superset-ui/core';
import { CSSProperties } from 'react';

describe('TooltipTable', () => {
  it('sets className', () => {
    const { container } = render(
      <TooltipTable className="test-class" data={[]} />,
    );
    expect(container.querySelector('.test-class')).toBeInTheDocument();
  });

  it('renders empty table', () => {
    render(<TooltipTable data={[]} />);
    const table = screen.getByRole('table');
    expect(table).toBeInTheDocument();
    const rows = within(table).queryAllByRole('row');
    expect(rows.length).toBe(1);
    expect(rows[0]).toHaveTextContent(/No Data|empty/i);
  });

  it('renders table with content', async () => {
    const data = [
      {
        key: 'Cersei',
        keyColumn: 'Cersei',
        keyStyle: { padding: '10' },
        valueColumn: 2,
        valueStyle: { textAlign: 'right' as CSSProperties['textAlign'] },
      },
      {
        key: 'Jaime',
        keyColumn: 'Jaime',
        keyStyle: { padding: '10' },
        valueColumn: 1,
        valueStyle: { textAlign: 'right' as CSSProperties['textAlign'] },
      },
      { key: 'Tyrion', keyStyle: { padding: '10' }, valueColumn: 2 },
    ];

    render(<TooltipTable data={data} />);

    await Promise.all(
      data.map(async ({ keyColumn, key, valueColumn }) => {
        const keyText = keyColumn ?? key;
        const keyCell = await screen.findByText(keyText);
        expect(keyCell).toBeInTheDocument();

        const row = keyCell.closest('tr');
        expect(row).toBeInTheDocument();

        const cells = within(row!).getAllByRole('cell');
        expect(cells[0]).toHaveTextContent(String(keyText));
        expect(cells[1]).toHaveTextContent(String(valueColumn));
      }),
    );
  });
});
