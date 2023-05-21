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
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';
import { DropdownButton } from '.';
import React from 'react';

describe('<DropdownButton />', () => {
  const overlayElement = <div>Test Overlay</div>;

  it('renders without crashing', () => {
    render(<DropdownButton overlay={overlayElement} />);
    const dropdownButtonElement = screen.getByRole('button');
    expect(dropdownButtonElement).toBeInTheDocument();
  });

  it('renders tooltip when tooltip prop is provided', () => {
    const tooltipText = 'Test Tooltip';
    render(<DropdownButton overlay={overlayElement} tooltip={tooltipText} />);
    const tooltipElement = screen.getByText(tooltipText);
    expect(tooltipElement).toBeInTheDocument();
  });

  it('does not render tooltip when tooltip prop is not provided', () => {
    render(<DropdownButton overlay={overlayElement} />);
    const tooltipElement = screen.queryByRole('tooltip');
    expect(tooltipElement).not.toBeInTheDocument();
  });

  it('renders overlay correctly', () => {
    render(<DropdownButton overlay={overlayElement} />);
    const overlayElement = screen.getByText('Test Overlay');
    expect(overlayElement).toBeInTheDocument();
  });
});
