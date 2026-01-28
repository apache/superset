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
import { Steps as AntdSteps } from 'antd';
import { Steps, type StepsProps } from '.';

export default {
  title: 'Components/Steps',
  component: Steps as typeof AntdSteps,
  parameters: {
    docs: {
      description: {
        component:
          'A navigation component for guiding users through multi-step workflows. Supports horizontal, vertical, and inline layouts with progress tracking.',
      },
    },
  },
};

export const InteractiveSteps = (args: StepsProps) => <Steps {...args} />;

InteractiveSteps.args = {
  direction: 'horizontal',
  current: 1,
  labelPlacement: 'horizontal',
  progressDot: false,
  size: 'default',
  status: 'process',
  type: 'default',
  items: [
    {
      title: 'Step 1',
      description: 'Description 1',
    },
    {
      title: 'Step 2',
      description: 'Description 2',
    },
    {
      title: 'Step 3',
      description: 'Description 3',
    },
  ],
};

InteractiveSteps.argTypes = {
  direction: {
    control: { type: 'select' },
    options: ['horizontal', 'vertical'],
    description: 'Layout direction of the steps.',
  },
  current: {
    control: { type: 'number' },
    description: 'Index of the current step (zero-based).',
  },
  labelPlacement: {
    control: { type: 'select' },
    options: ['horizontal', 'vertical'],
    description: 'Position of step labels relative to the step icon.',
  },
  progressDot: {
    control: 'boolean',
    description: 'Whether to use a dot style instead of numbered icons.',
  },
  size: {
    control: { type: 'select' },
    options: ['default', 'small'],
    description: 'Size of the step icons and text.',
  },
  status: {
    control: { type: 'select' },
    options: ['wait', 'process', 'finish', 'error'],
    description: 'Status of the current step.',
  },
  type: {
    control: { type: 'select' },
    options: ['default', 'navigation', 'inline'],
    description: 'Visual style: default numbered, navigation breadcrumb, or inline compact.',
  },
};

InteractiveSteps.parameters = {
  docs: {
    staticProps: {
      items: [
        { title: 'Connect Database', description: 'Configure the connection' },
        { title: 'Create Dataset', description: 'Select tables and columns' },
        { title: 'Build Chart', description: 'Choose visualization type' },
      ],
    },
    liveExample: `function Demo() {
  return (
    <Steps
      current={1}
      items={[
        { title: 'Connect Database', description: 'Configure the connection' },
        { title: 'Create Dataset', description: 'Select tables and columns' },
        { title: 'Build Chart', description: 'Choose visualization type' },
      ]}
    />
  );
}`,
    examples: [
      {
        title: 'Vertical Steps',
        code: `function VerticalSteps() {
  return (
    <Steps
      direction="vertical"
      current={1}
      items={[
        { title: 'Upload CSV', description: 'Select a file from your computer' },
        { title: 'Configure Columns', description: 'Set data types and names' },
        { title: 'Review', description: 'Verify the data looks correct' },
        { title: 'Import', description: 'Save the dataset' },
      ]}
    />
  );
}`,
      },
      {
        title: 'Status Indicators',
        code: `function StatusSteps() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      <div>
        <h4>Error on Step 2</h4>
        <Steps
          current={1}
          status="error"
          items={[
            { title: 'Connection', description: 'Configured' },
            { title: 'Validation', description: 'Failed to validate' },
            { title: 'Complete' },
          ]}
        />
      </div>
      <div>
        <h4>All Complete</h4>
        <Steps
          current={3}
          items={[
            { title: 'Step 1' },
            { title: 'Step 2' },
            { title: 'Step 3' },
          ]}
        />
      </div>
    </div>
  );
}`,
      },
      {
        title: 'Dot Style and Small Size',
        code: `function DotAndSmall() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      <div>
        <h4>Progress Dots</h4>
        <Steps
          progressDot
          current={1}
          items={[
            { title: 'Create', description: 'Define the resource' },
            { title: 'Configure', description: 'Set parameters' },
            { title: 'Deploy', description: 'Go live' },
          ]}
        />
      </div>
      <div>
        <h4>Small Size</h4>
        <Steps
          size="small"
          current={2}
          items={[
            { title: 'Login' },
            { title: 'Verify' },
            { title: 'Done' },
          ]}
        />
      </div>
    </div>
  );
}`,
      },
    ],
  },
};
