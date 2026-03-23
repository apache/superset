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
import { t } from '@apache-superset/core/translation';
import { useTheme } from '@apache-superset/core/theme';
import { Icons } from '@superset-ui/core/components/Icons';
import { Tooltip } from '../Tooltip';
import type { IconType } from '@superset-ui/core/components/Icons/types';

export interface RlsFilterSummary {
  id: number;
  name: string;
  filter_type: string;
  group_key?: string | null;
  inherited?: boolean;
  clause?: string;
  roles?: Array<{ id: number; name: string }>;
}

export interface RlsBadgeProps {
  rlsFilters: RlsFilterSummary[];
  size?: IconType['iconSize'];
}

export function RlsBadge({ rlsFilters, size = 'l' }: RlsBadgeProps) {
  const theme = useTheme();

  if (!rlsFilters?.length) {
    return null;
  }

  const hasInherited = rlsFilters.some(f => f.inherited);

  const tooltipContent = (
    <div>
      <strong>
        {t(
          'Row-Level Security: %d filter(s) may restrict data based on your role.',
          rlsFilters.length,
        )}
      </strong>
      <ul style={{ paddingLeft: 16, margin: '4px 0 0' }}>
        {rlsFilters.map(filter => (
          <li key={filter.id}>
            <div>
              {filter.name} ({filter.filter_type})
              {filter.group_key ? ` [${filter.group_key}]` : ''}
              {filter.inherited ? ` — ${t('from underlying table')}` : ''}
            </div>
            {filter.roles && filter.roles.length > 0 && (
              <div>
                {t('Roles')}: {filter.roles.map(role => role.name).join(', ')}
              </div>
            )}
            {filter.clause && (
              <div>
                {t('Clause')}: {filter.clause}
              </div>
            )}
          </li>
        ))}
      </ul>
      {hasInherited && (
        <div style={{ marginTop: 4, fontStyle: 'italic' }}>
          {t(
            'Some filters are inherited from physical tables referenced in this virtual dataset.',
          )}
        </div>
      )}
    </div>
  );

  return (
    <Tooltip id="rls-badge-tooltip" title={tooltipContent}>
      <Icons.LockOutlined iconColor={theme.colorWarning} iconSize={size} />
    </Tooltip>
  );
}
