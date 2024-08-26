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

import NewDivider from 'src/dashboard/components/gridComponents/new/NewDivider';

import { NEW_DIVIDER_ID } from 'src/dashboard/util/constants';
import { DIVIDER_TYPE } from 'src/dashboard/util/componentTypes';

jest.mock(
  'src/dashboard/components/gridComponents/new/DraggableNewComponent',
  () =>
    ({ type, id }) => (
      <div data-test="mock-draggable-new-component">{`${type}:${id}`}</div>
    ),
);

function setup() {
  return render(<NewDivider />);
}

test('should render a DraggableNewComponent', () => {
  const { getByTestId } = setup();
  expect(getByTestId('mock-draggable-new-component')).toBeInTheDocument();
});

test('should set appropriate type and id', () => {
  const { getByTestId } = setup();
  expect(getByTestId('mock-draggable-new-component')).toHaveTextContent(
    `${DIVIDER_TYPE}:${NEW_DIVIDER_ID}`,
  );
});
