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
import type { CSSProperties } from 'react';
import { Tooltip as AntdTooltip } from 'antd';

import type { TooltipProps, TooltipPlacement } from './types';
import { resolveGlossaryString } from '@superset-ui/core';

const TOOLTIP_SEPARATOR_STYLE: CSSProperties = {
  margin: '8px 0',
  border: 'none',
  borderTop: '1px solid rgba(255, 255, 255, 0.2)',
};

export const Tooltip = ({
  overlayStyle,
  title,
  children,
  ...props
}: TooltipProps) => {
  if (typeof title !== 'string') {
    return (
      <AntdTooltip
        title={title}
        styles={{
          body: { overflow: 'hidden', textOverflow: 'ellipsis' },
          root: overlayStyle ?? {},
        }}
        {...props}
      >
        {children}
      </AntdTooltip>
    );
  }

  const [glossaryUrl, description] = resolveGlossaryString(title);
  const wrappedChildren = glossaryUrl ? (
    <a href={glossaryUrl} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ) : (
    children
  );

  const wrappedDescription = glossaryUrl ? (
    <>
      {description}
      <hr style={TOOLTIP_SEPARATOR_STYLE} />
      <em>Click to Learn More</em>
    </>
  ) : (
    description
  );

  return (
    <AntdTooltip
      title={wrappedDescription}
      styles={{
        body: { overflow: 'hidden', textOverflow: 'ellipsis' },
        root: overlayStyle ?? {},
      }}
      {...props}
    >
      {wrappedChildren}
    </AntdTooltip>
  );
};

export type { TooltipProps, TooltipPlacement };
