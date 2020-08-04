"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const util_1 = require("./util");
const ts = require("typescript");
var DeclarationDomain;
(function (DeclarationDomain) {
    DeclarationDomain[DeclarationDomain["Namespace"] = 1] = "Namespace";
    DeclarationDomain[DeclarationDomain["Type"] = 2] = "Type";
    DeclarationDomain[DeclarationDomain["Value"] = 4] = "Value";
    DeclarationDomain[DeclarationDomain["Import"] = 8] = "Import";
    DeclarationDomain[DeclarationDomain["Any"] = 7] = "Any";
})(DeclarationDomain = exports.DeclarationDomain || (exports.DeclarationDomain = {}));
var UsageDomain;
(function (UsageDomain) {
    UsageDomain[UsageDomain["Namespace"] = 1] = "Namespace";
    UsageDomain[UsageDomain["Type"] = 2] = "Type";
    UsageDomain[UsageDomain["Value"] = 4] = "Value";
    UsageDomain[UsageDomain["ValueOrNamespace"] = 5] = "ValueOrNamespace";
    UsageDomain[UsageDomain["Any"] = 7] = "Any";
    UsageDomain[UsageDomain["TypeQuery"] = 8] = "TypeQuery";
})(UsageDomain = exports.UsageDomain || (exports.UsageDomain = {}));
function getUsageDomain(node) {
    const parent = node.parent;
    switch (parent.kind) {
        case ts.SyntaxKind.TypeReference:
            return node.originalKeywordKind !== ts.SyntaxKind.ConstKeyword ? 2 : undefined;
        case ts.SyntaxKind.ExpressionWithTypeArguments:
            return parent.parent.token === ts.SyntaxKind.ImplementsKeyword ||
                parent.parent.parent.kind === ts.SyntaxKind.InterfaceDeclaration
                ? 2
                : 4;
        case ts.SyntaxKind.TypeQuery:
            return 5 | 8;
        case ts.SyntaxKind.QualifiedName:
            if (parent.left === node) {
                if (getEntityNameParent(parent).kind === ts.SyntaxKind.TypeQuery)
                    return 1 | 8;
                return 1;
            }
            break;
        case ts.SyntaxKind.ExportSpecifier:
            if (parent.propertyName === undefined ||
                parent.propertyName === node)
                return 7;
            break;
        case ts.SyntaxKind.ExportAssignment:
            return 7;
        case ts.SyntaxKind.BindingElement:
            if (parent.initializer === node)
                return 5;
            break;
        case ts.SyntaxKind.Parameter:
        case ts.SyntaxKind.EnumMember:
        case ts.SyntaxKind.PropertyDeclaration:
        case ts.SyntaxKind.VariableDeclaration:
        case ts.SyntaxKind.PropertyAssignment:
        case ts.SyntaxKind.PropertyAccessExpression:
        case ts.SyntaxKind.ImportEqualsDeclaration:
            if (parent.name !== node)
                return 5;
            break;
        case ts.SyntaxKind.JsxAttribute:
        case ts.SyntaxKind.FunctionDeclaration:
        case ts.SyntaxKind.FunctionExpression:
        case ts.SyntaxKind.NamespaceImport:
        case ts.SyntaxKind.ClassDeclaration:
        case ts.SyntaxKind.ClassExpression:
        case ts.SyntaxKind.ModuleDeclaration:
        case ts.SyntaxKind.MethodDeclaration:
        case ts.SyntaxKind.EnumDeclaration:
        case ts.SyntaxKind.GetAccessor:
        case ts.SyntaxKind.SetAccessor:
        case ts.SyntaxKind.LabeledStatement:
        case ts.SyntaxKind.BreakStatement:
        case ts.SyntaxKind.ContinueStatement:
        case ts.SyntaxKind.ImportClause:
        case ts.SyntaxKind.ImportSpecifier:
        case ts.SyntaxKind.TypePredicate:
        case ts.SyntaxKind.MethodSignature:
        case ts.SyntaxKind.PropertySignature:
        case ts.SyntaxKind.NamespaceExportDeclaration:
        case ts.SyntaxKind.InterfaceDeclaration:
        case ts.SyntaxKind.TypeAliasDeclaration:
        case ts.SyntaxKind.TypeParameter:
            break;
        default:
            return 5;
    }
}
exports.getUsageDomain = getUsageDomain;
function getDeclarationDomain(node) {
    switch (node.parent.kind) {
        case ts.SyntaxKind.TypeParameter:
        case ts.SyntaxKind.InterfaceDeclaration:
        case ts.SyntaxKind.TypeAliasDeclaration:
            return 2;
        case ts.SyntaxKind.ClassDeclaration:
        case ts.SyntaxKind.ClassExpression:
            return 2 | 4;
        case ts.SyntaxKind.EnumDeclaration:
            return 7;
        case ts.SyntaxKind.NamespaceImport:
        case ts.SyntaxKind.ImportClause:
            return 7 | 8;
        case ts.SyntaxKind.ImportEqualsDeclaration:
        case ts.SyntaxKind.ImportSpecifier:
            return node.parent.name === node
                ? 7 | 8
                : undefined;
        case ts.SyntaxKind.ModuleDeclaration:
            return 1;
        case ts.SyntaxKind.Parameter:
            if (node.parent.parent.kind === ts.SyntaxKind.IndexSignature || node.originalKeywordKind === ts.SyntaxKind.ThisKeyword)
                return;
        case ts.SyntaxKind.BindingElement:
        case ts.SyntaxKind.VariableDeclaration:
            return node.parent.name === node ? 4 : undefined;
        case ts.SyntaxKind.FunctionDeclaration:
        case ts.SyntaxKind.FunctionExpression:
            return 4;
    }
}
exports.getDeclarationDomain = getDeclarationDomain;
function collectVariableUsage(sourceFile) {
    return new UsageWalker().getUsage(sourceFile);
}
exports.collectVariableUsage = collectVariableUsage;
class AbstractScope {
    constructor(_global) {
        this._global = _global;
        this._variables = new Map();
        this._uses = [];
        this._namespaceScopes = undefined;
        this._enumScopes = undefined;
    }
    addVariable(identifier, name, selector, exported, domain) {
        const variables = this.getDestinationScope(selector).getVariables();
        const declaration = {
            domain,
            exported,
            declaration: name,
        };
        const variable = variables.get(identifier);
        if (variable === undefined) {
            variables.set(identifier, {
                domain,
                declarations: [declaration],
                uses: [],
            });
        }
        else {
            variable.domain |= domain;
            variable.declarations.push(declaration);
        }
    }
    addUse(use) {
        this._uses.push(use);
    }
    getVariables() {
        return this._variables;
    }
    getFunctionScope() {
        return this;
    }
    end(cb) {
        if (this._namespaceScopes !== undefined)
            this._namespaceScopes.forEach((value) => value.finish(cb));
        this._namespaceScopes = this._enumScopes = undefined;
        this._applyUses();
        this._variables.forEach((variable) => {
            for (const declaration of variable.declarations) {
                const result = {
                    declarations: [],
                    domain: declaration.domain,
                    exported: declaration.exported,
                    inGlobalScope: this._global,
                    uses: [],
                };
                for (const other of variable.declarations)
                    if (other.domain & declaration.domain)
                        result.declarations.push(other.declaration);
                for (const use of variable.uses)
                    if (use.domain & declaration.domain)
                        result.uses.push(use);
                cb(result, declaration.declaration, this);
            }
        });
    }
    markExported(_name) { }
    createOrReuseNamespaceScope(name, _exported, ambient, hasExportStatement) {
        let scope;
        if (this._namespaceScopes === undefined) {
            this._namespaceScopes = new Map();
        }
        else {
            scope = this._namespaceScopes.get(name);
        }
        if (scope === undefined) {
            scope = new NamespaceScope(ambient, hasExportStatement, this);
            this._namespaceScopes.set(name, scope);
        }
        else {
            scope.refresh(ambient, hasExportStatement);
        }
        return scope;
    }
    createOrReuseEnumScope(name, _exported) {
        let scope;
        if (this._enumScopes === undefined) {
            this._enumScopes = new Map();
        }
        else {
            scope = this._enumScopes.get(name);
        }
        if (scope === undefined) {
            scope = new EnumScope(this);
            this._enumScopes.set(name, scope);
        }
        return scope;
    }
    _applyUses() {
        for (const use of this._uses)
            if (!this._applyUse(use))
                this._addUseToParent(use);
        this._uses = [];
    }
    _applyUse(use, variables = this._variables) {
        const variable = variables.get(use.location.text);
        if (variable === undefined || (variable.domain & use.domain) === 0)
            return false;
        variable.uses.push(use);
        return true;
    }
    _addUseToParent(_use) { }
}
class RootScope extends AbstractScope {
    constructor(_exportAll, global) {
        super(global);
        this._exportAll = _exportAll;
        this._exports = undefined;
        this._innerScope = new NonRootScope(this, 1);
    }
    addVariable(identifier, name, selector, exported, domain) {
        if (domain & 8)
            return super.addVariable(identifier, name, selector, exported, domain);
        return this._innerScope.addVariable(identifier, name, selector, exported, domain);
    }
    addUse(use, origin) {
        if (origin === this._innerScope)
            return super.addUse(use);
        return this._innerScope.addUse(use);
    }
    markExported(id) {
        if (this._exports === undefined) {
            this._exports = [id.text];
        }
        else {
            this._exports.push(id.text);
        }
    }
    end(cb) {
        this._innerScope.end((value, key) => {
            value.exported = value.exported || this._exportAll
                || this._exports !== undefined && this._exports.includes(key.text);
            value.inGlobalScope = this._global;
            return cb(value, key, this);
        });
        return super.end((value, key, scope) => {
            value.exported = value.exported || scope === this
                && this._exports !== undefined && this._exports.includes(key.text);
            return cb(value, key, scope);
        });
    }
    getDestinationScope() {
        return this;
    }
}
class NonRootScope extends AbstractScope {
    constructor(_parent, _boundary) {
        super(false);
        this._parent = _parent;
        this._boundary = _boundary;
    }
    _addUseToParent(use) {
        return this._parent.addUse(use, this);
    }
    getDestinationScope(selector) {
        return this._boundary & selector
            ? this
            : this._parent.getDestinationScope(selector);
    }
}
class EnumScope extends NonRootScope {
    constructor(parent) {
        super(parent, 1);
    }
    end() {
        this._applyUses();
    }
}
class ConditionalTypeScope extends NonRootScope {
    constructor(parent) {
        super(parent, 8);
        this._state = 0;
    }
    updateState(newState) {
        this._state = newState;
    }
    addUse(use) {
        if (this._state === 2)
            return void this._uses.push(use);
        return this._parent.addUse(use, this);
    }
}
class FunctionScope extends NonRootScope {
    constructor(parent) {
        super(parent, 1);
    }
    beginBody() {
        this._applyUses();
    }
}
class AbstractNamedExpressionScope extends NonRootScope {
    constructor(_name, _domain, parent) {
        super(parent, 1);
        this._name = _name;
        this._domain = _domain;
    }
    end(cb) {
        this._innerScope.end(cb);
        return cb({
            declarations: [this._name],
            domain: this._domain,
            exported: false,
            uses: this._uses,
            inGlobalScope: false,
        }, this._name, this);
    }
    addUse(use, source) {
        if (source !== this._innerScope)
            return this._innerScope.addUse(use);
        if (use.domain & this._domain && use.location.text === this._name.text) {
            this._uses.push(use);
        }
        else {
            return this._parent.addUse(use, this);
        }
    }
    getFunctionScope() {
        return this._innerScope;
    }
    getDestinationScope() {
        return this._innerScope;
    }
}
class FunctionExpressionScope extends AbstractNamedExpressionScope {
    constructor(name, parent) {
        super(name, 4, parent);
        this._innerScope = new FunctionScope(this);
    }
    beginBody() {
        return this._innerScope.beginBody();
    }
}
class ClassExpressionScope extends AbstractNamedExpressionScope {
    constructor(name, parent) {
        super(name, 4 | 2, parent);
        this._innerScope = new NonRootScope(this, 1);
    }
}
class BlockScope extends NonRootScope {
    constructor(_functionScope, parent) {
        super(parent, 2);
        this._functionScope = _functionScope;
    }
    getFunctionScope() {
        return this._functionScope;
    }
}
function mapDeclaration(declaration) {
    return {
        declaration,
        exported: true,
        domain: getDeclarationDomain(declaration),
    };
}
class NamespaceScope extends NonRootScope {
    constructor(_ambient, _hasExport, parent) {
        super(parent, 1);
        this._ambient = _ambient;
        this._hasExport = _hasExport;
        this._innerScope = new NonRootScope(this, 1);
        this._exports = undefined;
    }
    finish(cb) {
        return super.end(cb);
    }
    end(cb) {
        this._innerScope.end((variable, key, scope) => {
            if (scope !== this._innerScope ||
                !variable.exported && (!this._ambient || this._exports !== undefined && !this._exports.has(key.text)))
                return cb(variable, key, scope);
            const namespaceVar = this._variables.get(key.text);
            if (namespaceVar === undefined) {
                this._variables.set(key.text, {
                    declarations: variable.declarations.map(mapDeclaration),
                    domain: variable.domain,
                    uses: [...variable.uses],
                });
            }
            else {
                outer: for (const declaration of variable.declarations) {
                    for (const existing of namespaceVar.declarations)
                        if (existing.declaration === declaration)
                            continue outer;
                    namespaceVar.declarations.push(mapDeclaration(declaration));
                }
                namespaceVar.domain |= variable.domain;
                for (const use of variable.uses) {
                    if (namespaceVar.uses.includes(use))
                        continue;
                    namespaceVar.uses.push(use);
                }
            }
        });
        this._applyUses();
        this._innerScope = new NonRootScope(this, 1);
    }
    createOrReuseNamespaceScope(name, exported, ambient, hasExportStatement) {
        if (!exported && (!this._ambient || this._hasExport))
            return this._innerScope.createOrReuseNamespaceScope(name, exported, ambient || this._ambient, hasExportStatement);
        return super.createOrReuseNamespaceScope(name, exported, ambient || this._ambient, hasExportStatement);
    }
    createOrReuseEnumScope(name, exported) {
        if (!exported && (!this._ambient || this._hasExport))
            return this._innerScope.createOrReuseEnumScope(name, exported);
        return super.createOrReuseEnumScope(name, exported);
    }
    addUse(use, source) {
        if (source !== this._innerScope)
            return this._innerScope.addUse(use);
        this._uses.push(use);
    }
    refresh(ambient, hasExport) {
        this._ambient = ambient;
        this._hasExport = hasExport;
    }
    markExported(name, _as) {
        if (this._exports === undefined)
            this._exports = new Set();
        this._exports.add(name.text);
    }
    getDestinationScope() {
        return this._innerScope;
    }
}
function getEntityNameParent(name) {
    let parent = name.parent;
    while (parent.kind === ts.SyntaxKind.QualifiedName)
        parent = parent.parent;
    return parent;
}
class UsageWalker {
    constructor() {
        this._result = new Map();
    }
    getUsage(sourceFile) {
        const variableCallback = (variable, key) => {
            this._result.set(key, variable);
        };
        const isModule = ts.isExternalModule(sourceFile);
        this._scope = new RootScope(sourceFile.isDeclarationFile && isModule && !containsExportStatement(sourceFile), !isModule);
        const cb = (node) => {
            if (util_1.isBlockScopeBoundary(node))
                return continueWithScope(node, new BlockScope(this._scope.getFunctionScope(), this._scope), handleBlockScope);
            switch (node.kind) {
                case ts.SyntaxKind.ClassExpression:
                    return continueWithScope(node, node.name !== undefined
                        ? new ClassExpressionScope(node.name, this._scope)
                        : new NonRootScope(this._scope, 1));
                case ts.SyntaxKind.ClassDeclaration:
                    this._handleDeclaration(node, true, 4 | 2);
                    return continueWithScope(node, new NonRootScope(this._scope, 1));
                case ts.SyntaxKind.InterfaceDeclaration:
                case ts.SyntaxKind.TypeAliasDeclaration:
                    this._handleDeclaration(node, true, 2);
                    return continueWithScope(node, new NonRootScope(this._scope, 4));
                case ts.SyntaxKind.EnumDeclaration:
                    this._handleDeclaration(node, true, 7);
                    return continueWithScope(node, this._scope.createOrReuseEnumScope(node.name.text, util_1.hasModifier(node.modifiers, ts.SyntaxKind.ExportKeyword)));
                case ts.SyntaxKind.ModuleDeclaration:
                    return this._handleModule(node, continueWithScope);
                case ts.SyntaxKind.MappedType:
                    return continueWithScope(node, new NonRootScope(this._scope, 4));
                case ts.SyntaxKind.FunctionExpression:
                case ts.SyntaxKind.ArrowFunction:
                case ts.SyntaxKind.Constructor:
                case ts.SyntaxKind.MethodDeclaration:
                case ts.SyntaxKind.FunctionDeclaration:
                case ts.SyntaxKind.GetAccessor:
                case ts.SyntaxKind.SetAccessor:
                case ts.SyntaxKind.MethodSignature:
                case ts.SyntaxKind.CallSignature:
                case ts.SyntaxKind.ConstructSignature:
                case ts.SyntaxKind.ConstructorType:
                case ts.SyntaxKind.FunctionType:
                    return this._handleFunctionLikeDeclaration(node, cb, variableCallback);
                case ts.SyntaxKind.ConditionalType:
                    return this._handleConditionalType(node, cb, variableCallback);
                case ts.SyntaxKind.VariableDeclarationList:
                    this._handleVariableDeclaration(node);
                    break;
                case ts.SyntaxKind.Parameter:
                    if (node.parent.kind !== ts.SyntaxKind.IndexSignature &&
                        (node.name.kind !== ts.SyntaxKind.Identifier ||
                            node.name.originalKeywordKind !== ts.SyntaxKind.ThisKeyword))
                        this._handleBindingName(node.name, false, false);
                    break;
                case ts.SyntaxKind.EnumMember:
                    this._scope.addVariable(util_1.getPropertyName(node.name), node.name, 1, true, 4);
                    break;
                case ts.SyntaxKind.ImportClause:
                case ts.SyntaxKind.ImportSpecifier:
                case ts.SyntaxKind.NamespaceImport:
                case ts.SyntaxKind.ImportEqualsDeclaration:
                    this._handleDeclaration(node, false, 7 | 8);
                    break;
                case ts.SyntaxKind.TypeParameter:
                    this._scope.addVariable(node.name.text, node.name, node.parent.kind === ts.SyntaxKind.InferType ? 8 : 7, false, 2);
                    break;
                case ts.SyntaxKind.ExportSpecifier:
                    if (node.propertyName !== undefined)
                        return this._scope.markExported(node.propertyName, node.name);
                    return this._scope.markExported(node.name);
                case ts.SyntaxKind.ExportAssignment:
                    if (node.expression.kind === ts.SyntaxKind.Identifier)
                        return this._scope.markExported(node.expression);
                    break;
                case ts.SyntaxKind.Identifier:
                    const domain = getUsageDomain(node);
                    if (domain !== undefined)
                        this._scope.addUse({ domain, location: node });
                    return;
            }
            return ts.forEachChild(node, cb);
        };
        const continueWithScope = (node, scope, next = forEachChild) => {
            const savedScope = this._scope;
            this._scope = scope;
            next(node);
            this._scope.end(variableCallback);
            this._scope = savedScope;
        };
        const handleBlockScope = (node) => {
            if (node.kind === ts.SyntaxKind.CatchClause && node.variableDeclaration !== undefined)
                this._handleBindingName(node.variableDeclaration.name, true, false);
            return ts.forEachChild(node, cb);
        };
        ts.forEachChild(sourceFile, cb);
        this._scope.end(variableCallback);
        return this._result;
        function forEachChild(node) {
            return ts.forEachChild(node, cb);
        }
    }
    _handleConditionalType(node, cb, varCb) {
        const savedScope = this._scope;
        const scope = this._scope = new ConditionalTypeScope(savedScope);
        cb(node.checkType);
        scope.updateState(1);
        cb(node.extendsType);
        scope.updateState(2);
        cb(node.trueType);
        scope.updateState(3);
        cb(node.falseType);
        scope.end(varCb);
        this._scope = savedScope;
    }
    _handleFunctionLikeDeclaration(node, cb, varCb) {
        if (node.decorators !== undefined)
            node.decorators.forEach(cb);
        const savedScope = this._scope;
        if (node.kind === ts.SyntaxKind.FunctionDeclaration)
            this._handleDeclaration(node, false, 4);
        const scope = this._scope = node.kind === ts.SyntaxKind.FunctionExpression && node.name !== undefined
            ? new FunctionExpressionScope(node.name, savedScope)
            : new FunctionScope(savedScope);
        if (node.name !== undefined)
            cb(node.name);
        if (node.typeParameters !== undefined)
            node.typeParameters.forEach(cb);
        node.parameters.forEach(cb);
        if (node.type !== undefined)
            cb(node.type);
        if (node.body !== undefined) {
            scope.beginBody();
            cb(node.body);
        }
        scope.end(varCb);
        this._scope = savedScope;
    }
    _handleModule(node, next) {
        if (node.flags & ts.NodeFlags.GlobalAugmentation)
            return next(node, this._scope.createOrReuseNamespaceScope('-global', false, true, false));
        if (node.name.kind === ts.SyntaxKind.Identifier) {
            const exported = isNamespaceExported(node);
            this._scope.addVariable(node.name.text, node.name, 1, exported, 1 | 4);
            const ambient = util_1.hasModifier(node.modifiers, ts.SyntaxKind.DeclareKeyword);
            return next(node, this._scope.createOrReuseNamespaceScope(node.name.text, exported, ambient, ambient && namespaceHasExportStatement(node)));
        }
        return next(node, this._scope.createOrReuseNamespaceScope(`"${node.name.text}"`, false, true, namespaceHasExportStatement(node)));
    }
    _handleDeclaration(node, blockScoped, domain) {
        if (node.name !== undefined)
            this._scope.addVariable(node.name.text, node.name, blockScoped ? 3 : 1, util_1.hasModifier(node.modifiers, ts.SyntaxKind.ExportKeyword), domain);
    }
    _handleBindingName(name, blockScoped, exported) {
        if (name.kind === ts.SyntaxKind.Identifier)
            return this._scope.addVariable(name.text, name, blockScoped ? 3 : 1, exported, 4);
        util_1.forEachDestructuringIdentifier(name, (declaration) => {
            this._scope.addVariable(declaration.name.text, declaration.name, blockScoped ? 3 : 1, exported, 4);
        });
    }
    _handleVariableDeclaration(declarationList) {
        const blockScoped = util_1.isBlockScopedVariableDeclarationList(declarationList);
        const exported = declarationList.parent.kind === ts.SyntaxKind.VariableStatement &&
            util_1.hasModifier(declarationList.parent.modifiers, ts.SyntaxKind.ExportKeyword);
        for (const declaration of declarationList.declarations)
            this._handleBindingName(declaration.name, blockScoped, exported);
    }
}
function isNamespaceExported(node) {
    return node.parent.kind === ts.SyntaxKind.ModuleDeclaration || util_1.hasModifier(node.modifiers, ts.SyntaxKind.ExportKeyword);
}
function namespaceHasExportStatement(ns) {
    if (ns.body === undefined || ns.body.kind !== ts.SyntaxKind.ModuleBlock)
        return false;
    return containsExportStatement(ns.body);
}
function containsExportStatement(block) {
    for (const statement of block.statements)
        if (statement.kind === ts.SyntaxKind.ExportDeclaration || statement.kind === ts.SyntaxKind.ExportAssignment)
            return true;
    return false;
}
