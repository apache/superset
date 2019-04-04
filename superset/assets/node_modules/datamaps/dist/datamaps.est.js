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
  Datamap.prototype.cheTopo = '__CHE__';
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
  Datamap.prototype.estTopo = {"type":"Topology","objects":{"est":{"type":"GeometryCollection","geometries":[{"type":"Polygon","properties":{"name":null},"id":"-99","arcs":[[0]]},{"type":"MultiPolygon","properties":{"name":"Harju"},"id":"EE.HA","arcs":[[[1]],[[2,3,4,5,6]]]},{"type":"Polygon","properties":{"name":"Ida-Viru"},"id":"EE.IV","arcs":[[7,8,9]]},{"type":"Polygon","properties":{"name":"Järva"},"id":"EE.JR","arcs":[[10,11,12,13,14,-4]]},{"type":"Polygon","properties":{"name":"Jõgeva"},"id":"EE.JN","arcs":[[-8,15,16,17,-12,18]]},{"type":"Polygon","properties":{"name":"Lääne-Viru"},"id":"EE.LV","arcs":[[-9,-19,-11,-3,19]]},{"type":"Polygon","properties":{"name":"Tartu"},"id":"EE.TA","arcs":[[20,21,22,-17,23]]},{"type":"Polygon","properties":{"name":"Hiiu"},"id":"EE.HI","arcs":[[24]]},{"type":"MultiPolygon","properties":{"name":"Lääne"},"id":"EE.LN","arcs":[[[25]],[[26,27,28,-6]]]},{"type":"MultiPolygon","properties":{"name":"Pärnu"},"id":"EE.PR","arcs":[[[29]],[[-14,30,31,-28,32]]]},{"type":"Polygon","properties":{"name":"Põlva"},"id":"EE.PL","arcs":[[33,34,35,-21]]},{"type":"Polygon","properties":{"name":"Rapla"},"id":"EE.RA","arcs":[[-15,-33,-27,-5]]},{"type":"Polygon","properties":{"name":"Valga"},"id":"EE.VG","arcs":[[-36,36,37,38,-22]]},{"type":"Polygon","properties":{"name":"Viljandi"},"id":"EE.VD","arcs":[[-23,-39,39,-31,-13,-18]]},{"type":"Polygon","properties":{"name":"Võru"},"id":"EE.VR","arcs":[[40,-37,-35]]},{"type":"MultiPolygon","properties":{"name":"Saare"},"id":"EE.SA","arcs":[[[41]],[[42]],[[43]]]}]}},"arcs":[[[1086,2968],[2,-20],[9,-9],[0,-24],[-46,-107],[-4,2],[-1,43],[-31,57],[27,99],[2,54],[6,3],[15,-8],[5,-10],[2,-21],[3,-10],[6,-2],[4,-18],[1,-29]],[[4265,9428],[-42,-17],[-42,72],[-3,87],[21,83],[24,8],[24,-65],[30,-122],[-12,-46]],[[6302,9561],[1,-17],[-1,-110],[-8,-21],[-27,-55],[-3,-27],[3,-25],[15,-53],[7,-20],[19,-42],[12,-188],[4,-25],[13,-35],[46,-54],[5,-27],[4,-34],[-3,-33],[6,-57],[2,-40],[6,-46],[9,-40],[17,-50],[10,-54],[32,-232],[2,-27],[-3,-41],[-28,-40]],[[6442,8168],[-123,63],[-78,10],[-208,-89],[-2,-59],[-10,-7],[-16,-3],[-25,12],[-61,54],[-111,-20],[-53,-19],[-3,-19],[3,-28],[16,-44],[17,-57],[10,-94],[-6,-59],[-14,-66],[-29,-81],[-43,-163],[23,-123],[7,-17],[19,-28],[0,-47],[-8,-23],[-12,-26],[-18,-18],[-23,3],[-26,13],[-36,1],[-16,-24],[-4,-41],[6,-97],[-8,-112],[-121,-110]],[[5489,6850],[-65,51],[-51,69],[-48,49],[-22,37],[-9,35],[-3,32],[-4,26],[-2,32],[-4,28],[-6,52],[-27,42],[-17,21],[-15,1],[-9,-7],[-36,0],[-91,77],[-23,75],[-104,55],[-37,41],[-8,17],[-15,44],[-28,72],[-29,41],[-10,39],[-2,46],[9,109],[-59,3],[-107,-45],[-22,-17],[-13,-19],[-176,36],[-52,-55],[-22,-45],[-31,-38],[-13,-26],[-24,-71],[-8,-92],[-22,-54],[4,-25],[10,-25],[12,-39],[2,-24],[-11,-63],[-14,-5],[-116,17],[-83,-30],[-88,-31],[-14,-26],[-85,-206],[-33,-97],[-106,15],[-51,23],[-35,-3],[-22,-16],[-11,-23],[-6,-22],[-4,-23],[-13,-41],[-44,-52]],[[3576,6815],[-19,31],[-5,21],[0,22],[5,45],[10,36],[10,27],[62,142],[5,17],[0,14],[-7,19],[-18,27],[-16,30],[-6,46],[2,33],[-2,35],[-5,22],[-65,90],[-82,50],[-84,-11],[-41,-25],[-16,-5],[-37,15],[-53,103],[-23,29],[-34,27],[-50,22],[-17,26],[-27,97],[-19,43],[-50,47],[-25,66],[-1,4]],[[2968,7960],[19,-5],[18,42],[2,50],[-11,44],[-20,25],[18,59],[34,27],[140,5],[68,-27],[74,8],[82,48],[80,11],[66,-102],[31,108],[-13,83],[-101,210],[-13,44],[4,51],[20,49],[21,29],[23,11],[28,-9],[44,-49],[89,-143],[45,-29],[44,34],[-13,79],[-41,86],[-38,54],[31,30],[139,15],[55,33],[18,55],[19,152],[6,32],[104,38],[36,-7],[31,-35],[57,-99],[31,-21],[29,20],[25,40],[25,28],[30,-13],[90,-98],[28,-12],[28,20],[-6,43],[-25,42],[-29,19],[0,35],[41,-7],[16,14],[7,42],[6,50],[13,19],[18,-5],[18,-18],[28,-71],[20,-80],[25,-53],[45,14],[18,21],[9,20],[37,116],[4,25],[-14,71],[-11,27],[-14,19],[-12,24],[-5,42],[-1,44],[-1,33],[-4,31],[-6,36],[48,49],[60,-74],[107,-199],[39,-17],[123,48],[37,-14],[65,-66],[33,-15],[29,25],[-13,120],[22,48],[37,-1],[76,-77],[336,-146],[3,0],[-11,108],[21,59],[38,23],[147,0],[16,14],[0,33],[-12,33],[-16,15],[-45,85],[-24,187],[-5,187],[10,85],[27,-35],[52,-154],[29,-36],[34,-21],[26,-50],[48,-118],[35,-41],[51,-26],[46,15],[19,85],[-12,78],[-24,53],[-17,59],[10,96],[-10,4],[-15,18],[-7,7],[38,71],[48,-23],[87,-140],[-12,-35],[20,-59],[13,-113],[21,-49],[30,-25],[17,6]],[[8834,6046],[-1,0],[-765,216],[-9,1],[-45,7],[-12,8],[-11,13],[-21,49],[-40,36],[-39,12],[-15,0],[-21,-9],[-42,-30],[-34,0],[-15,-5],[-10,-9],[-13,2],[-9,25],[-8,71],[-6,100],[-9,23],[-1,24],[-4,18],[0,18],[-39,66]],[[7665,6682],[56,67],[49,29],[11,18],[5,20],[1,31],[4,34],[9,38],[22,36],[12,25],[0,29],[-18,65],[-1,261],[5,70],[11,25],[105,99],[84,19],[14,11],[6,23],[-3,25],[-3,16],[-12,32],[14,135],[-9,25],[-16,23],[-48,6],[-22,14],[-28,48],[-11,42],[-16,122],[-109,-54],[-10,5],[-21,24],[-21,52],[10,108],[66,202],[14,59],[-5,24],[-14,9],[-65,16],[-14,-4],[-16,1],[-13,8],[-13,26],[-2,13],[4,15],[28,29],[26,42],[-9,94],[7,18],[10,20],[12,10],[10,1],[12,-11],[23,-41],[12,28],[-7,107],[1,53],[-8,50],[-25,92],[-5,27],[-1,20],[7,35],[15,62],[2,8]],[[7787,9218],[73,-119],[76,-43],[66,-63],[32,-18],[281,-38],[250,23],[211,23],[242,-92],[242,-23],[246,-90],[65,32],[61,63],[47,87],[57,161],[30,-87],[71,-56],[34,-54],[37,-138],[14,-42],[19,-34],[41,-52],[17,-32],[-7,-88],[-39,37],[-69,-86],[-127,-16],[-50,-38],[114,-69],[37,2],[-32,-65],[-184,5],[-88,-74],[-34,-69],[14,-82],[-27,-99],[-49,-350],[-92,-390],[-27,-98],[-67,-193],[-18,-104],[-27,-69],[-2,-5],[-141,-192],[-200,-275],[-50,-262]],[[6442,8168],[7,-16],[-8,-35],[-11,-37],[-1,-30],[4,-14],[7,-14],[12,-11],[24,-76],[19,-55],[-11,-51],[6,-34],[41,-49],[57,-31],[-12,-105],[-42,-94],[-20,-66],[-51,-89],[-3,-86],[-15,-89],[4,-27],[14,-8],[43,6],[21,-6],[40,-31],[34,-6],[22,-20],[39,-126],[32,-18],[46,-104],[31,-47],[20,-64],[20,-88],[6,-53],[2,-43],[-1,-35],[-4,-38],[-10,-63],[-4,-52]],[[6800,6363],[-42,-53],[-8,-14],[-8,-22],[-7,-30],[-1,-22],[10,-58],[-7,-42],[-98,-12],[-32,-4],[-15,-11],[-19,-18],[-12,-23],[-39,-19],[-18,-28],[-6,-51],[-1,-45],[-4,-43],[-5,-33],[-44,-55],[-31,37],[-32,-10],[-48,-64],[-14,-9],[-19,-20],[-13,-26],[-12,-56],[-13,-38],[-45,-76],[-9,-71]],[[6208,5447],[-70,-46],[-116,-63],[-32,-36],[-27,-22],[-102,-55],[-27,-56],[-48,16],[-58,-68],[-54,-23],[-140,6],[-32,26],[-37,10],[-73,49]],[[5392,5185],[26,176],[6,60],[7,27],[9,30],[5,26],[0,26],[-14,27],[-27,23],[-50,7],[-55,27]],[[5299,5614],[33,126],[4,35],[-6,61],[-25,77],[-5,29],[6,25],[21,22],[36,18],[11,18],[9,27],[12,63],[15,37],[11,57],[-27,59],[-25,22],[-7,20],[-3,17],[32,124],[26,32],[14,9],[16,16],[11,31],[3,49],[0,46],[-3,49],[-10,24],[-11,17],[-3,23],[2,14],[53,89]],[[8834,6046],[-56,-297],[29,-211]],[[8807,5538],[-444,-120],[-88,-34],[-19,-17],[-20,-26],[-25,-43],[-20,-21],[-15,-12],[-13,-1],[-10,-16],[-4,-32],[11,-129],[-7,-46],[-37,5],[-20,15],[-60,17],[-75,90],[-46,16],[-32,-193],[-47,-140],[-143,-53],[-55,38],[-19,23],[-15,-3],[-18,-30],[-25,-105],[-18,-42],[-6,-6],[-7,-4],[-58,6],[-60,33],[-54,48],[-54,-35],[-21,-23],[-8,1],[-28,39],[-40,-13],[-35,-62],[-16,-12],[-14,14],[-10,34],[-12,25],[-23,7],[-30,-17],[-138,-158],[-28,-20],[-32,-14],[-47,4],[-57,-31]],[[6765,4495],[-105,134],[-50,96],[-6,36],[-11,40],[-15,29],[-49,1],[-20,11],[-17,32],[-12,29],[-7,31],[-5,33],[-21,28],[-20,19],[-139,32],[-26,-6],[-33,10],[-48,-1],[-15,14],[-2,28],[13,37],[16,21],[28,24],[9,22],[4,38],[-11,62],[-3,118],[-12,34]],[[6800,6363],[129,51],[93,83],[31,11],[25,-11],[41,-93],[85,-49],[65,44],[6,23],[2,20],[0,74],[76,86],[34,-5],[18,-22],[32,-7],[25,9],[63,51],[83,53],[16,5],[41,-4]],[[6302,9561],[12,4],[26,41],[24,68],[-12,32],[22,109],[34,-33],[35,-87],[28,-50],[32,13],[3,30],[-6,40],[2,41],[20,46],[18,14],[21,-7],[55,-44],[60,-88],[6,-19],[3,-26],[2,-34],[14,-8],[298,8],[30,-14],[64,-64],[97,-34],[89,-80],[63,-27],[34,-3],[27,15],[53,66],[22,14],[66,-9],[61,-28],[58,-49],[58,-72],[66,-108]],[[8950,3149],[-64,-10],[-231,119],[-26,-13],[-14,-2],[-17,1],[-17,7],[-17,12],[-13,20],[-7,84],[-28,48],[-140,-2],[-24,28],[-11,24],[-7,4],[-12,-2],[-24,-48],[-20,-13],[-32,7],[-44,47],[-17,6],[-19,-18],[-25,-89],[-9,-23],[-5,-9],[-31,-6],[-42,66],[-71,-20],[-12,11],[-18,3],[-16,-10],[-19,-23],[-24,-80],[-14,-76],[-44,-70],[-97,-51],[-48,1],[-4,18],[-17,37],[-13,1],[-18,-16],[-18,-42],[-15,-24],[-16,-4],[-23,20],[-8,-6],[0,-25],[4,-37],[2,-42],[-2,-39],[-13,-40],[-10,-21],[-45,-33]],[[7495,2819],[-26,79],[-15,25],[-33,37],[-15,29],[-30,35],[-90,-44],[-22,-19],[-29,-17],[-18,-5],[-31,57],[-15,22],[-17,42],[-19,-1],[-20,-21],[-62,-118],[-28,-37],[-25,-13],[-36,-40],[-30,-24],[-263,33]],[[6671,2839],[-42,446],[-10,354],[40,136],[54,149],[106,238],[0,34],[-54,299]],[[8807,5538],[32,-236],[78,-575],[88,-647],[-96,-351],[-17,-236],[19,-219],[39,-125]],[[723,6400],[-102,-41],[-50,8],[-209,175],[-28,48],[17,77],[61,15],[117,-26],[463,95],[-30,32],[-3,32],[20,12],[35,-31],[18,3],[-1,163],[26,43],[36,4],[28,17],[23,38],[21,67],[6,42],[0,39],[3,38],[14,40],[16,12],[68,-12],[1,0],[40,-10],[47,-26],[28,-45],[-36,-132],[15,-75],[31,-62],[25,-30],[158,16],[153,-114],[24,-61],[5,-48],[-8,-71],[3,-42],[14,-44],[33,-42],[13,-26],[10,-29],[22,-39],[11,-26],[5,-21],[1,-24],[0,-53],[5,-30],[10,-9],[11,-1],[6,-5],[2,-94],[-11,-48],[-23,-6],[-65,70],[-16,11],[-17,4],[-11,-16],[-4,-29],[-7,-16],[-21,27],[-26,-21],[-27,0],[-25,-13],[-20,-59],[15,0],[10,-12],[7,-26],[1,-41],[-2,-58],[-7,-11],[-12,-1],[-17,-26],[-29,-27],[-45,-2],[-42,23],[-18,52],[17,49],[34,38],[25,38],[-12,49],[-27,3],[-39,-28],[-38,-42],[-26,-41],[-34,-113],[-54,-269],[-41,-99],[-68,-57],[-88,-16],[-85,36],[-61,101],[15,16],[14,22],[25,59],[-21,50],[-29,85],[-25,94],[-11,75],[0,113],[-4,65],[-16,52],[-75,138],[-43,46],[-47,21],[-52,-7]],[[2165,7091],[110,-55],[69,31],[35,2],[31,-48],[41,-100],[6,-52],[-14,-73],[-17,-23],[-18,9],[-19,20],[-16,10],[-17,-10],[-48,-51],[-32,-1],[-54,50],[-33,12],[-9,-10],[-4,-21],[-7,-20],[-58,-22],[-17,3],[-23,24],[-46,195],[-8,26],[8,55],[19,33],[27,17],[34,7],[60,-8]],[[3576,6815],[-32,-92],[7,-67],[61,-155],[60,-244],[18,-52],[15,-39],[-1,-36],[-15,-23],[-43,-30],[-11,-27],[0,-45],[5,-32],[24,-41],[-66,-83],[-12,-31],[-57,-40],[-7,-47],[8,-24],[29,-17],[73,-1],[17,-16],[5,-23],[-4,-26],[-29,-123]],[[3621,5501],[-74,-60],[-41,-22],[-60,-59],[-26,-3],[-53,23],[-12,-11],[-4,-28],[-3,-43],[-10,-52],[-33,-74],[-26,-24],[-27,-1],[-42,37],[-17,4],[-4,-17],[4,-26],[3,-18],[2,-17],[-1,-18],[-4,-27],[0,-27],[6,-72],[52,-92],[6,-14],[1,-36],[-123,17],[-121,-48],[-152,34],[-24,-3],[-77,-50],[-1,-2],[-1,-1]],[[2759,4771],[-2,4],[-17,32],[-12,65],[-1,53],[-6,27],[-24,-15],[-21,-45],[-13,-49],[-13,-23],[-23,36],[-6,45],[10,50],[15,51],[7,46],[-9,86],[-18,115],[-13,122],[8,108],[13,40],[14,6],[33,-18],[11,10],[6,22],[-1,22],[-25,39],[-5,62],[9,53],[21,1],[60,-46],[59,16],[58,35],[60,11],[31,-20],[61,-62],[26,-13],[48,0],[5,14],[2,33],[-3,33],[-9,15],[-25,21],[-6,50],[9,53],[23,34],[26,-3],[61,-53],[30,-7],[-42,77],[-50,54],[-50,5],[-41,-73],[-29,59],[-32,5],[-67,-32],[-115,12],[-36,-12],[-32,-29],[-16,-23],[-12,-26],[-9,-4],[-50,21],[-31,-8],[-88,-58],[59,167],[30,41],[52,14],[11,33],[-98,206],[-13,87],[-52,120],[0,92],[34,72],[104,-12],[34,70],[28,-27],[28,-3],[27,16],[51,65],[13,23],[4,31],[1,56],[-10,111],[-26,81],[-34,56],[-38,37],[20,-60],[47,-71],[19,-61],[-13,-13],[-29,-5],[-11,-11],[-33,-64],[-2,-16],[0,-27],[-8,-52],[-16,-5],[-9,21],[-8,29],[-10,16],[-102,39],[-41,53],[-42,101],[11,-3],[22,4],[11,-1],[-11,84],[9,58],[71,127],[17,22],[16,-13],[27,-57],[2,240],[-53,228],[-24,177],[87,84],[17,-3],[33,-21],[19,-5],[14,10],[22,44],[36,28],[19,39],[22,33],[33,5],[83,-124],[5,-1]],[[3415,2750],[-50,-41],[-43,63],[-9,111],[28,68],[45,25],[46,-17],[14,-110],[-31,-99]],[[5392,5185],[-42,-33],[-11,-31],[-3,-33],[5,-33],[8,-34],[1,-46],[-17,-22],[-62,-36],[-22,-34],[-21,-52],[-20,-38],[-67,-77],[-106,-77],[-59,-99],[-11,-39],[3,-13],[19,-61],[7,-51],[1,-112],[-46,-54],[-7,-56],[6,-103],[-11,-101],[-23,-143],[19,-58],[9,-13],[28,-12],[49,75],[22,-3],[9,-15],[124,-38],[23,-17],[62,-87],[93,-94],[18,-29],[7,-46],[-28,-51],[0,-24],[2,-36],[2,-162],[-7,-21],[-9,-2],[-9,20],[-19,20],[-85,-31],[-13,-26],[-10,-33],[2,-39],[6,-37],[-1,-39],[-7,-15],[-11,6],[-15,12],[-18,3],[-22,-35],[-8,-28],[1,-22],[7,-14],[15,-19],[6,-13],[8,-21],[-3,-32],[-14,-8],[-23,2],[-23,9],[-22,-6],[-9,-18],[-4,-26],[-8,-35],[-16,-24],[-28,-28],[-11,-28],[-2,-27],[8,-23],[6,-20],[3,-25],[2,-26],[2,-24],[5,-19],[12,-32],[1,-1]],[[5040,2472],[-95,-152],[-40,-44],[-121,-27],[-38,-39],[-33,-48],[-17,-24],[-41,11],[-41,41],[-49,20],[-23,-48],[-29,-128],[-24,-31],[-96,-17],[-65,10],[-45,7],[-32,-11],[-83,-120],[-62,-52],[-20,-36],[-26,-110],[-17,-47],[-37,-33],[-45,-3],[-68,44],[16,42],[13,44],[5,53],[4,55],[5,52],[75,290],[27,183],[76,145],[27,82],[0,225],[12,102],[2,56],[-8,49],[-12,43],[-8,50],[0,52],[20,99],[1,51],[-1,51],[5,52],[32,68],[48,49],[42,61],[19,107],[-15,99],[-35,78],[-133,165],[-65,43],[-65,9],[-54,-43],[-18,-38],[-18,-55],[-14,-61],[-5,-55],[-2,-72],[-7,-42],[-48,-134],[-20,-43],[-23,-29],[-28,-12],[-58,25],[-28,0],[-27,-41],[-29,-106],[-14,-19],[-28,17],[-17,29],[-47,127],[-73,103],[-42,83],[-105,69],[-63,9],[-30,20],[-8,15],[-17,40],[-8,12],[-14,3],[-10,-13],[-8,-17],[-12,-8],[-14,11],[-15,20],[-16,8],[-14,-21],[-9,-28],[-11,-20],[-11,-4],[-12,18],[-9,39],[-9,53],[-6,56],[-3,45],[-7,69],[-18,37],[-21,26],[-17,42],[-10,61],[1,48],[9,113],[1,138],[-8,113],[-24,56],[-45,-36],[-20,3],[-30,32],[-28,38]],[[3621,5501],[44,-59],[194,-59],[124,-26],[81,31],[23,21],[15,23],[6,17],[10,58],[10,32],[9,21],[49,68],[51,36],[19,-3],[23,-10],[6,-17],[-2,-29],[0,-25],[17,-33],[21,1],[51,33],[69,25],[57,126],[53,-4],[98,-41],[40,9],[39,27],[30,3],[38,-15],[18,-22],[10,-29],[4,-74],[14,-109],[4,-68],[7,-43],[33,20],[54,114],[25,37],[32,36],[25,16],[9,-1],[27,-10],[17,2],[6,6],[3,39],[105,-37],[49,3],[61,23]],[[8950,3149],[32,-105],[62,-214],[80,-174],[10,-135],[-10,-121],[2,-134],[30,-19],[29,-38],[9,-112],[-7,-59],[-11,-52],[-6,-53],[8,-65],[13,-26],[160,-103],[25,-45],[14,-92],[-20,-63],[-37,-41],[-98,-64],[-228,-55]],[[9007,1379],[-1,2],[-15,20],[-152,97],[-87,26],[-55,-21],[-59,-48],[-36,10],[-25,63],[-10,13],[-13,0],[-13,-7],[-11,6],[-6,25],[10,60],[15,46],[54,75],[-5,67],[-24,51],[-11,4],[-11,-12],[-7,-15],[-9,-12],[-16,0],[-24,11],[-88,69],[-101,113],[-26,25],[-14,2],[-17,-4],[-29,-18],[-23,-34],[8,-110],[-13,-18],[-174,105],[-44,-25],[-37,-20],[-34,15],[-139,-17],[-49,38],[-84,28],[-36,-21],[-40,-9],[-46,10],[-25,13],[-16,21],[-61,38]],[[7408,2041],[7,241],[13,58],[5,82],[-4,92],[3,50],[-2,37],[18,98],[10,50],[5,16],[32,54]],[[7408,2041],[-180,-42],[-52,-30],[-6,-23],[-1,-38],[1,-42],[-9,-59],[-18,-48],[-11,-34],[0,-40],[45,-18],[15,-50],[-20,-88],[2,-22],[3,-146],[41,-58],[44,-22],[14,-36],[2,-34],[-8,-62],[-11,-28],[-16,-16],[-11,-20],[0,-25],[8,-36],[4,-47],[12,-31],[19,-24],[19,-29],[2,-36],[-7,-31],[-31,-47],[-30,-81],[3,-17],[20,-41],[34,-58],[0,-25],[-6,-28],[-14,-23],[-28,-33],[-10,-24],[2,-18],[7,-27],[5,-20],[-9,-103],[4,-66],[0,-2]],[[7236,213],[-125,86],[-20,13],[-65,75],[-54,100],[-149,386],[-52,97],[-174,230],[-13,57],[-5,95],[5,43],[9,28],[5,27],[-5,45],[-12,22],[-18,15],[-331,46],[-40,60],[-20,93],[-14,94],[-24,65],[-24,1],[-18,-10],[-59,-32],[-25,-13],[-40,-6],[-37,9],[-35,34],[-33,68],[-8,37],[-1,31],[-1,5]],[[5853,2014],[30,89],[10,46],[11,39],[39,105],[4,41],[-2,44],[2,37],[14,25],[40,10],[24,-7],[27,8],[26,29],[45,83],[58,74],[86,67],[11,25],[6,31],[-8,25],[-1,21],[5,28],[11,22],[22,29],[3,21],[2,22],[9,20],[20,-5],[41,-46],[21,-50],[20,-62],[19,-33],[49,-1],[32,25],[142,63]],[[5853,2014],[-2,25],[-14,35],[-15,17],[-56,19],[-62,63],[-59,112],[-36,69],[-63,54],[-16,-2],[-10,-8],[-10,-4],[-15,14],[-9,27],[-19,84],[-11,32],[-28,36],[-29,8],[-20,-31],[-2,-80],[44,-126],[11,-74],[-31,-64],[-50,-41],[-25,0],[-23,30],[-19,100],[-15,115],[-22,95],[-40,43],[-74,-3],[-37,-17],[-34,-35],[-22,-35]],[[9007,1379],[-29,-7],[-21,-20],[13,-10],[33,-48],[-43,-35],[-22,-27],[-15,-41],[-8,-78],[18,-131],[-2,-59],[-27,-47],[-130,-73],[-26,-40],[-11,-27],[-8,-37],[-4,-45],[2,-24],[3,-18],[4,-61],[4,-16],[3,-16],[-3,-96],[-5,-20],[-11,-22],[-20,-16],[-21,-2],[-19,-11],[-14,-40],[1,-58],[11,-77],[15,-74],[12,-48],[-52,-54],[-242,142],[-127,13],[-37,29],[-32,59],[-58,142],[-37,46],[-54,30],[-27,1],[-28,-10],[-25,7],[-17,33],[-19,24],[-30,-22],[-24,-59],[-16,-68],[-19,-65],[-32,-45],[-28,-14],[-122,11],[-53,-27],[-52,-49],[-46,-65],[-10,-30],[-6,-34],[-7,-29],[-16,-12],[-15,9],[-29,33],[-15,6],[-22,-20],[-21,-30],[-25,-7],[-29,53],[-52,119],[-27,41]],[[2263,1252],[-32,-6],[-32,34],[-19,43],[1,40],[3,38],[6,28],[24,-6],[33,-42],[16,-26],[7,-42],[-7,-61]],[[1272,4979],[12,-10],[16,10],[27,43],[10,10],[33,-15],[26,-27],[27,-15],[34,23],[51,101],[33,38],[55,-44],[84,31],[35,-13],[34,-33],[72,-40],[74,-81],[86,-61],[32,-71],[22,-96],[13,-28],[23,-35],[63,-51],[66,-26],[39,-22],[53,-55],[46,-73],[24,-75],[-13,-65],[-100,109],[-38,-44],[20,-9],[18,-13],[15,-26],[11,-44],[-68,15],[-30,28],[-31,49],[-6,22],[-6,33],[-10,30],[-16,13],[-24,0],[-3,-9],[-9,-26],[-3,-17],[-9,-67],[-5,-27],[-12,-30],[-11,-18],[-24,-31],[-10,3],[-15,9],[-13,-9],[-6,-52],[1,-28],[2,-30],[3,-28],[4,-23],[-36,-44],[-34,-65],[-32,-38],[-70,85],[-36,-3],[-11,-39],[34,-57],[-105,-225],[-24,-20],[-26,-13],[-26,-27],[-46,-91],[-22,-27],[-35,-9],[-72,11],[-34,-16],[-18,-59],[74,-72],[-53,-78],[-85,-18],[-23,108],[-23,26],[-29,11],[-30,-3],[-26,-20],[-24,-39],[-9,-19],[-7,9],[-18,49],[-22,29],[-14,-31],[-14,-78],[-11,-15],[-5,-11],[-5,-6],[-11,-3],[0,16],[-9,70],[-1,15],[-22,2],[-27,-20],[-26,-31],[-17,-34],[-17,-24],[-18,11],[-18,17],[-17,-4],[-11,-16],[-30,-26],[-13,-5],[-47,-47],[-45,-64],[-20,-47],[-12,-16],[-5,-23],[-3,-173],[-7,-102],[-13,-101],[-43,-190],[-13,-43],[-18,-38],[-16,-41],[-2,-45],[7,-104],[-20,-47],[-223,-318],[-50,-3],[-42,98],[7,54],[-6,51],[-15,38],[-22,15],[-5,8],[-2,18],[-1,22],[2,18],[42,-6],[12,6],[11,33],[17,97],[9,43],[60,144],[27,98],[15,43],[16,17],[23,-11],[20,-20],[19,-14],[19,14],[9,31],[9,97],[10,45],[59,144],[-35,60],[-61,40],[-109,29],[-31,50],[-57,220],[-36,50],[-102,2],[-51,26],[-45,64],[-26,80],[-12,55],[-1,39],[20,22],[82,-37],[-18,70],[-27,72],[-10,57],[34,22],[28,-31],[25,-60],[26,-38],[29,37],[-13,81],[20,49],[36,15],[32,-18],[-14,53],[-19,100],[-69,210],[-34,68],[-37,100],[-21,42],[-44,67],[-43,88],[83,-59],[26,-1],[23,15],[3,16],[1,25],[15,39],[60,-4],[46,-24],[39,-61],[69,-198],[9,-47],[3,-63],[3,-28],[6,-14],[9,-6],[9,-2],[15,18],[0,41],[-9,68],[9,122],[8,53],[16,50],[20,31],[51,42],[20,36],[18,65],[7,34],[11,14],[29,3],[4,-11],[5,-24],[5,-27],[2,-22],[3,-55],[6,-28],[23,-26],[47,-13],[15,93],[2,127],[7,92],[52,72],[222,38],[138,170],[52,22],[17,-24],[29,-109],[17,-25],[10,-10],[17,-43]],[[2385,5147],[-3,-44],[2,-39],[13,-41],[29,-56],[12,-30],[24,-75],[5,-39],[-32,-36],[-13,-41],[-15,-29],[-24,14],[-25,28],[-27,15],[-55,8],[-22,-12],[-47,-43],[-17,4],[-141,206],[-81,49],[-37,60],[5,98],[20,25],[48,-26],[24,19],[4,25],[11,96],[6,34],[32,66],[33,24],[35,-3],[142,-65],[66,-62],[21,-39],[9,-45],[-2,-46]]],"transform":{"scale":[0.0006354743554355466,0.0002155281452145242],"translate":[21.832367384000094,57.515818583000055]}};
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
