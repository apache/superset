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
import { isValidElement } from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { GenericDataType } from '@superset-ui/core';

import { ColumnTypeLabel, ColumnTypeLabelProps } from '../../src';

describe('ColumnOption', () => {
  const defaultProps = {
    type: GenericDataType.String,
  };

  const props = { ...defaultProps };

  function renderColumnTypeLabel(overrides: Partial<ColumnTypeLabelProps>) {
    render(<ColumnTypeLabel {...props} {...overrides} />);
  }

  it('is a valid element', () => {
    expect(isValidElement(<ColumnTypeLabel {...defaultProps} />)).toBe(true);
  });
  it('string type shows ABC icon', () => {
    renderColumnTypeLabel({ type: GenericDataType.String });
    expect(screen.getByLabelText('string type icon')).toBeVisible();
  });
  it('int type shows # icon', () => {
    renderColumnTypeLabel({ type: GenericDataType.Numeric });
    expect(screen.getByLabelText('numeric type icon')).toBeVisible();
  });
  it('bool type shows 1|0 icon', () => {
    renderColumnTypeLabel({ type: GenericDataType.Boolean });
    expect(screen.getByLabelText('boolean type icon')).toBeVisible();
  });
  it('expression type shows function icon', () => {
    renderColumnTypeLabel({ type: 'expression' });
    expect(screen.getByLabelText('function type icon')).toBeVisible();
  });
  it('unknown type shows question mark', () => {
    renderColumnTypeLabel({ type: undefined });
    expect(screen.getByLabelText('unknown type icon')).toBeVisible();
  });
  it('datetime type displays', () => {
    renderColumnTypeLabel({ type: GenericDataType.Temporal });
    expect(screen.getByLabelText('temporal type icon')).toBeVisible();
  });
});
