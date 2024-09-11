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
import userEvent from '@testing-library/user-event';
import TooltipParagraph from '.';

test('starts hidden with default props', () => {
  render(<TooltipParagraph>This is tooltip description.</TooltipParagraph>);
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
});

test('not render on hover when not truncated', async () => {
  const { container } = render(
    <div style={{ width: '200px' }}>
      <TooltipParagraph>
        <span data-test="test-text">This is short</span>
      </TooltipParagraph>
    </div>,
  );
  userEvent.hover(screen.getByTestId('test-text'));
  await waitFor(() =>
    expect(container.firstChild?.firstChild).not.toHaveClass(
      'ant-tooltip-open',
    ),
  );
});

test('render on hover when truncated', async () => {
  const { container } = render(
    <div style={{ width: '200px' }}>
      <TooltipParagraph>
        <span data-test="test-text">This is too long and should truncate.</span>
      </TooltipParagraph>
    </div>,
  );
  userEvent.hover(screen.getByTestId('test-text'));
  await waitFor(() =>
    expect(container.firstChild?.firstChild).toHaveClass('ant-tooltip-open'),
  );
});
