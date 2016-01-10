px.registerViz('word_cloud', function(slice) {
  var slice = slice;
  var chart = d3.select(slice.selector);
  function refresh() {
    d3.json(slice.jsonEndpoint(), function(error, json) {
      if (error != null){
        slice.error(error.responseText);
        return '';
      }
      var data = json.data;
      var range = [
        json.form_data.size_from,
        json.form_data.size_to,
      ];
      var rotation = json.form_data.rotation;
      if (rotation == "square") {
        var f_rotation = function() { return ~~(Math.random() * 2) * 90; };
      }
      else if (rotation == "flat") {
        var f_rotation = function() { return 0 };
      }
      else {
        var f_rotation = function() { return (~~(Math.random() * 6) - 3) * 30; };
      }
      var size = [slice.width(), slice.height()];

      scale = d3.scale.linear()
        .range(range)
        .domain(d3.extent(data, function(d) { return d.size; }));
      var fill = d3.scale.category20();
      var layout = d3.layout.cloud()
        .size(size)
        .words(data)
        .padding(5)
        .rotate(f_rotation)
        .font("serif")
        .fontSize(function(d) { return scale(d.size); })
        .on("end", draw);
      layout.start();
      function draw(words) {
        chart.selectAll("*").remove();

        chart.append("svg")
            .attr("width", layout.size()[0])
            .attr("height", layout.size()[1])
          .append("g")
            .attr("transform", "translate(" + layout.size()[0] / 2 + "," + layout.size()[1] / 2 + ")")
          .selectAll("text")
            .data(words)
          .enter().append("text")
            .style("font-size", function(d) { return d.size + "px"; })
            .style("font-family", "Impact")
            .style("fill", function(d, i) { return fill(i); })
            .attr("text-anchor", "middle")
            .attr("transform", function(d) {
              return "translate(" + [d.x, d.y] + ") rotate(" + d.rotate + ")";
            })
            .text(function(d) { return d.text; });
      }
      slice.done(data);
    });
  }

  return {
    render: refresh,
    resize: refresh,
  };
});
