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
import { render, screen } from '@superset-ui/core/spec';
import ProgressBar, { ProgressBarProps } from '.';

const mockedProps: ProgressBarProps = {
  percent: 90,
};

test('should render', () => {
  const { container } = render(<ProgressBar {...mockedProps} />);
  expect(container).toBeInTheDocument();
});

test('should render with info', () => {
  render(<ProgressBar {...mockedProps} />);
  expect(screen.getByText('90%')).toBeInTheDocument();
});

test('should render without info', () => {
  const noInfoProps = {
    ...mockedProps,
    showInfo: false,
  };
  render(<ProgressBar {...noInfoProps} />);
  expect(screen.queryByText('90%')).not.toBeInTheDocument();
});

test('should render with error icon', () => {
  const errorProps = {
    ...mockedProps,
    status: 'exception' as const,
  };
  render(<ProgressBar {...errorProps} />);
  expect(screen.getByLabelText('close-circle')).toBeInTheDocument();
});

test('should render with success icon', () => {
  const successProps = {
    ...mockedProps,
    status: 'success' as const,
  };
  render(<ProgressBar {...successProps} />);
  expect(screen.getByLabelText('check-circle')).toBeInTheDocument();
});

// The stripes are painted on antd's inner progress track, so assert the
// computed style of that element — asserting the outer container would pass
// whether or not the gradient ever reached the track.
const getTrack = (container: HTMLElement) =>
  container.querySelector('.ant-progress-track') as HTMLElement;

test('should render with stripes', () => {
  const stripedProps = {
    ...mockedProps,
    striped: true,
  };
  const { container } = render(<ProgressBar {...stripedProps} />);
  expect(getComputedStyle(getTrack(container)).backgroundImage).toContain(
    'linear-gradient(45deg',
  );
});

test('should render without stripes by default', () => {
  const { container } = render(<ProgressBar {...mockedProps} />);
  expect(getComputedStyle(getTrack(container)).backgroundImage).not.toContain(
    'linear-gradient',
  );
});
