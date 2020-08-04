import sankeyDiagram from '../src/diagram';
import sankey from '../src/sankey.js'

import getBody from './get-document-body';
import { select } from 'd3-selection';
import { timerFlush } from 'd3-timer'
import test from 'tape';


test('groups: draws box around nodes', t => {
  // prepare data
  const graph = {
    nodes: [
      {id: 'a1'},
      {id: 'a2'},
      {id: 'b'}
    ],
    links: [
      {source: 'a1', target: 'b', value: 1},
      {source: 'a2', target: 'b', value: 1}
    ]
  }

  const groups = [
    {title: 'Group', nodes: ['a1', 'a2']},
    {title: 'B', nodes: ['b']}
  ]

  sankey().size([600, 300])(graph)

  // diagram
  const diagram = sankeyDiagram().groups(groups)
  const el = render(graph, diagram);

  t.equal(el.selectAll('.node').size(), 3,
          'right number of nodes');

  t.equal(el.selectAll('.link').size(), 2,
          'right number of links');

  t.equal(el.selectAll('.group').size(), 2,
          'right number of groups');

  // padding of 10px
  const rects = el.selectAll('.group').select('rect').nodes()
  t.equal(select(rects[0]).attr('width'), '21', 'group1 width');
  t.equal(select(rects[0]).attr('height'), '270', 'group1 height');
  t.equal(select(rects[1]).attr('width'), '21', 'group2 width');
  t.equal(select(rects[1]).attr('height'), '180', 'group2 height');

  t.end();
});


function render(datum, diagram) {
  const el = select(getBody()).append('div');
  el.datum(datum).call(diagram);
  flushAnimationFrames();
  return el;
}


/* Make animations synchronous for testing */
var flushAnimationFrames = function() {
  var now = Date.now;
  Date.now = function() { return Infinity; };
  timerFlush();
  Date.now = now;
};
