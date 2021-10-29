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
import React from 'react';
import { styled } from '@superset-ui/core';
import { Badge as AntdBadge } from 'antd';
import { BadgeProps as AntdBadgeProps } from 'antd/lib/badge';

export interface BadgeProps extends AntdBadgeProps {
  textColor?: string;
}

const Badge = styled((
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  { textColor, ...props }: BadgeProps,
) => <AntdBadge {...props} />)`
  & > sup {
    padding: 0 ${({ theme }) => theme.gridUnit * 2}px;
    background: ${({ theme, color }) => color || theme.colors.primary.base};
    color: ${({ theme, textColor }) =>
      textColor || theme.colors.grayscale.light5};
  }
`;

export default Badge;
