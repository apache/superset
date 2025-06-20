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
import { useTheme } from '@superset-ui/core';

export const useJsonTreeTheme = () => {
  const theme = useTheme();

  return {
    base00: theme.colorBgContainer,
    base01: theme.colorBgLayout,
    base02: theme.colorBorder,
    base03: theme.colorBorder,
    base04: theme.colorText,
    base05: theme.colorText,
    base06: theme.colorText,
    base07: theme.colorText,
    base08: theme.colorError,
    base09: theme.colorErrorHover,
    base0A: theme.colorErrorText,
    base0B: theme.colorSuccess,
    base0C: theme.colorPrimaryBgHover,
    base0D: theme.colorPrimary,
    base0E: theme.colorPrimaryActive,
    base0F: theme.colorErrorText,
  };
};
