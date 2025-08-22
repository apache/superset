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

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import moment from 'moment-timezone';
import { URL_PARAMS } from 'src/constants';
import { getCurrentTimezone as getCurrentTimezoneUtil, isValidTimezone } from 'src/utils/dateUtils';

interface TimezoneContextType {
  timezone: string;
  setTimezone: (timezone: string) => void;
  formatDate: (date: moment.MomentInput, format?: string) => string;
  formatDateTime: (date: moment.MomentInput, format?: string) => string;
  convertToUTC: (date: moment.MomentInput) => moment.Moment;
  convertFromUTC: (utcDate: moment.MomentInput) => moment.Moment;
}

const TimezoneContext = createContext<TimezoneContextType | undefined>(undefined);

const DEFAULT_TIMEZONE = 'Asia/Kolkata';
const DEFAULT_DATE_FORMAT = 'YYYY-MM-DD';
const DEFAULT_DATETIME_FORMAT = 'YYYY-MM-DD HH:mm:ss';

interface TimezoneProviderProps {
  children: ReactNode;
}

export function TimezoneProvider({ children }: TimezoneProviderProps) {
  // Initialize timezone strictly from URL param or default via getCurrentTimezone
  const [timezone, setTimezoneState] = useState<string>(() => {
    const initial = getCurrentTimezoneUtil();
    return initial;
  });

  // Function to update timezone
  const setTimezone = (newTimezone: string) => {
    const targetTz = isValidTimezone(newTimezone) ? newTimezone : DEFAULT_TIMEZONE;
    if (!isValidTimezone(newTimezone)) {
      console.warn(`Invalid timezone: ${newTimezone}. Falling back to default: ${DEFAULT_TIMEZONE}`);
    }
    // Sync URL param so UI always reflects URL or default
    try {
      const url = new URL(window.location.href);
      url.searchParams.set(URL_PARAMS.timezone.name, targetTz);
      // Use replaceState to avoid polluting history
      window.history.replaceState({}, '', url.toString());
    } catch (e) {
      console.warn('Failed to sync timezone to URL param:', e);
    }
    setTimezoneState(targetTz);
  };

  // Function to format date in the current timezone
  const formatDate = (date: moment.MomentInput, format = DEFAULT_DATE_FORMAT): string => {
    return moment.tz(date, timezone).format(format);
  };

  // Function to format datetime in the current timezone
  const formatDateTime = (date: moment.MomentInput, format = DEFAULT_DATETIME_FORMAT): string => {
    return moment.tz(date, timezone).format(format);
  };

  // Convert a date from current timezone to UTC for API calls
  const convertToUTC = (date: moment.MomentInput): moment.Moment => {
    // First parse the date in the current timezone, then convert to UTC
    return moment.tz(date, timezone).utc();
  };

  // Convert a UTC date to the current timezone for display
  const convertFromUTC = (utcDate: moment.MomentInput): moment.Moment => {
    // Parse as UTC, then convert to current timezone
    return moment.utc(utcDate).tz(timezone);
  };

  // Watch for URL parameter changes to always reflect URL or default
  useEffect(() => {
    const handlePopState = () => {
      const current = getCurrentTimezoneUtil();
      setTimezoneState(current);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const contextValue: TimezoneContextType = {
    timezone,
    setTimezone,
    formatDate,
    formatDateTime,
    convertToUTC,
    convertFromUTC,
  };

  return (
    <TimezoneContext.Provider value={contextValue}>
      {children}
    </TimezoneContext.Provider>
  );
}

export function useTimezone(): TimezoneContextType {
  const context = useContext(TimezoneContext);
  if (context === undefined) {
    throw new Error('useTimezone must be used within a TimezoneProvider');
  }
  return context;
}

export { TimezoneContext };