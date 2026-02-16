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
import { render, screen } from '@superset-ui/core/spec';
import '@testing-library/jest-dom';
import { GenericDataType } from '@apache-superset/core/api/core';
import { ColumnTypeLabel, ColumnTypeLabelProps } from '../../src';

describe('ColumnOption', () => {
  const defaultProps = {
    type: GenericDataType.String,
  };

  const props = { ...defaultProps };

  function renderColumnTypeLabel(overrides: Partial<ColumnTypeLabelProps>) {
    render(<ColumnTypeLabel {...props} {...overrides} />);
  }

  test('is a valid element', () => {
    expect(isValidElement(<ColumnTypeLabel {...defaultProps} />)).toBe(true);
  });
  test('string type shows ABC icon', () => {
    renderColumnTypeLabel({ type: GenericDataType.String });
    expect(screen.getByLabelText('string type icon')).toBeVisible();
  });
  test('int type shows # icon', () => {
    renderColumnTypeLabel({ type: GenericDataType.Numeric });
    expect(screen.getByLabelText('numeric type icon')).toBeVisible();
  });
  test('bool type shows 1|0 icon', () => {
    renderColumnTypeLabel({ type: GenericDataType.Boolean });
    expect(screen.getByLabelText('boolean type icon')).toBeVisible();
  });
  test('expression type shows function icon', () => {
    renderColumnTypeLabel({ type: 'expression' });
    expect(screen.getByLabelText('function type icon')).toBeVisible();
  });
  test('metric type shows sigma icon', () => {
    renderColumnTypeLabel({ type: 'metric' });
    expect(screen.getByLabelText('metric type icon')).toBeVisible();
  });
  test('unknown type shows question mark', () => {
    renderColumnTypeLabel({ type: undefined });
    expect(screen.getByLabelText('unknown type icon')).toBeVisible();
  });
  test('datetime type displays', () => {
    renderColumnTypeLabel({ type: GenericDataType.Temporal });
    expect(screen.getByLabelText('temporal type icon')).toBeVisible();
  });
});
