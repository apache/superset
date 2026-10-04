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
import ContourPopoverControl from './ContourPopoverControl';

const color = { r: 255, g: 0, b: 255, a: 100 };

test('omits the unused upper threshold when saving an isoline', async () => {
  const onSave = jest.fn();
  render(
    <ContourPopoverControl
      value={{ lowerThreshold: 4, color, strokeWidth: 2, zIndex: 10 }}
      onSave={onSave}
    />,
  );

  await userEvent.click(screen.getByRole('button', { name: 'Save' }));

  const saved = onSave.mock.calls[0][0];
  expect(saved.upperThreshold).toBeUndefined();
  expect(JSON.parse(JSON.stringify(saved))).not.toHaveProperty(
    'upperThreshold',
  );
});

test('omits the unused stroke width when saving an isoband', async () => {
  const onSave = jest.fn();
  render(
    <ContourPopoverControl
      value={{ lowerThreshold: 6, upperThreshold: 10, color, zIndex: 20 }}
      onSave={onSave}
    />,
  );

  await userEvent.click(screen.getByRole('button', { name: 'Save' }));

  const saved = onSave.mock.calls[0][0];
  expect(saved.strokeWidth).toBeUndefined();
  expect(JSON.parse(JSON.stringify(saved))).not.toHaveProperty('strokeWidth');
});
