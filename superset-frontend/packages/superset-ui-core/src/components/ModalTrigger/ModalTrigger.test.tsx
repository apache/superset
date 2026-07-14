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
import { render, screen, userEvent, fireEvent } from '@superset-ui/core/spec';

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

test('stops propagation of navigation keys to parent elements', async () => {
  const handleParentKeyDown = jest.fn();

  render(
    <div onKeyDown={handleParentKeyDown}>
      <ModalTrigger
        triggerNode={<span>Trigger</span>}
        modalBody={<input data-test="modal-input" />}
      />
    </div>,
  );

  await userEvent.click(screen.getByText('Trigger'));
  const input = await screen.findByTestId('modal-input');

  const blockedKeys = [
    'ArrowLeft',
    'ArrowRight',
    'ArrowUp',
    'ArrowDown',
    'Home',
    'End',
  ];

  for (const key of blockedKeys) {
    handleParentKeyDown.mockClear();
    fireEvent.keyDown(input, { key });
    expect(handleParentKeyDown).not.toHaveBeenCalled();
  }

  // `Tab` must be checked before `Escape`: pressing `Escape` legitimately
  // closes the modal (a real global listener unmounts the dialog), so any
  // key fired on the stale `input` reference afterwards can no longer
  // bubble anywhere.
  const allowedKeys = ['Tab', 'Escape'];

  for (const key of allowedKeys) {
    handleParentKeyDown.mockClear();
    fireEvent.keyDown(input, { key });
    expect(handleParentKeyDown).toHaveBeenCalled();
  }
});
