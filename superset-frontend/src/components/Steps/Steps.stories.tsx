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
import { Steps as AntdSteps } from 'antd-v5';
import { Steps, StepsProps } from '.';

export default {
  title: 'Steps',
  component: Steps as typeof AntdSteps,
};

export const InteractiveSteps = (args: StepsProps) => <Steps {...args} />;
InteractiveSteps.args = {
  direction: 'horizontal',
  initial: 0,
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
    options: ['horizontal', 'vertical'],
    control: { type: 'select' },
  },
  labelPlacement: {
    options: ['horizontal', 'vertical'],
    control: { type: 'select' },
  },
  size: {
    options: ['default', 'small'],
    control: { type: 'select' },
  },
  status: {
    options: ['wait', 'process', 'finish', 'error'],
    control: { type: 'select' },
  },
  type: {
    options: ['default', 'navigation', 'inline'],
    control: { type: 'select' },
  },
};
