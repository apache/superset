import sankeyDiagram from '../src/diagram'
import sankey from '../src/sankey.js'

import getBody from './get-document-body'
import { select } from 'd3-selection'
import { schemeCategory10, scaleOrdinal } from 'd3-scale'
import test from 'tape'

test('diagram: renders something and updates', t => {
  // prepare data
  const s = sankey().size([600, 400])
  const graph = s(exampleBlastFurnace())

  // diagram -- disable transitions
  const diagram = sankeyDiagram()
  const el = select(getBody()).append('div')

  el.datum(graph).call(diagram)

  t.equal(el.selectAll('.node').size(), graph.nodes.length,
          'right number of nodes')

  t.equal(el.selectAll('.link').size(), graph.links.length,
          'right number of links')

  // update
  const h0 = getNodeHeights(el)

  graph.links.forEach(e => { e.value *= 1.1 })
  el.datum(s(graph)).call(diagram)

  const h1 = getNodeHeights(el)

  for (let i = 0; i < h0.length; ++i) {
    t.ok(h1[i] > h0[i], 'height updates ' + i)
  }
  t.end()
})

function getNodeHeights (el) {
  const h = []
  el.selectAll('.node').each(function () {
    h.push(parseFloat(select(this).select('rect').attr('height')))
  })
  return h
}

test('diagram: types', t => {
  const graph = exampleLinkTypes()
  sankey()(graph)

  const color = scaleOrdinal(schemeCategory10)
  const diagram = sankeyDiagram()

  const el = render(graph, diagram)

  t.equal(el.selectAll('.node').size(), 4,
          'right number of nodes')

  t.equal(el.selectAll('.link').size(), 5,
          'right number of links')

  t.end()
})

test('diagram: types 2', t => {
  const example = exampleLinkTypes2()
  sankey()(example)

  const color = scaleOrdinal(schemeCategory10)
  const diagram = sankeyDiagram();

  const el = render(example, diagram)

  t.equal(el.selectAll('.node').size(), 5,
          'right number of nodes')

  t.equal(el.selectAll('.link').size(), 9,
          'right number of links')

  t.end()
})

test('diagram: node value labels are not shown by default', t => {
  const example = exampleLinkTypes()
  sankey()(example)

  const diagram = sankeyDiagram()
  const el = render(example, diagram)

  const labels = el.selectAll('.node').select('.node-title').nodes()
        .map(node => node.textContent)

  t.deepEqual(labels, ['a', 'b', 'c', 'd'], 'right labels')

  const values = el.selectAll('.node').select('.node-value').nodes()
        .map(node => node.textContent)

  t.deepEqual(values, ['', '', '', ''], 'right value labels')

  t.end()
})


test('diagram: node labels (narrow nodes)', t => {
  const example = exampleLinkTypes()
  sankey()(example)

  const diagram = sankeyDiagram().nodeValue(d => d.value)
  const el = render(example, diagram)

  const labels = el.selectAll('.node').select('.node-title').nodes()
        .map(node => node.textContent)

  t.deepEqual(labels, ['a (4)', 'b (4)', 'c (3)', 'd (1)'], 'right labels')

  const values = el.selectAll('.node').select('.node-value').nodes()
        .map(node => node.textContent)

  t.deepEqual(values, ['4', '4', '3', '1'], 'right value labels')

  t.end()
})


test('diagram: node labels (wide nodes)', t => {
  // when nodes are wide, the labels are shown separately

  const example = exampleLinkTypes()
  sankey().nodeWidth(30)(example)

  const diagram = sankeyDiagram().nodeValue(d => d.value)
  const el = render(example, diagram)

  const labels = el.selectAll('.node').select('.node-title').nodes()
        .map(node => node.textContent)

  t.deepEqual(labels, ['a', 'b', 'c', 'd'], 'right labels')

  const values = el.selectAll('.node').select('.node-value').nodes()
        .map(node => node.textContent)

  t.deepEqual(values, ['4', '4', '3', '1'], 'right value labels')

  t.end()
})
// test('diagram: link attributes', t => {
//   const links = [
//     {source: 'a', target: 'b', value: 2, type: 'x',
//      color: 'red'},
//   ];

//   function customLink(link) {
//     link
//       .attr('class', d => `link type-${d.data.type}`)
//       .style('fill', d => d.data.color)
//       .style('opacity', d => 1 / d.data.value);
//   }

//   const diagram = sankeyDiagram()
//         .nodeTitle(d => `Node ${d.id}`)
//         .linkTypeTitle(d => `Type: ${d.data.type}`)
//         .link(customLink);

//   const el = render({links}, diagram),
//         link = el.selectAll('.link');

//   t.deepEqual(d3.rgb(link.style('fill')), d3.rgb('red'), 'link color');
//   t.equal(link.style('opacity'), '0.5', 'link opacity');
//   t.equal(link.attr('class'), 'link type-x', 'link class');
//   t.equal(link.select('title').text(),
//           'Node a → Node b\nType: x\n2.00', 'link title');

//   diagram
//     .nodeTitle('node')
//     .linkTypeTitle('z');

//   const el2 = render({links}, diagram),
//         link2 = el2.selectAll('.link');

//   t.equal(link2.select('title').text(),
//           'node → node\nz\n2.00', 'link title (const)');

//   t.end();
// });

// test('diagram: node attributes', t => {
//   const links = [
//     {source: 'a', target: 'b', value: 2}
//   ];

//   function customNode(node) {
//     node
//       .attr('class', 'node myclass');
//   }

//   // disable transitions
//   const diagram = sankeyDiagram()
//   const el = render({links}, diagram);

//   t.equal(el.selectAll('.node').attr('class'), 'node', 'node class before');

//   diagram.node(customNode);
//   el.call(diagram);

//   t.equal(el.selectAll('.node').attr('class'), 'node myclass', 'node class after');

//   t.end();
// });

function render (datum, diagram) {
  const el = select(getBody()).append('div')
  el.datum(datum).call(diagram)
  return el
}

function exampleBlastFurnace () {
  // Simplified example of links through coke oven and blast furnace
  const nodes = [
    {id: 'input'},
    {id: 'oven'},
    {id: 'coke'},
    {id: 'sinter'},
    {id: 'bf'},
    {id: 'output'},
    {id: 'export'}
  ]

  const links = [
    // main flow
    {source: 'input', target: 'oven', value: 2.5},
    {source: 'oven', target: 'coke', value: 2.5},
    {source: 'coke', target: 'sinter', value: 1},
    {source: 'coke', target: 'bf', value: 1.5},
    {source: 'sinter', target: 'bf', value: 1},
    {source: 'bf', target: 'output', value: 1},
    {source: 'bf', target: 'export', value: 1},

    // additional export links, and input-sinter
    {source: 'sinter', target: 'export', value: 0.2},
    {source: 'oven', target: 'export', value: 0.2},
    {source: 'input', target: 'sinter', value: 0.2},

    // return loops
    {source: 'oven', target: 'input', value: 0.5},
    {source: 'bf', target: 'input', value: 0.5}
  ]

  return {nodes, links}
}

function exampleLinkTypes () {
  const nodes = [
    {id: 'a'},
    {id: 'b'},
    {id: 'c'},
    {id: 'd'}
  ]

  const links = [
    {source: 'a', target: 'b', value: 2, type: 'x'},
    {source: 'a', target: 'b', value: 2, type: 'y'},
    {source: 'b', target: 'c', value: 1, type: 'x'},
    {source: 'b', target: 'c', value: 2, type: 'y'},
    {source: 'b', target: 'd', value: 1, type: 'x'}
  ]

  return {nodes, links}
}

function exampleLinkTypes2 () {
  // this sometimes fails in Safari
  return {
    nodes: [
      { id: 'a', title: 'a' },
      { id: 'b', title: 'b' },
      { id: 'c', title: 'c' },
      { id: 'x', title: 'd' },
      { id: 'y', title: 'e' }
    ],
    links: [
      { source: 'a', target: 'x', value: 1.0, type: 'x' },
      { source: 'a', target: 'y', value: 0.7, type: 'y' },
      { source: 'a', target: 'y', value: 0.3, type: 'z' },

      { source: 'b', target: 'x', value: 2.0, type: 'x' },
      { source: 'b', target: 'y', value: 0.3, type: 'y' },
      { source: 'b', target: 'y', value: 0.9, type: 'z' },

      { source: 'x', target: 'c', value: 3.0, type: 'x' },
      { source: 'y', target: 'c', value: 1.0, type: 'y' },
      { source: 'y', target: 'c', value: 1.2, type: 'z' }
    ]
  }
}
