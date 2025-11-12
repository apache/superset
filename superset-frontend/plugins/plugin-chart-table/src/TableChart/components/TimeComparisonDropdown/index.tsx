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
import { useMemo } from 'react';
import { t } from '@superset-ui/core';
import { styled } from '@apache-superset/core/ui';
import { Dropdown } from '@superset-ui/core/components';
import { CheckOutlined, DownOutlined, TableOutlined } from '@ant-design/icons';
import type { MenuInfo } from 'rc-menu/lib/interface';

export interface TimeComparisonDropdownProps {
  comparisonColumns: Array<{ key: string; label: string }>;
  selectedComparisonColumns: string[];
  onSelectedColumnsChange: (selected: string[]) => void;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const HelpText = styled.div`
  max-width: 242px;
  padding: 0 ${({ theme }) => theme.sizeUnit * 2}px;
  color: ${({ theme }) => theme.colorText};
  font-size: ${({ theme }) => theme.fontSizeSM}px;
`;

const ColumnLabel = styled.span`
  color: ${({ theme }) => theme.colorText};
`;

const CheckIconWrapper = styled.span`
  float: right;
  font-size: ${({ theme }) => theme.fontSizeSM}px;
`;

export default function TimeComparisonDropdown({
  comparisonColumns,
  selectedComparisonColumns,
  onSelectedColumnsChange,
  isOpen,
  onOpenChange,
}: TimeComparisonDropdownProps) {
  const allKey = comparisonColumns[0].key;
  const individualColumnCount = comparisonColumns.length - 1;

  const handleOnClick = (data: MenuInfo) => {
    const { key } = data;

    if (key === allKey) {
      onSelectedColumnsChange([allKey]);
      return;
    }

    if (selectedComparisonColumns.includes(allKey)) {
      onSelectedColumnsChange([key]);
      return;
    }

    onSelectedColumnsChange(
      selectedComparisonColumns.includes(key)
        ? selectedComparisonColumns.filter(k => k !== key)
        : [...selectedComparisonColumns, key],
    );
  };

  const handleOnBlur = () => {
    if (selectedComparisonColumns.length === individualColumnCount)
      onSelectedColumnsChange([allKey]);
  };

  const menuItems = useMemo(
    () => [
      {
        key: 'all',
        label: (
          <HelpText>
            {t(
              'Select columns that will be displayed in the table. You can multiselect columns.',
            )}
          </HelpText>
        ),
        type: 'group' as const,
        children: comparisonColumns.map(column => ({
          key: column.key,
          label: (
            <>
              <ColumnLabel>{column.label}</ColumnLabel>
              <CheckIconWrapper>
                {selectedComparisonColumns.includes(column.key) && (
                  <CheckOutlined />
                )}
              </CheckIconWrapper>
            </>
          ),
        })),
      },
    ],
    [comparisonColumns, selectedComparisonColumns],
  );

  return (
    <Dropdown
      placement="bottomRight"
      open={isOpen}
      onOpenChange={onOpenChange}
      menu={{
        multiple: true,
        onClick: handleOnClick,
        onBlur: handleOnBlur,
        selectedKeys: selectedComparisonColumns,
        items: menuItems,
      }}
      trigger={['click']}
    >
      <span>
        <TableOutlined /> <DownOutlined />
      </span>
    </Dropdown>
  );
}
