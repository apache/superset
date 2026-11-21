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

import { styled, css } from '@apache-superset/core/theme';
import { Card, Typography } from '@superset-ui/core/components';
import { ensureStaticPrefix } from 'src/utils/assetUrl';

// Shared by the sign-in page and the password recovery pages so every
// signed-out auth screen renders the same card.
export const StyledCard = styled(Card)`
  ${({ theme }) => css`
    max-width: 400px;
    width: 100%;
    margin-top: ${theme.marginXL}px;
    color: ${theme.colorBgContainer};
    background: ${theme.colorBgBase};
    .ant-form-item-label label {
      color: ${theme.colorPrimary};
    }
  `}
`;

export const StyledLabel = styled(Typography.Text)`
  ${({ theme }) => css`
    font-size: ${theme.fontSizeSM}px;
  `}
`;

export const StyledBackground = styled.div`
  ${({ theme }) => {
    const bgImageUrl = ensureStaticPrefix(theme.loginPageBackgroundImageUrl);
    const overlayColor =
      theme.loginPageBackgroundOverlayColor || theme.colorBgMask;
    const blurAmount = theme.loginPageBackgroundBlur || '0px';
    return bgImageUrl
      ? css`
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          z-index: 0;
          pointer-events: none;

          &::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-image: url('${CSS.escape(bgImageUrl)}');
            background-size: cover;
            background-position: center;
            filter: blur(${blurAmount});
            z-index: -1;
          }

          &::after {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: ${overlayColor};
            z-index: 1;
          }
        `
      : '';
  }}
`;

export const StyledBrandLogo = styled.img`
  display: block;
  max-width: 160px;
  max-height: 64px;
  margin: 0;
  object-fit: contain;
`;
