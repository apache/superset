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
import DeleteModal from '.';

test('Must display title and content', () => {
  const props = {
    title: <div data-test="test-title">Title</div>,
    description: <div data-test="test-description">Description</div>,
    onConfirm: jest.fn(),
    onHide: jest.fn(),
    open: true,
  };
  render(<DeleteModal {...props} />);
  expect(screen.getByTestId('test-title')).toBeInTheDocument();
  expect(screen.getByTestId('test-title')).toBeInTheDocument();
  expect(screen.getByTestId('test-description')).toBeInTheDocument();
  expect(screen.getByTestId('test-description')).toBeInTheDocument();
});

test('Calling "onHide"', () => {
  const props = {
    title: <div data-test="test-title">Title</div>,
    description: <div data-test="test-description">Description</div>,
    onConfirm: jest.fn(),
    onHide: jest.fn(),
    open: true,
  };
  const modal = <DeleteModal {...props} />;
  render(modal);
  expect(props.onHide).toHaveBeenCalledTimes(0);
  expect(props.onConfirm).toHaveBeenCalledTimes(0);

  // type "del" in the input
  userEvent.type(screen.getByTestId('delete-modal-input'), 'del');
  expect(screen.getByTestId('delete-modal-input')).toHaveValue('del');

  // close the modal
  expect(screen.getByText('×')).toBeInTheDocument();
  userEvent.click(screen.getByText('×'));
  expect(props.onHide).toHaveBeenCalledTimes(1);
  expect(props.onConfirm).toHaveBeenCalledTimes(0);

  // confirm input has been cleared
  expect(screen.getByTestId('delete-modal-input')).toHaveValue('');
});

test('Calling "onConfirm" only after typing "delete" in the input', () => {
  const props = {
    title: <div data-test="test-title">Title</div>,
    description: <div data-test="test-description">Description</div>,
    onConfirm: jest.fn(),
    onHide: jest.fn(),
    open: true,
  };
  render(<DeleteModal {...props} />);
  expect(props.onHide).toHaveBeenCalledTimes(0);
  expect(props.onConfirm).toHaveBeenCalledTimes(0);
  expect(screen.getByTestId('delete-modal-input')).toBeInTheDocument();
  expect(props.onConfirm).toHaveBeenCalledTimes(0);

  // do not execute "onConfirm" if you have not typed "delete"
  userEvent.click(screen.getByText('Delete'));
  expect(props.onConfirm).toHaveBeenCalledTimes(0);

  // execute "onConfirm" if you have typed "delete"
  userEvent.type(screen.getByTestId('delete-modal-input'), 'delete');
  userEvent.click(screen.getByText('Delete'));
  expect(props.onConfirm).toHaveBeenCalledTimes(1);

  // confirm input has been cleared
  expect(screen.getByTestId('delete-modal-input')).toHaveValue('');
});
