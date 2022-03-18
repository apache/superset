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
import React, { forwardRef } from 'react';
import {
  Editor as OrigEditor,
  IEditSession,
  Position,
  TextMode as OrigTextMode,
} from 'brace';
import AceEditor, { IAceEditorProps } from 'react-ace';
import AsyncEsmComponent, {
  PlaceholderProps,
} from 'src/components/AsyncEsmComponent';

export interface AceCompleterKeywordData {
  name: string;
  value: string;
  score: number;
  meta: string;
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
 * promises because webpack can only analyze asycn imports statically.
 */
const aceModuleLoaders = {
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
  placeholder?: React.ComponentType<
    PlaceholderProps & Partial<IAceEditorProps>
  > | null;
};

/**
 * Get an async AceEditor with automatical loading of specified ace modules.
 */
export default function AsyncAceEditor(
  aceModules: AceModule[],
  {
    defaultMode,
    defaultTheme,
    defaultTabSize = 2,
    placeholder,
  }: AsyncAceEditorOptions = {},
) {
  return AsyncEsmComponent(async () => {
    const { default: ace } = await import('brace');
    const { default: ReactAceEditor } = await import('react-ace');

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
        if (keywords) {
          const langTools = ace.acequire('ace/ext/language_tools');
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
              if ((session.getMode() as TextMode).$id === `ace/mode/${mode}`) {
                callback(null, keywords);
              }
            },
          };
          langTools.setCompleters([completer]);
        }
        return (
          <ReactAceEditor
            ref={ref}
            mode={mode}
            theme={theme}
            tabSize={tabSize}
            defaultValue={defaultValue}
            {...props}
          />
        );
      },
    );
  }, placeholder);
}

export const SQLEditor = AsyncAceEditor([
  'mode/sql',
  'theme/github',
  'ext/language_tools',
]);

export const FullSQLEditor = AsyncAceEditor(
  ['mode/sql', 'theme/github', 'ext/language_tools'],
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

export const MarkdownEditor = AsyncAceEditor([
  'mode/markdown',
  'theme/textmate',
]);

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
