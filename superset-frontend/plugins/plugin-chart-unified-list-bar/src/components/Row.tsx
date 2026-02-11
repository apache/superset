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
import React from 'react';
import { TimeseriesDataRecord, safeHtmlSpan } from '@superset-ui/core';
import {
    RowContainer,
    KeySection,
    KeyField,
    KeySubField,
    ContentSection,
    SecondaryFieldsContainer,
    SecondaryField,
    BarSection,
    BarContainer,
    BarFill,
} from '../styles';
import { UnifiedListBarChartCustomizeProps } from '../types';

// Built-in severity icon mapping (0=none, 1=warning, 2=error, 3=critical)
const getSeverityIcon = (severityValue: any) => {
    const numVal = Number(severityValue);
    switch (numVal) {
        case 0: return null; // No icon
        case 1: return { icon: '⚠', color: '#f39c12' }; // Warning - yellow/orange
        case 2: return { icon: '⚠', color: '#0e0d0df' }; // Error - redish black (per user's edited Row.tsx)
        case 3: return { icon: '⚠', color: '#c0392b' }; // Critical - dark red
        default: return null;
    }
};

// Helper to convert hex color (with or without #) to valid CSS color
const ensureHexColor = (color: any): string => {
    if (!color) return '#000000';
    const colorStr = String(color).trim();
    if (colorStr.startsWith('#')) return colorStr;
    if (/^[0-9a-fA-F]{6}$/.test(colorStr)) return `#${colorStr}`;
    if (/^[0-9a-fA-F]{3}$/.test(colorStr)) return `#${colorStr}`;
    return '#000000'; // Default black
};

interface RowProps {
    record: TimeseriesDataRecord;
    customize: UnifiedListBarChartCustomizeProps;
    maxMetricValue: number;
}

export const Row: React.FC<RowProps> = ({ record, customize, maxMetricValue }) => {
    const {
        keyColumn,
        keySubColumn,
        secondaryColumns,
        metricColumn,
        maxMetricColumn,
        severityColumn,
        colorColumn,
        displayValueColumn,
        rowsPerItem,
        showBar,
        keyFontSize,
        keyColor,
        keySubFontSize,
        secondaryFontSize,
        displayValueFontSize,
        barColorPositive,
    } = customize;

    let effectiveKeyColumn = keyColumn;

    // FALLBACK: If keyColumn is empty, use the first column
    if (!effectiveKeyColumn && record && Object.keys(record).length > 0) {
        effectiveKeyColumn = Object.keys(record)[0];
    }

    // FALLBACK: If no secondary columns configured, auto-discover from record
    let effectiveSecondaryColumns = secondaryColumns;
    if (!effectiveSecondaryColumns || effectiveSecondaryColumns.length === 0) {
        const excludedColumns = [
            effectiveKeyColumn,
            keySubColumn,
            metricColumn,
            maxMetricColumn,
            severityColumn,
            colorColumn,
            displayValueColumn,
        ].filter(Boolean);

        effectiveSecondaryColumns = Object.keys(record).filter(key => !excludedColumns.includes(key));
    }

    const keyValue = record[effectiveKeyColumn];
    const keySubValue = keySubColumn ? record[keySubColumn] : undefined;
    const metricValue = metricColumn ? (record[metricColumn] as number) : 0;
    const severityValue = severityColumn ? record[severityColumn] : undefined;
    const displayValue = displayValueColumn ? record[displayValueColumn] : undefined;

    // Get color from data column if specified, otherwise use default/configured color
    const rawColorValue = colorColumn ? record[colorColumn] : null;
    const dataColor = colorColumn ? ensureHexColor(rawColorValue) : null;
    const effectiveKeyColor = dataColor || keyColor || '#000000';
    const effectiveBarColor = dataColor || barColorPositive || '#4caf50';

    // DEBUG: If key value is undefined, show error
    if (keyValue === undefined) {
        return (
            <RowContainer rowsPerItem={rowsPerItem} style={{ border: '1px solid red', backgroundColor: '#fff0f0' }}>
                <div style={{ color: 'red', fontFamily: 'monospace', fontSize: '12px', padding: '8px' }}>
                    <strong>Error: Key Column "{String(keyColumn)}" not found.</strong>
                    <br />
                    <strong>Available Keys:</strong> {Object.keys(record).join(', ')}
                </div>
            </RowContainer>
        );
    }

    // Get severity icon from built-in mapping
    const severityDisplay = severityValue !== undefined ? getSeverityIcon(severityValue) : null;

    // Bar Calculation
    const percent = maxMetricValue > 0 ? Math.min((metricValue / maxMetricValue) * 100, 100) : 0;

    // Determine if we should show bar section
    const hasBarData = metricColumn && showBar;

    return (
        <RowContainer rowsPerItem={rowsPerItem}>
            {/* Left: Key Column with optional sub-text */}
            <KeySection>
                <KeyField fontSize={keyFontSize} color={effectiveKeyColor}>
                    {safeHtmlSpan(String(keyValue))}
                </KeyField>
                {keySubValue !== undefined && (
                    <KeySubField fontSize={keySubFontSize}>
                        {safeHtmlSpan(String(keySubValue))}
                    </KeySubField>
                )}
            </KeySection>

            {/* Right: Content Section containing secondary info, value, and bar */}
            <ContentSection>
                {/* Horizontal row for secondary fields (left) and display value (right) */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
                    <SecondaryFieldsContainer>
                        {effectiveSecondaryColumns.map((col) => (
                            <SecondaryField key={col} fontSize={secondaryFontSize}>
                                {safeHtmlSpan(String(record[col]))}
                            </SecondaryField>
                        ))}
                    </SecondaryFieldsContainer>

                    {/* Right-aligned Display Value and Icon */}
                    {(displayValue !== undefined || severityDisplay) && (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            marginLeft: '16px',
                            textAlign: 'right'
                        }}>
                            {displayValue !== undefined && (
                                <span style={{
                                    fontSize: `${displayValueFontSize}px`,
                                    fontWeight: 'bold',
                                    color: '#777777', // Grayish as in the image
                                }}>
                                    {displayValue}
                                </span>
                            )}
                            <span style={{
                                color: severityDisplay ? severityDisplay.color : undefined, // Apply color if severityDisplay exists
                                fontSize: '24px', // Standard icon size
                                display: 'flex',
                                alignItems: 'center',
                                width: '24px',    // Fixed width reservation
                                justifyContent: 'center',
                                visibility: severityDisplay ? 'visible' : 'hidden' // Hide but keep space
                            }}>
                                {severityDisplay ? severityDisplay.icon : '⚠'}
                            </span>
                        </div>
                    )}
                </div>

                {/* Bar below secondary columns and display value */}
                {hasBarData && (
                    <BarSection>
                        <BarContainer>
                            <BarFill width={percent} color={effectiveBarColor} />
                        </BarContainer>
                    </BarSection>
                )}
            </ContentSection>
        </RowContainer>
    );
};
