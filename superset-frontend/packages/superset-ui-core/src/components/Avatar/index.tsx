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

import { forwardRef } from 'react';
import { Avatar as AntdAvatar } from 'antd';
import type { AvatarProps, GroupProps as AvatarGroupProps } from './types';

export const Avatar = forwardRef<HTMLSpanElement, AvatarProps>((props, ref) => (
  <AntdAvatar ref={ref} {...props} />
));

// antd Avatar.Group is a plain function component without forwardRef; wrap in
// a span so this component can be a Tooltip / Popover trigger and skip the
// findDOMNode fallback.
export const AvatarGroup = forwardRef<HTMLSpanElement, AvatarGroupProps>(
  (props, ref) => (
    <span ref={ref}>
      <AntdAvatar.Group {...props} />
    </span>
  ),
);

export type { AvatarProps, AvatarGroupProps };
