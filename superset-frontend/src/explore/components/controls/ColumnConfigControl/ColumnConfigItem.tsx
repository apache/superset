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
import { memo } from 'react';
import { css, useTheme } from '@superset-ui/core';
import Popover from 'src/components/Popover';
import { Icons } from 'src/components/Icons';
import { ColumnTypeLabel } from '@superset-ui/chart-controls';
import ColumnConfigPopover, {
  ColumnConfigPopoverProps,
} from './ColumnConfigPopover';

export type ColumnConfigItemProps = ColumnConfigPopoverProps;

export default memo(function ColumnConfigItem({
  column,
  onChange,
  configFormLayout,
  width,
  height,
}: ColumnConfigItemProps) {
  const { colors, gridUnit } = useTheme();
  const caretWidth = gridUnit * 6;

  const outerContainerStyle = css({
    display: 'flex',
    alignItems: 'center',
    cursor: 'pointer',
    padding: `${gridUnit}px ${2 * gridUnit}px`,
    borderBottom: `1px solid ${colors.grayscale.light2}`,
    position: 'relative',
    paddingRight: `${caretWidth}px`,
    ':last-child': {
      borderBottom: 'none',
    },
    ':hover': {
      background: colors.grayscale.light4,
    },
    '> .fa': {
      color: colors.grayscale.light2,
    },
    ':hover > .fa': {
      color: colors.grayscale.light1,
    },
  });

  const nameContainerStyle = css({
    display: 'flex',
    alignItems: 'center',
    paddingLeft: column.isChildColumn ? gridUnit * 7 : gridUnit,
    flex: 1,
  });

  const nameTextStyle = css({
    paddingLeft: gridUnit,
  });

  const iconContainerStyle = css({
    display: 'flex',
    alignItems: 'center',
    position: 'absolute',
    right: 3 * gridUnit,
    top: 3 * gridUnit,
    transform: 'translateY(-50%)',
    gap: gridUnit,
    color: colors.grayscale.light1,
  });

  const theme = useTheme();

  const caretIconStyle = css({
    fontSize: `${theme.typography.sizes.s}px`,
    fontWeight: theme.typography.weights.normal,
    color: theme.colors.grayscale.light1,
  });

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
      overlayInnerStyle={{ width, height }}
      overlayClassName="column-config-popover"
    >
      <div css={outerContainerStyle}>
        <div css={nameContainerStyle}>
          <ColumnTypeLabel type={column.type} />
          <span css={nameTextStyle}>{column.name}</span>
        </div>

        <div css={iconContainerStyle}>
          {column.isChildColumn && column.config?.visible === false && (
            <Icons.EyeInvisibleOutlined
              iconSize="s"
              iconColor={colors.grayscale.base}
            />
          )}
          <Icons.CaretRightOutlined css={caretIconStyle} />
        </div>
      </div>
    </Popover>
  );
});
