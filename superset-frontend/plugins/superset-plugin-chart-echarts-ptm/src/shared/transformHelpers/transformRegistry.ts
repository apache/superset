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
 * software distributed under this License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */


export interface TransformConfig {
  defaults?: boolean;
  seriesType?: boolean;
  dataZoom?: boolean;
  colorPalette?: boolean;
  pillFormat?: boolean;
  userOverrides?: boolean;
}


export const DEFAULT_TRANSFORMS: TransformConfig = {
  defaults: true,
  seriesType: false,
  dataZoom: false,
  colorPalette: true,
  pillFormat: false,
  userOverrides: true,
};


export function resolveTransformConfig(
  config?: TransformConfig,
): TransformConfig {
  if (!config) {
    return { ...DEFAULT_TRANSFORMS };
  }
  return { ...DEFAULT_TRANSFORMS, ...config };
}
