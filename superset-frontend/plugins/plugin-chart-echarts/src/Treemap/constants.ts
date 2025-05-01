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

import { TreePathInfo } from '../types';

export const COLOR_SATURATION = [0.7, 0.4];
export const LABEL_FONTSIZE = 11;
export const BORDER_WIDTH = 2;
export const GAP_WIDTH = 2;
export const BORDER_COLOR = '#fff';

export const extractTreePathInfo = (
  treePathInfo: TreePathInfo[] | undefined,
) => {
  const treePath = (treePathInfo ?? [])
    .map(pathInfo => pathInfo?.name || '')
    .filter(path => path !== '');

  // the 1st tree path is metric label
  const metricLabel = treePath.shift() || '';
  return { metricLabel, treePath };
};
