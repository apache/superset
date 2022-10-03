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
import { FeatureFlag, isFeatureEnabled, t } from '@superset-ui/core';
import { detectOS } from 'src/utils/common';

export const getSliceHeaderTooltip = (sliceName: string | undefined) => {
  if (isFeatureEnabled(FeatureFlag.DASHBOARD_EDIT_CHART_IN_NEW_TAB)) {
    return sliceName
      ? t('Click to edit %s in a new tab', sliceName)
      : t('Click to edit chart.');
  }
  const isMac = detectOS() === 'MacOS';
  const firstLine = sliceName
    ? t('Click to edit %s.', sliceName)
    : t('Click to edit chart.');
  const secondLine = t(
    'Use %s to open in a new tab.',
    isMac ? '⌘ + click' : 'ctrl + click',
  );
  return (
    <>
      <div>{firstLine}</div>
      <div>{secondLine}</div>
    </>
  );
};
