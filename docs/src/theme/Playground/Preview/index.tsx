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

import React, { type ReactNode } from 'react';
import { LiveError, LivePreview } from 'react-live';
import BrowserOnly from '@docusaurus/BrowserOnly';
import { ErrorBoundaryErrorMessageFallback } from '@docusaurus/theme-common';
import ErrorBoundary from '@docusaurus/ErrorBoundary';
import Translate from '@docusaurus/Translate';
import PlaygroundHeader from '@theme/Playground/Header';

import styles from './styles.module.css';

// Get the theme wrapper for Superset components
function getThemeWrapper() {
  if (typeof window === 'undefined') {
    return ({ children }: { children: React.ReactNode }) => <>{children}</>;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { themeObject } = require('@apache-superset/core/ui');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { App } = require('antd');

    if (!themeObject?.SupersetThemeProvider) {
      return ({ children }: { children: React.ReactNode }) => <>{children}</>;
    }

    return ({ children }: { children: React.ReactNode }) => (
      <themeObject.SupersetThemeProvider>
        <App>{children}</App>
      </themeObject.SupersetThemeProvider>
    );
  } catch (e) {
    console.error('[PlaygroundPreview] Failed to load theme provider:', e);
    return ({ children }: { children: React.ReactNode }) => <>{children}</>;
  }
}

function Loader() {
  return <div>Loading...</div>;
}

function ThemedLivePreview(): ReactNode {
  const ThemeWrapper = getThemeWrapper();
  return (
    <ThemeWrapper>
      <LivePreview />
    </ThemeWrapper>
  );
}

function PlaygroundLivePreview(): ReactNode {
  // No SSR for the live preview
  // See https://github.com/facebook/docusaurus/issues/5747
  return (
    <BrowserOnly fallback={<Loader />}>
      {() => (
        <>
          <ErrorBoundary
            fallback={(params) => (
              <ErrorBoundaryErrorMessageFallback {...params} />
            )}
          >
            <ThemedLivePreview />
          </ErrorBoundary>
          <LiveError />
        </>
      )}
    </BrowserOnly>
  );
}

export default function PlaygroundPreview(): ReactNode {
  return (
    <>
      <PlaygroundHeader>
        <Translate
          id="theme.Playground.result"
          description="The result label of the live codeblocks"
        >
          Result
        </Translate>
      </PlaygroundHeader>
      <div className={styles.playgroundPreview}>
        <PlaygroundLivePreview />
      </div>
    </>
  );
}
