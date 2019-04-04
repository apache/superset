// Type definitions for react-ace 4.1.3
// Project: https://github.com/securingsincity/react-ace
// Definitions by: Alberto Nicoletti <https://github.com/illbexyz>

import { Component } from 'react'

export interface Annotation {
    row: number
    column: number
    type: string
    text: string
}

export interface Marker {
    startRow: number
    startCol: number
    endRow: number
    endCol: number
    className: string
    type: string
}

export interface CommandBindKey {
    win: string
    mac: string
}

export interface Command {
    name: string
    bindKey: CommandBindKey
    exec(): any
}

/**
 * See https://github.com/ajaxorg/ace/wiki/Configuring-Ace
 */
export interface AceOptions {
    selectionStyle?: "line" | "text"
    highlightActiveLine?: boolean
    highlightSelectedWord?: boolean
    readOnly?: boolean
    cursorStyle?: "ace"|"slim"|"smooth"|"wide"
    mergeUndoDeltas?: false | true | "always"
    behavioursEnabled?: boolean
    wrapBehavioursEnabled?: boolean
    /** this is needed if editor is inside scrollable page */
    autoScrollEditorIntoView?: boolean
    hScrollBarAlwaysVisible?: boolean
    vScrollBarAlwaysVisible?: boolean
    highlightGutterLine?: boolean
    animatedScroll?: boolean
    showInvisibles?: boolean
    showPrintMargin?: boolean
    printMarginColumn?: boolean
    printMargin?: boolean
    fadeFoldWidgets?: boolean
    showFoldWidgets?: boolean
    showLineNumbers?: boolean
    showGutter?: boolean
    displayIndentGuides?: boolean
    /** number or css font-size string */
    fontSize?: number | string
    /** css */
    fontFamily?: string
    maxLines?: number
    minLines?: number
    scrollPastEnd?: boolean
    fixedWidthGutter?: boolean
    /** path to a theme e.g "ace/theme/textmate" */
    theme?: string
    scrollSpeed?: number
    dragDelay?:  number
    dragEnabled?: boolean
    focusTimout?: number
    tooltipFollowsMouse?: boolean
    firstLineNumber?: number
    overwrite?: boolean
    newLineMode?: boolean
    useWorker?: boolean
    useSoftTabs?: boolean
    tabSize?: number
    wrap?: boolean
    foldStyle?: boolean
    /** path to a mode e.g "ace/mode/text" */
    mode?: string
    /** on by default */
    enableMultiselect?: boolean
    enableEmmet?: boolean
    enableBasicAutocompletion?: boolean
    enableLiveAutocompletion?:  boolean
    enableSnippets?: boolean
    spellcheck?: boolean
    useElasticTabstops?: boolean
}

export interface EditorProps {
    $blockScrolling?: number | boolean
    $blockSelectEnabled?: boolean
    $enableBlockSelect?: boolean
    $enableMultiselect?: boolean
    $highlightPending?: boolean
    $highlightTagPending?: boolean
    $multiselectOnSessionChange?: (...args: any[]) => any
    $onAddRange?: (...args: any[]) => any
    $onChangeAnnotation?: (...args: any[]) => any
    $onChangeBackMarker?: (...args: any[]) => any
    $onChangeBreakpoint?: (...args: any[]) => any
    $onChangeFold?: (...args: any[]) => any
    $onChangeFrontMarker?: (...args: any[]) => any
    $onChangeMode?: (...args: any[]) => any
    $onChangeTabSize?: (...args: any[]) => any
    $onChangeWrapLimit?: (...args: any[]) => any
    $onChangeWrapMode?: (...args: any[]) => any
    $onCursorChange?: (...args: any[]) => any
    $onDocumentChange?: (...args: any[]) => any
    $onMultiSelect?: (...args: any[]) => any
    $onRemoveRange?: (...args: any[]) => any
    $onScrollLeftChange?: (...args: any[]) => any
    $onScrollTopChange?: (...args: any[]) => any
    $onSelectionChange?: (...args: any[]) => any
    $onSingleSelect?: (...args: any[]) => any
    $onTokenizerUpdate?: (...args: any[]) => any
}

export interface AceEditorProps {
    name?: string
    /** For available modes see https://github.com/thlorenz/brace/tree/master/mode */
    mode?: string
    /** For available themes see https://github.com/thlorenz/brace/tree/master/theme */
    theme?: string
    height?: string
    width?: string
    className?: string
    fontSize?: number
    showGutter?: boolean
    showPrintMargin?: boolean
    highlightActiveLine?: boolean
    focus?: boolean
    cursorStart?: number
    wrapEnabled?: boolean
    readOnly?: boolean
    minLines?: number
    maxLines?: number
    enableBasicAutocompletion?: boolean
    enableLiveAutocompletion?: boolean
    tabSize?: number
    value?: string
    defaultValue?: string
    scrollMargin?: number[]
    onLoad?: (editor: EditorProps) => void
    onBeforeLoad?: (ace: any) => void
    onChange?: (value: string, event?: any) => void
    onSelection?: (selectedText: string, event?: any) => void
    onCopy?: (value: string) => void
    onPaste?: (value: string) => void
    onFocus?: (event: any) => void
    onBlur?: (event: any) => void
    onValidate?: (annotations: Array<Annotation>) => void
    onScroll?: (editor: EditorProps) => void
    editorProps?: EditorProps
    setOptions?: AceOptions
    keyboardHandler?: string
    commands?: Array<Command>
    annotations?: Array<Annotation>
    markers?: Array<Marker>
}

export default class AceEditor extends Component<AceEditorProps, {}> {}
