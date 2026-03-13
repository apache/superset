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
import { useCallback, useEffect, useState } from 'react';
import { Tooltip as AntdTooltip } from 'antd';

import type { TooltipProps, TooltipPlacement } from './types';

/**
 * WCAG 1.4.13 compliant Tooltip wrapper.
 *
 * - Dismissable: pressing Escape closes the tooltip.
 * - Hoverable: Ant Design 5 tooltips already allow the pointer to move
 *   over the overlay without closing it, satisfying the "hoverable" requirement.
 * - Non-obscuring: tooltip placement avoids covering the trigger by default.
 */
export const Tooltip = ({ overlayStyle, open, onOpenChange, ...props }: TooltipProps) => {
  const [visible, setVisible] = useState(false);

  // Respect external control if provided
  const isControlled = open !== undefined;
  const isVisible = isControlled ? open : visible;

  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!isControlled) {
        setVisible(newOpen);
      }
      onOpenChange?.(newOpen);
    },
    [isControlled, onOpenChange],
  );

  // WCAG 1.4.13: Dismiss tooltip on Escape key
  useEffect(() => {
    if (!isVisible) return undefined;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleOpenChange(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isVisible, handleOpenChange]);

  return (
    <AntdTooltip
      styles={{
        body: { overflow: 'hidden', textOverflow: 'ellipsis' },
        root: overlayStyle ?? {},
      }}
      open={isVisible}
      onOpenChange={handleOpenChange}
      {...props}
    />
  );
};
export type { TooltipProps, TooltipPlacement };
