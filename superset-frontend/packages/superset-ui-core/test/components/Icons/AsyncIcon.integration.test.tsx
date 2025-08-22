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
import { render, fireEvent } from '@testing-library/react';
import { SupersetTheme, ThemeProvider } from '@superset-ui/core';

// CRITICAL: Don't import from the mocked path - import directly to avoid global mocks
import AsyncIcon from '../../../src/components/Icons/AsyncIcon';

// Mock only the SVG import to prevent dynamic import issues
jest.mock(
  '!!@svgr/webpack!../../../src/assets/images/icons/slack.svg',
  () => {
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

describe('AsyncIcon Integration Tests (Real Component)', () => {
  it('should have data-test and aria-label attributes with real component', () => {
    const { container } = render(
      <ThemeProvider theme={mockTheme}>
        <AsyncIcon customIcons fileName="slack" iconSize="l" />
      </ThemeProvider>,
    );

    // Don't wait for SVG since it's mocked - just check the span wrapper
    const spanElement = container.querySelector('span');

    // Test the ACTUAL component behavior (not the mock)
    expect(spanElement).toHaveAttribute('aria-label', 'slack');
    expect(spanElement).toHaveAttribute('role', 'img');
    expect(spanElement).toHaveAttribute('data-test', 'slack');
  });

  it('should always have aria-label and data-test for testing', () => {
    const { container } = render(
      <ThemeProvider theme={mockTheme}>
        <AsyncIcon customIcons fileName="slack" iconSize="l" />
      </ThemeProvider>,
    );

    const spanElement = container.querySelector('span');

    // The critical requirement: we MUST have these attributes for accessibility and testing
    expect(spanElement).toHaveAttribute('aria-label');
    expect(spanElement).toHaveAttribute('data-test');

    // The values should be consistent
    const ariaLabel = spanElement?.getAttribute('aria-label');
    const dataTest = spanElement?.getAttribute('data-test');
    expect(ariaLabel).toBe('slack');
    expect(dataTest).toBe('slack');
  });

  it('should set role to button when onClick is provided in real component', () => {
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

    const spanElement = container.querySelector('span');

    expect(spanElement).toHaveAttribute('role', 'button');
    expect(spanElement).toHaveAttribute('aria-label', 'slack');
    expect(spanElement).toHaveAttribute('data-test', 'slack');

    // Verify onClick handler actually works
    fireEvent.click(spanElement!);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('should handle complex fileName patterns like BaseIcon', () => {
    const { container } = render(
      <ThemeProvider theme={mockTheme}>
        <AsyncIcon customIcons fileName="slack_notification" iconSize="l" />
      </ThemeProvider>,
    );

    const spanElement = container.querySelector('span');

    // Should follow BaseIcon's genAriaLabel logic:
    // fileName="slack_notification" -> name="slack-notification" -> "slack-notification" (not just "slack")
    expect(spanElement).toHaveAttribute('aria-label', 'slack-notification');
    expect(spanElement).toHaveAttribute('data-test', 'slack-notification');
  });
});
