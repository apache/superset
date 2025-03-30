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

describe('when unchecked', () => {
  test('renders the unchecked component', () => {
    const { getByRole } = render(<Checkbox checked={false} onChange={() => true} />);

    const checkboxInput = getByRole('checkbox');

    expect(checkboxInput).toBeInTheDocument();
    expect(checkboxInput).not.toBeChecked();
  });
});

describe('when checked', () => {
  test('renders the checked component', () => {
    const { getByRole } = render(<Checkbox checked={true} onChange={() => true} />);

    const checkboxInput = getByRole('checkbox');

    expect(checkboxInput).toBeInTheDocument();
    expect(checkboxInput).toBeChecked();
  });
});

describe('interaction', () => {
  test('calls onChange handler when clicked', () => {
    const mockAction = jest.fn();
    const { getByRole } = render(<Checkbox checked={false} onChange={mockAction} />);

    const checkboxInput = getByRole('checkbox');
    fireEvent.click(checkboxInput);

    expect(mockAction).toHaveBeenCalled();
  });
});
