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
declare type Rect = {
    x: number;
    y: number;
    width: number;
    height: number;
};
export declare function getLabelFontSize(width: number): number;
export declare const isOverlapping: (rect1: Rect, rect2: Rect) => boolean;
export declare const getRectangle: (element: SVGElement, offset?: number) => Rect;
export declare const getOverlappingElements: (elements: SVGElement[]) => SVGElement[];
export {};
//# sourceMappingURL=utils.d.ts.map