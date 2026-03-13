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
import { render, screen, userEvent } from '@superset-ui/core/spec';
import { ModalTrigger } from '.';

const mockedProps = {
  triggerNode: <span>Trigger</span>,
};

test('should render', () => {
  const { container } = render(<ModalTrigger {...mockedProps} />);
  expect(container).toBeInTheDocument();
});

test('should render a button', () => {
  render(<ModalTrigger {...mockedProps} />);
  expect(screen.getByRole('button')).toBeInTheDocument();
});

test('should render a span element by default', () => {
  render(<ModalTrigger {...mockedProps} />);
  expect(screen.getByTestId('span-modal-trigger')).toBeInTheDocument();
});

test('should render a button element when specified', () => {
  const btnProps = {
    ...mockedProps,
    isButton: true,
  };
  render(<ModalTrigger {...btnProps} />);
  expect(screen.getByTestId('btn-modal-trigger')).toBeInTheDocument();
});

test('should render triggerNode', () => {
  render(<ModalTrigger {...mockedProps} />);
  expect(screen.getByText('Trigger')).toBeInTheDocument();
});

test('should render a tooltip on hover', async () => {
  const tooltipProps = {
    ...mockedProps,
    isButton: true,
    tooltip: 'I am a tooltip',
  };
  render(<ModalTrigger {...tooltipProps} />);

  await userEvent.hover(screen.getByRole('button'));
  expect(await screen.findByRole('tooltip')).toBeInTheDocument();
});

test('should not render a modal before click', () => {
  render(<ModalTrigger {...mockedProps} />);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('should render a modal after click', async () => {
  render(<ModalTrigger {...mockedProps} />);
  await userEvent.click(screen.getByRole('button'));
  expect(screen.getByRole('dialog')).toBeInTheDocument();
});

test('trigger click should stopPropagation instead of preventDefault', async () => {
  render(<ModalTrigger {...mockedProps} />);
  const trigger = screen.getByTestId('span-modal-trigger');

  const clickEvent = new MouseEvent('click', {
    bubbles: true,
    cancelable: true,
  });
  const stopSpy = jest.spyOn(clickEvent, 'stopPropagation');

  trigger.dispatchEvent(clickEvent);

  expect(stopSpy).toHaveBeenCalled();
  // preventDefault should NOT be called — it blocks the parent
  // dropdown menu from closing, leaving rc-menu's keyboard handler
  // active and intercepting arrow/Home/End keys (#37948)
  expect(clickEvent.defaultPrevented).toBe(false);
});

test('should not block arrow key default behavior inside modal input', async () => {
  render(
    <ModalTrigger
      triggerNode={<span>Trigger</span>}
      modalBody={<input aria-label="test-input" />}
    />,
  );

  await userEvent.click(screen.getByRole('button'));
  expect(screen.getByRole('dialog')).toBeInTheDocument();

  const input = screen.getByRole('textbox', { name: 'test-input' });

  // Simulate pressing ArrowLeft — default should NOT be prevented
  const arrowEvent = new KeyboardEvent('keydown', {
    key: 'ArrowLeft',
    bubbles: true,
    cancelable: true,
  });
  const wasPrevented = !input.dispatchEvent(arrowEvent);
  expect(wasPrevented).toBe(false);
});
