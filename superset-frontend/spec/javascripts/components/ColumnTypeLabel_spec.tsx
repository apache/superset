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
import { render, screen, cleanup } from 'spec/helpers/testing-library';

import {
  ColumnTypeLabel,
  ColumnTypeLabelProps,
} from '@superset-ui/chart-controls';
import { GenericDataType } from '@superset-ui/core';

const defaultProps = {
  type: GenericDataType.STRING,
};

const setup = (overrides?: ColumnTypeLabelProps) => (
  <div className="type-label">
    <ColumnTypeLabel {...defaultProps} {...overrides} />
  </div>
);

describe('ColumnOption RTL', () => {
  afterEach(cleanup);
  it('is a valid element', () => {
    expect(React.isValidElement(<ColumnTypeLabel {...defaultProps} />)).toBe(
      true,
    );
  });

  it('string type shows ABC icon', () => {
    render(setup(defaultProps));

    const labelIcon = screen.getByText(/abc/i);
    expect(labelIcon.innerHTML).toMatch(/abc/i);
  });

  it('int type shows # icon', () => {
    render(setup({ type: GenericDataType.NUMERIC }));

    const labelIcon = screen.getByText(/#/i);
    expect(labelIcon.innerHTML).toMatch(/#/i);
  });

  it('bool type shows T/F icon', () => {
    render(setup({ type: GenericDataType.BOOLEAN }));

    const labelIcon = screen.getByText(/t\/f/i);
    expect(labelIcon.innerHTML).toMatch(/t\/f/i);
  });

  it('expression type shows function icon', () => {
    render(setup({ type: 'expression' }));

    const labelIcon = screen.getByText('ƒ');
    expect(labelIcon.innerHTML).toMatch('ƒ');
  });

  it('unknown type shows question mark', () => {
    render(setup({ type: undefined }));

    const labelIcon = screen.getByText('?');
    expect(labelIcon.innerHTML).toMatch('?');
  });

  it('datetime type displays', () => {
    const rendered = render(setup({ type: GenericDataType.TEMPORAL }));

    const clockIcon = rendered.container.querySelector('.fa-clock-o');
    expect(clockIcon).toBeVisible();
  });
});
