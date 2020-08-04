// @flow

import type {Expression} from './expression';

/**
 * Tracks `let` bindings during expression parsing.
 * @private
 */
class Scope {
    parent: ?Scope;
    bindings: {[string]: Expression};
    constructor(parent?: Scope, bindings: Array<[string, Expression]> = []) {
        this.parent = parent;
        this.bindings = {};
        for (const [name, expression] of bindings) {
            this.bindings[name] = expression;
        }
    }

    concat(bindings: Array<[string, Expression]>) {
        return new Scope(this, bindings);
    }

    get(name: string): Expression {
        if (this.bindings[name]) { return this.bindings[name]; }
        if (this.parent) { return this.parent.get(name); }
        throw new Error(`${name} not found in scope.`);
    }

    has(name: string): boolean {
        if (this.bindings[name]) return true;
        return this.parent ? this.parent.has(name) : false;
    }
}

export default Scope;
