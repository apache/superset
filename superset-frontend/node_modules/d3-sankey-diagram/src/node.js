import { select } from 'd3-selection'

export default function () {
  let nodeTitle = (d) => d.title !== undefined ? d.title : d.id
  let nodeValue = (d) => null
  let nodeVisible = (d) => !!nodeTitle(d)

  function sankeyNode (context) {
    const selection = context.selection ? context.selection() : context

    if (selection.select('text').empty()) {
      selection.append('title')
      selection.append('line')
        .attr('x1', 0)
        .attr('x2', 0)
      selection.append('rect')
        .attr('class', 'node-body')
      selection.append('text')
        .attr('class', 'node-value')
        .attr('dy', '.35em')
        .attr('text-anchor', 'middle')
      selection.append('text')
        .attr('class', 'node-title')
        .attr('dy', '.35em')
      selection.append('rect')
        .attr('class', 'node-click-target')
        .attr('x', -5)
        .attr('y', -5)
        .attr('width', 10)
        .style('fill', 'none')
        .style('visibility', 'hidden')
        .style('pointer-events', 'all')

      selection
        .attr('transform', nodeTransform)
    }

    selection.each(function (d) {
      let title = select(this).select('title')
      let value = select(this).select('.node-value')
      let text = select(this).select('.node-title')
      let line = select(this).select('line')
      let body = select(this).select('.node-body')
      let clickTarget = select(this).select('.node-click-target')

      // Local var for title position of each node
      const layoutData = titlePosition(d)
      layoutData.dy = (d.y0 === d.y1) ? 0 : Math.max(1, d.y1 - d.y0)

      const separateValue = (d.x1 - d.x0) > 2
      const titleText = nodeTitle(d) + ((!separateValue && nodeValue(d))
                                        ? ' (' + nodeValue(d) + ')' : '')

      // Update un-transitioned
      title
        .text(titleText)

      value
        .text(nodeValue)
        .style('display', separateValue ? 'inline' : 'none')

      text
        .attr('text-anchor', layoutData.right ? 'end' : 'start')
        .text(titleText)
        .each(wrap, 100)

      // Are we in a transition?
      if (context !== selection) {
        text = text.transition(context)
        line = line.transition(context)
        body = body.transition(context)
        clickTarget = clickTarget.transition(context)
      }

      // Update
      context
        .attr('transform', nodeTransform)

      line
        .attr('y1', function (d) { return layoutData.titleAbove ? -5 : 0 })
        .attr('y2', function (d) { return layoutData.dy })
        .style('display', function (d) {
          return (d.y0 === d.y1 || !nodeVisible(d)) ? 'none' : 'inline'
        })

      clickTarget
        .attr('height', function (d) { return layoutData.dy + 5 })

      body
        .attr('width', function (d) { return d.x1 - d.x0 })
        .attr('height', function (d) { return layoutData.dy })

      text
        .attr('transform', textTransform)
        .style('display', function (d) {
          return (d.y0 === d.y1 || !nodeVisible(d)) ? 'none' : 'inline'
        })

      value
        .style('font-size', function (d) { return Math.min(d.x1 - d.x0 - 4, d.y1 - d.y0 - 4) + 'px' })
        .attr('transform', function (d) {
          const dx = d.x1 - d.x0
          const dy = d.y1 - d.y0
          const theta = dx > dy ? 0 : -90
          return 'translate(' + (dx / 2) + ',' + (dy / 2) + ') rotate(' + theta + ')'
        })

      function textTransform (d) {
        const layout = layoutData
        const y = layout.titleAbove ? -10 : (d.y1 - d.y0) / 2
        let x
        if (layout.titleAbove) {
          x = (layout.right ? 4 : -4)
        } else {
          x = (layout.right ? -4 : d.x1 - d.x0 + 4)
        }
        return 'translate(' + x + ',' + y + ')'
      }
    })
  }

  sankeyNode.nodeVisible = function (x) {
    if (arguments.length) {
      nodeVisible = required(x)
      return sankeyNode
    }
    return nodeVisible
  }

  sankeyNode.nodeTitle = function (x) {
    if (arguments.length) {
      nodeTitle = required(x)
      return sankeyNode
    }
    return nodeTitle
  }

  sankeyNode.nodeValue = function (x) {
    if (arguments.length) {
      nodeValue = required(x)
      return sankeyNode
    }
    return nodeValue
  }

  return sankeyNode
}

function nodeTransform (d) {
  return 'translate(' + d.x0 + ',' + d.y0 + ')'
}

function titlePosition (d) {
  let titleAbove = false
  let right = false

  // If thin, and there's enough space, put above
  if (d.spaceAbove > 20 && d.style !== 'type') {
    titleAbove = true
  } else {
    titleAbove = false
  }

  if (d.incoming.length === 0) {
    right = true
    titleAbove = false
  } else if (d.outgoing.length === 0) {
    right = false
    titleAbove = false
  }

  return {titleAbove, right}
}

function wrap (d, width) {
  var text = select(this)
  var lines = text.text().split(/\n/)
  var lineHeight = 1.1 // ems
  if (lines.length === 1) return
  text.text(null)
  lines.forEach(function (line, i) {
    text.append('tspan')
      .attr('x', 0)
      .attr('dy', (i === 0 ? 0.7 - lines.length / 2 : 1) * lineHeight + 'em')
      .text(line)
  })
}

function required (f) {
  if (typeof f !== 'function') throw new Error()
  return f
}
