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
import Toast from 'src/components/MessageToasts/Toast';
import mockMessageToasts from './mockMessageToasts';

const props = {
  toast: mockMessageToasts[0],
  onCloseToast() {},
};

const setup = overrideProps => render(<Toast {...props} {...overrideProps} />);

test('should render', () => {
  const { getByTestId } = setup();
  expect(getByTestId('toast-container')).toBeInTheDocument();
});

test('should render toastText within the div', () => {
  const { getByTestId } = setup();
  expect(getByTestId('toast-container')).toHaveTextContent(props.toast.text);
});

test('should call onCloseToast upon toast dismissal', async () => {
  const onCloseToast = jest.fn();
  const { getByTestId } = setup({ onCloseToast });
  fireEvent.click(getByTestId('close-button'));
  await waitFor(() => expect(onCloseToast).toHaveBeenCalledTimes(1));
  expect(onCloseToast).toHaveBeenCalledWith(props.toast.id);
});
