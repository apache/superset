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
import { useArgs } from '@storybook/preview-api';
import { Switch, SwitchProps } from '.';

export default {
  title: 'Switch',
};

export const InteractiveSwitch = ({ checked, ...rest }: SwitchProps) => {
  const [, updateArgs] = useArgs();
  return (
    <Switch
      {...rest}
      checked={checked}
      onChange={value => updateArgs({ checked: value })}
    />
  );
};

InteractiveSwitch.args = {
  checked: false,
  disabled: false,
  loading: false,
  title: 'Switch',
};

InteractiveSwitch.argTypes = {
  size: {
    defaultValue: 'default',
    control: { type: 'radio' },
    options: ['small', 'default'],
  },
};
