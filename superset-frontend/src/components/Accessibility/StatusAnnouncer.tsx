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
import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { styled } from '@superset-ui/core';

/**
 * StatusAnnouncer - WCAG 4.1.3 Status Messages
 * Provides ARIA live regions for screen reader announcements.
 * - Polite region: for non-urgent status updates (loading, saving)
 * - Assertive region: for urgent messages (errors, alerts)
 */

const VisuallyHidden = styled.div`
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
`;

interface AnnouncerContextType {
  announcePolite: (message: string) => void;
  announceAssertive: (message: string) => void;
}

const AnnouncerContext = createContext<AnnouncerContextType | null>(null);

export const useAnnouncer = (): AnnouncerContextType => {
  const context = useContext(AnnouncerContext);
  if (!context) {
    // Return no-op functions if used outside provider
    return {
      announcePolite: () => {},
      announceAssertive: () => {},
    };
  }
  return context;
};

interface StatusAnnouncerProps {
  children: React.ReactNode;
}

export const StatusAnnouncerProvider: React.FC<StatusAnnouncerProps> = ({ children }) => {
  const [politeMessage, setPoliteMessage] = useState('');
  const [assertiveMessage, setAssertiveMessage] = useState('');

  const announcePolite = useCallback((message: string) => {
    // Clear first to ensure re-announcement of same message
    setPoliteMessage('');
    setTimeout(() => setPoliteMessage(message), 100);
  }, []);

  const announceAssertive = useCallback((message: string) => {
    setAssertiveMessage('');
    setTimeout(() => setAssertiveMessage(message), 100);
  }, []);

  const contextValue = useMemo(
    () => ({ announcePolite, announceAssertive }),
    [announcePolite, announceAssertive]
  );

  return (
    <AnnouncerContext.Provider value={contextValue}>
      {children}
      {/* Polite live region for status updates */}
      <VisuallyHidden
        id="a11y-status-announcer"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {politeMessage}
      </VisuallyHidden>
      {/* Assertive live region for alerts/errors */}
      <VisuallyHidden
        id="a11y-alert-announcer"
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
      >
        {assertiveMessage}
      </VisuallyHidden>
    </AnnouncerContext.Provider>
  );
};

export default StatusAnnouncerProvider;
