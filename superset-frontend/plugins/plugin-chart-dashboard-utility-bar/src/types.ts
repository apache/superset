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
import { QueryFormData, TimeseriesDataRecord } from '@superset-ui/core';

// ─── Layout Mode ────────────────────────────────────────────────────────────────
export type LayoutMode = 'header' | 'overlay' | 'inline';
export type OverlayPosition = 'top' | 'bottom';
export type OverlayAnimation = 'slide' | 'fade' | 'none';
export type TickerDirection = 'left' | 'right';

// ─── Styles Props (width/height from Superset container) ─────────────────────
export interface DashboardUtilityBarStylesProps {
    height: number;
    width: number;
}

// ─── Customize Props (everything from control panel) ─────────────────────────
export interface DashboardUtilityBarCustomizeProps {
    // Layout
    layoutMode: LayoutMode;
    overlayPosition: OverlayPosition;
    overlayZIndex: number;
    overlayAnimation: OverlayAnimation;

    // Column references (resolved names)
    titleColumn?: string;
    subtitleColumn?: string;
    kpiColumns: string[];
    tickerMessageColumn?: string;

    // Element visibility toggles
    showTitle: boolean;
    showSubtitle: boolean;
    showClock: boolean;
    showDate: boolean;
    showWeather: boolean;
    showKpi: boolean;
    showTicker: boolean;
    showCustomRightSlot: boolean;

    // Ticker settings
    tickerSpeed: number;
    tickerDirection: TickerDirection;
    tickerSeparator: string;

    // Behavior
    autoHideNoData: boolean;
    autoHideSeconds: number;

    // Styling
    backgroundColor: string;
    textColor: string;

    // Font sizes
    titleFontSize: number;
    dateFontSize: number;
    clockFontSize: number;
    weatherIconSize: number;
    temperatureFontSize: number;
    showTemperature: boolean;
}

// ─── Composite Component Props ───────────────────────────────────────────────
export interface DashboardUtilityBarProps extends DashboardUtilityBarStylesProps {
    data: TimeseriesDataRecord[];
    customize: DashboardUtilityBarCustomizeProps;
}

// ─── Form Data (for buildQuery / transformProps) ─────────────────────────────
export type DashboardUtilityBarQueryFormData = QueryFormData &
    DashboardUtilityBarStylesProps &
    DashboardUtilityBarCustomizeProps;
