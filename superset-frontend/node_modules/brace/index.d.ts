// Type definitions for Ace Ajax.org Cloud9 Editor
// Project: http://ace.ajax.org/
// Definitions by: Diullei Gomes <https://github.com/Diullei>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped

declare namespace AceAjax {

    export interface Delta {
        action: string;
        range: Range;
        text: string;
        lines: string[];
    }

    export interface EditorCommand {

        name:string;

        bindKey:any;

        exec: Function;

        readOnly?: boolean;
    }

    export interface CommandManager {

        byName: any;

        commands: any;

        platform: string;

        addCommands(commands:EditorCommand[]): void;

        addCommand(command:EditorCommand): void;

        exec(name: string, editor: Editor, args: any): void;
    }

    export interface Annotation {

         row: number;

         column: number;

         text: string;

         type: string;
    }

    export interface TokenInfo {

        value: string;
    }

    export interface Position {

        row: number;

        column: number;
    }

    export interface KeyBinding {

        setDefaultHandler(kb: any): void;

        setKeyboardHandler(kb: any): void;

        addKeyboardHandler(kb: any, pos: any): void;

        removeKeyboardHandler(kb: any): boolean;

        getKeyboardHandler(): any;

        onCommandKey(e: any, hashId: any, keyCode: any): void;

        onTextInput(text: any): void;
    }

    export interface TextMode {

        getTokenizer(): any;

        toggleCommentLines(state: any, doc: any, startRow: any, endRow: any): void;

        getNextLineIndent (state: any, line: any, tab: any): string;

        checkOutdent(state: any, line: any, input: any): boolean;

        autoOutdent(state: any, doc: any, row: any): void;

        createWorker(session: any): any;

        createModeDelegates (mapping: any): void;

        transformAction(state: any, action: any, editor: any, session: any, param: any): any;
    }

    ////////////////
    /// Ace
    ////////////////

    /**
     * The main class acequired to set up an Ace instance in the browser.
    **/


        /**
         * Provides access to acequire in packed noconflict mode
         * @param moduleName
        **/
export function         acequire(moduleName: string): any;

        /**
         * Embeds the Ace editor into the DOM, at the element provided by `el`.
         * @param el Either the id of an element, or the element itself
        **/
export function         edit(el: string): Editor;

        /**
         * Embeds the Ace editor into the DOM, at the element provided by `el`.
         * @param el Either the id of an element, or the element itself
        **/
export function         edit(el: HTMLElement): Editor;

        /**
         * Creates a new [[EditSession]], and returns the associated [[Document]].
         * @param text {:textParam}
         * @param mode {:modeParam}
        **/
export function         createEditSession(text: Document, mode: TextMode): IEditSession;

        /**
         * Creates a new [[EditSession]], and returns the associated [[Document]].
         * @param text {:textParam}
         * @param mode {:modeParam}
        **/
export function         createEditSession(text: string, mode: TextMode): IEditSession;


    ////////////////
    /// Anchor
    ////////////////

    /**
     * Defines the floating pointer in the document. Whenever text is inserted or deleted before the cursor, the position of the cursor is updated.
    **/
    export interface Anchor {

        on(event: string, fn: (e: any) => any): void;

        /**
         * Returns an object identifying the `row` and `column` position of the current anchor.
        **/
        getPosition(): Position;

        /**
         * Returns the current document.
        **/
        getDocument(): Document;

        /**
         * Fires whenever the anchor position changes.
         * Both of these objects have a `row` and `column` property corresponding to the position.
         * Events that can trigger this function include [[Anchor.setPosition `setPosition()`]].
         * @param e An object containing information about the anchor position. It has two properties:
         * - `old`: An object describing the old Anchor position
         * - `value`: An object describing the new Anchor position
        **/
        onChange(e: any): void;

        /**
         * Sets the anchor position to the specified row and column. If `noClip` is `true`, the position is not clipped.
         * @param row The row index to move the anchor to
         * @param column The column index to move the anchor to
         * @param noClip Identifies if you want the position to be clipped
        **/
        setPosition(row: number, column: number, noClip: boolean): void;

        /**
         * When called, the `'change'` event listener is removed.
        **/
        detach(): void;
    }
    var Anchor: {
        /**
         * Creates a new `Anchor` and associates it with a document.
         * @param doc The document to associate with the anchor
         * @param row The starting row position
         * @param column The starting column position
        **/
        new(doc: Document, row: number, column: number): Anchor;
    }

    ////////////////////////////////
    /// BackgroundTokenizer
    ////////////////////////////////

    /**
     * Tokenizes the current [[Document `Document`]] in the background, and caches the tokenized rows for future use.
     * If a certain row is changed, everything below that row is re-tokenized.
    **/
    export interface BackgroundTokenizer {

        states: any[];

        /**
         * Sets a new tokenizer for this object.
         * @param tokenizer The new tokenizer to use
        **/
        setTokenizer(tokenizer: Tokenizer): void;

        /**
         * Sets a new document to associate with this object.
         * @param doc The new document to associate with
        **/
        setDocument(doc: Document): void;

        /**
         * Emits the `'update'` event. `firstRow` and `lastRow` are used to define the boundaries of the region to be updated.
         * @param firstRow The starting row region
         * @param lastRow The final row region
        **/
        fireUpdateEvent(firstRow: number, lastRow: number): void;

        /**
         * Starts tokenizing at the row indicated.
         * @param startRow The row to start at
        **/
        start(startRow: number): void;

        /**
         * Stops tokenizing.
        **/
        stop(): void;

        /**
         * Gives list of tokens of the row. (tokens are cached)
         * @param row The row to get tokens at
        **/
        getTokens(row: number): TokenInfo[];

        /**
         * [Returns the state of tokenization at the end of a row.]{: #BackgroundTokenizer.getState}
         * @param row The row to get state at
        **/
        getState(row: number): string;
    }
    var BackgroundTokenizer: {
        /**
         * Creates a new `BackgroundTokenizer` object.
         * @param tokenizer The tokenizer to use
         * @param editor The editor to associate with
        **/
        new(tokenizer: Tokenizer, editor: Editor): BackgroundTokenizer;
    }

    ////////////////
    /// Document
    ////////////////

    /**
     * Contains the text of the document. Document can be attached to several [[EditSession `EditSession`]]s.
     * At its core, `Document`s are just an array of strings, with each row in the document matching up to the array index.
    **/
    export interface Document {

        on(event: string, fn: (e: any) => any): void;

        /**
         * Replaces all the lines in the current `Document` with the value of `text`.
         * @param text The text to use
        **/
        setValue(text: string): void;

        /**
         * Returns all the lines in the document as a single string, split by the new line character.
        **/
        getValue(): string;

        /**
         * Creates a new `Anchor` to define a floating point in the document.
         * @param row The row number to use
         * @param column The column number to use
        **/
        createAnchor(row: number, column: number): void;

        /**
         * Returns the newline character that's being used, depending on the value of `newLineMode`.
        **/
        getNewLineCharacter(): string;

        /**
         * [Sets the new line mode.]{: #Document.setNewLineMode.desc}
         * @param newLineMode [The newline mode to use; can be either `windows`, `unix`, or `auto`]{: #Document.setNewLineMode.param}
        **/
        setNewLineMode(newLineMode: string): void;

        /**
         * [Returns the type of newlines being used; either `windows`, `unix`, or `auto`]{: #Document.getNewLineMode}
        **/
        getNewLineMode(): string;

        /**
         * Returns `true` if `text` is a newline character (either `\r\n`, `\r`, or `\n`).
         * @param text The text to check
        **/
        isNewLine(text: string): boolean;

        /**
         * Returns a verbatim copy of the given line as it is in the document
         * @param row The row index to retrieve
        **/
        getLine(row: number): string;

        /**
         * Returns an array of strings of the rows between `firstRow` and `lastRow`. This function is inclusive of `lastRow`.
         * @param firstRow The first row index to retrieve
         * @param lastRow The final row index to retrieve
        **/
        getLines(firstRow: number, lastRow: number): string[];

        /**
         * Returns all lines in the document as string array. Warning: The caller should not modify this array!
        **/
        getAllLines(): string[];

        /**
         * Returns the number of rows in the document.
        **/
        getLength(): number;

        /**
         * [Given a range within the document, this function returns all the text within that range as a single string.]{: #Document.getTextRange.desc}
         * @param range The range to work with
        **/
        getTextRange(range: Range): string;

        /**
         * Inserts a block of `text` and the indicated `position`.
         * @param position The position to start inserting at
         * @param text A chunk of text to insert
        **/
        insert(position: Position, text: string): any;

        /**
         * Inserts the elements in `lines` into the document, starting at the row index given by `row`. This method also triggers the `'change'` event.
         * @param row The index of the row to insert at
         * @param lines An array of strings
        **/
        insertLines(row: number, lines: string[]): any;

        /**
         * Inserts a new line into the document at the current row's `position`. This method also triggers the `'change'` event.
         * @param position The position to insert at
        **/
        insertNewLine(position: Position): any;

        /**
         * Inserts `text` into the `position` at the current row. This method also triggers the `'change'` event.
         * @param position The position to insert at
         * @param text A chunk of text
        **/
        insertInLine(position: any, text: string): any;

        /**
         * Removes the `range` from the document.
         * @param range A specified Range to remove
        **/
        remove(range: Range): any;

        /**
         * Removes the specified columns from the `row`. This method also triggers the `'change'` event.
         * @param row The row to remove from
         * @param startColumn The column to start removing at
         * @param endColumn The column to stop removing at
        **/
        removeInLine(row: number, startColumn: number, endColumn: number): any;

        /**
         * Removes a range of full lines. This method also triggers the `'change'` event.
         * @param firstRow The first row to be removed
         * @param lastRow The last row to be removed
        **/
        removeLines(firstRow: number, lastRow: number): string[];

        /**
         * Removes the new line between `row` and the row immediately following it. This method also triggers the `'change'` event.
         * @param row The row to check
        **/
        removeNewLine(row: number): void;

        /**
         * Replaces a range in the document with the new `text`.
         * @param range A specified Range to replace
         * @param text The new text to use as a replacement
        **/
        replace(range: Range, text: string): any;

        /**
         * Applies all the changes previously accumulated. These can be either `'includeText'`, `'insertLines'`, `'removeText'`, and `'removeLines'`.
        **/
        applyDeltas(deltas: Delta[]): void;

        /**
         * Reverts any changes previously applied. These can be either `'includeText'`, `'insertLines'`, `'removeText'`, and `'removeLines'`.
        **/
        revertDeltas(deltas: Delta[]): void;

        /**
         * Converts an index position in a document to a `{row, column}` object.
         * Index refers to the "absolute position" of a character in the document. For example:
         * ```javascript
         * var x = 0; // 10 characters, plus one for newline
         * var y = -1;
         * ```
         * Here, `y` is an index 15: 11 characters for the first row, and 5 characters until `y` in the second.
         * @param index An index to convert
         * @param startRow=0 The row from which to start the conversion
        **/
        indexToPosition(index: number, startRow: number): Position;

        /**
         * Converts the `{row, column}` position in a document to the character's index.
         * Index refers to the "absolute position" of a character in the document. For example:
         * ```javascript
         * var x = 0; // 10 characters, plus one for newline
         * var y = -1;
         * ```
         * Here, `y` is an index 15: 11 characters for the first row, and 5 characters until `y` in the second.
         * @param pos The `{row, column}` to convert
         * @param startRow=0 The row from which to start the conversion
        **/
        positionToIndex(pos: Position, startRow: number): number;
    }
    var Document: {
        /**
         * Creates a new `Document`. If `text` is included, the `Document` contains those strings; otherwise, it's empty.
         * @param text The starting text
        **/
        new(text?: string): Document;
        /**
         * Creates a new `Document`. If `text` is included, the `Document` contains those strings; otherwise, it's empty.
         * @param text The starting text
        **/
        new(text?: string[]): Document;
    }

    ////////////////////////////////
    /// EditSession
    ////////////////////////////////

    /**
     * Stores all the data about [[Editor `Editor`]] state providing easy way to change editors state.
     * `EditSession` can be attached to only one [[Document `Document`]]. Same `Document` can be attached to several `EditSession`s.
    **/
    export interface IEditSession {

        selection: Selection;

        bgTokenizer: BackgroundTokenizer;

        doc: Document;

        on(event: string, fn: (e: any) => any): void;

        findMatchingBracket(position: Position): void;

        addFold(text: string, range: Range): void;

        getFoldAt(row: number, column: number): any;

        removeFold(arg: any): void;

        expandFold(arg: any): void;

        foldAll(startRow?: number, endRow?: number, depth?: number): void

        unfold(arg1: any, arg2: boolean): void;

        screenToDocumentColumn(row: number, column: number): void;

        getFoldDisplayLine(foldLine: any, docRow: number, docColumn: number): any;

        getFoldsInRange(range: Range): any;

        highlight(text: string): void;

        /**
         * Sets the `EditSession` to point to a new `Document`. If a `BackgroundTokenizer` exists, it also points to `doc`.
         * @param doc The new `Document` to use
        **/
        setDocument(doc: Document): void;

        /**
         * Returns the `Document` associated with this session.
        **/
        getDocument(): Document;

        /**
         * undefined
         * @param row The row to work with
        **/
        $resetRowCache(row: number): void;

        /**
         * Sets the session text.
         * @param text The new text to place
        **/
        setValue(text: string): void;

        setMode(mode: string): void;

        /**
         * Returns the current [[Document `Document`]] as a string.
        **/
        getValue(): string;

        /**
         * Returns the string of the current selection.
        **/
        getSelection(): Selection;

        /**
         * {:BackgroundTokenizer.getState}
         * @param row The row to start at
        **/
        getState(row: number): string;

        /**
         * Starts tokenizing at the row indicated. Returns a list of objects of the tokenized rows.
         * @param row The row to start at
        **/
        getTokens(row: number): TokenInfo[];

        /**
         * Returns an object indicating the token at the current row. The object has two properties: `index` and `start`.
         * @param row The row number to retrieve from
         * @param column The column number to retrieve from
        **/
        getTokenAt(row: number, column: number): TokenInfo;

        /**
         * Sets the undo manager.
         * @param undoManager The new undo manager
        **/
        setUndoManager(undoManager: UndoManager): void;

        /**
         * Returns the current undo manager.
        **/
        getUndoManager(): UndoManager;

        /**
         * Returns the current value for tabs. If the user is using soft tabs, this will be a series of spaces (defined by [[EditSession.getTabSize `getTabSize()`]]): void; otherwise it's simply `'\t'`.
        **/
        getTabString(): string;

        /**
         * Pass `true` to enable the use of soft tabs. Soft tabs means you're using spaces instead of the tab character (`'\t'`).
         * @param useSoftTabs Value indicating whether or not to use soft tabs
        **/
        setUseSoftTabs(useSoftTabs: boolean): void;

        /**
         * Returns `true` if soft tabs are being used, `false` otherwise.
        **/
        getUseSoftTabs(): boolean;

        /**
         * Set the number of spaces that define a soft tab; for example, passing in `4` transforms the soft tabs to be equivalent to four spaces. This function also emits the `changeTabSize` event.
         * @param tabSize The new tab size
        **/
        setTabSize(tabSize: number): void;

        /**
         * Returns the current tab size.
        **/
        getTabSize(): number;

        /**
         * Returns `true` if the character at the position is a soft tab.
         * @param position The position to check
        **/
        isTabStop(position: any): boolean;

        /**
         * Pass in `true` to enable overwrites in your session, or `false` to disable.
         * If overwrites is enabled, any text you enter will type over any text after it. If the value of `overwrite` changes, this function also emites the `changeOverwrite` event.
         * @param overwrite Defines wheter or not to set overwrites
        **/
        setOverwrite(overwrite: boolean): void;

        /**
         * Returns `true` if overwrites are enabled; `false` otherwise.
        **/
        getOverwrite(): boolean;

        /**
         * Sets the value of overwrite to the opposite of whatever it currently is.
        **/
        toggleOverwrite(): void;

        /**
         * Adds `className` to the `row`, to be used for CSS stylings and whatnot.
         * @param row The row number
         * @param className The class to add
        **/
        addGutterDecoration(row: number, className: string): void;

        /**
         * Removes `className` from the `row`.
         * @param row The row number
         * @param className The class to add
        **/
        removeGutterDecoration(row: number, className: string): void;

        /**
         * Returns an array of numbers, indicating which rows have breakpoints.
        **/
        getBreakpoints(): number[];

        /**
         * Sets a breakpoint on every row number given by `rows`. This function also emites the `'changeBreakpoint'` event.
         * @param rows An array of row indices
        **/
        setBreakpoints(rows: any[]): void;

        /**
         * Removes all breakpoints on the rows. This function also emites the `'changeBreakpoint'` event.
        **/
        clearBreakpoints(): void;

        /**
         * Sets a breakpoint on the row number given by `rows`. This function also emites the `'changeBreakpoint'` event.
         * @param row A row index
         * @param className Class of the breakpoint
        **/
        setBreakpoint(row: number, className: string): void;

        /**
         * Removes a breakpoint on the row number given by `rows`. This function also emites the `'changeBreakpoint'` event.
         * @param row A row index
        **/
        clearBreakpoint(row: number): void;

        /**
         * Adds a new marker to the given `Range`. If `inFront` is `true`, a front marker is defined, and the `'changeFrontMarker'` event fires; otherwise, the `'changeBackMarker'` event fires.
         * @param range Define the range of the marker
         * @param clazz Set the CSS class for the marker
         * @param type Identify the type of the marker
         * @param inFront Set to `true` to establish a front marker
        **/
        addMarker(range: Range, clazz: string, type: Function, inFront: boolean): number;

        /**
         * Adds a new marker to the given `Range`. If `inFront` is `true`, a front marker is defined, and the `'changeFrontMarker'` event fires; otherwise, the `'changeBackMarker'` event fires.
         * @param range Define the range of the marker
         * @param clazz Set the CSS class for the marker
         * @param type Identify the type of the marker
         * @param inFront Set to `true` to establish a front marker
        **/
        addMarker(range: Range, clazz: string, type: string, inFront: boolean): number;

        /**
         * Adds a dynamic marker to the session.
         * @param marker object with update method
         * @param inFront Set to `true` to establish a front marker
        **/
        addDynamicMarker(marker: any, inFront: boolean): void;

        /**
         * Removes the marker with the specified ID. If this marker was in front, the `'changeFrontMarker'` event is emitted. If the marker was in the back, the `'changeBackMarker'` event is emitted.
         * @param markerId A number representing a marker
        **/
        removeMarker(markerId: number): void;

        /**
         * Returns an array containing the IDs of all the markers, either front or back.
         * @param inFront If `true`, indicates you only want front markers; `false` indicates only back markers
        **/
        getMarkers(inFront: boolean): any[];

        /**
         * Sets annotations for the `EditSession`. This functions emits the `'changeAnnotation'` event.
         * @param annotations A list of annotations
        **/
        setAnnotations(annotations: Annotation[]): void;

        /**
         * Returns the annotations for the `EditSession`.
        **/
        getAnnotations(): any;

        /**
         * Clears all the annotations for this session. This function also triggers the `'changeAnnotation'` event.
        **/
        clearAnnotations(): void;

        /**
         * If `text` contains either the newline (`\n`) or carriage-return ('\r') characters, `$autoNewLine` stores that value.
         * @param text A block of text
        **/
        $detectNewLine(text: string): void;

        /**
         * Given a starting row and column, this method returns the `Range` of the first word boundary it finds.
         * @param row The row to start at
         * @param column The column to start at
        **/
        getWordRange(row: number, column: number): Range;

        /**
         * Gets the range of a word, including its right whitespace.
         * @param row The row number to start from
         * @param column The column number to start from
        **/
        getAWordRange(row: number, column: number): any;

        /**
         * {:Document.setNewLineMode.desc}
         * @param newLineMode {:Document.setNewLineMode.param}
        **/
        setNewLineMode(newLineMode: string): void;

        /**
         * Returns the current new line mode.
        **/
        getNewLineMode(): string;

        /**
         * Identifies if you want to use a worker for the `EditSession`.
         * @param useWorker Set to `true` to use a worker
        **/
        setUseWorker(useWorker: boolean): void;

        /**
         * Returns `true` if workers are being used.
        **/
        getUseWorker(): boolean;

        /**
         * Reloads all the tokens on the current session. This function calls [[BackgroundTokenizer.start `BackgroundTokenizer.start ()`]] to all the rows; it also emits the `'tokenizerUpdate'` event.
        **/
        onReloadTokenizer(): void;

        /**
         * Sets a new text mode for the `EditSession`. This method also emits the `'changeMode'` event. If a [[BackgroundTokenizer `BackgroundTokenizer`]] is set, the `'tokenizerUpdate'` event is also emitted.
         * @param mode Set a new text mode
        **/
        $mode(mode: TextMode): void;

        /**
         * Returns the current text mode.
        **/
        getMode(): TextMode;

        /**
         * This function sets the scroll top value. It also emits the `'changeScrollTop'` event.
         * @param scrollTop The new scroll top value
        **/
        setScrollTop(scrollTop: number): void;

        /**
         * [Returns the value of the distance between the top of the editor and the topmost part of the visible content.]{: #EditSession.getScrollTop}
        **/
        getScrollTop(): number;

        /**
         * [Sets the value of the distance between the left of the editor and the leftmost part of the visible content.]{: #EditSession.setScrollLeft}
        **/
        setScrollLeft(): void;

        /**
         * [Returns the value of the distance between the left of the editor and the leftmost part of the visible content.]{: #EditSession.getScrollLeft}
        **/
        getScrollLeft(): number;

        /**
         * Returns the width of the screen.
        **/
        getScreenWidth(): number;

        /**
         * Returns a verbatim copy of the given line as it is in the document
         * @param row The row to retrieve from
        **/
        getLine(row: number): string;

        /**
         * Returns an array of strings of the rows between `firstRow` and `lastRow`. This function is inclusive of `lastRow`.
         * @param firstRow The first row index to retrieve
         * @param lastRow The final row index to retrieve
        **/
        getLines(firstRow: number, lastRow: number): string[];

        /**
         * Returns the number of rows in the document.
        **/
        getLength(): number;

        /**
         * {:Document.getTextRange.desc}
         * @param range The range to work with
        **/
        getTextRange(range: Range): string;

        /**
         * Inserts a block of `text` and the indicated `position`.
         * @param position The position {row, column} to start inserting at
         * @param text A chunk of text to insert
        **/
        insert(position: Position, text: string): any;

        /**
         * Removes the `range` from the document.
         * @param range A specified Range to remove
        **/
        remove(range: Range): any;

        /**
         * Reverts previous changes to your document.
         * @param deltas An array of previous changes
         * @param dontSelect [If `true`, doesn't select the range of where the change occured]{: #dontSelect}
        **/
        undoChanges(deltas: any[], dontSelect: boolean): Range;

        /**
         * Re-implements a previously undone change to your document.
         * @param deltas An array of previous changes
         * @param dontSelect {:dontSelect}
        **/
        redoChanges(deltas: any[], dontSelect: boolean): Range;

        /**
         * Enables or disables highlighting of the range where an undo occured.
         * @param enable If `true`, selects the range of the reinserted change
        **/
        setUndoSelect(enable: boolean): void;

        /**
         * Replaces a range in the document with the new `text`.
         * @param range A specified Range to replace
         * @param text The new text to use as a replacement
        **/
        replace(range: Range, text: string): any;

        /**
         * Moves a range of text from the given range to the given position. `toPosition` is an object that looks like this:
         * ```json
         * { row: newRowLocation, column: newColumnLocation }
         * ```
         * @param fromRange The range of text you want moved within the document
         * @param toPosition The location (row and column) where you want to move the text to
        **/
        moveText(fromRange: Range, toPosition: any): Range;

        /**
         * Indents all the rows, from `startRow` to `endRow` (inclusive), by prefixing each row with the token in `indentString`.
         * If `indentString` contains the `'\t'` character, it's replaced by whatever is defined by [[EditSession.getTabString `getTabString()`]].
         * @param startRow Starting row
         * @param endRow Ending row
         * @param indentString The indent token
        **/
        indentRows(startRow: number, endRow: number, indentString: string): void;

        /**
         * Outdents all the rows defined by the `start` and `end` properties of `range`.
         * @param range A range of rows
        **/
        outdentRows(range: Range): void;

        /**
         * Shifts all the lines in the document up one, starting from `firstRow` and ending at `lastRow`.
         * @param firstRow The starting row to move up
         * @param lastRow The final row to move up
        **/
        moveLinesUp(firstRow: number, lastRow: number): number;

        /**
         * Shifts all the lines in the document down one, starting from `firstRow` and ending at `lastRow`.
         * @param firstRow The starting row to move down
         * @param lastRow The final row to move down
        **/
        moveLinesDown(firstRow: number, lastRow: number): number;

        /**
         * Duplicates all the text between `firstRow` and `lastRow`.
         * @param firstRow The starting row to duplicate
         * @param lastRow The final row to duplicate
        **/
        duplicateLines(firstRow: number, lastRow: number): number;

        /**
         * Sets whether or not line wrapping is enabled. If `useWrapMode` is different than the current value, the `'changeWrapMode'` event is emitted.
         * @param useWrapMode Enable (or disable) wrap mode
        **/
        setUseWrapMode(useWrapMode: boolean): void;

        /**
         * Returns `true` if wrap mode is being used; `false` otherwise.
        **/
        getUseWrapMode(): boolean;

        /**
         * Sets the boundaries of wrap. Either value can be `null` to have an unconstrained wrap, or, they can be the same number to pin the limit. If the wrap limits for `min` or `max` are different, this method also emits the `'changeWrapMode'` event.
         * @param min The minimum wrap value (the left side wrap)
         * @param max The maximum wrap value (the right side wrap)
        **/
        setWrapLimitRange(min: number, max: number): void;

        /**
         * This should generally only be called by the renderer when a resize is detected.
         * @param desiredLimit The new wrap limit
        **/
        adjustWrapLimit(desiredLimit: number): boolean;

        /**
         * Returns the value of wrap limit.
        **/
        getWrapLimit(): number;

        /**
         * Returns an object that defines the minimum and maximum of the wrap limit; it looks something like this:
         * { min: wrapLimitRange_min, max: wrapLimitRange_max }
        **/
        getWrapLimitRange(): any;

        /**
         * Given a string, returns an array of the display characters, including tabs and spaces.
         * @param str The string to check
         * @param offset The value to start at
        **/
        $getDisplayTokens(str: string, offset: number): void;

        /**
         * Calculates the width of the string `str` on the screen while assuming that the string starts at the first column on the screen.
         * @param str The string to calculate the screen width of
         * @param maxScreenColumn
         * @param screenColumn
        **/
        $getStringScreenWidth(str: string, maxScreenColumn: number, screenColumn: number): number[];

        /**
         * Returns number of screenrows in a wrapped line.
         * @param row The row number to check
        **/
        getRowLength(row: number): number;

        /**
         * Returns the position (on screen) for the last character in the provided screen row.
         * @param screenRow The screen row to check
        **/
        getScreenLastRowColumn(screenRow: number): number;

        /**
         * For the given document row and column, this returns the column position of the last screen row.
         * @param docRow
         * @param docColumn
        **/
        getDocumentLastRowColumn(docRow: number, docColumn: number): number;

        /**
         * For the given document row and column, this returns the document position of the last row.
         * @param docRow
         * @param docColumn
        **/
        getDocumentLastRowColumnPosition(docRow: number, docColumn: number): number;

        /**
         * For the given row, this returns the split data.
        **/
        getRowSplitData(): string;

        /**
         * The distance to the next tab stop at the specified screen column.
         * @param screenColumn The screen column to check
        **/
        getScreenTabSize(screenColumn: number): number;

        /**
         * Converts characters coordinates on the screen to characters coordinates within the document. [This takes into account code folding, word wrap, tab size, and any other visual modifications.]{: #conversionConsiderations}
         * @param screenRow The screen row to check
         * @param screenColumn The screen column to check
        **/
        screenToDocumentPosition(screenRow: number, screenColumn: number): any;

        /**
         * Converts document coordinates to screen coordinates. {:conversionConsiderations}
         * @param docRow The document row to check
         * @param docColumn The document column to check
        **/
        documentToScreenPosition(docRow: number, docColumn: number): any;

        /**
         * For the given document row and column, returns the screen column.
         * @param row
         * @param docColumn
        **/
        documentToScreenColumn(row: number, docColumn: number): number;

        /**
         * For the given document row and column, returns the screen row.
         * @param docRow
         * @param docColumn
        **/
        documentToScreenRow(docRow: number, docColumn: number): void;

        /**
         * Returns the length of the screen.
        **/
        getScreenLength(): number;
    }
    var EditSession: {
        /**
         * Sets up a new `EditSession` and associates it with the given `Document` and `TextMode`.
         * @param text [If `text` is a `Document`, it associates the `EditSession` with it. Otherwise, a new `Document` is created, with the initial text]{: #textParam}
         * @param mode [The inital language mode to use for the document]{: #modeParam}
        **/
        new(text: string, mode?: TextMode): IEditSession;

        new(content: string, mode?: string): IEditSession;

        new (text: string[], mode?: string): IEditSession;
    }

    ////////////////////////////////
    /// Editor
    ////////////////////////////////

    /**
     * The main entry point into the Ace functionality.
     * The `Editor` manages the [[EditSession]] (which manages [[Document]]s), as well as the [[VirtualRenderer]], which draws everything to the screen.
     * Event sessions dealing with the mouse and keyboard are bubbled up from `Document` to the `Editor`, which decides what to do with them.
    **/
    export interface Editor {

        on(ev: string, callback: (e: any) => any): void;

        addEventListener(ev: 'change', callback: (ev: EditorChangeEvent) => any): void;
        addEventListener(ev: string, callback: Function): void;

        off(ev: string, callback: Function): void;

        removeListener(ev: string, callback: Function): void;

        removeEventListener(ev: string, callback: Function): void;

        inMultiSelectMode: boolean;

        selectMoreLines(n: number): void;

        onTextInput(text: string): void;

        onCommandKey(e: any, hashId: any, keyCode: any): void;

        commands: CommandManager;

        session: IEditSession;

        selection: Selection;

        renderer: VirtualRenderer;

        keyBinding: KeyBinding;

        container: HTMLElement;

        onSelectionChange(e: any): void;

        onChangeMode(e?: any): void;

        execCommand(command:string, args?: any): void;

        /**
         * Sets a Configuration Option
         **/
        setOption(optionName: any, optionValue: any): void;

        /**
         * Sets Configuration Options
         **/
        setOptions(keyValueTuples: any): void;

        /**
         * Get a Configuration Option
         **/
        getOption(name: any):any;

        /**
         * Get Configuration Options
         **/
        getOptions():any;

        /**
         * Get rid of console warning by setting this to Infinity
         **/
        $blockScrolling:number;

        /**
         * Sets a new key handler, such as "vim" or "windows".
         * @param keyboardHandler The new key handler
        **/
        setKeyboardHandler(keyboardHandler: string): void;

        /**
         * Returns the keyboard handler, such as "vim" or "windows".
        **/
        getKeyboardHandler(): string;

        /**
         * Sets a new editsession to use. This method also emits the `'changeSession'` event.
         * @param session The new session to use
        **/
        setSession(session: IEditSession): void;

        /**
         * Returns the current session being used.
        **/
        getSession(): IEditSession;

        /**
         * Sets the current document to `val`.
         * @param val The new value to set for the document
         * @param cursorPos Where to set the new value. `undefined` or 0 is selectAll, -1 is at the document start, and 1 is at the end
        **/
        setValue(val: string, cursorPos?: number): string;

        /**
         * Returns the current session's content.
        **/
        getValue(): string;

        /**
         * Returns the currently highlighted selection.
        **/
        getSelection(): Selection;

        /**
         * {:VirtualRenderer.onResize}
         * @param force If `true`, recomputes the size, even if the height and width haven't changed
        **/
        resize(force?: boolean): void;

        /**
         * {:VirtualRenderer.setTheme}
         * @param theme The path to a theme
        **/
        setTheme(theme: string): void;

        /**
         * {:VirtualRenderer.getTheme}
        **/
        getTheme(): string;

        /**
         * {:VirtualRenderer.setStyle}
         * @param style A class name
        **/
        setStyle(style: string): void;

        /**
         * {:VirtualRenderer.unsetStyle}
        **/
        unsetStyle(): void;

        /**
         * Set a new font size (in pixels) for the editor text.
         * @param size A font size ( _e.g._ "12px")
        **/
        setFontSize(size: string): void;

        /**
         * Brings the current `textInput` into focus.
        **/
        focus(): void;

        /**
         * Returns `true` if the current `textInput` is in focus.
        **/
        isFocused(): void;

        /**
         * Blurs the current `textInput`.
        **/
        blur(): void;

        /**
         * Emitted once the editor comes into focus.
        **/
        onFocus(): void;

        /**
         * Emitted once the editor has been blurred.
        **/
        onBlur(): void;

        /**
         * Emitted whenever the document is changed.
         * @param e Contains a single property, `data`, which has the delta of changes
        **/
        onDocumentChange(e: any): void;

        /**
         * Emitted when the selection changes.
        **/
        onCursorChange(): void;

        /**
         * Returns the string of text currently highlighted.
        **/
        getCopyText(): string;

        /**
         * Called whenever a text "copy" happens.
        **/
        onCopy(): void;

        /**
         * Called whenever a text "cut" happens.
        **/
        onCut(): void;

        /**
         * Called whenever a text "paste" happens.
         * @param text The pasted text
        **/
        onPaste(text: string): void;

        /**
         * Inserts `text` into wherever the cursor is pointing.
         * @param text The new text to add
        **/
        insert(text: string): void;

        /**
         * Pass in `true` to enable overwrites in your session, or `false` to disable. If overwrites is enabled, any text you enter will type over any text after it. If the value of `overwrite` changes, this function also emites the `changeOverwrite` event.
         * @param overwrite Defines wheter or not to set overwrites
        **/
        setOverwrite(overwrite: boolean): void;

        /**
         * Returns `true` if overwrites are enabled; `false` otherwise.
        **/
        getOverwrite(): boolean;

        /**
         * Sets the value of overwrite to the opposite of whatever it currently is.
        **/
        toggleOverwrite(): void;

        /**
         * Sets how fast the mouse scrolling should do.
         * @param speed A value indicating the new speed (in milliseconds)
        **/
        setScrollSpeed(speed: number): void;

        /**
         * Returns the value indicating how fast the mouse scroll speed is (in milliseconds).
        **/
        getScrollSpeed(): number;

        /**
         * Sets the delay (in milliseconds) of the mouse drag.
         * @param dragDelay A value indicating the new delay
        **/
        setDragDelay(dragDelay: number): void;

        /**
         * Returns the current mouse drag delay.
        **/
        getDragDelay(): number;

        /**
         * Indicates how selections should occur.
         * By default, selections are set to "line". There are no other styles at the moment,
         * although this code change in the future.
         * This function also emits the `'changeSelectionStyle'` event.
         * @param style The new selection style
        **/
        setSelectionStyle(style: string): void;

        /**
         * Returns the current selection style.
        **/
        getSelectionStyle(): string;

        /**
         * Determines whether or not the current line should be highlighted.
         * @param shouldHighlight Set to `true` to highlight the current line
        **/
        setHighlightActiveLine(shouldHighlight: boolean): void;

        /**
         * Returns `true` if current lines are always highlighted.
        **/
        getHighlightActiveLine(): void;

        /**
         * Determines if the currently selected word should be highlighted.
         * @param shouldHighlight Set to `true` to highlight the currently selected word
        **/
        setHighlightSelectedWord(shouldHighlight: boolean): void;

        /**
         * Returns `true` if currently highlighted words are to be highlighted.
        **/
        getHighlightSelectedWord(): boolean;

        /**
         * If `showInvisibiles` is set to `true`, invisible characters&mdash;like spaces or new lines&mdash;are show in the editor.
         * @param showInvisibles Specifies whether or not to show invisible characters
        **/
        setShowInvisibles(showInvisibles: boolean): void;

        /**
         * Returns `true` if invisible characters are being shown.
        **/
        getShowInvisibles(): boolean;

        /**
         * If `showPrintMargin` is set to `true`, the print margin is shown in the editor.
         * @param showPrintMargin Specifies whether or not to show the print margin
        **/
        setShowPrintMargin(showPrintMargin: boolean): void;

        /**
         * Returns `true` if the print margin is being shown.
        **/
        getShowPrintMargin(): boolean;

        /**
         * Sets the column defining where the print margin should be.
         * @param showPrintMargin Specifies the new print margin
        **/
        setPrintMarginColumn(showPrintMargin: number): void;

        /**
         * Returns the column number of where the print margin is.
        **/
        getPrintMarginColumn(): number;

        /**
         * If `readOnly` is true, then the editor is set to read-only mode, and none of the content can change.
         * @param readOnly Specifies whether the editor can be modified or not
        **/
        setReadOnly(readOnly: boolean): void;

        /**
         * Returns `true` if the editor is set to read-only mode.
        **/
        getReadOnly(): boolean;

        /**
         * Specifies whether to use behaviors or not. ["Behaviors" in this case is the auto-pairing of special characters, like quotation marks, parenthesis, or brackets.]{: #BehaviorsDef}
         * @param enabled Enables or disables behaviors
        **/
        setBehavioursEnabled(enabled: boolean): void;

        /**
         * Returns `true` if the behaviors are currently enabled. {:BehaviorsDef}
        **/
        getBehavioursEnabled(): boolean;

        /**
         * Specifies whether to use wrapping behaviors or not, i.e. automatically wrapping the selection with characters such as brackets
         * when such a character is typed in.
         * @param enabled Enables or disables wrapping behaviors
        **/
        setWrapBehavioursEnabled(enabled: boolean): void;

        /**
         * Returns `true` if the wrapping behaviors are currently enabled.
        **/
        getWrapBehavioursEnabled(): void;

        /**
         * Indicates whether the fold widgets are shown or not.
         * @param show Specifies whether the fold widgets are shown
        **/
        setShowFoldWidgets(show: boolean): void;

        /**
         * Returns `true` if the fold widgets are shown.
        **/
        getShowFoldWidgets(): void;

        /**
         * Removes words of text from the editor. A "word" is defined as a string of characters bookended by whitespace.
         * @param dir The direction of the deletion to occur, either "left" or "right"
        **/
        remove(dir: string): void;

        /**
         * Removes the word directly to the right of the current selection.
        **/
        removeWordRight(): void;

        /**
         * Removes the word directly to the left of the current selection.
        **/
        removeWordLeft(): void;

        /**
         * Removes all the words to the left of the current selection, until the start of the line.
        **/
        removeToLineStart(): void;

        /**
         * Removes all the words to the right of the current selection, until the end of the line.
        **/
        removeToLineEnd(): void;

        /**
         * Splits the line at the current selection (by inserting an `'\n'`).
        **/
        splitLine(): void;

        /**
         * Transposes current line.
        **/
        transposeLetters(): void;

        /**
         * Converts the current selection entirely into lowercase.
        **/
        toLowerCase(): void;

        /**
         * Converts the current selection entirely into uppercase.
        **/
        toUpperCase(): void;

        /**
         * Inserts an indentation into the current cursor position or indents the selected lines.
        **/
        indent(): void;

        /**
         * Indents the current line.
        **/
        blockIndent(): void;

        /**
         * Outdents the current line.
        **/
        blockOutdent(arg?: string): void;

        /**
         * Given the currently selected range, this function either comments all the lines, or uncomments all of them.
        **/
        toggleCommentLines(): void;

        /**
         * Works like [[EditSession.getTokenAt]], except it returns a number.
        **/
        getNumberAt(): number;

        /**
         * If the character before the cursor is a number, this functions changes its value by `amount`.
         * @param amount The value to change the numeral by (can be negative to decrease value)
        **/
        modifyNumber(amount: number): void;

        /**
         * Removes all the lines in the current selection
        **/
        removeLines(): void;

        /**
         * Shifts all the selected lines down one row.
        **/
        moveLinesDown(): number;

        /**
         * Shifts all the selected lines up one row.
        **/
        moveLinesUp(): number;

        /**
         * Moves a range of text from the given range to the given position. `toPosition` is an object that looks like this:
         * ```json
         * { row: newRowLocation, column: newColumnLocation }
         * ```
         * @param fromRange The range of text you want moved within the document
         * @param toPosition The location (row and column) where you want to move the text to
        **/
        moveText(fromRange: Range, toPosition: any): Range;

        /**
         * Copies all the selected lines up one row.
        **/
        copyLinesUp(): number;

        /**
         * Copies all the selected lines down one row.
        **/
        copyLinesDown(): number;

        /**
         * {:VirtualRenderer.getFirstVisibleRow}
        **/
        getFirstVisibleRow(): number;

        /**
         * {:VirtualRenderer.getLastVisibleRow}
        **/
        getLastVisibleRow(): number;

        /**
         * Indicates if the row is currently visible on the screen.
         * @param row The row to check
        **/
        isRowVisible(row: number): boolean;

        /**
         * Indicates if the entire row is currently visible on the screen.
         * @param row The row to check
        **/
        isRowFullyVisible(row: number): boolean;

        /**
         * Selects the text from the current position of the document until where a "page down" finishes.
        **/
        selectPageDown(): void;

        /**
         * Selects the text from the current position of the document until where a "page up" finishes.
        **/
        selectPageUp(): void;

        /**
         * Shifts the document to wherever "page down" is, as well as moving the cursor position.
        **/
        gotoPageDown(): void;

        /**
         * Shifts the document to wherever "page up" is, as well as moving the cursor position.
        **/
        gotoPageUp(): void;

        /**
         * Scrolls the document to wherever "page down" is, without changing the cursor position.
        **/
        scrollPageDown(): void;

        /**
         * Scrolls the document to wherever "page up" is, without changing the cursor position.
        **/
        scrollPageUp(): void;

        /**
         * Moves the editor to the specified row.
        **/
        scrollToRow(): void;

        /**
         * Scrolls to a line. If `center` is `true`, it puts the line in middle of screen (or attempts to).
         * @param line The line to scroll to
         * @param center If `true`
         * @param animate If `true` animates scrolling
         * @param callback Function to be called when the animation has finished
        **/
        scrollToLine(line: number, center: boolean, animate: boolean, callback: Function): void;

        /**
         * Attempts to center the current selection on the screen.
        **/
        centerSelection(): void;

        /**
         * Gets the current position of the cursor.
        **/
        getCursorPosition(): Position;

        /**
         * Returns the screen position of the cursor.
        **/
        getCursorPositionScreen(): number;

        /**
         * {:Selection.getRange}
        **/
        getSelectionRange(): Range;

        /**
         * Selects all the text in editor.
        **/
        selectAll(): void;

        /**
         * {:Selection.clearSelection}
        **/
        clearSelection(): void;

        /**
         * Moves the cursor to the specified row and column. Note that this does not de-select the current selection.
         * @param row The new row number
         * @param column The new column number
        **/
        moveCursorTo(row: number, column?: number, animate?:boolean): void;

        /**
         * Moves the cursor to the position indicated by `pos.row` and `pos.column`.
         * @param position An object with two properties, row and column
        **/
        moveCursorToPosition(position: Position): void;

        /**
         * Moves the cursor's row and column to the next matching bracket.
        **/
        jumpToMatching(): void;

        /**
         * Moves the cursor to the specified line number, and also into the indiciated column.
         * @param lineNumber The line number to go to
         * @param column A column number to go to
         * @param animate If `true` animates scolling
        **/
        gotoLine(lineNumber: number, column?: number, animate?: boolean): void;

        /**
         * Moves the cursor to the specified row and column. Note that this does de-select the current selection.
         * @param row The new row number
         * @param column The new column number
        **/
        navigateTo(row: number, column: number): void;

        /**
         * Moves the cursor up in the document the specified number of times. Note that this does de-select the current selection.
         * @param times The number of times to change navigation
        **/
        navigateUp(times?: number): void;

        /**
         * Moves the cursor down in the document the specified number of times. Note that this does de-select the current selection.
         * @param times The number of times to change navigation
        **/
        navigateDown(times?: number): void;

        /**
         * Moves the cursor left in the document the specified number of times. Note that this does de-select the current selection.
         * @param times The number of times to change navigation
        **/
        navigateLeft(times?: number): void;

        /**
         * Moves the cursor right in the document the specified number of times. Note that this does de-select the current selection.
         * @param times The number of times to change navigation
        **/
        navigateRight(times: number): void;

        /**
         * Moves the cursor to the start of the current line. Note that this does de-select the current selection.
        **/
        navigateLineStart(): void;

        /**
         * Moves the cursor to the end of the current line. Note that this does de-select the current selection.
        **/
        navigateLineEnd(): void;

        /**
         * Moves the cursor to the end of the current file. Note that this does de-select the current selection.
        **/
        navigateFileEnd(): void;

        /**
         * Moves the cursor to the start of the current file. Note that this does de-select the current selection.
        **/
        navigateFileStart(): void;

        /**
         * Moves the cursor to the word immediately to the right of the current position. Note that this does de-select the current selection.
        **/
        navigateWordRight(): void;

        /**
         * Moves the cursor to the word immediately to the left of the current position. Note that this does de-select the current selection.
        **/
        navigateWordLeft(): void;

        /**
         * Replaces the first occurance of `options.needle` with the value in `replacement`.
         * @param replacement The text to replace with
         * @param options The [[Search `Search`]] options to use
        **/
        replace(replacement: string, options?: any): void;

        /**
         * Replaces all occurances of `options.needle` with the value in `replacement`.
         * @param replacement The text to replace with
         * @param options The [[Search `Search`]] options to use
        **/
        replaceAll(replacement: string, options?: any): void;

        /**
         * {:Search.getOptions} For more information on `options`, see [[Search `Search`]].
        **/
        getLastSearchOptions(): any;

        /**
         * Attempts to find `needle` within the document. For more information on `options`, see [[Search `Search`]].
         * @param needle The text to search for (optional)
         * @param options An object defining various search properties
         * @param animate If `true` animate scrolling
        **/
        find(needle: string, options?: any, animate?: boolean): void;

        /**
         * Performs another search for `needle` in the document. For more information on `options`, see [[Search `Search`]].
         * @param options search options
         * @param animate If `true` animate scrolling
        **/
        findNext(options?: any, animate?: boolean): void;

        /**
         * Performs a search for `needle` backwards. For more information on `options`, see [[Search `Search`]].
         * @param options search options
         * @param animate If `true` animate scrolling
        **/
        findPrevious(options?: any, animate?: boolean): void;

        /**
         * {:UndoManager.undo}
        **/
        undo(): void;

        /**
         * {:UndoManager.redo}
        **/
        redo(): void;

        /**
         * Cleans up the entire editor.
        **/
        destroy(): void;

    }

    var Editor: {
        /**
         * Creates a new `Editor` object.
         * @param renderer Associated `VirtualRenderer` that draws everything
         * @param session The `EditSession` to refer to
        **/
        new(renderer: VirtualRenderer, session?: IEditSession): Editor;
    }

    interface EditorChangeEvent {
        start: Position;
        end: Position;
        action: string; // insert, remove
        lines: any[];
    }

    ////////////////////////////////
    /// PlaceHolder
    ////////////////////////////////

    export interface PlaceHolder {

        on(event: string, fn: (e: any) => any): void;

        /**
         * PlaceHolder.setup()
         * TODO
        **/
        setup(): void;

        /**
         * PlaceHolder.showOtherMarkers()
         * TODO
        **/
        showOtherMarkers(): void;

        /**
         * PlaceHolder.hideOtherMarkers()
         * Hides all over markers in the [[EditSession `EditSession`]] that are not the currently selected one.
        **/
        hideOtherMarkers(): void;

        /**
         * PlaceHolder@onUpdate(e)
         * Emitted when the place holder updates.
        **/
        onUpdate(): void;

        /**
         * PlaceHolder@onCursorChange(e)
         * Emitted when the cursor changes.
        **/
        onCursorChange(): void;

        /**
         * PlaceHolder.detach()
         * TODO
        **/
        detach(): void;

        /**
         * PlaceHolder.cancel()
         * TODO
        **/
        cancel(): void;
    }
    var PlaceHolder: {
        /**
         * - @param session (Document): The document to associate with the anchor
         * - @param length (Number): The starting row position
         * - @param pos (Number): The starting column position
         * - @param others (String):
         * - @param mainClass (String):
         * - @param othersClass (String):
        **/
        new (session: Document, length: number, pos: number, others: string, mainClass: string, othersClass: string): PlaceHolder;

        new (session: IEditSession, length: number, pos: Position, positions: Position[]): PlaceHolder;
    }

    ////////////////
    /// RangeList
    ////////////////

    export interface IRangeList {
        ranges: Range[];

        pointIndex(pos: Position, startIndex?: number): void;

        addList(ranges: Range[]): void;

        add(ranges: Range): void;

        merge(): Range[];

        substractPoint(pos: Position): void;
    }
    export var RangeList: {
        new (): IRangeList;
    }

    ////////////////
    /// Range
    ////////////////

    /**
     * This object is used in various places to indicate a region within the editor. To better visualize how this works, imagine a rectangle. Each quadrant of the rectangle is analogus to a range, as ranges contain a starting row and starting column, and an ending row, and ending column.
    **/
    export interface Range {

        startRow:number;

        startColumn:number;

        endRow:number;

        endColumn:number;

        start: Position;

        end: Position;

        isEmpty(): boolean;

        /**
         * Returns `true` if and only if the starting row and column, and ending row and column, are equivalent to those given by `range`.
         * @param range A range to check against
        **/
        isEqual(range: Range): void;

        /**
         * Returns a string containing the range's row and column information, given like this:
         * ```
         * [start.row/start.column] -> [end.row/end.column]
         * ```
        **/
        toString(): void;

        /**
         * Returns `true` if the `row` and `column` provided are within the given range. This can better be expressed as returning `true` if:
         * ```javascript
         * this.start.row <= row <= this.end.row &&
         * this.start.column <= column <= this.end.column
         * ```
         * @param row A row to check for
         * @param column A column to check for
        **/
        contains(row: number, column: number): boolean;

        /**
         * Compares `this` range (A) with another range (B).
         * @param range A range to compare with
        **/
        compareRange(range: Range): number;

        /**
         * Checks the row and column points of `p` with the row and column points of the calling range.
         * @param p A point to compare with
        **/
        comparePoint(p: Range): number;

        /**
         * Checks the start and end points of `range` and compares them to the calling range. Returns `true` if the `range` is contained within the caller's range.
         * @param range A range to compare with
        **/
        containsRange(range: Range): boolean;

        /**
         * Returns `true` if passed in `range` intersects with the one calling this method.
         * @param range A range to compare with
        **/
        intersects(range: Range): boolean;

        /**
         * Returns `true` if the caller's ending row point is the same as `row`, and if the caller's ending column is the same as `column`.
         * @param row A row point to compare with
         * @param column A column point to compare with
        **/
        isEnd(row: number, column: number): boolean;

        /**
         * Returns `true` if the caller's starting row point is the same as `row`, and if the caller's starting column is the same as `column`.
         * @param row A row point to compare with
         * @param column A column point to compare with
        **/
        isStart(row: number, column: number): boolean;

        /**
         * Sets the starting row and column for the range.
         * @param row A row point to set
         * @param column A column point to set
        **/
        setStart(row: number, column: number): void;

        /**
         * Sets the starting row and column for the range.
         * @param row A row point to set
         * @param column A column point to set
        **/
        setEnd(row: number, column: number): void;

        /**
         * Returns `true` if the `row` and `column` are within the given range.
         * @param row A row point to compare with
         * @param column A column point to compare with
        **/
        inside(row: number, column: number): boolean;

        /**
         * Returns `true` if the `row` and `column` are within the given range's starting points.
         * @param row A row point to compare with
         * @param column A column point to compare with
        **/
        insideStart(row: number, column: number): boolean;

        /**
         * Returns `true` if the `row` and `column` are within the given range's ending points.
         * @param row A row point to compare with
         * @param column A column point to compare with
        **/
        insideEnd(row: number, column: number): boolean;

        /**
         * Checks the row and column points with the row and column points of the calling range.
         * @param row A row point to compare with
         * @param column A column point to compare with
        **/
        compare(row: number, column: number): number;

        /**
         * Checks the row and column points with the row and column points of the calling range.
         * @param row A row point to compare with
         * @param column A column point to compare with
        **/
        compareStart(row: number, column: number): number;

        /**
         * Checks the row and column points with the row and column points of the calling range.
         * @param row A row point to compare with
         * @param column A column point to compare with
        **/
        compareEnd(row: number, column: number): number;

        /**
         * Checks the row and column points with the row and column points of the calling range.
         * @param row A row point to compare with
         * @param column A column point to compare with
        **/
        compareInside(row: number, column: number): number;

        /**
         * Returns the part of the current `Range` that occurs within the boundaries of `firstRow` and `lastRow` as a new `Range` object.
         * @param firstRow The starting row
         * @param lastRow The ending row
        **/
        clipRows(firstRow: number, lastRow: number): Range;

        /**
         * Changes the row and column points for the calling range for both the starting and ending points.
         * @param row A new row to extend to
         * @param column A new column to extend to
        **/
        extend(row: number, column: number): Range;

        /**
         * Returns `true` if the range spans across multiple lines.
        **/
        isMultiLine(): boolean;

        /**
         * Returns a duplicate of the calling range.
        **/
        clone(): Range;

        /**
         * Returns a range containing the starting and ending rows of the original range, but with a column value of `0`.
        **/
        collapseRows(): Range;

        /**
         * Given the current `Range`, this function converts those starting and ending points into screen positions, and then returns a new `Range` object.
         * @param session The `EditSession` to retrieve coordinates from
        **/
        toScreenRange(session: IEditSession): Range;

        /**
         * Creates and returns a new `Range` based on the row and column of the given parameters.
         * @param start A starting point to use
         * @param end An ending point to use
        **/
        fromPoints(start: Range, end: Range): Range;

    }
    /**
     * Creates a new `Range` object with the given starting and ending row and column points.
     * @param startRow The starting row
     * @param startColumn The starting column
     * @param endRow The ending row
     * @param endColumn The ending column
    **/
    var Range: {
        fromPoints(pos1: Position, pos2: Position): Range;
        new(startRow: number, startColumn: number, endRow: number, endColumn: number): Range;
    }

    ////////////////
    /// RenderLoop
    ////////////////

    export interface RenderLoop { }
    var RenderLoop: {
        new(): RenderLoop;
    }

    ////////////////
    /// ScrollBar
    ////////////////

    /**
     * A set of methods for setting and retrieving the editor's scrollbar.
    **/
    export interface ScrollBar {

        /**
         * Emitted when the scroll bar, well, scrolls.
         * @param e Contains one property, `"data"`, which indicates the current scroll top position
        **/
        onScroll(e: any): void;

        /**
         * Returns the width of the scroll bar.
        **/
        getWidth(): number;

        /**
         * Sets the height of the scroll bar, in pixels.
         * @param height The new height
        **/
        setHeight(height: number): void;

        /**
         * Sets the inner height of the scroll bar, in pixels.
         * @param height The new inner height
        **/
        setInnerHeight(height: number): void;

        /**
         * Sets the scroll top of the scroll bar.
         * @param scrollTop The new scroll top
        **/
        setScrollTop(scrollTop: number): void;
    }
    var ScrollBar: {
        /**
         * Creates a new `ScrollBar`. `parent` is the owner of the scroll bar.
         * @param parent A DOM element
        **/
        new(parent: HTMLElement): ScrollBar;
    }

    ////////////////
    /// Search
    ////////////////

    /**
     * A class designed to handle all sorts of text searches within a [[Document `Document`]].
    **/
    export interface Search {

        /**
         * Sets the search options via the `options` parameter.
         * @param options An object containing all the new search properties
        **/
        set(options: any): Search;

        /**
         * [Returns an object containing all the search options.]{: #Search.getOptions}
        **/
        getOptions(): any;

        /**
         * Sets the search options via the `options` parameter.
         * @param An object containing all the search propertie
        **/
        setOptions(An: any): void;

        /**
         * Searches for `options.needle`. If found, this method returns the [[Range `Range`]] where the text first occurs. If `options.backwards` is `true`, the search goes backwards in the session.
         * @param session The session to search with
        **/
        find(session: IEditSession): Range;

        /**
         * Searches for all occurances `options.needle`. If found, this method returns an array of [[Range `Range`s]] where the text first occurs. If `options.backwards` is `true`, the search goes backwards in the session.
         * @param session The session to search with
        **/
        findAll(session: IEditSession): Range[];

        /**
         * Searches for `options.needle` in `input`, and, if found, replaces it with `replacement`.
         * @param input The text to search in
         * @param replacement The replacing text
         * + (String): If `options.regExp` is `true`, this function returns `input` with the replacement already made. Otherwise, this function just returns `replacement`.<br/>
         * If `options.needle` was not found, this function returns `null`.
        **/
        replace(input: string, replacement: string): string;
    }
    var Search: {
        /**
         * Creates a new `Search` object. The following search options are avaliable:
         * - `needle`: The string or regular expression you're looking for
         * - `backwards`: Whether to search backwards from where cursor currently is. Defaults to `false`.
         * - `wrap`: Whether to wrap the search back to the beginning when it hits the end. Defaults to `false`.
         * - `caseSensitive`: Whether the search ought to be case-sensitive. Defaults to `false`.
         * - `wholeWord`: Whether the search matches only on whole words. Defaults to `false`.
         * - `range`: The [[Range]] to search within. Set this to `null` for the whole document
         * - `regExp`: Whether the search is a regular expression or not. Defaults to `false`.
         * - `start`: The starting [[Range]] or cursor position to begin the search
         * - `skipCurrent`: Whether or not to include the current line in the search. Default to `false`.
        **/
        new(): Search;
    }

    ////////////////
    /// Search
    ////////////////

    /**
     * Contains the cursor position and the text selection of an edit session.
     * The row/columns used in the selection are in document coordinates representing ths coordinates as thez appear in the document before applying soft wrap and folding.
    **/
    export interface Selection {

        on(ev: string, callback: Function): void;

        addEventListener(ev: string, callback: Function): void;

        off(ev: string, callback: Function): void;

        removeListener(ev: string, callback: Function): void;

        removeEventListener(ev: string, callback: Function): void;

        moveCursorWordLeft(): void;

        moveCursorWordRight(): void;

        fromOrientedRange(range: Range): void;

        setSelectionRange(match: any): void;

        getAllRanges(): Range[];

        on(event: string, fn: (e: any) => any): void;

        addRange(range: Range): void;

        /**
         * Returns `true` if the selection is empty.
        **/
        isEmpty(): boolean;

        /**
         * Returns `true` if the selection is a multi-line.
        **/
        isMultiLine(): boolean;

        /**
         * Gets the current position of the cursor.
        **/
        getCursor(): Position;

        /**
         * Sets the row and column position of the anchor. This function also emits the `'changeSelection'` event.
         * @param row The new row
         * @param column The new column
        **/
        setSelectionAnchor(row: number, column: number): void;

        /**
         * Returns an object containing the `row` and `column` of the calling selection anchor.
        **/
        getSelectionAnchor(): any;

        /**
         * Returns an object containing the `row` and `column` of the calling selection lead.
        **/
        getSelectionLead(): any;

        /**
         * Shifts the selection up (or down, if [[Selection.isBackwards `isBackwards()`]] is true) the given number of columns.
         * @param columns The number of columns to shift by
        **/
        shiftSelection(columns: number): void;

        /**
         * Returns `true` if the selection is going backwards in the document.
        **/
        isBackwards(): boolean;

        /**
         * [Returns the [[Range]] for the selected text.]{: #Selection.getRange}
        **/
        getRange(): Range;

        /**
         * [Empties the selection (by de-selecting it). This function also emits the `'changeSelection'` event.]{: #Selection.clearSelection}
        **/
        clearSelection(): void;

        /**
         * Selects all the text in the document.
        **/
        selectAll(): void;

        /**
         * Sets the selection to the provided range.
         * @param range The range of text to select
         * @param reverse Indicates if the range should go backwards (`true`) or not
        **/
        setRange(range: Range, reverse: boolean): void;

        /**
         * Moves the selection cursor to the indicated row and column.
         * @param row The row to select to
         * @param column The column to select to
        **/
        selectTo(row: number, column: number): void;

        /**
         * Moves the selection cursor to the row and column indicated by `pos`.
         * @param pos An object containing the row and column
        **/
        selectToPosition(pos: any): void;

        /**
         * Moves the selection up one row.
        **/
        selectUp(): void;

        /**
         * Moves the selection down one row.
        **/
        selectDown(): void;

        /**
         * Moves the selection right one column.
        **/
        selectRight(): void;

        /**
         * Moves the selection left one column.
        **/
        selectLeft(): void;

        /**
         * Moves the selection to the beginning of the current line.
        **/
        selectLineStart(): void;

        /**
         * Moves the selection to the end of the current line.
        **/
        selectLineEnd(): void;

        /**
         * Moves the selection to the end of the file.
        **/
        selectFileEnd(): void;

        /**
         * Moves the selection to the start of the file.
        **/
        selectFileStart(): void;

        /**
         * Moves the selection to the first word on the right.
        **/
        selectWordRight(): void;

        /**
         * Moves the selection to the first word on the left.
        **/
        selectWordLeft(): void;

        /**
         * Moves the selection to highlight the entire word.
        **/
        getWordRange(): void;

        /**
         * Selects an entire word boundary.
        **/
        selectWord(): void;

        /**
         * Selects a word, including its right whitespace.
        **/
        selectAWord(): void;

        /**
         * Selects the entire line.
        **/
        selectLine(): void;

        /**
         * Moves the cursor up one row.
        **/
        moveCursorUp(): void;

        /**
         * Moves the cursor down one row.
        **/
        moveCursorDown(): void;

        /**
         * Moves the cursor left one column.
        **/
        moveCursorLeft(): void;

        /**
         * Moves the cursor right one column.
        **/
        moveCursorRight(): void;

        /**
         * Moves the cursor to the start of the line.
        **/
        moveCursorLineStart(): void;

        /**
         * Moves the cursor to the end of the line.
        **/
        moveCursorLineEnd(): void;

        /**
         * Moves the cursor to the end of the file.
        **/
        moveCursorFileEnd(): void;

        /**
         * Moves the cursor to the start of the file.
        **/
        moveCursorFileStart(): void;

        /**
         * Moves the cursor to the word on the right.
        **/
        moveCursorLongWordRight(): void;

        /**
         * Moves the cursor to the word on the left.
        **/
        moveCursorLongWordLeft(): void;

        /**
         * Moves the cursor to position indicated by the parameters. Negative numbers move the cursor backwards in the document.
         * @param rows The number of rows to move by
         * @param chars The number of characters to move by
        **/
        moveCursorBy(rows: number, chars: number): void;

        /**
         * Moves the selection to the position indicated by its `row` and `column`.
         * @param position The position to move to
        **/
        moveCursorToPosition(position: any): void;

        /**
         * Moves the cursor to the row and column provided. [If `preventUpdateDesiredColumn` is `true`, then the cursor stays in the same column position as its original point.]{: #preventUpdateBoolDesc}
         * @param row The row to move to
         * @param column The column to move to
         * @param keepDesiredColumn [If `true`, the cursor move does not respect the previous column]{: #preventUpdateBool}
        **/
        moveCursorTo(row: number, column: number, keepDesiredColumn?: boolean): void;

        /**
         * Moves the cursor to the screen position indicated by row and column. {:preventUpdateBoolDesc}
         * @param row The row to move to
         * @param column The column to move to
         * @param keepDesiredColumn {:preventUpdateBool}
        **/
        moveCursorToScreen(row: number, column: number, keepDesiredColumn: boolean): void;
    }
    var Selection: {
        /**
         * Creates a new `Selection` object.
         * @param session The session to use
        **/
        new(session: IEditSession): Selection;
    }

    ////////////////
    /// Split
    ////////////////

    export interface Split {

        /**
         * Returns the number of splits.
        **/
        getSplits(): number;

        /**
         * Returns the editor identified by the index `idx`.
         * @param idx The index of the editor you want
        **/
        getEditor(idx: number): void;

        /**
         * Returns the current editor.
        **/
        getCurrentEditor(): Editor;

        /**
         * Focuses the current editor.
        **/
        focus(): void;

        /**
         * Blurs the current editor.
        **/
        blur(): void;

        /**
         * Sets a theme for each of the available editors.
         * @param theme The name of the theme to set
        **/
        setTheme(theme: string): void;

        /**
         * Sets the keyboard handler for the editor.
         * @param keybinding
        **/
        setKeyboardHandler(keybinding: string): void;

        /**
         * Executes `callback` on all of the available editors.
         * @param callback A callback function to execute
         * @param scope The default scope for the callback
        **/
        forEach(callback: Function, scope: string): void;

        /**
         * Sets the font size, in pixels, for all the available editors.
         * @param size The new font size
        **/
        setFontSize(size: number): void;

        /**
         * Sets a new [[EditSession `EditSession`]] for the indicated editor.
         * @param session The new edit session
         * @param idx The editor's index you're interested in
        **/
        setSession(session: IEditSession, idx: number): void;

        /**
         * Returns the orientation.
        **/
        getOrientation(): number;

        /**
         * Sets the orientation.
         * @param orientation The new orientation value
        **/
        setOrientation(orientation: number): void;

        /**
         * Resizes the editor.
        **/
        resize(): void;
    }
    var Split: {
        new(): Split;
    }

    //////////////////
    /// TokenIterator
    //////////////////

    /**
     * This class provides an essay way to treat the document as a stream of tokens, and provides methods to iterate over these tokens.
    **/
    export interface TokenIterator {

        /**
         * Tokenizes all the items from the current point to the row prior in the document.
        **/
        stepBackward(): string[];

        /**
         * Tokenizes all the items from the current point until the next row in the document. If the current point is at the end of the file, this function returns `null`. Otherwise, it returns the tokenized string.
        **/
        stepForward(): string;

        /**
         * Returns the current tokenized string.
        **/
        getCurrentToken(): TokenInfo;

        /**
         * Returns the current row.
        **/
        getCurrentTokenRow(): number;

        /**
         * Returns the current column.
        **/
        getCurrentTokenColumn(): number;
    }
    var TokenIterator: {
        /**
         * Creates a new token iterator object. The inital token index is set to the provided row and column coordinates.
         * @param session The session to associate with
         * @param initialRow The row to start the tokenizing at
         * @param initialColumn The column to start the tokenizing at
        **/
        new(session: IEditSession, initialRow: number, initialColumn: number): TokenIterator;
    }

    //////////////////
    /// Tokenizer
    //////////////////


    /**
     * This class takes a set of highlighting rules, and creates a tokenizer out of them. For more information, see [the wiki on extending highlighters](https://github.com/ajaxorg/ace/wiki/Creating-or-Extending-an-Edit-Mode#wiki-extendingTheHighlighter).
    **/
    export interface Tokenizer {

        /**
         * Returns an object containing two properties: `tokens`, which contains all the tokens; and `state`, the current state.
        **/
        getLineTokens(): any;
    }
    var Tokenizer: {
        /**
         * Constructs a new tokenizer based on the given rules and flags.
         * @param rules The highlighting rules
         * @param flag Any additional regular expression flags to pass (like "i" for case insensitive)
        **/
        new(rules: any, flag: string): Tokenizer;
    }

    //////////////////
    /// UndoManager
    //////////////////

    /**
     * This object maintains the undo stack for an [[EditSession `EditSession`]].
    **/
    export interface UndoManager {

        /**
         * Provides a means for implementing your own undo manager. `options` has one property, `args`, an [[Array `Array`]], with two elements:
         * - `args[0]` is an array of deltas
         * - `args[1]` is the document to associate with
         * @param options Contains additional properties
        **/
        execute(options: any): void;

        /**
         * [Perform an undo operation on the document, reverting the last change.]{: #UndoManager.undo}
         * @param dontSelect {:dontSelect}
        **/
        undo(dontSelect?: boolean): Range;

        /**
         * [Perform a redo operation on the document, reimplementing the last change.]{: #UndoManager.redo}
         * @param dontSelect {:dontSelect}
        **/
        redo(dontSelect: boolean): void;

        /**
         * Destroys the stack of undo and redo redo operations.
        **/
        reset(): void;

        /**
         * Returns `true` if there are undo operations left to perform.
        **/
        hasUndo(): boolean;

        /**
         * Returns `true` if there are redo operations left to perform.
        **/
        hasRedo(): boolean;

        /**
         * Returns `true` if the dirty counter is 0
        **/
        isClean(): boolean;

        /**
         * Sets dirty counter to 0
        **/
        markClean(): void;

    }
    var UndoManager: {
        /**
         * Resets the current undo state and creates a new `UndoManager`.
        **/
        new(): UndoManager;
    }

    ////////////////////
    /// VirtualRenderer
    ////////////////////

    /**
     * The class that is responsible for drawing everything you see on the screen!
    **/
    export interface VirtualRenderer {

        scroller: any;

        characterWidth: number;

        lineHeight: number;

        setScrollMargin(top:number, bottom:number, left: number, right: number): void;

        screenToTextCoordinates(left: number, top: number): void;

        /**
         * Associates the renderer with an [[EditSession `EditSession`]].
        **/
        setSession(session: IEditSession): void;

        /**
         * Triggers a partial update of the text, from the range given by the two parameters.
         * @param firstRow The first row to update
         * @param lastRow The last row to update
        **/
        updateLines(firstRow: number, lastRow: number): void;

        /**
         * Triggers a full update of the text, for all the rows.
        **/
        updateText(): void;

        /**
         * Triggers a full update of all the layers, for all the rows.
         * @param force If `true`, forces the changes through
        **/
        updateFull(force: boolean): void;

        /**
         * Updates the font size.
        **/
        updateFontSize(): void;

        /**
         * [Triggers a resize of the editor.]{: #VirtualRenderer.onResize}
         * @param force If `true`, recomputes the size, even if the height and width haven't changed
         * @param gutterWidth The width of the gutter in pixels
         * @param width The width of the editor in pixels
         * @param height The hiehgt of the editor, in pixels
        **/
        onResize(force: boolean, gutterWidth: number, width: number, height: number): void;

        /**
         * Adjusts the wrap limit, which is the number of characters that can fit within the width of the edit area on screen.
        **/
        adjustWrapLimit(): void;

        /**
         * Identifies whether you want to have an animated scroll or not.
         * @param shouldAnimate Set to `true` to show animated scrolls
        **/
        setAnimatedScroll(shouldAnimate: boolean): void;

        /**
         * Returns whether an animated scroll happens or not.
        **/
        getAnimatedScroll(): boolean;

        /**
         * Identifies whether you want to show invisible characters or not.
         * @param showInvisibles Set to `true` to show invisibles
        **/
        setShowInvisibles(showInvisibles: boolean): void;

        /**
         * Returns whether invisible characters are being shown or not.
        **/
        getShowInvisibles(): boolean;

        /**
         * Identifies whether you want to show the print margin or not.
         * @param showPrintMargin Set to `true` to show the print margin
        **/
        setShowPrintMargin(showPrintMargin: boolean): void;

        /**
         * Returns whether the print margin is being shown or not.
        **/
        getShowPrintMargin(): boolean;

        /**
         * Identifies whether you want to show the print margin column or not.
         * @param showPrintMargin Set to `true` to show the print margin column
        **/
        setPrintMarginColumn(showPrintMargin: boolean): void;

        /**
         * Returns whether the print margin column is being shown or not.
        **/
        getPrintMarginColumn(): boolean;

        /**
         * Returns `true` if the gutter is being shown.
        **/
        getShowGutter(): boolean;

        /**
         * Identifies whether you want to show the gutter or not.
         * @param show Set to `true` to show the gutter
        **/
        setShowGutter(show: boolean): void;

        /**
         * Returns the root element containing this renderer.
        **/
        getContainerElement(): HTMLElement;

        /**
         * Returns the element that the mouse events are attached to
        **/
        getMouseEventTarget(): HTMLElement;

        /**
         * Returns the element to which the hidden text area is added.
        **/
        getTextAreaContainer(): HTMLElement;

        /**
         * [Returns the index of the first visible row.]{: #VirtualRenderer.getFirstVisibleRow}
        **/
        getFirstVisibleRow(): number;

        /**
         * Returns the index of the first fully visible row. "Fully" here means that the characters in the row are not truncated; that the top and the bottom of the row are on the screen.
        **/
        getFirstFullyVisibleRow(): number;

        /**
         * Returns the index of the last fully visible row. "Fully" here means that the characters in the row are not truncated; that the top and the bottom of the row are on the screen.
        **/
        getLastFullyVisibleRow(): number;

        /**
         * [Returns the index of the last visible row.]{: #VirtualRenderer.getLastVisibleRow}
        **/
        getLastVisibleRow(): number;

        /**
         * Sets the padding for all the layers.
         * @param padding A new padding value (in pixels)
        **/
        setPadding(padding: number): void;

        /**
         * Returns whether the horizontal scrollbar is set to be always visible.
        **/
        getHScrollBarAlwaysVisible(): boolean;

        /**
         * Identifies whether you want to show the horizontal scrollbar or not.
         * @param alwaysVisible Set to `true` to make the horizontal scroll bar visible
        **/
        setHScrollBarAlwaysVisible(alwaysVisible: boolean): void;

        /**
         * Schedules an update to all the front markers in the document.
        **/
        updateFrontMarkers(): void;

        /**
         * Schedules an update to all the back markers in the document.
        **/
        updateBackMarkers(): void;

        /**
         * Deprecated; (moved to [[EditSession]])
        **/
        addGutterDecoration(): void;

        /**
         * Deprecated; (moved to [[EditSession]])
        **/
        removeGutterDecoration(): void;

        /**
         * Redraw breakpoints.
        **/
        updateBreakpoints(): void;

        /**
         * Sets annotations for the gutter.
         * @param annotations An array containing annotations
        **/
        setAnnotations(annotations: any[]): void;

        /**
         * Updates the cursor icon.
        **/
        updateCursor(): void;

        /**
         * Hides the cursor icon.
        **/
        hideCursor(): void;

        /**
         * Shows the cursor icon.
        **/
        showCursor(): void;

        /**
         * Scrolls the cursor into the first visibile area of the editor
        **/
        scrollCursorIntoView(): void;

        /**
         * {:EditSession.getScrollTop}
        **/
        getScrollTop(): number;

        /**
         * {:EditSession.getScrollLeft}
        **/
        getScrollLeft(): number;

        /**
         * Returns the first visible row, regardless of whether it's fully visible or not.
        **/
        getScrollTopRow(): number;

        /**
         * Returns the last visible row, regardless of whether it's fully visible or not.
        **/
        getScrollBottomRow(): number;

        /**
         * Gracefully scrolls from the top of the editor to the row indicated.
         * @param row A row id
        **/
        scrollToRow(row: number): void;

        /**
         * Gracefully scrolls the editor to the row indicated.
         * @param line A line number
         * @param center If `true`, centers the editor the to indicated line
         * @param animate If `true` animates scrolling
         * @param callback Function to be called after the animation has finished
        **/
        scrollToLine(line: number, center: boolean, animate: boolean, callback: Function): void;

        /**
         * Scrolls the editor to the y pixel indicated.
         * @param scrollTop The position to scroll to
        **/
        scrollToY(scrollTop: number): number;

        /**
         * Scrolls the editor across the x-axis to the pixel indicated.
         * @param scrollLeft The position to scroll to
        **/
        scrollToX(scrollLeft: number): number;

        /**
         * Scrolls the editor across both x- and y-axes.
         * @param deltaX The x value to scroll by
         * @param deltaY The y value to scroll by
        **/
        scrollBy(deltaX: number, deltaY: number): void;

        /**
         * Returns `true` if you can still scroll by either parameter; in other words, you haven't reached the end of the file or line.
         * @param deltaX The x value to scroll by
         * @param deltaY The y value to scroll by
        **/
        isScrollableBy(deltaX: number, deltaY: number): boolean;

        /**
         * Returns an object containing the `pageX` and `pageY` coordinates of the document position.
         * @param row The document row position
         * @param column The document column position
        **/
        textToScreenCoordinates(row: number, column: number): any;

        /**
         * Focuses the current container.
        **/
        visualizeFocus(): void;

        /**
         * Blurs the current container.
        **/
        visualizeBlur(): void;

        /**
         * undefined
         * @param position
        **/
        showComposition(position: number): void;

        /**
         * Sets the inner text of the current composition to `text`.
         * @param text A string of text to use
        **/
        setCompositionText(text: string): void;

        /**
         * Hides the current composition.
        **/
        hideComposition(): void;

        /**
         * [Sets a new theme for the editor. `theme` should exist, and be a directory path, like `ace/theme/textmate`.]{: #VirtualRenderer.setTheme}
         * @param theme The path to a theme
        **/
        setTheme(theme: string): void;

        /**
         * [Returns the path of the current theme.]{: #VirtualRenderer.getTheme}
        **/
        getTheme(): string;

        /**
         * [Adds a new class, `style`, to the editor.]{: #VirtualRenderer.setStyle}
         * @param style A class name
        **/
        setStyle(style: string): void;

        /**
         * [Removes the class `style` from the editor.]{: #VirtualRenderer.unsetStyle}
         * @param style A class name
        **/
        unsetStyle(style: string): void;

        /**
         * Destroys the text and cursor layers for this renderer.
        **/
        destroy(): void;

    }
    var VirtualRenderer: {
        /**
         * Constructs a new `VirtualRenderer` within the `container` specified, applying the given `theme`.
         * @param container The root element of the editor
         * @param theme The starting theme
        **/
        new(container: HTMLElement, theme?: string): VirtualRenderer;
    }
}

export = AceAjax;
