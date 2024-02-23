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
import { DndItemType } from 'src/explore/components/DndItemType';
import DndSelectLabel, {
  DndSelectLabelProps,
} from 'src/explore/components/controls/DndColumnSelectControl/DndSelectLabel';

const defaultProps: DndSelectLabelProps = {
  name: 'Column',
  accept: 'Column' as DndItemType,
  onDrop: jest.fn(),
  canDrop: () => false,
  valuesRenderer: () => <span />,
  ghostButtonText: 'Drop columns here or click',
  onClickGhostButton: jest.fn(),
};

test('renders with default props', () => {
  render(<DndSelectLabel {...defaultProps} />, { useDnd: true });
  expect(screen.getByText('Drop columns here or click')).toBeInTheDocument();
});

test('renders ghost button when empty', () => {
  const ghostButtonText = 'Ghost button text';
  render(
    <DndSelectLabel {...defaultProps} ghostButtonText={ghostButtonText} />,
    { useDnd: true },
  );
  expect(screen.getByText(ghostButtonText)).toBeInTheDocument();
});

test('renders values', () => {
  const values = 'Values';
  const valuesRenderer = () => <span>{values}</span>;
  render(<DndSelectLabel {...defaultProps} valuesRenderer={valuesRenderer} />, {
    useDnd: true,
  });
  expect(screen.getByText(values)).toBeInTheDocument();
});

test('Handles ghost button click', () => {
  render(<DndSelectLabel {...defaultProps} />, { useDnd: true });
  userEvent.click(screen.getByText('Drop columns here or click'));
  expect(defaultProps.onClickGhostButton).toHaveBeenCalled();
});
