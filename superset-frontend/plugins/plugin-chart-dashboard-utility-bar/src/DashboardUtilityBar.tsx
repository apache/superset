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
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { DashboardUtilityBarProps } from './types';
import {
    BarContainer,
    TitleBlock,
    TitleText,
    SubtitleText,
    KpiContainer,
    KpiItem,
    KpiLabel,
    KpiValue,
    CustomSlot,
    Divider,
    RightInfoBlock,
    DateTimeBlock,
    DateDisplay,
} from './styles';
import LiveClock from './components/LiveClock';
import WeatherWidget from './components/WeatherWidget';
import NotificationTicker from './components/NotificationTicker';
import OverlayPortal from './components/OverlayPortal';

/**
 * Main chart component for the Dashboard Utility Bar plugin.
 *
 * Layout (matching reference image):
 *   [Title / Subtitle] [KPIs] [Ticker] ... [Weather] [Date + Time]
 *
 * Weather, date, and time are grouped on the RIGHT side.
 * Date appears on top, time below (stacked vertically).
 * Weather icon + temp sits to the left of the date/time block.
 */
export default function DashboardUtilityBar(props: DashboardUtilityBarProps) {
    const { data, customize } = props;

    const {
        layoutMode,
        overlayPosition,
        overlayZIndex,
        overlayAnimation,
        titleColumn,
        subtitleColumn,
        kpiColumns,
        tickerMessageColumn,
        showTitle,
        showSubtitle,
        showClock,
        showDate,
        showWeather,
        showKpi,
        showTicker,
        showCustomRightSlot,
        tickerSpeed,
        tickerDirection,
        tickerSeparator,
        autoHideNoData,
        autoHideSeconds,
        backgroundColor,
        textColor,
        titleFontSize,
        dateFontSize,
        clockFontSize,
        weatherIconSize,
        temperatureFontSize,
        showTemperature,
    } = customize;

    // ─── Auto-hide state ──────────────────────────────────────────────
    const [visible, setVisible] = useState(true);
    const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const hasData = data && data.length > 0;

    useEffect(() => {
        if (autoHideNoData && !hasData) {
            setVisible(false);
        } else {
            setVisible(true);
        }
    }, [autoHideNoData, hasData]);

    useEffect(() => {
        if (autoHideSeconds > 0) {
            hideTimerRef.current = setTimeout(() => {
                setVisible(false);
            }, autoHideSeconds * 1000);

            return () => {
                if (hideTimerRef.current !== null) {
                    clearTimeout(hideTimerRef.current);
                }
            };
        }
        return undefined;
    }, [autoHideSeconds]);

    // ─── Derived data ─────────────────────────────────────────────────
    const firstRow = data?.[0] ?? {};

    const titleValue = useMemo(
        () => (titleColumn ? String(firstRow[titleColumn] ?? '') : ''),
        [titleColumn, firstRow],
    );

    const subtitleValue = useMemo(
        () => (subtitleColumn ? String(firstRow[subtitleColumn] ?? '') : ''),
        [subtitleColumn, firstRow],
    );

    const kpiValues = useMemo(
        () =>
            kpiColumns.map((col) => ({
                label: col,
                value: firstRow[col] != null ? String(firstRow[col]) : '—',
            })),
        [kpiColumns, firstRow],
    );

    const tickerMessages = useMemo(() => {
        if (!tickerMessageColumn) return [];
        return data
            .map((row) => row[tickerMessageColumn])
            .filter((v): v is string | number => v != null)
            .map(String);
    }, [tickerMessageColumn, data]);

    // ─── Current date string ──────────────────────────────────────────
    const dateString = useMemo(() => {
        return new Date().toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    }, []);

    // ─── Don't render if hidden ───────────────────────────────────────
    if (!visible) return null;

    // ─── Build LEFT content elements ─────────────────────────────────
    const leftElements: React.ReactNode[] = [];

    // Title block
    if (showTitle && titleValue) {
        leftElements.push(
            <TitleBlock key="title-block">
                <TitleText style={{ fontSize: titleFontSize }}>{titleValue}</TitleText>
                {showSubtitle && subtitleValue && (
                    <SubtitleText>{subtitleValue}</SubtitleText>
                )}
            </TitleBlock>,
        );
    }

    if (leftElements.length > 0) {
        leftElements.push(<Divider key="div-after-title" />);
    }

    // KPI values
    if (showKpi && kpiValues.length > 0) {
        leftElements.push(
            <KpiContainer key="kpi-container">
                {kpiValues.map((kpi) => (
                    <KpiItem key={`kpi-${kpi.label}`}>
                        <KpiLabel>{kpi.label}</KpiLabel>
                        <KpiValue>{kpi.value}</KpiValue>
                    </KpiItem>
                ))}
            </KpiContainer>,
        );
        leftElements.push(<Divider key="div-after-kpi" />);
    }

    // Notification ticker (takes remaining flex space)
    if (showTicker) {
        leftElements.push(
            <NotificationTicker
                key="ticker"
                messages={tickerMessages}
                separator={tickerSeparator}
                speed={tickerSpeed}
                direction={tickerDirection}
            />,
        );
    }

    // Custom right slot (before the right info block)
    if (showCustomRightSlot) {
        if (!showTicker) {
            leftElements.push(<div key="spacer" style={{ flex: 1 }} />);
        }
        leftElements.push(
            <CustomSlot key="custom-slot">⚙ Custom Slot</CustomSlot>,
        );
    }

    // ─── Build RIGHT info block (weather + date/time) ─────────────────
    const hasRightBlock = showWeather || showDate || showClock;

    const rightBlock = hasRightBlock ? (
        <RightInfoBlock key="right-info">
            {showWeather && (
                <WeatherWidget
                    iconSize={weatherIconSize}
                    showTemperature={showTemperature}
                    temperatureFontSize={temperatureFontSize}
                />
            )}
            {(showDate || showClock) && (
                <DateTimeBlock>
                    {showDate && <DateDisplay style={{ fontSize: dateFontSize }}>{dateString}</DateDisplay>}
                    {showClock && <LiveClock fontSize={clockFontSize} />}
                </DateTimeBlock>
            )}
        </RightInfoBlock>
    ) : null;

    // ─── Assemble full content ────────────────────────────────────────
    const allContent = (
        <>
            {leftElements}
            {/* Spacer pushes right block to the far right if no ticker/slot took the flex */}
            {!showTicker && !showCustomRightSlot && hasRightBlock && (
                <div key="right-spacer" style={{ flex: 1 }} />
            )}
            {rightBlock}
        </>
    );

    // ─── Overlay mode → React Portal ─────────────────────────────────
    if (layoutMode === 'overlay') {
        return (
            <OverlayPortal
                position={overlayPosition}
                zIndex={overlayZIndex}
                bgColor={backgroundColor}
                fgColor={textColor}
                animation={overlayAnimation}
            >
                {allContent}
            </OverlayPortal>
        );
    }

    // ─── Header / Inline mode → inline rendering ─────────────────────
    return (
        <BarContainer bgColor={backgroundColor} fgColor={textColor}>
            {allContent}
        </BarContainer>
    );
}
