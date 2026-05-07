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
import { useTheme } from '@superset-ui/core';
import { Icons, type IconType, SafeMarkdown, Tooltip } from '..';

export interface WarningIconWithTooltipProps {
  warningMarkdown: string;
  size?: IconType['iconSize'];
  marginRight?: number;
}

function WarningIconWithTooltip({
  warningMarkdown,
  size,
  marginRight,
}: WarningIconWithTooltipProps) {
  const theme = useTheme();
  return (
    <Tooltip
      id="warning-tooltip"
      title={<SafeMarkdown source={warningMarkdown} />}
    >
      <Icons.WarningOutlined
        iconColor={theme.colorWarning}
        iconSize={size}
        css={{ marginRight: marginRight ?? theme.sizeUnit * 2 }}
      />
    </Tooltip>
  );
}

export default WarningIconWithTooltip;
