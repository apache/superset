px.registerWidget('word_cloud', function(data_attribute) {

  var token_name = data_attribute['token'];
  var json_callback = data_attribute['json_endpoint'];
  var token = d3.select('#' + token_name);

  function refresh(done) {
    d3.json(json_callback, function(error, json) {
      if (error != null){
        var err = '<div class="alert alert-danger">' + error.responseText  + '</div>';
        token.html(err);
        done();
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
      var box = token.node().getBoundingClientRect();
      var size = [box.width, box.height - 25];

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
        token.selectAll("*").remove();

        token.append("svg")
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
      done(data);
    });
  }

  return {
    render: refresh,
    resize: refresh,
  };

});
