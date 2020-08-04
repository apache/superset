"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ts = require("typescript");
const node_1 = require("../typeguard/node");
function endsControlFlow(statement) {
    return getControlFlowEnd(statement).end;
}
exports.endsControlFlow = endsControlFlow;
const defaultControlFlowEnd = { statements: [], end: false };
function getControlFlowEnd(statement) {
    return node_1.isBlockLike(statement) ? handleBlock(statement) : getControlFlowEndWorker(statement);
}
exports.getControlFlowEnd = getControlFlowEnd;
function getControlFlowEndWorker(statement) {
    switch (statement.kind) {
        case ts.SyntaxKind.ReturnStatement:
        case ts.SyntaxKind.ThrowStatement:
        case ts.SyntaxKind.ContinueStatement:
        case ts.SyntaxKind.BreakStatement:
            return { statements: [statement], end: true };
        case ts.SyntaxKind.Block:
            return handleBlock(statement);
        case ts.SyntaxKind.ForStatement:
        case ts.SyntaxKind.WhileStatement:
            return handleForAndWhileStatement(statement);
        case ts.SyntaxKind.ForOfStatement:
        case ts.SyntaxKind.ForInStatement:
            return handleForInOrOfStatement(statement);
        case ts.SyntaxKind.DoStatement:
            return matchBreakOrContinue(getControlFlowEndWorker(statement.statement), node_1.isBreakOrContinueStatement);
        case ts.SyntaxKind.IfStatement:
            return handleIfStatement(statement);
        case ts.SyntaxKind.SwitchStatement:
            return matchBreakOrContinue(handleSwitchStatement(statement), node_1.isBreakStatement);
        case ts.SyntaxKind.TryStatement:
            return handleTryStatement(statement);
        case ts.SyntaxKind.LabeledStatement:
            return matchLabel(getControlFlowEndWorker(statement.statement), statement.label);
        case ts.SyntaxKind.WithStatement:
            return getControlFlowEndWorker(statement.statement);
        default:
            return defaultControlFlowEnd;
    }
}
function handleBlock(statement) {
    const result = { statements: [], end: false };
    for (const s of statement.statements) {
        const current = getControlFlowEndWorker(s);
        result.statements.push(...current.statements);
        if (current.end) {
            result.end = true;
            break;
        }
    }
    return result;
}
function handleForInOrOfStatement(statement) {
    const end = matchBreakOrContinue(getControlFlowEndWorker(statement.statement), node_1.isBreakOrContinueStatement);
    end.end = false;
    return end;
}
function handleForAndWhileStatement(statement) {
    const constantCondition = statement.kind === ts.SyntaxKind.WhileStatement
        ? getConstantCondition(statement.expression)
        : statement.condition === undefined || getConstantCondition(statement.condition);
    if (constantCondition === false)
        return defaultControlFlowEnd;
    const end = matchBreakOrContinue(getControlFlowEndWorker(statement.statement), node_1.isBreakOrContinueStatement);
    if (constantCondition === undefined)
        end.end = false;
    return end;
}
function getConstantCondition(node) {
    switch (node.kind) {
        case ts.SyntaxKind.TrueKeyword:
            return true;
        case ts.SyntaxKind.FalseKeyword:
            return false;
        default:
            return;
    }
}
function handleIfStatement(node) {
    switch (getConstantCondition(node.expression)) {
        case true:
            return getControlFlowEndWorker(node.thenStatement);
        case false:
            return node.elseStatement === undefined
                ? defaultControlFlowEnd
                : getControlFlowEndWorker(node.elseStatement);
    }
    const then = getControlFlowEndWorker(node.thenStatement);
    if (node.elseStatement === undefined)
        return {
            statements: then.statements,
            end: false,
        };
    const elze = getControlFlowEndWorker(node.elseStatement);
    return {
        statements: [...then.statements, ...elze.statements],
        end: then.end && elze.end,
    };
}
function handleSwitchStatement(node) {
    let hasDefault = false;
    const result = {
        statements: [],
        end: false,
    };
    for (const clause of node.caseBlock.clauses) {
        if (clause.kind === ts.SyntaxKind.DefaultClause)
            hasDefault = true;
        const current = handleBlock(clause);
        result.end = current.end;
        result.statements.push(...current.statements);
    }
    if (!hasDefault)
        result.end = false;
    return result;
}
function handleTryStatement(node) {
    let finallyResult;
    if (node.finallyBlock !== undefined) {
        finallyResult = handleBlock(node.finallyBlock);
        if (finallyResult.end)
            return finallyResult;
    }
    const tryResult = handleBlock(node.tryBlock);
    if (node.catchClause === undefined)
        return { statements: finallyResult.statements.concat(tryResult.statements), end: tryResult.end };
    const catchResult = handleBlock(node.catchClause.block);
    return {
        statements: tryResult.statements
            .filter((s) => s.kind !== ts.SyntaxKind.ThrowStatement)
            .concat(catchResult.statements, finallyResult === undefined ? [] : finallyResult.statements),
        end: tryResult.end && catchResult.end,
    };
}
function matchBreakOrContinue(current, pred) {
    const result = {
        statements: [],
        end: current.end,
    };
    for (const statement of current.statements) {
        if (pred(statement) && statement.label === undefined) {
            result.end = false;
            continue;
        }
        result.statements.push(statement);
    }
    return result;
}
function matchLabel(current, label) {
    const result = {
        statements: [],
        end: current.end,
    };
    const labelText = label.text;
    for (const statement of current.statements) {
        switch (statement.kind) {
            case ts.SyntaxKind.BreakStatement:
            case ts.SyntaxKind.ContinueStatement:
                if (statement.label !== undefined && statement.label.text === labelText) {
                    result.end = false;
                    continue;
                }
        }
        result.statements.push(statement);
    }
    return result;
}
