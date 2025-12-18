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
import { createPortal } from 'react-dom';
import { keyframes } from '@emotion/react';
import { styled } from '@apache-superset/core/ui';
import { t } from '@superset-ui/core';

// eslint-disable theme-colors/no-literal-colors

// Casting spell motion - dramatic swish and flick!
const castSpell = keyframes`
  0% {
    transform: rotate(-30deg) translateY(0);
  }
  15% {
    transform: rotate(-45deg) translateY(-5px);
  }
  30% {
    transform: rotate(25deg) translateY(0);
  }
  45% {
    transform: rotate(15deg) translateY(-3px);
  }
  60% {
    transform: rotate(-10deg) translateY(0);
  }
  75% {
    transform: rotate(5deg) translateY(-2px);
  }
  100% {
    transform: rotate(-30deg) translateY(0);
  }
`;

// Magic particles floating upward
const floatUp = keyframes`
  0% {
    opacity: 1;
    transform: translateY(0) translateX(0) scale(1);
  }
  100% {
    opacity: 0;
    transform: translateY(-100px) translateX(var(--drift-x, 0px)) scale(0);
  }
`;

// Spiral magic effect
const spiral = keyframes`
  0% {
    transform: rotate(0deg) translateX(20px) rotate(0deg);
    opacity: 1;
  }
  100% {
    transform: rotate(720deg) translateX(80px) rotate(-720deg);
    opacity: 0;
  }
`;

// Glowing tip pulse
const glowPulse = keyframes`
  0%, 100% {
    filter: drop-shadow(0 0 8px #fff) drop-shadow(0 0 15px #87CEEB) drop-shadow(0 0 25px #4169E1);
    opacity: 0.9;
  }
  50% {
    filter: drop-shadow(0 0 15px #fff) drop-shadow(0 0 30px #87CEEB) drop-shadow(0 0 45px #4169E1);
    opacity: 1;
  }
`;

// Stars twinkling
const twinkle = keyframes`
  0%, 100% {
    opacity: 0;
    transform: scale(0) rotate(0deg);
  }
  25% {
    opacity: 1;
    transform: scale(1) rotate(90deg);
  }
  50% {
    opacity: 0.5;
    transform: scale(0.8) rotate(180deg);
  }
  75% {
    opacity: 1;
    transform: scale(1.2) rotate(270deg);
  }
`;

// Lumos light burst
const lumosBurst = keyframes`
  0% {
    transform: scale(0);
    opacity: 0;
  }
  20% {
    transform: scale(1.5);
    opacity: 0.8;
  }
  100% {
    transform: scale(3);
    opacity: 0;
  }
`;

const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

const textGlow = keyframes`
  0%, 100% {
    text-shadow: 0 0 10px #87CEEB, 0 0 20px #4169E1, 0 0 30px #4169E1;
  }
  50% {
    text-shadow: 0 0 20px #87CEEB, 0 0 40px #4169E1, 0 0 60px #4169E1, 0 0 80px #6495ED;
  }
`;

/* eslint-disable theme-colors/no-literal-colors */
const Overlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: radial-gradient(ellipse at center, rgba(26, 26, 46, 0.25) 0%, rgba(13, 13, 26, 0.28) 50%, rgba(0, 0, 5, 0.3) 100%);
  backdrop-filter: blur(3px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 99999;
  animation: ${fadeIn} 0.5s ease-out;
  overflow: hidden;
`;

const StarsBackground = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  overflow: hidden;
`;

const Star = styled.div<{ size: number; x: number; y: number; delay: number }>`
  position: absolute;
  width: ${({ size }) => size}px;
  height: ${({ size }) => size}px;
  left: ${({ x }) => x}%;
  top: ${({ y }) => y}%;
  background: radial-gradient(circle, #fff 0%, transparent 70%);
  border-radius: 50%;
  animation: ${twinkle} ${({ delay }) => 2 + delay}s ease-in-out infinite;
  animation-delay: ${({ delay }) => delay}s;
`;

const WandScene = styled.div`
  position: relative;
  width: 300px;
  height: 300px;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const WandWrapper = styled.div`
  position: relative;
  animation: ${castSpell} 2.5s ease-in-out infinite;
  transform-origin: 85% 85%;
`;

const WandSvg = styled.svg`
  width: 180px;
  height: 180px;
  transform: rotate(-45deg);
`;

const WandTipGlow = styled.div`
  position: absolute;
  top: -5px;
  left: 50%;
  transform: translateX(-50%);
  width: 20px;
  height: 20px;
  background: radial-gradient(circle, #fff 0%, #87CEEB 30%, #4169E1 60%, transparent 80%);
  border-radius: 50%;
  animation: ${glowPulse} 1s ease-in-out infinite;
`;

const LumosBurst = styled.div`
  position: absolute;
  top: -10px;
  left: 50%;
  transform: translateX(-50%);
  width: 40px;
  height: 40px;
  background: radial-gradient(circle, rgba(255,255,255,0.8) 0%, rgba(135,206,235,0.4) 40%, transparent 70%);
  border-radius: 50%;
  animation: ${lumosBurst} 2s ease-out infinite;
`;

const MagicParticle = styled.div<{ delay: number; driftX: number; duration: number }>`
  position: absolute;
  top: 20%;
  left: 50%;
  width: 6px;
  height: 6px;
  background: radial-gradient(circle, #fff 0%, #87CEEB 50%, transparent 100%);
  border-radius: 50%;
  --drift-x: ${({ driftX }) => driftX}px;
  animation: ${floatUp} ${({ duration }) => duration}s ease-out infinite;
  animation-delay: ${({ delay }) => delay}s;
`;

const SpiralMagic = styled.div<{ delay: number; color: string }>`
  position: absolute;
  top: 50%;
  left: 50%;
  width: 8px;
  height: 8px;
  background: ${({ color }) => color};
  border-radius: 50%;
  animation: ${spiral} 3s ease-out infinite;
  animation-delay: ${({ delay }) => delay}s;
  box-shadow: 0 0 10px ${({ color }) => color};
`;

const MagicStar = styled.div<{ x: number; y: number; delay: number; size: number }>`
  position: absolute;
  left: ${({ x }) => x}%;
  top: ${({ y }) => y}%;
  width: ${({ size }) => size}px;
  height: ${({ size }) => size}px;
  animation: ${twinkle} 1.5s ease-in-out infinite;
  animation-delay: ${({ delay }) => delay}s;

  &::before,
  &::after {
    content: '';
    position: absolute;
    background: linear-gradient(135deg, #fff 0%, #87CEEB 50%, #4169E1 100%);
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

const SpellText = styled.div`
  margin-top: 40px;
  font-family: 'Georgia', 'Times New Roman', serif;
  font-size: 28px;
  font-style: italic;
  color: #87CEEB;
  animation: ${textGlow} 2s ease-in-out infinite;
  letter-spacing: 3px;
`;

const SubText = styled.div`
  margin-top: 16px;
  font-size: 14px;
  color: #6495ED;
  opacity: 0.8;
  letter-spacing: 1px;
`;

const DismissHint = styled.div`
  margin-top: 32px;
  font-size: 12px;
  color: #4a4a6a;
  opacity: 0.6;
`;
/* eslint-enable theme-colors/no-literal-colors */

// Generate random stars for background
const backgroundStars = Array.from({ length: 50 }, (_, i) => ({
  id: i,
  size: Math.random() * 3 + 1,
  x: Math.random() * 100,
  y: Math.random() * 100,
  delay: Math.random() * 3,
}));

// Magic particles around wand tip
const particles = Array.from({ length: 12 }, (_, i) => ({
  id: i,
  delay: i * 0.15,
  driftX: (Math.random() - 0.5) * 60,
  duration: 1.5 + Math.random() * 0.5,
}));

// Spiral magic colors
/* eslint-disable theme-colors/no-literal-colors */
const spiralColors = ['#87CEEB', '#4169E1', '#6495ED', '#B0C4DE', '#ADD8E6', '#fff'];
/* eslint-enable theme-colors/no-literal-colors */

const spirals = spiralColors.map((color, i) => ({
  id: i,
  delay: i * 0.5,
  color,
}));

// Magic stars around the scene
const magicStars = [
  { x: 15, y: 20, delay: 0, size: 16 },
  { x: 80, y: 25, delay: 0.3, size: 12 },
  { x: 25, y: 70, delay: 0.6, size: 14 },
  { x: 75, y: 65, delay: 0.9, size: 10 },
  { x: 10, y: 45, delay: 0.2, size: 8 },
  { x: 88, y: 50, delay: 0.5, size: 11 },
  { x: 50, y: 10, delay: 0.4, size: 13 },
  { x: 45, y: 85, delay: 0.7, size: 9 },
];

interface HarryPotterWandLoaderProps {
  onDismiss?: () => void;
}

const HarryPotterWandLoader = ({ onDismiss }: HarryPotterWandLoaderProps) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onDismiss) {
        onDismiss();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onDismiss]);

  const content = (
    <Overlay data-test="harry-potter-wand-loader" onClick={onDismiss}>
      <StarsBackground>
        {backgroundStars.map(star => (
          <Star
            key={star.id}
            size={star.size}
            x={star.x}
            y={star.y}
            delay={star.delay}
          />
        ))}
      </StarsBackground>

      <WandScene>
        {magicStars.map((star, i) => (
          <MagicStar
            key={i}
            x={star.x}
            y={star.y}
            delay={star.delay}
            size={star.size}
          />
        ))}

        {spirals.map(s => (
          <SpiralMagic key={s.id} delay={s.delay} color={s.color} />
        ))}

        <WandWrapper>
          <LumosBurst />
          <WandTipGlow />
          {particles.map(p => (
            <MagicParticle
              key={p.id}
              delay={p.delay}
              driftX={p.driftX}
              duration={p.duration}
            />
          ))}

          <WandSvg viewBox="0 0 100 100" fill="none">
            <defs>
              {/* Wood grain gradient for authentic wand look */}
              <linearGradient id="hpWandWood" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#2C1810" />
                <stop offset="20%" stopColor="#4A2C1A" />
                <stop offset="40%" stopColor="#3D2314" />
                <stop offset="60%" stopColor="#5C3A22" />
                <stop offset="80%" stopColor="#3D2314" />
                <stop offset="100%" stopColor="#2C1810" />
              </linearGradient>

              {/* Handle gradient - darker, more ornate */}
              <linearGradient id="hpWandHandle" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#1A0F0A" />
                <stop offset="30%" stopColor="#2C1810" />
                <stop offset="50%" stopColor="#3D2314" />
                <stop offset="70%" stopColor="#2C1810" />
                <stop offset="100%" stopColor="#1A0F0A" />
              </linearGradient>

              {/* Glowing tip */}
              <radialGradient id="hpWandGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#fff" />
                <stop offset="40%" stopColor="#87CEEB" />
                <stop offset="100%" stopColor="#4169E1" stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* Wand body - tapered shape like Elder Wand style */}
            <path
              d="M 50 10
                 Q 52 15 52 20
                 L 53 45
                 Q 54 55 55 65
                 L 57 80
                 Q 58 85 56 88
                 L 54 90
                 Q 50 92 46 90
                 L 44 88
                 Q 42 85 43 80
                 L 45 65
                 Q 46 55 47 45
                 L 48 20
                 Q 48 15 50 10
                 Z"
              fill="url(#hpWandWood)"
            />

            {/* Handle bumps - Elder Wand style nodules */}
            <ellipse cx="50" cy="75" rx="6" ry="3" fill="url(#hpWandHandle)" />
            <ellipse cx="50" cy="82" rx="5" ry="2.5" fill="url(#hpWandHandle)" />
            <ellipse cx="50" cy="88" rx="4" ry="2" fill="url(#hpWandHandle)" />

            {/* Wood grain lines */}
            <path
              d="M 49 25 Q 50 40 49 55"
              stroke="#1A0F0A"
              strokeWidth="0.5"
              fill="none"
              opacity="0.3"
            />
            <path
              d="M 51 30 Q 52 45 51 60"
              stroke="#1A0F0A"
              strokeWidth="0.5"
              fill="none"
              opacity="0.3"
            />

            {/* Glowing tip */}
            <circle cx="50" cy="8" r="6" fill="url(#hpWandGlow)" />
            <circle cx="50" cy="8" r="3" fill="#fff" opacity="0.9" />
          </WandSvg>
        </WandWrapper>
      </WandScene>

      <SpellText>{t('Revelio...')}</SpellText>
      <SubText>{t('Discovering hidden connections')}</SubText>
      {onDismiss && (
        <DismissHint>{t('Click anywhere or press Esc to cancel')}</DismissHint>
      )}
    </Overlay>
  );

  // Use portal to render at document.body level to escape any stacking context issues
  return createPortal(content, document.body);
};

export default HarryPotterWandLoader;
