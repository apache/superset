import positionGroup from '../src/positionGroup';

import test from 'tape';


test('positionGroup()', t => {
  const nodes = new Map([
    {
      id: 'a1',
      x0: 0,
      x1: 1,
      y0: 30,
      y1: 105
    }, {
      id: 'b',
      x0: 300,
      x1: 301,
      y0: 75,
      y1: 225
    }, {
      id: 'a2',
      x0: 0,
      x1: 1,
      y0: 195,
      y1: 270
    }
  ].map(d => [d.id, d]))

  const group1 = {
    'title': 'Group',
    'nodes': ['a1', 'a2']
  };

  const group2 = {
    'title': 'B',
    'nodes': ['b']
  };

  const group3 = {
    'title': 'All',
    'nodes': ['a1', 'a2', 'b']
  };

  t.deepEqual(positionGroup(nodes, group1), {
    title: 'Group',
    nodes: ['a1', 'a2'],
    rect: {
      top: 30,
      left: 0,
      bottom: 195 + 75,
      right: 1
    }
  }, 'group1');

  t.deepEqual(positionGroup(nodes, group2), {
    title: 'B',
    nodes: ['b'],
    rect: {
      top: 75,
      left: 300,
      bottom: 75 + 150,
      right: 301
    }
  }, 'group2');

  t.deepEqual(positionGroup(nodes, group3), {
    title: 'All',
    nodes: ['a1', 'a2', 'b'],
    rect: {
      top: 30,
      left: 0,
      bottom: 195 + 75,
      right: 301
    }
  }, 'group3');

  t.end();
});
