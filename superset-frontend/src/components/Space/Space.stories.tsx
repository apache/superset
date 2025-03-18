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

/*
 * Re-exporting of components in src/components to facilitate
 * their imports by other components.
 * E.g. import { Select } from 'src/components'
 */

import { Space, SpaceProps } from 'src/components/Space';

export default {
  title: 'Space',
  component: Space,
};

export const InteractiveSpace = (args: SpaceProps) => (
  <Space {...args}>
    {new Array(20).fill(null).map((_, i) => (
      <p key={i}>Item</p>
    ))}
  </Space>
);

InteractiveSpace.args = {
  direction: 'horizontal',
  size: 'small',
  wrap: false,
};

InteractiveSpace.argTypes = {
  align: {
    control: { type: 'select' },
    options: ['start', 'end', 'center', 'baseline', ''],
  },
  direction: {
    control: { type: 'select' },
    options: ['vertical', 'horizontal'],
  },
  size: {
    control: { type: 'select' },
    options: ['small', 'middle', 'large'],
  },
};
