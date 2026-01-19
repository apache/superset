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

import userEvent from '@testing-library/user-event';
import { render, screen, waitFor } from 'spec/helpers/testing-library';
import SkipLink from './SkipLink';

describe('SkipLink', () => {
  beforeEach(() => {
    // Clean up any target elements from previous tests
    const existingTarget = document.getElementById('main-content');
    if (existingTarget) {
      existingTarget.remove();
    }
  });

  describe('Rendering', () => {
    test('renders with default "Skip to main content" text', () => {
      render(<SkipLink />);
      expect(screen.getByText('Skip to main content')).toBeInTheDocument();
    });

    test('renders with custom children text', () => {
      render(<SkipLink>Skip to navigation</SkipLink>);
      expect(screen.getByText('Skip to navigation')).toBeInTheDocument();
    });

    test('renders as anchor element with correct href', () => {
      render(<SkipLink targetId="custom-target" />);
      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('href', '#custom-target');
    });

    test('applies styled-component class', () => {
      render(<SkipLink />);
      const link = screen.getByRole('link');
      expect(link).toHaveClass('a11y-skip-link');
    });
  });

  describe('Visual States', () => {
    test('is positioned off-screen by default (top: -100px)', () => {
      render(<SkipLink />);
      const link = screen.getByRole('link');
      expect(link).toHaveStyleRule('top', '-100px');
    });

    test('has correct z-index for overlay (10000)', () => {
      render(<SkipLink />);
      const link = screen.getByRole('link');
      expect(link).toHaveStyleRule('z-index', '10000');
    });

    test('has absolute positioning', () => {
      render(<SkipLink />);
      const link = screen.getByRole('link');
      expect(link).toHaveStyleRule('position', 'absolute');
    });
  });

  describe('Focus Behavior', () => {
    test('becomes visible when focused (top: 0)', async () => {
      render(<SkipLink />);
      const link = screen.getByRole('link');
      link.focus();
      expect(link).toHaveStyleRule('top', '0 !important', {
        modifier: ':focus',
      });
    });

    test('receives focus on Tab key press', async () => {
      const user = userEvent.setup();
      render(<SkipLink />);
      await user.tab();
      const link = screen.getByRole('link');
      expect(link).toHaveFocus();
    });

    test('shows focus outline styling', () => {
      render(<SkipLink />);
      const link = screen.getByRole('link');
      expect(link).toHaveStyleRule('outline', expect.stringContaining('3px solid'), {
        modifier: ':focus',
      });
    });

    test('shows focus-visible outline styling', () => {
      render(<SkipLink />);
      const link = screen.getByRole('link');
      expect(link).toHaveStyleRule('top', '0 !important', {
        modifier: ':focus-visible',
      });
    });
  });

  describe('Keyboard Navigation', () => {
    test('activates on Enter key press', async () => {
      const user = userEvent.setup();
      const targetElement = document.createElement('main');
      targetElement.id = 'main-content';
      document.body.appendChild(targetElement);

      render(<SkipLink />);
      await user.tab();
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(targetElement).toHaveFocus();
      });

      targetElement.remove();
    });

    test('activates on click', async () => {
      const user = userEvent.setup();
      const targetElement = document.createElement('main');
      targetElement.id = 'main-content';
      document.body.appendChild(targetElement);

      render(<SkipLink />);
      await user.click(screen.getByRole('link'));

      await waitFor(() => {
        expect(targetElement).toHaveFocus();
      });

      targetElement.remove();
    });
  });

  describe('Click Handler', () => {
    test('prevents default anchor behavior', async () => {
      const user = userEvent.setup();
      const targetElement = document.createElement('main');
      targetElement.id = 'main-content';
      document.body.appendChild(targetElement);

      render(<SkipLink />);
      const link = screen.getByRole('link');

      const clickEvent = new MouseEvent('click', { bubbles: true });
      const preventDefaultSpy = jest.spyOn(clickEvent, 'preventDefault');

      link.dispatchEvent(clickEvent);
      expect(preventDefaultSpy).toHaveBeenCalled();

      targetElement.remove();
    });

    test('finds target element by ID', async () => {
      const user = userEvent.setup();
      const targetElement = document.createElement('main');
      targetElement.id = 'custom-target';
      document.body.appendChild(targetElement);

      render(<SkipLink targetId="custom-target" />);
      await user.click(screen.getByRole('link'));

      await waitFor(() => {
        expect(targetElement).toHaveFocus();
      });

      targetElement.remove();
    });

    test('focuses target element on click', async () => {
      const user = userEvent.setup();
      const targetElement = document.createElement('div');
      targetElement.id = 'main-content';
      document.body.appendChild(targetElement);

      render(<SkipLink />);
      await user.click(screen.getByRole('link'));

      await waitFor(() => {
        expect(targetElement).toHaveFocus();
      });

      targetElement.remove();
    });

    test('adds tabindex="-1" to non-focusable targets', async () => {
      const user = userEvent.setup();
      const targetElement = document.createElement('div');
      targetElement.id = 'main-content';
      document.body.appendChild(targetElement);

      expect(targetElement).not.toHaveAttribute('tabindex');

      render(<SkipLink />);
      await user.click(screen.getByRole('link'));

      await waitFor(() => {
        expect(targetElement).toHaveAttribute('tabindex', '-1');
      });

      targetElement.remove();
    });

    test('does not add tabindex if already present', async () => {
      const user = userEvent.setup();
      const targetElement = document.createElement('div');
      targetElement.id = 'main-content';
      targetElement.setAttribute('tabindex', '0');
      document.body.appendChild(targetElement);

      render(<SkipLink />);
      await user.click(screen.getByRole('link'));

      await waitFor(() => {
        expect(targetElement).toHaveAttribute('tabindex', '0');
      });

      targetElement.remove();
    });

    test('handles missing target element gracefully', async () => {
      const user = userEvent.setup();
      const originalHash = window.location.hash;

      render(<SkipLink targetId="non-existent" />);

      // Should not throw an error
      await expect(user.click(screen.getByRole('link'))).resolves.not.toThrow();

      // Cleanup
      window.location.hash = originalHash;
    });

    test('falls back to hash navigation when target missing', async () => {
      const user = userEvent.setup();

      render(<SkipLink targetId="non-existent" />);
      await user.click(screen.getByRole('link'));

      expect(window.location.hash).toBe('#non-existent');

      // Cleanup
      window.location.hash = '';
    });
  });

  describe('Props', () => {
    test('uses default targetId "main-content"', () => {
      render(<SkipLink />);
      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('href', '#main-content');
    });

    test('accepts custom targetId prop', () => {
      render(<SkipLink targetId="sidebar" />);
      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('href', '#sidebar');
    });

    test('passes through additional props', () => {
      render(<SkipLink data-testid="custom-skip-link" />);
      expect(screen.getByTestId('custom-skip-link')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    test('has accessible name from children', () => {
      render(<SkipLink>Skip navigation</SkipLink>);
      const link = screen.getByRole('link', { name: 'Skip navigation' });
      expect(link).toBeInTheDocument();
    });

    test('is discoverable by screen readers', () => {
      render(<SkipLink />);
      const link = screen.getByRole('link');
      expect(link).toBeInTheDocument();
      expect(link).not.toHaveAttribute('aria-hidden');
    });

    test('href matches targetId for fallback', () => {
      render(<SkipLink targetId="content-area" />);
      const link = screen.getByRole('link');
      expect(link.getAttribute('href')).toBe('#content-area');
    });
  });

  describe('Edge Cases', () => {
    test('handles empty targetId', () => {
      render(<SkipLink targetId="" />);
      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('href', '#');
    });

    test('handles special characters in targetId', () => {
      render(<SkipLink targetId="main_content-area" />);
      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('href', '#main_content-area');
    });

    test('handles multiple SkipLinks on page', () => {
      render(
        <>
          <SkipLink targetId="nav">Skip to navigation</SkipLink>
          <SkipLink targetId="main">Skip to main content</SkipLink>
          <SkipLink targetId="footer">Skip to footer</SkipLink>
        </>,
      );

      expect(screen.getByText('Skip to navigation')).toBeInTheDocument();
      expect(screen.getByText('Skip to main content')).toBeInTheDocument();
      expect(screen.getByText('Skip to footer')).toBeInTheDocument();
    });

    test('works with dynamically added target elements', async () => {
      const user = userEvent.setup();

      render(<SkipLink targetId="dynamic-target" />);

      // Add target after component renders
      const targetElement = document.createElement('div');
      targetElement.id = 'dynamic-target';
      document.body.appendChild(targetElement);

      await user.click(screen.getByRole('link'));

      await waitFor(() => {
        expect(targetElement).toHaveFocus();
      });

      targetElement.remove();
    });
  });
});
