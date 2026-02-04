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
 * Example usage of the Theme Token Failure Notification system
 *
 * This file demonstrates how to use the new theme validation utilities
 * and hooks to display informational toasts when theme tokens fail to load
 */
import {
  useThemeValidation,
  useThemeTokenValidation,
} from 'src/hooks/useThemeValidation';
import { withThemeValidation } from 'src/components/ThemeValidationMonitor';
import {
  validateThemeConfiguration,
  getThemeTokenWithErrorHandling,
  showThemeTokenFailureToast,
} from 'src/utils/themeUtils';

// Example 1: Using the validation hook in a component
const ThemeAwareComponent: React.FC = () => {
  // This will validate the theme when the component mounts
  // and show admin-only notifications for any missing tokens
  useThemeValidation(/* themeConfig */ null, 'Dashboard Theme');

  return <div>Dashboard content</div>;
};

// Example 2: Using specific token validation
const ChartComponent: React.FC<{ themeConfig: any }> = ({ themeConfig }) => {
  // Validate specific tokens that this component requires
  useThemeTokenValidation(themeConfig, 'Chart Theme', [
    'colorPrimary',
    'colorSuccess',
    'colorWarning',
    'colorError',
    'fontFamily',
  ]);

  return <div>Chart visualization</div>;
};

// Example 3: Using the HOC wrapper for automatic validation
const EnhancedDashboard = withThemeValidation(
  ({ data }: { data: any }) => <div>Dashboard with {data.length} items</div>,
  ['colorPrimary', 'colorBgBase', 'borderRadius'], // Required tokens
);

// Example 4: Manual theme validation in a service or utility
const validateCustomTheme = (customThemeConfig: any) => {
  // Validate the entire theme configuration
  validateThemeConfiguration('Custom User Theme', customThemeConfig);

  // Or get a specific token with error handling
  const primaryColor = getThemeTokenWithErrorHandling(
    customThemeConfig,
    'colorPrimary',
    'Custom Theme',
    '#1890ff', // fallback value
  );

  return primaryColor;
};

// Example 5: Programmatically show theme failure notifications
const handleThemeLoadError = (tokenName: string, themeName: string) => {
  // This will only show toast to admin users
  showThemeTokenFailureToast(tokenName, themeName);
};

export {
  ThemeAwareComponent,
  ChartComponent,
  EnhancedDashboard,
  validateCustomTheme,
  handleThemeLoadError,
};
