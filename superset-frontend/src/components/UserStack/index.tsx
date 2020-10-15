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
import { getCategoricalSchemeRegistry } from '@superset-ui/core';
import { Avatar, Tooltip } from 'src/common/components';
import { getRandomColor } from './utils';

interface UserStackProps {
  users: { first_name: string; last_name: string }[];
  maxCount?: number;
}

const colorList = getCategoricalSchemeRegistry().get()?.colors ?? [];
const AVATAR_STYLE = {
  width: '24px',
  height: '24px',
  fontSize: '20px',
  lineHeight: '24px',
};

export default function UserStack({ users, maxCount = 4 }: UserStackProps) {
  return (
    <Avatar.Group maxCount={maxCount} maxStyle={AVATAR_STYLE}>
      {users.map(({ first_name, last_name }) => {
        const name = `${first_name} ${last_name}`;
        return (
          <Tooltip key={name} title={name} placement="top">
            <Avatar
              key={name}
              style={{
                backgroundColor: getRandomColor(name, colorList),
                ...AVATAR_STYLE,
              }}
            >
              {first_name[0].toLocaleUpperCase()}
              {last_name[0].toLocaleUpperCase()}
            </Avatar>
          </Tooltip>
        );
      })}
    </Avatar.Group>
  );
}
