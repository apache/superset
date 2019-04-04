nv.models.sankey = function() {
    'use strict';

    // Sources:
    // - https://bost.ocks.org/mike/sankey/
    // - https://github.com/soxofaan/d3-plugin-captain-sankey

    //============================================================
    // Public Variables with Default Settings
    //------------------------------------------------------------

    var sankey = {},
        nodeWidth = 24,
        nodePadding = 8,
        size = [1, 1],
        nodes = [],
        links = [],
        sinksRight = true;

    var layout = function(iterations) {
        computeNodeLinks();
        computeNodeValues();
        computeNodeBreadths();
        computeNodeDepths(iterations);
    };

    var relayout = function() {
        computeLinkDepths();
    };

    // SVG path data generator, to be used as 'd' attribute on 'path' element selection.
    var link = function() {
        var curvature = .5;

        function link(d) {

            var x0 = d.source.x + d.source.dx,
                x1 = d.target.x,
                xi = d3.interpolateNumber(x0, x1),
                x2 = xi(curvature),
                x3 = xi(1 - curvature),
                y0 = d.source.y + d.sy + d.dy / 2,
                y1 = d.target.y + d.ty + d.dy / 2;
            var linkPath = 'M' + x0 + ',' + y0
                + 'C' + x2 + ',' + y0
                + ' ' + x3 + ',' + y1
                + ' ' + x1 + ',' + y1;
            return linkPath;
        }

        link.curvature = function(_) {
            if (!arguments.length) return curvature;
            curvature = +_;
            return link;
        };

        return link;
    };

    // Y-position of the middle of a node.
    var center = function(node) {
        return node.y + node.dy / 2;
    };

    //============================================================
    // Private Variables
    //------------------------------------------------------------

    // Populate the sourceLinks and targetLinks for each node.
    // Also, if the source and target are not objects, assume they are indices.
    function computeNodeLinks() {
        nodes.forEach(function(node) {
            // Links that have this node as source.
            node.sourceLinks = [];
            // Links that have this node as target.
            node.targetLinks = [];
        });
        links.forEach(function(link) {
            var source = link.source,
                target = link.target;
            if (typeof source === 'number') source = link.source = nodes[link.source];
            if (typeof target === 'number') target = link.target = nodes[link.target];
            source.sourceLinks.push(link);
            target.targetLinks.push(link);
        });
    }

    // Compute the value (size) of each node by summing the associated links.
    function computeNodeValues() {
        nodes.forEach(function(node) {
            node.value = Math.max(
                d3.sum(node.sourceLinks, value),
                d3.sum(node.targetLinks, value)
            );
        });
    }

    // Iteratively assign the breadth (x-position) for each node.
    // Nodes are assigned the maximum breadth of incoming neighbors plus one;
    // nodes with no incoming links are assigned breadth zero, while
    // nodes with no outgoing links are assigned the maximum breadth.
    function computeNodeBreadths() {
        //
        var remainingNodes = nodes,
            nextNodes,
            x = 0;

        // Work from left to right.
        // Keep updating the breath (x-position) of nodes that are target of recently updated nodes.
        //
        while (remainingNodes.length && x < nodes.length) {
            nextNodes = [];
            remainingNodes.forEach(function(node) {
                node.x = x;
                node.dx = nodeWidth;
                node.sourceLinks.forEach(function(link) {
                    if (nextNodes.indexOf(link.target) < 0) {
                        nextNodes.push(link.target);
                    }
                });
            });
            remainingNodes = nextNodes;
            ++x;
            //
        }

        // Optionally move pure sinks always to the right.
        if (sinksRight) {
            moveSinksRight(x);
        }

        scaleNodeBreadths((size[0] - nodeWidth) / (x - 1));
    }

    function moveSourcesRight() {
        nodes.forEach(function(node) {
            if (!node.targetLinks.length) {
                node.x = d3.min(node.sourceLinks, function(d) { return d.target.x; }) - 1;
            }
        });
    }

    function moveSinksRight(x) {
        nodes.forEach(function(node) {
            if (!node.sourceLinks.length) {
                node.x = x - 1;
            }
        });
    }

    function scaleNodeBreadths(kx) {
        nodes.forEach(function(node) {
            node.x *= kx;
        });
    }

    // Compute the depth (y-position) for each node.
    function computeNodeDepths(iterations) {
        // Group nodes by breath.
        var nodesByBreadth = d3.nest()
            .key(function(d) { return d.x; })
            .sortKeys(d3.ascending)
            .entries(nodes)
            .map(function(d) { return d.values; });

        //
        initializeNodeDepth();
        resolveCollisions();
        computeLinkDepths();
        for (var alpha = 1; iterations > 0; --iterations) {
            relaxRightToLeft(alpha *= .99);
            resolveCollisions();
            computeLinkDepths();
            relaxLeftToRight(alpha);
            resolveCollisions();
            computeLinkDepths();
        }

        function initializeNodeDepth() {
            // Calculate vertical scaling factor.
            var ky = d3.min(nodesByBreadth, function(nodes) {
                return (size[1] - (nodes.length - 1) * nodePadding) / d3.sum(nodes, value);
            });

            nodesByBreadth.forEach(function(nodes) {
                nodes.forEach(function(node, i) {
                    node.y = i;
                    node.dy = node.value * ky;
                });
            });

            links.forEach(function(link) {
                link.dy = link.value * ky;
            });
        }

        function relaxLeftToRight(alpha) {
            nodesByBreadth.forEach(function(nodes, breadth) {
                nodes.forEach(function(node) {
                    if (node.targetLinks.length) {
                        // Value-weighted average of the y-position of source node centers linked to this node.
                        var y = d3.sum(node.targetLinks, weightedSource) / d3.sum(node.targetLinks, value);
                        node.y += (y - center(node)) * alpha;
                    }
                });
            });

            function weightedSource(link) {
                return (link.source.y + link.sy + link.dy / 2) * link.value;
            }
        }

        function relaxRightToLeft(alpha) {
            nodesByBreadth.slice().reverse().forEach(function(nodes) {
                nodes.forEach(function(node) {
                    if (node.sourceLinks.length) {
                        // Value-weighted average of the y-positions of target nodes linked to this node.
                        var y = d3.sum(node.sourceLinks, weightedTarget) / d3.sum(node.sourceLinks, value);
                        node.y += (y - center(node)) * alpha;
                    }
                });
            });

            function weightedTarget(link) {
                return (link.target.y + link.ty + link.dy / 2) * link.value;
            }
        }

        function resolveCollisions() {
            nodesByBreadth.forEach(function(nodes) {
                var node,
                    dy,
                    y0 = 0,
                    n = nodes.length,
                    i;

                // Push any overlapping nodes down.
                nodes.sort(ascendingDepth);
                for (i = 0; i < n; ++i) {
                    node = nodes[i];
                    dy = y0 - node.y;
                    if (dy > 0) node.y += dy;
                    y0 = node.y + node.dy + nodePadding;
                }

                // If the bottommost node goes outside the bounds, push it back up.
                dy = y0 - nodePadding - size[1];
                if (dy > 0) {
                    y0 = node.y -= dy;

                    // Push any overlapping nodes back up.
                    for (i = n - 2; i >= 0; --i) {
                        node = nodes[i];
                        dy = node.y + node.dy + nodePadding - y0;
                        if (dy > 0) node.y -= dy;
                        y0 = node.y;
                    }
                }
            });
        }

        function ascendingDepth(a, b) {
            return a.y - b.y;
        }
    }

    // Compute y-offset of the source endpoint (sy) and target endpoints (ty) of links,
    // relative to the source/target node's y-position.
    function computeLinkDepths() {
        nodes.forEach(function(node) {
            node.sourceLinks.sort(ascendingTargetDepth);
            node.targetLinks.sort(ascendingSourceDepth);
        });
        nodes.forEach(function(node) {
            var sy = 0, ty = 0;
            node.sourceLinks.forEach(function(link) {
                link.sy = sy;
                sy += link.dy;
            });
            node.targetLinks.forEach(function(link) {
                link.ty = ty;
                ty += link.dy;
            });
        });

        function ascendingSourceDepth(a, b) {
            return a.source.y - b.source.y;
        }

        function ascendingTargetDepth(a, b) {
            return a.target.y - b.target.y;
        }
    }

    // Value property accessor.
    function value(x) {
        return x.value;
    }

    sankey.options = nv.utils.optionsFunc.bind(sankey);
    sankey._options = Object.create({}, {
        nodeWidth:    {get: function(){return nodeWidth;},   set: function(_){nodeWidth=+_;}},
        nodePadding:  {get: function(){return nodePadding;}, set: function(_){nodePadding=_;}},
        nodes:        {get: function(){return nodes;},       set: function(_){nodes=_;}},
        links:        {get: function(){return links ;},      set: function(_){links=_;}},
        size:         {get: function(){return size;},        set: function(_){size=_;}},
        sinksRight:   {get: function(){return sinksRight;},  set: function(_){sinksRight=_;}},

        layout:       {get: function(){layout(32);},         set: function(_){layout(_);}},
        relayout:     {get: function(){relayout();},         set: function(_){}},
        center:       {get: function(){return center();},    set: function(_){
            if(typeof _ === 'function'){
                center=_;
            }
        }},
        link:         {get: function(){return link();},      set: function(_){
            if(typeof _ === 'function'){
                link=_;
            }
            return link();
        }}
    });

    nv.utils.initOptions(sankey);

    return sankey;
};
