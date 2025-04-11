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
test('renders two code elements in modal when rawSql prop is provided', () => {
  const { getByRole, queryByRole, getByTestId } = render(
    <HighlightedSql sql={sql} rawSql="SELECT * FORM foo" shrink maxWidth={5} />,
  );
  expect(queryByRole('dialog')).not.toBeInTheDocument();
  fireEvent.click(getByTestId('span-modal-trigger'));
  expect(queryByRole('dialog')).toBeInTheDocument();
  const codeElements = getByRole('dialog').getElementsByTagName('code');
  expect(codeElements.length).toEqual(2);
});
