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
import { useTheme } from '@superset-ui/core';
import Collapse, { CollapseProps } from '.';

export default {
  title: 'Collapse',
  component: Collapse,
};

export const InteractiveCollapse = (args: CollapseProps) => {
  const theme = useTheme();
  return (
    <Collapse
      defaultActiveKey={['1']}
      style={
        args.light ? { background: theme.colors.grayscale.light2 } : undefined
      }
      {...args}
    >
      <Collapse.Panel header="Header 1" key="1">
        Content 1
      </Collapse.Panel>
      <Collapse.Panel header="Header 2" key="2">
        Content 2
      </Collapse.Panel>
    </Collapse>
  );
};

InteractiveCollapse.args = {
  ghost: false,
  bordered: true,
  accordion: false,
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
