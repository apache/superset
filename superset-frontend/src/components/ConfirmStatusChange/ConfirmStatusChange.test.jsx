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
import Button from 'src/components/Button';
import ConfirmStatusChange from 'src/components/ConfirmStatusChange';

const mockedProps = {
  title: 'please confirm',
  description: 'are you sure?',
  onConfirm: jest.fn(),
};

test('opens a confirm modal', () => {
  const { getByTestId } = render(
    <ConfirmStatusChange {...mockedProps}>
      {confirm => (
        <>
          <Button data-test="btn1" onClick={confirm} />
        </>
      )}
    </ConfirmStatusChange>,
  );

  fireEvent.click(getByTestId('btn1'));

  expect(getByTestId(`${mockedProps.title}-modal`)).toBeInTheDocument();
});

test('calls the function on confirm', async () => {
  const { getByTestId, getByRole } = render(
    <ConfirmStatusChange {...mockedProps}>
      {confirm => (
        <>
          <Button data-test="btn1" onClick={() => confirm('foo')} />
        </>
      )}
    </ConfirmStatusChange>,
  );

  fireEvent.click(getByTestId('btn1'));

  const confirmInput = getByTestId('delete-modal-input');
  fireEvent.change(confirmInput, { target: { value: 'DELETE' } });

  const confirmButton = getByRole('button', { name: 'Delete' });
  fireEvent.click(confirmButton);

  await waitFor(() => expect(mockedProps.onConfirm).toHaveBeenCalledTimes(1));
  expect(mockedProps.onConfirm).toHaveBeenCalledWith('foo');
});
