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
/* eslint-disable import/no-extraneous-dependencies */
import { useState } from 'react';
import { Dropdown, Menu } from 'antd';
import { TableOutlined, DownOutlined, CheckOutlined } from '@ant-design/icons';
import { css, useTheme, t } from '@superset-ui/core';

interface ComparisonColumn {
  key: string;
  label: string;
}

interface TimeComparisonVisibilityProps {
  comparisonColumns: ComparisonColumn[];
  selectedComparisonColumns: string[];
  onSelectionChange: (selectedColumns: string[]) => void;
}

const TimeComparisonVisibility: React.FC<TimeComparisonVisibilityProps> = ({
  comparisonColumns,
  selectedComparisonColumns,
  onSelectionChange,
}) => {
  const [showComparisonDropdown, setShowComparisonDropdown] = useState(false);
  const theme = useTheme();

  const allKey = comparisonColumns[0].key;

  const handleOnClick = (data: any) => {
    const { key } = data;
    // Toggle 'All' key selection
    if (key === allKey) {
      onSelectionChange([allKey]);
    } else if (selectedComparisonColumns.includes(allKey)) {
      onSelectionChange([key]);
    } else {
      // Toggle selection for other keys
      onSelectionChange(
        selectedComparisonColumns.includes(key)
          ? selectedComparisonColumns.filter((k: string) => k !== key) // Deselect if already selected
          : [...selectedComparisonColumns, key],
      ); // Select if not already selected
    }
  };

  const handleOnBlur = () => {
    if (selectedComparisonColumns.length === 3) {
      onSelectionChange([comparisonColumns[0].key]);
    }
  };

  return (
    <Dropdown
      placement="bottomRight"
      visible={showComparisonDropdown}
      onVisibleChange={(flag: boolean) => {
        setShowComparisonDropdown(flag);
      }}
      overlay={
        <Menu
          multiple
          onClick={handleOnClick}
          onBlur={handleOnBlur}
          selectedKeys={selectedComparisonColumns}
        >
          <div
            css={css`
              max-width: 242px;
              padding: 0 ${theme.gridUnit * 2}px;
              color: ${theme.colors.grayscale.base};
              font-size: ${theme.typography.sizes.s}px;
            `}
          >
            {t(
              'Select columns that will be displayed in the table. You can multiselect columns.',
            )}
          </div>
          {comparisonColumns.map((column: ComparisonColumn) => (
            <Menu.Item key={column.key}>
              <span
                css={css`
                  color: ${theme.colors.grayscale.dark2};
                `}
              >
                {column.label}
              </span>
              <span
                css={css`
                  float: right;
                  font-size: ${theme.typography.sizes.s}px;
                `}
              >
                {selectedComparisonColumns.includes(column.key) && (
                  <CheckOutlined />
                )}
              </span>
            </Menu.Item>
          ))}
        </Menu>
      }
      trigger={['click']}
    >
      <span>
        <TableOutlined /> <DownOutlined />
      </span>
    </Dropdown>
  );
};

export default TimeComparisonVisibility;
