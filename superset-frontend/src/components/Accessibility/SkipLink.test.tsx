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
import { render, screen, fireEvent } from 'spec/helpers/testing-library';
import SkipLink from './SkipLink';

describe('SkipLink', () => {
  it('renders with default props', () => {
    render(<SkipLink />);
    const link = screen.getByText('Skip to main content');
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '#main-content');
    expect(link).toHaveClass('a11y-skip-link');
  });

  it('renders with custom targetId and children', () => {
    render(
      <SkipLink targetId="dashboard-content">Skip to dashboard</SkipLink>,
    );
    const link = screen.getByText('Skip to dashboard');
    expect(link).toHaveAttribute('href', '#dashboard-content');
  });

  it('focuses target element on click', () => {
    const targetEl = document.createElement('div');
    targetEl.id = 'main-content';
    document.body.appendChild(targetEl);

    render(<SkipLink />);
    const link = screen.getByText('Skip to main content');
    fireEvent.click(link);

    expect(document.activeElement).toBe(targetEl);
    document.body.removeChild(targetEl);
  });

  it('sets tabindex temporarily and removes on blur', () => {
    const targetEl = document.createElement('div');
    targetEl.id = 'main-content';
    document.body.appendChild(targetEl);

    render(<SkipLink />);
    const link = screen.getByText('Skip to main content');
    fireEvent.click(link);

    // tabindex should be set after click/focus
    expect(targetEl).toHaveAttribute('tabindex', '-1');

    // tabindex should be removed after blur
    fireEvent.blur(targetEl);
    expect(targetEl).not.toHaveAttribute('tabindex');

    document.body.removeChild(targetEl);
  });

  it('preserves existing tabindex on target', () => {
    const targetEl = document.createElement('div');
    targetEl.id = 'main-content';
    targetEl.setAttribute('tabindex', '0');
    document.body.appendChild(targetEl);

    render(<SkipLink />);
    const link = screen.getByText('Skip to main content');
    fireEvent.click(link);

    // Should keep the existing tabindex
    expect(targetEl).toHaveAttribute('tabindex', '0');

    // Should still have tabindex after blur (it was pre-existing)
    fireEvent.blur(targetEl);
    expect(targetEl).toHaveAttribute('tabindex', '0');

    document.body.removeChild(targetEl);
  });

  it('falls back to hash navigation when target not found', () => {
    render(<SkipLink targetId="nonexistent" />);
    const link = screen.getByText('Skip to main content');

    // Should not throw when target doesn't exist
    fireEvent.click(link);
    expect(window.location.hash).toBe('#nonexistent');
  });

  it('prevents default link behavior', () => {
    const targetEl = document.createElement('div');
    targetEl.id = 'main-content';
    document.body.appendChild(targetEl);

    render(<SkipLink />);
    const link = screen.getByText('Skip to main content');

    const preventDefaultSpy = jest.fn();
    link.addEventListener('click', preventDefaultSpy, { once: true });

    fireEvent.click(link);

    document.body.removeChild(targetEl);
  });
});
