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
import { render, screen, userEvent } from 'spec/helpers/testing-library';
import SSHTunnelForm from './SSHTunnelForm';

test('identifies a private key error on the private key textarea', async () => {
  render(
    <SSHTunnelForm
      db={null}
      onSSHTunnelParametersChange={jest.fn()}
      setSSHTunnelLoginMethod={jest.fn()}
      validationErrors={{
        ssh_tunnel: { private_key: 'Private key is required' },
      }}
      getValidation={jest.fn()}
    />,
  );

  await userEvent.click(screen.getByText('Private Key & Password'));

  const privateKey = screen.getByPlaceholderText('Paste Private Key here');
  expect(privateKey).toHaveAttribute('aria-invalid', 'true');
  const error = document.getElementById(
    privateKey.getAttribute('aria-describedby') ?? '',
  );
  expect(error).toHaveAttribute('role', 'alert');
  expect(error).toHaveTextContent('Private key is required');
});

test('does not mark the private key textarea invalid without an error', async () => {
  render(
    <SSHTunnelForm
      db={null}
      onSSHTunnelParametersChange={jest.fn()}
      setSSHTunnelLoginMethod={jest.fn()}
      getValidation={jest.fn()}
    />,
  );

  await userEvent.click(screen.getByText('Private Key & Password'));

  const privateKey = screen.getByPlaceholderText('Paste Private Key here');
  expect(privateKey).not.toHaveAttribute('aria-invalid');
  expect(privateKey).not.toHaveAttribute('aria-describedby');
});
