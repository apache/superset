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
import { Datasource, QueryFormData, JsonObject } from '@superset-ui/core';
import { Viewport } from './utils/fitViewport';
import { Point } from './types';
declare type deckGLComponentProps = {
    datasource: Datasource;
    formData: QueryFormData;
    height: number;
    onAddFilter: () => void;
    payload: JsonObject;
    setControlValue: () => void;
    viewport: Viewport;
    width: number;
};
interface getLayerType<T> {
    (formData: QueryFormData, payload: JsonObject, onAddFilter: () => void, setTooltip: (tooltip: string) => void): T;
}
interface getPointsType<T> {
    (point: number[]): T;
}
export declare function createDeckGLComponent(getLayer: getLayerType<unknown>, getPoints: getPointsType<Point[]>): React.ComponentClass<deckGLComponentProps>;
export declare function createCategoricalDeckGLComponent(getLayer: getLayerType<unknown>, getPoints: getPointsType<Point[]>): (props: deckGLComponentProps) => JSX.Element;
export {};
//# sourceMappingURL=factory.d.ts.map