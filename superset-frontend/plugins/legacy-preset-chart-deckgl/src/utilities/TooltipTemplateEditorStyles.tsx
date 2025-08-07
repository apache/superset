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

export const StyledComponents = styled.div`
  ${({ theme }) => `
    .template-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: ${theme.sizeUnit * 2}px;
      padding: ${theme.sizeUnit * 2}px;
      background-color: ${theme.colorBgElevated};
      border-radius: ${theme.sizeUnit}px;
      border: 1px solid ${theme.colorBorderSecondary};
    }

    .available-fields {
      display: flex;
      flex-wrap: wrap;
      gap: ${theme.sizeUnit}px;
      margin-top: ${theme.sizeUnit * 2}px;
    }

    .field-tag {
      background-color: ${theme.colorPrimaryBg};
      color: ${theme.colorPrimaryText};
      padding: ${theme.sizeUnit}px ${theme.sizeUnit * 2}px;
      border-radius: ${theme.sizeUnit * 2}px;
      font-size: ${theme.fontSizeSM}px;
      font-family: Monaco, monospace;
      cursor: pointer;
      transition: all 0.2s ease;
      border: 1px solid ${theme.colorPrimaryBorder} !important;

      &:hover {
        background-color: ${theme.colorPrimaryBgHover} !important;
        transform: translateY(-1px);
        box-shadow: ${theme.boxShadowSecondary};
      }

      &:active {
        transform: translateY(0);
      }

      &:focus {
        outline: 2px solid ${theme.colorPrimary};
        outline-offset: 2px;
      }
    }

    .template-editor {
      margin-top: ${theme.sizeUnit * 2}px;

      textarea {
        width: 100%;
        min-height: 180px;
        padding: ${theme.sizeUnit * 2}px;
        border: 1px solid ${theme.colorBorderSecondary};
        border-radius: ${theme.sizeUnit}px;
        font-family: Monaco, 'Courier New', monospace;
        font-size: 13px;
        line-height: 1.4;
        resize: vertical;
        background-color: ${theme.colorBgContainer};

        &:focus {
          outline: none;
          border-color: ${theme.colorPrimary};
          box-shadow: 0 0 0 2px ${theme.colorPrimaryBg};
        }
      }
    }

    .template-help {
      margin-top: ${theme.sizeUnit * 2}px;
      padding: ${theme.sizeUnit * 2}px;
      background-color: ${theme.colorBgElevated};
      border-radius: ${theme.sizeUnit}px;
      border: 1px solid ${theme.colorBorderSecondary};
      font-size: ${theme.fontSizeSM}px;

      .help-section {
        margin-bottom: ${theme.sizeUnit * 2}px;

        &:last-child {
          margin-bottom: 0;
        }
      }

      .help-title {
        font-weight: bold;
        color: ${theme.colorText};
        margin-bottom: ${theme.sizeUnit}px;
      }

      .help-example {
        background-color: ${theme.colorFillSecondary};
        padding: ${theme.sizeUnit * 2}px;
        border-radius: ${theme.sizeUnit}px;
        margin: ${theme.sizeUnit}px 0;
        font-family: Monaco, monospace;
        font-size: 12px;
        color: ${theme.colorText};
        white-space: pre-wrap;
        overflow-x: auto;
      }
    }

    .variable-counter {
      color: ${theme.colorTextSecondary};
      font-size: ${theme.fontSizeSM}px;
      font-style: italic;
    }
  `}
`;

export const NoFieldsMessage = styled.p`
  margin-top: ${({ theme }) => theme.sizeUnit * 2}px;
  font-style: italic;
  color: ${({ theme }) => theme.colorTextSecondary};
  text-align: center;
  padding: ${({ theme }) => theme.sizeUnit * 5}px;
`;

export const HelpToggleButton = styled.button`
  padding: ${({ theme }) => theme.sizeUnit}px
    ${({ theme }) => theme.sizeUnit * 2}px;
  font-size: ${({ theme }) => theme.fontSizeXS}px;
  border: none;
  background: transparent;
  cursor: pointer;
  text-decoration: underline;
  color: ${({ theme }) => theme.colorPrimary};

  &:hover {
    color: ${({ theme }) => theme.colorPrimaryBorder};
  }

  &:focus {
    outline: 2px solid ${({ theme }) => theme.colorPrimary};
    outline-offset: 2px;
  }
`;
