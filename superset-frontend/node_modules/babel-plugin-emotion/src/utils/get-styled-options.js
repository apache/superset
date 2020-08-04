// @flow
import { getLabelFromPath } from './label'
import { getTargetClassName } from './get-target-class-name'

const getKnownProperties = (t: *, node: *) =>
  new Set(
    node.properties
      .filter(n => t.isObjectProperty(n) && !n.computed)
      .map(n => (t.isIdentifier(n.key) ? n.key.name : n.key.value))
  )

export let getStyledOptions = (t: *, path: *, state: *) => {
  let args = path.node.arguments
  let optionsArgument = args.length >= 2 ? args[1] : null

  let properties = []
  let knownProperties =
    optionsArgument && t.isObjectExpression(optionsArgument)
      ? getKnownProperties(t, optionsArgument)
      : new Set()

  if (!knownProperties.has('target')) {
    properties.push(
      t.objectProperty(
        t.identifier('target'),
        t.stringLiteral(getTargetClassName(state, t))
      )
    )
  }

  let label = getLabelFromPath(path, state, t)
  if (label && !knownProperties.has('label')) {
    properties.push(
      t.objectProperty(t.identifier('label'), t.stringLiteral(label))
    )
  }

  if (optionsArgument) {
    if (!t.isObjectExpression(optionsArgument)) {
      return t.callExpression(state.file.addHelper('extends'), [
        t.objectExpression([]),
        t.objectExpression(properties),
        optionsArgument
      ])
    }

    properties.unshift(...optionsArgument.properties)
  }

  return t.objectExpression(
    // $FlowFixMe
    properties
  )
}
