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
import { css } from '@superset-ui/core';
import { Global } from '@emotion/react';
import { mix } from 'polished';

export const GlobalStyles = () => (
  <Global
    styles={theme => css`
      h1,
      h2,
      h3,
      h4,
      h5,
      h6,
      strong,
      th {
        font-weight: ${theme.typography.weights.bold};
      }
      // TODO: Remove when on Ant Design 5.
      // Check src/components/Modal for more info.
      .modal-functions-ok-button {
        border-radius: ${theme.borderRadius}px;
        background: ${theme.colors.primary.base};
        border: none;
        text-transform: uppercase;
        color: ${theme.colors.grayscale.light5};
        line-height: 1.5715;
        font-size: ${theme.typography.sizes.s}px;
        font-weight: ${theme.typography.weights.bold};
        &:hover {
          background: ${theme.colors.primary.dark1};
        }
      }
      .modal-functions-cancel-button {
        border-radius: ${theme.borderRadius}px;
        background: ${theme.colors.primary.light4};
        border: none;
        text-transform: uppercase;
        color: ${theme.colors.primary.dark1};
        line-height: 1.5715;
        font-size: ${theme.typography.sizes.s}px;
        font-weight: ${theme.typography.weights.bold};
        &:hover {
          background: ${mix(
            0.1,
            theme.colors.primary.base,
            theme.colors.primary.light4,
          )};
        }
      }
    `}
  />
);
