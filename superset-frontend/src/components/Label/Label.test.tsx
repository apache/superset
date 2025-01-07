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

import Label from '.';
import { LabelGallery, options } from './Label.stories';

// test the basic component
test('renders the base component (no onClick)', () => {
  const { container } = render(<Label />);
  expect(container).toBeInTheDocument();
});

test('works with an onClick handler', () => {
  const mockAction = jest.fn();
  const { getByText } = render(<Label onClick={mockAction}>test</Label>);
  fireEvent.click(getByText('test'));
  expect(mockAction).toHaveBeenCalled();
});

// test stories from the storybook!
test('renders all the storybook gallery variants', () => {
  const { container } = render(<LabelGallery />);
  const nonInteractiveLabelCount = 4;
  const renderedLabelCount = options.length * 2 + nonInteractiveLabelCount;
  expect(container.querySelectorAll('.ant-tag')).toHaveLength(
    renderedLabelCount,
  );
});
