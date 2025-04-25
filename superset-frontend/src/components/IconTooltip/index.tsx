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
import { Tooltip } from '../Tooltip';
import { Button } from '../Button';
import type { IconTooltipProps } from './types';

export const IconTooltip = ({
  children = null,
  className = '',
  onClick = () => undefined,
  placement = 'top',
  style = {},
  tooltip = null,
}: IconTooltipProps) => {
  const iconTooltip = (
    <Button
      onClick={onClick}
      style={{
        padding: 0,
        ...style,
      }}
      buttonStyle="link"
      className={`IconTooltip ${className}`}
    >
      {children}
    </Button>
  );
  if (tooltip) {
    return (
      <Tooltip
        id="tooltip"
        title={tooltip}
        placement={placement}
        mouseEnterDelay={0.3}
        mouseLeaveDelay={0.15}
      >
        {iconTooltip}
      </Tooltip>
    );
  }
  return iconTooltip;
};

export type { IconTooltipProps };
