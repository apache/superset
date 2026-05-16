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
import { useRef } from 'react';
import { render, screen, userEvent, waitFor } from '@superset-ui/core/spec';
import {
  ScrollToBottomButton,
  ScrollToBottomContainer,
} from './index';

test('hides the button when the scroll container is at the bottom', () => {
  render(
    <ScrollToBottomContainer
      css={{
        height: 120,
        overflowY: 'auto',
      }}
    >
      <div style={{ height: 40 }}>Item 1</div>
      <div style={{ height: 40 }}>Item 2</div>
      <div style={{ height: 40 }}>Item 3</div>
    </ScrollToBottomContainer>,
  );

  expect(
    screen.queryByTestId('scroll-to-bottom-button'),
  ).not.toBeInTheDocument();
});

test('shows the button after scrolling away from the bottom', async () => {
  render(
    <ScrollToBottomContainer
      css={{
        height: 120,
        overflowY: 'auto',
      }}
    >
      {Array.from({ length: 20 }, (_, index) => (
        <div key={index} style={{ height: 40 }}>
          Item {index + 1}
        </div>
      ))}
    </ScrollToBottomContainer>,
  );

  const container = screen.getByText('Item 1').parentElement as HTMLElement;
  container.scrollTop = 0;
  container.dispatchEvent(new Event('scroll'));

  await waitFor(() => {
    expect(screen.getByTestId('scroll-to-bottom-button')).toBeInTheDocument();
  });
});

test('scrolls to the bottom when the button is clicked', async () => {
  const scrollTo = jest.fn();
  const TestComponent = () => {
    const containerRef = useRef<HTMLDivElement>(null);
    return (
      <div>
        <div
          ref={containerRef}
          data-test="scroll-container"
          style={{ height: 120, overflowY: 'auto' }}
        >
          {Array.from({ length: 20 }, (_, index) => (
            <div key={index} style={{ height: 40 }}>
              Row {index + 1}
            </div>
          ))}
        </div>
        <ScrollToBottomButton targetRef={containerRef} threshold={0} />
      </div>
    );
  };

  const originalScrollTo = HTMLElement.prototype.scrollTo;
  HTMLElement.prototype.scrollTo = scrollTo;

  render(<TestComponent />);

  const container = screen.getByTestId('scroll-container');
  Object.defineProperty(container, 'scrollHeight', {
    configurable: true,
    value: 800,
  });
  Object.defineProperty(container, 'clientHeight', {
    configurable: true,
    value: 120,
  });
  container.scrollTop = 0;
  container.dispatchEvent(new Event('scroll'));

  const button = await screen.findByTestId('scroll-to-bottom-button');
  await userEvent.click(button);

  expect(scrollTo).toHaveBeenCalledWith({
    top: 800,
    behavior: 'smooth',
  });

  HTMLElement.prototype.scrollTo = originalScrollTo;
});
