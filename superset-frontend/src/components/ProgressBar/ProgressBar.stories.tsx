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
import { AntdThemeProvider } from 'src/components/AntdThemeProvider';
import ProgressBar, { ProgressBarProps } from '.';

export default {
  title: 'ProgressBar',
  component: ProgressBar,
};

export const InteractiveProgressBar = (args: ProgressBarProps) => (
  <AntdThemeProvider>
    <ProgressBar {...args} type="line" />
  </AntdThemeProvider>
);

export const InteractiveProgressCircle = (args: ProgressBarProps) => (
  <AntdThemeProvider>
    <ProgressBar {...args} type="circle" />
  </AntdThemeProvider>
);

export const InteractiveProgressDashboard = (args: ProgressBarProps) => (
  <AntdThemeProvider>
    <ProgressBar {...args} type="dashboard" />
  </AntdThemeProvider>
);

const commonArgs = {
  striped: true,
  percent: 90,
  showInfo: true,
  strokeColor: '#FF0000',
  trailColor: '#000',
  strokeLinecap: 'round',
  type: 'line',
};

const commonArgTypes = {
  strokeLinecap: {
    control: {
      type: 'select',
    },
    options: ['round', 'butt', 'square'],
  },
  type: {
    control: {
      type: 'select',
    },
    options: ['line', 'circle', 'dashboard'],
  },
};

InteractiveProgressBar.args = {
  ...commonArgs,
  status: 'normal',
};

InteractiveProgressBar.argTypes = {
  ...commonArgTypes,
  status: {
    control: {
      type: 'select',
    },
    options: ['normal', 'success', 'exception', 'active'],
  },
};

InteractiveProgressCircle.args = commonArgs;

InteractiveProgressCircle.argTypes = commonArgTypes;

InteractiveProgressDashboard.args = commonArgs;

InteractiveProgressDashboard.argTypes = commonArgTypes;
