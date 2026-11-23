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

import { commands } from './index';

const held: { dispose: () => void }[] = [];

afterEach(() => {
  held.forEach(d => d.dispose());
  held.length = 0;
});

test('a registered command is retrievable and executable', () => {
  const run = jest.fn(() => 'done');
  held.push(
    commands.registerCommand(
      { id: 'acme.one', title: 'One', description: '' },
      run,
    ),
  );

  expect(commands.getCommand('acme.one')).toMatchObject({ title: 'One' });
  expect(commands.getCommands().map(c => c.id)).toContain('acme.one');
});

test('executing an unregistered command rejects rather than resolving', async () => {
  await expect(commands.executeCommand('acme.nope')).rejects.toThrow(
    /not found/,
  );
});

test('disposing removes the command', () => {
  const d = commands.registerCommand(
    { id: 'acme.two', title: 'Two', description: '' },
    () => undefined,
  );
  d.dispose();

  expect(commands.getCommand('acme.two')).toBeUndefined();
});
