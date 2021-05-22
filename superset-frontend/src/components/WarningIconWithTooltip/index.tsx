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
import { useTheme, SafeMarkdown } from '@superset-ui/core';
import Icons from 'src/components/Icons';
import { Tooltip } from 'src/components/Tooltip';

export interface WarningIconWithTooltipProps {
  warningMarkdown: string;
  size?: number;
}

function WarningIconWithTooltip({
  warningMarkdown,
}: WarningIconWithTooltipProps) {
  const theme = useTheme();
  return (
    <Tooltip
      id="warning-tooltip"
      title={<SafeMarkdown source={warningMarkdown} />}
    >
      <Icons.AlertSolid iconColor={theme.colors.alert.base} />
    </Tooltip>
  );
}

export default WarningIconWithTooltip;
