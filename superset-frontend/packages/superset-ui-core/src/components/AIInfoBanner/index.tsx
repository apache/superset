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

import { useState, useEffect, useCallback } from 'react';
import { styled, css, keyframes } from '@apache-superset/core/ui';
import type { AIInfoBannerProps } from './types';

// Keyframes for the SIRI-like orb animation
const pulse = keyframes`
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.1);
    opacity: 0.8;
  }
`;

const wave = keyframes`
  0% {
    transform: scale(0.8);
    opacity: 0.8;
  }
  50% {
    transform: scale(1.2);
    opacity: 0.4;
  }
  100% {
    transform: scale(1.6);
    opacity: 0;
  }
`;

const gradientShift = keyframes`
  0% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0% 50%;
  }
`;

const cursorBlink = keyframes`
  0%, 50% {
    opacity: 1;
  }
  51%, 100% {
    opacity: 0;
  }
`;

const BannerContainer = styled.div`
  ${({ theme }) => css`
    display: flex;
    align-items: center;
    gap: ${theme.sizeUnit * 3}px;
    padding: ${theme.sizeUnit * 3}px ${theme.sizeUnit * 4}px;
    background: linear-gradient(
      135deg,
      ${theme.colorPrimaryBg} 0%,
      ${theme.colorInfoBg} 50%,
      ${theme.colorPrimaryBg} 100%
    );
    background-size: 200% 200%;
    animation: ${gradientShift} 8s ease infinite;
    border-radius: ${theme.borderRadius}px;
    border: 1px solid ${theme.colorPrimaryBorder};
    position: relative;
    overflow: hidden;
  `}
`;

const AIIndicatorWrapper = styled.div`
  ${({ theme }) => css`
    position: relative;
    width: ${theme.sizeUnit * 10}px;
    height: ${theme.sizeUnit * 10}px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  `}
`;

const AIOrb = styled.div`
  ${({ theme }) => css`
    width: ${theme.sizeUnit * 5}px;
    height: ${theme.sizeUnit * 5}px;
    border-radius: 50%;
    background: linear-gradient(
      135deg,
      ${theme.colorPrimary} 0%,
      ${theme.colorInfo} 25%,
      ${theme.colorSuccess} 50%,
      ${theme.colorInfo} 75%,
      ${theme.colorPrimaryActive} 100%
    );
    background-size: 300% 300%;
    animation:
      ${pulse} 1.5s ease-in-out infinite,
      ${gradientShift} 1.2s steps(6) infinite;
    box-shadow:
      0 0 ${theme.sizeUnit * 2}px ${theme.colorPrimary},
      0 0 ${theme.sizeUnit * 5}px ${theme.colorPrimaryBg};
    z-index: 2;
  `}
`;

const WaveRing = styled.div<{ $delay: number }>`
  ${({ theme, $delay }) => css`
    position: absolute;
    width: ${theme.sizeUnit * 5}px;
    height: ${theme.sizeUnit * 5}px;
    border-radius: 50%;
    border: 1px solid ${theme.colorPrimary};
    animation: ${wave} 1.8s ease-out infinite;
    animation-delay: ${$delay}s;
    z-index: 1;
  `}
`;

const ContentWrapper = styled.div`
  ${({ theme }) => css`
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: ${theme.sizeUnit}px;
  `}
`;

const TextContent = styled.div`
  ${({ theme }) => css`
    font-size: ${theme.fontSize}px;
    color: ${theme.colorText};
    line-height: 1.5;
    display: inline;
  `}
`;

const TypingCursor = styled.span<{ $isTyping: boolean }>`
  ${({ theme, $isTyping }) => css`
    display: inline-block;
    width: 2px;
    height: 1em;
    background-color: ${theme.colorPrimary};
    margin-left: 2px;
    vertical-align: text-bottom;
    animation: ${$isTyping ? cursorBlink : 'none'} 0.8s step-end infinite;
    opacity: ${$isTyping ? 1 : 0};
  `}
`;

const CloseButton = styled.button`
  ${({ theme }) => css`
    position: absolute;
    top: ${theme.sizeUnit}px;
    right: ${theme.sizeUnit}px;
    background: transparent;
    border: none;
    cursor: pointer;
    padding: ${theme.sizeUnit * 0.5}px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: ${theme.borderRadius}px;
    color: ${theme.colorTextTertiary};
    transition: all ${theme.motionDurationMid};

    &:hover {
      background-color: ${theme.colorPrimaryBg};
      color: ${theme.colorText};
    }

    &:focus {
      outline: none;
      box-shadow: 0 0 0 2px ${theme.colorPrimaryBorder};
    }
  `}
`;

const CloseIcon = () => (
  <svg
    width="10"
    height="10"
    viewBox="0 0 10 10"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M1 1L9 9M1 9L9 1"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

export function AIInfoBanner({
  text,
  typingSpeed = 20,
  dismissible = true,
  onDismiss,
  className,
  'data-test': dataTest,
}: AIInfoBannerProps) {
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(true);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (!text) return;

    setDisplayedText('');
    setIsTyping(true);

    let currentIndex = 0;
    const intervalId = setInterval(() => {
      if (currentIndex < text.length) {
        setDisplayedText(text.slice(0, currentIndex + 1));
        currentIndex += 1;
      } else {
        setIsTyping(false);
        clearInterval(intervalId);
      }
    }, typingSpeed);

    return () => clearInterval(intervalId);
  }, [text, typingSpeed]);

  const handleDismiss = useCallback(() => {
    setIsVisible(false);
    onDismiss?.();
  }, [onDismiss]);

  if (!isVisible) {
    return null;
  }

  return (
    <BannerContainer
      className={className}
      data-test={dataTest ?? 'ai-info-banner'}
      role="status"
      aria-live="polite"
    >
      <AIIndicatorWrapper>
        <WaveRing $delay={0} />
        <WaveRing $delay={0.5} />
        <WaveRing $delay={1} />
        <AIOrb />
      </AIIndicatorWrapper>

      <ContentWrapper>
        <TextContent>
          {displayedText}
          <TypingCursor $isTyping={isTyping} />
        </TextContent>
      </ContentWrapper>

      {dismissible && (
        <CloseButton
          onClick={handleDismiss}
          aria-label="Dismiss"
          data-test="ai-info-banner-close"
        >
          <CloseIcon />
        </CloseButton>
      )}
    </BannerContainer>
  );
}

export type { AIInfoBannerProps };
