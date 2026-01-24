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
import transformProps from '../src/transformProps';

describe('MapBox transformProps', () => {
    const chartProps = {
        width: 800,
        height: 600,
        formData: {
            clusteringRadius: 60,
            globalOpacity: 1,
            mapboxColor: 'rgb(0, 0, 0)',
            mapboxStyle: 'mapbox://styles/mapbox/light-v9',
            pandasAggfunc: 'sum',
            pointRadius: 'Auto',
            pointRadiusUnit: 'Pixels',
            renderWhileDragging: true,
        },
        hooks: {},
        queriesData: [
            {
                data: {
                    bounds: [[0, 0], [1, 1]],
                    geoJSON: { features: [] },
                    hasCustomMetric: false,
                    mapboxApiKey: 'test-key',
                },
            },
        ],
    };

    test('should return DEFAULT_POINT_RADIUS when pointRadius is "Auto"', () => {
        const props = transformProps(chartProps);
        expect(props.pointRadius).toBe(60);
    });

    test('should return DEFAULT_POINT_RADIUS when pointRadius is a column name (string)', () => {
        const props = transformProps({
            ...chartProps,
            formData: {
                ...chartProps.formData,
                pointRadius: 'radius_miles',
            },
        });
        // It should be 60 (default), not 'radius_miles'
        expect(props.pointRadius).toBe(60);
    });

    test('should return the number when pointRadius is a number', () => {
        const props = transformProps({
            ...chartProps,
            formData: {
                ...chartProps.formData,
                pointRadius: 42,
            },
        });
        expect(props.pointRadius).toBe(42);
    });
});
