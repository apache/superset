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
import { useEffect } from 'react';
import { validateThemeConfiguration } from 'src/utils/themeUtils';

/**
 * Hook to validate theme configuration and show admin notifications on load failures
 * This hook runs validation when the component mounts and whenever dependencies change
 */
export const useThemeValidation = (
  themeConfig: any,
  themeName: string = 'current',
): void => {
  useEffect(() => {
    if (themeConfig) {
      // Validate the theme configuration and show notifications for any issues
      validateThemeConfiguration(themeName, themeConfig);
    }
  }, [themeConfig, themeName]);
};

/**
 * Hook to validate specific theme tokens and show admin notifications for missing ones
 */
export const useThemeTokenValidation = (
  themeConfig: any,
  themeName: string = 'current',
  requiredTokens: string[] = [],
): void => {
  useEffect(() => {
    if (themeConfig && requiredTokens.length > 0) {
      // Import here to avoid circular dependencies
      import('src/utils/themeUtils').then(({ validateThemeTokens }) => {
        validateThemeTokens(themeConfig, themeName, requiredTokens);
      });
    }
  }, [themeConfig, themeName, requiredTokens]);
};
