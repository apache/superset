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
    LeftSection,
    KeyField,
    KeySubField,
    StatusField,
    MiddleSection,
    ArrowContainer,
    ArrowShape,
    ArrowText,
    RightSection,
    SecondaryField,
    TertiaryField,
    EndSection,
    EndField,
    EndFieldLabel,
} from '../styles';
import { UnifiedListBarChartCustomizeProps } from '../types';

// Helper to convert hex color (with or without #) to valid CSS color
const ensureHexColor = (color: any): string => {
    if (!color) return '#cccccc'; // Default gray if missing
    const colorStr = String(color).trim();
    if (colorStr.startsWith('#')) return colorStr;
    if (/^[0-9a-fA-F]{6}$/.test(colorStr)) return `#${colorStr}`;
    if (/^[0-9a-fA-F]{3}$/.test(colorStr)) return `#${colorStr}`;
    return colorStr; // Return as is if it might be a named color
};

interface RowProps {
    record: TimeseriesDataRecord;
    customize: UnifiedListBarChartCustomizeProps;
}

export const Row: React.FC<RowProps> = ({ record, customize }) => {
    const {
        statusColumn,
        keyColumn,
        keySubColumn,
        arrowTextColumn,
        arrowColorColumn,
        secondaryColumns,
        tertiaryColumn,
        endColumn,

        // Styles
        keyFontSize,
        keyColor,
        keySubFontSize,
        secondaryFontSize,
        displayValueFontSize, // End column font size
    } = customize;

    // Helper to extract value safely even if casing mismatches or key is missing
    const getValue = (columnName?: string) => {
        if (!columnName) return undefined;
        if (record[columnName] !== undefined) return record[columnName];
        // Fallback: check case-insensitive match
        const key = Object.keys(record).find(k => k.toLowerCase() === columnName.toLowerCase());
        if (key) return record[key];
        return undefined;
    };

    // LEFT SECTION
    const statusValue = getValue(statusColumn);
    const keyValue = getValue(keyColumn);
    const keySubValue = getValue(keySubColumn);

    // MIDDLE SECTION (ARROW)
    const arrowText = getValue(arrowTextColumn);
    const arrowColorRaw = getValue(arrowColorColumn);
    const arrowColor = ensureHexColor(arrowColorRaw);

    // RIGHT SECTION
    const secondaryColName = secondaryColumns && secondaryColumns.length > 0 ? secondaryColumns[0] : undefined;
    const secondaryValue = secondaryColName ? getValue(secondaryColName) : undefined;

    const tertiaryValue = getValue(tertiaryColumn);

    // END SECTION
    const endValue = getValue(endColumn);
    const endLabel = endColumn;

    // DEBUG: If key column name provided but value not found (and not just null, but truly undefined/missing)
    // We only show error if Key Column is strictly required and missing.
    // If keyColumn is empty string, that's a config error (captured below).
    if (keyColumn && keyValue === undefined && !Object.keys(record).some(k => k === keyColumn)) {
        // Proceed to render error, but allow if keyValue is null (from DB)
    }

    // CRITICAL ERROR: Key Column not configured or not found in data
    // If keyColumn is empty, show error.
    // If keyColumn is set but not found in record, show error.
    if (!keyColumn || (keyValue === undefined && !Object.keys(record).includes(keyColumn))) {
        // Fallback: if no key column configured, maybe we can just show the first column?
        // But better to warn user.
        return (
            <RowContainer style={{ border: '1px solid red', backgroundColor: '#fff0f0' }}>
                <div style={{ color: 'red', fontFamily: 'monospace', fontSize: '12px', padding: '8px' }}>
                    <strong>Error: Key Column "{String(keyColumn)}" not found.</strong>
                    <br />
                    <strong>Record Keys:</strong> {Object.keys(record).join(', ')}
                    {/* 
                      Note: If keyColumn is empty string, it means transformProps failed to pick it up.
                      If keyColumn is "SomeCol" but not in record, it means query mismatch.
                    */}
                </div>
            </RowContainer>
        );
    }

    return (
        <RowContainer>
            {/* Left: Status, Key, Sub */}
            <LeftSection>
                {statusValue && (
                    <StatusField>
                        {safeHtmlSpan(String(statusValue))}
                    </StatusField>
                )}
                <KeyField fontSize={keyFontSize} color={keyColor}>
                    {safeHtmlSpan(String(keyValue))}
                </KeyField>
                {keySubValue && (
                    <KeySubField fontSize={keySubFontSize}>
                        {safeHtmlSpan(String(keySubValue))}
                    </KeySubField>
                )}
            </LeftSection>

            {/* Middle: Arrow */}
            <MiddleSection>
                <ArrowContainer>
                    <ArrowShape color={arrowColor} />
                    {arrowText && (
                        <ArrowText>
                            {safeHtmlSpan(String(arrowText))}
                        </ArrowText>
                    )}
                </ArrowContainer>
            </MiddleSection>

            {/* Right: Secondary (Label?), Tertiary (Value) */}
            <RightSection>
                {secondaryColName && (
                    <div style={{ marginBottom: '4px' }}>
                        <div style={{ fontSize: '12px', color: '#777', fontWeight: 'bold' }}>
                            {secondaryColName}
                        </div>
                        <SecondaryField fontSize={secondaryFontSize}>
                            {safeHtmlSpan(String(secondaryValue || '-'))}
                        </SecondaryField>
                    </div>
                )}

                {tertiaryColumn && (
                    <div>
                        <TertiaryField fontSize={secondaryFontSize}>
                            {safeHtmlSpan(String(tertiaryValue))}
                        </TertiaryField>
                    </div>
                )}
            </RightSection>

            {/* End Section: End Column */}
            <EndSection>
                {endLabel && (
                    <EndFieldLabel>
                        {endLabel}
                    </EndFieldLabel>
                )}
                {endValue && (
                    <EndField fontSize={displayValueFontSize}>
                        {safeHtmlSpan(String(endValue))}
                    </EndField>
                )}
            </EndSection>

        </RowContainer>
    );
};
