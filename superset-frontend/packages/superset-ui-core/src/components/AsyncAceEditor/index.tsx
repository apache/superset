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
import { forwardRef, useEffect, useCallback, ComponentType } from 'react';

import type {
  Editor as OrigEditor,
  IEditSession,
  Position,
  TextMode as OrigTextMode,
} from 'brace';
import type AceEditor from 'react-ace';
import type { IAceEditorProps } from 'react-ace';
import type { Ace } from 'ace-builds';

import {
  AsyncEsmComponent,
  PlaceholderProps,
} from '@superset-ui/core/components/AsyncEsmComponent';
import { useTheme, css } from '@superset-ui/core';
import { Global } from '@emotion/react';

export { getTooltipHTML } from './Tooltip';
export { useJsonValidation } from './useJsonValidation';
export type {
  JsonValidationAnnotation,
  UseJsonValidationOptions,
} from './useJsonValidation';

export interface AceCompleterKeywordData {
  name: string;
  value: string;
  score: number;
  meta: string;
  docText?: string;
  docHTML?: string;
}

export type TextMode = OrigTextMode & { $id: string };

export interface AceCompleter {
  insertMatch: (
    data?: Editor | { value: string } | string,
    options?: AceCompleterKeywordData,
  ) => void;
}

export type Editor = OrigEditor & {
  completer: AceCompleter;
  completers: AceCompleter[];
};

export interface AceCompleterKeyword extends AceCompleterKeywordData {
  completer?: AceCompleter;
}

/**
 * Async loaders to import brace modules. Must manually create call `import(...)`
 * promises because webpack can only analyze async imports statically.
 */
export const aceModuleLoaders = {
  'mode/sql': () => import('brace/mode/sql'),
  'mode/markdown': () => import('brace/mode/markdown'),
  'mode/css': () => import('brace/mode/css'),
  'mode/json': () => import('brace/mode/json'),
  'mode/yaml': () => import('brace/mode/yaml'),
  'mode/html': () => import('brace/mode/html'),
  'mode/javascript': () => import('brace/mode/javascript'),
  'theme/textmate': () => import('brace/theme/textmate'),
  'theme/github': () => import('brace/theme/github'),
  'ext/language_tools': () => import('brace/ext/language_tools'),
  'ext/searchbox': () => import('brace/ext/searchbox'),
};

export type AceModule = keyof typeof aceModuleLoaders;

export type AsyncAceEditorProps = IAceEditorProps & {
  keywords?: AceCompleterKeyword[];
};

export type AceEditorMode = 'sql';
export type AceEditorTheme = 'textmate' | 'github';
export type AsyncAceEditorOptions = {
  defaultMode?: AceEditorMode;
  defaultTheme?: AceEditorTheme;
  defaultTabSize?: number;
  fontFamily?: string;
  placeholder?: ComponentType<
    PlaceholderProps & Partial<IAceEditorProps>
  > | null;
};

/**
 * Get an async AceEditor with automatical loading of specified ace modules.
 */
export function AsyncAceEditor(
  aceModules: AceModule[],
  {
    defaultMode,
    defaultTheme,
    defaultTabSize = 2,
    fontFamily = 'Menlo, Consolas, Courier New, Ubuntu Mono, source-code-pro, Lucida Console, monospace',
    placeholder,
  }: AsyncAceEditorOptions = {},
) {
  return AsyncEsmComponent(async () => {
    const reactAcePromise = import('react-ace');
    const aceBuildsConfigPromise = import('ace-builds');
    const cssWorkerUrlPromise = import(
      'ace-builds/src-min-noconflict/worker-css'
    );
    const acequirePromise = import('ace-builds/src-min-noconflict/ace');

    const [
      { default: ReactAceEditor },
      { config },
      { default: cssWorkerUrl },
      { require: acequire },
    ] = await Promise.all([
      reactAcePromise,
      aceBuildsConfigPromise,
      cssWorkerUrlPromise,
      acequirePromise,
    ]);

    config.setModuleUrl('ace/mode/css_worker', cssWorkerUrl);

    await Promise.all(aceModules.map(x => aceModuleLoaders[x]()));

    const inferredMode =
      defaultMode ||
      aceModules.find(x => x.startsWith('mode/'))?.replace('mode/', '');
    const inferredTheme =
      defaultTheme ||
      aceModules.find(x => x.startsWith('theme/'))?.replace('theme/', '');

    return forwardRef<AceEditor, AsyncAceEditorProps>(
      function ExtendedAceEditor(
        {
          keywords,
          mode = inferredMode,
          theme = inferredTheme,
          tabSize = defaultTabSize,
          defaultValue = '',
          ...props
        },
        ref,
      ) {
        const token = useTheme();
        const langTools = acequire('ace/ext/language_tools');

        const setCompleters = useCallback(
          (keywords: AceCompleterKeyword[]) => {
            const completer = {
              getCompletions: (
                editor: AceEditor,
                session: IEditSession,
                pos: Position,
                prefix: string,
                callback: (error: null, wordList: object[]) => void,
              ) => {
                // If the prefix starts with a number, don't try to autocomplete
                if (!Number.isNaN(parseInt(prefix, 10))) {
                  return;
                }
                if (
                  (session.getMode() as TextMode).$id === `ace/mode/${mode}`
                ) {
                  callback(null, keywords);
                }
              },
            };
            langTools.setCompleters([completer]);
          },
          [langTools, mode],
        );

        useEffect(() => {
          if (keywords) {
            setCompleters(keywords);
          }
        }, [keywords, setCompleters]);

        // Move autocomplete popup to the nearest parent container with data-ace-container
        useEffect(() => {
          const editorInstance = (ref as React.RefObject<AceEditor>)?.current
            ?.editor;
          if (!editorInstance) return undefined;

          const editorContainer = editorInstance.container;
          if (!editorContainer) return undefined;

          // Cache DOM elements to avoid repeated queries on every command execution
          let cachedAutocompletePopup: HTMLElement | null = null;
          let cachedTargetContainer: Element | null = null;

          const moveAutocompleteToContainer = () => {
            // Revalidate cached popup if missing or detached from DOM
            if (
              !cachedAutocompletePopup ||
              !document.body.contains(cachedAutocompletePopup)
            ) {
              cachedAutocompletePopup =
                editorContainer.querySelector<HTMLElement>(
                  '.ace_autocomplete',
                ) ?? document.querySelector<HTMLElement>('.ace_autocomplete');
            }

            // Revalidate cached container if missing or detached
            if (
              !cachedTargetContainer ||
              !document.body.contains(cachedTargetContainer)
            ) {
              cachedTargetContainer =
                editorContainer.closest('#ace-editor') ??
                editorContainer.parentElement;
            }

            if (
              cachedAutocompletePopup &&
              cachedTargetContainer &&
              cachedTargetContainer !== document.body
            ) {
              cachedTargetContainer.appendChild(cachedAutocompletePopup);
              cachedAutocompletePopup.dataset.aceAutocomplete = 'true';
            }
          };

          const handleAfterExec = (e: Ace.Operation) => {
            const name: string | undefined = e?.command?.name;
            if (name === 'insertstring' || name === 'startAutocomplete') {
              moveAutocompleteToContainer();
            }
          };

          const { commands } = editorInstance;
          commands.on('afterExec', handleAfterExec);

          // Cleanup function to remove event listener and clear cached references
          return () => {
            commands.off('afterExec', handleAfterExec);
            // Clear cached references to avoid memory leaks
            cachedAutocompletePopup = null;
            cachedTargetContainer = null;
          };
        }, [ref]);

        return (
          <>
            <Global
              key="ace-tooltip-global"
              styles={css`
                .ace_editor {
                  border: 1px solid ${token.colorBorder} !important;
                  background-color: ${token.colorBgContainer} !important;
                }

                /* Basic editor styles with dark mode support */
                .ace_editor.ace-github,
                .ace_editor.ace-tm {
                  background-color: ${token.colorBgContainer} !important;
                  color: ${token.colorText} !important;
                }

                /* Adjust gutter colors */
                .ace_editor .ace_gutter {
                  background-color: ${token.colorBgElevated} !important;
                  color: ${token.colorTextSecondary} !important;
                }
                .ace_editor.ace_editor .ace_gutter .ace_gutter-active-line {
                  background-color: ${token.colorBorderSecondary};
                }
                /* Adjust selection color */
                .ace_editor .ace_selection {
                  background-color: ${token.colorPrimaryBgHover} !important;
                }

                /* Improve active line highlighting */
                .ace_editor .ace_active-line {
                  background-color: ${token.colorPrimaryBg} !important;
                }

                /* Fix indent guides and print margin (80 chars line) */
                .ace_editor .ace_indent-guide,
                .ace_editor .ace_print-margin {
                  background-color: ${token.colorSplit} !important;
                  opacity: 0.5;
                }

                /* Adjust cursor color */
                .ace_editor .ace_cursor {
                  color: ${token.colorPrimaryText} !important;
                }

                /* Syntax highlighting using semantic color tokens */
                .ace_editor .ace_keyword {
                  color: ${token.colorPrimaryText} !important;
                }

                .ace_editor .ace_string {
                  color: ${token.colorSuccessText} !important;
                }

                .ace_editor .ace_constant {
                  color: ${token.colorWarningActive} !important;
                }

                .ace_editor .ace_function {
                  color: ${token.colorInfoText} !important;
                }

                .ace_editor .ace_comment {
                  color: ${token.colorTextTertiary} !important;
                }

                .ace_editor .ace_variable {
                  color: ${token.colorTextSecondary} !important;
                }

                /* Adjust tooltip styles */
                .ace_tooltip {
                  margin-left: ${token.margin}px;
                  padding: ${token.sizeUnit * 2}px;
                  background-color: ${token.colorBgElevated} !important;
                  color: ${token.colorText} !important;
                  border: 1px solid ${token.colorBorderSecondary};
                  box-shadow: ${token.boxShadow};
                  border-radius: ${token.borderRadius}px;
                  padding: ${token.paddingXS}px ${token.paddingXS}px;
                }

                .ace_tooltip.ace_doc-tooltip {
                  display: flex !important;
                }

                &&& .tooltip-detail {
                  display: flex;
                  justify-content: center;
                  flex-direction: row;
                  gap: ${token.paddingXXS}px;
                  align-items: center;
                  background-color: ${token.colorBgContainer};
                  white-space: pre-wrap;
                  word-break: break-all;
                  max-width: ${token.sizeXXL * 10}px;
                  font-size: ${token.fontSize}px;

                  & .tooltip-detail-head {
                    background-color: ${token.colorBgElevated};
                    color: ${token.colorText};
                    display: flex;
                    column-gap: ${token.padding}px;
                    align-items: baseline;
                    justify-content: space-between;
                  }

                  & .tooltip-detail-title {
                    display: flex;
                    column-gap: ${token.padding}px;
                  }

                  & .tooltip-detail-body {
                    word-break: break-word;
                    color: ${token.colorTextSecondary};
                  }

                  & .tooltip-detail-head,
                  & .tooltip-detail-body {
                    background-color: ${token.colorBgLayout};
                    padding: 0px ${token.paddingXXS}px;
                    border: 1px ${token.colorSplit} solid;
                  }

                  & .tooltip-detail-footer {
                    border-top: 1px ${token.colorSplit} solid;
                    padding: 0 ${token.paddingLG}px;
                    color: ${token.colorTextTertiary};
                    font-size: ${token.fontSizeSM}px;
                  }

                  & .tooltip-detail-meta {
                    & > .ant-tag {
                      margin-right: 0px;
                    }
                  }
                }

                /* Adjust the searchbox to match theme */
                .ace_search {
                  background-color: ${token.colorBgContainer} !important;
                  color: ${token.colorText} !important;
                  border: 1px solid ${token.colorBorder} !important;
                }

                .ace_search_field {
                  background-color: ${token.colorBgContainer} !important;
                  color: ${token.colorText} !important;
                  border: 1px solid ${token.colorBorder} !important;
                }

                .ace_button {
                  background-color: ${token.colorBgElevated} !important;
                  color: ${token.colorText} !important;
                  border: 1px solid ${token.colorBorder} !important;
                }

                .ace_button:hover {
                  background-color: ${token.colorPrimaryBg} !important;
                }
              `}
            />
            <ReactAceEditor
              ref={ref}
              mode={mode}
              theme={theme}
              tabSize={tabSize}
              defaultValue={defaultValue}
              setOptions={{ fontFamily }}
              {...props}
            />
          </>
        );
      },
    );
  }, placeholder);
}

export const SQLEditor = AsyncAceEditor([
  'mode/sql',
  'theme/github',
  'ext/language_tools',
  'ext/searchbox',
]);

export const FullSQLEditor = AsyncAceEditor(
  ['mode/sql', 'theme/github', 'ext/language_tools', 'ext/searchbox'],
  {
    // a custom placeholder in SQL lab for less jumpy re-renders
    placeholder: () => {
      const gutterBackground = '#e8e8e8'; // from ace-github theme
      return (
        <div
          style={{
            height: '100%',
          }}
        >
          <div
            style={{ width: 41, height: '100%', background: gutterBackground }}
          />
          {/* make it possible to resize the placeholder */}
          <div className="ace_content" />
        </div>
      );
    },
  },
);

export const MarkdownEditor = AsyncAceEditor(['mode/markdown', 'theme/github']);

export const TextAreaEditor = AsyncAceEditor([
  'mode/markdown',
  'mode/sql',
  'mode/json',
  'mode/html',
  'mode/javascript',
  'theme/textmate',
]);

export const CssEditor = AsyncAceEditor(['mode/css', 'theme/github']);

export const JsonEditor = AsyncAceEditor(['mode/json', 'theme/github']);

/**
 * JSON or Yaml config editor.
 */
export const ConfigEditor = AsyncAceEditor([
  'mode/json',
  'mode/yaml',
  'theme/github',
]);
