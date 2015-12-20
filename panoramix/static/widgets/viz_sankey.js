function viz_sankey(slice) {
    var div = d3.select(slice.selector);

    var render = function() {
        var width = slice.container.width();
        var height = slice.container.height() - 25;
        var margin = {top: 5, right: 5, bottom: 5, left: 5};
        width = width - margin.left - margin.right;
        height = height - margin.top - margin.bottom;

        var formatNumber = d3.format(",.0f"),
            format = function(d) { return formatNumber(d) + " TWh"; },
            color = d3.scale.category20();

        var svg = div.append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
          .append("g")
            .attr("transform", "translate(" + margin.left + "," + margin.top + ")");
        var sankey = d3.sankey()
            .nodeWidth(15)
            .nodePadding(10)
            .size([width, height]);

        var path = sankey.link();

        d3.json(slice.data.json_endpoint, function(error, json) {
          if (error != null){
            slice.error(error.responseText);
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
          });
          nodes = d3.values(nodes);

          sankey
              .nodes(nodes)
              .links(links)
              .layout(32);

          var link = svg.append("g").selectAll(".link")
              .data(links)
            .enter().append("path")
              .attr("class", "link")
              .attr("d", path)
              .style("stroke-width", function(d) { return Math.max(1, d.dy); })
              .sort(function(a, b) { return b.dy - a.dy; });

          link.append("title")
              .text(function(d) { return d.source.name + " → " + d.target.name + "\n" + format(d.value); });

          var node = svg.append("g").selectAll(".node")
              .data(nodes)
            .enter().append("g")
              .attr("class", "node")
              .attr("transform", function(d) { return "translate(" + d.x + "," + d.y + ")"; })
            .call(d3.behavior.drag()
              .origin(function(d) { return d; })
              .on("dragstart", function() { this.parentNode.appendChild(this); })
              .on("drag", dragmove));

          node.append("rect")
              .attr("height", function(d) { return d.dy; })
              .attr("width", sankey.nodeWidth())
              .style("fill", function(d) { return d.color = color(d.name.replace(/ .*/, "")); })
              .style("stroke", function(d) { return d3.rgb(d.color).darker(2); })
            .append("title")
              .text(function(d) { return d.name + "\n" + format(d.value); });

          node.append("text")
              .attr("x", -6)
              .attr("y", function(d) { return d.dy / 2; })
              .attr("dy", ".35em")
              .attr("text-anchor", "end")
              .attr("transform", null)
              .text(function(d) { return d.name; })
            .filter(function(d) { return d.x < width / 2; })
              .attr("x", 6 + sankey.nodeWidth())
              .attr("text-anchor", "start");

          function dragmove(d) {
            d3.select(this).attr("transform", "translate(" + d.x + "," + (d.y = Math.max(0, Math.min(height - d.dy, d3.event.y))) + ")");
            sankey.relayout();
            link.attr("d", path);
          }
          slice.done(json);
        });
    }
    return {
        render: render,
        resize: render,
    };
}
px.registerViz('sankey', viz_sankey);
