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
import { Radio as Antd5Radio } from 'antd-v5';
import type {
  RadioChangeEvent,
  RadioProps,
  RadioGroupProps,
  CheckboxOptionType,
} from 'antd-v5';
import { Space, SpaceProps } from 'src/components/Space';

export type RadioGroupWrapperProps = RadioGroupProps & {
  useSpace?: boolean;
  direction?: SpaceProps['direction'];
  spaceSize?: SpaceProps['size'];
  align?: SpaceProps['align'];
  options?: CheckboxOptionType[];
  children?: React.ReactNode;
};

const RadioGroup = ({
  useSpace,
  direction,
  spaceSize,
  options,
  children,
  ...props
}: RadioGroupWrapperProps) => {
  const content = options
    ? options.map((option: CheckboxOptionType) => (
        <Radio key={option.value} value={option.value}>
          {option.label}
        </Radio>
      ))
    : children;

  return (
    <Radio.Group {...props}>
      {useSpace ? (
        <Space direction={direction} size={spaceSize}>
          {content}
        </Space>
      ) : (
        content
      )}
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
