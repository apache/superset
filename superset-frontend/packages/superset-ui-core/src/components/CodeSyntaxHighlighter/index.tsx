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
import { useCallback, useEffect, useRef, useState } from 'react';
import SyntaxHighlighterBase from 'react-syntax-highlighter/dist/cjs/light';
import github from 'react-syntax-highlighter/dist/cjs/styles/hljs/github';
import tomorrow from 'react-syntax-highlighter/dist/cjs/styles/hljs/tomorrow-night';
import { css, isThemeDark, useTheme } from '@apache-superset/core/theme';
import { Icons } from '../Icons';

export type SupportedLanguage = 'sql' | 'htmlbars' | 'markdown' | 'json';

export interface CodeSyntaxHighlighterProps {
  children: string;
  language?: SupportedLanguage;
  customStyle?: React.CSSProperties;
  showLineNumbers?: boolean;
  wrapLines?: boolean;
  style?: any; // Override theme style if needed
  showCopyButton?: boolean;
}

// Track which languages have been registered to avoid duplicate registrations
const registeredLanguages = new Set<SupportedLanguage>();

// Language import functions - these will be called lazily
const languageImporters = {
  sql: () => import('react-syntax-highlighter/dist/cjs/languages/hljs/sql'),
  htmlbars: () =>
    import('react-syntax-highlighter/dist/cjs/languages/hljs/htmlbars'),
  markdown: () =>
    import('react-syntax-highlighter/dist/cjs/languages/hljs/markdown'),
  json: () => import('react-syntax-highlighter/dist/cjs/languages/hljs/json'),
};

/**
 * Lazily register a language for syntax highlighting
 */
const registerLanguage = async (language: SupportedLanguage): Promise<void> => {
  if (registeredLanguages.has(language)) {
    return; // Already registered
  }

  try {
    const languageModule = await languageImporters[language]();
    SyntaxHighlighterBase.registerLanguage(language, languageModule.default);
    registeredLanguages.add(language);
  } catch (error) {
    console.warn(`Failed to load language ${language}:`, error);
  }
};

/**
 * A themed syntax highlighter component that automatically adapts to Superset's current theme.
 * Supports light/dark mode switching and provides consistent styling across the application.
 * Languages are loaded lazily to improve initial page load performance.
 * Uses ultra-neutral themes for professional, consistent appearance.
 */
export const CodeSyntaxHighlighter: React.FC<CodeSyntaxHighlighterProps> = ({
  children,
  language = 'sql',
  customStyle = {},
  showLineNumbers = false,
  wrapLines = true,
  style: overrideStyle,
  showCopyButton = true,
}) => {
  const theme = useTheme();
  const [isLanguageReady, setIsLanguageReady] = useState(
    registeredLanguages.has(language),
  );
  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const loadLanguage = async () => {
      if (!registeredLanguages.has(language)) {
        await registerLanguage(language);
        setIsLanguageReady(true);
      }
    };

    loadLanguage();
  }, [language]);

  useEffect(
    () => () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    },
    [],
  );

  const handleCopy = useCallback(() => {
    navigator.clipboard?.writeText(children).then(() => {
      setCopied(true);
      copyTimeoutRef.current = setTimeout(() => setCopied(false), 1500);
    });
  }, [children]);

  const isDark = isThemeDark(theme);
  const themeStyle = overrideStyle || (isDark ? tomorrow : github);

  const defaultCustomStyle: React.CSSProperties = {
    background: theme.colorBgElevated,
    padding: theme.sizeUnit * 4,
    border: 0,
    borderRadius: theme.borderRadius,
    ...customStyle,
  };

  const copyButton = showCopyButton && (
    <button
      type="button"
      onClick={handleCopy}
      title={copied ? 'Copied!' : 'Copy to clipboard'}
      css={css`
        position: absolute;
        top: ${theme.sizeUnit}px;
        right: ${theme.sizeUnit}px;
        background: none;
        border: none;
        cursor: pointer;
        padding: ${theme.sizeUnit}px;
        color: ${copied ? theme.colorSuccess : theme.colorTextSecondary};
        line-height: 1;
        border-radius: ${theme.borderRadius}px;
        &:hover {
          color: ${copied ? theme.colorSuccess : theme.colorText};
          background: ${theme.colorBgTextHover};
        }
      `}
    >
      {copied ? (
        <Icons.CheckOutlined style={{ fontSize: theme.fontSizeSM }} />
      ) : (
        <Icons.CopyOutlined style={{ fontSize: theme.fontSizeSM }} />
      )}
    </button>
  );

  // Show a simple pre-formatted text while language is loading
  if (!isLanguageReady) {
    return (
      <div css={css`position: relative;`}>
        {copyButton}
        <pre
          style={{
            ...defaultCustomStyle,
            fontFamily: 'monospace',
            whiteSpace: 'pre-wrap',
            margin: 0,
          }}
        >
          {children}
        </pre>
      </div>
    );
  }

  return (
    <div css={css`position: relative;`}>
      {copyButton}
      <SyntaxHighlighterBase
        language={language}
        style={themeStyle}
        customStyle={defaultCustomStyle}
        showLineNumbers={showLineNumbers}
        wrapLines={wrapLines}
      >
        {children}
      </SyntaxHighlighterBase>
    </div>
  );
};

/**
 * Utility function to preload specific languages if needed
 * This can be called strategically in components that know they'll need certain languages
 */
export const preloadLanguages = async (
  languages: SupportedLanguage[],
): Promise<void> => {
  const promises = languages
    .filter(lang => !registeredLanguages.has(lang))
    .map(registerLanguage);

  await Promise.all(promises);
};

export default CodeSyntaxHighlighter;
