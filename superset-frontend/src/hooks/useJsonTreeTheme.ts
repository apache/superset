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
    base00: theme.colors.grayscale.dark2,
    base01: theme.colors.grayscale.dark1,
    base02: theme.colors.grayscale.base,
    base03: theme.colors.grayscale.light1,
    base04: theme.colors.grayscale.light2,
    base05: theme.colors.grayscale.light3,
    base06: theme.colors.grayscale.light4,
    base07: theme.colors.grayscale.light5,
    base08: theme.colors.error.base,
    base09: theme.colors.error.light1,
    base0A: theme.colors.error.light2,
    base0B: theme.colors.success.base,
    base0C: theme.colors.primary.light1,
    base0D: theme.colors.primary.base,
    base0E: theme.colors.primary.dark1,
    base0F: theme.colors.error.dark1,
  };
};
