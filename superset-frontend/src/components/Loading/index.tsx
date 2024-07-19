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
        id="Identity"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 570 570"
      >
        <defs>
          <style>{`.cls-1{fill:url(#linear-gradient);}`}</style>
          <linearGradient
            id="linear-gradient"
            x1="102.8"
            y1="411.52"
            x2="427.29"
            y2="87.02"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset=".17" stopColor="#aa83ff" />
            <stop offset=".75" stopColor="#7822ff" />
          </linearGradient>
        </defs>
        <path
          className="cls-1"
          d="m372.93,326.81l-86.68,86.68-86.68-86.68,86.68-86.68,86.68,86.68Zm-272.09,98.68h173.36l-86.68-86.68-86.68,86.68Zm284.08-110.73v-86.68s0-86.68,0-86.68l-86.68,86.68,86.68,86.68Zm-110.76-86.68l-86.68-86.68v86.68s0,86.68,0,86.68l86.68-86.68Zm127.89-22.98l31.85-31.85,31.85-31.85h-63.7s0,63.7,0,63.7Zm-292.75,31.48l30.65,30.65,30.65,30.65v-61.29s-61.29,0-61.29,0Z"
        />
      </svg>
    </LoaderImg>
  );
}
