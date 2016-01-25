// Inspired from http://bl.ocks.org/mbostock/3074470
px.registerViz('heatmap', function(slice) {
  function refresh() {
    d3.json("https://gist.githubusercontent.com/mbostock/3074470/raw/c028fa03cde541bbd7fdcaa27e61f6332af3b556/heatmap.json", function(error, heatmap) {
      if (error) {
        slice.error(error);
        return;
      }
      var X = 0, Y = 1;
      var canvasDim = [slice.width(), slice.height()];
      var canvasAspect = canvasDim[Y] / canvasDim[X];
      var heatmapDim = [heatmap[X].length, heatmap.length];
      var heatmapAspect = heatmapDim[Y] / heatmapDim[X];

      if (heatmapAspect < canvasAspect)
        canvasDim[Y] = canvasDim[X] * heatmapAspect;
      else
        canvasDim[X] = canvasDim[Y] / heatmapAspect;

      var color = d3.scale.linear()
        .domain([95, 115, 135, 155, 175, 195])
        .range(["#0a0", "#6c0", "#ee0", "#eb4", "#eb9", "#fff"]);

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
        .style("width", canvasDim[X] + "px")
        .style("height", canvasDim[Y] + "px")
        .style("position", "absolute");

      var svg = container.append("svg")
        .attr("width", canvasDim[X])
        .attr("height", canvasDim[Y])
        .style("position", "relative");

    var tip = d3.tip()
        .attr('class', 'd3-tip')
        .offset([10, 0])
        .html(function (d) {
            var k = d3.mouse(this);
            var m = Math.floor(scale[X].invert(k[0]))
            var n = Math.floor(scale[Y].invert(k[1]))
            return "Intensity Count: " + heatmap[n][m];
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
          .scale(scale[X])
          .orient("top"),
        d3.svg.axis()
          .scale(scale[Y])
          .orient("right")
      ];

      var axisElement = [
        svg.append("g")
          .attr("class", "x axis")
          .attr("transform", "translate(-1," + (canvasDim[Y]-1) + ")"),
        svg.append("g")
          .attr("class", "y axis")
      ];

     svg.on('mousemove', tip.show); //Added
     svg.on('mouseout', tip.hide); //Added

      var context = canvas.node().getContext("2d");
      var imageObj;
      var imageDim;
      var imageScale;
      createImageObj();
      drawAxes();

      // Compute the pixel colors; scaled by CSS.
      function createImageObj() {
        imageObj = new Image();
        var image = context.createImageData(heatmapDim[X], heatmapDim[Y]);

        for (var y = 0, p = -1; y < heatmapDim[Y]; ++y) {
          for (var x = 0; x < heatmapDim[X]; ++x) {
              //console.log("heatmap x and y :: ",x,y,heatmap[y][x]);
            var c = d3.rgb(color(heatmap[y][x]));
            image.data[++p] = c.r;
            image.data[++p] = c.g;
            image.data[++p] = c.b;
            image.data[++p] = 255;
          }
        }
        context.putImageData(image, 0, 0);
        imageObj.src = canvas.node().toDataURL();
        imageDim = [imageObj.width, imageObj.height];
        imageScale = imageDim.map(
          function(v, i){return v / canvasDim[i]});
      }

      function drawAxes() {
        axisElement.forEach(function(v, i) {v.call(axis[i])});
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

