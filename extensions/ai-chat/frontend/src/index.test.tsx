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
import { __testing } from '../test/coreMock';

test('evaluating the entry module registers the chat contribution', () => {
  __testing.reset();
  expect(__testing.state.registered).toBeNull();
  // Evaluate the entry module in the same module registry as this test so
  // it registers against the same core mock instance.
  // eslint-disable-next-line global-require
  require('./index');
  expect(__testing.state.registered).not.toBeNull();
  expect(__testing.state.registered?.chat.id).toBe('apache-superset.ai-chat');
  expect(typeof __testing.state.registered?.trigger).toBe('function');
  expect(typeof __testing.state.registered?.panel).toBe('function');
});
