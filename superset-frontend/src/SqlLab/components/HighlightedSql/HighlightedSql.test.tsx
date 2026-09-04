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
import { isValidElement } from 'react';

import HighlightedSql from 'src/SqlLab/components/HighlightedSql';
import { fireEvent, render } from 'spec/helpers/testing-library';

const sql =
  "SELECT * FROM test WHERE something='fkldasjfklajdslfkjadlskfjkldasjfkladsjfkdjsa'";
test('renders HighlightedSql component with sql prop', () => {
  expect(isValidElement(<HighlightedSql sql={sql} />)).toBe(true);
});
test('renders a ModalTrigger component', () => {
  const { getByTestId } = render(<HighlightedSql sql={sql} />);
  expect(getByTestId('span-modal-trigger')).toBeInTheDocument();
});
test('renders a ModalTrigger component with shrink prop and maxWidth prop set to 20', () => {
  const { getByTestId } = render(
    <HighlightedSql sql={sql} shrink maxWidth={20} />,
  );
  expect(getByTestId('span-modal-trigger')).toBeInTheDocument();
});
test('renders single SQL block with no tabs when rawSql equals sql', () => {
  const { queryByRole, getByTestId, queryByText } = render(
    <HighlightedSql sql={sql} rawSql={sql} shrink maxWidth={5} />,
  );
  expect(queryByRole('dialog')).not.toBeInTheDocument();
  fireEvent.click(getByTestId('span-modal-trigger'));
  expect(queryByRole('dialog')).toBeInTheDocument();
  expect(queryByText('Executed SQL')).not.toBeInTheDocument();
  expect(queryByText('Source SQL')).toBeInTheDocument();
});

test('renders tabs when rawSql differs from sql', () => {
  const { queryByRole, getByTestId, getByText } = render(
    <HighlightedSql sql={sql} rawSql="SELECT * FROM foo" shrink maxWidth={5} />,
  );
  expect(queryByRole('dialog')).not.toBeInTheDocument();
  fireEvent.click(getByTestId('span-modal-trigger'));
  expect(queryByRole('dialog')).toBeInTheDocument();
  expect(getByText('Executed SQL')).toBeInTheDocument();
  expect(getByText('Source SQL')).toBeInTheDocument();
});

test('renders tabs when rawSql has an added LIMIT', () => {
  const { queryByRole, getByTestId, getByText } = render(
    <HighlightedSql
      sql={sql}
      rawSql={`${sql} LIMIT 1000`}
      shrink
      maxWidth={5}
    />,
  );
  expect(queryByRole('dialog')).not.toBeInTheDocument();
  fireEvent.click(getByTestId('span-modal-trigger'));
  expect(queryByRole('dialog')).toBeInTheDocument();
  expect(getByText('Executed SQL')).toBeInTheDocument();
  expect(getByText('Source SQL')).toBeInTheDocument();
});
