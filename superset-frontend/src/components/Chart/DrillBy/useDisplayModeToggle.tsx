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

import { useMemo, useState } from 'react';
import { css, SupersetTheme, t } from '@superset-ui/core';
import { Radio } from 'src/components/Radio';
import { DrillByType } from '../types';

export const useDisplayModeToggle = () => {
  const [drillByDisplayMode, setDrillByDisplayMode] = useState<DrillByType>(
    DrillByType.Chart,
  );

  const displayModeToggle = useMemo(
    () => (
      <div
        css={(theme: SupersetTheme) => css`
          margin-bottom: ${theme.gridUnit * 6}px;
        `}
        data-test="drill-by-display-toggle"
      >
        <Radio.GroupWrapper
          onChange={({ target: { value } }) => {
            setDrillByDisplayMode(value);
          }}
          defaultValue={DrillByType.Chart}
          options={[
            { label: t('Chart'), value: DrillByType.Chart },
            { label: t('Table'), value: DrillByType.Table },
          ]}
          optionType="button"
          buttonStyle="outline"
        />
      </div>
    ),
    [],
  );
  return { displayModeToggle, drillByDisplayMode };
};
