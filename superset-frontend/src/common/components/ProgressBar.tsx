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
// eslint-disable-next-line no-restricted-imports
import { Progress as AntdProgress } from 'antd';
import { ProgressProps } from 'antd/lib/progress/progress';

interface ProgressBarProps extends ProgressProps {
  striped?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const ProgressBar = styled(({ striped, ...props }: ProgressBarProps) => (
  <AntdProgress {...props} />
))`
  line-height: 0;
  .ant-progress-outer {
    ${({ percent }) => !percent && `display: none;`}
  }
  .ant-progress-text {
    font-size: ${({ theme }) => theme.typography.sizes.s}px;
  }
  .ant-progress-bg {
    ${({ striped }) =>
      striped &&
      `
        background-image: linear-gradient(45deg,
            rgba(255, 255, 255, 0.15) 25%,
            transparent 25%, transparent 50%,
            rgba(255, 255, 255, 0.15) 50%,
            rgba(255, 255, 255, 0.15) 75%,
            transparent 75%, transparent);
        background-size: 1rem 1rem; `};
  }
`;

export default ProgressBar;
