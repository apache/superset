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
  SQLEditor,
  FullSQLEditor,
  MarkdownEditor,
  TextAreaEditor,
  CssEditor,
  JsonEditor,
  ConfigEditor,
  AsyncAceEditorOptions,
} from '.';

type EditorType =
  | 'sql'
  | 'full-sql'
  | 'markdown'
  | 'text-area'
  | 'css'
  | 'json'
  | 'config';

const editorTypes: EditorType[] = [
  'sql',
  'full-sql',
  'markdown',
  'text-area',
  'css',
  'json',
  'config',
];

export default {
  title: 'AsyncAceEditor',
};

const parseEditorType = (editorType: EditorType) => {
  switch (editorType) {
    case 'sql':
      return SQLEditor;
    case 'full-sql':
      return FullSQLEditor;
    case 'markdown':
      return MarkdownEditor;
    case 'text-area':
      return TextAreaEditor;
    case 'css':
      return CssEditor;
    case 'json':
      return JsonEditor;
    default:
      return ConfigEditor;
  }
};

export const AsyncAceEditor = (
  args: AsyncAceEditorOptions & { editorType: EditorType },
) => {
  const { editorType, ...props } = args;
  const Editor = parseEditorType(editorType);
  return <Editor {...props} />;
};

AsyncAceEditor.args = {
  defaultTabSize: 2,
  width: '100%',
  height: '500px',
  value: `{"text": "Simple text"}`,
};

AsyncAceEditor.argTypes = {
  editorType: {
    defaultValue: 'json',
    control: { type: 'select' },
    options: editorTypes,
  },
  defaultTheme: {
    defaultValue: 'github',
    control: { type: 'radio' },
    options: ['textmate', 'github'],
  },
};

AsyncAceEditor.parameters = {
  actions: {
    disable: true,
  },
};
