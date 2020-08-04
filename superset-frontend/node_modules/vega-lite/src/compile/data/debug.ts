import {entries, uniqueId} from './../../util';
import {DataFlowNode, OutputNode} from './dataflow';
import {SourceNode} from './source';

/**
 * Print debug information for dataflow tree.
 */
export function debug(node: DataFlowNode) {
  console.log(
    `${(node.constructor as any).name}${node.debugName ? `(${node.debugName})` : ''} -> ${node.children.map(c => {
      return `${(c.constructor as any).name}${c.debugName ? ` (${c.debugName})` : ''}`;
    })}`
  );
  console.log(node);
  node.children.forEach(debug);
}

/**
 * Print the dataflow tree as graphviz.
 *
 * Render the output in http://viz-js.com/.
 */
export function draw(roots: readonly DataFlowNode[]) {
  // check the graph before printing it since the logic below assumes a consistent graph
  checkLinks(roots);

  const nodes: {[key: string]: {id: string | number; label: string; hash: string | number}} = {};
  const edges: [string, string][] = [];

  function getId(node: DataFlowNode) {
    let id = node['__uniqueid'];
    if (id === undefined) {
      id = uniqueId();
      node['__uniqueid'] = id;
    }
    return id;
  }

  function getLabel(node: DataFlowNode) {
    const out = [(node.constructor as any).name.slice(0, -4)];

    if (node.debugName) {
      out.push(`<i>${node.debugName}</i>`);
    } else if (node instanceof SourceNode) {
      if (node.data.name || node.data.url) {
        out.push(`<i>${node.data.name ?? node.data.url}</i>`);
      }
    }

    const dep = node.dependentFields();
    if (dep?.size) {
      out.push(`<font color="grey" point-size="10">IN:</font> ${[...node.dependentFields()].join(', ')}`);
    }
    const prod = node.producedFields();
    if (prod?.size) {
      out.push(`<font color="grey" point-size="10">OUT:</font> ${[...node.producedFields()].join(', ')}`);
    }
    if (node instanceof OutputNode) {
      out.push(`<font color="grey" point-size="10">required:</font> ${node.isRequired()}`);
    }
    return out.join('<br/>');
  }

  function collector(node: DataFlowNode) {
    const id = getId(node);
    nodes[id] = {
      id: id,
      label: getLabel(node),
      hash:
        node instanceof SourceNode
          ? node.data.url ?? node.data.name ?? node.debugName
          : String(node.hash()).replace(/"/g, '')
    };

    for (const child of node.children) {
      edges.push([id, getId(child)]);
      collector(child);
    }
  }

  roots.forEach(n => collector(n));

  const dot = `digraph DataFlow {
  rankdir = TB;
  node [shape=record]
  ${entries(nodes)
    .map(
      ({key, value}) => `  "${key}" [
    label = <${value.label}>;
    tooltip = "[${value.id}]&#010;${value.hash}"
  ]`
    )
    .join('\n')}

  ${edges.map(([source, target]) => `"${source}" -> "${target}"`).join(' ')}
}`;

  console.log(dot);

  return dot;
}

/**
 * Iterates over a dataflow graph and checks whether all links are consistent.
 */
export function checkLinks(nodes: readonly DataFlowNode[]): boolean {
  for (const node of nodes) {
    for (const child of node.children) {
      if (child.parent !== node) {
        console.error('Dataflow graph is inconsistent.', node, child);
        return false;
      }
    }

    if (!checkLinks(node.children)) {
      return false;
    }
  }

  return true;
}
