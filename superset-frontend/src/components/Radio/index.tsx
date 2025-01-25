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
import React from 'react';
import type { RadioChangeEvent, RadioGroupProps, RadioProps } from 'antd-v5';
import type { CheckboxGroupProps } from 'antd-v5/es/checkbox';

const verticalStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '15px'
}

// Wrapper for GroupVertical
const VerticalGroup = (props: RadioGroupProps) => { 
  return (
    <Antd5Radio.Group {...props} style={{ ...verticalStyle, ...props.style }} />)
}

export type { RadioChangeEvent, RadioGroupProps, RadioProps, CheckboxGroupProps };
export const Radio = Object.assign(Antd5Radio, {
  Group: Antd5Radio.Group,
  Button: Antd5Radio.Button,
  VerticalGroup: VerticalGroup
});

