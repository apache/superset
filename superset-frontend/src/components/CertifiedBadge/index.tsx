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
import { t, useTheme } from '@superset-ui/core';
import Icons, { IconType } from 'src/components/Icons';
import { Tooltip } from 'src/components/Tooltip';

export interface CertifiedBadgeProps {
  certifiedBy?: string;
  details?: string;
  size?: IconType['iconSize'];
}

function CertifiedBadge({
  certifiedBy,
  details,
  size = 'l',
}: CertifiedBadgeProps) {
  const theme = useTheme();

  return (
    <Tooltip
      id="certified-details-tooltip"
      title={
        <>
          {certifiedBy && (
            <div>
              <strong>{t('Certified by %s', certifiedBy)}</strong>
            </div>
          )}
          <div>{details}</div>
        </>
      }
    >
      <Icons.Certified iconColor={theme.colors.primary.base} iconSize={size} />
    </Tooltip>
  );
}

export default CertifiedBadge;
