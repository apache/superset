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
import { render, screen, waitFor } from 'spec/helpers/testing-library';
import ContourPopoverTrigger from '../ContourControl/ContourPopoverTrigger';
import ColorBreakpointPopoverTrigger from '../ColorBreakpointsControl/ColorBreakpointPopoverTrigger';

test.each(['contour', 'color breakpoint'])(
  '%s add-new popover has a block-width anchor even with a zero-height child',
  async kind => {
    const placeholder = <div data-test="empty-anchor-placeholder" />;
    const common = {
      isControlled: true,
      visible: true,
      toggleVisibility: jest.fn(),
    };
    render(
      kind === 'contour' ? (
        <ContourPopoverTrigger {...common} saveContour={jest.fn()}>
          {placeholder}
        </ContourPopoverTrigger>
      ) : (
        <ColorBreakpointPopoverTrigger
          {...common}
          saveColorBreakpoint={jest.fn()}
          colorBreakpoints={[]}
        >
          {placeholder}
        </ColorBreakpointPopoverTrigger>
      ),
    );

    const anchor = screen.getByTestId('empty-anchor-placeholder').parentElement;
    await waitFor(() => expect(anchor).toHaveClass('ant-popover-open'));
    expect(anchor).toHaveStyle('display: block');
    expect(anchor?.style.height).toBe('');
  },
);
