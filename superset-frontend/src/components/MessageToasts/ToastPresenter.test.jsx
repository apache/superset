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
import { fireEvent, render, waitFor } from 'spec/helpers/testing-library';

import ToastPresenter from 'src/components/MessageToasts/ToastPresenter';
import mockMessageToasts from './mockMessageToasts';

const props = {
  toasts: mockMessageToasts,
  removeToast() {},
};

function setup(overrideProps) {
  return render(<ToastPresenter {...props} {...overrideProps} />);
}

test('should render a div with id toast-presenter', () => {
  const { container } = setup();
  expect(container.querySelector('#toast-presenter')).toBeInTheDocument();
});

test('should render a Toast for each toast object', () => {
  const { getAllByRole } = setup();
  expect(getAllByRole('alert')).toHaveLength(props.toasts.length);
});

test('should pass removeToast to the Toast component', async () => {
  const removeToast = jest.fn();
  const { getAllByTestId } = setup({ removeToast });
  fireEvent.click(getAllByTestId('close-button')[0]);
  await waitFor(() => expect(removeToast).toHaveBeenCalledTimes(1));
});
