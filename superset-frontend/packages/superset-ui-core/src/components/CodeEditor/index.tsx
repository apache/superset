/* eslint-disable import/first */
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

import { FC } from 'react';
import AceEditor, { IAceEditorProps } from 'react-ace';
import ace from 'ace-builds/src-noconflict/ace';

// Disable workers to avoid localhost loading issues
ace.config.set('useWorker', false);

// Import required modes and themes after ace is loaded
import 'ace-builds/src-min-noconflict/mode-handlebars';
import 'ace-builds/src-min-noconflict/mode-css';
import 'ace-builds/src-min-noconflict/mode-json';
import 'ace-builds/src-min-noconflict/mode-sql';
import 'ace-builds/src-min-noconflict/mode-markdown';
import 'ace-builds/src-min-noconflict/mode-javascript';
import 'ace-builds/src-min-noconflict/mode-html';
import 'ace-builds/src-noconflict/theme-github';
import 'ace-builds/src-noconflict/theme-monokai';

export type CodeEditorMode =
  | 'handlebars'
  | 'css'
  | 'json'
  | 'sql'
  | 'markdown'
  | 'javascript'
  | 'html';

export type CodeEditorTheme = 'light' | 'dark';

export interface CodeEditorProps
  extends Omit<IAceEditorProps, 'mode' | 'theme'> {
  mode?: CodeEditorMode;
  theme?: CodeEditorTheme;
  name?: string;
}

export const CodeEditor: FC<CodeEditorProps> = ({
  mode = 'handlebars',
  theme = 'dark',
  name,
  width = '100%',
  height = '300px',
  value,
  fontSize = 14,
  showPrintMargin = true,
  focus = true,
  wrapEnabled = true,
  highlightActiveLine = true,
  editorProps = { $blockScrolling: true },
  setOptions,
  ...rest
}: CodeEditorProps) => {
  const editorName = name || Math.random().toString(36).substring(7);
  const aceTheme = theme === 'light' ? 'github' : 'monokai';

  return (
    <AceEditor
      mode={mode}
      theme={aceTheme}
      name={editorName}
      height={height}
      width={width}
      value={value}
      fontSize={fontSize}
      showPrintMargin={showPrintMargin}
      focus={focus}
      editorProps={editorProps}
      wrapEnabled={wrapEnabled}
      highlightActiveLine={highlightActiveLine}
      setOptions={{
        enableBasicAutocompletion: true,
        enableLiveAutocompletion: true,
        enableSnippets: true,
        showLineNumbers: true,
        tabSize: 2,
        showGutter: true,
        fontFamily:
          'Menlo, Consolas, Courier New, Ubuntu Mono, source-code-pro, Lucida Console, monospace',
        ...setOptions,
      }}
      {...rest}
    />
  );
};

export default CodeEditor;
