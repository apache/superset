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
import ProgressBar, { ProgressBarProps } from '.';

export default {
  title: 'Components/ProgressBar',
  component: ProgressBar,
  parameters: {
    docs: {
      description: {
        component:
          'Progress bar component for displaying completion status. Supports line, circle, and dashboard display types.',
      },
    },
  },
};

export const InteractiveProgressBar = (args: ProgressBarProps) => (
  <ProgressBar {...args} type="line" />
);

export const InteractiveProgressCircle = (args: ProgressBarProps) => (
  <ProgressBar {...args} type="circle" />
);

export const InteractiveProgressDashboard = (args: ProgressBarProps) => (
  <ProgressBar {...args} type="dashboard" />
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
  percent: {
    control: { type: 'number', min: 0, max: 100 },
    description: 'Completion percentage (0-100).',
  },
  striped: {
    control: 'boolean',
    description: 'Whether to show striped animation on the bar.',
  },
  showInfo: {
    control: 'boolean',
    description: 'Whether to show the percentage text.',
  },
  strokeColor: {
    control: 'color',
    description: 'Color of the progress bar.',
  },
  trailColor: {
    control: 'color',
    description: 'Color of the unfilled portion.',
  },
  strokeLinecap: {
    control: 'select',
    options: ['round', 'butt', 'square'],
    description: 'Shape of the progress bar endpoints.',
  },
  type: {
    control: 'select',
    options: ['line', 'circle', 'dashboard'],
    description: 'Display type: line, circle, or dashboard gauge.',
  },
};

InteractiveProgressBar.args = {
  ...commonArgs,
  status: 'normal',
};

InteractiveProgressBar.argTypes = {
  ...commonArgTypes,
  status: {
    control: 'select',
    options: ['normal', 'success', 'exception', 'active'],
    description: 'Current status of the progress bar.',
  },
};

InteractiveProgressBar.parameters = {
  docs: {
    examples: [
      {
        title: 'All Progress Types',
        code: `function AllTypesDemo() {
  return (
    <div style={{ display: 'flex', gap: 40, alignItems: 'center' }}>
      <div style={{ flex: 1 }}>
        <h4>Line</h4>
        <ProgressBar percent={75} type="line" />
      </div>
      <div>
        <h4>Circle</h4>
        <ProgressBar percent={75} type="circle" />
      </div>
      <div>
        <h4>Dashboard</h4>
        <ProgressBar percent={75} type="dashboard" />
      </div>
    </div>
  );
}`,
      },
      {
        title: 'Status Variants',
        code: `function StatusDemo() {
  const statuses = ['normal', 'success', 'exception', 'active'];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {statuses.map(status => (
        <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ width: 80 }}>{status}</span>
          <ProgressBar percent={75} status={status} type="line" style={{ flex: 1 }} />
        </div>
      ))}
    </div>
  );
}`,
      },
    ],
  },
};

InteractiveProgressCircle.args = commonArgs;

InteractiveProgressCircle.argTypes = commonArgTypes;

InteractiveProgressDashboard.args = commonArgs;

InteractiveProgressDashboard.argTypes = commonArgTypes;
