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
import { ThemeProvider, supersetTheme } from '@superset-ui/core';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { render, screen } from 'spec/helpers/testing-library';
import { OptionControlLabel } from 'src/explore/components/OptionControls';
import { noOp } from 'src/utils/common';

const setup = (overrides?: Record<string, any>) => {
  const props = {
    label: <span>Test label</span>,
    onRemove: noOp,
    onMoveLabel: noOp,
    onDropLabel: noOp,
    type: 'test',
    index: 0,
    ...overrides,
  };
  return render(
    <ThemeProvider theme={supersetTheme}>
      <DndProvider backend={HTML5Backend}>
        <OptionControlLabel {...props} />
      </DndProvider>
    </ThemeProvider>,
  );
};

describe('OptionControls', () => {
  it('should render', () => {
    const { container } = setup();
    expect(container).toBeVisible();
  });

  it('should display a label', () => {
    setup();
    expect(screen.getByText('Test label')).toBeTruthy();
  });

  it('should display a certification icon if saved metric is certified', () => {
    const { container } = setup({
      savedMetric: {
        metric_name: 'test_metric',
        is_certified: true,
      },
    });
    screen.getByText('test_metric');
    expect(screen.queryByText('Test label')).toBeFalsy();

    expect(container.querySelector('.metric-option > svg')).toBeInTheDocument();
  });
});
