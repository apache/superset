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
import { Collapse } from '.';
import type { CollapseProps } from './types';

export default {
  title: 'Components/Collapse',
  component: Collapse,
};

export const InteractiveCollapse = (args: CollapseProps) => (
  <Collapse
    defaultActiveKey={['1']}
    {...args}
    items={[
      {
        key: '1',
        label: 'Header 1',
        children: 'Content 1',
      },
      {
        key: '2',
        label: 'Header 2',
        children: 'Content 2',
      },
    ]}
  />
);

InteractiveCollapse.args = {
  ghost: false,
  bordered: true,
  accordion: false,
  animateArrows: false,
  modalMode: false,
};

InteractiveCollapse.argTypes = {
  theme: {
    table: {
      disable: true,
    },
  },
};

InteractiveCollapse.parameters = {
  actions: {
    disable: true,
  },
};
