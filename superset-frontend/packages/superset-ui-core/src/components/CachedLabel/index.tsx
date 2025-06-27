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
import { useState, FC } from 'react';

import { t } from '@superset-ui/core';
import { Icons } from '@superset-ui/core/components/Icons';
import { Label } from '../Label';
import { Tooltip } from '../Tooltip';
import { TooltipContent } from './TooltipContent';
import type { CacheLabelProps } from './types';

export const CachedLabel: FC<CacheLabelProps> = ({
  className,
  onClick,
  cachedTimestamp,
}) => {
  const [hovered, setHovered] = useState(false);

  const labelType = hovered ? 'info' : 'default';
  return (
    <Tooltip
      title={<TooltipContent cachedTimestamp={cachedTimestamp} />}
      id="cache-desc-tooltip"
    >
      <Label
        className={`${className}`}
        type={labelType}
        onClick={onClick}
        onMouseOver={() => setHovered(true)}
        onMouseOut={() => setHovered(false)}
        icon={<Icons.SyncOutlined iconSize="m" />}
      >
        {t('Cached')}
      </Label>
    </Tooltip>
  );
};

export type { CacheLabelProps };
