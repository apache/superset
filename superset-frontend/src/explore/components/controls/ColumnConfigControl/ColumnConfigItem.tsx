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
import { Popover } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
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
  const theme = useTheme();
  const { sizeUnit } = theme;
  const caretWidth = sizeUnit * 6;

  const outerContainerStyle = css({
    display: 'flex',
    alignItems: 'center',
    cursor: 'pointer',
    padding: `${sizeUnit}px ${2 * sizeUnit}px`,
    borderBottom: `1px solid ${theme.colorBorderSecondary}`,
    position: 'relative',
    paddingRight: `${caretWidth}px`,
    ':last-child': {
      borderBottom: 'none',
    },
    ':hover': {
      background: theme.colorFillTertiary,
    },
    '> .fa': {
      color: theme.colorTextTertiary,
    },
    ':hover > .fa': {
      color: theme.colorTextSecondary,
    },
  });

  const nameContainerStyle = css({
    display: 'flex',
    alignItems: 'center',
    paddingLeft: column.isChildColumn ? sizeUnit * 7 : sizeUnit,
    flex: 1,
  });

  const nameTextStyle = css({
    paddingLeft: sizeUnit,
  });

  const iconContainerStyle = css({
    display: 'flex',
    alignItems: 'center',
    position: 'absolute',
    right: 3 * sizeUnit,
    top: 4 * sizeUnit,
    transform: 'translateY(-50%)',
    gap: sizeUnit,
    color: theme.colorTextSecondary,
  });

  const caretIconStyle = css({
    fontSize: `${theme.fontSizeSM}px`,
    fontWeight: theme.fontWeightNormal,
    color: theme.colorIcon,
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
      style={{ width, height }}
      className="column-config-popover"
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
              iconColor={theme.colorIcon}
            />
          )}
          <Icons.RightOutlined css={caretIconStyle} />
        </div>
      </div>
    </Popover>
  );
});
