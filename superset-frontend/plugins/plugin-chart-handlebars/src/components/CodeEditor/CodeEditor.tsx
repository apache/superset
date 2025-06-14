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

// must go after AceEditor import
import 'ace-builds/src-min-noconflict/mode-handlebars';
import 'ace-builds/src-min-noconflict/mode-css';
import 'ace-builds/src-noconflict/theme-github';
import 'ace-builds/src-noconflict/theme-monokai';

export type CodeEditorMode = 'handlebars' | 'css';
export type CodeEditorTheme = 'light' | 'dark';

export interface CodeEditorProps extends IAceEditorProps {
  mode?: CodeEditorMode;
  theme?: CodeEditorTheme;
  name?: string;
}

export const CodeEditor: FC<CodeEditorProps> = ({
  mode,
  theme,
  name,
  width,
  height,
  value,
  ...rest
}: CodeEditorProps) => {
  const m_name = name || Math.random().toString(36).substring(7);
  const m_theme = theme === 'light' ? 'github' : 'monokai';
  const m_mode = mode || 'handlebars';
  const m_height = height || '300px';
  const m_width = width || '100%';

  return (
    <div className="code-editor" style={{ minHeight: height, width: m_width }}>
      <AceEditor
        mode={m_mode}
        theme={m_theme}
        name={m_name}
        height={m_height}
        width={m_width}
        fontSize={14}
        showPrintMargin
        focus
        editorProps={{ $blockScrolling: true }}
        wrapEnabled
        highlightActiveLine
        value={value}
        setOptions={{
          enableBasicAutocompletion: true,
          enableLiveAutocompletion: true,
          enableSnippets: true,
          showLineNumbers: true,
          tabSize: 2,
          showGutter: true,
        }}
        {...rest}
      />
    </div>
  );
};
