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
import React from 'react';
import userEvent from '@testing-library/user-event';
import { render, screen } from 'spec/helpers/testing-library';
import Footer from './Footer';

const createProps = () => ({
  filterSetName: 'Set name',
  disabled: false,
  editMode: false,
  onCancel: jest.fn(),
  onEdit: jest.fn(),
  onCreate: jest.fn(),
});

const editModeProps = {
  ...createProps(),
  editMode: true,
};

test('should render', () => {
  const mockedProps = createProps();
  const { container } = render(<Footer {...mockedProps} />, { useRedux: true });
  expect(container).toBeInTheDocument();
});

test('should render a button', () => {
  const mockedProps = createProps();
  render(<Footer {...mockedProps} />, { useRedux: true });
  expect(screen.getByRole('button')).toBeInTheDocument();
  expect(screen.getByText('Create new filter set')).toBeInTheDocument();
});

test('should render a disabled button', () => {
  const mockedProps = createProps();
  const disabledProps = {
    ...mockedProps,
    disabled: true,
  };
  render(<Footer {...disabledProps} />, { useRedux: true });
  expect(screen.getByRole('button')).toBeDisabled();
});

test('should edit', () => {
  const mockedProps = createProps();
  render(<Footer {...mockedProps} />, { useRedux: true });
  const btn = screen.getByRole('button');
  expect(mockedProps.onEdit).not.toHaveBeenCalled();
  userEvent.click(btn);
  expect(mockedProps.onEdit).toHaveBeenCalled();
});

test('should render the Create button', () => {
  render(<Footer {...editModeProps} />, { useRedux: true });
  expect(screen.getByText('Create')).toBeInTheDocument();
});

test('should create', () => {
  render(<Footer {...editModeProps} />, { useRedux: true });
  const createBtn = screen.getByText('Create');
  expect(editModeProps.onCreate).not.toHaveBeenCalled();
  userEvent.click(createBtn);
  expect(editModeProps.onCreate).toHaveBeenCalled();
});

test('should render the Cancel button', () => {
  render(<Footer {...editModeProps} />, { useRedux: true });
  expect(screen.getByText('Cancel')).toBeInTheDocument();
});

test('should cancel', () => {
  render(<Footer {...editModeProps} />, { useRedux: true });
  const cancelBtn = screen.getByText('Cancel');
  expect(editModeProps.onCancel).not.toHaveBeenCalled();
  userEvent.click(cancelBtn);
  expect(editModeProps.onCancel).toHaveBeenCalled();
});
