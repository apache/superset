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

import { render, screen } from 'spec/helpers/testing-library';
import { Provider } from 'react-redux';
import { store } from 'src/views/store';
import FlashProvider, { FlashMessage } from './index';

test('Rerendering correctly with default props', () => {
  const messages: FlashMessage[] = [];
  render(
    <FlashProvider messages={messages}>
      <div data-test="my-component">My Component</div>
    </FlashProvider>,
    { store },
  );
  expect(screen.getByTestId('my-component')).toBeInTheDocument();
});

test('messages should only be inserted in the State when the component is mounted', () => {
  const messages: FlashMessage[] = [
    ['info', 'teste message 01'],
    ['info', 'teste message 02'],
  ];
  expect(store.getState().messageToasts).toEqual([]);
  const { rerender } = render(
    <Provider store={store}>
      <FlashProvider messages={messages}>
        <div data-teste="my-component">My Component</div>
      </FlashProvider>
    </Provider>,
  );
  const fistRender = store.getState().messageToasts;
  expect(fistRender).toHaveLength(2);
  expect(fistRender[1].text).toBe(messages[0][1]);
  expect(fistRender[0].text).toBe(messages[1][1]);

  rerender(
    <Provider store={store}>
      <FlashProvider messages={[...messages, ['info', 'teste message 03']]}>
        <div data-teste="my-component">My Component</div>
      </FlashProvider>
    </Provider>,
  );

  const secondRender = store.getState().messageToasts;
  expect(secondRender).toEqual(fistRender);
});
