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
import KeyboardShortcutButton, { KEY_MAP } from '.';

test('renders shortcut description', () => {
  const { getByText, getByRole } = render(
    <KeyboardShortcutButton>Show shortcuts</KeyboardShortcutButton>,
  );
  fireEvent.click(getByRole('button'));
  expect(getByText('Keyboard shortcuts')).toBeInTheDocument();
  Object.keys(KEY_MAP)
    .filter(key => Boolean(KEY_MAP[key]))
    .forEach(key => {
      expect(getByText(key)).toBeInTheDocument();
    });
});
