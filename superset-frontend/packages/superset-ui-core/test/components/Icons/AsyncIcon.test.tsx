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
import { render } from '@testing-library/react';
import { SupersetTheme, ThemeProvider } from '@superset-ui/core';
import AsyncIcon from '../../../src/components/Icons/AsyncIcon';

// Mock the SVG import with a realistic SVG component
jest.mock(
  '!!@svgr/webpack!src/assets/images/icons/slack.svg',
  () => {
    // Return a realistic SVG component that accepts props
    const MockSlackSVG = (props: any) => (
      <svg {...props} viewBox="0 0 24 24" data-testid="slack-svg">
        <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52z" />
      </svg>
    );
    return { default: MockSlackSVG };
  },
  { virtual: true },
);

// Basic theme for testing
const mockTheme: SupersetTheme = {
  fontSize: 16,
  sizeUnit: 4,
} as SupersetTheme;

describe('AsyncIcon', () => {
  it('should render with data-test and aria-label attributes', async () => {
    const { container } = render(
      <ThemeProvider theme={mockTheme}>
        <AsyncIcon customIcons fileName="slack" iconSize="l" />
      </ThemeProvider>,
    );

    await new Promise(resolve => setTimeout(resolve, 50));

    const spanElement = container.querySelector('span');

    expect(spanElement).toHaveAttribute('aria-label', 'slack');
    expect(spanElement).toHaveAttribute('role', 'img');
    expect(spanElement).toHaveAttribute('data-test', 'slack');
  });

  it('should not render DOM-incompatible props as attributes', async () => {
    const { container } = render(
      <ThemeProvider theme={mockTheme}>
        <AsyncIcon customIcons fileName="slack" iconSize="l" />
      </ThemeProvider>,
    );

    await new Promise(resolve => setTimeout(resolve, 50));

    const spanElement = container.querySelector('span');

    expect(spanElement).not.toHaveAttribute('iconsize');
    expect(spanElement).not.toHaveAttribute('customicons');
  });

  it('should set role to button when onClick is provided', async () => {
    const onClick = jest.fn();
    const { container } = render(
      <ThemeProvider theme={mockTheme}>
        <AsyncIcon
          customIcons
          fileName="slack"
          iconSize="l"
          onClick={onClick}
        />
      </ThemeProvider>,
    );

    await new Promise(resolve => setTimeout(resolve, 50));

    const spanElement = container.querySelector('span');

    expect(spanElement).toHaveAttribute('role', 'button');
    expect(spanElement).toHaveAttribute('aria-label', 'slack');
    expect(spanElement).toHaveAttribute('data-test', 'slack');
  });
});
