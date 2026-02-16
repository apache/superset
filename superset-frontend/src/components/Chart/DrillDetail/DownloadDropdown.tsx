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

import { t } from '@apache-superset/core';
import { css, useTheme } from '@apache-superset/core/ui';
import { Dropdown, Tooltip } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';

interface DownloadDropdownProps {
  onDownloadCSV: () => void;
  onDownloadXLSX: () => void;
}

const DownloadDropdown = ({
  onDownloadCSV,
  onDownloadXLSX,
}: DownloadDropdownProps) => {
  const theme = useTheme();
  return (
    <Dropdown
      trigger={['click']}
      menu={{
        onClick: ({ key }) => {
          if (key === 'csv') {
            onDownloadCSV();
          } else if (key === 'xlsx') {
            onDownloadXLSX();
          }
        },
        items: [
          {
            key: 'csv',
            label: t('Export to CSV'),
            icon: <Icons.FileOutlined />,
          },
          {
            key: 'xlsx',
            label: t('Export to Excel'),
            icon: <Icons.FileOutlined />,
          },
        ],
      }}
    >
      <Tooltip title={t('Download')}>
        <Icons.DownloadOutlined
          iconColor={theme.colorIcon}
          iconSize="l"
          aria-label={t('Download')}
          role="button"
          data-test="drill-detail-download-btn"
          css={css`
            &.anticon > * {
              line-height: 0;
            }
          `}
        />
      </Tooltip>
    </Dropdown>
  );
};

export default DownloadDropdown;
