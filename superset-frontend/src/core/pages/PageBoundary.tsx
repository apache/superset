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

import { ReactNode, useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { t } from '@apache-superset/core/translation';
import { Button } from '@superset-ui/core/components';
import { ErrorBoundary } from 'src/components/ErrorBoundary';
import { ErrorAlert } from 'src/components/ErrorMessage/ErrorAlert';

export interface PageBoundaryProps {
  /** The page's registry id, so one page's crash cannot reach another. */
  id: string;
  /**
   * Optional as React's own `PropsWithChildren` has it, so the boundary can
   * be built with `createElement`, which passes children as a third argument
   * rather than in props.
   */
  children?: ReactNode;
}

/**
 * Catches a crash in a contributed page, and offers a way out of it.
 *
 * `ErrorBoundary` keeps its caught error in state with no way to clear it, so
 * on its own a page that threw once keeps rendering that error for as long as
 * it stays mounted. For a host screen that is tolerable -- navigating away
 * unmounts it. A contributed page owns a whole subtree of URLs, so the user
 * can move from `/queue/42` to `/queue/43` without leaving the page, and
 * without this they would carry the first crash with them and have to reload
 * the browser.
 *
 * Two ways out, and neither re-renders the host:
 *
 * - **Retry**, which remounts the page's component tree by changing the
 *   boundary's key. Worth offering because a page's first render usually
 *   depends on a request, and the common crash is a response that was not
 *   what the component expected.
 * - **Moving within the page**, which clears the error on its own. A crash
 *   while rendering one record should not make the rest unreachable.
 *
 * The error is kept here rather than read from `ErrorBoundary`, which does not
 * expose it; the boundary is told not to render its own message so that this
 * one, with the retry, is what the user sees.
 */
export default function PageBoundary({ id, children }: PageBoundaryProps) {
  const { pathname } = useLocation();
  const [failure, setFailure] = useState<{ error: Error; at: string } | null>(
    null,
  );
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    // Only a crash recorded at a *different* sub-path, so the one that just
    // happened here is not wiped by this effect's first run.
    if (failure && failure.at !== pathname) {
      setFailure(null);
      // The boundary has to be remounted as well as the error forgotten:
      // clearing this state alone leaves the same `ErrorBoundary` instance
      // in place, still holding the error it caught, rendering nothing.
      setAttempt(current => current + 1);
    }
  }, [failure, pathname]);

  const retry = useCallback(() => {
    setFailure(null);
    setAttempt(current => current + 1);
  }, []);

  const onError = useCallback(
    (error: Error) => setFailure({ error, at: pathname }),
    [pathname],
  );

  if (failure) {
    return (
      <ErrorAlert
        errorType={t('Something went wrong on this page')}
        message={failure.error.toString().split('\n')[0]}
        description={
          <Button buttonStyle="secondary" buttonSize="small" onClick={retry}>
            {t('Try again')}
          </Button>
        }
        descriptionDetails={failure.error.stack}
        type="error"
        closable={false}
      />
    );
  }

  return (
    <ErrorBoundary key={`${id}:${attempt}`} showMessage={false} onError={onError}>
      {children}
    </ErrorBoundary>
  );
}
