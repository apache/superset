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

import { css } from '@emotion/react';
import { FilterBarOrientation } from 'src/dashboard/types';
import FilterDivider from './FilterDivider';
import { FilterDividerProps } from './types';

export default {
  title: 'FilterDivider',
  component: FilterDivider,
};

export const VerticalFilterDivider = (props: FilterDividerProps) => (
  <div
    css={css`
      background-color: #ddd;
      padding: 50px;
    `}
  >
    <div
      css={css`
        display: flex;
        flex-direction: column;
        width: 259px;
        padding: 16px;
        background-color: white;
      `}
    >
      <FilterDivider {...props} />
    </div>
  </div>
);

export const HorizontalFilterDivider = (props: FilterDividerProps) => (
  <div
    css={css`
      background-color: #ddd;
      padding: 50px;
    `}
  >
    <div
      css={css`
        height: 48px;
        padding: 0 16px;
        display: flex;
        align-items: center;
        background-color: white;
      `}
    >
      <FilterDivider orientation={FilterBarOrientation.Horizontal} {...props} />
    </div>
  </div>
);

export const HorizontalOverflowFilterDivider = (props: FilterDividerProps) => (
  <div
    css={css`
      background-color: #ddd;
      padding: 50px;
    `}
  >
    <div
      css={css`
        width: 224px;
        padding: 16px;
        background-color: white;
      `}
    >
      <FilterDivider {...props} />
    </div>
  </div>
);

const args = {
  title: 'Sample title',
  description: 'Sample description',
};

VerticalFilterDivider.args = {
  ...args,
  horizontal: false,
  overflow: false,
};

HorizontalFilterDivider.args = {
  ...args,
  horizontal: true,
  overflow: false,
};

HorizontalOverflowFilterDivider.args = {
  ...args,
  horizontal: true,
  overflow: true,
};
