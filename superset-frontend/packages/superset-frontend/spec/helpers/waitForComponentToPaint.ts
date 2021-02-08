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
import { ReactWrapper } from 'enzyme';
import { act } from 'react-dom/test-utils';

// taken from: https://github.com/enzymejs/enzyme/issues/2073
// There is currently and issue with enzyme and react-16's hooks
// that results in a race condition between tests and react hook updates.
// This function ensures tests run after all react updates are done.
export default async function waitForComponentToPaint<P = {}>(
  wrapper: ReactWrapper<P>,
  amount = 0,
) {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, amount));
    wrapper.update();
  });
}
