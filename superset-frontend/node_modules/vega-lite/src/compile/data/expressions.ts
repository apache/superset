import {parse} from 'vega-expression';

function getName(node: any) {
  const name: string[] = [];

  if (node.type === 'Identifier') {
    return [node.name];
  }

  if (node.type === 'Literal') {
    return [node.value];
  }

  if (node.type === 'MemberExpression') {
    name.push(...getName(node.object));
    name.push(...getName(node.property));
  }

  return name;
}

function startsWithDatum(node: any): boolean {
  if (node.object.type === 'MemberExpression') {
    return startsWithDatum(node.object);
  }
  return node.object.name === 'datum';
}

export function getDependentFields(expression: string) {
  const ast = parse(expression);
  const dependents = new Set<string>();
  ast.visit((node: any) => {
    if (node.type === 'MemberExpression' && startsWithDatum(node)) {
      dependents.add(
        getName(node)
          .slice(1)
          .join('.')
      );
    }
  });

  return dependents;
}
