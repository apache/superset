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
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  ReactNode,
  FC,
} from 'react';

export interface AutoRefreshContextValue {
  /** Whether an auto-refresh cycle is in progress */
  isAutoRefreshing: boolean;
  /** Set the auto-refresh state */
  setIsAutoRefreshing: (value: boolean) => void;
  /** Mark auto-refresh as started */
  startAutoRefresh: () => void;
  /** Mark auto-refresh as completed */
  endAutoRefresh: () => void;
}

const AutoRefreshContext = createContext<AutoRefreshContextValue>({
  isAutoRefreshing: false,
  setIsAutoRefreshing: () => {},
  startAutoRefresh: () => {},
  endAutoRefresh: () => {},
});

export interface AutoRefreshProviderProps {
  children: ReactNode;
}

/**
 * Provider that tracks whether an auto-refresh cycle is in progress.
 * Charts can use this context to suppress loading spinners during auto-refresh.
 */
export const AutoRefreshProvider: FC<AutoRefreshProviderProps> = ({
  children,
}) => {
  const [isAutoRefreshing, setIsAutoRefreshing] = useState(false);

  const startAutoRefresh = useCallback(() => {
    setIsAutoRefreshing(true);
  }, []);

  const endAutoRefresh = useCallback(() => {
    setIsAutoRefreshing(false);
  }, []);

  const value = useMemo(
    () => ({
      isAutoRefreshing,
      setIsAutoRefreshing,
      startAutoRefresh,
      endAutoRefresh,
    }),
    [isAutoRefreshing, startAutoRefresh, endAutoRefresh],
  );

  return (
    <AutoRefreshContext.Provider value={value}>
      {children}
    </AutoRefreshContext.Provider>
  );
};

/**
 * Hook to access the auto-refresh context.
 * Use this in chart components to check if spinners should be suppressed.
 */
export const useAutoRefreshContext = (): AutoRefreshContextValue =>
  useContext(AutoRefreshContext);

/**
 * Hook that returns just the isAutoRefreshing flag.
 * Convenience hook for components that only need to check the flag.
 */
export const useIsAutoRefreshing = (): boolean => {
  const { isAutoRefreshing } = useContext(AutoRefreshContext);
  return isAutoRefreshing;
};

export default AutoRefreshContext;
