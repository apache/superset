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
import { getNumberFormatter } from '@superset-ui/core';
import { renderNormalizedTooltip } from '../../src/Radar/utils';

describe('renderNormalizedTooltip', () => {
    const mockGetDenormalizedValue = jest.fn((_, value) => Number(value));
    const metrics = ['metric1', 'metric2'];
    const params = {
        color: 'red',
        name: 'series1',
        value: [100, 200],
    };
    const metricsWithCustomBounds = new Set<string>();

    it('should render tooltip with formatted values when formatter is provided', () => {
        const formatter = getNumberFormatter(',.2f');
        const tooltip = renderNormalizedTooltip(
            params,
            metrics,
            mockGetDenormalizedValue,
            metricsWithCustomBounds,
            formatter,
        );
        expect(tooltip).toContain('100.00');
        expect(tooltip).toContain('200.00');
    });

    it('should render tooltip with raw values when formatter is not provided', () => {
        const tooltip = renderNormalizedTooltip(
            params,
            metrics,
            mockGetDenormalizedValue,
            metricsWithCustomBounds,
        );
        expect(tooltip).toContain('100');
        expect(tooltip).toContain('200');
    });
});
