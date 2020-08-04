// The reusable SVG component for the sliced Sankey diagram

import sankeyLink from './linkPath.js'
import sankeyNode from './node.js'
import positionGroup from './positionGroup.js'

import {select, event} from 'd3-selection'
import {transition} from 'd3-transition'
import {dispatch} from 'd3-dispatch'
import {format} from 'd3-format'
import {interpolate} from 'd3-interpolate'
import {map} from 'd3-collection'

export function linkTitleGenerator (nodeTitle, typeTitle, fmt) {
  return function (d) {
    const parts = []
    const sourceTitle = nodeTitle(d.source)
    const targetTitle = nodeTitle(d.target)
    const matTitle = typeTitle(d)

    parts.push(`${sourceTitle} → ${targetTitle}`)
    if (matTitle) parts.push(matTitle)
    parts.push(fmt(d.value))
    return parts.join('\n')
  }
}

export default function sankeyDiagram () {
  let margin = {top: 0, right: 0, bottom: 0, left: 0}

  let selectedNode = null
  let selectedEdge = null

  let groups = []

  const fmt = format('.3s')
  const node = sankeyNode()
  const link = sankeyLink()

  let linkColor = d => null
  let linkTitle = linkTitleGenerator(node.nodeTitle(), d => d.type, fmt)
  let linkLabel = defaultLinkLabel

  const listeners = dispatch('selectNode', 'selectGroup', 'selectLink')

  /* Main chart */

  function exports (context) {
    const selection = context.selection ? context.selection() : context

    selection.each(function (G) {
      // Create the skeleton, if it doesn't already exist
      const svg = select(this)

      let sankey = svg.selectAll('.sankey')
            .data([{type: 'sankey'}])

      const sankeyEnter = sankey.enter()
            .append('g')
            .classed('sankey', true)

      sankeyEnter.append('g').classed('groups', true)
      sankeyEnter.append('g').classed('links', true)  // Links below nodes
      sankeyEnter.append('g').classed('nodes', true)
      sankeyEnter.append('g').classed('slice-titles', true)  // Slice titles

      sankey = sankey.merge(sankeyEnter)

      // Update margins
      sankey
        .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')')
        // .select('.slice-titles')
        // .attr('transform', 'translate(' + margin.left + ',0)')

      // Groups of nodes
      const nodeMap = map(G.nodes, n => n.id)
      const groupsPositioned = (groups || []).map(g => positionGroup(nodeMap, g))

      // Render
      updateNodes(sankey, context, G.nodes)
      updateLinks(sankey, context, G.links)
      updateGroups(svg, groupsPositioned)
      // updateSlices(svg, layout.slices(nodes));

      // Events
      svg.on('click', function () {
        listeners.call('selectNode', this, null)
        listeners.call('selectLink', this, null)
      })
    })
  }

  function updateNodes (sankey, context, nodes) {
    var nodeSel = sankey
        .select('.nodes')
        .selectAll('.node')
        .data(nodes, d => d.id)

    // EXIT
    nodeSel.exit().remove()

    nodeSel = nodeSel.merge(
      nodeSel.enter()
        .append('g')
        .attr('class', 'node')
        .call(node)
        .on('click', selectNode))

    if (context instanceof transition) {
      nodeSel.transition(context)
        .call(node)
    } else {
      nodeSel.call(node)
    }
  }

  function updateLinks (sankey, context, edges) {
    var linkSel = sankey
        .select('.links')
        .selectAll('.link')
        .data(edges, d => d.source.id + '-' + d.target.id + '-' + d.type)

    // EXIT

    linkSel.exit().remove()

    // ENTER

    var linkEnter = linkSel.enter()
        .append('g')
        .attr('class', 'link')
        .on('click', selectLink)

    linkEnter.append('path')
      .attr('d', link)
      .style('fill', 'white')
      .each(function (d) { this._current = d })

    linkEnter.append('title')

    linkEnter.append('text')
      .attr('class', 'label')
      .attr('dy', '0.35em')
      .attr('x', d => d.points[0].x + 4)
      .attr('y', d => d.points[0].y)

    // UPDATE

    linkSel = linkSel.merge(linkEnter)

    // Non-transition updates
    linkSel.classed('selected', (d) => d.id === selectedEdge)
    linkSel.sort(linkOrder)

    // Transition updates, if available
    if (context instanceof transition) {
      linkSel = linkSel.transition(context)
      linkSel
        .select('path')
        .style('fill', linkColor)
        .each(function (d) {
          select(this)
            .transition(context)
            .attrTween('d', interpolateLink)
        })
    } else {
      linkSel
        .select('path')
        .style('fill', linkColor)
        .attr('d', link)
    }

    linkSel.select('title')
      .text(linkTitle)

    linkSel.select('.label')
      .text(linkLabel)
      .attr('x', d => d.points[0].x + 4)
      .attr('y', d => d.points[0].y)
  }

  // function updateSlices(svg, slices) {
  //   var slice = svg.select('.slice-titles').selectAll('.slice')
  //         .data(slices, function(d) { return d.id; });

  //   var textWidth = (slices.length > 1 ?
  //                    0.9 * (slices[1].x - slices[0].x) :
  //                    null);

  //   slice.enter().append('g')
  //     .attr('class', 'slice')
  //     .append('foreignObject')
  //     .attr('requiredFeatures',
  //           'http://www.w3.org/TR/SVG11/feature#Extensibility')
  //     .attr('height', margin.top)
  //     .attr('class', 'title')
  //     .append('xhtml:div')
  //     .style('text-align', 'center')
  //     .style('word-wrap', 'break-word');
  //   // .text(pprop('sliceMetadata', 'title'));

  //   slice
  //     .attr('transform', function(d) {
  //       return 'translate(' + (d.x - textWidth / 2) + ',0)'; })
  //     .select('foreignObject')
  //     .attr('width', textWidth)
  //     .select('div');
  //   // .text(pprop('sliceMetadata', 'title'));

  //   slice.exit().remove();
  // }

  function updateGroups (svg, groups) {
    let group = svg.select('.groups').selectAll('.group')
      .data(groups)

    // EXIT
    group.exit().remove()

    // ENTER
    const enter = group.enter().append('g')
            .attr('class', 'group')
            // .on('click', selectGroup);

    enter.append('rect')
    enter.append('text')
      .attr('x', -10)
      .attr('y', -25)

    group = group.merge(enter)

    group
      .style('display', d => d.title ? 'inline' : 'none')
      .attr('transform', d => `translate(${d.rect.left},${d.rect.top})`)
      .select('rect')
      .attr('x', -10)
      .attr('y', -20)
      .attr('width', d => d.rect.right - d.rect.left + 20)
      .attr('height', d => d.rect.bottom - d.rect.top + 30)

    group.select('text')
      .text(d => d.title)
  }

  function interpolateLink (b) {
    // XXX should limit radius better
    b.points.forEach(function (p) {
      if (p.ri > 1e3) p.ri = 1e3
      if (p.ro > 1e3) p.ro = 1e3
    })
    var interp = interpolate(linkGeom(this._current), b)
    var that = this
    return function (t) {
      that._current = interp(t)
      return link(that._current)
    }
  }

  function linkGeom (l) {
    return {
      points: l.points,
      dy: l.dy
    }
  }

  function linkOrder (a, b) {
    if (a.id === selectedEdge) return +1
    if (b.id === selectedEdge) return -1
    if (!a.source || a.target && a.target.direction === 'd') return -1
    if (!b.source || b.target && b.target.direction === 'd') return +1
    if (!a.target || a.source && a.source.direction === 'd') return -1
    if (!b.target || b.source && b.source.direction === 'd') return +1
    return a.dy - b.dy
  }

  function selectLink (d) {
    event.stopPropagation()
    var el = select(this).node()
    listeners.call('selectLink', el, d)
  }

  function selectNode (d) {
    event.stopPropagation()
    var el = select(this).node()
    listeners.call('selectNode', el, d)
  }

  // function selectGroup(d) {
  //   d3.event.stopPropagation();
  //   var el = d3.select(this)[0][0];
  //   dispatch.selectGroup.call(el, d);
  // }

  exports.margins = function (_x) {
    if (!arguments.length) return margin
    margin = {
      top: _x.top === undefined ? margin.top : _x.top,
      left: _x.left === undefined ? margin.left : _x.left,
      bottom: _x.bottom === undefined ? margin.bottom : _x.bottom,
      right: _x.right === undefined ? margin.right : _x.right
    }
    return this
  }

  exports.groups = function (_x) {
    if (!arguments.length) return groups
    groups = _x
    return this
  }

  // Node styles and title
  exports.nodeTitle = function (_x) {
    if (!arguments.length) return node.nodeTitle()
    node.nodeTitle(_x)
    linkTitle = linkTitleGenerator(_x, d => d.type, fmt)
    return this
  }

  exports.nodeValue = function (_x) {
    if (!arguments.length) return node.nodeValue()
    node.nodeValue(_x)
    return this
  }

  // Link styles and titles
  exports.linkTitle = function (_x) {
    if (!arguments.length) return linkTitle
    linkTitle = _x
    return this
  }

  exports.linkLabel = function (_x) {
    if (!arguments.length) return linkLabel
    linkLabel = _x
    return this
  }

  exports.linkColor = function (_x) {
    if (!arguments.length) return linkColor
    linkColor = _x
    return this
  }

  exports.linkMinWidth = function (_x) {
    if (!arguments.length) return link.minWidth()
    link.minWidth(_x)
    return this
  }

  exports.selectNode = function (_x) {
    selectedNode = _x
    return this
  }

  exports.selectLink = function (_x) {
    selectedEdge = _x
    return this
  }

  exports.on = function () {
    var value = listeners.on.apply(listeners, arguments)
    return value === listeners ? exports : value
  }

  return exports
}

function defaultLinkLabel (d) {
  return null
}
