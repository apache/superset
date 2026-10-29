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
import { styled } from '@apache-superset/core/theme';
import { FormItem } from '@superset-ui/core/components';
import { PluginFilterStylesProps } from './types';

export const RESPONSIVE_WIDTH = 0;

export const FilterPluginStyle = styled.div<PluginFilterStylesProps>`
  min-height: ${({ height }) => height}px;
  width: ${({ width }) => (width === RESPONSIVE_WIDTH ? '100%' : `${width}px`)};
  /* Filter value controls (Input / InputNumber / the Select search field) */
  /* resolve 'text-align' by inheritance. Pin the wrapper to the inline start */
  /* so the caret and typed text stay at the inline-start edge even when a */
  /* centered 'text-align' is inherited from an ancestor (e.g. a host-app */
  /* theme or css-in-js override). 'start' is the CSS default, so this is a */
  /* no-op unless a centered value is inherited, and it is RTL-safe. */
  text-align: start;
`;

export const StyledFormItem = styled(FormItem)`
  &.ant-row.ant-form-item {
    margin: 0;
  }
`;

export const StatusMessage = styled.div<{
  status?: 'error' | 'warning' | 'info' | 'help';
  centerText?: boolean;
}>`
  color: ${({ theme, status = 'error' }) => {
    if (status === 'help') {
      return theme.colorTextSecondary;
    }
    switch (status) {
      case 'error':
        return theme.colorError;
      case 'warning':
        return theme.colorWarning;
      case 'info':
        return theme.colorInfo;
      default:
        return theme.colorError;
    }
  }};
  text-align: ${({ centerText }) => (centerText ? 'center' : 'left')};
  width: 100%;
`;
