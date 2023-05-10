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
import cls from 'classnames';

export type PositionOption =
  | 'floating'
  | 'inline'
  | 'inline-centered'
  | 'normal';
export interface Props {
  position?: PositionOption;
  className?: string;
  image?: string;
}

// eslint-disable-next-line theme-colors/no-literal-colors
const LoaderImg = styled.div`
  z-index: 99;
  width: 72px;
  position: relative;
  margin: 10px;
  text-align: center;
  animation: shimmerLogo 1.5s infinite;
  mask: linear-gradient(-60deg, #000 30%, #0005, #000 70%) right/300% 100%;
  &.inline {
    margin: 0px;
    width: 30px;
  }
  &.inline-centered {
    margin: 0 auto;
    width: 30px;
    display: block;
  }
  &.floating {
    padding: 0;
    margin: 0;
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
  }
  @keyframes shimmerLogo {
    100% {
      mask-position: left;
    }
  }
`;
export default function Loading({
  position = 'floating',
  // image = '/static/assets/images/loading.gif',
  className,
}: Props) {
  return (
    <LoaderImg
      className={cls('loading', position, className)}
      // alt="Loading..."
      // src={image}
      role="status"
      aria-live="polite"
      aria-label="Loading"
    >
      <svg
        width="50"
        height="40"
        viewBox="0 0 202 202"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M178.85 112.675V8.14886L126.587 60.412L178.85 112.675Z"
          fill="#EF4A42"
        />
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M176.466 126.587L118.44 68.5613L60.4146 126.587L118.44 184.612L176.466 126.587Z"
          fill="#824EF0"
        />
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M52.2631 134.737L0 187H104.526L52.2631 134.737Z"
          fill="#364EED"
        />
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M46.501 112.675L46.501 66.1744L0.000244141 66.1744L46.501 112.675Z"
          fill="#1FA089"
        />
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M110.288 60.4132L58.025 8.1501L58.025 112.676L110.288 60.4132Z"
          fill="#99DBEF"
        />
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M235.601 0L190.377 0L190.377 45.2237L235.601 0Z"
          fill="#F8B03B"
        />
      </svg>
    </LoaderImg>
  );
}
