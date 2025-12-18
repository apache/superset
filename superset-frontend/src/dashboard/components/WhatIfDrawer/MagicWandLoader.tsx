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
import { useEffect } from 'react';
import { keyframes } from '@emotion/react';
import { css, styled, useTheme } from '@apache-superset/core/ui';
import { t } from '@superset-ui/core';

const fadeIn = keyframes`
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
`;

const waveWand = keyframes`
  0%, 100% {
    transform: rotate(-15deg);
  }
  50% {
    transform: rotate(15deg);
  }
`;

const sparkle = keyframes`
  0%, 100% {
    opacity: 0;
    transform: scale(0) rotate(0deg);
  }
  50% {
    opacity: 1;
    transform: scale(1) rotate(180deg);
  }
`;

const float = keyframes`
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
`;

const pulse = keyframes`
  0%, 100% {
    transform: scale(1);
    opacity: 0.8;
  }
  50% {
    transform: scale(1.2);
    opacity: 1;
  }
`;

const Overlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: ${({ theme }) => theme.colorBgMask};
  backdrop-filter: blur(2px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  animation: ${fadeIn} 0.3s ease-out;
`;

const WandContainer = styled.div`
  position: relative;
  width: 200px;
  height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: ${float} 2s ease-in-out infinite;
`;

const Wand = styled.div`
  position: relative;
  animation: ${waveWand} 1s ease-in-out infinite;
  transform-origin: bottom center;
`;

const WandSvg = styled.svg`
  width: 120px;
  height: 120px;
  filter: drop-shadow(0 0 20px ${({ theme }) => theme.colorWarning});
`;

const Sparkle = styled.div<{ delay: number; x: number; y: number }>`
  position: absolute;
  width: 12px;
  height: 12px;
  animation: ${sparkle} 1.5s ease-in-out infinite;
  animation-delay: ${({ delay }) => delay}s;
  left: ${({ x }) => x}%;
  top: ${({ y }) => y}%;

  &::before,
  &::after {
    content: '';
    position: absolute;
    background: linear-gradient(
      135deg,
      ${({ theme }) => theme.colorWarning} 0%,
      ${({ theme }) => theme.colorWhite} 50%,
      ${({ theme }) => theme.colorWarning} 100%
    );
  }

  &::before {
    width: 100%;
    height: 2px;
    top: 50%;
    left: 0;
    transform: translateY(-50%);
  }

  &::after {
    width: 2px;
    height: 100%;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
  }
`;

const GlowOrb = styled.div`
  position: absolute;
  top: 15%;
  left: 50%;
  transform: translateX(-50%);
  width: 30px;
  height: 30px;
  background: radial-gradient(
    circle,
    ${({ theme }) => theme.colorWarning} 0%,
    ${({ theme }) => theme.colorWarningBg} 40%,
    transparent 70%
  );
  border-radius: 50%;
  animation: ${pulse} 0.8s ease-in-out infinite;
`;

const LoadingText = styled.div`
  margin-top: ${({ theme }) => theme.sizeUnit * 6}px;
  color: ${({ theme }) => theme.colorWhite};
  font-size: ${({ theme }) => theme.fontSizeLG}px;
  font-weight: ${({ theme }) => theme.fontWeightStrong};
  text-shadow: 0 2px 10px ${({ theme }) => theme.colorBgMask};
  text-align: center;
`;

const SubText = styled.div`
  margin-top: ${({ theme }) => theme.sizeUnit}px;
  color: ${({ theme }) => theme.colorTextLightSolid};
  font-size: ${({ theme }) => theme.fontSizeSM}px;
`;

const DismissHint = styled.div`
  margin-top: ${({ theme }) => theme.sizeUnit * 4}px;
  color: ${({ theme }) => theme.colorTextLightSolid};
  font-size: ${({ theme }) => theme.fontSizeXS}px;
  opacity: 0.7;
`;

const sparklePositions = [
  { x: 20, y: 10, delay: 0 },
  { x: 75, y: 15, delay: 0.3 },
  { x: 85, y: 35, delay: 0.6 },
  { x: 15, y: 30, delay: 0.9 },
  { x: 60, y: 5, delay: 0.2 },
  { x: 40, y: 20, delay: 0.5 },
  { x: 80, y: 25, delay: 0.8 },
  { x: 25, y: 18, delay: 0.4 },
];

// Magic wand SVG colors - using warm brown/gold tones for the wand aesthetic
/* eslint-disable theme-colors/no-literal-colors */
const WAND_COLORS = {
  woodDark: '#654321',
  woodMid: '#8B4513',
  woodLight: '#A0522D',
  goldDark: '#B8860B',
  goldMid: '#DAA520',
  starLight: '#FFF8DC',
};
/* eslint-enable theme-colors/no-literal-colors */

interface MagicWandLoaderProps {
  onDismiss?: () => void;
}

const MagicWandLoader = ({ onDismiss }: MagicWandLoaderProps) => {
  const theme = useTheme();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onDismiss) {
        onDismiss();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onDismiss]);

  return (
    <Overlay data-test="magic-wand-loader" onClick={onDismiss}>
      <WandContainer>
        {sparklePositions.map((pos, i) => (
          <Sparkle key={i} x={pos.x} y={pos.y} delay={pos.delay} />
        ))}
        <GlowOrb />
        <Wand>
          <WandSvg viewBox="0 0 64 64" fill="none">
            <defs>
              <linearGradient
                id="wandGradient"
                x1="0%"
                y1="0%"
                x2="100%"
                y2="100%"
              >
                <stop offset="0%" stopColor={WAND_COLORS.woodMid} />
                <stop offset="50%" stopColor={WAND_COLORS.woodLight} />
                <stop offset="100%" stopColor={WAND_COLORS.woodDark} />
              </linearGradient>
            </defs>

            {/* Thin wand body */}
            <rect
              x="30.5"
              y="16"
              width="3"
              height="42"
              rx="1.5"
              fill="url(#wandGradient)"
              css={css`
                filter: drop-shadow(1px 1px 2px ${theme.colorBgMask});
              `}
            />

            {/* Small star at tip */}
            <circle
              cx="32"
              cy="12"
              r="4"
              fill={theme.colorWarning}
              css={css`
                filter: drop-shadow(0 0 6px ${theme.colorWarning});
              `}
            />
          </WandSvg>
        </Wand>
      </WandContainer>
      <LoadingText>{t('Analyzing relationships...')}</LoadingText>
      <SubText>{t('AI is finding connected columns')}</SubText>
      {onDismiss && (
        <DismissHint>{t('Click anywhere or press Esc to cancel')}</DismissHint>
      )}
    </Overlay>
  );
};

export default MagicWandLoader;
