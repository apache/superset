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
import '@testing-library/jest-dom';
import { screen, render, fireEvent, act } from '@testing-library/react';
import { ThemeProvider, supersetTheme } from '@superset-ui/core';
import OptionDescription from '../src/OptionDescription';

const defaultProps = {
  option: {
    label: 'Some option',
    description: 'Description for some option',
  },
};

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('OptionDescription', () => {
  beforeEach(() => {
    const props = { option: { ...defaultProps.option } };
    render(
      <ThemeProvider theme={supersetTheme}>
        <OptionDescription {...props} />
      </ThemeProvider>,
    );
  });

  it('renders an InfoTooltipWithTrigger', () => {
    const tooltipTrigger = screen.getByLabelText('Show info tooltip');
    expect(tooltipTrigger).toBeInTheDocument();

    // Perform delayed mouse hovering so tooltip could pop out
    fireEvent.mouseOver(tooltipTrigger);
    act(() => jest.runAllTimers());
    fireEvent.mouseOut(tooltipTrigger);

    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toBeInTheDocument();
    expect(tooltip).toHaveTextContent('Description for some option');
  });

  it('renders a span with the label', () => {
    expect(
      screen.getByText('Some option', { selector: 'span' }),
    ).toBeInTheDocument();
  });
});
