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
 * @fileoverview Editors API for Superset extension editor contributions.
 *
 * This module defines the interfaces and types for editor contributions to the
 * Superset platform. Extensions can register custom text editor implementations
 * (e.g., Monaco, CodeMirror) through the extension manifest, replacing the
 * default Ace editor for specific languages.
 */

import { ForwardRefExoticComponent, RefAttributes } from 'react';
import { EditorContribution, EditorLanguage } from './contributions';
import { Disposable, Event } from './core';
import type { SupersetTheme } from '../ui';

// Re-export contribution types for convenience
export type { EditorContribution, EditorLanguage };

/**
 * Represents a position in the editor (line and column).
 */
export interface Position {
  /** Zero-based line number */
  line: number;
  /** Zero-based column number */
  column: number;
}

/**
 * Represents a range in the editor with start and end positions.
 */
export interface Range {
  /** Start position of the range */
  start: Position;
  /** End position of the range */
  end: Position;
}

/**
 * Represents a selection in the editor.
 */
export interface Selection extends Range {
  /** Direction of the selection */
  direction?: 'ltr' | 'rtl';
}

/**
 * Annotation severity levels for editor markers.
 */
export type AnnotationSeverity = 'error' | 'warning' | 'info';

/**
 * Represents an annotation (marker/diagnostic) in the editor.
 */
export interface EditorAnnotation {
  /** Zero-based line number */
  line: number;
  /** Zero-based column number (optional) */
  column?: number;
  /** Annotation message to display */
  message: string;
  /** Severity level of the annotation */
  severity: AnnotationSeverity;
  /** Optional source of the annotation (e.g., "linter", "typescript") */
  source?: string;
}

/**
 * Represents a keyboard shortcut binding.
 */
export interface EditorHotkey {
  /** Unique name for the hotkey command */
  name: string;
  /** Key binding string (e.g., "Ctrl+Enter", "Alt+Enter") */
  key: string;
  /** Description of what the hotkey does */
  description?: string;
  /** Function to execute when the hotkey is triggered */
  exec: (handle: EditorHandle) => void;
}

/**
 * Completion item kinds for autocompletion.
 */
export type CompletionItemKind =
  | 'text'
  | 'method'
  | 'function'
  | 'constructor'
  | 'field'
  | 'variable'
  | 'class'
  | 'interface'
  | 'module'
  | 'property'
  | 'unit'
  | 'value'
  | 'enum'
  | 'keyword'
  | 'snippet'
  | 'color'
  | 'file'
  | 'reference'
  | 'folder'
  | 'constant'
  | 'struct'
  | 'event'
  | 'operator'
  | 'typeParameter'
  | 'table'
  | 'column'
  | 'schema'
  | 'catalog'
  | 'database';

/**
 * Represents a completion item for autocompletion.
 */
export interface CompletionItem {
  /** Display label for the completion item */
  label: string;
  /** Text to insert when the item is selected */
  insertText: string;
  /** Kind of completion item for icon display */
  kind: CompletionItemKind;
  /** Optional documentation to show in the completion popup */
  documentation?: string;
  /** Optional detail text to show alongside the label */
  detail?: string;
  /** Sorting priority (higher numbers appear first) */
  sortText?: string;
  /** Text used for filtering completions */
  filterText?: string;
}

/**
 * Context provided to completion providers.
 */
export interface CompletionContext {
  /** Character that triggered the completion (if any) */
  triggerCharacter?: string;
  /** How the completion was triggered */
  triggerKind: 'invoke' | 'automatic';
  /** Language of the editor */
  language: EditorLanguage;
  /** Generic metadata passed from the host (e.g., SQL Lab can pass database context) */
  metadata?: Record<string, unknown>;
}

/**
 * Provider interface for dynamic completions.
 */
export interface CompletionProvider {
  /** Unique identifier for this provider */
  id: string;
  /** Trigger characters that invoke this provider (e.g., '.', ' ') */
  triggerCharacters?: string[];
  /**
   * Provide completions at the given position.
   * @param content The editor content
   * @param position The cursor position
   * @param context Completion context with trigger info and metadata
   * @returns Array of completion items or a promise that resolves to them
   */
  provideCompletions(
    content: string,
    position: Position,
    context: CompletionContext,
  ): CompletionItem[] | Promise<CompletionItem[]>;
}

/**
 * A keyword for editor autocomplete.
 * This is a generic format that editor implementations convert to their native format.
 */
export interface EditorKeyword {
  /** Display name of the keyword */
  name: string;
  /** Value to insert when selected (defaults to name if not provided) */
  value?: string;
  /** Category/type of the keyword (e.g., "column", "table", "function") */
  meta?: string;
  /** Optional score for sorting (higher = more relevant) */
  score?: number;
}

/**
 * Props that all editor implementations must accept.
 */
export interface EditorProps {
  /** Instance identifier */
  id: string;
  /** Controlled value */
  value: string;
  /** Content change handler */
  onChange: (value: string) => void;
  /** Blur handler */
  onBlur?: (value: string) => void;
  /** Cursor position change handler */
  onCursorPositionChange?: (pos: Position) => void;
  /** Selection change handler */
  onSelectionChange?: (sel: Selection[]) => void;
  /** Language mode for syntax highlighting */
  language: EditorLanguage;
  /** Whether the editor is read-only */
  readOnly?: boolean;
  /** Tab size in spaces */
  tabSize?: number;
  /** Whether to show line numbers */
  lineNumbers?: boolean;
  /** Whether to enable word wrap */
  wordWrap?: boolean;
  /** Linting/error annotations */
  annotations?: EditorAnnotation[];
  /** Keyboard shortcuts */
  hotkeys?: EditorHotkey[];
  /** Static keywords for autocomplete */
  keywords?: EditorKeyword[];
  /** CSS height (e.g., "100%", "500px") */
  height?: string;
  /** CSS width (e.g., "100%", "800px") */
  width?: string;
  /** Callback when editor is ready with imperative handle */
  onReady?: (handle: EditorHandle) => void;
  /** Host-specific context (e.g., database info from SQL Lab) */
  metadata?: Record<string, unknown>;
  /** Theme object for styling the editor */
  theme?: SupersetTheme;
}

/**
 * Imperative API for controlling the editor programmatically.
 */
export interface EditorHandle {
  /** Focus the editor */
  focus(): void;
  /** Get the current editor content */
  getValue(): string;
  /** Set the editor content */
  setValue(value: string): void;
  /** Get the current cursor position */
  getCursorPosition(): Position;
  /** Move the cursor to a specific position */
  moveCursorToPosition(position: Position): void;
  /** Get all selections in the editor */
  getSelections(): Selection[];
  /** Set the selection range */
  setSelection(selection: Range): void;
  /** Get the selected text */
  getSelectedText(): string;
  /** Insert text at the current cursor position */
  insertText(text: string): void;
  /** Execute a named editor command */
  executeCommand(commandName: string): void;
  /** Scroll to a specific line */
  scrollToLine(line: number): void;
  /** Set annotations (replaces existing) */
  setAnnotations(annotations: EditorAnnotation[]): void;
  /** Clear all annotations */
  clearAnnotations(): void;
  /**
   * Register a completion provider for dynamic suggestions.
   * @param provider The completion provider to register
   * @returns A Disposable to unregister the provider
   */
  registerCompletionProvider(provider: CompletionProvider): Disposable;
}

/**
 * React component type for editor implementations.
 * Must be a forwardRef component to expose the EditorHandle.
 */
export type EditorComponent = ForwardRefExoticComponent<
  EditorProps & RefAttributes<EditorHandle>
>;

/**
 * A registered editor provider with its contribution metadata and component.
 */
export interface EditorProvider {
  /** The editor contribution metadata */
  contribution: EditorContribution;
  /** The React component implementing the editor */
  component: EditorComponent;
}

/**
 * Event fired when an editor provider is registered.
 */
export interface EditorProviderRegisteredEvent {
  /** The registered provider */
  provider: EditorProvider;
}

/**
 * Event fired when an editor provider is unregistered.
 */
export interface EditorProviderUnregisteredEvent {
  /** The contribution that was unregistered */
  contribution: EditorContribution;
}

/**
 * Register an editor provider for specific languages.
 * When an extension registers an editor, it replaces the default for those languages.
 *
 * @param contribution The editor contribution metadata from extension.json
 * @param component The React component implementing EditorProps
 * @returns A Disposable to unregister the provider
 *
 * @example
 * ```typescript
 * const disposable = registerEditorProvider(
 *   {
 *     id: 'acme.monaco-sql',
 *     name: 'Monaco SQL Editor',
 *     languages: ['sql'],
 *   },
 *   MonacoSQLEditor
 * );
 * context.disposables.push(disposable);
 * ```
 */
export declare function registerEditorProvider(
  contribution: EditorContribution,
  component: EditorComponent,
): Disposable;

/**
 * Get the editor provider for a specific language.
 * Returns the extension's editor if registered, otherwise undefined.
 *
 * @param language The language to get an editor for
 * @returns The editor provider or undefined if no extension provides one
 */
export declare function getEditorProvider(
  language: EditorLanguage,
): EditorProvider | undefined;

/**
 * Check if an extension has registered an editor for a language.
 *
 * @param language The language to check
 * @returns True if an extension provides an editor for this language
 */
export declare function hasEditorProvider(language: EditorLanguage): boolean;

/**
 * Get all registered editor providers.
 *
 * @returns Array of all registered editor providers
 */
export declare function getAllEditorProviders(): EditorProvider[];

/**
 * Event fired when an editor provider is registered.
 */
export declare const onDidRegisterEditorProvider: Event<EditorProviderRegisteredEvent>;

/**
 * Event fired when an editor provider is unregistered.
 */
export declare const onDidUnregisterEditorProvider: Event<EditorProviderUnregisteredEvent>;
