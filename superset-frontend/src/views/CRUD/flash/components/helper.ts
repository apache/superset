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
import { Theme } from '@emotion/react';
import { FLASH_STATUS_ENUMS } from '../constants';
import { FlashTypes } from '../enums';

export const getFlashTypeColor = (type: string, theme: Theme) => {
  if (type === FlashTypes.ONE_TIME) {
    return theme.colors.error.light1;
  }
  if (type === FlashTypes.SHORT_TERM) {
    return theme.colors.warning.light1;
  }
  if (type === FlashTypes.LONG_TERM) {
    return theme.colors.success.light1;
  }
  return theme.colors.grayscale.light1;
};

export const getFlashStatusColor = (status: string, theme: Theme) => {
  if (
    status === FLASH_STATUS_ENUMS.NEW ||
    status === FLASH_STATUS_ENUMS.UPDATED ||
    status === FLASH_STATUS_ENUMS.IN_PROGRESS
  ) {
    return {
      light: theme.colors.warning.light1,
      dark: theme.colors.warning.dark1,
    };
  }
  if (status === FLASH_STATUS_ENUMS.MATERIALIZED) {
    return {
      light: theme.colors.success.light1,
      dark: theme.colors.success.dark2,
    };
  }
  if (
    status === FLASH_STATUS_ENUMS.MATERIALIZED_FAILED ||
    status === FLASH_STATUS_ENUMS.DELETED ||
    status === FLASH_STATUS_ENUMS.MARKED_FOR_DELETION
  ) {
    return {
      light: theme.colors.error.light1,
      dark: theme.colors.error.dark1,
    };
  }
  return {
    light: theme.colors.grayscale.light1,
    dark: theme.colors.grayscale.dark1,
  };
};
