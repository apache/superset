/*
Modified from http://bl.ocks.org/d3noob/5141278
*/

function viz_directed_force(data_attribute) {
  var token = d3.select('#' + data_attribute.token);
  var xy = token.select('#chart').node().getBoundingClientRect();
  var width = xy.width;
  var height = xy.height - 25;
  var radius = Math.min(width, height) / 2;
  var link_length = data_attribute.form_data['link_length'];
  if (link_length === undefined){
    link_length = 200;
  }
  var charge = data_attribute.form_data['charge'];
  if (charge === undefined){
    charge = -500;
  }
  var render = function(done) {
    d3.json(data_attribute.json_endpoint, function(error, json) {

    if (error != null){
      var err = '<div class="alert alert-danger">' + error.responseText  + '</div>';
      token.html(err);
      done();
      return '';
    }
    links = json.data;
    var nodes = {};
    // Compute the distinct nodes from the links.
    links.forEach(function(link) {
        link.source = nodes[link.source] ||
            (nodes[link.source] = {name: link.source});
        link.target = nodes[link.target] ||
            (nodes[link.target] = {name: link.target});
        link.value = +link.value;
        var target_name = link.target.name;
        var source_name = link.source.name;
        if (nodes[target_name]['total'] === undefined)
          nodes[target_name]['total'] = link.value;
        if (nodes[source_name]['total'] === undefined)
          nodes[source_name]['total'] = 0;
        if (nodes[target_name]['max'] === undefined)
          nodes[target_name]['max'] = 0;
        if (link.value > nodes[target_name]['max'])
          nodes[target_name]['max'] = link.value;
        if (nodes[target_name]['min'] === undefined)
          nodes[target_name]['min'] = 0;
        if (link.value > nodes[target_name]['min'])
          nodes[target_name]['min'] = link.value;

        nodes[target_name]['total'] += link.value;
    });

    var force = d3.layout.force()
        .nodes(d3.values(nodes))
        .links(links)
        .size([width, height])
        .linkDistance(link_length)
        .charge(charge)
        .on("tick", tick)
        .start();

    var svg = token.select("#chart").append("svg")
        .attr("width", width)
        .attr("height", height);

    // build the arrow.
    svg.append("svg:defs").selectAll("marker")
        .data(["end"])      // Different link/path types can be defined here
      .enter().append("svg:marker")    // This section adds in the arrows
        .attr("id", String)
        .attr("viewBox", "0 -5 10 10")
        .attr("refX", 15)
        .attr("refY", -1.5)
        .attr("markerWidth", 6)
        .attr("markerHeight", 6)
        .attr("orient", "auto")
      .append("svg:path")
        .attr("d", "M0,-5L10,0L0,5");

    var edgeScale = d3.scale.linear()
        .range([0.1, 0.5]);
    // add the links and the arrows
    var path = svg.append("svg:g").selectAll("path")
        .data(force.links())
        .enter().append("svg:path")
        //.attr("class", function(d) { return "link " + d.type; })
        .attr("class", "link")
        .style("opacity", function(d){
          return edgeScale(d.value/d.target.max);
        })
        .attr("marker-end", "url(#end)");

    // define the nodes
    var node = svg.selectAll(".node")
        .data(force.nodes())
        .enter().append("g")
        .attr("class", "node")
        .on("mouseenter", function(d){
          d3.select(this)
          .select("circle")
          .transition()
          .style('stroke-width', 5);
          d3.select(this)
          .select("text")
          .transition()
          .style('font-size', 25);
        })
        .on("mouseleave", function(d){
          d3.select(this)
          .select("circle")
          .transition()
          .style('stroke-width', 1.5);
          d3.select(this)
          .select("text")
          .transition()
          .style('font-size', 12);
        })
        .call(force.drag);

    // add the nodes
    var ext = d3.extent(d3.values(nodes), function(d){return Math.sqrt(d.total);})
    var circleScale = d3.scale.linear()
        .domain(ext)
        .range([3, 30]);

    node.append("circle")
        .attr("r", function(d){return circleScale(Math.sqrt(d.total));});

    // add the text
    node.append("text")
        .attr("x", 6)
        .attr("dy", ".35em")
        .text(function(d) { return d.name; });

    // add the curvy lines
    function tick() {
        path.attr("d", function(d) {
            var dx = d.target.x - d.source.x,
                dy = d.target.y - d.source.y,
                dr = Math.sqrt(dx * dx + dy * dy);
            return "M" +
                d.source.x + "," +
                d.source.y + "A" +
                dr + "," + dr + " 0 0,1 " +
                d.target.x + "," +
                d.target.y;
        });

        node
            .attr("transform", function(d) {
            return "translate(" + d.x + "," + d.y + ")"; });
    }
    done(json);
    });
  }
  return {
    render: render,
    resize: render,
  };
}
px.registerWidget('directed_force', viz_directed_force);
