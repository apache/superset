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
import { useEffect, useState, useCallback } from 'react';
import { styled, SupersetTheme } from '@apache-superset/core/ui';
import { t } from '@superset-ui/core';
import { Icons } from '@superset-ui/core/components/Icons';
import { Tooltip } from '@superset-ui/core/components';

const SCROLL_THRESHOLD = 100;

const StyledScrollButton = styled.div`
  position: fixed;
  bottom: ${({ theme }: { theme: SupersetTheme }) => theme.sizeUnit * 5}px;
  right: ${({ theme }: { theme: SupersetTheme }) => theme.sizeUnit * 5}px;
  z-index: ${({ theme }: { theme: SupersetTheme }) => theme.zIndexPopupBase + 10};
  cursor: pointer;
  background-color: ${({ theme }: { theme: SupersetTheme }) => theme.colorPrimary};
  color: ${({ theme }: { theme: SupersetTheme }) => theme.colorTextLightSolid};
  width: ${({ theme }: { theme: SupersetTheme }) => theme.sizeUnit * 10}px;
  height: ${({ theme }: { theme: SupersetTheme }) => theme.sizeUnit * 10}px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: ${({ theme }: { theme: SupersetTheme }) => theme.boxShadow};
  transition: all ${({ theme }: { theme: SupersetTheme }) =>
        theme.motionDurationMid};
  opacity: 0;
  visibility: hidden;
  transform: translateY(20px);

  &.visible {
    opacity: 1;
    visibility: visible;
    transform: translateY(0);
  }

  &:hover {
    background-color: ${({ theme }: { theme: SupersetTheme }) =>
        theme.colorPrimaryHover};
    box-shadow: ${({ theme }: { theme: SupersetTheme }) =>
        theme.boxShadowSecondary};
  }

  .anticon {
    font-size: ${({ theme }: { theme: SupersetTheme }) =>
        theme.fontSizeHeading3}px;
  }
`;

const ScrollToBottom = () => {
    const [isVisible, setIsVisible] = useState(false);

    const toggleVisibility = useCallback(() => {
        const { scrollHeight, scrollTop, clientHeight } = document.documentElement;
        // Show button if we are NOT at the bottom
        const isAtBottom = scrollHeight - scrollTop - clientHeight < SCROLL_THRESHOLD;
        setIsVisible(!isAtBottom);
    }, []);

    useEffect(() => {
        window.addEventListener('scroll', toggleVisibility);
        return () => window.removeEventListener('scroll', toggleVisibility);
    }, [toggleVisibility]);

    const scrollToBottom = () => {
        window.scrollTo({
            top: document.documentElement.scrollHeight,
            behavior: 'smooth',
        });
    };

    return (
        <Tooltip title={t('Scroll to bottom')} placement="left">
            <StyledScrollButton
                className={isVisible ? 'visible' : ''}
                onClick={scrollToBottom}
                role="button"
                aria-label={t('Scroll to bottom')}
                tabIndex={0}
                onKeyDown={event => {
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        scrollToBottom();
                    }
                }}
            >
                <Icons.DownOutlined />
            </StyledScrollButton>
        </Tooltip>
    );
};

export default ScrollToBottom;
