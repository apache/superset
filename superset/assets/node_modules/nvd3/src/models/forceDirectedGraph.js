nv.models.forceDirectedGraph = function() {
    "use strict";

    //============================================================
    // Public Variables with Default Settings
    //------------------------------------------------------------
    var margin = {top: 2, right: 0, bottom: 2, left: 0}
        , width = 400
        , height = 32
        , container = null
        , dispatch = d3.dispatch('renderEnd')
        , color = nv.utils.getColor(['#000'])
        , tooltip      = nv.models.tooltip()
        , noData = null
        // Force directed graph specific parameters [default values]
        , linkStrength = 0.1
        , friction = 0.9
        , linkDist = 30
        , charge = -120
        , gravity = 0.1
        , theta = 0.8
        , alpha = 0.1
        , radius = 5
        // These functions allow to add extra attributes to ndes and links
        ,nodeExtras = function(nodes) { /* Do nothing */ }
        ,linkExtras = function(links) { /* Do nothing */ }
        , getX=d3.functor(0.0)
        , getY=d3.functor(0.0)
        ;


    //============================================================
    // Private Variables
    //------------------------------------------------------------

    var renderWatch = nv.utils.renderWatch(dispatch);

    function chart(selection) {
        renderWatch.reset();

        selection.each(function(data) {
          container = d3.select(this);
          nv.utils.initSVG(container);

          var availableWidth = nv.utils.availableWidth(width, container, margin),
              availableHeight = nv.utils.availableHeight(height, container, margin);

          container
                  .attr("width", availableWidth)
                  .attr("height", availableHeight);

          // Display No Data message if there's nothing to show.
          if (!data || !data.links || !data.nodes) {
              nv.utils.noData(chart, container)
              return chart;
          } else {
              container.selectAll('.nv-noData').remove();
          }
          container.selectAll('*').remove();

          // Collect names of all fields in the nodes
          var nodeFieldSet = new Set();
          data.nodes.forEach(function(node) {
            var keys = Object.keys(node);
            keys.forEach(function(key) {
              nodeFieldSet.add(key);
            });
          });

          var force = d3.layout.force()
                .nodes(data.nodes)
                .links(data.links)
                .size([availableWidth, availableHeight])
                .linkStrength(linkStrength)
                .friction(friction)
                .linkDistance(linkDist)
                .charge(charge)
                .gravity(gravity)
                .theta(theta)
                .alpha(alpha)
                .start();

          var link = container.selectAll(".link")
                .data(data.links)
                .enter().append("line")
                .attr("class", "nv-force-link")
                .style("stroke-width", function(d) { return Math.sqrt(d.value); });

          var node = container.selectAll(".node")
                .data(data.nodes)
                .enter()
                .append("g")
                .attr("class", "nv-force-node")
                .call(force.drag);

          node
            .append("circle")
            .attr("r", radius)
            .style("fill", function(d) { return color(d) } )
            .on("mouseover", function(evt) {
              container.select('.nv-series-' + evt.seriesIndex + ' .nv-distx-' + evt.pointIndex)
                  .attr('y1', evt.py);
              container.select('.nv-series-' + evt.seriesIndex + ' .nv-disty-' + evt.pointIndex)
                  .attr('x2', evt.px);

              // Add 'series' object to
              var nodeColor = color(evt);
              evt.series = [];
              nodeFieldSet.forEach(function(field) {
                evt.series.push({
                  color: nodeColor,
                  key:   field,
                  value: evt[field]
                });
              });
              tooltip.data(evt).hidden(false);
            })
            .on("mouseout",  function(d) {
              tooltip.hidden(true);
            });

          tooltip.headerFormatter(function(d) {return "Node";});

          // Apply extra attributes to nodes and links (if any)
          linkExtras(link);
          nodeExtras(node);

          force.on("tick", function() {
              link.attr("x1", function(d) { return d.source.x; })
                  .attr("y1", function(d) { return d.source.y; })
                  .attr("x2", function(d) { return d.target.x; })
                  .attr("y2", function(d) { return d.target.y; });

              node.attr("transform", function(d) {
                return "translate(" + d.x + ", " + d.y + ")";
              });
            });
        });

        return chart;
    }

    //============================================================
    // Expose Public Variables
    //------------------------------------------------------------

    chart.options = nv.utils.optionsFunc.bind(chart);

    chart._options = Object.create({}, {
        // simple options, just get/set the necessary values
        width:     {get: function(){return width;}, set: function(_){width=_;}},
        height:    {get: function(){return height;}, set: function(_){height=_;}},

        // Force directed graph specific parameters
        linkStrength:{get: function(){return linkStrength;}, set: function(_){linkStrength=_;}},
        friction:    {get: function(){return friction;}, set: function(_){friction=_;}},
        linkDist:    {get: function(){return linkDist;}, set: function(_){linkDist=_;}},
        charge:      {get: function(){return charge;}, set: function(_){charge=_;}},
        gravity:     {get: function(){return gravity;}, set: function(_){gravity=_;}},
        theta:       {get: function(){return theta;}, set: function(_){theta=_;}},
        alpha:       {get: function(){return alpha;}, set: function(_){alpha=_;}},
        radius:      {get: function(){return radius;}, set: function(_){radius=_;}},

        //functor options
        x: {get: function(){return getX;}, set: function(_){getX=d3.functor(_);}},
        y: {get: function(){return getY;}, set: function(_){getY=d3.functor(_);}},

        // options that require extra logic in the setter
        margin: {get: function(){return margin;}, set: function(_){
            margin.top    = _.top    !== undefined ? _.top    : margin.top;
            margin.right  = _.right  !== undefined ? _.right  : margin.right;
            margin.bottom = _.bottom !== undefined ? _.bottom : margin.bottom;
            margin.left   = _.left   !== undefined ? _.left   : margin.left;
        }},
        color:  {get: function(){return color;}, set: function(_){
            color = nv.utils.getColor(_);
        }},
        noData:    {get: function(){return noData;}, set: function(_){noData=_;}},
        nodeExtras: {get: function(){return nodeExtras;}, set: function(_){
            nodeExtras = _;
        }},
        linkExtras: {get: function(){return linkExtras;}, set: function(_){
            linkExtras = _;
        }}
    });

    chart.dispatch = dispatch;
    chart.tooltip = tooltip;
    nv.utils.initOptions(chart);
    return chart;
};
