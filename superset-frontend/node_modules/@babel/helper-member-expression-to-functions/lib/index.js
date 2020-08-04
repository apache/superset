"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = memberExpressionToFunctions;

var t = _interopRequireWildcard(require("@babel/types"));

function _getRequireWildcardCache() { if (typeof WeakMap !== "function") return null; var cache = new WeakMap(); _getRequireWildcardCache = function () { return cache; }; return cache; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

class AssignmentMemoiser {
  constructor() {
    this._map = new WeakMap();
  }

  has(key) {
    return this._map.has(key);
  }

  get(key) {
    if (!this.has(key)) return;

    const record = this._map.get(key);

    const {
      value
    } = record;
    record.count--;

    if (record.count === 0) {
      return t.assignmentExpression("=", value, key);
    }

    return value;
  }

  set(key, value, count) {
    return this._map.set(key, {
      count,
      value
    });
  }

}

function toNonOptional(path, base) {
  const {
    node
  } = path;

  if (path.isOptionalMemberExpression()) {
    return t.memberExpression(base, node.property, node.computed);
  }

  if (path.isOptionalCallExpression()) {
    const callee = path.get("callee");

    if (path.node.optional && callee.isOptionalMemberExpression()) {
      const {
        object
      } = callee.node;
      const context = path.scope.maybeGenerateMemoised(object) || object;
      callee.get("object").replaceWith(t.assignmentExpression("=", context, object));
      return t.callExpression(t.memberExpression(base, t.identifier("call")), [context, ...node.arguments]);
    }

    return t.callExpression(base, node.arguments);
  }

  return path.node;
}

function isInDetachedTree(path) {
  while (path) {
    if (path.isProgram()) break;
    const {
      parentPath,
      container,
      listKey
    } = path;
    const parentNode = parentPath.node;

    if (listKey) {
      if (container !== parentNode[listKey]) return true;
    } else {
      if (container !== parentNode) return true;
    }

    path = parentPath;
  }

  return false;
}

const handle = {
  memoise() {},

  handle(member) {
    const {
      node,
      parent,
      parentPath
    } = member;

    if (member.isOptionalMemberExpression()) {
      if (isInDetachedTree(member)) return;
      const endPath = member.find(({
        node,
        parent,
        parentPath
      }) => {
        if (parentPath.isOptionalMemberExpression()) {
          return parent.optional || parent.object !== node;
        }

        if (parentPath.isOptionalCallExpression()) {
          return node !== member.node && parent.optional || parent.callee !== node;
        }

        return true;
      });
      const rootParentPath = endPath.parentPath;

      if (rootParentPath.isUpdateExpression({
        argument: node
      }) || rootParentPath.isAssignmentExpression({
        left: node
      })) {
        throw member.buildCodeFrameError(`can't handle assignment`);
      }

      if (rootParentPath.isUnaryExpression({
        operator: "delete"
      })) {
        throw member.buildCodeFrameError(`can't handle delete`);
      }

      let startingOptional = member;

      for (;;) {
        if (startingOptional.isOptionalMemberExpression()) {
          if (startingOptional.node.optional) break;
          startingOptional = startingOptional.get("object");
          continue;
        } else if (startingOptional.isOptionalCallExpression()) {
          if (startingOptional.node.optional) break;
          startingOptional = startingOptional.get("callee");
          continue;
        }

        throw new Error(`Internal error: unexpected ${startingOptional.node.type}`);
      }

      const {
        scope
      } = member;
      const startingProp = startingOptional.isOptionalMemberExpression() ? "object" : "callee";
      const startingNode = startingOptional.node[startingProp];
      const baseNeedsMemoised = scope.maybeGenerateMemoised(startingNode);
      const baseRef = baseNeedsMemoised != null ? baseNeedsMemoised : startingNode;
      const parentIsOptionalCall = parentPath.isOptionalCallExpression({
        callee: node
      });
      startingOptional.replaceWith(toNonOptional(startingOptional, baseRef));

      if (parentIsOptionalCall) {
        if (parent.optional) {
          parentPath.replaceWith(this.optionalCall(member, parent.arguments));
        } else {
          parentPath.replaceWith(this.call(member, parent.arguments));
        }
      } else {
        member.replaceWith(this.get(member));
      }

      let regular = member.node;

      for (let current = member; current !== endPath;) {
        const {
          parentPath
        } = current;

        if (parentPath === endPath && parentIsOptionalCall && parent.optional) {
          regular = parentPath.node;
          break;
        }

        regular = toNonOptional(parentPath, regular);
        current = parentPath;
      }

      let context;
      const endParentPath = endPath.parentPath;

      if (t.isMemberExpression(regular) && endParentPath.isOptionalCallExpression({
        callee: endPath.node,
        optional: true
      })) {
        const {
          object
        } = regular;
        context = member.scope.maybeGenerateMemoised(object);

        if (context) {
          regular.object = t.assignmentExpression("=", context, object);
        }
      }

      endPath.replaceWith(t.conditionalExpression(t.logicalExpression("||", t.binaryExpression("===", baseNeedsMemoised ? t.assignmentExpression("=", baseRef, startingNode) : baseRef, t.nullLiteral()), t.binaryExpression("===", t.cloneNode(baseRef), scope.buildUndefinedNode())), scope.buildUndefinedNode(), regular));

      if (context) {
        const endParent = endParentPath.node;
        endParentPath.replaceWith(t.optionalCallExpression(t.optionalMemberExpression(endParent.callee, t.identifier("call"), false, true), [context, ...endParent.arguments], false));
      }

      return;
    }

    if (parentPath.isUpdateExpression({
      argument: node
    })) {
      if (this.simpleSet) {
        member.replaceWith(this.simpleSet(member));
        return;
      }

      const {
        operator,
        prefix
      } = parent;
      this.memoise(member, 2);
      const value = t.binaryExpression(operator[0], t.unaryExpression("+", this.get(member)), t.numericLiteral(1));

      if (prefix) {
        parentPath.replaceWith(this.set(member, value));
      } else {
        const {
          scope
        } = member;
        const ref = scope.generateUidIdentifierBasedOnNode(node);
        scope.push({
          id: ref
        });
        value.left = t.assignmentExpression("=", t.cloneNode(ref), value.left);
        parentPath.replaceWith(t.sequenceExpression([this.set(member, value), t.cloneNode(ref)]));
      }

      return;
    }

    if (parentPath.isAssignmentExpression({
      left: node
    })) {
      if (this.simpleSet) {
        member.replaceWith(this.simpleSet(member));
        return;
      }

      const {
        operator,
        right
      } = parent;
      let value = right;

      if (operator !== "=") {
        this.memoise(member, 2);
        value = t.binaryExpression(operator.slice(0, -1), this.get(member), value);
      }

      parentPath.replaceWith(this.set(member, value));
      return;
    }

    if (parentPath.isCallExpression({
      callee: node
    })) {
      parentPath.replaceWith(this.call(member, parent.arguments));
      return;
    }

    if (parentPath.isOptionalCallExpression({
      callee: node
    })) {
      parentPath.replaceWith(this.optionalCall(member, parent.arguments));
      return;
    }

    if (parentPath.isObjectProperty({
      value: node
    }) && parentPath.parentPath.isObjectPattern() || parentPath.isAssignmentPattern({
      left: node
    }) && parentPath.parentPath.isObjectProperty({
      value: parent
    }) && parentPath.parentPath.parentPath.isObjectPattern() || parentPath.isArrayPattern() || parentPath.isAssignmentPattern({
      left: node
    }) && parentPath.parentPath.isArrayPattern() || parentPath.isRestElement()) {
      member.replaceWith(this.destructureSet(member));
      return;
    }

    member.replaceWith(this.get(member));
  }

};

function memberExpressionToFunctions(path, visitor, state) {
  path.traverse(visitor, Object.assign(Object.assign(Object.assign({}, handle), state), {}, {
    memoiser: new AssignmentMemoiser()
  }));
}