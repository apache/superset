// @flow

// this only works correctly in modules, but we don't run on scripts anyway, so it's fine
// the difference is that in modules template objects are being cached per call site
export function getTypeScriptMakeTemplateObjectPath(path: *) {
  if (path.node.arguments.length === 0) {
    return null
  }

  const firstArgPath = path.get('arguments')[0]

  if (
    firstArgPath.isLogicalExpression() &&
    firstArgPath.get('left').isIdentifier() &&
    firstArgPath.get('right').isAssignmentExpression() &&
    firstArgPath.get('right.right').isCallExpression() &&
    firstArgPath.get('right.right.callee').isIdentifier() &&
    firstArgPath.node.right.right.callee.name.includes('makeTemplateObject') &&
    firstArgPath.node.right.right.arguments.length === 2
  ) {
    return firstArgPath.get('right.right')
  }

  return null
}
