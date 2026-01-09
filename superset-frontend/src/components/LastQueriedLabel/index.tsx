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
import { FC } from 'react';
import { t, css, useTheme } from '@superset-ui/core';
import { extendedDayjs } from 'src/utils/dates';

interface LastQueriedLabelProps {
  queriedDttm: string | null;
}

const LastQueriedLabel: FC<LastQueriedLabelProps> = ({ queriedDttm }) => {
  const theme = useTheme();

  if (!queriedDttm) {
    return null;
  }

  const parsedDate = extendedDayjs.utc(queriedDttm);
  if (!parsedDate.isValid()) {
    return null;
  }

  const formattedTime = parsedDate.local().format('L LTS');

  return (
    <div
      css={css`
        font-size: ${theme.typography.sizes.s}px;
        color: ${theme.colors.text.label};
        padding: ${theme.gridUnit / 2}px ${theme.gridUnit}px;
        text-align: right;
      `}
      data-test="last-queried-label"
    >
      {t('Last queried at')}: {formattedTime}
    </div>
  );
};

export default LastQueriedLabel;
