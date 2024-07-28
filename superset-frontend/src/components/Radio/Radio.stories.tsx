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
import { Radio } from './index';

export default {
  title: 'Radio',
  component: Radio,
  parameters: {
    controls: { hideNoControlsWarning: true },
  },
  argTypes: {
    theme: {
      table: {
        disable: true,
      },
    },
    checked: { control: 'boolean' },
    disabled: { control: 'boolean' },
  },
};

export const SupersetRadio = () => {
  const [{ checked, ...rest }, updateArgs] = useArgs();
  return (
    <Radio
      checked={checked}
      onChange={() => updateArgs({ checked: !checked })}
      {...rest}
    >
      Example
    </Radio>
  );
};

SupersetRadio.args = {
  checked: false,
  disabled: false,
};
