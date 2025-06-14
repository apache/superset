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
import {
  render,
  screen,
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import CopyToClipboard from '.';

test('renders with default props', () => {
  const text = 'Text';
  render(<CopyToClipboard text={text} />, { useRedux: true });
  expect(screen.getByText(text)).toBeInTheDocument();
  expect(screen.getByText('Copy')).toBeInTheDocument();
});

test('renders with custom copy node', () => {
  const copyNode = <a href="/">Custom node</a>;
  render(<CopyToClipboard copyNode={copyNode} />, { useRedux: true });
  expect(screen.getByRole('link')).toBeInTheDocument();
});

test('renders without text showing', () => {
  const text = 'Text';
  render(<CopyToClipboard text={text} shouldShowText={false} />, {
    useRedux: true,
  });
  expect(screen.queryByText(text)).not.toBeInTheDocument();
});

test('getText on copy', async () => {
  const getText = jest.fn(() => 'Text');
  render(<CopyToClipboard getText={getText} />, { useRedux: true });
  userEvent.click(screen.getByText('Copy'));
  await waitFor(() => expect(getText).toHaveBeenCalled());
});

test('renders tooltip on hover', async () => {
  const tooltipText = 'Tooltip';
  render(<CopyToClipboard tooltipText={tooltipText} />, { useRedux: true });
  userEvent.hover(screen.getByText('Copy'));
  const tooltip = await screen.findByRole('tooltip');
  expect(tooltip).toBeInTheDocument();
  expect(tooltip).toHaveTextContent(tooltipText);
});

test('not renders tooltip on hover with hideTooltip props', async () => {
  const tooltipText = 'Tooltip';
  render(<CopyToClipboard tooltipText={tooltipText} hideTooltip />, {
    useRedux: true,
  });
  userEvent.hover(screen.getByText('Copy'));
  const tooltip = screen.queryByRole('tooltip');
  expect(tooltip).not.toBeInTheDocument();
});

test('triggers onCopyEnd', async () => {
  const onCopyEnd = jest.fn();
  render(<CopyToClipboard onCopyEnd={onCopyEnd} />, {
    useRedux: true,
  });
  userEvent.click(screen.getByText('Copy'));
  await waitFor(() => expect(onCopyEnd).toHaveBeenCalled());
});

test('renders unwrapped', () => {
  const text = 'Text';
  render(<CopyToClipboard text={text} wrapped={false} />, {
    useRedux: true,
  });
  expect(screen.queryByText(text)).not.toBeInTheDocument();
});
