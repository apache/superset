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
import { useThemeContext } from 'src/theme/ThemeProvider';
import { validateThemeConfiguration } from 'src/utils/themeUtils';

/**
 * Component that validates the current theme on mount
 * This ensures theme validation happens when the app initializes
 * and shows admin notifications for any theme issues
 */
export const ThemeValidationMonitor: React.FC = () => {
  const themeContext = useThemeContext();

  useEffect(() => {
    if (themeContext?.theme) {
      // Get the current theme configuration from the theme object
      const currentThemeConfig = themeContext.theme;

      // Determine the theme name based on current context
      let themeName = 'Current Theme';

      if (themeContext.themeMode === 'dark') {
        themeName = 'Dark Mode';
      } else if (themeContext.themeMode === 'light') {
        themeName = 'Light Mode';
      }

      // Get applied theme ID if available
      const appliedThemeId = themeContext.getAppliedThemeId?.();
      if (appliedThemeId) {
        themeName = `Theme ${appliedThemeId}`;
      }

      // Validate the current theme configuration
      validateThemeConfiguration(themeName, currentThemeConfig);
    }
  }, [themeContext]);

  // This is a monitoring component that doesn't render anything
  return null;
};

/**
 * HOC to add theme validation to any component
 * Useful for components that need to ensure their theme is properly configured
 */
export const withThemeValidation =
  <P extends object>(
    Component: React.ComponentType<P>,
    requiredTokens: string[] = [],
  ) =>
  (props: P) => {
    const themeContext = useThemeContext();

    useEffect(() => {
      if (themeContext?.theme && requiredTokens.length > 0) {
        // Import the validation function dynamically to avoid circular dependencies
        import('src/utils/themeUtils').then(({ validateThemeTokens }) => {
          const appliedThemeId = themeContext.getAppliedThemeId?.();
          const themeName = appliedThemeId
            ? `Theme ${appliedThemeId}`
            : 'Current Theme';

          validateThemeTokens(themeContext.theme, themeName, requiredTokens);
        });
      }
    }, [themeContext]);

    return <Component {...props} />;
  };

// Set display name for the HOC
withThemeValidation.displayName = 'withThemeValidation';

export default ThemeValidationMonitor;
