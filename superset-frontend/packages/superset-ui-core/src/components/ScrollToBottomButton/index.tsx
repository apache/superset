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
import {
  useCallback,
  useRef,
  type MutableRefObject,
  type Ref,
} from 'react';
import { t } from '@apache-superset/core/translation';
import { css, styled, useTheme } from '@apache-superset/core/theme';
import { Button } from '../Button';
import { Icons } from '../Icons';
import { Tooltip } from '../Tooltip';
import type {
  ScrollToBottomButtonProps,
  ScrollToBottomContainerProps,
} from './types';
import { useScrollToBottom } from './useScrollToBottom';

function assignRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (!ref) {
    return;
  }
  if (typeof ref === 'function') {
    ref(value);
    return;
  }
  (ref as MutableRefObject<T | null>).current = value;
}

const FloatingButton = styled(Button)`
  position: absolute;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: unset;
  padding: 0;
  border-radius: 50%;
  box-shadow: ${({ theme }) => theme.boxShadow};
`;

export function ScrollToBottomButton({
  targetRef,
  threshold,
  tooltip = t('Scroll to bottom'),
  position = 'bottom-right',
  className,
  'data-test': dataTest = 'scroll-to-bottom-button',
}: ScrollToBottomButtonProps) {
  const theme = useTheme();
  const { isAtBottom, scrollToBottom } = useScrollToBottom(
    targetRef,
    threshold,
  );

  if (isAtBottom) {
    return null;
  }

  const offset = theme.sizeUnit * 4;
  const positionStyles =
    position === 'bottom-left'
      ? css`
          bottom: ${offset}px;
          left: ${offset}px;
        `
      : css`
          bottom: ${offset}px;
          right: ${offset}px;
        `;

  const button = (
    <FloatingButton
      aria-label={tooltip}
      buttonStyle="primary"
      className={className}
      data-test={dataTest}
      onClick={scrollToBottom}
      css={css`
        ${positionStyles};
        width: ${theme.sizeUnit * 10}px;
        height: ${theme.sizeUnit * 10}px;
      `}
    >
      <Icons.VerticalAlignBottomOutlined iconSize="m" />
    </FloatingButton>
  );

  return <Tooltip title={tooltip}>{button}</Tooltip>;
}

export function ScrollToBottomContainer({
  children,
  threshold,
  tooltip,
  position,
  containerRef,
  className,
  ...rest
}: ScrollToBottomContainerProps) {
  const internalRef = useRef<HTMLDivElement>(null);

  const setContainerRef = useCallback(
    (node: HTMLDivElement | null) => {
      internalRef.current = node;
      assignRef(containerRef, node);
    },
    [containerRef],
  );

  return (
    <div
      ref={setContainerRef}
      className={className}
      css={css`
        position: relative;
        height: 100%;
        min-height: 0;
        overflow-y: auto;
      `}
      {...rest}
    >
      {children}
      <ScrollToBottomButton
        targetRef={internalRef}
        threshold={threshold}
        tooltip={tooltip}
        position={position}
      />
    </div>
  );
}

export type {
  ScrollToBottomButtonProps,
  ScrollToBottomContainerProps,
  ScrollToBottomPosition,
} from './types';
