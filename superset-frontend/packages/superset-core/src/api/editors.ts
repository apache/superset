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
 * @fileoverview Editors API for Superset text editor integration.
 *
 * This module defines the interfaces and types for working with text editors
 * in Superset. It provides:
 *
 * - `EditorHandle`: Imperative API for programmatically controlling editors
 *   (get/set content, cursor position, selections, annotations, completions)
 * - `EditorProps`: Props contract for editor React components
 * - `CompletionProvider`: Interface for registering custom autocomplete providers
 * - Registration functions for custom editor implementations
 *
 * The API is editor-agnostic, supporting Ace, Monaco, CodeMirror, or any
 * compliant implementation.
 */

import { ForwardRefExoticComponent, RefAttributes } from 'react';
import { EditorContribution, EditorLanguage } from './contributions';
import { Disposable, Event } from './core';
import type { SupersetTheme } from '../ui';

// Re-export contribution types for convenience
export type { EditorContribution, EditorLanguage };

/**
 * Represents a position in the editor (line and column).
 * Both line and column are zero-based indices.
 *
 * @example
 * // Position at the start of line 5, column 10
 * const pos: Position = { line: 4, column: 9 };
 */
export interface Position {
  /** Zero-based line number (first line is 0) */
  line: number;
  /** Zero-based column number (first column is 0) */
  column: number;
}

/**
 * Represents a contiguous range in the editor defined by start and end positions.
 * The range is inclusive of the start position and exclusive of the end position.
 */
export interface Range {
  /** Start position of the range (inclusive) */
  start: Position;
  /** End position of the range (exclusive) */
  end: Position;
}

/**
 * Represents a selection in the editor, extending Range with direction information.
 * A selection is a highlighted range of text that can be manipulated.
 */
export interface Selection extends Range {
  /**
   * Direction of the selection.
   * - 'ltr': Selection was made left-to-right (anchor at start, cursor at end)
   * - 'rtl': Selection was made right-to-left (anchor at end, cursor at start)
   */
  direction?: 'ltr' | 'rtl';
}

/**
 * Severity levels for editor annotations.
 * Determines the visual style and icon used to display the annotation.
 */
export type AnnotationSeverity = 'error' | 'warning' | 'info';

/**
 * Represents a diagnostic annotation displayed in the editor.
 * Annotations are used to highlight issues like syntax errors, linting warnings,
 * or informational messages at specific locations in the code.
 *
 * @example
 * const annotation: EditorAnnotation = {
 *   line: 5,
 *   column: 10,
 *   message: 'Unknown column "user_id"',
 *   severity: 'error',
 *   source: 'sql-validator',
 * };
 */
export interface EditorAnnotation {
  /** Zero-based line number where the annotation appears */
  line: number;
  /** Zero-based column number for precise positioning (optional) */
  column?: number;
  /** Human-readable message describing the issue or information */
  message: string;
  /** Severity determines visual styling (red for error, yellow for warning, blue for info) */
  severity: AnnotationSeverity;
  /** Identifies what produced this annotation (e.g., "linter", "sql-validator") */
  source?: string;
}

/**
 * Defines a keyboard shortcut that triggers a custom action in the editor.
 * Hotkeys allow binding key combinations to functions that manipulate
 * the editor or perform other actions.
 *
 * @example
 * const runQueryHotkey: EditorHotkey = {
 *   name: 'runQuery',
 *   key: 'Ctrl+Enter',
 *   description: 'Execute the current query',
 *   exec: (handle) => {
 *     const sql = handle.getValue();
 *     executeQuery(sql);
 *   },
 * };
 */
export interface EditorHotkey {
  /** Unique identifier for this hotkey command */
  name: string;
  /**
   * Key combination string. Format varies by editor but typically uses:
   * - Modifiers: Ctrl, Alt, Shift, Meta (Cmd on Mac)
   * - Separator: + (e.g., "Ctrl+Enter", "Ctrl+Shift+F")
   */
  key: string;
  /** Human-readable description shown in keyboard shortcut help */
  description?: string;
  /** Callback invoked when the hotkey is pressed, receives the editor handle */
  exec: (handle: EditorHandle) => void;
}

/**
 * Categories for completion items, determining the icon displayed.
 * Includes standard programming concepts plus SQL-specific types
 * (table, column, schema, catalog, database).
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
 * Represents a single item in the autocompletion dropdown.
 * Completion items are suggestions shown to users as they type,
 * allowing quick insertion of code snippets, keywords, or identifiers.
 *
 * @example
 * const tableCompletion: CompletionItem = {
 *   label: 'users',
 *   insertText: 'users',
 *   kind: 'table',
 *   detail: 'public schema',
 *   documentation: 'User accounts table with profile information',
 * };
 */
export interface CompletionItem {
  /** Text displayed in the completion dropdown */
  label: string;
  /** Text inserted into the editor when this item is selected */
  insertText: string;
  /** Category of completion, determines the icon shown (e.g., table, column, function) */
  kind: CompletionItemKind;
  /** Extended description shown in a details pane or tooltip */
  documentation?: string;
  /** Short additional info displayed next to the label (e.g., type, schema) */
  detail?: string;
  /** String used for sorting; items are sorted lexicographically by this value */
  sortText?: string;
  /** String used for filtering; if omitted, label is used for matching user input */
  filterText?: string;
}

/**
 * Context information passed to completion providers when requesting suggestions.
 * Contains details about how completion was triggered and the current environment.
 */
export interface CompletionContext {
  /** The character that triggered automatic completion (e.g., '.', ' '), if applicable */
  triggerCharacter?: string;
  /**
   * How the completion was triggered:
   * - 'invoke': User explicitly requested completion (e.g., Ctrl+Space)
   * - 'automatic': Triggered automatically by typing a trigger character
   */
  triggerKind: 'invoke' | 'automatic';
  /** The language mode of the editor (e.g., 'sql', 'json') */
  language: EditorLanguage;
  /** Host-provided context (e.g., database ID, schema name for SQL completions) */
  metadata?: Record<string, unknown>;
}

/**
 * Interface for providing dynamic autocompletion suggestions.
 * Providers are invoked when the user triggers completion, allowing
 * context-aware suggestions based on cursor position and editor content.
 *
 * @example
 * const tableCompletionProvider: CompletionProvider = {
 *   id: 'sql-tables',
 *   triggerCharacters: [' ', '.'],
 *   provideCompletions: async (content, position, context) => {
 *     const dbId = context.metadata?.databaseId;
 *     const tables = await fetchTables(dbId);
 *     return tables.map(t => ({
 *       label: t.name,
 *       insertText: t.name,
 *       kind: 'table',
 *     }));
 *   },
 * };
 */
export interface CompletionProvider {
  /** Unique identifier for this provider, used for debugging and deduplication */
  id: string;
  /** Characters that trigger this provider automatically when typed (e.g., '.', ' ') */
  triggerCharacters?: string[];
  /**
   * Generate completion suggestions for the current cursor position.
   *
   * @param content Full text content of the editor
   * @param position Current cursor position where completion was triggered
   * @param context Additional context about the trigger and environment
   * @returns Array of completion items, or a Promise resolving to them for async providers
   */
  provideCompletions(
    content: string,
    position: Position,
    context: CompletionContext,
  ): CompletionItem[] | Promise<CompletionItem[]>;
}

/**
 * Represents a static keyword for basic autocomplete.
 * Keywords are simpler than CompletionItems and are used for static lists
 * of suggestions (e.g., SQL keywords, table names) that don't require
 * dynamic computation.
 *
 * Editor implementations convert these to their native completion format.
 *
 * @example
 * const sqlKeywords: EditorKeyword[] = [
 *   { name: 'SELECT', meta: 'keyword', score: 100 },
 *   { name: 'FROM', meta: 'keyword', score: 100 },
 *   { name: 'users', value: 'users', meta: 'table', score: 50 },
 * ];
 */
export interface EditorKeyword {
  /** Display name shown in the completion dropdown */
  name: string;
  /** Text to insert when selected; defaults to name if not provided */
  value?: string;
  /** Category label shown alongside the name (e.g., "column", "table", "function") */
  meta?: string;
  /** Sorting priority; higher scores appear first in the completion list */
  score?: number;
  /** Short supplementary text such as a type signature or the full value when truncated */
  detail?: string;
  /** Longer documentation content as an HTML string, shown in a documentation popup */
  documentation?: string;
}

/**
 * Props accepted by all editor component implementations.
 * This interface defines the contract between Superset and editor components,
 * ensuring consistent behavior regardless of the underlying editor library.
 */
export interface EditorProps {
  /** Unique identifier for this editor instance */
  id: string;
  /** Current editor content (controlled component pattern) */
  value: string;
  /** Called when the editor content changes */
  onChange: (value: string) => void;
  /** Called when the editor loses focus, with the current value */
  onBlur?: (value: string) => void;
  /** Called when the cursor position changes */
  onCursorPositionChange?: (pos: Position) => void;
  /** Called when the selection(s) change */
  onSelectionChange?: (sel: Selection[]) => void;
  /** Language mode for syntax highlighting and language features */
  language: EditorLanguage;
  /** When true, prevents editing (view-only mode) */
  readOnly?: boolean;
  /** Number of spaces per tab character */
  tabSize?: number;
  /** Whether to display line numbers in the gutter */
  lineNumbers?: boolean;
  /** Whether long lines should wrap to the next visual line */
  wordWrap?: boolean;
  /** Diagnostic annotations to display (errors, warnings, info) */
  annotations?: EditorAnnotation[];
  /** Custom keyboard shortcuts */
  hotkeys?: EditorHotkey[];
  /** Static keywords for basic autocomplete */
  keywords?: EditorKeyword[];
  /** CSS height value (e.g., "100%", "500px", "calc(100vh - 200px)") */
  height?: string;
  /** CSS width value (e.g., "100%", "800px") */
  width?: string;
  /** Called when the editor is fully initialized, providing the imperative handle */
  onReady?: (handle: EditorHandle) => void;
  /** Contextual data passed to completion providers (e.g., database ID, schema) */
  metadata?: Record<string, unknown>;
  /** Theme object for styling the editor to match Superset's appearance */
  theme?: SupersetTheme;
}

/**
 * Imperative API for controlling the editor programmatically.
 *
 * This handle provides a unified interface for interacting with text editors
 * regardless of the underlying implementation (Ace, Monaco, CodeMirror, etc.).
 * It can be used by any part of Superset that needs to manipulate editor content,
 * read selections, or register custom behaviors.
 */
export interface EditorHandle {
  /**
   * Moves keyboard focus to the editor.
   * Useful after programmatic operations to return user focus to the editing area.
   */
  focus(): void;

  /**
   * Returns the complete text content of the editor.
   * @returns The full editor content as a string
   */
  getValue(): string;

  /**
   * Replaces the entire editor content with the provided value.
   * This will clear any existing content and reset the undo history in most editors.
   * @param value The new content to set
   */
  setValue(value: string): void;

  /**
   * Returns the current cursor position in the editor.
   * @returns Position object with zero-based line and column numbers
   */
  getCursorPosition(): Position;

  /**
   * Moves the cursor to the specified position.
   * @param position Target position with zero-based line and column numbers
   */
  moveCursorToPosition(position: Position): void;

  /**
   * Returns all active selections in the editor.
   * Most editors support multiple selections (e.g., via Ctrl+click).
   * Each selection includes start/end positions and optional direction.
   * @returns Array of Selection objects, empty array if no selections
   */
  getSelections(): Selection[];

  /**
   * Sets the selection to the specified range.
   * This replaces any existing selections with a single new selection.
   * @param selection Range to select, with start and end positions
   */
  setSelection(selection: Range): void;

  /**
   * Returns the text within the current selection.
   * If multiple selections exist, behavior depends on the editor implementation
   * (typically returns the primary/first selection's text).
   * @returns The selected text, or empty string if no selection
   */
  getSelectedText(): string;

  /**
   * Inserts text at the current cursor position.
   * If text is selected, the selection is replaced with the inserted text.
   * @param text The text to insert
   */
  insertText(text: string): void;
  /**
   * Execute a named editor command.
   *
   * Note: Command names are editor-specific. For example:
   * - Ace: 'centerselection', 'gotoline', 'fold', 'unfold'
   * - Monaco: 'editor.action.formatDocument', 'editor.action.commentLine'
   *
   * Callers using this method should be aware of which editor is active
   * or handle cases where the command may not exist.
   *
   * @param commandName The editor-specific command name to execute
   */
  executeCommand(commandName: string): void;
  /**
   * Scrolls the editor viewport to bring the specified line into view.
   * The exact positioning (top, center, bottom) depends on the editor implementation.
   * @param line Zero-based line number to scroll to
   */
  scrollToLine(line: number): void;

  /**
   * Sets diagnostic annotations (errors, warnings, info markers) in the editor.
   * This replaces any previously set annotations.
   * Annotations appear as markers in the gutter and/or inline decorations.
   * @param annotations Array of annotations to display
   */
  setAnnotations(annotations: EditorAnnotation[]): void;

  /**
   * Removes all annotations from the editor.
   * Equivalent to calling setAnnotations([]).
   */
  clearAnnotations(): void;

  /**
   * Registers a provider for dynamic autocompletion suggestions.
   * The provider will be invoked when completion is triggered (manually or automatically).
   * Multiple providers can be registered; their results are merged.
   * @param provider The completion provider to register
   * @returns A Disposable that removes the provider when disposed
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
