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

/**
 * The host supplies a typed theme through `@apache-superset/core/theme`.
 * Under test the stub uses Emotion directly, whose `Theme` is empty unless
 * augmented, so every token these screens read is declared here.
 *
 * Generated from the `theme.*` reads in `src`, so adding a token to a styled
 * block does not silently fail the whole test program.
 */
import '@emotion/react';

declare module '@emotion/react' {
  export interface Theme {
    borderRadius: number;
    colorBgContainer: string;
    colorBgLayout: string;
    colorErrorBg: string;
    colorInfoBg: string;
    colorPrimary: string;
    colorSplit: string;
    colorSuccessBg: string;
    colorSuccessText: string;
    colorText: string;
    colorTextSecondary: string;
    colorTextTertiary: string;
    colorWarningBg: string;
    colorWarningBorder: string;
    colorWarningText: string;
    fontFamilyCode: string;
    fontSizeSM: number;
    fontSizeXL: number;
    fontWeightNormal: number;
    fontWeightStrong: number;
    sizeUnit: number;
  }
}
