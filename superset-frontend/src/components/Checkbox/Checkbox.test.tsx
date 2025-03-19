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
import { fireEvent, render } from 'spec/helpers/testing-library';

import Checkbox from 'src/components/Checkbox';

jest.mock('src/components/Checkbox/CheckboxIcons', () => ({
  CheckboxChecked: () => <div data-test="mock-CheckboxChecked" />,
  CheckboxUnchecked: () => <div data-test="mock-CheckboxUnchecked" />,
}));

describe('when unchecked', () => {
  test('renders the unchecked component', () => {
    const { getByTestId } = render(
      <Checkbox style={{}} checked={false} onChange={() => true} />,
    );
    expect(getByTestId('mock-CheckboxUnchecked')).toBeInTheDocument();
  });
});

describe('when checked', () => {
  test('renders the checked component', () => {
    const { getByTestId } = render(
      <Checkbox style={{}} checked onChange={() => true} />,
    );
    expect(getByTestId('mock-CheckboxChecked')).toBeInTheDocument();
  });
});

test('works with an onChange handler', () => {
  const mockAction = jest.fn();
  const { getByRole } = render(
    <Checkbox style={{}} checked={false} onChange={mockAction} />,
  );
  fireEvent.click(getByRole('checkbox'));
  expect(mockAction).toHaveBeenCalled();
});

test('renders custom Checkbox styles without melting', () => {
  const { getByRole } = render(
    <Checkbox onChange={() => true} checked={false} style={{ opacity: 1 }} />,
  );
  expect(getByRole('checkbox')).toBeInTheDocument();
  expect(getByRole('checkbox')).toHaveStyle({ opacity: 1 });
});
