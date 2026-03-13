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
  FC,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import { css } from '@apache-superset/core/ui';

/**
 * StatusAnnouncer - WCAG 4.1.3 Status Messages
 * Provides an ARIA live region for announcing dynamic content updates
 * to assistive technologies (screen readers).
 */

type Politeness = 'polite' | 'assertive';

interface StatusAnnouncerContextType {
  announce: (message: string, politeness?: Politeness) => void;
}

const StatusAnnouncerContext = createContext<StatusAnnouncerContextType>({
  announce: () => {},
});

export const useStatusAnnouncer = () => useContext(StatusAnnouncerContext);

const visuallyHiddenStyle = css`
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

interface StatusAnnouncerProviderProps {
  children: ReactNode;
}

export const StatusAnnouncerProvider: FC<StatusAnnouncerProviderProps> = ({
  children,
}) => {
  const [politeMessage, setPoliteMessage] = useState('');
  const [assertiveMessage, setAssertiveMessage] = useState('');
  const clearTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const announce = useCallback(
    (message: string, politeness: Politeness = 'polite') => {
      if (clearTimeoutRef.current) {
        clearTimeout(clearTimeoutRef.current);
      }

      if (politeness === 'assertive') {
        setAssertiveMessage(message);
      } else {
        setPoliteMessage(message);
      }

      clearTimeoutRef.current = setTimeout(() => {
        setPoliteMessage('');
        setAssertiveMessage('');
      }, 5000);
    },
    [],
  );

  const contextValue = useMemo(() => ({ announce }), [announce]);

  return (
    <StatusAnnouncerContext.Provider value={contextValue}>
      {children}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        css={visuallyHiddenStyle}
        data-test="status-announcer-polite"
      >
        {politeMessage}
      </div>
      <div
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        css={visuallyHiddenStyle}
        data-test="status-announcer-assertive"
      >
        {assertiveMessage}
      </div>
    </StatusAnnouncerContext.Provider>
  );
};

export default StatusAnnouncerProvider;
