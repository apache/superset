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
import { css, keyframes } from '@emotion/react';
import styled from '@emotion/styled';
import { OverlayPosition, OverlayAnimation } from './types';

// ─── Keyframe Animations ────────────────────────────────────────────────────

const slideInFromTop = keyframes`
    from { transform: translateY(-100%); opacity: 0; }
    to   { transform: translateY(0);     opacity: 1; }
`;

const slideInFromBottom = keyframes`
    from { transform: translateY(100%); opacity: 0; }
    to   { transform: translateY(0);    opacity: 1; }
`;

const fadeIn = keyframes`
    from { opacity: 0; }
    to   { opacity: 1; }
`;

const getOverlayAnimation = (
    animation: OverlayAnimation,
    position: OverlayPosition,
) => {
    if (animation === 'fade') return css`animation: ${fadeIn} 0.4s ease-out forwards;`;
    if (animation === 'slide') {
        const kf = position === 'top' ? slideInFromTop : slideInFromBottom;
        return css`animation: ${kf} 0.4s ease-out forwards;`;
    }
    return css``;
};

// ─── Overlay Container (position: fixed, portal target) ─────────────────────

interface OverlayContainerProps {
    position: OverlayPosition;
    zIndex: number;
    bgColor: string;
    fgColor: string;
    animationType: OverlayAnimation;
}

export const OverlayContainer = styled.div<OverlayContainerProps>`
    position: fixed;
    left: 0;
    right: 0;
    ${({ position }) => (position === 'top' ? 'top: 0;' : 'bottom: 0;')}
    z-index: ${({ zIndex }) => zIndex};
    background: ${({ bgColor }) => bgColor};
    color: ${({ fgColor }) => fgColor};
    display: flex;
    align-items: center;
    padding: 8px 16px;
    gap: 16px;
    font-family: Inter, Roboto, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    ${({ animationType, position }) => getOverlayAnimation(animationType, position)}
`;

// ─── Header / Inline Container ──────────────────────────────────────────────

interface BarContainerProps {
    bgColor: string;
    fgColor: string;
}

export const BarContainer = styled.div<BarContainerProps>`
    display: flex;
    align-items: center;
    width: 100%;
    padding: 8px 16px;
    gap: 16px;
    background: ${({ bgColor }) => bgColor};
    color: ${({ fgColor }) => fgColor};
    font-family: Inter, Roboto, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    box-sizing: border-box;
    border-radius: 4px;
    min-height: 40px;
`;

// ─── Section Containers ─────────────────────────────────────────────────────

export const TitleBlock = styled.div`
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
`;

export const TitleText = styled.span`
    font-size: 15px;
    font-weight: 600;
    line-height: 1.3;
`;

export const SubtitleText = styled.span`
    font-size: 11px;
    font-weight: 400;
    opacity: 0.75;
    line-height: 1.3;
`;

export const ClockDisplay = styled.span`
    font-size: 16px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    flex-shrink: 0;
    line-height: 1.2;
`;

export const DateDisplay = styled.span`
    font-size: 11px;
    font-weight: 400;
    opacity: 0.8;
    line-height: 1.2;
    text-align: right;
`;

export const RightInfoBlock = styled.div`
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
    margin-left: auto;
`;

export const DateTimeBlock = styled.div`
    display: flex;
    flex-direction: column;
    align-items: flex-end;
`;

export const WeatherSlot = styled.span`
    font-size: 13px;
    flex-shrink: 0;
`;

export const KpiContainer = styled.div`
    display: flex;
    gap: 16px;
    flex-shrink: 0;
`;

export const KpiItem = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
`;

export const KpiLabel = styled.span`
    font-size: 10px;
    text-transform: uppercase;
    opacity: 0.6;
    letter-spacing: 0.5px;
`;

export const KpiValue = styled.span`
    font-size: 16px;
    font-weight: 700;
`;

export const CustomSlot = styled.div`
    flex-shrink: 0;
    font-size: 13px;
    opacity: 0.8;
`;

// ─── Ticker ─────────────────────────────────────────────────────────────────

export const TickerWrapper = styled.div`
    flex: 1;
    overflow: hidden;
    position: relative;
    min-width: 0;
`;

interface TickerContentProps {
    speed: number;
    direction: 'left' | 'right';
}

const tickerScrollLeft = keyframes`
    0%   { transform: translateX(100%); }
    100% { transform: translateX(-100%); }
`;

const tickerScrollRight = keyframes`
    0%   { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
`;

export const TickerContent = styled.div<TickerContentProps>`
    display: inline-block;
    white-space: nowrap;
    font-size: 13px;
    animation: ${({ direction }) =>
        direction === 'left' ? tickerScrollLeft : tickerScrollRight}
        ${({ speed }) => speed}s linear infinite;
    padding-left: 100%;
`;

// ─── Divider ────────────────────────────────────────────────────────────────

export const Divider = styled.span`
    width: 1px;
    height: 20px;
    background: currentColor;
    opacity: 0.2;
    flex-shrink: 0;
`;
