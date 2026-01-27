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
 * @fileoverview EditorHost component for dynamic editor resolution.
 *
 * This component resolves and renders the appropriate editor implementation
 * based on the language and any registered extension providers. If an extension
 * has registered an editor for the language, it uses that; otherwise, it falls
 * back to the default Ace editor.
 */

import { useState, useEffect, forwardRef } from 'react';
import type { editors, contributions } from '@apache-superset/core';
import { useTheme } from '@apache-superset/core/ui';
import EditorProviders from './EditorProviders';
import AceEditorProvider from './AceEditorProvider';

type EditorLanguage = contributions.EditorLanguage;
type EditorProps = editors.EditorProps;
type EditorHandle = editors.EditorHandle;

/**
 * Props for EditorHost component.
 * Uses the generic EditorProps interface that all editor implementations support.
 */
export type EditorHostProps = EditorProps;

/**
 * Hook to track editor provider changes.
 * Returns the provider for the specified language and re-renders when it changes.
 */
const useEditorProvider = (language: EditorLanguage) => {
  const manager = EditorProviders.getInstance();
  const [provider, setProvider] = useState(() => manager.getProvider(language));

  useEffect(() => {
    // Subscribe to provider changes
    const registerDisposable = manager.onDidRegister(event => {
      if (event.provider.contribution.languages.includes(language)) {
        setProvider(event.provider);
      }
    });

    const unregisterDisposable = manager.onDidUnregister(event => {
      if (event.contribution.languages.includes(language)) {
        setProvider(manager.getProvider(language));
      }
    });

    // Check for provider on mount (in case it was registered before this component mounted)
    const currentProvider = manager.getProvider(language);
    if (currentProvider !== provider) {
      setProvider(currentProvider);
    }

    return () => {
      registerDisposable.dispose();
      unregisterDisposable.dispose();
    };
  }, [language, manager, provider]);

  return provider;
};

/**
 * EditorHost component that dynamically resolves and renders the appropriate editor.
 *
 * This component serves as the main entry point for rendering editors in Superset.
 * It checks if an extension has registered a custom editor for the requested language
 * and uses that if available; otherwise, it falls back to the default Ace editor.
 *
 * @example
 * ```tsx
 * <EditorHost
 *   id="sql-editor-1"
 *   value={sql}
 *   onChange={setSql}
 *   language="sql"
 *   height="400px"
 * />
 * ```
 */
const EditorHost = forwardRef<EditorHandle, EditorHostProps>((props, ref) => {
  const { language } = props;
  const theme = useTheme();
  const provider = useEditorProvider(language);

  // Merge theme into props
  const propsWithTheme = { ...props, theme };

  // Use extension-provided editor if available
  if (provider) {
    const EditorComponent = provider.component;
    return <EditorComponent ref={ref} {...propsWithTheme} />;
  }

  // Fall back to default Ace editor
  return <AceEditorProvider ref={ref} {...propsWithTheme} />;
});

EditorHost.displayName = 'EditorHost';

export default EditorHost;

export { EditorHost };
