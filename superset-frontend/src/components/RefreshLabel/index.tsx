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
import { MouseEventHandler, forwardRef } from 'react';
import { SupersetTheme } from '@superset-ui/core';
import { Tooltip } from 'src/components/Tooltip';
import Icons, { IconType } from 'src/components/Icons';

export interface RefreshLabelProps {
  onClick: MouseEventHandler<HTMLSpanElement>;
  tooltipContent: string;
}

const RefreshLabel = ({ onClick, tooltipContent }: RefreshLabelProps) => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const IconWithoutRef = forwardRef((props: IconType, ref: any) => (
    <Icons.Refresh {...props} />
  ));

  return (
    <Tooltip title={tooltipContent}>
      <IconWithoutRef
        role="button"
        onClick={onClick}
        css={(theme: SupersetTheme) => ({
          cursor: 'pointer',
          color: theme.colors.grayscale.base,
          '&:hover': { color: theme.colors.primary.base },
        })}
      />
    </Tooltip>
  );
};

export default RefreshLabel;
