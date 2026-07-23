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
import { render, screen, userEvent } from '@superset-ui/core/spec';
import TooltipParagraph from '.';

test('starts hidden with default props', () => {
  render(<TooltipParagraph>This is tooltip description.</TooltipParagraph>);
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
});

test('not render on hover when not truncated', async () => {
  render(
    <div style={{ width: '200px' }}>
      <TooltipParagraph>
        <span data-test="test-text">This is short</span>
      </TooltipParagraph>
    </div>,
  );

  await userEvent.hover(screen.getByTestId('test-text'));

  // Wait a moment for any potential tooltip to appear
  await new Promise(resolve => setTimeout(resolve, 100));

  // Check that no tooltip is visible in the document
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
});

// NOTE: there is intentionally no "renders tooltip when truncated" test here.
// The tooltip only activates once antd's Typography reports the text as
// truncated via its `onEllipsis` callback, which depends on real layout
// measurement (offset/scroll widths, ResizeObserver). jsdom performs no layout,
// so truncation is never detected and the tooltip never opens. Ant Design v5 set
// `aria-describedby` on the trigger regardless, which let this case be asserted;
// v6 only wires it once the tooltip has content, so the truncated branch is no
// longer observable in jsdom. It is covered by visual / end-to-end testing.
