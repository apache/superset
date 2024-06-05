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

import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ChartFrame } from '@superset-ui/core';

type Props = {
  contentWidth?: number;
  contentHeight?: number;
  height: number;
  renderContent: ({
    height,
    width,
  }: {
    height: number;
    width: number;
  }) => React.ReactNode;
  width: number;
};

const renderChartFrame = (props: Props) => render(<ChartFrame {...props} />);

it('renders content that requires smaller space than frame', () => {
  const { getByText } = renderChartFrame({
    width: 400,
    height: 400,
    contentWidth: 300,
    contentHeight: 300,
    renderContent: ({ width, height }) => (
      <div>
        {width}/{height}
      </div>
    ),
  });
  expect(getByText('400/400')).toBeInTheDocument();
});

it('renders content without specifying content size', () => {
  const { getByText } = renderChartFrame({
    width: 400,
    height: 400,
    renderContent: ({ width, height }) => (
      <div>
        {width}/{height}
      </div>
    ),
  });
  expect(getByText('400/400')).toBeInTheDocument();
});

it('renders content that requires equivalent size to frame', () => {
  const { getByText } = renderChartFrame({
    width: 400,
    height: 400,
    contentWidth: 400,
    contentHeight: 400,
    renderContent: ({ width, height }) => (
      <div>
        {width}/{height}
      </div>
    ),
  });
  expect(getByText('400/400')).toBeInTheDocument();
});

it('renders content that requires space larger than frame', () => {
  const { getByText, container } = renderChartFrame({
    width: 400,
    height: 400,
    contentWidth: 500,
    contentHeight: 500,
    renderContent: ({ width, height }) => (
      <div className="chart">
        {width}/{height}
      </div>
    ),
  });
  expect(getByText('500/500')).toBeInTheDocument();
  const containerDiv = container.firstChild as HTMLElement;
  expect(containerDiv).toHaveStyle({ overflowX: 'auto', overflowY: 'auto' });
});

it('renders content when width is larger than frame', () => {
  const { getByText, container } = renderChartFrame({
    width: 400,
    height: 400,
    contentWidth: 500,
    renderContent: ({ width, height }) => (
      <div className="chart">
        {width}/{height}
      </div>
    ),
  });
  expect(getByText('500/400')).toBeInTheDocument();
  const containerDiv = container.firstChild as HTMLElement;
  expect(containerDiv).toHaveStyle({ overflowX: 'auto', overflowY: 'hidden' });
});

it('renders content when height is larger than frame', () => {
  const { getByText, container } = renderChartFrame({
    width: 400,
    height: 400,
    contentHeight: 600,
    renderContent: ({ width, height }) => (
      <div className="chart">
        {width}/{height}
      </div>
    ),
  });
  expect(getByText('400/600')).toBeInTheDocument();
  const containerDiv = container.firstChild as HTMLElement;
  expect(containerDiv).toHaveStyle({ overflowX: 'hidden', overflowY: 'auto' });
});
