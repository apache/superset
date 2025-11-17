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
import { render, screen, fireEvent } from '@superset-ui/core/spec';
import { IconButton } from '.';

const defaultProps = {
  buttonText: 'This is the IconButton text',
  icon: '/images/icons/sql.svg',
};

describe('IconButton', () => {
  it('renders an IconButton with icon and text', () => {
    render(<IconButton {...defaultProps} />);

    const icon = screen.getByRole('img');
    const buttonText = screen.getByText(/this is the iconbutton text/i);

    expect(icon).toBeVisible();
    expect(buttonText).toBeVisible();
  });

  it('is keyboard accessible and has correct aria attributes', () => {
    render(<IconButton {...defaultProps} />);

    const button = screen.getByRole('button');

    expect(button).toHaveAttribute('tabIndex', '0');
    expect(button).toHaveAttribute('aria-label', defaultProps.buttonText);
  });

  it('handles Enter and Space key presses', () => {
    const mockOnClick = jest.fn();
    render(<IconButton {...defaultProps} onClick={mockOnClick} />);

    const button = screen.getByRole('button');

    fireEvent.keyDown(button, { key: 'Enter', code: 'Enter' });
    expect(mockOnClick).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(button, { key: ' ', code: 'Space' });
    expect(mockOnClick).toHaveBeenCalledTimes(2);
  });

  it('uses custom alt text when provided', () => {
    const customAltText = 'Custom Alt Text';
    render(
      <IconButton
        buttonText="Custom Alt Text Button"
        icon="/images/icons/sql.svg"
        altText={customAltText}
      />,
    );

    const icon = screen.getByAltText(customAltText);
    expect(icon).toBeVisible();
  });

  it('displays tooltip with button text', () => {
    render(<IconButton {...defaultProps} />);

    const tooltipTrigger = screen.getByText(/this is the iconbutton text/i);
    expect(tooltipTrigger).toBeVisible();
  });

  it('calls onClick handler when clicked', () => {
    const mockOnClick = jest.fn();
    render(<IconButton {...defaultProps} onClick={mockOnClick} />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    expect(mockOnClick).toHaveBeenCalledTimes(1);
  });
});
