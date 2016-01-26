// Inspired from http://bl.ocks.org/mbostock/3074470
// https://jsfiddle.net/cyril123/h0reyumq/
px.registerViz('heatmap', function(slice) {
  function refresh() {
    var width = slice.width();
    var height = slice.height();
    d3.json(slice.jsonEndpoint(), function(error, payload) {
      var matrix = {};
      if (error){
        slice.error(error.responseText);
        return '';
      }
      var heatmap = payload.data;
      function ordScale(k, rangeBands, reverse) {
        if (reverse === undefined)
          reverse = false;
        domain = {};
        $.each(heatmap, function(i, d){
          domain[d[k]] = true;
        });
        domain = Object.keys(domain).sort();
        if (reverse)
          domain.reverse();
        if (rangeBands === undefined) {
          return d3.scale.ordinal().domain(domain).range(d3.range(domain.length));
        }
        else {
          return d3.scale.ordinal().domain(domain).rangeBands(rangeBands);
        }
      }
      var xScale = ordScale('x');
      var yScale = ordScale('y', undefined, true);
      var xRbScale = ordScale('x', [0, width]);
      var yRbScale = ordScale('y', [height, 0]);
      var X = 0, Y = 1;
      var canvasDim = [width, height];
      var heatmapDim = [xRbScale.domain().length, yRbScale.domain().length];

      ext = d3.extent(heatmap, function(d){return d.v;});
      var color = d3.scale.linear()
        .domain(ext)
        .range(["#fff", "#000"]);

      var scale = [
        d3.scale.linear()
          .domain([0, heatmapDim[X]])
          .range([0, canvasDim[X]]),
        d3.scale.linear()
          .domain([0, heatmapDim[Y]])
          .range([canvasDim[Y], 0])
      ];

      var container = d3.select(slice.selector);

      var canvas = container.append("canvas")
        .attr("width", heatmapDim[X])
        .attr("height", heatmapDim[Y])
        .attr("image-rendering", "pixelated")
        .style("width", canvasDim[X] + "px")
        .style("height", canvasDim[Y] + "px")
        .style("position", "absolute");

      var svg = container.append("svg")
        .attr("width", canvasDim[X])
        .attr("height", canvasDim[Y])
        .style("position", "relative");

      var tip = d3.tip()
          .attr('class', 'd3-tip')
          .offset(function(){
              var k = d3.mouse(this);
              var x = k[0] - (width / 2);
              return [k[1] - 15, x];
          })
          .html(function (d) {
              var k = d3.mouse(this);
              var m = Math.floor(scale[0].invert(k[0]));
              var n = Math.floor(scale[1].invert(k[1]));
              var obj = matrix[m][n];
              if (obj !== undefined) {
                var s = "";
                s += "<div><b>X: </b>" + obj.x + "<div>"
                s += "<div><b>Y: </b>" + obj.y + "<div>"
                s += "<div><b>V: </b>" + obj.v + "<div>"
                return s;
              }
          })
      svg.call(tip);

      var zoom = d3.behavior.zoom()
        .center(canvasDim.map(
          function(v) {return v / 2}))
        .scaleExtent([1, 10])
        .x(scale[X])
        .y(scale[Y])
        .on("zoom", zoomEvent);

      svg.append("rect")
        .style("pointer-events", "all")
        .attr("width", canvasDim[X])
        .attr("height", canvasDim[Y])
        .attr("id", "mycanvas")
        .style("fill", "none")
        .call(zoom);

      var axis = [
        d3.svg.axis()
          .scale(xRbScale)
          .orient("top"),
        d3.svg.axis()
          .scale(yRbScale)
          .orient("right")
      ];

      var axisElement = [
        svg.append("g")
          .attr("class", "x axis")
          .attr("transform", "translate(-1," + (canvasDim[Y]-1) + ")"),
        svg.append("g")
          .attr("class", "y axis")
      ];

     svg.on('mousemove', tip.show);
     svg.on('mouseout', tip.hide);

      var context = canvas.node().getContext("2d");
      context.imageSmoothingEnabled = false;
      var imageObj;
      var imageDim;
      var imageScale;
      createImageObj();
      drawAxes();

      // Compute the pixel colors; scaled by CSS.
      function createImageObj() {
        imageObj = new Image();
        image = context.createImageData(heatmapDim[0], heatmapDim[1]);
        var pixs = {};
        $.each(heatmap, function(i, d) {
            var c = d3.rgb(color(d.v));
            var x = xScale(d.x);
            var y = yScale(d.y);
            pixs[x + (y*xScale.domain().length)] = c;
            if (matrix[x] === undefined)
              matrix[x] = {}
            if (matrix[x][y] === undefined)
              matrix[x][y] = d;
        });

        p = -1;
        for(var i=0; i< heatmapDim[0] * heatmapDim[1]; i++){
            c = pixs[i];
            var alpha = 255;
            if (c === undefined){
              c = d3.rgb('#F00');
              alpha = 0;
            }
            image.data[++p] = c.r;
            image.data[++p] = c.g;
            image.data[++p] = c.b;
            image.data[++p] = alpha;
        }
        context.putImageData(image, 0, 0);
        imageObj.src = canvas.node().toDataURL();
        imageDim = [imageObj.width, imageObj.height];
        imageScale = imageDim.map(
          function(v, i){return v / canvasDim[i]});
      }

      function drawAxes() {
        console.log(scale[0].domain());
        axisElement[0].call(axis[0]);
        axisElement[1].call(axis[1]);
      }

      function zoomEvent() {
        var s = d3.event.scale;
        var n = imageDim.map(
          function(v) {return v * s});
        var t = d3.event.translate.map(function(v, i) {
          return Math.min(
            0,
            Math.max(v, canvasDim[i] - n[i] / imageScale[i]));
        });
        zoom.translate(t);
        var it = t.map(
          function(v, i) {return v * imageScale[i]});
        context.clearRect(0, 0, canvasDim[X], canvasDim[Y]);
        context.drawImage(imageObj, it[X], it[Y], n[X], n[Y]);
        drawAxes();
      }

    });
      slice.done();
  }
  return {
    render: refresh,
    resize: refresh,
  };
});

