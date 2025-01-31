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
import { Radio as Antd5Radio, CheckboxOptionType } from 'antd-v5';
import type {
  RadioChangeEvent,
  RadioProps,
  RadioGroupProps,
} from 'antd-v5/lib/radio';

import { Space, SpaceProps } from 'src/components/Space';

export type RadioGroupWrapperProps = RadioGroupProps & {
  spaceConfig?: {
    direction?: SpaceProps['direction'];
    size?: SpaceProps['size'];
    align?: SpaceProps['align'];
    wrap?: SpaceProps['wrap'];
  };
  options: CheckboxOptionType[];
};

const RadioGroup = ({
  spaceConfig,
  options,
  ...props
}: RadioGroupWrapperProps) => {
  const content = options.map((option: CheckboxOptionType) => (
    <Radio key={option.value} value={option.value}>
      {option.label}
    </Radio>
  ));
  return (
    <Radio.Group {...props}>
      {spaceConfig ? <Space {...spaceConfig}>{content}</Space> : content}
    </Radio.Group>
  );
};
export type {
  RadioChangeEvent,
  RadioGroupProps,
  RadioProps,
  CheckboxOptionType,
};
export const Radio = Object.assign(Antd5Radio, {
  GroupWrapper: RadioGroup,
  Button: Antd5Radio.Button,
});
