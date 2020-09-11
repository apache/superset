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
import React from 'react';
import {
  Editor,
  IEditSession,
  Position,
  TextMode as OrigTextMode,
} from 'brace';
import AceEditor, { AceEditorProps } from 'react-ace';
import AsyncEsmComponent from 'src/components/AsyncEsmComponent';

type TextMode = OrigTextMode & { $id: string };

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

export interface AceCompleterKeywordData {
  name: string;
  value: string;
  score: number;
  meta: string;
}
export interface AceCompleterKeyword extends AceCompleterKeywordData {
  completer?: {
    insertMatch: (editor: Editor, data: AceCompleterKeywordData) => void;
  };
}

export type AsyncAceEditorProps = AceEditorProps & {
  keywords?: AceCompleterKeyword[];
};

export type AceEditorMode = 'sql';
export type AceEditorTheme = 'textmate' | 'github';
export type AsyncAceEditorOptions = {
  defaultMode?: AceEditorMode;
  defaultTheme?: AceEditorTheme;
  defaultTabSize?: number;
};

/**
 * Get an async AceEditor with automatical loading of specified ace modules.
 */
export default function AsyncAceEditor(
  aceModules: AceModule[],
  { defaultMode, defaultTheme, defaultTabSize = 2 }: AsyncAceEditorOptions = {},
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

    return React.forwardRef<AceEditor, AsyncAceEditorProps>(
      function ExtendedAceEditor(
        {
          keywords,
          mode = inferredMode,
          theme = inferredTheme,
          tabSize = defaultTabSize,
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
            {...props}
          />
        );
      },
    );
  });
}

export const SQLEditor = AsyncAceEditor([
  'mode/sql',
  'theme/github',
  'ext/language_tools',
]);

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
