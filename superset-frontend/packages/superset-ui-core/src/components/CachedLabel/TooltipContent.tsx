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
import { t } from '@apache-superset/core/translation';
import { extendedDayjs } from '../../utils/dates';
import type { CacheSource } from './types';

interface Props {
  cachedTimestamp?: string;
  cacheSource?: CacheSource;
}
export const TooltipContent: FC<Props> = ({
  cachedTimestamp,
  cacheSource = 'result',
}) => {
  const loadedText =
    cacheSource === 'semantic'
      ? {
          timestamped: t('Loaded from semantic cache'),
          untimed: t('Loaded from semantic cache'),
        }
      : {
          timestamped: t('Loaded data cached'),
          untimed: t('Loaded from cache'),
        };
  const cachedText = cachedTimestamp ? (
    <span>
      {loadedText.timestamped}
      <b> {extendedDayjs.utc(cachedTimestamp).fromNow()}</b>
    </span>
  ) : (
    loadedText.untimed
  );

  return (
    <span data-test="tooltip-content">
      {cachedText}. {t('Click to force-refresh')}
    </span>
  );
};
