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
import {
  useState,
  useEffect,
  ReactNode,
  useRef,
  useMemo,
  Component,
} from 'react';
import { Theme } from '@apache-superset/core/ui';

interface ComponentThemeProviderProps {
  /** The theme ID to apply (from component.meta.theme_id) */
  themeId?: number | null;
  /** Child components to wrap with theme */
  children: ReactNode;
  /** Optional fallback to render while loading */
  fallback?: ReactNode;
}

/**
 * Error boundary that catches useThemeContext errors when no ThemeProvider exists.
 * Falls back to rendering children without theme wrapping.
 */
class ThemeContextErrorBoundary extends Component<
  { children: ReactNode; fallbackChildren: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode; fallbackChildren: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    // Only suppress "useThemeContext must be used within a ThemeProvider" errors
    if (
      !error.message.includes(
        'useThemeContext must be used within a ThemeProvider',
      )
    ) {
      throw error;
    }
  }

  render() {
    if (this.state.hasError) {
      return <>{this.props.fallbackChildren}</>;
    }
    return <>{this.props.children}</>;
  }
}

/**
 * Inner component that uses theme context - wrapped in error boundary
 */
const ComponentThemeProviderInner = ({
  themeId,
  children,
  fallback = null,
}: ComponentThemeProviderProps) => {
  // Import useThemeContext dynamically to avoid issues when ThemeProvider not available
  // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
  const { useThemeContext } = require('src/theme/ThemeProvider');
  const { theme: parentTheme, createTheme } = useThemeContext();

  const [theme, setTheme] = useState<Theme | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Use a ref for parent theme config to avoid infinite re-render loops.
  // The parent theme config is captured once on mount and when themeId changes,
  // preventing the theme loading effect from re-running due to parent theme
  // reference changes.
  const parentThemeConfigRef = useRef<ReturnType<
    typeof parentTheme.toSerializedConfig
  > | null>(null);

  // Capture parent theme config synchronously on render (before effect runs)
  // This ensures we have the latest parent theme when loading the component theme
  if (parentTheme?.toSerializedConfig) {
    try {
      parentThemeConfigRef.current = parentTheme.toSerializedConfig();
    } catch {
      parentThemeConfigRef.current = null;
    }
  }

  useEffect(() => {
    let isMounted = true;

    const loadTheme = async () => {
      if (!themeId) {
        setTheme(null);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        // Create component theme merged with parent theme for proper inheritance
        // Use the ref value to avoid dependency on parentThemeConfig object
        const loadedTheme = await createTheme(
          String(themeId),
          parentThemeConfigRef.current,
        );
        if (isMounted) {
          setTheme(loadedTheme);
        }
      } catch (err) {
        if (isMounted) {
          setError(
            err instanceof Error ? err : new Error('Failed to load theme'),
          );
          // eslint-disable-next-line no-console
          console.error(`Failed to load component theme ${themeId}:`, err);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadTheme();

    return () => {
      isMounted = false;
    };
  }, [themeId, createTheme]);

  // If no theme ID or error, just render children
  if (!themeId || error) {
    return <>{children}</>;
  }

  // Show fallback while loading
  if (isLoading && !theme) {
    return <>{fallback || children}</>;
  }

  // If theme loaded, wrap children with theme provider
  if (theme) {
    const ThemeProvider = theme.SupersetThemeProvider;
    return <ThemeProvider>{children}</ThemeProvider>;
  }

  // Fallback: render children without wrapper
  return <>{children}</>;
};

/**
 * A component-level theme provider for granular theming in dashboards.
 *
 * This component fetches and applies a specific theme to its children,
 * enabling per-component theming within the dashboard hierarchy:
 * Instance → Dashboard → Tab → Row/Column → Chart/Component
 *
 * **Hierarchical Inheritance**: When a component has a theme, it is merged
 * with the parent component's theme. This allows each level to override
 * specific tokens while inheriting others from its parent.
 *
 * When no themeId is provided, children are rendered without any theme
 * wrapper, inheriting from the parent theme context.
 *
 * This component gracefully handles the case where no ThemeProvider exists
 * in the component tree (e.g., in tests) by simply rendering children.
 *
 * @example
 * ```tsx
 * // Dashboard with Theme A
 * <ComponentThemeProvider themeId={dashboardThemeId}>
 *   // Row with Theme B (inherits from Theme A, overrides specific tokens)
 *   <ComponentThemeProvider themeId={rowThemeId}>
 *     // Chart inherits Theme B's tokens
 *     <ChartContent />
 *   </ComponentThemeProvider>
 * </ComponentThemeProvider>
 * ```
 */
const ComponentThemeProvider = ({
  themeId,
  children,
  fallback = null,
}: ComponentThemeProviderProps) => {
  // If no theme ID provided, skip all theme loading logic
  if (!themeId) {
    return <>{children}</>;
  }

  return (
    <ThemeContextErrorBoundary fallbackChildren={children}>
      <ComponentThemeProviderInner themeId={themeId} fallback={fallback}>
        {children}
      </ComponentThemeProviderInner>
    </ThemeContextErrorBoundary>
  );
};

export default ComponentThemeProvider;

/**
 * Hook to get component theme info for debugging/display purposes
 */
export function useComponentTheme(themeId?: number | null) {
  // For now, just generate a placeholder name synchronously
  // In production, this could be extended to fetch the theme name from the API
  return useMemo(
    () => ({
      themeId,
      themeName: themeId ? `Theme ${themeId}` : null,
      hasTheme: !!themeId,
    }),
    [themeId],
  );
}
