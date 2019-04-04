(function() {
  var svg;

  //save off default references
  var d3 = window.d3, topojson = window.topojson;

  var defaultOptions = {
    scope: 'world',
    responsive: false,
    aspectRatio: 0.5625,
    setProjection: setProjection,
    projection: 'equirectangular',
    dataType: 'json',
    data: {},
    done: function() {},
    fills: {
      defaultFill: '#ABDDA4'
    },
    filters: {},
    geographyConfig: {
        dataUrl: null,
        hideAntarctica: true,
        hideHawaiiAndAlaska : false,
        borderWidth: 1,
        borderColor: '#FDFDFD',
        popupTemplate: function(geography, data) {
          return '<div class="hoverinfo"><strong>' + geography.properties.name + '</strong></div>';
        },
        popupOnHover: true,
        highlightOnHover: true,
        highlightFillColor: '#FC8D59',
        highlightBorderColor: 'rgba(250, 15, 160, 0.2)',
        highlightBorderWidth: 2
    },
    projectionConfig: {
      rotation: [97, 0]
    },
    bubblesConfig: {
        borderWidth: 2,
        borderColor: '#FFFFFF',
        popupOnHover: true,
        radius: null,
        popupTemplate: function(geography, data) {
          return '<div class="hoverinfo"><strong>' + data.name + '</strong></div>';
        },
        fillOpacity: 0.75,
        animate: true,
        highlightOnHover: true,
        highlightFillColor: '#FC8D59',
        highlightBorderColor: 'rgba(250, 15, 160, 0.2)',
        highlightBorderWidth: 2,
        highlightFillOpacity: 0.85,
        exitDelay: 100,
        key: JSON.stringify
    },
    arcConfig: {
      strokeColor: '#DD1C77',
      strokeWidth: 1,
      arcSharpness: 1,
      animationSpeed: 600
    }
  };

  /*
    Getter for value. If not declared on datumValue, look up the chain into optionsValue
  */
  function val( datumValue, optionsValue, context ) {
    if ( typeof context === 'undefined' ) {
      context = optionsValue;
      optionsValues = undefined;
    }
    var value = typeof datumValue !== 'undefined' ? datumValue : optionsValue;

    if (typeof value === 'undefined') {
      return  null;
    }

    if ( typeof value === 'function' ) {
      var fnContext = [context];
      if ( context.geography ) {
        fnContext = [context.geography, context.data];
      }
      return value.apply(null, fnContext);
    }
    else {
      return value;
    }
  }

  function addContainer( element, height, width ) {
    this.svg = d3.select( element ).append('svg')
      .attr('width', width || element.offsetWidth)
      .attr('data-width', width || element.offsetWidth)
      .attr('class', 'datamap')
      .attr('height', height || element.offsetHeight)
      .style('overflow', 'hidden'); // IE10+ doesn't respect height/width when map is zoomed in

    if (this.options.responsive) {
      d3.select(this.options.element).style({'position': 'relative', 'padding-bottom': (this.options.aspectRatio*100) + '%'});
      d3.select(this.options.element).select('svg').style({'position': 'absolute', 'width': '100%', 'height': '100%'});
      d3.select(this.options.element).select('svg').select('g').selectAll('path').style('vector-effect', 'non-scaling-stroke');

    }

    return this.svg;
  }

  // setProjection takes the svg element and options
  function setProjection( element, options ) {
    var width = options.width || element.offsetWidth;
    var height = options.height || element.offsetHeight;
    var projection, path;
    var svg = this.svg;

    if ( options && typeof options.scope === 'undefined') {
      options.scope = 'world';
    }

    if ( options.scope === 'usa' ) {
      projection = d3.geo.albersUsa()
        .scale(width)
        .translate([width / 2, height / 2]);
    }
    else if ( options.scope === 'world' ) {
      projection = d3.geo[options.projection]()
        .scale((width + 1) / 2 / Math.PI)
        .translate([width / 2, height / (options.projection === "mercator" ? 1.45 : 1.8)]);
    }

    if ( options.projection === 'orthographic' ) {

      svg.append("defs").append("path")
        .datum({type: "Sphere"})
        .attr("id", "sphere")
        .attr("d", path);

      svg.append("use")
          .attr("class", "stroke")
          .attr("xlink:href", "#sphere");

      svg.append("use")
          .attr("class", "fill")
          .attr("xlink:href", "#sphere");
      projection.scale(250).clipAngle(90).rotate(options.projectionConfig.rotation)
    }

    path = d3.geo.path()
      .projection( projection );

    return {path: path, projection: projection};
  }

  function addStyleBlock() {
    if ( d3.select('.datamaps-style-block').empty() ) {
      d3.select('head').append('style').attr('class', 'datamaps-style-block')
      .html('.datamap path.datamaps-graticule { fill: none; stroke: #777; stroke-width: 0.5px; stroke-opacity: .5; pointer-events: none; } .datamap .labels {pointer-events: none;} .datamap path {stroke: #FFFFFF; stroke-width: 1px;} .datamaps-legend dt, .datamaps-legend dd { float: left; margin: 0 3px 0 0;} .datamaps-legend dd {width: 20px; margin-right: 6px; border-radius: 3px;} .datamaps-legend {padding-bottom: 20px; z-index: 1001; position: absolute; left: 4px; font-size: 12px; font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;} .datamaps-hoverover {display: none; font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; } .hoverinfo {padding: 4px; border-radius: 1px; background-color: #FFF; box-shadow: 1px 1px 5px #CCC; font-size: 12px; border: 1px solid #CCC; } .hoverinfo hr {border:1px dotted #CCC; }');
    }
  }

  function drawSubunits( data ) {
    var fillData = this.options.fills,
        colorCodeData = this.options.data || {},
        geoConfig = this.options.geographyConfig;


    var subunits = this.svg.select('g.datamaps-subunits');
    if ( subunits.empty() ) {
      subunits = this.addLayer('datamaps-subunits', null, true);
    }

    var geoData = topojson.feature( data, data.objects[ this.options.scope ] ).features;
    if ( geoConfig.hideAntarctica ) {
      geoData = geoData.filter(function(feature) {
        return feature.id !== "ATA";
      });
    }

    if ( geoConfig.hideHawaiiAndAlaska ) {
      geoData = geoData.filter(function(feature) {
        return feature.id !== "HI" && feature.id !== 'AK';
      });
    }

    var geo = subunits.selectAll('path.datamaps-subunit').data( geoData );

    geo.enter()
      .append('path')
      .attr('d', this.path)
      .attr('class', function(d) {
        return 'datamaps-subunit ' + d.id;
      })
      .attr('data-info', function(d) {
        return JSON.stringify( colorCodeData[d.id]);
      })
      .style('fill', function(d) {
        //if fillKey - use that
        //otherwise check 'fill'
        //otherwise check 'defaultFill'
        var fillColor;

        var datum = colorCodeData[d.id];
        if ( datum && datum.fillKey ) {
          fillColor = fillData[ val(datum.fillKey, {data: colorCodeData[d.id], geography: d}) ];
        }

        if ( typeof fillColor === 'undefined' ) {
          fillColor = val(datum && datum.fillColor, fillData.defaultFill, {data: colorCodeData[d.id], geography: d});
        }

        return fillColor;
      })
      .style('stroke-width', geoConfig.borderWidth)
      .style('stroke', geoConfig.borderColor);
  }

  function handleGeographyConfig () {
    var hoverover;
    var svg = this.svg;
    var self = this;
    var options = this.options.geographyConfig;

    if ( options.highlightOnHover || options.popupOnHover ) {
      svg.selectAll('.datamaps-subunit')
        .on('mouseover', function(d) {
          var $this = d3.select(this);
          var datum = self.options.data[d.id] || {};
          if ( options.highlightOnHover ) {
            var previousAttributes = {
              'fill':  $this.style('fill'),
              'stroke': $this.style('stroke'),
              'stroke-width': $this.style('stroke-width'),
              'fill-opacity': $this.style('fill-opacity')
            };

            $this
              .style('fill', val(datum.highlightFillColor, options.highlightFillColor, datum))
              .style('stroke', val(datum.highlightBorderColor, options.highlightBorderColor, datum))
              .style('stroke-width', val(datum.highlightBorderWidth, options.highlightBorderWidth, datum))
              .style('fill-opacity', val(datum.highlightFillOpacity, options.highlightFillOpacity, datum))
              .attr('data-previousAttributes', JSON.stringify(previousAttributes));

            //as per discussion on https://github.com/markmarkoh/datamaps/issues/19
            if ( ! /((MSIE)|(Trident))/.test(navigator.userAgent) ) {
             moveToFront.call(this);
            }
          }

          if ( options.popupOnHover ) {
            self.updatePopup($this, d, options, svg);
          }
        })
        .on('mouseout', function() {
          var $this = d3.select(this);

          if (options.highlightOnHover) {
            //reapply previous attributes
            var previousAttributes = JSON.parse( $this.attr('data-previousAttributes') );
            for ( var attr in previousAttributes ) {
              $this.style(attr, previousAttributes[attr]);
            }
          }
          $this.on('mousemove', null);
          d3.selectAll('.datamaps-hoverover').style('display', 'none');
        });
    }

    function moveToFront() {
      this.parentNode.appendChild(this);
    }
  }

  //plugin to add a simple map legend
  function addLegend(layer, data, options) {
    data = data || {};
    if ( !this.options.fills ) {
      return;
    }

    var html = '<dl>';
    var label = '';
    if ( data.legendTitle ) {
      html = '<h2>' + data.legendTitle + '</h2>' + html;
    }
    for ( var fillKey in this.options.fills ) {

      if ( fillKey === 'defaultFill') {
        if (! data.defaultFillName ) {
          continue;
        }
        label = data.defaultFillName;
      } else {
        if (data.labels && data.labels[fillKey]) {
          label = data.labels[fillKey];
        } else {
          label= fillKey + ': ';
        }
      }
      html += '<dt>' + label + '</dt>';
      html += '<dd style="background-color:' +  this.options.fills[fillKey] + '">&nbsp;</dd>';
    }
    html += '</dl>';

    var hoverover = d3.select( this.options.element ).append('div')
      .attr('class', 'datamaps-legend')
      .html(html);
  }

    function addGraticule ( layer, options ) {
      var graticule = d3.geo.graticule();
      this.svg.insert("path", '.datamaps-subunits')
        .datum(graticule)
        .attr("class", "datamaps-graticule")
        .attr("d", this.path);
  }

  function handleArcs (layer, data, options) {
    var self = this,
        svg = this.svg;

    if ( !data || (data && !data.slice) ) {
      throw "Datamaps Error - arcs must be an array";
    }

    // For some reason arc options were put in an `options` object instead of the parent arc
    // I don't like this, so to match bubbles and other plugins I'm moving it
    // This is to keep backwards compatability
    for ( var i = 0; i < data.length; i++ ) {
      data[i] = defaults(data[i], data[i].options);
      delete data[i].options;
    }

    if ( typeof options === "undefined" ) {
      options = defaultOptions.arcConfig;
    }

    var arcs = layer.selectAll('path.datamaps-arc').data( data, JSON.stringify );

    var path = d3.geo.path()
        .projection(self.projection);

    arcs
      .enter()
        .append('svg:path')
        .attr('class', 'datamaps-arc')
        .style('stroke-linecap', 'round')
        .style('stroke', function(datum) {
          return val(datum.strokeColor, options.strokeColor, datum);
        })
        .style('fill', 'none')
        .style('stroke-width', function(datum) {
            return val(datum.strokeWidth, options.strokeWidth, datum);
        })
        .attr('d', function(datum) {
            var originXY = self.latLngToXY(val(datum.origin.latitude, datum), val(datum.origin.longitude, datum))
            var destXY = self.latLngToXY(val(datum.destination.latitude, datum), val(datum.destination.longitude, datum));
            var midXY = [ (originXY[0] + destXY[0]) / 2, (originXY[1] + destXY[1]) / 2];
            if (options.greatArc) {
                  // TODO: Move this to inside `if` clause when setting attr `d`
              var greatArc = d3.geo.greatArc()
                  .source(function(d) { return [val(d.origin.longitude, d), val(d.origin.latitude, d)]; })
                  .target(function(d) { return [val(d.destination.longitude, d), val(d.destination.latitude, d)]; });

              return path(greatArc(datum))
            }
            var sharpness = val(datum.arcSharpness, options.arcSharpness, datum);
            return "M" + originXY[0] + ',' + originXY[1] + "S" + (midXY[0] + (50 * sharpness)) + "," + (midXY[1] - (75 * sharpness)) + "," + destXY[0] + "," + destXY[1];
        })
        .transition()
          .delay(100)
          .style('fill', function(datum) {
            /*
              Thank you Jake Archibald, this is awesome.
              Source: http://jakearchibald.com/2013/animated-line-drawing-svg/
            */
            var length = this.getTotalLength();
            this.style.transition = this.style.WebkitTransition = 'none';
            this.style.strokeDasharray = length + ' ' + length;
            this.style.strokeDashoffset = length;
            this.getBoundingClientRect();
            this.style.transition = this.style.WebkitTransition = 'stroke-dashoffset ' + val(datum.animationSpeed, options.animationSpeed, datum) + 'ms ease-out';
            this.style.strokeDashoffset = '0';
            return 'none';
          })

    arcs.exit()
      .transition()
      .style('opacity', 0)
      .remove();
  }

  function handleLabels ( layer, options ) {
    var self = this;
    options = options || {};
    var labelStartCoodinates = this.projection([-67.707617, 42.722131]);
    this.svg.selectAll(".datamaps-subunit")
      .attr("data-foo", function(d) {
        var center = self.path.centroid(d);
        var xOffset = 7.5, yOffset = 5;

        if ( ["FL", "KY", "MI"].indexOf(d.id) > -1 ) xOffset = -2.5;
        if ( d.id === "NY" ) xOffset = -1;
        if ( d.id === "MI" ) yOffset = 18;
        if ( d.id === "LA" ) xOffset = 13;

        var x,y;

        x = center[0] - xOffset;
        y = center[1] + yOffset;

        var smallStateIndex = ["VT", "NH", "MA", "RI", "CT", "NJ", "DE", "MD", "DC"].indexOf(d.id);
        if ( smallStateIndex > -1) {
          var yStart = labelStartCoodinates[1];
          x = labelStartCoodinates[0];
          y = yStart + (smallStateIndex * (2+ (options.fontSize || 12)));
          layer.append("line")
            .attr("x1", x - 3)
            .attr("y1", y - 5)
            .attr("x2", center[0])
            .attr("y2", center[1])
            .style("stroke", options.labelColor || "#000")
            .style("stroke-width", options.lineWidth || 1)
        }

        layer.append("text")
          .attr("x", x)
          .attr("y", y)
          .style("font-size", (options.fontSize || 10) + 'px')
          .style("font-family", options.fontFamily || "Verdana")
          .style("fill", options.labelColor || "#000")
          .text( d.id );
        return "bar";
      });
  }


  function handleBubbles (layer, data, options ) {
    var self = this,
        fillData = this.options.fills,
        filterData = this.options.filters,
        svg = this.svg;

    if ( !data || (data && !data.slice) ) {
      throw "Datamaps Error - bubbles must be an array";
    }

    var bubbles = layer.selectAll('circle.datamaps-bubble').data( data, options.key );

    bubbles
      .enter()
        .append('svg:circle')
        .attr('class', 'datamaps-bubble')
        .attr('cx', function ( datum ) {
          var latLng;
          if ( datumHasCoords(datum) ) {
            latLng = self.latLngToXY(datum.latitude, datum.longitude);
          }
          else if ( datum.centered ) {
            latLng = self.path.centroid(svg.select('path.' + datum.centered).data()[0]);
          }
          if ( latLng ) return latLng[0];
        })
        .attr('cy', function ( datum ) {
          var latLng;
          if ( datumHasCoords(datum) ) {
            latLng = self.latLngToXY(datum.latitude, datum.longitude);
          }
          else if ( datum.centered ) {
            latLng = self.path.centroid(svg.select('path.' + datum.centered).data()[0]);
          }
          if ( latLng ) return latLng[1];
        })
        .attr('r', function(datum) {
          // if animation enabled start with radius 0, otherwise use full size.
          return options.animate ? 0 : val(datum.radius, options.radius, datum);
        })
        .attr('data-info', function(d) {
          return JSON.stringify(d);
        })
        .attr('filter', function (datum) {
          var filterKey = filterData[ val(datum.filterKey, options.filterKey, datum) ];

          if (filterKey) {
            return filterKey;
          }
        })
        .style('stroke', function ( datum ) {
          return val(datum.borderColor, options.borderColor, datum);
        })
        .style('stroke-width', function ( datum ) {
          return val(datum.borderWidth, options.borderWidth, datum);
        })
        .style('fill-opacity', function ( datum ) {
          return val(datum.fillOpacity, options.fillOpacity, datum);
        })
        .style('fill', function ( datum ) {
          var fillColor = fillData[ val(datum.fillKey, options.fillKey, datum) ];
          return fillColor || fillData.defaultFill;
        })
        .on('mouseover', function ( datum ) {
          var $this = d3.select(this);

          if (options.highlightOnHover) {
            //save all previous attributes for mouseout
            var previousAttributes = {
              'fill':  $this.style('fill'),
              'stroke': $this.style('stroke'),
              'stroke-width': $this.style('stroke-width'),
              'fill-opacity': $this.style('fill-opacity')
            };

            $this
              .style('fill', val(datum.highlightFillColor, options.highlightFillColor, datum))
              .style('stroke', val(datum.highlightBorderColor, options.highlightBorderColor, datum))
              .style('stroke-width', val(datum.highlightBorderWidth, options.highlightBorderWidth, datum))
              .style('fill-opacity', val(datum.highlightFillOpacity, options.highlightFillOpacity, datum))
              .attr('data-previousAttributes', JSON.stringify(previousAttributes));
          }

          if (options.popupOnHover) {
            self.updatePopup($this, datum, options, svg);
          }
        })
        .on('mouseout', function ( datum ) {
          var $this = d3.select(this);

          if (options.highlightOnHover) {
            //reapply previous attributes
            var previousAttributes = JSON.parse( $this.attr('data-previousAttributes') );
            for ( var attr in previousAttributes ) {
              $this.style(attr, previousAttributes[attr]);
            }
          }

          d3.selectAll('.datamaps-hoverover').style('display', 'none');
        })

    bubbles.transition()
      .duration(400)
      .attr('r', function ( datum ) {
        return val(datum.radius, options.radius, datum);
      });

    bubbles.exit()
      .transition()
        .delay(options.exitDelay)
        .attr("r", 0)
        .remove();

    function datumHasCoords (datum) {
      return typeof datum !== 'undefined' && typeof datum.latitude !== 'undefined' && typeof datum.longitude !== 'undefined';
    }
  }

  //stolen from underscore.js
  function defaults(obj) {
    Array.prototype.slice.call(arguments, 1).forEach(function(source) {
      if (source) {
        for (var prop in source) {
          if (obj[prop] == null) obj[prop] = source[prop];
        }
      }
    });
    return obj;
  }
  /**************************************
             Public Functions
  ***************************************/

  function Datamap( options ) {

    if ( typeof d3 === 'undefined' || typeof topojson === 'undefined' ) {
      throw new Error('Include d3.js (v3.0.3 or greater) and topojson on this page before creating a new map');
   }
    //set options for global use
    this.options = defaults(options, defaultOptions);
    this.options.geographyConfig = defaults(options.geographyConfig, defaultOptions.geographyConfig);
    this.options.projectionConfig = defaults(options.projectionConfig, defaultOptions.projectionConfig);
    this.options.bubblesConfig = defaults(options.bubblesConfig, defaultOptions.bubblesConfig);
    this.options.arcConfig = defaults(options.arcConfig, defaultOptions.arcConfig);

    //add the SVG container
    if ( d3.select( this.options.element ).select('svg').length > 0 ) {
      addContainer.call(this, this.options.element, this.options.height, this.options.width );
    }

    /* Add core plugins to this instance */
    this.addPlugin('bubbles', handleBubbles);
    this.addPlugin('legend', addLegend);
    this.addPlugin('arc', handleArcs);
    this.addPlugin('labels', handleLabels);
    this.addPlugin('graticule', addGraticule);

    //append style block with basic hoverover styles
    if ( ! this.options.disableDefaultStyles ) {
      addStyleBlock();
    }

    return this.draw();
  }

  // resize map
  Datamap.prototype.resize = function () {

    var self = this;
    var options = self.options;

    if (options.responsive) {
      var newsize = options.element.clientWidth,
          oldsize = d3.select( options.element).select('svg').attr('data-width');

      d3.select(options.element).select('svg').selectAll('g').attr('transform', 'scale(' + (newsize / oldsize) + ')');
    }
  }

  // actually draw the features(states & countries)
  Datamap.prototype.draw = function() {
    //save off in a closure
    var self = this;
    var options = self.options;

    //set projections and paths based on scope
    var pathAndProjection = options.setProjection.apply(self, [options.element, options] );

    this.path = pathAndProjection.path;
    this.projection = pathAndProjection.projection;

    //if custom URL for topojson data, retrieve it and render
    if ( options.geographyConfig.dataUrl ) {
      d3.json( options.geographyConfig.dataUrl, function(error, results) {
        if ( error ) throw new Error(error);
        self.customTopo = results;
        draw( results );
      });
    }
    else {
      draw( this[options.scope + 'Topo'] || options.geographyConfig.dataJson);
    }

    return this;

      function draw (data) {
        // if fetching remote data, draw the map first then call `updateChoropleth`
        if ( self.options.dataUrl ) {
          //allow for csv or json data types
          d3[self.options.dataType](self.options.dataUrl, function(data) {
            //in the case of csv, transform data to object
            if ( self.options.dataType === 'csv' && (data && data.slice) ) {
              var tmpData = {};
              for(var i = 0; i < data.length; i++) {
                tmpData[data[i].id] = data[i];
              }
              data = tmpData;
            }
            Datamaps.prototype.updateChoropleth.call(self, data);
          });
        }
        drawSubunits.call(self, data);
        handleGeographyConfig.call(self);

        if ( self.options.geographyConfig.popupOnHover || self.options.bubblesConfig.popupOnHover) {
          hoverover = d3.select( self.options.element ).append('div')
            .attr('class', 'datamaps-hoverover')
            .style('z-index', 10001)
            .style('position', 'absolute');
        }

        //fire off finished callback
        self.options.done(self);
      }
  };
  /**************************************
                TopoJSON
  ***************************************/
  Datamap.prototype.worldTopo = '__WORLD__';
  Datamap.prototype.abwTopo = '__ABW__';
  Datamap.prototype.afgTopo = '__AFG__';
  Datamap.prototype.agoTopo = '__AGO__';
  Datamap.prototype.aiaTopo = '__AIA__';
  Datamap.prototype.albTopo = '__ALB__';
  Datamap.prototype.aldTopo = '__ALD__';
  Datamap.prototype.andTopo = '__AND__';
  Datamap.prototype.areTopo = '__ARE__';
  Datamap.prototype.argTopo = '__ARG__';
  Datamap.prototype.armTopo = '__ARM__';
  Datamap.prototype.asmTopo = '__ASM__';
  Datamap.prototype.ataTopo = '__ATA__';
  Datamap.prototype.atcTopo = '__ATC__';
  Datamap.prototype.atfTopo = '__ATF__';
  Datamap.prototype.atgTopo = '__ATG__';
  Datamap.prototype.ausTopo = '__AUS__';
  Datamap.prototype.autTopo = '__AUT__';
  Datamap.prototype.azeTopo = '__AZE__';
  Datamap.prototype.bdiTopo = '__BDI__';
  Datamap.prototype.belTopo = '__BEL__';
  Datamap.prototype.benTopo = '__BEN__';
  Datamap.prototype.bfaTopo = '__BFA__';
  Datamap.prototype.bgdTopo = '__BGD__';
  Datamap.prototype.bgrTopo = '__BGR__';
  Datamap.prototype.bhrTopo = '__BHR__';
  Datamap.prototype.bhsTopo = '__BHS__';
  Datamap.prototype.bihTopo = '__BIH__';
  Datamap.prototype.bjnTopo = '__BJN__';
  Datamap.prototype.blmTopo = '__BLM__';
  Datamap.prototype.blrTopo = '__BLR__';
  Datamap.prototype.blzTopo = '__BLZ__';
  Datamap.prototype.bmuTopo = '__BMU__';
  Datamap.prototype.bolTopo = '__BOL__';
  Datamap.prototype.braTopo = '__BRA__';
  Datamap.prototype.brbTopo = '__BRB__';
  Datamap.prototype.brnTopo = '__BRN__';
  Datamap.prototype.btnTopo = '__BTN__';
  Datamap.prototype.norTopo = '__NOR__';
  Datamap.prototype.bwaTopo = '__BWA__';
  Datamap.prototype.cafTopo = '__CAF__';
  Datamap.prototype.canTopo = '__CAN__';
  Datamap.prototype.cheTopo = {"type":"Topology","objects":{"che":{"type":"GeometryCollection","geometries":[{"type":"Polygon","properties":{"name":"Genève"},"id":"CH.GE","arcs":[[0,1]]},{"type":"Polygon","properties":{"name":"Jura"},"id":"CH.JU","arcs":[[2,3,4,5,6,7,8,9]]},{"type":"Polygon","properties":{"name":"Neuchâtel"},"id":"CH.NE","arcs":[[10,11,12,13,14,15,16,-9]]},{"type":"Polygon","properties":{"name":"Aargau"},"id":"CH.AG","arcs":[[17,18,19,20,21,22,23]]},{"type":"Polygon","properties":{"name":"Lucerne"},"id":"CH.LU","arcs":[[24,25,26,27,28,-20]]},{"type":"Polygon","properties":{"name":"Nidwalden"},"id":"CH.NW","arcs":[[29,30,31,32,33,-27]]},{"type":"Polygon","properties":{"name":"Valais"},"id":"CH.VS","arcs":[[34,35,36,37,38]]},{"type":"Polygon","properties":{"name":"Appenzell Ausserrhoden"},"id":"CH.AR","arcs":[[39,40,41,42,43,44]]},{"type":"Polygon","properties":{"name":"Sankt Gallen"},"id":"CH.SG","arcs":[[45,46,47,48,49,50],[51,-43,52,-41,53,-45]]},{"type":"Polygon","properties":{"name":"Ticino"},"id":"CH.TI","arcs":[[54,-35,55,56]]},{"type":"Polygon","properties":{"name":"Glarus"},"id":"CH.GL","arcs":[[57,58,59,-48]]},{"type":"Polygon","properties":{"name":"Graubünden"},"id":"CH.GR","arcs":[[-57,60,-58,-47,61]]},{"type":"MultiPolygon","properties":{"name":"Schaffhausen"},"id":"CH.SH","arcs":[[[62,63]],[[64,65,66]]]},{"type":"Polygon","properties":{"name":"Schwyz"},"id":"CH.SZ","arcs":[[-60,67,-30,-26,68,69,-49]]},{"type":"Polygon","properties":{"name":"Thurgau"},"id":"CH.TG","arcs":[[70,-51,71,-65]]},{"type":"Polygon","properties":{"name":"Uri"},"id":"CH.UR","arcs":[[-59,-61,-56,-39,72,73,-31,-68]]},{"type":"Polygon","properties":{"name":"Zürich"},"id":"CH.ZH","arcs":[[-72,-50,-70,74,-18,75,-64,76,-66]]},{"type":"Polygon","properties":{"name":"Zug"},"id":"CH.ZG","arcs":[[-69,-25,-19,-75]]},{"type":"MultiPolygon","properties":{"name":"Fribourg"},"id":"CH.FR","arcs":[[[77]],[[78]],[[-15,79]],[[80]],[[81,-13,82,83]]]},{"type":"MultiPolygon","properties":{"name":"Vaud"},"id":"CH.VD","arcs":[[[-14,-82,84,-37,85,-2,86,-16,-80],[-79],[-78]],[[-12,87,-83]]]},{"type":"MultiPolygon","properties":{"name":"Basel-Landschaft"},"id":"CH.BS","arcs":[[[-3,88,89]],[[90,91,92,93,94,95,-23,96,-4]]]},{"type":"MultiPolygon","properties":{"name":"Bern"},"id":"CH.BE","arcs":[[[97,-21,-29,98,-33,99,-73,-38,-85,-84,-88,-11,-8],[-81]],[[-6,100]]]},{"type":"Polygon","properties":{"name":"Basel-Stadt"},"id":"CH.BS","arcs":[[-95,101]]},{"type":"MultiPolygon","properties":{"name":"Solothurn"},"id":"CH.","arcs":[[[-90,102,-91]],[[-22,-98,-7,-101,-5,-97]],[[103,-93]]]},{"type":"MultiPolygon","properties":{"name":"Obwalden"},"id":"CH.NW","arcs":[[[-74,-100,-32]],[[-99,-28,-34]]]},{"type":"MultiPolygon","properties":{"name":"Appenzell Innerrhoden"},"id":"CH.AI","arcs":[[[-44,-52]],[[-53,-42]],[[-54,-40]]]}]}},"arcs":[[[580,2468],[4,-20],[20,-86],[1,-21],[22,-83],[9,-22],[23,-19],[37,27],[16,-10],[11,-117],[-57,-95],[-142,-149],[-113,-209],[-72,-59],[-75,53],[-101,-6],[-101,-38],[-53,-50],[29,109],[17,51],[7,44],[-39,77],[-23,70],[8,60],[54,55],[133,102],[4,2],[3,1],[5,-1],[17,-9],[13,-2],[13,2],[49,24],[10,34],[-3,46],[2,55],[15,143],[8,39],[32,114]],[[363,2580],[22,-28],[101,-132],[94,48]],[[3063,8134],[5,-14],[7,-9],[93,-71]],[[3168,8040],[60,-75],[15,-39],[4,-40],[7,-11],[7,-6],[24,0]],[[3285,7869],[108,-43],[43,-6],[16,1],[18,-9],[19,-21],[20,-54],[36,-46]],[[3545,7691],[-36,-52],[-5,-34],[2,-16],[7,-8],[42,-8]],[[3555,7573],[-6,-13]],[[3549,7560],[-132,-58],[-243,30],[-21,14],[-5,19],[-8,25],[-6,3],[-5,-8],[-5,-22],[-8,-18],[-12,-19],[-18,-12],[-10,-11],[-10,-15],[-17,-21],[-25,-25],[-57,-32],[-34,-11],[-42,-4],[-187,59],[-6,-52],[4,-22],[-4,-19],[-9,-14],[-22,-26],[-4,-15],[-1,-12],[0,-16],[4,-36],[5,-21],[-12,-17],[-109,-32],[-69,10],[-14,-4],[-9,-14],[-4,-29],[-2,-8],[-4,-12],[-16,-37],[-11,-33],[-16,-34],[-23,-36],[-35,-29],[-21,-23],[-24,-38],[-23,-7],[-50,3],[-26,-23],[-80,-95],[-24,-23],[-18,-7],[-9,8],[-7,13],[-21,26],[-61,7]],[[1983,6787],[-26,16]],[[1957,6803],[5,7],[43,108],[64,103],[150,171],[-9,125],[15,104],[41,67],[20,3],[12,8],[33,67],[23,21],[22,10],[21,21],[18,55],[-24,51],[-33,47],[-33,42],[-41,-31],[-263,-40],[11,65],[27,79],[33,66],[57,52],[3,95],[30,10],[29,10],[36,32],[33,44],[16,42],[-10,60],[-23,70],[-6,56],[41,20],[20,24],[20,8],[20,-8],[20,-24],[58,-13],[110,30],[52,-17],[29,-26],[4,-1],[26,-6],[60,9],[-40,-143],[12,-82],[48,-45],[66,-32],[9,-11],[6,-18],[9,-18],[17,-12],[15,5],[84,56],[58,19],[62,-4]],[[1983,6787],[46,-38],[25,-52],[14,-45],[5,-26],[2,-21],[-2,-33],[-9,-64],[-2,-8],[-3,-7],[-8,-13],[-2,-5],[-6,-36],[1,-32],[6,0],[338,164],[15,6],[1,-69],[31,-13],[64,-56],[18,-24],[8,-21],[0,-9],[-3,-6],[-6,-5],[-3,-4],[-3,-6],[1,-8],[2,-9],[2,-8],[2,-13],[4,-39],[0,-13],[0,-15],[-1,-8],[-2,-11],[-3,-10],[-7,-6],[-8,-5],[-6,-6],[-14,-20],[-9,-9],[-49,-33],[-9,-16],[-6,-23],[-13,-83],[-10,-36],[-21,-91]],[[2363,5902],[-167,-215]],[[2196,5687],[-85,-109]],[[2111,5578],[-71,-93]],[[2040,5485],[-242,-312]],[[1798,5173],[-37,127],[-4,21],[-4,32],[1,48],[-1,29],[-7,26],[-18,23],[-12,25],[-6,31],[5,48],[-7,63],[-131,-123],[-58,-78],[-35,-35],[-67,-35],[-108,-90],[-30,-38],[-23,-17],[-19,-6],[-114,-9],[-41,-11]],[[1082,5204],[8,32],[4,70],[-7,55],[-30,88],[-9,46],[33,177],[108,97],[238,117],[148,176],[50,113],[-26,94],[30,80],[20,32],[56,31],[8,32],[9,9],[31,26],[-2,86],[66,36],[140,202]],[[5466,8888],[-4,-31],[-51,-127],[-48,-75],[-37,-92],[-11,-95],[-1,-52],[12,-70],[49,-161],[16,-78],[30,-62],[6,-19],[-9,-41],[-59,-94],[-5,-27],[7,-11],[13,-16],[43,-35],[10,-18],[0,-31],[-5,-55],[-1,-16],[2,-17],[5,-19],[26,-44],[66,32],[-6,-48],[-21,-55],[-41,-83],[-38,-37],[-15,-9],[-6,-1],[-7,0],[-6,-2],[6,-41],[49,-164]],[[5435,7194],[-28,-87],[-2,-13],[-2,-32],[12,-212],[16,-177]],[[5431,6673],[-1,0],[-63,4],[-28,20],[-12,17],[-16,31],[-24,60],[-8,24],[-74,329],[-17,57],[-9,43],[-7,49],[-12,30],[-13,19],[-37,23],[-37,-6],[-37,-67],[-10,-41],[-51,-139],[-36,-42],[-20,-3],[-15,10],[-10,11],[-8,13],[-5,8],[-2,17],[-4,10],[0,7],[3,5],[16,10],[-6,8],[-20,13],[-60,3],[-44,23],[-34,54],[-152,-92],[-50,152],[-34,22],[-47,-2],[-10,-2],[-3,-7],[-2,-13],[1,-40],[2,-43],[-1,-18],[-2,-10],[-1,-5],[-3,-6],[-9,-10],[-57,-31],[-50,-1],[-136,-42]],[[4176,7125],[-28,76],[-2,13],[-6,98]],[[4140,7312],[17,32],[53,165],[7,13],[98,140],[16,-6],[19,-11],[142,-34],[16,13],[18,19],[30,109],[25,59],[16,57],[-2,96],[-28,12],[-22,19],[-19,29],[-10,23],[-10,70],[-15,14],[-2,45],[2,11],[-1,16],[-4,16],[-19,36],[-34,10]],[[4433,8265],[-28,28],[-2,10],[-3,21],[0,72],[-68,11],[-20,23],[-8,38],[-65,152],[-10,35],[-13,15],[-17,37],[-32,15],[-13,-4],[-6,-7],[-3,-21],[-1,-32],[-2,-16],[-5,-14],[-56,-78],[-30,-7],[-6,18],[-5,29],[-1,29],[1,24],[-8,12],[-5,6],[-11,2],[-81,62],[-7,8]],[[3928,8733],[88,28],[41,37],[36,65],[40,97],[31,-25],[143,-13],[13,-22],[8,-47],[4,-47],[6,-22],[288,0],[100,35],[21,22],[10,22],[9,26],[19,33],[18,22],[48,40],[41,18],[15,25],[11,25],[11,11],[120,31],[40,0],[57,-27],[26,-4],[12,-22],[12,-48],[15,-49],[22,-22],[84,-34],[142,-2],[7,2]],[[5431,6673],[28,-70],[19,-7],[10,-7],[9,-4],[3,-4],[13,-55]],[[5513,6526],[-68,-64],[-12,-18],[-7,-18],[-3,-20],[0,-26],[-4,-18],[-7,-17],[-20,-33],[-3,-16],[3,-28],[12,-25],[25,-21],[34,25],[88,-37],[85,-122],[9,-18],[7,-25],[-8,-39],[-7,-25],[-74,-61]],[[5563,5920],[-11,35],[-31,46],[-31,10],[-20,-30],[-2,-23],[-22,-11],[-73,2],[-3,5],[-1,4],[-1,13],[-24,22],[-34,-27],[-48,-26],[-28,9],[-26,2],[-27,-8],[-54,0],[-38,-12],[-43,-23],[-12,-13],[-7,-26],[-2,-20],[11,-38]],[[5036,5811],[-123,-19],[-37,-38],[-5,-13],[8,-45],[2,-25],[-3,-25],[-45,-65],[-53,-105],[-9,-4],[-5,5],[-4,12],[-4,6],[-7,2],[-12,-2],[-11,-6],[-9,-12],[-16,-37],[-8,-24],[-8,-37],[-8,-72],[-38,-138],[-5,-27],[7,-52],[11,-36],[11,-79],[-36,-90]],[[4629,4885],[-45,5],[-38,-24],[-33,-29],[-17,-6],[-14,6],[-29,56],[-27,63],[-146,184],[-34,58],[-1,40],[-21,100],[4,23],[21,33],[7,29],[2,36],[-5,62],[0,30],[4,21],[8,9],[19,12],[17,17],[5,2],[18,-6],[12,2],[10,13],[7,18],[5,20],[3,10],[12,13],[4,11],[3,15],[2,32],[4,13],[8,17],[5,14],[8,46],[6,21],[14,117],[-47,15],[-16,21],[-59,8],[-7,82],[-12,21],[-15,42],[-19,40],[-5,35],[0,31],[7,103],[0,100],[4,52],[7,34],[17,50],[-19,153],[0,51],[-7,40],[-12,45],[-10,29],[-58,205]],[[5563,5920],[54,-59],[160,33]],[[5777,5894],[4,-31],[-3,-26],[-31,-150],[-7,-20],[-9,-16],[-26,-37],[-112,-91],[-38,-40],[-4,-10],[-2,-17],[17,-38],[6,-22],[3,-33],[-4,-36],[9,-101]],[[5580,5226],[-108,-7],[-23,28],[-8,31],[-10,7],[-10,-1],[-43,-43],[-8,-4],[-4,1],[0,6],[2,11],[0,14],[0,19],[-12,27],[-8,4],[-9,-10],[-8,-25],[1,-18],[7,-23],[5,-59],[3,-24],[12,-64],[1,-17],[-1,-18],[0,-13],[5,-8],[17,-16],[3,-11],[2,-22],[1,-7],[2,-6],[3,-6],[8,-13],[8,-25],[7,-13],[8,-11],[35,-23],[7,-10],[4,-18],[-5,-9],[-64,-31]],[[5400,4819],[-52,72]],[[5348,4891],[-46,43],[-45,99],[-6,119],[4,48],[2,102],[11,57],[3,24],[0,134],[-4,21],[-11,16],[-52,38],[-14,20],[-11,23],[3,33],[5,18],[8,16],[6,17],[6,23],[4,21],[3,26],[-6,13],[-7,8],[-84,40],[-9,0],[-10,-5],[-12,-11],[-13,-9],[-37,-14]],[[5589,3590],[-64,-137],[-37,-39],[-51,-9],[-20,-10],[-7,-12],[-1,-12],[3,-9],[0,-10],[-1,-11],[-11,-34],[-10,-36],[-5,-33],[2,-38],[1,-20],[0,-2]],[[5388,3178],[-94,-32],[-61,-51],[-47,-79],[-18,-64],[8,-22],[15,-17],[1,-51],[-14,-47],[-22,-41],[-25,-31],[-63,-50],[-109,-227],[-46,-50],[-96,-34],[-48,-35],[-43,-70],[-22,-49],[-10,-42],[8,-20],[52,-71],[66,-200],[6,-185],[-48,-164],[-97,-133],[-24,-13],[-46,-8],[-22,-27],[-16,-52],[-5,-58],[0,-56],[-12,-144],[-4,-10],[-22,-75],[-1,-11],[-28,-57],[-16,-21],[-21,-11],[-157,-56],[-32,-41],[-24,-73],[-6,-96],[-46,-3],[-2,-8],[-7,-52],[1,-27],[-5,-17],[-28,-24],[-12,1],[-40,20],[-61,-2],[-106,62],[-22,-4],[-17,-13],[-18,-7],[-28,15],[-3,13],[-42,96],[-33,49],[-35,32],[-225,90],[-38,-31],[-21,-57],[-24,-50],[-47,-10],[-66,-45],[-131,-152],[-71,-40],[-166,28],[-29,-16],[-63,-61],[-136,-89],[-67,-20],[-73,-2],[-68,22],[-51,49],[-100,177],[-15,41],[-12,50],[-16,93],[-25,105],[-8,53],[-11,12],[-150,269],[-50,35],[-19,-12],[-16,-26],[-16,-20],[-22,4],[-19,24],[-1,15],[4,22],[-1,39],[3,5],[0,52],[-4,51],[-6,-5],[10,26],[18,34],[15,39],[3,38],[-34,52],[-177,62],[-19,85],[20,173],[39,180],[78,242],[-50,137],[-79,131],[-42,116],[12,58],[58,108],[16,85],[-2,49]],[[1847,2950],[42,-4],[105,-33],[27,25],[15,-36],[32,-62],[15,-43],[-1,-26],[-5,-33],[-3,-38],[9,-37],[27,-30],[30,-10],[23,-30],[10,-89],[11,-46],[141,-387],[49,-106],[16,-49],[26,-52],[85,75],[73,76],[52,103],[25,17],[43,68],[31,69],[26,72],[8,38],[-4,67],[1,16],[38,66],[27,48]],[[2821,2579],[77,71],[17,46],[1,18],[1,15],[3,7],[8,7],[72,38],[13,0],[6,-11],[1,-35],[-2,-25],[0,-16],[2,-12],[14,-7],[13,-10],[83,44],[51,55],[21,41],[5,7],[5,4],[32,11],[97,2],[53,-25],[6,-5],[13,-6],[13,1],[20,8],[79,53],[32,46],[-29,25],[-13,27],[51,50],[75,36],[7,12],[24,30],[4,10],[3,19],[4,15],[7,10],[10,9],[46,-10],[147,-111],[26,4],[270,308],[26,-12],[33,0],[20,5],[47,29],[81,90],[61,62],[7,15],[9,25],[-1,16],[-3,17],[-5,17],[-6,14],[-3,11],[0,7],[4,8],[8,10],[72,71],[57,4],[190,-56],[18,-26],[54,-37],[59,-10],[3,-3],[1,-9],[0,-13],[2,-16],[7,-9],[11,-6],[13,1],[116,38],[53,29],[102,90],[23,32],[35,35],[23,37],[11,25],[10,29],[11,110],[13,79],[9,41],[14,42],[42,83],[24,5]],[[5440,4215],[18,-13],[5,-13],[4,-23],[-1,-43],[-5,-62],[-7,-55],[-16,-82],[-2,-24],[3,-29],[6,-31],[23,-92],[34,-83],[87,-75]],[[8097,8225],[-58,-37],[-33,-10],[-42,4],[0,-21],[3,-10],[70,-54]],[[8037,8097],[4,-46],[-94,-91]],[[7947,7960],[-5,70],[11,19],[1,23],[-2,18],[-9,20],[-11,16],[-14,18],[-8,-3],[-7,-9],[-7,-11],[-9,-9],[-5,-7],[-3,-12],[-1,-8],[-2,-9],[-1,-4],[3,-5],[7,-9],[3,-10],[-5,-11],[-26,-19],[-23,-20],[-7,-57]],[[7827,7941],[-12,-127],[16,-76]],[[7831,7738],[-72,4],[-235,171],[-14,-21],[0,-37],[-2,-63],[-12,-48],[-12,-35],[-18,-33],[-33,-41],[-7,-30],[-6,-118],[4,-44],[8,-31],[17,-35],[6,-16],[5,-15],[8,-40],[4,-21],[11,-53]],[[7483,7232],[-37,-15],[-8,0],[-6,0],[-23,27],[-68,59],[-111,22],[-20,9],[-9,9],[-17,30],[26,48],[-15,113],[1,32],[4,20],[15,24],[7,17],[10,28],[-3,17],[-7,8],[-10,0],[-22,-8],[-29,88],[4,10],[27,40],[17,46],[21,74],[12,31],[8,14],[19,-5],[80,18],[16,0],[36,-18],[100,31],[80,21],[48,-1],[27,12],[13,24],[4,26],[7,31],[12,31],[26,9],[19,11],[111,77],[46,65],[12,10],[9,2],[5,-6],[5,-3],[19,-7],[6,-5],[15,-21],[7,-7],[35,-21],[90,-24]],[[7974,8564],[5,-31],[65,-152],[83,-58],[63,-86],[-2,-214],[-21,-77],[-86,-168],[-11,-45],[-11,-89],[-9,-35],[-75,-141],[-71,-187],[-37,-96],[-17,-75],[-21,-96],[-2,-66],[-3,-104],[16,-83],[7,-20],[18,-53],[18,-81],[1,-108],[-21,-67],[-34,-54],[-26,-54],[3,-47]],[[7806,6277],[0,-20],[17,-85],[25,-84],[67,-179],[13,-39],[-17,-7],[-13,-12],[-11,-18],[-8,-47],[-6,-21],[-21,-26],[-11,-21],[-15,-43],[-12,-39],[-6,-60],[1,-24],[-3,-27],[-6,-27],[-29,-80],[-28,-15],[-7,-41],[-7,-5],[-15,3],[-25,29],[-45,36],[-297,68],[-10,-9],[-12,0],[-7,3],[-36,65]],[[7282,5552],[5,47],[-2,19],[-18,61],[-7,44],[-1,19],[4,15],[2,13],[11,145],[-4,36],[-9,45],[-30,93],[-18,39],[-18,21],[-16,-3],[-16,-8],[-25,-19],[-42,-7],[-14,6],[-41,37],[-1,9],[5,13],[77,83],[12,71],[11,240],[-233,71],[-33,30],[-117,164],[-13,1],[-35,-30]],[[6716,6807],[-59,92],[-15,43],[0,13],[2,31],[6,48],[-69,33],[-209,-32],[-121,33]],[[6251,7068],[30,117],[41,49],[91,-19],[29,4],[131,94],[21,29],[10,24],[-2,41],[13,31],[16,35],[29,38],[13,25],[7,20],[-6,40],[-13,107],[-53,147],[-9,22]],[[6599,7872],[22,3],[18,37],[31,86],[22,40],[24,86],[9,19],[10,5],[8,-5],[8,0],[8,3],[10,10],[11,7],[12,5],[16,2],[8,8],[4,13],[1,17],[-3,51],[0,18],[-62,68],[-4,16],[-3,26],[8,22],[13,8],[12,4],[9,5],[19,31],[8,3],[17,-10],[14,-1],[38,10],[7,-2],[6,-10],[5,-12],[5,-9],[6,-3],[20,5],[8,0],[28,-11],[28,0],[37,9],[17,16],[10,19],[20,56],[33,-61],[73,-53],[86,-30],[39,-9],[9,11],[20,17],[13,2],[19,-7],[15,8],[12,13],[8,20],[5,15],[9,39],[-12,76],[-7,3],[-9,1],[-12,-8],[-14,-4],[-24,5],[-8,8],[0,14],[4,6],[4,2],[5,-4],[3,0],[6,5],[7,14],[8,10],[14,7],[13,5],[18,1],[7,4],[11,16],[10,8],[11,5],[31,1],[21,-50],[0,-21],[-1,-18],[-7,-28],[5,-24],[49,-98],[20,-25],[14,-8],[15,46],[113,132],[23,-23],[-10,-47],[2,-6],[2,-8],[22,-18],[8,-1],[11,3],[20,12],[176,88],[0,1]],[[7483,7232],[30,-33],[19,-12],[15,-15],[20,-7],[14,-1],[63,37],[43,35],[32,36],[31,53],[43,126],[38,287]],[[7827,7941],[60,36],[28,7],[32,-24]],[[8037,8097],[4,37],[5,12],[51,79]],[[7112,1779],[-2,-4],[-161,-172],[-41,-98],[-8,-65],[5,-114],[-8,-62],[-17,-47],[-21,-19],[-49,-25],[-57,-69],[-9,-58],[39,-176],[-73,-106],[-4,-13],[-2,-13],[2,-13],[4,-12],[24,-39],[18,-92],[21,-47],[21,-20],[48,-15],[21,-21],[26,-84],[-9,-86],[-55,-171],[-71,-138],[-67,20],[-72,51],[-68,-33],[-20,-9],[8,77],[14,60],[9,63],[-4,87],[-12,66],[-19,67],[-39,108],[-21,81],[-15,32],[-15,19],[-127,108],[-34,19],[-38,4],[4,13],[9,25],[38,142],[64,122],[33,118],[-57,118],[-33,19],[-68,-3],[-36,8],[-17,18],[-16,48],[-7,4],[-11,6],[-14,-10],[-34,-48],[-16,-14],[-39,3],[-103,95],[-43,24],[-22,17],[-140,327],[-63,103],[-61,49],[-58,36],[-41,54],[-24,81],[-9,123],[8,130],[36,261],[8,146],[-2,152],[-9,114],[-30,70],[-64,17],[-29,-10]],[[5589,3590],[73,96],[6,27],[8,33],[17,80],[6,12],[7,11],[17,7],[25,3],[195,-70],[92,63]],[[6035,3852],[74,-54],[171,-24],[130,36],[113,70],[21,25],[5,17],[-1,16],[-5,16],[-3,22],[4,26],[16,35],[15,14],[18,10],[21,8],[18,28],[13,1],[6,-9],[3,-26],[6,-25],[11,-29],[75,-11],[11,-8],[16,-14],[25,-17],[29,-44],[5,-12],[2,-15],[-4,-20],[-17,-49],[-8,-30],[-6,-36],[-3,-32],[-5,-60],[-3,-27],[-4,-20],[-2,-15],[14,-98],[6,-27],[7,-23],[23,-63],[24,-55],[16,-11],[5,5],[10,6],[33,7],[25,-75],[1,-30],[-1,-41],[-4,-55],[3,-43],[9,-35],[11,-34],[1,-21],[-5,-22],[-7,-49],[-9,-41],[2,-153],[-8,-35],[-34,-100],[-4,-34],[2,-34],[4,-31],[-4,-25],[-9,-33],[-18,-34],[-1,-21],[3,-25],[18,-71],[23,-72],[2,-19],[0,-25],[-6,-65],[4,-26],[7,-27],[18,-45],[14,-21],[37,-40],[46,-90],[20,-29],[50,-60],[1,0],[1,0]],[[7282,5552],[-61,-86],[-38,-82],[-12,-12],[-18,-12],[-42,-1],[-32,-11],[-75,-81],[-22,-9],[-19,10],[-10,22],[-16,18],[-21,12],[-37,5],[-22,-7],[-14,-11],[-6,-12],[-1,-19],[0,-39],[-3,-17],[-6,-16],[-6,-20],[-7,-25],[-11,-36],[-16,-33],[-31,-47],[-51,-37],[-122,-59],[-21,-1],[-9,10],[-5,33],[-4,14],[-10,3],[-24,13],[-46,3]],[[6464,5022],[-1,97],[-2,25],[4,32],[57,67],[10,17],[7,8],[6,2],[7,0],[10,3],[48,30],[15,21],[9,27],[1,50],[-1,30],[-6,32],[-4,14],[-30,84]],[[6594,5561],[47,38],[11,60],[9,68],[-4,31],[-9,23],[-35,38],[-11,17],[-9,28],[-1,14],[6,18],[0,8],[-62,139],[-31,45],[10,56],[25,29],[55,41],[20,34],[17,41],[22,70],[2,37],[-5,66],[10,26],[6,21],[6,56],[0,29],[43,213]],[[6035,3852],[6,68],[-4,41],[-12,62],[-6,16],[-9,10],[-9,7],[-8,9],[-7,16],[-4,20],[-3,29],[2,28],[15,79],[17,58],[3,26],[1,20],[-1,13],[-1,16],[8,22],[15,20],[36,26],[23,7],[21,19],[52,106],[22,36],[39,21],[33,-18],[9,-2],[33,12],[8,8],[7,17],[-2,46],[1,7],[2,11],[18,48],[20,40],[4,42],[-2,60],[6,12],[17,7],[15,9],[15,25],[25,22],[24,49]],[[7806,6277],[50,-23],[74,-20],[61,-15],[46,22],[41,-17],[116,23],[37,-9],[419,-206],[-4,-57],[10,-13],[14,2],[8,-16],[0,-30],[-9,-48],[-6,-118],[-7,-55],[4,-47],[28,-62],[55,-66],[237,-120],[86,-127],[50,-45],[96,-48],[30,-2],[15,-1],[58,26],[96,77],[23,51],[6,39],[2,42],[10,64],[34,89],[36,10],[43,-17],[55,4],[1,94],[39,116],[56,100],[64,57],[12,4],[13,-4],[11,-12],[1,0],[23,-39],[46,-116],[75,-93],[20,-37],[12,-85],[-28,-172],[6,-107],[-12,-163],[-8,-45],[-13,-32],[-48,-92],[4,-75],[15,-73],[6,-70],[-27,-63],[-37,-38],[-9,-46],[2,-58],[-5,-71],[-21,-60],[-24,-36],[-11,-48],[19,-97],[40,-73],[94,-15],[46,-62],[17,-97],[-2,-130],[-17,-125],[-14,-36],[-17,-45],[-40,-12],[-159,66],[-77,-12],[-29,7],[-25,19],[-14,23],[-11,25],[-18,24],[-91,50],[-10,55],[12,103],[-4,57],[-35,46],[-57,-1],[-210,-95],[-21,-18],[-10,-38],[-27,-164],[-19,-39],[-48,-75],[-19,-45],[-3,-36],[0,-111],[-10,-54],[3,-47],[5,-36],[11,-28],[19,-21],[-39,-105],[35,-68],[65,-40],[99,-30],[39,-25],[16,-56],[-17,-110],[-16,-34],[-46,-65],[-17,-49],[-11,-69],[-2,-46],[9,-43],[20,-56],[92,-147],[28,-90],[-29,-96],[-62,-62],[-93,-56],[-74,2],[-1,114],[-23,86],[-87,123],[-33,69],[-14,111],[-1,100],[-15,82],[-55,57],[-46,19],[-43,5],[-97,-26],[-147,-120],[-46,-23],[-29,9],[-54,52],[-23,1],[-24,-43],[-5,-58],[4,-57],[-1,-40],[-34,-74],[-42,-27],[-254,5],[-51,30],[-47,50],[-29,62],[-44,182],[-19,25],[-49,43],[-17,25],[-4,28],[3,77],[-13,484],[-7,32],[-17,-6],[-36,-41],[-15,-33],[-8,-36],[-11,-30],[-24,-15],[-17,12],[-56,84],[-2,63],[-44,18],[-108,-21],[-42,-62],[-39,-121],[-17,-124],[21,-68],[30,-32],[4,-51],[-5,-63],[0,-73],[30,-179],[3,-65],[-14,-111],[-65,-214],[-33,-181],[-20,-51],[-26,-38],[-26,-19],[-24,-29],[-13,-50],[-10,-58],[-16,-48]],[[5755,8968],[20,-38],[30,15],[5,13]],[[5810,8958],[0,-17],[-28,-117],[-17,-39],[-8,-1],[-8,4],[-6,13],[-6,14],[-7,13],[-15,22],[-9,9],[2,38],[47,71]],[[6421,9343],[-68,56],[-26,-18],[-19,15],[-2,0],[-26,-96]],[[6280,9300],[-5,-8],[-10,-19],[-9,-9],[-10,-5],[-9,1],[-6,-3],[-6,-7],[-10,-15],[-10,-11],[-13,-8],[-91,6],[-19,10],[-16,15],[-14,33],[-9,28],[-4,80],[8,78],[-96,4],[-19,-29],[-15,-45],[-38,-55],[-31,-63],[0,-1]],[[5848,9277],[-25,16],[-31,8],[-108,-28],[-33,-26],[-31,-34],[-32,-26],[-40,-2],[-46,40],[-56,67],[-11,2],[-35,20],[14,55],[-6,43],[-9,36],[3,38],[21,38],[56,47],[24,34],[17,101],[10,37],[30,68],[17,16],[25,-1],[120,36],[33,26],[-21,80],[36,31],[55,-5],[41,-28],[3,-37],[2,-65],[8,-61],[22,-25],[27,27],[12,110],[20,33],[29,-15],[21,-50],[17,-58],[17,-40],[23,-8],[24,8],[22,-7],[15,-51],[-6,-19],[-30,-68],[-7,-33],[9,-41],[18,-34],[5,-38],[5,-33],[117,2],[-18,32],[20,99],[59,-5],[72,-64],[58,-84],[-41,-14],[0,-36],[32,-48]],[[6594,5561],[-100,-89],[-10,-5],[-55,-40],[-14,-23],[-10,-4],[-8,9],[-6,30],[-2,56],[-5,15],[-14,2],[-13,22],[-7,18],[-1,23],[2,22],[-7,20],[-15,9],[-63,-2],[-20,5],[-15,19],[-12,9],[-15,-6],[-26,-20],[-17,-10],[-21,-18],[-23,-29],[-15,-9],[-13,7],[-16,38],[-11,55],[-6,15],[-11,7],[-51,-5],[-16,4],[-47,27],[-19,7],[-13,9],[-16,21],[-9,45],[-9,71],[-3,18],[-11,10],[-9,6],[-65,-6]],[[5513,6526],[23,27],[22,17],[16,-9],[23,-4],[39,-135],[114,15],[12,-4],[9,-10],[18,-28],[20,-1],[26,9],[51,29],[30,9],[29,19],[25,28],[62,117],[17,74],[39,66],[-41,44]],[[6047,6789],[-3,27],[-13,28],[-2,10],[-1,14],[2,13],[3,16],[14,24],[22,30],[86,86],[96,31]],[[6421,9343],[1,-2],[65,-74],[54,-22],[87,13],[80,39],[36,59],[41,26],[248,-43],[122,0],[30,-72],[83,0],[86,-31],[608,-583],[12,-89]],[[6599,7872],[-89,145],[17,35],[5,17],[4,22],[3,36],[13,23],[0,8],[-17,15],[-22,33],[-11,104],[-22,21],[-5,15],[-5,29],[1,16],[2,9],[3,6],[10,11],[5,8],[4,14],[0,9],[0,7],[-1,6],[-1,10],[1,12],[12,106],[1,15],[-5,17],[-16,19],[-66,41],[-22,20],[-13,24],[-9,45],[11,34],[4,9],[-12,27],[-13,20],[-141,107],[-26,14],[-20,38],[-8,18],[-1,11],[5,11],[14,17],[15,8],[16,-3],[32,-26],[12,-19],[10,-12],[9,-3],[8,0],[13,40],[20,33],[17,50],[9,22],[4,25],[-4,21],[-25,45],[-9,67],[-36,-24]],[[5440,4215],[-7,66],[-10,41],[0,60],[10,20],[14,3],[37,-15],[18,-2],[16,6],[8,19],[3,23],[2,30],[0,22],[-1,21],[-4,20],[-1,28],[-4,20],[-12,41],[-7,30],[-2,47],[3,24],[18,70]],[[5521,4789],[72,34],[5,25],[2,25],[-4,25],[-1,17],[-2,12],[-7,7],[-5,8],[-6,20],[10,30],[5,37],[13,64],[12,36],[17,28],[6,16],[3,12],[-2,9],[-3,10],[-6,9],[-19,7],[-8,9],[-23,-3]],[[6047,6789],[-49,-10],[-66,44],[-16,20],[-9,21],[-6,19],[-25,48],[-38,51],[-40,69],[-87,23],[-63,-19],[-42,-23],[-23,0],[-26,6],[-88,45],[-15,15],[-6,21],[-2,21],[-11,54]],[[5466,8888],[61,16],[3,24],[26,86],[68,69],[66,11],[34,-49],[27,-69],[4,-8]],[[5810,8958],[9,26],[3,38],[-1,36],[2,34],[0,18],[-6,19],[-3,23],[5,28],[8,11],[11,7],[10,0],[2,-8],[1,-31],[15,-11],[12,120],[-20,3],[-10,6]],[[1827,4555],[-14,-20],[-11,8],[-6,33],[-11,17],[-9,25],[6,25],[14,0],[15,29],[18,30],[15,0],[13,-21],[2,-38],[-4,-37],[-17,-34],[-11,-17]],[[2062,4664],[-17,-50],[-16,-25],[-17,-13],[-20,13],[-18,12],[-26,21],[-16,-8],[-26,-38],[-18,-4],[-15,0],[-5,21],[7,13],[13,16],[16,13],[24,16],[9,34],[20,42],[13,16],[15,34],[9,21],[11,12],[13,-21],[7,-25],[15,-8],[18,-17],[11,-37],[-7,-38]],[[2040,5485],[93,-144],[8,-16],[7,-18],[-4,1],[-5,10],[-5,5],[-4,1],[-15,-10],[-7,-8],[-7,-9],[-4,-15],[3,-3],[8,2],[10,-3],[13,-10],[23,-29],[7,-15],[-1,-16],[-13,-34],[-10,-33],[-4,-17],[-3,-16],[-2,-17],[-8,-104],[3,-14],[4,-5],[17,12],[14,-3],[3,-8],[0,-11],[-9,-24],[-16,-59],[-7,-11],[-5,-6],[-17,-8],[-12,-3],[-31,1],[-10,3],[-10,9],[-11,12],[-10,8],[-15,-7],[-10,-1],[-15,-9],[-13,-14],[-18,-4],[-7,0],[-10,5],[-24,17],[-9,4],[-9,1],[-7,3],[-27,21],[-3,5],[2,11],[5,12],[5,12],[1,10],[-4,10],[-3,3],[-10,-2],[-5,2],[-6,6],[-24,39],[-8,37],[-11,132]],[[2835,5623],[-7,-5],[-4,1],[-7,-2],[-7,26],[32,14],[1,-18],[-3,-7],[-5,-9]],[[2854,3713],[-66,-83],[-128,-61],[-22,-30],[-16,-35],[-35,-64],[-23,-31],[-19,-19],[-66,-13],[-16,-10],[-14,-14],[-39,-51],[-21,-39],[-7,-16],[-4,-14],[-9,-44],[-52,-40],[-2,8],[-7,6],[-5,19],[-8,19],[-6,23],[-5,26],[-1,20],[-8,52],[-15,59],[-123,144],[-30,18],[-24,2],[-32,-56],[-16,-18],[-19,-15],[-33,-8],[-16,6],[-10,8],[-25,55],[-16,69],[19,60],[6,2],[29,2],[18,-3],[5,-3],[28,-27],[7,8],[6,15],[55,99],[12,27],[4,13],[-4,4],[-8,-1],[-17,-8],[-10,4],[-15,17],[-25,40],[-12,10],[-8,4],[-25,-10],[-33,-5],[-17,20],[-13,0],[-10,-4],[-19,-13],[-3,7],[0,17],[3,22],[-1,19],[-1,14],[0,11],[2,5],[5,6],[1,10],[-2,27],[-3,28],[-4,56],[1,59],[1,23],[5,53],[27,4],[36,39],[25,9],[34,2],[13,4],[5,7],[-1,6],[-3,8],[1,8],[12,50],[77,177],[64,138],[9,42],[-3,4],[-28,11],[-8,6],[-8,9],[-6,18],[3,9],[29,14],[9,10],[8,16],[60,135],[-4,70],[13,51],[8,20],[10,13],[14,14],[22,43],[7,21],[1,16],[-2,6],[-3,0],[-10,-6],[-7,8],[-8,19],[-6,46],[1,23],[4,22],[6,21],[-2,21],[-5,17],[-5,10],[-4,4],[-7,-1],[-8,-3],[-6,-6],[-4,-6],[0,-11],[-1,-8],[-2,-10],[-3,-4],[-5,1],[-6,8],[-36,78],[-13,20],[-7,10],[-69,151]],[[2196,5687],[139,-302],[11,-34],[25,-21],[32,-72],[3,-37],[2,-12],[39,31],[19,36],[6,15],[6,22],[4,25],[6,46],[7,23],[8,17],[8,2],[6,-3],[6,-12],[4,-4],[5,3],[17,30],[4,13],[-1,11],[-14,9],[-7,7],[-6,8],[-46,149],[-9,37],[-15,170]],[[2455,5844],[178,28],[110,69],[52,34],[20,-9],[7,-12],[1,-6],[1,-4],[2,-30],[14,-33],[-4,-18],[-23,-45],[-12,-15],[-29,-22],[-4,-8],[0,-14],[13,-33],[5,-20],[2,-22],[2,-32],[5,-53],[-2,-26],[-6,-29],[-16,-51],[2,-13],[7,-6],[11,0],[23,7],[113,-51],[178,-25],[10,-114],[-10,-41],[-21,-27],[-13,-11],[-14,0],[-7,8],[-4,6],[1,14],[-4,4],[-13,4],[-16,-22],[-2,-15],[7,-23],[5,-52],[-1,-74],[-25,-167],[-6,-80],[-1,-132],[5,-74],[8,-39],[5,-16],[8,-10],[38,-24],[11,-10],[19,-24],[9,-26],[7,-9],[8,-5],[10,2],[7,-2],[6,-9],[5,-11],[6,-7],[8,-6],[10,-11],[3,-9],[-5,-34],[-9,-125],[4,-19],[-8,-17],[-19,-33],[-17,2],[-19,12],[-32,11],[-10,-12],[-24,-44],[8,-148],[-4,-70],[-6,-44],[-10,-22],[-9,-6],[-22,-1],[-38,-6],[-90,-124]],[[2854,3713],[9,-44],[6,-14],[6,-15],[4,-15],[1,-22],[-1,-36],[0,-32],[-3,-41],[-7,-41],[-16,-50],[-12,-24],[-6,-20],[-1,-19],[5,-68],[-2,-31],[-8,-34],[-20,-43],[-36,-34],[-6,-17],[6,-44],[8,-31],[4,-40],[0,-27],[-25,-124],[22,-27],[32,-51],[13,-11],[6,-14],[1,-18],[-11,-28],[-4,-17],[2,-102]],[[1847,2950],[-3,46],[-20,50],[-34,26],[-330,135],[-148,7],[-142,-44],[-189,-204],[-71,-29],[-73,-5],[-69,-35],[-71,-98],[-64,-132],[-46,-100],[-12,-69],[5,-30]],[[363,2580],[39,139],[-3,56],[-27,77],[-32,55],[-109,105],[-11,11],[26,38],[4,33],[-5,35],[0,38],[-1,16],[-6,20],[-4,24],[0,26],[8,31],[26,43],[77,208],[78,155],[-17,30],[-37,64],[-6,67],[29,61],[298,428],[159,137],[22,29],[58,103],[74,61],[23,27],[25,49],[9,42],[-1,85],[-17,29],[-11,25],[-6,28],[3,25],[35,164],[15,43],[4,17]],[[2363,5902],[92,-58]],[[3063,8134],[92,-6],[22,14]],[[3177,8142],[-9,-102]],[[3168,8040],[124,7],[33,35],[1,18],[-1,15],[-21,55],[-5,10],[-5,2],[-15,0],[-5,2],[-6,5],[-6,9],[-2,5],[-11,26],[-1,1]],[[3248,8230],[13,25],[7,47],[-4,29],[-11,23],[-7,13],[-11,31],[0,31],[25,12],[35,-19],[10,-10]],[[3305,8412],[2,-112],[8,-40],[3,-11],[5,-13],[36,-1],[141,46],[-2,134],[-4,15],[-5,18],[-18,6],[-43,25],[-35,-7]],[[3393,8472],[-2,11],[-16,34],[-5,21],[3,16],[13,10],[23,-7],[18,9],[10,29],[-1,50],[-8,0],[-37,43],[-5,4],[85,107]],[[3471,8799],[12,-12],[67,-72],[21,-9],[22,-3],[6,-19],[22,-29],[39,40],[12,6],[11,-8],[13,-23],[17,-21],[23,-21],[14,26],[0,84]],[[3750,8738],[32,-26],[49,-10],[97,31]],[[4433,8265],[-12,-54],[-11,-33],[1,-11],[3,-19],[7,-19],[8,-19],[1,-24],[-13,-26],[-42,-47],[-47,-20],[-28,-4],[-18,2],[-11,-5],[-12,-54],[-8,-23],[-5,-13],[-55,-38],[-16,-20],[-46,-20],[-28,-28],[-35,-92],[-7,-35],[-48,21],[-13,10],[-15,16],[-16,30],[-22,25],[-47,38],[-55,21],[-78,-12],[-11,8],[-8,13],[-12,64],[-4,30],[-2,37],[2,42],[21,9],[52,24],[10,8],[19,35],[7,43],[1,64],[2,15],[4,13],[6,9],[9,9],[9,11],[7,16],[10,30],[10,22],[-7,18],[-7,13],[-94,91],[-18,2],[-1,-21],[-5,-13],[-9,-9],[-60,9],[-18,-6],[-14,-57],[34,-26],[6,-17],[1,-12],[-25,-112],[-28,-43],[-50,-7],[-12,-7],[-2,-29],[3,-20],[5,-16],[-3,-11],[-11,-5],[-64,-8],[-9,-6],[-8,-11],[-7,-26],[-7,-22],[-10,-22],[-17,-16],[-20,-9],[-37,9],[-37,33],[-16,5],[-31,-11],[-34,-83]],[[3549,7560],[-17,-77],[-13,-24],[-20,-23],[-73,-36],[-15,-15],[-19,-23],[-25,-43],[-21,-27],[-50,-31],[-46,-62],[5,-36],[-166,-116],[-5,-24],[11,-41],[8,-18],[6,-29],[7,-14],[11,-10],[24,-14],[11,-12],[5,-16],[15,-58],[2,-15],[-2,-11],[-1,-11],[5,-6],[14,-5],[23,6],[18,16],[17,34],[20,28],[12,21],[18,8],[17,22],[12,9],[34,11],[5,-65],[3,-24],[8,-13],[10,-13],[7,-18],[-7,-27],[-24,-26],[-16,-5],[-13,5],[-11,10],[-7,0],[-25,-32],[-13,-32],[-5,-24],[5,-48],[-2,-24],[-17,-16],[-39,-16],[-10,-2],[-23,9],[-14,-1],[-25,7],[-7,-3],[-4,-22],[3,-16],[6,-20],[7,-19],[14,-43],[13,-17],[7,-6],[64,29],[18,5],[5,-2],[2,-46],[19,-68],[41,21],[14,14],[8,17],[2,29],[-3,24],[-12,45],[0,21],[7,15],[60,43],[32,44],[58,132],[31,47],[24,6],[60,-64],[102,-5],[13,3],[24,37],[13,33],[21,17],[7,11],[6,16],[3,16],[-3,29],[-12,41],[-31,88],[-36,81],[-40,29],[-42,77],[-1,39],[-7,36],[-3,19],[-32,59],[148,29],[80,56],[75,-140],[26,-26],[61,-4],[43,25],[21,-12],[77,29]],[[4629,4885],[71,-6],[42,-14],[75,-77],[23,-25],[26,-18],[17,-8],[12,4],[52,32],[26,8],[116,-23],[42,-21],[22,-1],[24,15],[75,81],[96,59]],[[5400,4819],[21,-28],[15,13],[30,9],[11,0],[44,-24]],[[3545,7691],[17,-7],[6,-10],[6,-15],[4,-20],[1,-23],[-2,-26],[-3,-15],[-19,-2]],[[3471,8799],[12,15],[53,46],[78,45],[1,1],[113,52],[50,8],[-29,-126],[-23,-35],[-53,0],[-5,0],[82,-67]],[[3177,8142],[40,25],[31,63]],[[3305,8412],[19,-18],[28,-7],[34,47],[4,9],[3,14],[0,13],[0,2]]],"transform":{"scale":[0.00045122688538852735,0.00019806456555656923],"translate":[5.954809204000128,45.820718486]}};
  Datamap.prototype.chlTopo = '__CHL__';
  Datamap.prototype.chnTopo = '__CHN__';
  Datamap.prototype.civTopo = '__CIV__';
  Datamap.prototype.clpTopo = '__CLP__';
  Datamap.prototype.cmrTopo = '__CMR__';
  Datamap.prototype.codTopo = '__COD__';
  Datamap.prototype.cogTopo = '__COG__';
  Datamap.prototype.cokTopo = '__COK__';
  Datamap.prototype.colTopo = '__COL__';
  Datamap.prototype.comTopo = '__COM__';
  Datamap.prototype.cpvTopo = '__CPV__';
  Datamap.prototype.criTopo = '__CRI__';
  Datamap.prototype.csiTopo = '__CSI__';
  Datamap.prototype.cubTopo = '__CUB__';
  Datamap.prototype.cuwTopo = '__CUW__';
  Datamap.prototype.cymTopo = '__CYM__';
  Datamap.prototype.cynTopo = '__CYN__';
  Datamap.prototype.cypTopo = '__CYP__';
  Datamap.prototype.czeTopo = '__CZE__';
  Datamap.prototype.deuTopo = '__DEU__';
  Datamap.prototype.djiTopo = '__DJI__';
  Datamap.prototype.dmaTopo = '__DMA__';
  Datamap.prototype.dnkTopo = '__DNK__';
  Datamap.prototype.domTopo = '__DOM__';
  Datamap.prototype.dzaTopo = '__DZA__';
  Datamap.prototype.ecuTopo = '__ECU__';
  Datamap.prototype.egyTopo = '__EGY__';
  Datamap.prototype.eriTopo = '__ERI__';
  Datamap.prototype.esbTopo = '__ESB__';
  Datamap.prototype.espTopo = '__ESP__';
  Datamap.prototype.estTopo = '__EST__';
  Datamap.prototype.ethTopo = '__ETH__';
  Datamap.prototype.finTopo = '__FIN__';
  Datamap.prototype.fjiTopo = '__FJI__';
  Datamap.prototype.flkTopo = '__FLK__';
  Datamap.prototype.fraTopo = '__FRA__';
  Datamap.prototype.froTopo = '__FRO__';
  Datamap.prototype.fsmTopo = '__FSM__';
  Datamap.prototype.gabTopo = '__GAB__';
  Datamap.prototype.psxTopo = '__PSX__';
  Datamap.prototype.gbrTopo = '__GBR__';
  Datamap.prototype.geoTopo = '__GEO__';
  Datamap.prototype.ggyTopo = '__GGY__';
  Datamap.prototype.ghaTopo = '__GHA__';
  Datamap.prototype.gibTopo = '__GIB__';
  Datamap.prototype.ginTopo = '__GIN__';
  Datamap.prototype.gmbTopo = '__GMB__';
  Datamap.prototype.gnbTopo = '__GNB__';
  Datamap.prototype.gnqTopo = '__GNQ__';
  Datamap.prototype.grcTopo = '__GRC__';
  Datamap.prototype.grdTopo = '__GRD__';
  Datamap.prototype.grlTopo = '__GRL__';
  Datamap.prototype.gtmTopo = '__GTM__';
  Datamap.prototype.gumTopo = '__GUM__';
  Datamap.prototype.guyTopo = '__GUY__';
  Datamap.prototype.hkgTopo = '__HKG__';
  Datamap.prototype.hmdTopo = '__HMD__';
  Datamap.prototype.hndTopo = '__HND__';
  Datamap.prototype.hrvTopo = '__HRV__';
  Datamap.prototype.htiTopo = '__HTI__';
  Datamap.prototype.hunTopo = '__HUN__';
  Datamap.prototype.idnTopo = '__IDN__';
  Datamap.prototype.imnTopo = '__IMN__';
  Datamap.prototype.indTopo = '__IND__';
  Datamap.prototype.ioaTopo = '__IOA__';
  Datamap.prototype.iotTopo = '__IOT__';
  Datamap.prototype.irlTopo = '__IRL__';
  Datamap.prototype.irnTopo = '__IRN__';
  Datamap.prototype.irqTopo = '__IRQ__';
  Datamap.prototype.islTopo = '__ISL__';
  Datamap.prototype.isrTopo = '__ISR__';
  Datamap.prototype.itaTopo = '__ITA__';
  Datamap.prototype.jamTopo = '__JAM__';
  Datamap.prototype.jeyTopo = '__JEY__';
  Datamap.prototype.jorTopo = '__JOR__';
  Datamap.prototype.jpnTopo = '__JPN__';
  Datamap.prototype.kabTopo = '__KAB__';
  Datamap.prototype.kasTopo = '__KAS__';
  Datamap.prototype.kazTopo = '__KAZ__';
  Datamap.prototype.kenTopo = '__KEN__';
  Datamap.prototype.kgzTopo = '__KGZ__';
  Datamap.prototype.khmTopo = '__KHM__';
  Datamap.prototype.kirTopo = '__KIR__';
  Datamap.prototype.knaTopo = '__KNA__';
  Datamap.prototype.korTopo = '__KOR__';
  Datamap.prototype.kosTopo = '__KOS__';
  Datamap.prototype.kwtTopo = '__KWT__';
  Datamap.prototype.laoTopo = '__LAO__';
  Datamap.prototype.lbnTopo = '__LBN__';
  Datamap.prototype.lbrTopo = '__LBR__';
  Datamap.prototype.lbyTopo = '__LBY__';
  Datamap.prototype.lcaTopo = '__LCA__';
  Datamap.prototype.lieTopo = '__LIE__';
  Datamap.prototype.lkaTopo = '__LKA__';
  Datamap.prototype.lsoTopo = '__LSO__';
  Datamap.prototype.ltuTopo = '__LTU__';
  Datamap.prototype.luxTopo = '__LUX__';
  Datamap.prototype.lvaTopo = '__LVA__';
  Datamap.prototype.macTopo = '__MAC__';
  Datamap.prototype.mafTopo = '__MAF__';
  Datamap.prototype.marTopo = '__MAR__';
  Datamap.prototype.mcoTopo = '__MCO__';
  Datamap.prototype.mdaTopo = '__MDA__';
  Datamap.prototype.mdgTopo = '__MDG__';
  Datamap.prototype.mdvTopo = '__MDV__';
  Datamap.prototype.mexTopo = '__MEX__';
  Datamap.prototype.mhlTopo = '__MHL__';
  Datamap.prototype.mkdTopo = '__MKD__';
  Datamap.prototype.mliTopo = '__MLI__';
  Datamap.prototype.mltTopo = '__MLT__';
  Datamap.prototype.mmrTopo = '__MMR__';
  Datamap.prototype.mneTopo = '__MNE__';
  Datamap.prototype.mngTopo = '__MNG__';
  Datamap.prototype.mnpTopo = '__MNP__';
  Datamap.prototype.mozTopo = '__MOZ__';
  Datamap.prototype.mrtTopo = '__MRT__';
  Datamap.prototype.msrTopo = '__MSR__';
  Datamap.prototype.musTopo = '__MUS__';
  Datamap.prototype.mwiTopo = '__MWI__';
  Datamap.prototype.mysTopo = '__MYS__';
  Datamap.prototype.namTopo = '__NAM__';
  Datamap.prototype.nclTopo = '__NCL__';
  Datamap.prototype.nerTopo = '__NER__';
  Datamap.prototype.nfkTopo = '__NFK__';
  Datamap.prototype.ngaTopo = '__NGA__';
  Datamap.prototype.nicTopo = '__NIC__';
  Datamap.prototype.niuTopo = '__NIU__';
  Datamap.prototype.nldTopo = '__NLD__';
  Datamap.prototype.nplTopo = '__NPL__';
  Datamap.prototype.nruTopo = '__NRU__';
  Datamap.prototype.nulTopo = '__NUL__';
  Datamap.prototype.nzlTopo = '__NZL__';
  Datamap.prototype.omnTopo = '__OMN__';
  Datamap.prototype.pakTopo = '__PAK__';
  Datamap.prototype.panTopo = '__PAN__';
  Datamap.prototype.pcnTopo = '__PCN__';
  Datamap.prototype.perTopo = '__PER__';
  Datamap.prototype.pgaTopo = '__PGA__';
  Datamap.prototype.phlTopo = '__PHL__';
  Datamap.prototype.plwTopo = '__PLW__';
  Datamap.prototype.pngTopo = '__PNG__';
  Datamap.prototype.polTopo = '__POL__';
  Datamap.prototype.priTopo = '__PRI__';
  Datamap.prototype.prkTopo = '__PRK__';
  Datamap.prototype.prtTopo = '__PRT__';
  Datamap.prototype.pryTopo = '__PRY__';
  Datamap.prototype.pyfTopo = '__PYF__';
  Datamap.prototype.qatTopo = '__QAT__';
  Datamap.prototype.rouTopo = '__ROU__';
  Datamap.prototype.rusTopo = '__RUS__';
  Datamap.prototype.rwaTopo = '__RWA__';
  Datamap.prototype.sahTopo = '__SAH__';
  Datamap.prototype.sauTopo = '__SAU__';
  Datamap.prototype.scrTopo = '__SCR__';
  Datamap.prototype.sdnTopo = '__SDN__';
  Datamap.prototype.sdsTopo = '__SDS__';
  Datamap.prototype.senTopo = '__SEN__';
  Datamap.prototype.serTopo = '__SER__';
  Datamap.prototype.sgpTopo = '__SGP__';
  Datamap.prototype.sgsTopo = '__SGS__';
  Datamap.prototype.shnTopo = '__SHN__';
  Datamap.prototype.slbTopo = '__SLB__';
  Datamap.prototype.sleTopo = '__SLE__';
  Datamap.prototype.slvTopo = '__SLV__';
  Datamap.prototype.smrTopo = '__SMR__';
  Datamap.prototype.solTopo = '__SOL__';
  Datamap.prototype.somTopo = '__SOM__';
  Datamap.prototype.spmTopo = '__SPM__';
  Datamap.prototype.srbTopo = '__SRB__';
  Datamap.prototype.stpTopo = '__STP__';
  Datamap.prototype.surTopo = '__SUR__';
  Datamap.prototype.svkTopo = '__SVK__';
  Datamap.prototype.svnTopo = '__SVN__';
  Datamap.prototype.sweTopo = '__SWE__';
  Datamap.prototype.swzTopo = '__SWZ__';
  Datamap.prototype.sxmTopo = '__SXM__';
  Datamap.prototype.sycTopo = '__SYC__';
  Datamap.prototype.syrTopo = '__SYR__';
  Datamap.prototype.tcaTopo = '__TCA__';
  Datamap.prototype.tcdTopo = '__TCD__';
  Datamap.prototype.tgoTopo = '__TGO__';
  Datamap.prototype.thaTopo = '__THA__';
  Datamap.prototype.tjkTopo = '__TJK__';
  Datamap.prototype.tkmTopo = '__TKM__';
  Datamap.prototype.tlsTopo = '__TLS__';
  Datamap.prototype.tonTopo = '__TON__';
  Datamap.prototype.ttoTopo = '__TTO__';
  Datamap.prototype.tunTopo = '__TUN__';
  Datamap.prototype.turTopo = '__TUR__';
  Datamap.prototype.tuvTopo = '__TUV__';
  Datamap.prototype.twnTopo = '__TWN__';
  Datamap.prototype.tzaTopo = '__TZA__';
  Datamap.prototype.ugaTopo = '__UGA__';
  Datamap.prototype.ukrTopo = '__UKR__';
  Datamap.prototype.umiTopo = '__UMI__';
  Datamap.prototype.uryTopo = '__URY__';
  Datamap.prototype.usaTopo = '__USA__';
  Datamap.prototype.usgTopo = '__USG__';
  Datamap.prototype.uzbTopo = '__UZB__';
  Datamap.prototype.vatTopo = '__VAT__';
  Datamap.prototype.vctTopo = '__VCT__';
  Datamap.prototype.venTopo = '__VEN__';
  Datamap.prototype.vgbTopo = '__VGB__';
  Datamap.prototype.virTopo = '__VIR__';
  Datamap.prototype.vnmTopo = '__VNM__';
  Datamap.prototype.vutTopo = '__VUT__';
  Datamap.prototype.wlfTopo = '__WLF__';
  Datamap.prototype.wsbTopo = '__WSB__';
  Datamap.prototype.wsmTopo = '__WSM__';
  Datamap.prototype.yemTopo = '__YEM__';
  Datamap.prototype.zafTopo = '__ZAF__';
  Datamap.prototype.zmbTopo = '__ZMB__';
  Datamap.prototype.zweTopo = '__ZWE__';

  /**************************************
                Utilities
  ***************************************/

  //convert lat/lng coords to X / Y coords
  Datamap.prototype.latLngToXY = function(lat, lng) {
     return this.projection([lng, lat]);
  };

  //add <g> layer to root SVG
  Datamap.prototype.addLayer = function( className, id, first ) {
    var layer;
    if ( first ) {
      layer = this.svg.insert('g', ':first-child')
    }
    else {
      layer = this.svg.append('g')
    }
    return layer.attr('id', id || '')
      .attr('class', className || '');
  };

  Datamap.prototype.updateChoropleth = function(data) {
    var svg = this.svg;
    for ( var subunit in data ) {
      if ( data.hasOwnProperty(subunit) ) {
        var color;
        var subunitData = data[subunit]
        if ( ! subunit ) {
          continue;
        }
        else if ( typeof subunitData === "string" ) {
          color = subunitData;
        }
        else if ( typeof subunitData.color === "string" ) {
          color = subunitData.color;
        }
        else {
          color = this.options.fills[ subunitData.fillKey ];
        }
        //if it's an object, overriding the previous data
        if ( subunitData === Object(subunitData) ) {
          this.options.data[subunit] = defaults(subunitData, this.options.data[subunit] || {});
          var geo = this.svg.select('.' + subunit).attr('data-info', JSON.stringify(this.options.data[subunit]));
        }
        svg
          .selectAll('.' + subunit)
          .transition()
            .style('fill', color);
      }
    }
  };

  Datamap.prototype.updatePopup = function (element, d, options) {
    var self = this;
    element.on('mousemove', null);
    element.on('mousemove', function() {
      var position = d3.mouse(self.options.element);
      d3.select(self.svg[0][0].parentNode).select('.datamaps-hoverover')
        .style('top', ( (position[1] + 30)) + "px")
        .html(function() {
          var data = JSON.parse(element.attr('data-info'));
          try {
            return options.popupTemplate(d, data);
          } catch (e) {
            return "";
          }
        })
        .style('left', ( position[0]) + "px");
    });

    d3.select(self.svg[0][0].parentNode).select('.datamaps-hoverover').style('display', 'block');
  };

  Datamap.prototype.addPlugin = function( name, pluginFn ) {
    var self = this;
    if ( typeof Datamap.prototype[name] === "undefined" ) {
      Datamap.prototype[name] = function(data, options, callback, createNewLayer) {
        var layer;
        if ( typeof createNewLayer === "undefined" ) {
          createNewLayer = false;
        }

        if ( typeof options === 'function' ) {
          callback = options;
          options = undefined;
        }

        options = defaults(options || {}, self.options[name + 'Config']);

        //add a single layer, reuse the old layer
        if ( !createNewLayer && this.options[name + 'Layer'] ) {
          layer = this.options[name + 'Layer'];
          options = options || this.options[name + 'Options'];
        }
        else {
          layer = this.addLayer(name);
          this.options[name + 'Layer'] = layer;
          this.options[name + 'Options'] = options;
        }
        pluginFn.apply(this, [layer, data, options]);
        if ( callback ) {
          callback(layer);
        }
      };
    }
  };

  // expose library
  if (typeof exports === 'object') {
    d3 = require('d3');
    topojson = require('topojson');
    module.exports = Datamap;
  }
  else if ( typeof define === "function" && define.amd ) {
    define( "datamaps", ["require", "d3", "topojson"], function(require) {
      d3 = require('d3');
      topojson = require('topojson');

      return Datamap;
    });
  }
  else {
    window.Datamap = window.Datamaps = Datamap;
  }

  if ( window.jQuery ) {
    window.jQuery.fn.datamaps = function(options, callback) {
      options = options || {};
      options.element = this[0];
      var datamap = new Datamap(options);
      if ( typeof callback === "function" ) {
        callback(datamap, options);
      }
      return this;
    };
  }
})();
