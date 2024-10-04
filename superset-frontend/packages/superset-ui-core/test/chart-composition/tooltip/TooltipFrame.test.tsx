/*
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
import { TooltipFrame } from '@superset-ui/core';
import { render, screen } from '@testing-library/react';

describe('TooltipFrame', () => {
  it('sets className', () => {
    const { container } = render(
      <TooltipFrame className="test-class">
        <span>Hi!</span>
      </TooltipFrame>,
    );
    expect(screen.getByText('Hi!')).toBeInTheDocument();
    expect(container.querySelector('.test-class')).toBeInTheDocument();
  });

  it('renders', () => {
    const { container } = render(
      <TooltipFrame>
        <span>Hi!</span>
      </TooltipFrame>,
    );
    expect(container.querySelectorAll('span')).toHaveLength(1);
    expect(container.querySelector('span')).toHaveTextContent('Hi!');
  });
});
