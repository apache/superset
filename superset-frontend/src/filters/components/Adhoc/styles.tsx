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

import { styled } from '@superset-ui/core';

export const AdhocControlContainer = styled.div<{
  validateStatus?: 'error' | 'warning' | 'info';
}>`
    border: 1px solid transparent;

    & div.ControlHeader,
    & button{
      visibility: hidden;
      height: 0;
      width 0;
    }

    &:hover{
      transition-duration: ${({ theme }) => theme.transitionTiming}s;
      transition-property: border-color, box-shadow;
      transition-timing-function: ease-in-out;
      border: ${({ theme, validateStatus }) =>
        `1px solid ${
          validateStatus
            ? theme.colors[validateStatus]?.base
            : theme.colors.primary.base
        }`} !important;
      border-radius: ${({ theme }) => theme.borderRadius}px;
    }

    &:focus{
      transition-duration: ${({ theme }) => theme.transitionTiming}s;
      transition-property: border-color, box-shadow;
      transition-timing-function: ease-in-out;
      border: ${({ theme, validateStatus }) =>
        `1px solid ${
          validateStatus
            ? theme.colors[validateStatus]?.base
            : theme.colors.primary.base
        }`} !important;
      border-radius: ${({ theme }) => theme.borderRadius}px;
      box-shadow: 0 0 0 2px
        ${({ validateStatus }) =>
          validateStatus
            ? 'rgba(224, 67, 85, 12%)'
            : 'rgba(32, 167, 201, 0.2)'};
    }
  `;
