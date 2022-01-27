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
import { TreePathInfo } from './types';
export declare const COLOR_SATURATION: number[];
export declare const LABEL_FONTSIZE = 11;
export declare const BORDER_WIDTH = 2;
export declare const GAP_WIDTH = 2;
export declare const BORDER_COLOR = "#fff";
export declare const extractTreePathInfo: (treePathInfo: TreePathInfo[] | undefined) => {
    metricLabel: string;
    treePath: string[];
};
//# sourceMappingURL=constants.d.ts.map