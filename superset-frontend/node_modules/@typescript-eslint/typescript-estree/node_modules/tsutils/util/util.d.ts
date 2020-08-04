import * as ts from 'typescript';
import { NodeWrap } from './convert-ast';
export declare function getChildOfKind<T extends ts.SyntaxKind>(node: ts.Node, kind: T, sourceFile?: ts.SourceFile): ts.Token<T> | undefined;
export declare function isTokenKind(kind: ts.SyntaxKind): boolean;
export declare function isNodeKind(kind: ts.SyntaxKind): boolean;
export declare function isAssignmentKind(kind: ts.SyntaxKind): boolean;
export declare function isTypeNodeKind(kind: ts.SyntaxKind): boolean;
export declare function isJsDocKind(kind: ts.SyntaxKind): boolean;
export declare function isKeywordKind(kind: ts.SyntaxKind): boolean;
export declare function isThisParameter(parameter: ts.ParameterDeclaration): boolean;
export declare function getModifier(node: ts.Node, kind: ts.Modifier['kind']): ts.Modifier | undefined;
export declare function hasModifier(modifiers: ts.ModifiersArray | undefined, ...kinds: Array<ts.Modifier['kind']>): boolean;
export declare function isParameterProperty(node: ts.ParameterDeclaration): boolean;
export declare function hasAccessModifier(node: ts.ClassElement | ts.ParameterDeclaration): boolean;
export declare const isNodeFlagSet: (node: ts.Node, flag: ts.NodeFlags) => boolean;
export declare const isTypeFlagSet: (type: ts.Type, flag: ts.TypeFlags) => boolean;
export declare const isSymbolFlagSet: (symbol: ts.Symbol, flag: ts.SymbolFlags) => boolean;
export declare function isObjectFlagSet(objectType: ts.ObjectType, flag: ts.ObjectFlags): boolean;
export declare function isModifierFlagSet(node: ts.Node, flag: ts.ModifierFlags): boolean;
export declare function getPreviousStatement(statement: ts.Statement): ts.Statement | undefined;
export declare function getNextStatement(statement: ts.Statement): ts.Statement | undefined;
export declare function getPreviousToken(node: ts.Node, sourceFile?: ts.SourceFile): ts.Node | undefined;
export declare function getNextToken(node: ts.Node, sourceFile?: ts.SourceFile): ts.Node | undefined;
export declare function getTokenAtPosition(parent: ts.Node, pos: number, sourceFile?: ts.SourceFile, allowJsDoc?: boolean): ts.Node | undefined;
export declare function getCommentAtPosition(sourceFile: ts.SourceFile, pos: number, parent?: ts.Node): ts.CommentRange | undefined;
export declare function isPositionInComment(sourceFile: ts.SourceFile, pos: number, parent?: ts.Node): boolean;
export declare function commentText(sourceText: string, comment: ts.CommentRange): string;
export declare function getWrappedNodeAtPosition(wrap: NodeWrap, pos: number): NodeWrap | undefined;
export declare function getPropertyName(propertyName: ts.PropertyName): string | undefined;
export declare function forEachDestructuringIdentifier<T>(pattern: ts.BindingPattern, fn: (element: ts.BindingElement & {
    name: ts.Identifier;
}) => T): T | undefined;
export declare function forEachDeclaredVariable<T>(declarationList: ts.VariableDeclarationList, cb: (element: (ts.VariableDeclaration | ts.BindingElement) & {
    name: ts.Identifier;
}) => T): T | undefined;
export declare enum VariableDeclarationKind {
    Var = 0,
    Let = 1,
    Const = 2
}
export declare function getVariableDeclarationKind(declarationList: ts.VariableDeclarationList): VariableDeclarationKind;
export declare function isBlockScopedVariableDeclarationList(declarationList: ts.VariableDeclarationList): boolean;
export declare function isBlockScopedVariableDeclaration(declaration: ts.VariableDeclaration): boolean;
export declare function isBlockScopedDeclarationStatement(statement: ts.Statement): statement is ts.DeclarationStatement;
export declare function isInSingleStatementContext(statement: ts.Statement): boolean;
export declare enum ScopeBoundary {
    None = 0,
    Function = 1,
    Block = 2,
    Type = 4,
    ConditionalType = 8
}
export declare enum ScopeBoundarySelector {
    Function = 1,
    Block = 3,
    Type = 7,
    InferType = 8
}
export declare function isScopeBoundary(node: ts.Node): ScopeBoundary;
export declare function isTypeScopeBoundary(node: ts.Node): ScopeBoundary;
export declare function isFunctionScopeBoundary(node: ts.Node): ScopeBoundary;
export declare function isBlockScopeBoundary(node: ts.Node): ScopeBoundary;
export declare function hasOwnThisReference(node: ts.Node): boolean;
export declare function isFunctionWithBody(node: ts.Node): node is ts.FunctionLikeDeclaration & {
    body: {};
};
export declare function forEachToken(node: ts.Node, cb: (node: ts.Node) => void, sourceFile?: ts.SourceFile): void;
export declare type ForEachTokenCallback = (fullText: string, kind: ts.SyntaxKind, range: ts.TextRange, parent: ts.Node) => void;
export declare function forEachTokenWithTrivia(node: ts.Node, cb: ForEachTokenCallback, sourceFile?: ts.SourceFile): void;
export declare type ForEachCommentCallback = (fullText: string, comment: ts.CommentRange) => void;
export declare function forEachComment(node: ts.Node, cb: ForEachCommentCallback, sourceFile?: ts.SourceFile): void;
export interface LineRange extends ts.TextRange {
    contentLength: number;
}
export declare function getLineRanges(sourceFile: ts.SourceFile): LineRange[];
export declare function getLineBreakStyle(sourceFile: ts.SourceFile): "\n" | "\r\n";
export declare function isValidIdentifier(text: string, languageVersion?: ts.ScriptTarget): boolean;
export declare function isValidPropertyAccess(text: string, languageVersion?: ts.ScriptTarget): boolean;
export declare function isValidPropertyName(text: string, languageVersion?: ts.ScriptTarget): boolean;
export declare function isValidNumericLiteral(text: string, languageVersion?: ts.ScriptTarget): boolean;
export declare function isValidJsxIdentifier(text: string, languageVersion?: ts.ScriptTarget): boolean;
export declare function isNumericPropertyName(name: string | ts.__String): boolean;
export declare function isSameLine(sourceFile: ts.SourceFile, pos1: number, pos2: number): boolean;
export declare enum SideEffectOptions {
    None = 0,
    TaggedTemplate = 1,
    Constructor = 2,
    JsxElement = 4
}
export declare function hasSideEffects(node: ts.Expression, options?: SideEffectOptions): boolean;
export declare function getDeclarationOfBindingElement(node: ts.BindingElement): ts.VariableDeclaration | ts.ParameterDeclaration;
export declare function isExpressionValueUsed(node: ts.Expression): boolean;
export declare enum AccessKind {
    None = 0,
    Read = 1,
    Write = 2,
    Delete = 4,
    ReadWrite = 3,
    Modification = 6
}
export declare function getAccessKind(node: ts.Node): AccessKind;
export declare function isReassignmentTarget(node: ts.Expression): boolean;
export declare function canHaveJsDoc(node: ts.Node): node is ts.HasJSDoc;
export declare function getJsDoc(node: ts.Node, sourceFile?: ts.SourceFile): ts.JSDoc[];
export declare function parseJsDocOfNode(node: ts.Node, considerTrailingComments?: boolean, sourceFile?: ts.SourceFile): ts.JSDoc[];
export declare enum ImportKind {
    ImportDeclaration = 1,
    ImportEquals = 2,
    ExportFrom = 4,
    DynamicImport = 8,
    Require = 16,
    ImportType = 32,
    All = 63,
    AllImports = 59,
    AllStaticImports = 3,
    AllImportExpressions = 24,
    AllRequireLike = 18
}
export declare function findImports(sourceFile: ts.SourceFile, kinds: ImportKind): (ts.StringLiteral | ts.NoSubstitutionTemplateLiteral)[];
export declare type ImportLike = ts.ImportDeclaration | (ts.ImportEqualsDeclaration & {
    moduleReference: ts.ExternalModuleReference;
}) | (ts.ExportDeclaration & {
    moduleSpecifier: {};
}) | (ts.CallExpression & {
    expression: ts.Token<ts.SyntaxKind.ImportKeyword> | (ts.Identifier & {
        text: 'require';
    });
    arguments: [ts.Expression];
}) | ts.ImportTypeNode;
export declare function findImportLikeNodes(sourceFile: ts.SourceFile, kinds: ImportKind): ImportLike[];
export declare function isStatementInAmbientContext(node: ts.Statement): boolean;
export declare function isAmbientModuleBlock(node: ts.Node): node is ts.ModuleBlock;
export declare function getIIFE(func: ts.FunctionExpression | ts.ArrowFunction): ts.CallExpression | undefined;
export declare type StrictCompilerOption = 'noImplicitAny' | 'noImplicitThis' | 'strictNullChecks' | 'strictFunctionTypes' | 'strictPropertyInitialization' | 'alwaysStrict' | 'strictBindCallApply';
export declare function isStrictCompilerOptionEnabled(options: ts.CompilerOptions, option: StrictCompilerOption): boolean;
export declare type BooleanCompilerOptions = {
    [K in keyof ts.CompilerOptions]: NonNullable<ts.CompilerOptions[K]> extends boolean ? K : never;
} extends {
    [_ in keyof ts.CompilerOptions]: infer U;
} ? U : never;
export declare function isCompilerOptionEnabled(options: ts.CompilerOptions, option: BooleanCompilerOptions | 'stripInternal'): boolean;
export declare function isAmbientModule(node: ts.ModuleDeclaration): boolean;
export declare function getCheckJsDirective(source: string): ts.CheckJsDirective | undefined;
export declare function isConstAssertion(node: ts.AssertionExpression): boolean;
export declare function isInConstContext(node: ts.Expression): boolean;
export declare function isReadonlyAssignmentDeclaration(node: ts.CallExpression, checker: ts.TypeChecker): boolean;
export declare function isBindableObjectDefinePropertyCall(node: ts.CallExpression): boolean;
export interface WellKnownSymbolLiteral extends ts.PropertyAccessExpression {
    expression: ts.Identifier & {
        text: 'Symbol';
        escapedText: 'symbol';
    };
}
export declare function isWellKnownSymbolLiterally(node: ts.Expression): node is WellKnownSymbolLiteral;
export interface PropertyName {
    displayName: string;
    symbolName: ts.__String;
}
export declare function getPropertyNameOfWellKnownSymbol(node: WellKnownSymbolLiteral): PropertyName;
export interface LateBoundPropertyNames {
    known: boolean;
    names: PropertyName[];
}
export declare function getLateBoundPropertyNames(node: ts.Expression, checker: ts.TypeChecker): LateBoundPropertyNames;
export declare function getLateBoundPropertyNamesOfPropertyName(node: ts.PropertyName, checker: ts.TypeChecker): LateBoundPropertyNames;
export declare function getSingleLateBoundPropertyNameOfPropertyName(node: ts.PropertyName, checker: ts.TypeChecker): PropertyName | undefined;
export declare function unwrapParentheses(node: ts.Expression): ts.Expression;
