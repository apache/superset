"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ts = require("typescript");
const node_1 = require("../typeguard/node");
const _3_2_1 = require("../typeguard/3.2");
const type_1 = require("./type");
function getChildOfKind(node, kind, sourceFile) {
    for (const child of node.getChildren(sourceFile))
        if (child.kind === kind)
            return child;
}
exports.getChildOfKind = getChildOfKind;
function isTokenKind(kind) {
    return kind >= ts.SyntaxKind.FirstToken && kind <= ts.SyntaxKind.LastToken;
}
exports.isTokenKind = isTokenKind;
function isNodeKind(kind) {
    return kind >= ts.SyntaxKind.FirstNode;
}
exports.isNodeKind = isNodeKind;
function isAssignmentKind(kind) {
    return kind >= ts.SyntaxKind.FirstAssignment && kind <= ts.SyntaxKind.LastAssignment;
}
exports.isAssignmentKind = isAssignmentKind;
function isTypeNodeKind(kind) {
    return kind >= ts.SyntaxKind.FirstTypeNode && kind <= ts.SyntaxKind.LastTypeNode;
}
exports.isTypeNodeKind = isTypeNodeKind;
function isJsDocKind(kind) {
    return kind >= ts.SyntaxKind.FirstJSDocNode && kind <= ts.SyntaxKind.LastJSDocNode;
}
exports.isJsDocKind = isJsDocKind;
function isKeywordKind(kind) {
    return kind >= ts.SyntaxKind.FirstKeyword && kind <= ts.SyntaxKind.LastKeyword;
}
exports.isKeywordKind = isKeywordKind;
function isThisParameter(parameter) {
    return parameter.name.kind === ts.SyntaxKind.Identifier && parameter.name.originalKeywordKind === ts.SyntaxKind.ThisKeyword;
}
exports.isThisParameter = isThisParameter;
function getModifier(node, kind) {
    if (node.modifiers !== undefined)
        for (const modifier of node.modifiers)
            if (modifier.kind === kind)
                return modifier;
}
exports.getModifier = getModifier;
function hasModifier(modifiers, ...kinds) {
    if (modifiers === undefined)
        return false;
    for (const modifier of modifiers)
        if (kinds.includes(modifier.kind))
            return true;
    return false;
}
exports.hasModifier = hasModifier;
function isParameterProperty(node) {
    return hasModifier(node.modifiers, ts.SyntaxKind.PublicKeyword, ts.SyntaxKind.ProtectedKeyword, ts.SyntaxKind.PrivateKeyword, ts.SyntaxKind.ReadonlyKeyword);
}
exports.isParameterProperty = isParameterProperty;
function hasAccessModifier(node) {
    return hasModifier(node.modifiers, ts.SyntaxKind.PublicKeyword, ts.SyntaxKind.ProtectedKeyword, ts.SyntaxKind.PrivateKeyword);
}
exports.hasAccessModifier = hasAccessModifier;
function isFlagSet(obj, flag) {
    return (obj.flags & flag) !== 0;
}
exports.isNodeFlagSet = isFlagSet;
exports.isTypeFlagSet = isFlagSet;
exports.isSymbolFlagSet = isFlagSet;
function isObjectFlagSet(objectType, flag) {
    return (objectType.objectFlags & flag) !== 0;
}
exports.isObjectFlagSet = isObjectFlagSet;
function isModifierFlagSet(node, flag) {
    return (ts.getCombinedModifierFlags(node) & flag) !== 0;
}
exports.isModifierFlagSet = isModifierFlagSet;
function getPreviousStatement(statement) {
    const parent = statement.parent;
    if (node_1.isBlockLike(parent)) {
        const index = parent.statements.indexOf(statement);
        if (index > 0)
            return parent.statements[index - 1];
    }
}
exports.getPreviousStatement = getPreviousStatement;
function getNextStatement(statement) {
    const parent = statement.parent;
    if (node_1.isBlockLike(parent)) {
        const index = parent.statements.indexOf(statement);
        if (index < parent.statements.length)
            return parent.statements[index + 1];
    }
}
exports.getNextStatement = getNextStatement;
function getPreviousToken(node, sourceFile) {
    let parent = node.parent;
    while (parent !== undefined && parent.pos === node.pos)
        parent = parent.parent;
    if (parent === undefined)
        return;
    outer: while (true) {
        const children = parent.getChildren(sourceFile);
        for (let i = children.length - 1; i >= 0; --i) {
            const child = children[i];
            if (child.pos < node.pos && child.kind !== ts.SyntaxKind.JSDocComment) {
                if (isTokenKind(child.kind))
                    return child;
                parent = child;
                continue outer;
            }
        }
        return;
    }
}
exports.getPreviousToken = getPreviousToken;
function getNextToken(node, sourceFile = node.getSourceFile()) {
    if (node.kind === ts.SyntaxKind.SourceFile || node.kind === ts.SyntaxKind.EndOfFileToken)
        return;
    const end = node.end;
    node = node.parent;
    while (node.end === end) {
        if (node.parent === undefined)
            return node.endOfFileToken;
        node = node.parent;
    }
    return getTokenAtPositionWorker(node, end, sourceFile, false);
}
exports.getNextToken = getNextToken;
function getTokenAtPosition(parent, pos, sourceFile, allowJsDoc) {
    if (pos < parent.pos || pos >= parent.end)
        return;
    if (isTokenKind(parent.kind))
        return parent;
    if (sourceFile === undefined)
        sourceFile = parent.getSourceFile();
    return getTokenAtPositionWorker(parent, pos, sourceFile, allowJsDoc === true);
}
exports.getTokenAtPosition = getTokenAtPosition;
function getTokenAtPositionWorker(node, pos, sourceFile, allowJsDoc) {
    outer: while (true) {
        for (const child of node.getChildren(sourceFile)) {
            if (child.end > pos && (allowJsDoc || child.kind !== ts.SyntaxKind.JSDocComment)) {
                if (isTokenKind(child.kind))
                    return child;
                node = child;
                continue outer;
            }
        }
        return;
    }
}
function getCommentAtPosition(sourceFile, pos, parent = sourceFile) {
    const token = getTokenAtPosition(parent, pos, sourceFile);
    if (token === undefined || token.kind === ts.SyntaxKind.JsxText || pos >= token.end - (ts.tokenToString(token.kind) || '').length)
        return;
    const startPos = token.pos === 0
        ? (ts.getShebang(sourceFile.text) || '').length
        : token.pos;
    return startPos !== 0 && ts.forEachTrailingCommentRange(sourceFile.text, startPos, commentAtPositionCallback, pos) ||
        ts.forEachLeadingCommentRange(sourceFile.text, startPos, commentAtPositionCallback, pos);
}
exports.getCommentAtPosition = getCommentAtPosition;
function commentAtPositionCallback(pos, end, kind, _nl, at) {
    return at >= pos && at < end ? { pos, end, kind } : undefined;
}
function isPositionInComment(sourceFile, pos, parent) {
    return getCommentAtPosition(sourceFile, pos, parent) !== undefined;
}
exports.isPositionInComment = isPositionInComment;
function commentText(sourceText, comment) {
    return sourceText.substring(comment.pos + 2, comment.kind === ts.SyntaxKind.SingleLineCommentTrivia ? comment.end : comment.end - 2);
}
exports.commentText = commentText;
function getWrappedNodeAtPosition(wrap, pos) {
    if (wrap.node.pos > pos || wrap.node.end <= pos)
        return;
    outer: while (true) {
        for (const child of wrap.children) {
            if (child.node.pos > pos)
                return wrap;
            if (child.node.end > pos) {
                wrap = child;
                continue outer;
            }
        }
        return wrap;
    }
}
exports.getWrappedNodeAtPosition = getWrappedNodeAtPosition;
function getPropertyName(propertyName) {
    if (propertyName.kind === ts.SyntaxKind.ComputedPropertyName) {
        if (!node_1.isLiteralExpression(propertyName.expression))
            return;
        if (_3_2_1.isBigIntLiteral(propertyName.expression))
            return propertyName.expression.text.slice(0, -1);
        return propertyName.expression.text;
    }
    return propertyName.text;
}
exports.getPropertyName = getPropertyName;
function forEachDestructuringIdentifier(pattern, fn) {
    for (const element of pattern.elements) {
        if (element.kind !== ts.SyntaxKind.BindingElement)
            continue;
        let result;
        if (element.name.kind === ts.SyntaxKind.Identifier) {
            result = fn(element);
        }
        else {
            result = forEachDestructuringIdentifier(element.name, fn);
        }
        if (result)
            return result;
    }
}
exports.forEachDestructuringIdentifier = forEachDestructuringIdentifier;
function forEachDeclaredVariable(declarationList, cb) {
    for (const declaration of declarationList.declarations) {
        let result;
        if (declaration.name.kind === ts.SyntaxKind.Identifier) {
            result = cb(declaration);
        }
        else {
            result = forEachDestructuringIdentifier(declaration.name, cb);
        }
        if (result)
            return result;
    }
}
exports.forEachDeclaredVariable = forEachDeclaredVariable;
var VariableDeclarationKind;
(function (VariableDeclarationKind) {
    VariableDeclarationKind[VariableDeclarationKind["Var"] = 0] = "Var";
    VariableDeclarationKind[VariableDeclarationKind["Let"] = 1] = "Let";
    VariableDeclarationKind[VariableDeclarationKind["Const"] = 2] = "Const";
})(VariableDeclarationKind = exports.VariableDeclarationKind || (exports.VariableDeclarationKind = {}));
function getVariableDeclarationKind(declarationList) {
    if (declarationList.flags & ts.NodeFlags.Let)
        return 1;
    if (declarationList.flags & ts.NodeFlags.Const)
        return 2;
    return 0;
}
exports.getVariableDeclarationKind = getVariableDeclarationKind;
function isBlockScopedVariableDeclarationList(declarationList) {
    return (declarationList.flags & ts.NodeFlags.BlockScoped) !== 0;
}
exports.isBlockScopedVariableDeclarationList = isBlockScopedVariableDeclarationList;
function isBlockScopedVariableDeclaration(declaration) {
    const parent = declaration.parent;
    return parent.kind === ts.SyntaxKind.CatchClause ||
        isBlockScopedVariableDeclarationList(parent);
}
exports.isBlockScopedVariableDeclaration = isBlockScopedVariableDeclaration;
function isBlockScopedDeclarationStatement(statement) {
    switch (statement.kind) {
        case ts.SyntaxKind.VariableStatement:
            return isBlockScopedVariableDeclarationList(statement.declarationList);
        case ts.SyntaxKind.ClassDeclaration:
        case ts.SyntaxKind.EnumDeclaration:
        case ts.SyntaxKind.InterfaceDeclaration:
        case ts.SyntaxKind.TypeAliasDeclaration:
            return true;
        default:
            return false;
    }
}
exports.isBlockScopedDeclarationStatement = isBlockScopedDeclarationStatement;
function isInSingleStatementContext(statement) {
    switch (statement.parent.kind) {
        case ts.SyntaxKind.ForStatement:
        case ts.SyntaxKind.ForInStatement:
        case ts.SyntaxKind.ForOfStatement:
        case ts.SyntaxKind.WhileStatement:
        case ts.SyntaxKind.DoStatement:
        case ts.SyntaxKind.IfStatement:
        case ts.SyntaxKind.WithStatement:
        case ts.SyntaxKind.LabeledStatement:
            return true;
        default:
            return false;
    }
}
exports.isInSingleStatementContext = isInSingleStatementContext;
var ScopeBoundary;
(function (ScopeBoundary) {
    ScopeBoundary[ScopeBoundary["None"] = 0] = "None";
    ScopeBoundary[ScopeBoundary["Function"] = 1] = "Function";
    ScopeBoundary[ScopeBoundary["Block"] = 2] = "Block";
    ScopeBoundary[ScopeBoundary["Type"] = 4] = "Type";
    ScopeBoundary[ScopeBoundary["ConditionalType"] = 8] = "ConditionalType";
})(ScopeBoundary = exports.ScopeBoundary || (exports.ScopeBoundary = {}));
var ScopeBoundarySelector;
(function (ScopeBoundarySelector) {
    ScopeBoundarySelector[ScopeBoundarySelector["Function"] = 1] = "Function";
    ScopeBoundarySelector[ScopeBoundarySelector["Block"] = 3] = "Block";
    ScopeBoundarySelector[ScopeBoundarySelector["Type"] = 7] = "Type";
    ScopeBoundarySelector[ScopeBoundarySelector["InferType"] = 8] = "InferType";
})(ScopeBoundarySelector = exports.ScopeBoundarySelector || (exports.ScopeBoundarySelector = {}));
function isScopeBoundary(node) {
    return isFunctionScopeBoundary(node) || isBlockScopeBoundary(node) || isTypeScopeBoundary(node);
}
exports.isScopeBoundary = isScopeBoundary;
function isTypeScopeBoundary(node) {
    switch (node.kind) {
        case ts.SyntaxKind.InterfaceDeclaration:
        case ts.SyntaxKind.TypeAliasDeclaration:
        case ts.SyntaxKind.MappedType:
            return 4;
        case ts.SyntaxKind.ConditionalType:
            return 8;
        default:
            return 0;
    }
}
exports.isTypeScopeBoundary = isTypeScopeBoundary;
function isFunctionScopeBoundary(node) {
    switch (node.kind) {
        case ts.SyntaxKind.FunctionExpression:
        case ts.SyntaxKind.ArrowFunction:
        case ts.SyntaxKind.Constructor:
        case ts.SyntaxKind.ModuleDeclaration:
        case ts.SyntaxKind.ClassDeclaration:
        case ts.SyntaxKind.ClassExpression:
        case ts.SyntaxKind.EnumDeclaration:
        case ts.SyntaxKind.MethodDeclaration:
        case ts.SyntaxKind.FunctionDeclaration:
        case ts.SyntaxKind.GetAccessor:
        case ts.SyntaxKind.SetAccessor:
        case ts.SyntaxKind.MethodSignature:
        case ts.SyntaxKind.CallSignature:
        case ts.SyntaxKind.ConstructSignature:
        case ts.SyntaxKind.ConstructorType:
        case ts.SyntaxKind.FunctionType:
            return 1;
        case ts.SyntaxKind.SourceFile:
            return ts.isExternalModule(node) ? 1 : 0;
        default:
            return 0;
    }
}
exports.isFunctionScopeBoundary = isFunctionScopeBoundary;
function isBlockScopeBoundary(node) {
    switch (node.kind) {
        case ts.SyntaxKind.Block:
            const parent = node.parent;
            return parent.kind !== ts.SyntaxKind.CatchClause &&
                (parent.kind === ts.SyntaxKind.SourceFile ||
                    !isFunctionScopeBoundary(parent))
                ? 2
                : 0;
        case ts.SyntaxKind.ForStatement:
        case ts.SyntaxKind.ForInStatement:
        case ts.SyntaxKind.ForOfStatement:
        case ts.SyntaxKind.CaseBlock:
        case ts.SyntaxKind.CatchClause:
        case ts.SyntaxKind.WithStatement:
            return 2;
        default:
            return 0;
    }
}
exports.isBlockScopeBoundary = isBlockScopeBoundary;
function hasOwnThisReference(node) {
    switch (node.kind) {
        case ts.SyntaxKind.ClassDeclaration:
        case ts.SyntaxKind.ClassExpression:
        case ts.SyntaxKind.FunctionExpression:
            return true;
        case ts.SyntaxKind.FunctionDeclaration:
            return node.body !== undefined;
        case ts.SyntaxKind.MethodDeclaration:
        case ts.SyntaxKind.GetAccessor:
        case ts.SyntaxKind.SetAccessor:
            return node.parent.kind === ts.SyntaxKind.ObjectLiteralExpression;
        default:
            return false;
    }
}
exports.hasOwnThisReference = hasOwnThisReference;
function isFunctionWithBody(node) {
    switch (node.kind) {
        case ts.SyntaxKind.GetAccessor:
        case ts.SyntaxKind.SetAccessor:
        case ts.SyntaxKind.FunctionDeclaration:
        case ts.SyntaxKind.MethodDeclaration:
        case ts.SyntaxKind.Constructor:
            return node.body !== undefined;
        case ts.SyntaxKind.FunctionExpression:
        case ts.SyntaxKind.ArrowFunction:
            return true;
        default:
            return false;
    }
}
exports.isFunctionWithBody = isFunctionWithBody;
function forEachToken(node, cb, sourceFile = node.getSourceFile()) {
    return (function iterate(child) {
        if (isTokenKind(child.kind))
            return cb(child);
        if (child.kind !== ts.SyntaxKind.JSDocComment)
            return child.getChildren(sourceFile).forEach(iterate);
    })(node);
}
exports.forEachToken = forEachToken;
function forEachTokenWithTrivia(node, cb, sourceFile = node.getSourceFile()) {
    const fullText = sourceFile.text;
    const scanner = ts.createScanner(sourceFile.languageVersion, false, sourceFile.languageVariant, fullText);
    return forEachToken(node, (token) => {
        const tokenStart = token.kind === ts.SyntaxKind.JsxText || token.pos === token.end ? token.pos : token.getStart(sourceFile);
        if (tokenStart !== token.pos) {
            scanner.setTextPos(token.pos);
            let kind = scanner.scan();
            let pos = scanner.getTokenPos();
            while (pos < tokenStart) {
                const textPos = scanner.getTextPos();
                cb(fullText, kind, { pos, end: textPos }, token.parent);
                if (textPos === tokenStart)
                    break;
                kind = scanner.scan();
                pos = scanner.getTokenPos();
            }
        }
        return cb(fullText, token.kind, { end: token.end, pos: tokenStart }, token.parent);
    }, sourceFile);
}
exports.forEachTokenWithTrivia = forEachTokenWithTrivia;
function forEachComment(node, cb, sourceFile = node.getSourceFile()) {
    const fullText = sourceFile.text;
    const notJsx = sourceFile.languageVariant !== ts.LanguageVariant.JSX;
    return forEachToken(node, (token) => {
        if (token.pos === token.end)
            return;
        if (token.kind !== ts.SyntaxKind.JsxText)
            ts.forEachLeadingCommentRange(fullText, token.pos === 0 ? (ts.getShebang(fullText) || '').length : token.pos, commentCallback);
        if (notJsx || canHaveTrailingTrivia(token))
            return ts.forEachTrailingCommentRange(fullText, token.end, commentCallback);
    }, sourceFile);
    function commentCallback(pos, end, kind) {
        cb(fullText, { pos, end, kind });
    }
}
exports.forEachComment = forEachComment;
function canHaveTrailingTrivia(token) {
    switch (token.kind) {
        case ts.SyntaxKind.CloseBraceToken:
            return token.parent.kind !== ts.SyntaxKind.JsxExpression || !isJsxElementOrFragment(token.parent.parent);
        case ts.SyntaxKind.GreaterThanToken:
            switch (token.parent.kind) {
                case ts.SyntaxKind.JsxOpeningElement:
                    return token.end !== token.parent.end;
                case ts.SyntaxKind.JsxOpeningFragment:
                    return false;
                case ts.SyntaxKind.JsxSelfClosingElement:
                    return token.end !== token.parent.end ||
                        !isJsxElementOrFragment(token.parent.parent);
                case ts.SyntaxKind.JsxClosingElement:
                case ts.SyntaxKind.JsxClosingFragment:
                    return !isJsxElementOrFragment(token.parent.parent.parent);
            }
    }
    return true;
}
function isJsxElementOrFragment(node) {
    return node.kind === ts.SyntaxKind.JsxElement || node.kind === ts.SyntaxKind.JsxFragment;
}
function getLineRanges(sourceFile) {
    const lineStarts = sourceFile.getLineStarts();
    const result = [];
    const length = lineStarts.length;
    const sourceText = sourceFile.text;
    let pos = 0;
    for (let i = 1; i < length; ++i) {
        const end = lineStarts[i];
        let lineEnd = end;
        for (; lineEnd > pos; --lineEnd)
            if (!ts.isLineBreak(sourceText.charCodeAt(lineEnd - 1)))
                break;
        result.push({
            pos,
            end,
            contentLength: lineEnd - pos,
        });
        pos = end;
    }
    result.push({
        pos,
        end: sourceFile.end,
        contentLength: sourceFile.end - pos,
    });
    return result;
}
exports.getLineRanges = getLineRanges;
function getLineBreakStyle(sourceFile) {
    const lineStarts = sourceFile.getLineStarts();
    return lineStarts.length === 1 || lineStarts[1] < 2 || sourceFile.text[lineStarts[1] - 2] !== '\r'
        ? '\n'
        : '\r\n';
}
exports.getLineBreakStyle = getLineBreakStyle;
let cachedScanner;
function scanToken(text, languageVersion) {
    if (cachedScanner === undefined) {
        cachedScanner = ts.createScanner(languageVersion, false, undefined, text);
    }
    else {
        cachedScanner.setScriptTarget(languageVersion);
        cachedScanner.setText(text);
    }
    cachedScanner.scan();
    return cachedScanner;
}
function isValidIdentifier(text, languageVersion = ts.ScriptTarget.Latest) {
    const scan = scanToken(text, languageVersion);
    return scan.isIdentifier() && scan.getTextPos() === text.length && scan.getTokenPos() === 0;
}
exports.isValidIdentifier = isValidIdentifier;
function charSize(ch) {
    return ch >= 0x10000 ? 2 : 1;
}
function isValidPropertyAccess(text, languageVersion = ts.ScriptTarget.Latest) {
    if (text.length === 0)
        return false;
    let ch = text.codePointAt(0);
    if (!ts.isIdentifierStart(ch, languageVersion))
        return false;
    for (let i = charSize(ch); i < text.length; i += charSize(ch)) {
        ch = text.codePointAt(i);
        if (!ts.isIdentifierPart(ch, languageVersion))
            return false;
    }
    return true;
}
exports.isValidPropertyAccess = isValidPropertyAccess;
function isValidPropertyName(text, languageVersion = ts.ScriptTarget.Latest) {
    if (isValidPropertyAccess(text, languageVersion))
        return true;
    const scan = scanToken(text, languageVersion);
    return scan.getTextPos() === text.length &&
        scan.getToken() === ts.SyntaxKind.NumericLiteral && scan.getTokenValue() === text;
}
exports.isValidPropertyName = isValidPropertyName;
function isValidNumericLiteral(text, languageVersion = ts.ScriptTarget.Latest) {
    const scan = scanToken(text, languageVersion);
    return scan.getToken() === ts.SyntaxKind.NumericLiteral && scan.getTextPos() === text.length && scan.getTokenPos() === 0;
}
exports.isValidNumericLiteral = isValidNumericLiteral;
function isValidJsxIdentifier(text, languageVersion = ts.ScriptTarget.Latest) {
    if (text.length === 0)
        return false;
    let ch = text.codePointAt(0);
    if (!ts.isIdentifierStart(ch, languageVersion))
        return false;
    for (let i = charSize(ch); i < text.length; i += charSize(ch)) {
        ch = text.codePointAt(i);
        if (!ts.isIdentifierPart(ch, languageVersion) && ch !== 45)
            return false;
    }
    return true;
}
exports.isValidJsxIdentifier = isValidJsxIdentifier;
function isNumericPropertyName(name) {
    return String(+name) === name;
}
exports.isNumericPropertyName = isNumericPropertyName;
function isSameLine(sourceFile, pos1, pos2) {
    return ts.getLineAndCharacterOfPosition(sourceFile, pos1).line === ts.getLineAndCharacterOfPosition(sourceFile, pos2).line;
}
exports.isSameLine = isSameLine;
var SideEffectOptions;
(function (SideEffectOptions) {
    SideEffectOptions[SideEffectOptions["None"] = 0] = "None";
    SideEffectOptions[SideEffectOptions["TaggedTemplate"] = 1] = "TaggedTemplate";
    SideEffectOptions[SideEffectOptions["Constructor"] = 2] = "Constructor";
    SideEffectOptions[SideEffectOptions["JsxElement"] = 4] = "JsxElement";
})(SideEffectOptions = exports.SideEffectOptions || (exports.SideEffectOptions = {}));
function hasSideEffects(node, options) {
    switch (node.kind) {
        case ts.SyntaxKind.CallExpression:
        case ts.SyntaxKind.PostfixUnaryExpression:
        case ts.SyntaxKind.AwaitExpression:
        case ts.SyntaxKind.YieldExpression:
        case ts.SyntaxKind.DeleteExpression:
            return true;
        case ts.SyntaxKind.TypeAssertionExpression:
        case ts.SyntaxKind.AsExpression:
        case ts.SyntaxKind.ParenthesizedExpression:
        case ts.SyntaxKind.NonNullExpression:
        case ts.SyntaxKind.VoidExpression:
        case ts.SyntaxKind.TypeOfExpression:
        case ts.SyntaxKind.PropertyAccessExpression:
        case ts.SyntaxKind.SpreadElement:
        case ts.SyntaxKind.PartiallyEmittedExpression:
            return hasSideEffects(node.expression, options);
        case ts.SyntaxKind.BinaryExpression:
            return isAssignmentKind(node.operatorToken.kind) ||
                hasSideEffects(node.left, options) ||
                hasSideEffects(node.right, options);
        case ts.SyntaxKind.PrefixUnaryExpression:
            switch (node.operator) {
                case ts.SyntaxKind.PlusPlusToken:
                case ts.SyntaxKind.MinusMinusToken:
                    return true;
                default:
                    return hasSideEffects(node.operand, options);
            }
        case ts.SyntaxKind.ElementAccessExpression:
            return hasSideEffects(node.expression, options) ||
                node.argumentExpression !== undefined &&
                    hasSideEffects(node.argumentExpression, options);
        case ts.SyntaxKind.ConditionalExpression:
            return hasSideEffects(node.condition, options) ||
                hasSideEffects(node.whenTrue, options) ||
                hasSideEffects(node.whenFalse, options);
        case ts.SyntaxKind.NewExpression:
            if (options & 2 || hasSideEffects(node.expression, options))
                return true;
            if (node.arguments !== undefined)
                for (const child of node.arguments)
                    if (hasSideEffects(child, options))
                        return true;
            return false;
        case ts.SyntaxKind.TaggedTemplateExpression:
            if (options & 1 || hasSideEffects(node.tag, options))
                return true;
            if (node.template.kind === ts.SyntaxKind.NoSubstitutionTemplateLiteral)
                return false;
            node = node.template;
        case ts.SyntaxKind.TemplateExpression:
            for (const child of node.templateSpans)
                if (hasSideEffects(child.expression, options))
                    return true;
            return false;
        case ts.SyntaxKind.ClassExpression:
            return classExpressionHasSideEffects(node, options);
        case ts.SyntaxKind.ArrayLiteralExpression:
            for (const child of node.elements)
                if (hasSideEffects(child, options))
                    return true;
            return false;
        case ts.SyntaxKind.ObjectLiteralExpression:
            for (const child of node.properties) {
                if (child.name !== undefined && child.name.kind === ts.SyntaxKind.ComputedPropertyName &&
                    hasSideEffects(child.name.expression, options))
                    return true;
                switch (child.kind) {
                    case ts.SyntaxKind.PropertyAssignment:
                        if (hasSideEffects(child.initializer, options))
                            return true;
                        break;
                    case ts.SyntaxKind.SpreadAssignment:
                        if (hasSideEffects(child.expression, options))
                            return true;
                }
            }
            return false;
        case ts.SyntaxKind.JsxExpression:
            return node.expression !== undefined && hasSideEffects(node.expression, options);
        case ts.SyntaxKind.JsxElement:
        case ts.SyntaxKind.JsxFragment:
            for (const child of node.children)
                if (child.kind !== ts.SyntaxKind.JsxText && hasSideEffects(child, options))
                    return true;
            if (node.kind === ts.SyntaxKind.JsxFragment)
                return false;
            node = node.openingElement;
        case ts.SyntaxKind.JsxSelfClosingElement:
        case ts.SyntaxKind.JsxOpeningElement:
            if (options & 4)
                return true;
            for (const child of node.attributes.properties) {
                if (child.kind === ts.SyntaxKind.JsxSpreadAttribute) {
                    if (hasSideEffects(child.expression, options))
                        return true;
                }
                else if (child.initializer !== undefined && hasSideEffects(child.initializer, options)) {
                    return true;
                }
            }
            return false;
        case ts.SyntaxKind.CommaListExpression:
            for (const child of node.elements)
                if (hasSideEffects(child, options))
                    return true;
            return false;
        default:
            return false;
    }
}
exports.hasSideEffects = hasSideEffects;
function classExpressionHasSideEffects(node, options) {
    if (node.heritageClauses !== undefined && node.heritageClauses[0].token === ts.SyntaxKind.ExtendsKeyword)
        for (const base of node.heritageClauses[0].types)
            if (hasSideEffects(base.expression, options))
                return true;
    for (const child of node.members)
        if (child.name !== undefined && child.name.kind === ts.SyntaxKind.ComputedPropertyName &&
            hasSideEffects(child.name.expression, options) ||
            node_1.isPropertyDeclaration(child) && child.initializer !== undefined &&
                hasSideEffects(child.initializer, options))
            return true;
    return false;
}
function getDeclarationOfBindingElement(node) {
    let parent = node.parent.parent;
    while (parent.kind === ts.SyntaxKind.BindingElement)
        parent = parent.parent.parent;
    return parent;
}
exports.getDeclarationOfBindingElement = getDeclarationOfBindingElement;
function isExpressionValueUsed(node) {
    while (true) {
        const parent = node.parent;
        switch (parent.kind) {
            case ts.SyntaxKind.CallExpression:
            case ts.SyntaxKind.NewExpression:
            case ts.SyntaxKind.ElementAccessExpression:
            case ts.SyntaxKind.WhileStatement:
            case ts.SyntaxKind.DoStatement:
            case ts.SyntaxKind.WithStatement:
            case ts.SyntaxKind.ThrowStatement:
            case ts.SyntaxKind.ReturnStatement:
            case ts.SyntaxKind.JsxExpression:
            case ts.SyntaxKind.JsxSpreadAttribute:
            case ts.SyntaxKind.JsxElement:
            case ts.SyntaxKind.JsxFragment:
            case ts.SyntaxKind.JsxSelfClosingElement:
            case ts.SyntaxKind.ComputedPropertyName:
            case ts.SyntaxKind.ArrowFunction:
            case ts.SyntaxKind.ExportSpecifier:
            case ts.SyntaxKind.ExportAssignment:
            case ts.SyntaxKind.ImportDeclaration:
            case ts.SyntaxKind.ExternalModuleReference:
            case ts.SyntaxKind.Decorator:
            case ts.SyntaxKind.TaggedTemplateExpression:
            case ts.SyntaxKind.TemplateSpan:
            case ts.SyntaxKind.ExpressionWithTypeArguments:
            case ts.SyntaxKind.TypeOfExpression:
            case ts.SyntaxKind.AwaitExpression:
            case ts.SyntaxKind.YieldExpression:
            case ts.SyntaxKind.LiteralType:
            case ts.SyntaxKind.JsxAttributes:
            case ts.SyntaxKind.JsxOpeningElement:
            case ts.SyntaxKind.JsxClosingElement:
            case ts.SyntaxKind.IfStatement:
            case ts.SyntaxKind.CaseClause:
            case ts.SyntaxKind.SwitchStatement:
                return true;
            case ts.SyntaxKind.PropertyAccessExpression:
                return parent.expression === node;
            case ts.SyntaxKind.QualifiedName:
                return parent.left === node;
            case ts.SyntaxKind.ShorthandPropertyAssignment:
                return parent.objectAssignmentInitializer === node ||
                    !isInDestructuringAssignment(parent);
            case ts.SyntaxKind.PropertyAssignment:
                return parent.initializer === node && !isInDestructuringAssignment(parent);
            case ts.SyntaxKind.SpreadAssignment:
            case ts.SyntaxKind.SpreadElement:
            case ts.SyntaxKind.ArrayLiteralExpression:
                return !isInDestructuringAssignment(parent);
            case ts.SyntaxKind.ParenthesizedExpression:
            case ts.SyntaxKind.AsExpression:
            case ts.SyntaxKind.TypeAssertionExpression:
            case ts.SyntaxKind.PostfixUnaryExpression:
            case ts.SyntaxKind.PrefixUnaryExpression:
            case ts.SyntaxKind.NonNullExpression:
                node = parent;
                break;
            case ts.SyntaxKind.ForStatement:
                return parent.condition === node;
            case ts.SyntaxKind.ForInStatement:
            case ts.SyntaxKind.ForOfStatement:
                return parent.expression === node;
            case ts.SyntaxKind.ConditionalExpression:
                if (parent.condition === node)
                    return true;
                node = parent;
                break;
            case ts.SyntaxKind.PropertyDeclaration:
            case ts.SyntaxKind.BindingElement:
            case ts.SyntaxKind.VariableDeclaration:
            case ts.SyntaxKind.Parameter:
            case ts.SyntaxKind.EnumMember:
                return parent.initializer === node;
            case ts.SyntaxKind.ImportEqualsDeclaration:
                return parent.moduleReference === node;
            case ts.SyntaxKind.CommaListExpression:
                if (parent.elements[parent.elements.length - 1] !== node)
                    return false;
                node = parent;
                break;
            case ts.SyntaxKind.BinaryExpression:
                if (parent.right === node) {
                    if (parent.operatorToken.kind === ts.SyntaxKind.CommaToken) {
                        node = parent;
                        break;
                    }
                    return true;
                }
                switch (parent.operatorToken.kind) {
                    case ts.SyntaxKind.CommaToken:
                    case ts.SyntaxKind.EqualsToken:
                        return false;
                    case ts.SyntaxKind.EqualsEqualsEqualsToken:
                    case ts.SyntaxKind.EqualsEqualsToken:
                    case ts.SyntaxKind.ExclamationEqualsEqualsToken:
                    case ts.SyntaxKind.ExclamationEqualsToken:
                    case ts.SyntaxKind.InstanceOfKeyword:
                    case ts.SyntaxKind.PlusToken:
                    case ts.SyntaxKind.MinusToken:
                    case ts.SyntaxKind.AsteriskToken:
                    case ts.SyntaxKind.SlashToken:
                    case ts.SyntaxKind.PercentToken:
                    case ts.SyntaxKind.AsteriskAsteriskToken:
                    case ts.SyntaxKind.GreaterThanToken:
                    case ts.SyntaxKind.GreaterThanGreaterThanToken:
                    case ts.SyntaxKind.GreaterThanGreaterThanGreaterThanToken:
                    case ts.SyntaxKind.GreaterThanEqualsToken:
                    case ts.SyntaxKind.LessThanToken:
                    case ts.SyntaxKind.LessThanLessThanToken:
                    case ts.SyntaxKind.LessThanEqualsToken:
                    case ts.SyntaxKind.AmpersandToken:
                    case ts.SyntaxKind.BarToken:
                    case ts.SyntaxKind.CaretToken:
                    case ts.SyntaxKind.BarBarToken:
                    case ts.SyntaxKind.AmpersandAmpersandToken:
                    case ts.SyntaxKind.InKeyword:
                        return true;
                    default:
                        node = parent;
                }
                break;
            default:
                return false;
        }
    }
}
exports.isExpressionValueUsed = isExpressionValueUsed;
function isInDestructuringAssignment(node) {
    switch (node.kind) {
        case ts.SyntaxKind.ShorthandPropertyAssignment:
            if (node.objectAssignmentInitializer !== undefined)
                return true;
        case ts.SyntaxKind.PropertyAssignment:
        case ts.SyntaxKind.SpreadAssignment:
            node = node.parent;
            break;
        case ts.SyntaxKind.SpreadElement:
            if (node.parent.kind !== ts.SyntaxKind.ArrayLiteralExpression)
                return false;
            node = node.parent;
    }
    while (true) {
        switch (node.parent.kind) {
            case ts.SyntaxKind.BinaryExpression:
                return node.parent.left === node &&
                    node.parent.operatorToken.kind === ts.SyntaxKind.EqualsToken;
            case ts.SyntaxKind.ForOfStatement:
                return node.parent.initializer === node;
            case ts.SyntaxKind.ArrayLiteralExpression:
            case ts.SyntaxKind.ObjectLiteralExpression:
                node = node.parent;
                break;
            case ts.SyntaxKind.SpreadAssignment:
            case ts.SyntaxKind.PropertyAssignment:
                node = node.parent.parent;
                break;
            case ts.SyntaxKind.SpreadElement:
                if (node.parent.parent.kind !== ts.SyntaxKind.ArrayLiteralExpression)
                    return false;
                node = node.parent.parent;
                break;
            default:
                return false;
        }
    }
}
var AccessKind;
(function (AccessKind) {
    AccessKind[AccessKind["None"] = 0] = "None";
    AccessKind[AccessKind["Read"] = 1] = "Read";
    AccessKind[AccessKind["Write"] = 2] = "Write";
    AccessKind[AccessKind["Delete"] = 4] = "Delete";
    AccessKind[AccessKind["ReadWrite"] = 3] = "ReadWrite";
    AccessKind[AccessKind["Modification"] = 6] = "Modification";
})(AccessKind = exports.AccessKind || (exports.AccessKind = {}));
function getAccessKind(node) {
    const parent = node.parent;
    switch (parent.kind) {
        case ts.SyntaxKind.DeleteExpression:
            return 4;
        case ts.SyntaxKind.PostfixUnaryExpression:
            return 3;
        case ts.SyntaxKind.PrefixUnaryExpression:
            return parent.operator === ts.SyntaxKind.PlusPlusToken ||
                parent.operator === ts.SyntaxKind.MinusMinusToken
                ? 3
                : 1;
        case ts.SyntaxKind.BinaryExpression:
            return parent.right === node
                ? 1
                : !isAssignmentKind(parent.operatorToken.kind)
                    ? 1
                    : parent.operatorToken.kind === ts.SyntaxKind.EqualsToken
                        ? 2
                        : 3;
        case ts.SyntaxKind.ShorthandPropertyAssignment:
            return parent.objectAssignmentInitializer === node
                ? 1
                : isInDestructuringAssignment(parent)
                    ? 2
                    : 1;
        case ts.SyntaxKind.PropertyAssignment:
            return parent.name === node
                ? 0
                : isInDestructuringAssignment(parent)
                    ? 2
                    : 1;
        case ts.SyntaxKind.ArrayLiteralExpression:
        case ts.SyntaxKind.SpreadElement:
        case ts.SyntaxKind.SpreadAssignment:
            return isInDestructuringAssignment(parent)
                ? 2
                : 1;
        case ts.SyntaxKind.ParenthesizedExpression:
        case ts.SyntaxKind.NonNullExpression:
        case ts.SyntaxKind.TypeAssertionExpression:
        case ts.SyntaxKind.AsExpression:
            return getAccessKind(parent);
        case ts.SyntaxKind.ForOfStatement:
        case ts.SyntaxKind.ForInStatement:
            return parent.initializer === node
                ? 2
                : 1;
        case ts.SyntaxKind.ExpressionWithTypeArguments:
            return parent.parent.token === ts.SyntaxKind.ExtendsKeyword &&
                parent.parent.parent.kind !== ts.SyntaxKind.InterfaceDeclaration
                ? 1
                : 0;
        case ts.SyntaxKind.ComputedPropertyName:
        case ts.SyntaxKind.ExpressionStatement:
        case ts.SyntaxKind.TypeOfExpression:
        case ts.SyntaxKind.ElementAccessExpression:
        case ts.SyntaxKind.ForStatement:
        case ts.SyntaxKind.IfStatement:
        case ts.SyntaxKind.DoStatement:
        case ts.SyntaxKind.WhileStatement:
        case ts.SyntaxKind.SwitchStatement:
        case ts.SyntaxKind.WithStatement:
        case ts.SyntaxKind.ThrowStatement:
        case ts.SyntaxKind.CallExpression:
        case ts.SyntaxKind.NewExpression:
        case ts.SyntaxKind.TaggedTemplateExpression:
        case ts.SyntaxKind.JsxExpression:
        case ts.SyntaxKind.Decorator:
        case ts.SyntaxKind.TemplateSpan:
        case ts.SyntaxKind.JsxOpeningElement:
        case ts.SyntaxKind.JsxSelfClosingElement:
        case ts.SyntaxKind.JsxSpreadAttribute:
        case ts.SyntaxKind.VoidExpression:
        case ts.SyntaxKind.ReturnStatement:
        case ts.SyntaxKind.AwaitExpression:
        case ts.SyntaxKind.YieldExpression:
        case ts.SyntaxKind.ConditionalExpression:
        case ts.SyntaxKind.CaseClause:
        case ts.SyntaxKind.JsxElement:
            return 1;
        case ts.SyntaxKind.ArrowFunction:
            return parent.body === node
                ? 1
                : 2;
        case ts.SyntaxKind.PropertyDeclaration:
        case ts.SyntaxKind.VariableDeclaration:
        case ts.SyntaxKind.Parameter:
        case ts.SyntaxKind.EnumMember:
        case ts.SyntaxKind.BindingElement:
        case ts.SyntaxKind.JsxAttribute:
            return parent.initializer === node
                ? 1
                : 0;
        case ts.SyntaxKind.PropertyAccessExpression:
            return parent.expression === node
                ? 1
                : 0;
        case ts.SyntaxKind.ExportAssignment:
            return parent.isExportEquals
                ? 1
                : 0;
    }
    return 0;
}
exports.getAccessKind = getAccessKind;
function isReassignmentTarget(node) {
    return (getAccessKind(node) & 2) !== 0;
}
exports.isReassignmentTarget = isReassignmentTarget;
function canHaveJsDoc(node) {
    const kind = node.kind;
    switch (kind) {
        case ts.SyntaxKind.Parameter:
        case ts.SyntaxKind.CallSignature:
        case ts.SyntaxKind.ConstructSignature:
        case ts.SyntaxKind.MethodSignature:
        case ts.SyntaxKind.PropertySignature:
        case ts.SyntaxKind.ArrowFunction:
        case ts.SyntaxKind.ParenthesizedExpression:
        case ts.SyntaxKind.SpreadAssignment:
        case ts.SyntaxKind.ShorthandPropertyAssignment:
        case ts.SyntaxKind.PropertyAssignment:
        case ts.SyntaxKind.FunctionExpression:
        case ts.SyntaxKind.FunctionDeclaration:
        case ts.SyntaxKind.LabeledStatement:
        case ts.SyntaxKind.ExpressionStatement:
        case ts.SyntaxKind.VariableStatement:
        case ts.SyntaxKind.Constructor:
        case ts.SyntaxKind.MethodDeclaration:
        case ts.SyntaxKind.PropertyDeclaration:
        case ts.SyntaxKind.GetAccessor:
        case ts.SyntaxKind.SetAccessor:
        case ts.SyntaxKind.ClassDeclaration:
        case ts.SyntaxKind.ClassExpression:
        case ts.SyntaxKind.InterfaceDeclaration:
        case ts.SyntaxKind.TypeAliasDeclaration:
        case ts.SyntaxKind.EnumMember:
        case ts.SyntaxKind.EnumDeclaration:
        case ts.SyntaxKind.ModuleDeclaration:
        case ts.SyntaxKind.ImportEqualsDeclaration:
        case ts.SyntaxKind.IndexSignature:
        case ts.SyntaxKind.FunctionType:
        case ts.SyntaxKind.ConstructorType:
        case ts.SyntaxKind.JSDocFunctionType:
        case ts.SyntaxKind.EndOfFileToken:
        case ts.SyntaxKind.ExportDeclaration:
            return true;
        default:
            return false;
    }
}
exports.canHaveJsDoc = canHaveJsDoc;
function getJsDoc(node, sourceFile) {
    if (node.kind === ts.SyntaxKind.EndOfFileToken)
        return parseJsDocWorker(node, sourceFile || node.parent);
    const result = [];
    for (const child of node.getChildren(sourceFile)) {
        if (!node_1.isJsDoc(child))
            break;
        result.push(child);
    }
    return result;
}
exports.getJsDoc = getJsDoc;
function parseJsDocOfNode(node, considerTrailingComments, sourceFile = node.getSourceFile()) {
    if (canHaveJsDoc(node) && node.kind !== ts.SyntaxKind.EndOfFileToken) {
        const result = getJsDoc(node, sourceFile);
        if (result.length !== 0 || !considerTrailingComments)
            return result;
    }
    return parseJsDocWorker(node, sourceFile, considerTrailingComments);
}
exports.parseJsDocOfNode = parseJsDocOfNode;
function parseJsDocWorker(node, sourceFile, considerTrailingComments) {
    const nodeStart = node.getStart(sourceFile);
    const start = ts[considerTrailingComments && isSameLine(sourceFile, node.pos, nodeStart)
        ? 'forEachTrailingCommentRange'
        : 'forEachLeadingCommentRange'](sourceFile.text, node.pos, (pos, _end, kind) => kind === ts.SyntaxKind.MultiLineCommentTrivia && sourceFile.text[pos + 2] === '*' ? { pos } : undefined);
    if (start === undefined)
        return [];
    const startPos = start.pos;
    const text = sourceFile.text.slice(startPos, nodeStart);
    const newSourceFile = ts.createSourceFile('jsdoc.ts', `${text}var a;`, sourceFile.languageVersion);
    const result = getJsDoc(newSourceFile.statements[0], newSourceFile);
    for (const doc of result)
        updateNode(doc, node);
    return result;
    function updateNode(n, parent) {
        n.pos += startPos;
        n.end += startPos;
        n.parent = parent;
        return ts.forEachChild(n, (child) => updateNode(child, n), (children) => {
            children.pos += startPos;
            children.end += startPos;
            for (const child of children)
                updateNode(child, n);
        });
    }
}
var ImportKind;
(function (ImportKind) {
    ImportKind[ImportKind["ImportDeclaration"] = 1] = "ImportDeclaration";
    ImportKind[ImportKind["ImportEquals"] = 2] = "ImportEquals";
    ImportKind[ImportKind["ExportFrom"] = 4] = "ExportFrom";
    ImportKind[ImportKind["DynamicImport"] = 8] = "DynamicImport";
    ImportKind[ImportKind["Require"] = 16] = "Require";
    ImportKind[ImportKind["ImportType"] = 32] = "ImportType";
    ImportKind[ImportKind["All"] = 63] = "All";
    ImportKind[ImportKind["AllImports"] = 59] = "AllImports";
    ImportKind[ImportKind["AllStaticImports"] = 3] = "AllStaticImports";
    ImportKind[ImportKind["AllImportExpressions"] = 24] = "AllImportExpressions";
    ImportKind[ImportKind["AllRequireLike"] = 18] = "AllRequireLike";
    ImportKind[ImportKind["AllNestedImports"] = 56] = "AllNestedImports";
    ImportKind[ImportKind["AllTopLevelImports"] = 7] = "AllTopLevelImports";
})(ImportKind = exports.ImportKind || (exports.ImportKind = {}));
function findImports(sourceFile, kinds) {
    const result = [];
    for (const node of findImportLikeNodes(sourceFile, kinds)) {
        switch (node.kind) {
            case ts.SyntaxKind.ImportDeclaration:
                addIfTextualLiteral(node.moduleSpecifier);
                break;
            case ts.SyntaxKind.ImportEqualsDeclaration:
                addIfTextualLiteral(node.moduleReference.expression);
                break;
            case ts.SyntaxKind.ExportDeclaration:
                addIfTextualLiteral(node.moduleSpecifier);
                break;
            case ts.SyntaxKind.CallExpression:
                addIfTextualLiteral(node.arguments[0]);
                break;
            case ts.SyntaxKind.ImportType:
                if (node_1.isLiteralTypeNode(node.argument))
                    addIfTextualLiteral(node.argument.literal);
                break;
            default:
                throw new Error('unexpected node');
        }
    }
    return result;
    function addIfTextualLiteral(node) {
        if (node_1.isTextualLiteral(node))
            result.push(node);
    }
}
exports.findImports = findImports;
function findImportLikeNodes(sourceFile, kinds) {
    return new ImportFinder(sourceFile, kinds).find();
}
exports.findImportLikeNodes = findImportLikeNodes;
class ImportFinder {
    constructor(_sourceFile, _options) {
        this._sourceFile = _sourceFile;
        this._options = _options;
        this._result = [];
    }
    find() {
        if (this._sourceFile.isDeclarationFile)
            this._options &= ~24;
        if (this._options & 7)
            this._findImports(this._sourceFile.statements);
        if (this._options & 56)
            this._findNestedImports();
        return this._result;
    }
    _findImports(statements) {
        for (const statement of statements) {
            if (node_1.isImportDeclaration(statement)) {
                if (this._options & 1)
                    this._result.push(statement);
            }
            else if (node_1.isImportEqualsDeclaration(statement)) {
                if (this._options & 2 &&
                    statement.moduleReference.kind === ts.SyntaxKind.ExternalModuleReference)
                    this._result.push(statement);
            }
            else if (node_1.isExportDeclaration(statement)) {
                if (statement.moduleSpecifier !== undefined && this._options & 4)
                    this._result.push(statement);
            }
            else if (node_1.isModuleDeclaration(statement)) {
                this._findImportsInModule(statement);
            }
        }
    }
    _findImportsInModule(declaration) {
        if (declaration.body === undefined)
            return;
        if (declaration.body.kind === ts.SyntaxKind.ModuleDeclaration)
            return this._findImportsInModule(declaration.body);
        this._findImports(declaration.body.statements);
    }
    _findNestedImports() {
        let re;
        if ((this._options & 56) === 16) {
            re = /\brequire\s*[</(]/g;
        }
        else if (this._options & 16) {
            re = /\b(?:import|require)\s*[</(]/g;
        }
        else {
            re = /\bimport\s*[</(]/g;
        }
        const isJavaScriptFile = (this._sourceFile.flags & ts.NodeFlags.JavaScriptFile) !== 0;
        for (let match = re.exec(this._sourceFile.text); match !== null; match = re.exec(this._sourceFile.text)) {
            const token = getTokenAtPositionWorker(this._sourceFile, match.index, this._sourceFile, match[0][0] === 'i' && isJavaScriptFile);
            if (token.kind === ts.SyntaxKind.ImportKeyword) {
                if (token.end - 'import'.length !== match.index)
                    continue;
                switch (token.parent.kind) {
                    case ts.SyntaxKind.ImportType:
                        this._result.push(token.parent);
                        break;
                    case ts.SyntaxKind.CallExpression:
                        if (token.parent.arguments.length === 1)
                            this._result.push(token.parent);
                }
            }
            else if (token.kind === ts.SyntaxKind.Identifier &&
                token.end - 'require'.length === match.index &&
                token.parent.kind === ts.SyntaxKind.CallExpression &&
                token.parent.expression === token &&
                token.parent.arguments.length === 1) {
                this._result.push(token.parent);
            }
        }
    }
}
function isStatementInAmbientContext(node) {
    while (node.flags & ts.NodeFlags.NestedNamespace)
        node = node.parent;
    return hasModifier(node.modifiers, ts.SyntaxKind.DeclareKeyword) || isAmbientModuleBlock(node.parent);
}
exports.isStatementInAmbientContext = isStatementInAmbientContext;
function isAmbientModuleBlock(node) {
    while (node.kind === ts.SyntaxKind.ModuleBlock) {
        do
            node = node.parent;
        while (node.flags & ts.NodeFlags.NestedNamespace);
        if (hasModifier(node.modifiers, ts.SyntaxKind.DeclareKeyword))
            return true;
        node = node.parent;
    }
    return false;
}
exports.isAmbientModuleBlock = isAmbientModuleBlock;
function getIIFE(func) {
    let node = func.parent;
    while (node.kind === ts.SyntaxKind.ParenthesizedExpression)
        node = node.parent;
    return node_1.isCallExpression(node) && func.end <= node.expression.end ? node : undefined;
}
exports.getIIFE = getIIFE;
function isStrictCompilerOptionEnabled(options, option) {
    return (options.strict ? options[option] !== false : options[option] === true) &&
        (option !== 'strictPropertyInitialization' || isStrictCompilerOptionEnabled(options, 'strictNullChecks'));
}
exports.isStrictCompilerOptionEnabled = isStrictCompilerOptionEnabled;
function isCompilerOptionEnabled(options, option) {
    switch (option) {
        case 'stripInternal':
            return options.stripInternal === true && isCompilerOptionEnabled(options, 'declaration');
        case 'declaration':
            return options.declaration || isCompilerOptionEnabled(options, 'composite');
        case 'incremental':
            return options.incremental === undefined ? isCompilerOptionEnabled(options, 'composite') : options.incremental;
        case 'skipDefaultLibCheck':
            return options.skipDefaultLibCheck || isCompilerOptionEnabled(options, 'skipLibCheck');
        case 'suppressImplicitAnyIndexErrors':
            return options.suppressImplicitAnyIndexErrors === true && isCompilerOptionEnabled(options, 'noImplicitAny');
        case 'allowSyntheticDefaultImports':
            return options.allowSyntheticDefaultImports !== undefined
                ? options.allowSyntheticDefaultImports
                : isCompilerOptionEnabled(options, 'esModuleInterop') || options.module === ts.ModuleKind.System;
        case 'noImplicitAny':
        case 'noImplicitThis':
        case 'strictNullChecks':
        case 'strictFunctionTypes':
        case 'strictPropertyInitialization':
        case 'alwaysStrict':
        case 'strictBindCallApply':
            return isStrictCompilerOptionEnabled(options, option);
    }
    return options[option] === true;
}
exports.isCompilerOptionEnabled = isCompilerOptionEnabled;
function isAmbientModule(node) {
    return node.name.kind === ts.SyntaxKind.StringLiteral || (node.flags & ts.NodeFlags.GlobalAugmentation) !== 0;
}
exports.isAmbientModule = isAmbientModule;
function getCheckJsDirective(source) {
    let directive;
    ts.forEachLeadingCommentRange(source, (ts.getShebang(source) || '').length, (pos, end, kind) => {
        if (kind === ts.SyntaxKind.SingleLineCommentTrivia) {
            const text = source.slice(pos, end);
            const match = /^\/{2,3}\s*@ts-(no)?check(?:\s|$)/i.exec(text);
            if (match !== null)
                directive = { pos, end, enabled: match[1] === undefined };
        }
    });
    return directive;
}
exports.getCheckJsDirective = getCheckJsDirective;
function isConstAssertion(node) {
    return node_1.isTypeReferenceNode(node.type) &&
        node.type.typeName.kind === ts.SyntaxKind.Identifier &&
        node.type.typeName.escapedText === 'const';
}
exports.isConstAssertion = isConstAssertion;
function isInConstContext(node) {
    let current = node;
    while (true) {
        const parent = current.parent;
        outer: switch (parent.kind) {
            case ts.SyntaxKind.TypeAssertionExpression:
            case ts.SyntaxKind.AsExpression:
                return isConstAssertion(parent);
            case ts.SyntaxKind.PrefixUnaryExpression:
                if (current.kind !== ts.SyntaxKind.NumericLiteral)
                    return false;
                switch (parent.operator) {
                    case ts.SyntaxKind.PlusToken:
                    case ts.SyntaxKind.MinusToken:
                        current = parent;
                        break outer;
                    default:
                        return false;
                }
            case ts.SyntaxKind.PropertyAssignment:
                if (parent.initializer !== current)
                    return false;
                current = parent.parent;
                break;
            case ts.SyntaxKind.ShorthandPropertyAssignment:
                current = parent.parent;
                break;
            case ts.SyntaxKind.ParenthesizedExpression:
            case ts.SyntaxKind.ArrayLiteralExpression:
            case ts.SyntaxKind.ObjectLiteralExpression:
                current = parent;
                break;
            default:
                return false;
        }
    }
}
exports.isInConstContext = isInConstContext;
function isReadonlyAssignmentDeclaration(node, checker) {
    if (!isBindableObjectDefinePropertyCall(node))
        return false;
    const descriptorType = checker.getTypeAtLocation(node.arguments[2]);
    if (descriptorType.getProperty('value') === undefined)
        return descriptorType.getProperty('set') === undefined;
    const writableProp = descriptorType.getProperty('writable');
    if (writableProp === undefined)
        return false;
    const writableType = writableProp.valueDeclaration !== undefined && node_1.isPropertyAssignment(writableProp.valueDeclaration)
        ? checker.getTypeAtLocation(writableProp.valueDeclaration.initializer)
        : checker.getTypeOfSymbolAtLocation(writableProp, node.arguments[2]);
    return type_1.isBooleanLiteralType(writableType, false);
}
exports.isReadonlyAssignmentDeclaration = isReadonlyAssignmentDeclaration;
function isBindableObjectDefinePropertyCall(node) {
    return node.arguments.length === 3 &&
        node_1.isEntityNameExpression(node.arguments[0]) &&
        node_1.isNumericOrStringLikeLiteral(node.arguments[1]) &&
        node_1.isPropertyAccessExpression(node.expression) &&
        node.expression.name.escapedText === 'defineProperty' &&
        node_1.isIdentifier(node.expression.expression) &&
        node.expression.expression.escapedText === 'Object';
}
exports.isBindableObjectDefinePropertyCall = isBindableObjectDefinePropertyCall;
function isWellKnownSymbolLiterally(node) {
    return ts.isPropertyAccessExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.escapedText === 'Symbol';
}
exports.isWellKnownSymbolLiterally = isWellKnownSymbolLiterally;
function getPropertyNameOfWellKnownSymbol(node) {
    return {
        displayName: `[Symbol.${node.name.text}]`,
        symbolName: ('__@' + node.name.text),
    };
}
exports.getPropertyNameOfWellKnownSymbol = getPropertyNameOfWellKnownSymbol;
function getLateBoundPropertyNames(node, checker) {
    const result = {
        known: true,
        names: [],
    };
    node = unwrapParentheses(node);
    if (isWellKnownSymbolLiterally(node)) {
        result.names.push(getPropertyNameOfWellKnownSymbol(node));
    }
    else {
        const type = checker.getTypeAtLocation(node);
        for (const key of type_1.unionTypeParts(checker.getBaseConstraintOfType(type) || type)) {
            const propertyName = type_1.getPropertyNameFromType(key);
            if (propertyName) {
                result.names.push(propertyName);
            }
            else {
                result.known = false;
            }
        }
    }
    return result;
}
exports.getLateBoundPropertyNames = getLateBoundPropertyNames;
function getLateBoundPropertyNamesOfPropertyName(node, checker) {
    const staticName = getPropertyName(node);
    return staticName !== undefined
        ? { known: true, names: [{ displayName: staticName, symbolName: ts.escapeLeadingUnderscores(staticName) }] }
        : getLateBoundPropertyNames(node.expression, checker);
}
exports.getLateBoundPropertyNamesOfPropertyName = getLateBoundPropertyNamesOfPropertyName;
function getSingleLateBoundPropertyNameOfPropertyName(node, checker) {
    const staticName = getPropertyName(node);
    if (staticName !== undefined)
        return { displayName: staticName, symbolName: ts.escapeLeadingUnderscores(staticName) };
    const { expression } = node;
    return isWellKnownSymbolLiterally(expression)
        ? getPropertyNameOfWellKnownSymbol(expression)
        : type_1.getPropertyNameFromType(checker.getTypeAtLocation(expression));
}
exports.getSingleLateBoundPropertyNameOfPropertyName = getSingleLateBoundPropertyNameOfPropertyName;
function unwrapParentheses(node) {
    while (node.kind === ts.SyntaxKind.ParenthesizedExpression)
        node = node.expression;
    return node;
}
exports.unwrapParentheses = unwrapParentheses;
