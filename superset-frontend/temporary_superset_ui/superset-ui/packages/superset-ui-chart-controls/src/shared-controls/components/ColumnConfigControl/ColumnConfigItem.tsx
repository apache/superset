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
import { useTheme } from '@superset-ui/core';
import { Popover } from 'antd';
import ColumnTypeLabel from '../../../components/ColumnTypeLabel';
import ColumnConfigPopover, { ColumnConfigPopoverProps } from './ColumnConfigPopover';

export type ColumnConfigItemProps = ColumnConfigPopoverProps;

export default React.memo(function ColumnConfigItem({
  column,
  onChange,
  configFormLayout,
}: ColumnConfigItemProps) {
  const { colors, gridUnit } = useTheme();
  const caretWidth = gridUnit * 6;
  return (
    <Popover
      title={column.name}
      content={() => (
        <ColumnConfigPopover
          column={column}
          onChange={onChange}
          configFormLayout={configFormLayout}
        />
      )}
      trigger="click"
      placement="right"
    >
      <div
        css={{
          cursor: 'pointer',
          padding: `${1.5 * gridUnit}px ${2 * gridUnit}px`,
          borderBottom: `1px solid ${colors.grayscale.light2}`,
          position: 'relative',
          paddingRight: caretWidth,
          '&:last-child': {
            borderBottom: 'none',
          },
          '&:hover': {
            background: colors.grayscale.light4,
          },
          '> .fa': {
            color: colors.grayscale.light2,
          },
          '&:hover > .fa': {
            color: colors.grayscale.light1,
          },
        }}
      >
        <ColumnTypeLabel type={column.type} />
        {column.name}
        <i
          className="fa fa-caret-right"
          css={{
            position: 'absolute',
            right: 3 * gridUnit,
            top: 3 * gridUnit,
          }}
        />
      </div>
    </Popover>
  );
});
