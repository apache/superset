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
import { screen, render } from 'spec/helpers/testing-library';
import Button from '../Button';
import Icons from '../Icons';
import DropdownContainer from '.';

const generateItems = (n: number) =>
  Array.from({ length: n }).map((_, i) => ({
    id: `el-${i + 1}`,
    element: <Button>{`Element ${i + 1}`}</Button>,
  }));

const ITEMS = generateItems(10);

const mockOverflowingIndex = async (
  overflowingIndex: number,
  func: Function,
) => {
  const spy = jest.spyOn(React, 'useState');
  spy.mockImplementation(() => [overflowingIndex, jest.fn()]);
  await func();
  spy.mockRestore();
};

test('renders children', () => {
  render(<DropdownContainer items={generateItems(3)} />);
  expect(screen.getByText('Element 1')).toBeInTheDocument();
  expect(screen.getByText('Element 2')).toBeInTheDocument();
  expect(screen.getByText('Element 3')).toBeInTheDocument();
});

test('renders children with custom horizontal spacing', () => {
  render(<DropdownContainer items={ITEMS} style={{ gap: 20 }} />);
  expect(screen.getByTestId('container')).toHaveStyle('gap: 20px');
});

test('renders a dropdown trigger when overflowing', async () => {
  await mockOverflowingIndex(3, () => {
    render(<DropdownContainer items={ITEMS} />);
    expect(screen.getByText('More')).toBeInTheDocument();
  });
});

test('renders a dropdown trigger with custom icon', async () => {
  await mockOverflowingIndex(3, async () => {
    render(
      <DropdownContainer items={ITEMS} dropdownTriggerIcon={<Icons.Link />} />,
    );
    expect(
      await screen.findByRole('img', { name: 'link' }),
    ).toBeInTheDocument();
  });
});

test('renders a dropdown trigger with custom text', async () => {
  await mockOverflowingIndex(3, () => {
    const customText = 'Custom text';
    render(
      <DropdownContainer items={ITEMS} dropdownTriggerText={customText} />,
    );
    expect(screen.getByText(customText)).toBeInTheDocument();
  });
});

test('renders a dropdown trigger with custom count', async () => {
  await mockOverflowingIndex(3, () => {
    const customCount = 99;
    render(
      <DropdownContainer items={ITEMS} dropdownTriggerCount={customCount} />,
    );
    expect(screen.getByTitle(customCount)).toBeInTheDocument();
  });
});

test('does not render a dropdown button when not overflowing', () => {
  render(<DropdownContainer items={generateItems(3)} />);
  expect(screen.queryByText('More')).not.toBeInTheDocument();
});

test('renders a dropdown when overflowing', async () => {
  await mockOverflowingIndex(3, () => {
    render(<DropdownContainer items={ITEMS} />);
    userEvent.click(screen.getByText('More'));
    expect(screen.getByTestId('dropdown-content')).toBeInTheDocument();
  });
});

test('renders children with custom vertical spacing', async () => {
  await mockOverflowingIndex(3, () => {
    render(<DropdownContainer items={ITEMS} dropdownStyle={{ gap: 20 }} />);
    userEvent.click(screen.getByText('More'));
    expect(screen.getByTestId('dropdown-content')).toHaveStyle('gap: 20px');
  });
});

test('fires event when overflowing state changes', async () => {
  await mockOverflowingIndex(3, () => {
    const onOverflowingStateChange = jest.fn();
    render(
      <DropdownContainer
        items={generateItems(5)}
        onOverflowingStateChange={onOverflowingStateChange}
      />,
    );
    expect(onOverflowingStateChange).toHaveBeenCalledWith({
      notOverflowed: ['el-1', 'el-2', 'el-3'],
      overflowed: ['el-4', 'el-5'],
    });
  });
});

test('renders a dropdown with custom content', async () => {
  await mockOverflowingIndex(3, () => {
    const customDropdownContent = <div>Custom content</div>;
    render(
      <DropdownContainer
        items={ITEMS}
        dropdownContent={() => customDropdownContent}
      />,
    );
    userEvent.click(screen.getByText('More'));
    expect(screen.getByText('Custom content')).toBeInTheDocument();
  });
});

test('Shows tooltip on dropdown trigger hover', async () => {
  await mockOverflowingIndex(3, async () => {
    render(
      <DropdownContainer
        items={generateItems(5)}
        dropdownTriggerTooltip="Test tooltip"
      />,
    );
    userEvent.hover(screen.getByText('More'));
    expect(await screen.findByText('Test tooltip')).toBeInTheDocument();
  });
});
