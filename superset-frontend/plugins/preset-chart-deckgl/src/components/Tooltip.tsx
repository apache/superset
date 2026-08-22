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

import { safeHtmlSpan } from '@superset-ui/core';
import { styled } from '@apache-superset/core/theme';
import { ReactNode, useEffect, useRef, useState } from 'react';

export type TooltipProps = {
  tooltip:
    | {
        x: number;
        y: number;
        content: ReactNode;
      }
    | null
    | undefined;
  variant?: 'default' | 'custom';
};

const StyledDiv = styled.div<{
  top: number;
  left: number;
  variant: 'default' | 'custom';
}>`
  ${({ theme, top, left, variant }) => `
    position: absolute;
    top: ${top}px;
    left: ${left}px;
    z-index: 9;
    /* deck.gl tooltips track the cursor across the canvas — capturing pointer
       events here would block layer hover/click and create flicker loops as
       the cursor enters and leaves the floating tooltip. Dismissal is via the
       Escape key handler below; WCAG 1.4.13 "hoverable" is satisfied because
       the tooltip remains visible under the cursor while pointing at the
       feature. */
    pointer-events: none;
    ${
      variant === 'default'
        ? `
      padding: ${theme.sizeUnit * 2}px;
      margin: ${theme.sizeUnit * 2}px;
      background: ${theme.colorBgElevated};
      color: ${theme.colorText};
      max-width: 300px;
      font-size: ${theme.fontSizeSM}px;
      border: 1px solid ${theme.colorBorder};
      border-radius: ${theme.borderRadius}px;
      box-shadow: ${theme.boxShadowSecondary};
    `
        : `
      margin: ${theme.sizeUnit * 3}px;
    `
    }
  `}
`;

export default function Tooltip(props: TooltipProps) {
  const { tooltip, variant = 'default' } = props;
  const [dismissed, setDismissed] = useState(false);
  const wasVisibleRef = useRef(false);

  // Reset dismissed when the tooltip transitions from hidden to visible. This
  // handles the case where the cursor leaves the chart and re-enters a
  // different pickable that happens to render the same content — content
  // alone wouldn't trigger a reset there.
  useEffect(() => {
    const isVisible = !!tooltip;
    if (isVisible && !wasVisibleRef.current) {
      setDismissed(false);
    }
    wasVisibleRef.current = isVisible;
  }, [tooltip]);

  // Reset on content change too (most common new-target signal).
  useEffect(() => {
    setDismissed(false);
  }, [tooltip?.content]);

  // Bind the Escape listener once per visibility cycle. Depending on
  // `tooltip` directly would re-bind on every cursor move (x/y change).
  const visible = !!tooltip && !dismissed;
  useEffect(() => {
    if (!visible) return undefined;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDismissed(true);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [visible]);

  if (!tooltip || dismissed) {
    return null;
  }

  const { x, y, content } = tooltip;
  const safeContent =
    typeof content === 'string' ? safeHtmlSpan(content) : content;

  return (
    <StyledDiv top={y} left={x} variant={variant}>
      {safeContent}
    </StyledDiv>
  );
}
