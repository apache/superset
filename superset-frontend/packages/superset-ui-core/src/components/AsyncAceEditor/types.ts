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
import type { Editor as OrigEditor, TextMode as OrigTextMode } from 'brace';
import type { ComponentType } from 'react';
import type { IAceEditorProps } from 'react-ace';
import type { PlaceholderProps } from '../AsyncEsmComponent/types';
import { aceModuleLoaders } from '.';

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
