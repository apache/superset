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
  Datamap.prototype.estTopo = '__EST__';
  Datamap.prototype.ethTopo = '__ETH__';
  Datamap.prototype.finTopo = '__FIN__';
  Datamap.prototype.fjiTopo = '__FJI__';
  Datamap.prototype.flkTopo = '__FLK__';
  Datamap.prototype.fraTopo = {"type":"Topology","objects":{"fra":{"type":"GeometryCollection","geometries":[{"type":"Polygon","properties":{"name":"Martinique"},"id":"MQ.","arcs":[[0]]},{"type":"Polygon","properties":{"name":"Guyane française"},"id":"GF.","arcs":[[1]]},{"type":"Polygon","properties":{"name":"La Réunion"},"id":"RE.","arcs":[[2]]},{"type":"MultiPolygon","properties":{"name":"Mayotte"},"id":"YT.","arcs":[[[3]],[[4]]]},{"type":"MultiPolygon","properties":{"name":"Guadeloupe"},"id":"GP.","arcs":[[[5]],[[6]],[[7]],[[8]],[[9]],[[10]],[[11]],[[12]]]},{"type":"Polygon","properties":{"name":"Ain"},"id":"FR.AI","arcs":[[13,14,15,16,17,18,19]]},{"type":"Polygon","properties":{"name":"Aisne"},"id":"FR.AS","arcs":[[20,21,22,23,24,25,26]]},{"type":"Polygon","properties":{"name":"Allier"},"id":"FR.AL","arcs":[[27,28,29,30,31,32]]},{"type":"Polygon","properties":{"name":"Alpes-de-Haute-Provence"},"id":"FR.AP","arcs":[[33,34,35,36,37,38]]},{"type":"MultiPolygon","properties":{"name":"Alpes-Maritimes"},"id":"FR.AM","arcs":[[[39]],[[40,-35,41]]]},{"type":"Polygon","properties":{"name":"Ardèche"},"id":"FR.AH","arcs":[[42,43,44,45,46,47,48]]},{"type":"Polygon","properties":{"name":"Ardennes"},"id":"FR.AN","arcs":[[49,50,-22,51]]},{"type":"Polygon","properties":{"name":"Ariège"},"id":"FR.AG","arcs":[[52,53,54,55]]},{"type":"Polygon","properties":{"name":"Aube"},"id":"FR.AB","arcs":[[56,57,58,59,60]]},{"type":"Polygon","properties":{"name":"Aude"},"id":"FR.AD","arcs":[[61,62,63,-53,64,65]]},{"type":"Polygon","properties":{"name":"Aveyron"},"id":"FR.AV","arcs":[[66,67,68,69,70,71,72]]},{"type":"Polygon","properties":{"name":"Bas-Rhin"},"id":"FR.BR","arcs":[[73,74,75,76]]},{"type":"Polygon","properties":{"name":"Bouches-du-Rhône"},"id":"FR.BD","arcs":[[77,78,79,80]]},{"type":"Polygon","properties":{"name":"Calvados"},"id":"FR.CV","arcs":[[81,82,83,84]]},{"type":"Polygon","properties":{"name":"Cantal"},"id":"FR.CL","arcs":[[85,86,-73,87,88,89]]},{"type":"Polygon","properties":{"name":"Charente"},"id":"FR.CT","arcs":[[90,91,92,93,94]]},{"type":"MultiPolygon","properties":{"name":"Charente-Maritime"},"id":"FR.CM","arcs":[[[95]],[[96]],[[97,-93,98,99,100,101]]]},{"type":"Polygon","properties":{"name":"Cher"},"id":"FR.CH","arcs":[[102,-33,103,104,105,106]]},{"type":"Polygon","properties":{"name":"Corrèze"},"id":"FR.CZ","arcs":[[107,-89,108,109,110,111]]},{"type":"MultiPolygon","properties":{"name":"Corse-du-Sud"},"id":"FR.CS","arcs":[[[112]],[[113]],[[114,115]]]},{"type":"Polygon","properties":{"name":"Côte-d'Or"},"id":"FR.CO","arcs":[[116,117,118,119,120,-58,121]]},{"type":"Polygon","properties":{"name":"Côtes-d'Armor"},"id":"FR.CA","arcs":[[122,123,124,125]]},{"type":"Polygon","properties":{"name":"Creuse"},"id":"FR.CR","arcs":[[-104,-32,126,-112,127,128]]},{"type":"Polygon","properties":{"name":"Deux-Sèvres"},"id":"FR.DS","arcs":[[129,-94,-98,130,131]]},{"type":"Polygon","properties":{"name":"Dordogne"},"id":"FR.DD","arcs":[[-110,132,133,134,-99,-92,135]]},{"type":"Polygon","properties":{"name":"Doubs"},"id":"FR.DB","arcs":[[136,137,138,139]]},{"type":"Polygon","properties":{"name":"Drôme"},"id":"FR.DM","arcs":[[140,-38,141,-43,142],[143]]},{"type":"Polygon","properties":{"name":"Essonne"},"id":"FR.ES","arcs":[[144,145,146,147,148,149]]},{"type":"Polygon","properties":{"name":"Eure"},"id":"FR.EU","arcs":[[150,151,152,153,154,-85,155,156]]},{"type":"Polygon","properties":{"name":"Eure-et-Loir"},"id":"FR.EL","arcs":[[-148,157,158,159,160,-154,161]]},{"type":"MultiPolygon","properties":{"name":"Finistère"},"id":"FR.FI","arcs":[[[162]],[[-125,163,164]]]},{"type":"Polygon","properties":{"name":"Gard"},"id":"FR.GA","arcs":[[165,-80,166,167,-68,168,-45]]},{"type":"Polygon","properties":{"name":"Gers"},"id":"FR.GE","arcs":[[169,170,171,172,173,174]]},{"type":"Polygon","properties":{"name":"Gironde"},"id":"FR.GI","arcs":[[-100,-135,175,176,177]]},{"type":"Polygon","properties":{"name":"Haute-Rhin"},"id":"FR.HR","arcs":[[178,179,180,-75]]},{"type":"MultiPolygon","properties":{"name":"Haute-Corse"},"id":"FR.HC","arcs":[[[181]],[[-115,182]]]},{"type":"Polygon","properties":{"name":"Haute-Garonne"},"id":"FR.HG","arcs":[[-65,-56,183,184,-171,185,186]]},{"type":"Polygon","properties":{"name":"Haute-Loire"},"id":"FR.HL","arcs":[[187,-47,188,-86,189]]},{"type":"Polygon","properties":{"name":"Haute-Marne"},"id":"FR.HM","arcs":[[190,191,192,-122,-57,193]]},{"type":"Polygon","properties":{"name":"Haute-Saône"},"id":"FR.HN","arcs":[[194,-139,195,-117,-193,196]]},{"type":"Polygon","properties":{"name":"Haute-Savoie"},"id":"FR.HS","arcs":[[197,-16,198]]},{"type":"Polygon","properties":{"name":"Haute-Vienne"},"id":"FR.HV","arcs":[[-128,-111,-136,-91,199,200]]},{"type":"Polygon","properties":{"name":"Hautes-Alpes"},"id":"FR.HA","arcs":[[201,-39,-141,202,203]]},{"type":"MultiPolygon","properties":{"name":"Hautes-Pyrénées"},"id":"FR.HP","arcs":[[[204]],[[205]],[[-185,206,207,-172]]]},{"type":"Polygon","properties":{"name":"Hauts-de-Seine"},"id":"FR.HD","arcs":[[208,209,-150,210,211,212]]},{"type":"Polygon","properties":{"name":"Hérault"},"id":"FR.HE","arcs":[[213,-62,214,-69,-168]]},{"type":"Polygon","properties":{"name":"Ille-et-Vilaine"},"id":"FR.IV","arcs":[[215,216,217,218,219,-123,220]]},{"type":"Polygon","properties":{"name":"Indre"},"id":"FR.IN","arcs":[[-105,-129,-201,221,222,223]]},{"type":"Polygon","properties":{"name":"Indre-et-Loire"},"id":"FR.IL","arcs":[[-223,224,225,226,227]]},{"type":"Polygon","properties":{"name":"Isère"},"id":"FR.IS","arcs":[[228,-203,-143,-49,229,230,-18]]},{"type":"Polygon","properties":{"name":"Jura"},"id":"FR.JU","arcs":[[-138,231,-14,232,-118,-196]]},{"type":"Polygon","properties":{"name":"Landes"},"id":"FR.LD","arcs":[[233,-174,234,235,-177]]},{"type":"Polygon","properties":{"name":"Loir-et-Cher"},"id":"FR.LC","arcs":[[236,-106,-224,-228,237,-159]]},{"type":"Polygon","properties":{"name":"Loire"},"id":"FR.LR","arcs":[[238,-230,-48,-188,239,-30,240]]},{"type":"Polygon","properties":{"name":"Loire-Atlantique"},"id":"FR.LA","arcs":[[241,242,243,244,-219]]},{"type":"Polygon","properties":{"name":"Loiret"},"id":"FR.LT","arcs":[[245,246,247,-107,-237,-158,-147]]},{"type":"Polygon","properties":{"name":"Lot"},"id":"FR.LO","arcs":[[-88,-72,248,249,-133,-109]]},{"type":"Polygon","properties":{"name":"Lot-et-Garonne"},"id":"FR.LG","arcs":[[-250,250,-175,-234,-176,-134]]},{"type":"Polygon","properties":{"name":"Lozère"},"id":"FR.LZ","arcs":[[-46,-169,-67,-87,-189]]},{"type":"Polygon","properties":{"name":"Maine-et-Loire"},"id":"FR.ML","arcs":[[251,-226,252,-132,253,-242,-218,254]]},{"type":"MultiPolygon","properties":{"name":"Manche"},"id":"FR.MH","arcs":[[[255]],[[-83,256,257,-216,258]]]},{"type":"Polygon","properties":{"name":"Marne"},"id":"FR.MR","arcs":[[259,-194,-61,260,-23,-51]]},{"type":"Polygon","properties":{"name":"Mayenne"},"id":"FR.MY","arcs":[[261,-255,-217,-258,262]]},{"type":"Polygon","properties":{"name":"Meurhe-et-Moselle"},"id":"FR.MM","arcs":[[263,264,265,266]]},{"type":"Polygon","properties":{"name":"Meuse"},"id":"FR.MS","arcs":[[-266,267,-191,-260,-50,268]]},{"type":"MultiPolygon","properties":{"name":"Morbihan"},"id":"FR.MB","arcs":[[[269]],[[-220,-245,270,-164,-124]]]},{"type":"Polygon","properties":{"name":"Moselle"},"id":"FR.MO","arcs":[[-77,-264,271]]},{"type":"Polygon","properties":{"name":"Nièvre"},"id":"FR.NI","arcs":[[-120,272,-28,-103,-248,273]]},{"type":"MultiPolygon","properties":{"name":"Nord"},"id":"FR.NO","arcs":[[[274]],[[-27,275,276,277]]]},{"type":"Polygon","properties":{"name":"Oise"},"id":"FR.OI","arcs":[[-25,278,279,-151,280,281]]},{"type":"Polygon","properties":{"name":"Orne"},"id":"FR.OR","arcs":[[-155,-161,282,-263,-257,-82]]},{"type":"Polygon","properties":{"name":"Paris"},"id":"FR.VP","arcs":[[283,-209,284]]},{"type":"Polygon","properties":{"name":"Pas-de-Calais"},"id":"FR.PC","arcs":[[285,286,-277],[-275]]},{"type":"Polygon","properties":{"name":"Puy-de-Dôme"},"id":"FR.PD","arcs":[[-240,-190,-90,-108,-127,-31]]},{"type":"Polygon","properties":{"name":"Pyrénées-Atlantiques"},"id":"FR.PA","arcs":[[-173,-208,287,-235],[-206],[-205]]},{"type":"Polygon","properties":{"name":"Pyrénées-Orientales"},"id":"FR.PO","arcs":[[288,-54,-64],[289]]},{"type":"Polygon","properties":{"name":"Rhône"},"id":"FR.RH","arcs":[[-19,-231,-239,290]]},{"type":"Polygon","properties":{"name":"Saône-et-Loire"},"id":"FR.SL","arcs":[[-233,-20,-291,-241,-29,-273,-119]]},{"type":"Polygon","properties":{"name":"Sarthe"},"id":"FR.ST","arcs":[[-160,-238,-227,-252,-262,-283]]},{"type":"Polygon","properties":{"name":"Savoie"},"id":"FR.SV","arcs":[[291,-204,-229,-17,-198]]},{"type":"Polygon","properties":{"name":"Seien-et-Marne"},"id":"FR.SE","arcs":[[-261,-60,292,-246,-146,293,294,295,-279,-24]]},{"type":"Polygon","properties":{"name":"Seine-Maritime"},"id":"FR.SM","arcs":[[-281,-157,296,297]]},{"type":"Polygon","properties":{"name":"Seine-Saint-Denis"},"id":"FR.SS","arcs":[[298,-285,-213,299,-295]]},{"type":"Polygon","properties":{"name":"Somme"},"id":"FR.SO","arcs":[[-286,-276,-26,-282,-298,300]]},{"type":"Polygon","properties":{"name":"Tarn"},"id":"FR.TA","arcs":[[-215,-66,-187,301,-70]]},{"type":"Polygon","properties":{"name":"Tarn-et-Garonne"},"id":"FR.TG","arcs":[[-71,-302,-186,-170,-251,-249]]},{"type":"Polygon","properties":{"name":"Territoire de Belfort"},"id":"FR.TB","arcs":[[-180,302,-140,-195,303]]},{"type":"Polygon","properties":{"name":"Val-d'Oise"},"id":"FR.VO","arcs":[[-296,-300,-212,304,-152,-280]]},{"type":"Polygon","properties":{"name":"Val-de-Marne"},"id":"FR.VM","arcs":[[-294,-145,-210,-284,-299]]},{"type":"MultiPolygon","properties":{"name":"Var"},"id":"FR.VR","arcs":[[[305]],[[306]],[[-41,307,-78,-36]]]},{"type":"MultiPolygon","properties":{"name":"Vaucluse"},"id":"FR.VC","arcs":[[[-37,-81,-166,-44,-142]],[[-144]]]},{"type":"MultiPolygon","properties":{"name":"Vendée"},"id":"FR.VD","arcs":[[[308]],[[309]],[[-254,-131,-102,310,-243]]]},{"type":"Polygon","properties":{"name":"Vienne"},"id":"FR.VN","arcs":[[-225,-222,-200,-95,-130,-253]]},{"type":"Polygon","properties":{"name":"Vosges"},"id":"FR.VG","arcs":[[-181,-304,-197,-192,-268,-265,-76]]},{"type":"Polygon","properties":{"name":"Yonne"},"id":"FR.YO","arcs":[[-121,-274,-247,-293,-59]]},{"type":"Polygon","properties":{"name":"Yvelines"},"id":"FR.YV","arcs":[[-211,-149,-162,-153,-305]]}]}},"arcs":[[[84,4945],[-1,-1],[-1,-4],[-1,-2],[-1,0],[-1,-1],[-1,1],[-1,2],[1,1],[1,1],[1,1],[0,2],[-1,2],[-1,-1],[-2,-1],[-1,0],[0,1],[-3,0],[-5,1],[-1,-1],[-2,-1],[-1,0],[-1,0],[-2,5],[0,1],[0,1],[-1,0],[2,4],[2,2],[1,1],[1,-2],[1,-1],[2,1],[0,2],[0,1],[-1,1],[0,2],[-1,3],[-1,-1],[-1,0],[-1,0],[-1,0],[-1,-1],[-1,1],[-1,2],[-3,4],[-2,2],[0,3],[-1,1],[0,1],[-1,1],[1,1],[0,1],[0,1],[0,2],[-1,1],[0,2],[-3,4],[0,2],[-1,1],[1,2],[0,2],[1,1],[3,3],[3,0],[3,-1],[4,-4],[3,-3],[2,-1],[0,-1],[0,-1],[1,-1],[1,-1],[1,-4],[1,1],[2,1],[2,1],[2,0],[-1,0],[0,-1],[0,-1],[-2,-3],[-1,2],[-1,0],[0,-3],[0,-3],[1,0],[1,0],[1,-1],[-3,-2],[1,-1],[-1,-1],[0,-1],[1,0],[1,1],[2,-2],[-1,0],[0,-1],[0,-2],[1,-1],[2,-1],[0,-1],[0,-1],[0,-1],[1,0],[1,-1],[0,-1],[0,-1],[0,-1],[1,1],[0,-2],[0,-2],[0,-1],[1,-2],[-1,0],[0,-1],[0,-1],[1,-1],[0,-1],[0,-3],[1,-1],[0,-1]],[[860,3507],[-7,-6],[-2,-3],[-1,-4],[-1,-4],[-1,-4],[-1,-3],[-6,-10],[-2,-2],[-1,-1],[0,-2],[0,-2],[0,-2],[-1,-1],[-1,0],[-1,0],[-1,-3],[-1,-2],[-1,-6],[0,-3],[-4,-9],[-1,-4],[-1,-2],[-1,-1],[0,-1],[0,-1],[0,-1],[-12,-31],[-1,-1],[-1,-1],[-1,0],[-1,0],[-2,-3],[-1,-6],[-3,-4],[-1,-3],[0,-3],[1,-6],[0,-1],[-6,-16],[0,-2],[0,-2],[1,-1],[0,-1],[-1,-1],[-1,-1],[-1,0],[0,-1],[-1,-2],[-7,-24],[0,-4],[0,-1],[-1,-1],[-2,-1],[0,-2],[1,-3],[1,-2],[0,-2],[-1,-1],[0,-1],[-1,-1],[-1,-6],[-3,-6],[-3,-4],[-2,-6],[-1,-2],[-1,-2],[-10,-10],[-4,-2],[-1,-2],[-1,-3],[-1,-3],[0,-2],[-1,-1],[-1,0],[-1,0],[-1,-1],[0,-1],[-1,-1],[-2,0],[-3,1],[-3,1],[-3,3],[-2,1],[-2,0],[-10,-3],[-1,0],[-1,1],[1,2],[1,2],[2,1],[0,2],[-6,7],[-2,5],[0,1],[-2,0],[0,-1],[-2,-4],[-1,-2],[-3,-1],[-4,-4],[-1,-1],[-3,0],[-1,-1],[-2,1],[-2,2],[-2,1],[-3,0],[-1,1],[-6,4],[-2,0],[-1,0],[0,1],[1,3],[0,1],[-1,2],[-1,1],[-2,-1],[-1,-1],[-1,-2],[-1,-2],[-1,-2],[-1,-1],[-2,0],[-1,-2],[-1,-2],[-1,-1],[-2,0],[-1,0],[0,-4],[-1,-2],[-1,-2],[-4,-2],[0,-1],[-1,-1],[-1,0],[-1,1],[-2,0],[-1,-1],[0,-2],[-2,-5],[-1,-2],[-2,-1],[-1,1],[-1,1],[-2,5],[-1,1],[-1,-1],[-2,0],[-1,-1],[-2,0],[-4,0],[-1,1],[-1,1],[-2,3],[-1,1],[-1,0],[-1,0],[-1,1],[-2,1],[-4,1],[-1,1],[-2,3],[-3,3],[0,2],[2,0],[-2,3],[-1,2],[-2,1],[-3,0],[2,3],[1,0],[3,-1],[2,0],[1,1],[2,10],[1,0],[1,1],[1,0],[2,1],[1,0],[4,7],[1,3],[3,14],[3,10],[7,13],[0,2],[2,7],[0,1],[1,1],[-1,1],[0,1],[-1,1],[1,2],[0,1],[1,3],[0,1],[1,4],[0,2],[-1,0],[-1,2],[0,2],[1,1],[0,1],[0,2],[0,3],[-1,0],[0,1],[0,1],[0,1],[1,0],[0,3],[0,3],[-1,2],[-2,0],[2,7],[1,3],[3,6],[2,5],[3,4],[1,2],[0,3],[1,2],[0,2],[3,5],[1,6],[0,10],[1,6],[1,3],[0,2],[-1,2],[-1,2],[-1,1],[-1,-1],[-1,0],[-1,0],[-2,5],[-1,10],[-1,2],[-2,4],[-1,1],[-3,1],[-1,1],[0,1],[-1,1],[-1,3],[-1,2],[0,-1],[0,2],[-2,1],[-2,6],[0,1],[-2,2],[0,1],[-1,5],[-1,1],[-3,5],[0,2],[0,3],[0,2],[1,5],[0,2],[0,3],[-1,1],[-3,1],[-1,2],[-1,2],[0,2],[1,2],[0,3],[0,3],[-1,6],[-2,9],[-2,15],[1,3],[1,5],[1,3],[0,5],[0,2],[-1,5],[-1,3],[1,3],[0,2],[-1,3],[-1,0],[-1,1],[-1,0],[0,2],[0,17],[0,2],[-1,2],[1,1],[2,3],[1,2],[-1,6],[0,2],[1,2],[1,4],[5,9],[0,1],[0,1],[1,1],[1,2],[1,1],[1,5],[0,2],[1,2],[4,6],[7,8],[1,3],[3,2],[3,3],[2,3],[2,4],[2,10],[2,5],[0,2],[1,14],[2,5],[2,4],[0,3],[1,0],[4,-1],[3,-1],[2,-1],[1,-1],[1,0],[0,1],[-2,1],[1,0],[1,0],[3,-2],[2,-3],[1,-1],[2,-2],[2,-1],[9,-7],[3,-2],[3,-3],[2,-1],[1,0],[3,-2],[3,1],[6,-3],[3,-1],[2,0],[1,-1],[2,-3],[1,-2],[2,1],[0,2],[-1,0],[-2,2],[-2,2],[-1,1],[-1,0],[0,1],[1,1],[1,-1],[1,-1],[3,-2],[4,-2],[2,-1],[2,-1],[4,-5],[3,-1],[3,-2],[1,1],[3,-2],[6,-5],[5,-9],[4,-3],[3,-7],[6,-8],[12,-18],[1,-1],[0,-1],[0,-1],[0,-1],[1,1],[1,-1],[2,-1],[7,-10],[1,-5],[0,-5],[1,1],[2,5],[2,1],[2,0],[2,-2],[1,-3],[1,-3],[-2,-4],[-3,-7],[-2,-7],[0,-5],[1,2],[0,1],[1,1],[0,1],[0,4],[1,3],[1,3],[4,3],[1,3],[2,-1],[1,-3],[2,-2],[0,-3],[1,-2],[6,-5],[3,-4],[3,-5],[2,-6],[1,-6],[0,-5],[2,-11],[1,-5],[-1,-7],[-2,-3],[-3,-2],[-2,-5],[5,3],[3,2],[1,3],[0,2],[1,3],[0,3],[0,20],[0,5],[1,4],[2,1],[1,0],[1,0],[2,-1],[4,-6],[0,-2],[0,-2],[2,-5],[1,-3],[0,-3],[0,-4],[1,-3],[2,0],[-1,-1],[0,-1],[0,-1],[-1,0],[0,-1],[1,-2],[1,-2],[1,0],[1,-1],[1,-1],[0,-2],[-1,-1],[-1,-1],[0,-3],[0,-2],[0,-2],[4,-9],[1,-3],[0,-4],[1,-5],[-1,-4],[-1,-9],[-1,-2]],[[9993,37],[2,-1],[3,-2],[1,-2],[0,-2],[0,-3],[-1,-2],[-2,-10],[0,-3],[0,-3],[0,-3],[-1,-2],[-1,-1],[-3,0],[-2,0],[-3,-3],[-2,0],[-2,0],[-1,1],[-1,-1],[-2,0],[-3,0],[-1,1],[-2,1],[-3,3],[-2,1],[-4,2],[-1,1],[-1,2],[0,1],[-1,1],[-1,0],[-2,0],[-1,1],[-1,2],[-2,5],[-1,3],[-1,3],[0,2],[0,2],[-4,8],[-1,3],[0,3],[0,2],[0,3],[1,2],[3,2],[1,2],[0,3],[0,2],[0,1],[0,1],[1,1],[3,0],[2,3],[4,3],[4,0],[2,0],[2,-1],[1,-1],[1,1],[1,-1],[4,0],[1,0],[1,-1],[4,-2],[1,-1],[1,-1],[1,-3],[1,-2],[0,-4],[1,-2],[2,-3],[0,-1],[0,-3],[1,-1],[0,-1],[0,-1],[2,-1],[0,-1],[1,-3]],[[9101,1182],[-1,0],[-1,6],[1,2],[1,1],[0,-3],[0,-2],[0,-2],[0,-2]],[[9084,1202],[0,-1],[1,-1],[1,-1],[1,-3],[1,-2],[1,0],[3,0],[2,-1],[1,-1],[1,-2],[0,-2],[-1,-2],[-2,-5],[-1,-1],[1,-1],[0,-2],[2,-1],[-1,-2],[0,-2],[0,-1],[-1,-3],[-2,-2],[0,-3],[1,-4],[0,-1],[-1,-1],[-1,1],[-1,-1],[-1,0],[-1,0],[-1,1],[-1,0],[0,2],[0,1],[-1,1],[-2,-1],[0,1],[2,1],[0,3],[-1,2],[-1,1],[0,1],[1,1],[1,0],[0,-1],[2,-3],[1,-1],[1,1],[0,1],[0,3],[-1,1],[-1,2],[-2,3],[1,1],[0,1],[0,1],[0,2],[-1,4],[0,2],[-1,1],[-1,1],[-1,1],[0,1],[-1,1],[0,2],[0,2],[4,7],[1,-1],[0,-1],[-1,0]],[[15,5137],[-1,-1],[0,1],[0,2],[1,0],[0,-1],[0,-1]],[[18,5141],[0,-1],[-1,0],[0,1],[1,0]],[[18,5138],[-1,0],[1,1],[1,2],[1,0],[0,-1],[-1,-1],[-1,-1]],[[47,5141],[-3,-1],[-2,0],[-1,4],[0,1],[-1,1],[0,1],[0,1],[0,1],[1,1],[0,2],[1,2],[1,3],[2,1],[2,0],[2,-3],[1,-4],[1,-2],[0,-1],[0,-2],[0,-1],[-1,-1],[-1,-2],[-2,-1]],[[64,5200],[-2,-1],[-2,0],[1,1],[3,5],[3,1],[2,-1],[-5,-5]],[[18,5205],[-1,0],[1,1],[1,0],[-1,-1]],[[16,5196],[1,0],[1,-2],[0,2],[1,1],[1,0],[1,-1],[0,-3],[0,-3],[-2,-1],[0,-1],[0,-7],[1,-5],[0,-7],[0,-7],[-3,-5],[-4,-4],[-4,-3],[0,1],[-1,2],[1,1],[-1,2],[-1,1],[0,1],[-1,1],[-1,2],[0,1],[-1,1],[0,1],[-2,5],[0,11],[-1,5],[1,2],[-1,2],[0,1],[-1,2],[0,2],[0,4],[0,2],[1,1],[1,4],[2,2],[1,0],[1,0],[0,-2],[1,0],[2,-1],[4,-2],[2,-2],[2,-3],[-1,-1]],[[38,5204],[1,-1],[1,1],[0,-1],[1,0],[1,0],[1,0],[1,-1],[2,-2],[0,-1],[1,-1],[5,-5],[1,0],[1,-1],[-1,-1],[-1,0],[-2,1],[-1,0],[-1,1],[-15,-6],[-3,-2],[-1,0],[-2,0],[-2,1],[-1,2],[-2,1],[0,2],[-1,2],[0,1],[1,2],[1,8],[1,1],[1,1],[1,0],[0,1],[0,2],[0,1],[-1,0],[0,1],[-1,0],[-1,1],[0,4],[-1,2],[0,1],[1,2],[1,2],[1,1],[1,1],[2,2],[1,1],[3,-3],[1,-3],[1,-3],[0,-3],[0,-4],[0,-1],[1,-2],[1,-2],[1,-2],[1,-1]],[[5703,9360],[0,-5],[1,-2],[2,0],[1,-1],[1,-1],[0,-1],[0,-1],[1,-2],[1,-1],[0,-1],[2,-1],[1,0],[1,-2],[1,-1],[2,0],[0,-1],[0,-1],[0,-1],[0,-2],[0,-1],[0,-1],[1,0],[2,-1],[1,0],[0,1],[1,0],[2,1],[0,1],[1,1],[1,1],[1,0],[1,0],[0,1],[0,1],[1,1],[1,2],[2,1],[4,-4],[1,-1],[0,-2],[0,-1],[1,-1],[1,-1],[9,0],[2,0],[1,0],[1,1],[3,3],[0,1],[1,0],[0,1],[1,1],[1,0],[0,1],[1,2],[0,1],[3,3],[1,1],[0,1],[4,5]],[[5767,9355],[4,-3],[1,-2],[1,-2],[1,-1],[-2,-4],[-1,-3],[0,-1],[-1,-4],[0,-2],[0,-1],[0,-1],[-2,-1],[-1,0],[-1,1],[0,-1],[-5,-2],[-3,-2],[0,-1],[1,-2],[2,-2],[-1,-2],[0,-1],[-2,-3]],[[5758,9315],[-1,-1],[-2,1],[-1,-1],[-1,-2],[-1,-1],[-1,-1],[-1,0],[0,1],[-1,1],[-2,-2],[0,-6],[1,-11],[0,-5]],[[5748,9288],[0,-5],[-3,-9],[-1,-3],[0,-2],[0,-1],[0,-1],[-1,0],[0,-1],[0,-1],[0,-1],[0,-1],[0,-1],[0,-1],[-1,0],[0,-1],[0,-1],[0,-1],[-1,0],[0,-1],[-1,0],[-1,0],[-1,-1],[-2,-2],[-3,-4],[-2,-2],[-1,0],[-2,1]],[[5728,9249],[-3,7],[-2,2],[-5,6],[-3,4],[-1,6],[0,1],[-4,5],[-2,0],[-1,0],[-1,0],[-1,-1],[-1,-2],[-4,-8],[-1,-1],[-2,-1],[-1,1],[-3,2],[-2,1],[-3,1],[-1,1],[-1,0]],[[5686,9273],[-3,-1],[-2,0],[-5,1],[-1,0],[-3,-2],[-2,0],[0,3],[-1,3],[0,3],[-2,1],[-1,2],[-2,1],[-2,0],[-1,2],[-1,1],[-1,2],[-3,1],[0,1],[-1,1],[1,5],[0,3],[0,3],[0,2],[0,3],[1,4],[1,1],[1,4],[1,1],[0,3]],[[5660,9321],[0,1],[-1,1],[1,0],[0,2],[1,7],[1,0],[4,12],[0,1],[0,1],[0,1],[1,1],[0,1],[1,3],[1,1],[0,1],[1,5],[0,1],[1,2],[0,1],[0,1],[0,1],[1,1],[0,1],[2,0],[1,0],[1,0],[3,-2],[2,0],[1,0],[6,2],[2,0],[1,0],[1,0],[2,-2],[1,-2],[2,-1],[6,-2]],[[5603,9845],[5,-2],[1,-1],[1,1]],[[5610,9843],[1,-3],[-1,-3],[1,-1],[1,-1],[1,-3],[0,-1],[0,-1],[0,-1],[-1,-2],[-1,-2],[-1,-2],[0,-5],[0,-1],[1,-1],[1,-2],[0,-1],[0,-2],[-1,-1],[-3,-3],[-2,-1],[0,-1],[-1,0],[-1,-1],[-1,-1],[-1,-3],[-1,0],[-1,-1],[-2,0],[-1,0],[0,-1],[-1,-1],[0,-1],[1,-2],[0,-2],[1,0],[0,-1],[0,-2],[0,-1],[0,-1],[0,-1],[0,-2],[0,-1],[0,-1],[-2,-1],[0,-2],[0,-1],[0,-1],[2,-3],[0,-1],[-2,-1],[-1,-1],[0,-1],[1,-1],[1,-2]],[[5597,9767],[0,-3],[-1,-1],[0,-1],[-1,-1],[-1,0],[-2,1],[-1,0],[-1,-1],[-1,0],[-1,0],[-2,2],[-1,0],[-1,1],[-2,0],[-1,-1],[-1,-1],[0,-1],[0,-1],[0,-1],[-1,0],[-5,-1],[-7,-2],[-3,-2],[-2,-1],[0,-1],[1,-2],[1,-1],[0,-1],[0,-6],[0,-1],[0,-1],[1,-1],[1,0],[1,0],[0,-1],[1,-1],[1,0],[1,-1],[0,-1],[0,-1],[0,-1],[-1,-1],[-1,-1],[-1,0],[-4,1],[-1,0],[-1,-1],[-1,-1],[0,-1],[0,-1],[0,-1],[0,-1],[1,-1],[-1,-2],[0,-1],[-1,-1],[-1,-1],[-1,-1],[0,-1],[0,-1],[0,-1],[1,0],[0,-1],[3,1],[1,0],[1,-1],[1,0],[0,-1],[0,-1],[0,-1],[-1,-1],[-1,0],[-1,-2],[-1,-2],[-2,-1],[-1,-1],[0,-1],[-1,-1],[0,-1],[-5,-6],[-1,-1],[-1,-2],[-1,-3]],[[5548,9690],[-3,0],[-1,0],[-1,1],[-3,2],[-1,1],[0,1],[0,2],[-1,2],[0,1],[-1,1],[0,-1],[-2,0],[-1,0],[-12,12],[-1,0],[0,2],[0,1],[1,1],[0,1],[0,2],[-1,3],[-1,1],[-1,1],[-5,2]],[[5514,9726],[1,1],[1,1],[1,2],[1,2],[0,2],[-1,2],[-1,1],[-3,1],[-2,0],[-4,-1],[-1,0],[-1,0],[-1,2],[0,3],[2,1],[2,2],[1,2],[0,2],[-1,1],[-4,5],[2,2],[5,1],[2,1],[1,3],[2,7],[1,1],[1,0],[1,-1],[1,0],[1,1],[0,1],[0,2],[0,1],[-1,1],[-1,1],[-1,1],[-1,2],[0,1],[0,2],[1,7],[0,2],[0,2],[-2,3],[0,1],[0,2],[1,7],[0,1],[0,1]],[[5517,9808],[-1,2],[0,5],[0,2],[-1,0],[-2,0],[-1,1],[0,2],[0,1],[2,1],[0,1],[0,2],[0,3],[0,2],[1,1],[1,1],[1,1],[3,8],[3,4],[0,1],[0,1],[-3,5]],[[5520,9852],[6,1],[3,0],[5,-2],[1,1],[1,0],[1,1],[1,0],[1,0],[1,0],[2,-1],[3,-1],[2,0],[1,1],[1,1],[1,0],[1,1],[1,0],[2,2],[1,0],[1,0],[2,-2],[1,0],[2,0],[1,1],[1,1],[2,1],[1,0],[1,0],[4,-1],[9,-1],[0,-1],[1,0],[0,-1],[1,-1],[1,0],[1,0],[1,1],[1,1],[1,0],[2,1],[1,0],[1,-1],[0,-1],[0,-3],[0,-1],[0,-1],[1,0],[7,-3],[1,0],[1,0],[1,0],[1,0]],[[5510,9406],[0,-1],[0,-1],[0,-1],[0,-1],[1,-2],[2,-1],[2,-1],[0,-1],[1,0],[1,1],[1,-1],[2,0],[1,-1],[2,-3],[0,-1],[1,0],[1,0],[4,2],[1,0],[1,0],[3,-1],[1,0],[2,-1],[0,-1],[1,1],[1,1],[1,1],[1,1],[1,0],[2,-1],[1,-2],[0,-1],[1,-1],[0,-1],[0,-1],[0,-1],[1,0],[1,0],[1,0],[4,3],[1,0],[1,1],[0,1],[0,1],[0,1],[1,1],[1,1],[0,1],[0,1],[1,1],[2,0]],[[5560,9399],[2,-4],[0,-1],[1,-2],[1,-2],[1,-1],[1,-1],[1,-1],[0,-2],[2,-2],[1,-1],[0,-1],[0,-2],[0,-4],[0,-1],[0,-1],[1,-1],[1,0],[1,-1],[0,-1],[1,0],[1,0],[0,-1],[1,0],[1,0],[1,0],[1,-2],[2,-1],[0,-1],[1,0],[2,-1],[3,0],[0,-1],[1,0],[2,-1],[0,-1],[0,-1],[0,-1],[0,-1],[1,0],[0,-1],[0,-1],[0,-1],[-1,-4],[0,-1],[0,-1],[1,0],[0,-1],[0,-1],[0,-1],[0,-1],[1,-1],[0,-1],[0,-1],[-1,-1],[-1,-1],[-8,-5]],[[5582,9335],[-5,-2],[-1,0],[0,-1],[-1,0],[0,-1],[-1,-1],[-1,-1],[-1,0],[0,-2],[1,0],[0,-1],[1,0],[0,-1],[0,-2],[0,-1],[0,-1],[0,-2],[0,-1],[0,-3],[0,-2],[0,-1],[1,-4],[0,-2],[1,-4],[0,-1],[0,-1],[0,-1],[1,-1],[-1,-1],[0,-1],[-1,-1],[-2,-1],[-5,-1],[-3,-2]],[[5565,9291],[-2,1],[-4,4],[-2,2],[-6,1],[-3,0],[-2,-2],[0,3],[-2,7],[-9,-4],[-1,2],[-7,2],[-8,-1],[-1,1],[-1,1],[-2,4],[-2,0],[-3,-1],[-2,0],[-2,2],[-3,4],[-2,4],[-1,5],[0,4],[-1,2],[-1,1],[-2,0],[-2,0],[-1,-1],[-1,-2],[-1,-1],[1,-3],[-1,-1],[-1,-1],[-5,3],[-1,1],[0,-1],[0,-2],[0,-2],[-1,-1],[0,-2],[-3,-4],[-3,-2],[-2,0],[-3,1],[-2,1]],[[5470,9316],[-1,2],[-1,3],[-1,2],[0,1],[-1,3],[0,1],[-4,6],[-1,2],[-1,0],[-1,-1],[-1,0],[0,1],[-1,1],[0,1],[0,1],[-1,1],[-3,0],[-1,1],[-1,0],[-1,1],[0,3],[-1,1],[0,2],[-2,2],[-3,5]],[[5444,9355],[2,4],[0,2],[1,1],[1,0],[1,1],[1,1],[1,2],[5,3],[2,0],[1,1],[1,-1],[1,0],[2,1],[4,0],[7,3],[1,0],[0,1],[0,1],[-1,1],[0,1],[-2,2],[0,1],[0,1],[0,1],[0,1],[0,1],[-1,2],[0,1],[0,1],[1,0],[2,0],[1,0],[0,1],[0,2],[0,1],[3,0],[1,1],[3,3],[1,2],[1,0],[0,-1],[1,0],[3,-2],[0,1],[2,1],[0,1],[2,0],[0,-1],[1,0],[1,1],[1,1],[0,1],[1,1],[5,4],[4,1],[2,0],[3,0]],[[5842,9112],[-1,-2],[1,-3],[-1,-1],[-3,-6],[-4,-4],[-1,-1],[0,-5],[2,-4],[3,-3],[2,-2],[-3,-2],[0,-1],[-1,-4],[0,-1],[0,-1],[0,-1],[0,-1],[1,0]],[[5837,9070],[-2,-2],[-3,-1],[-2,-2],[-3,-5],[-2,-3],[-1,-2],[-2,-8],[-1,-5],[2,-4],[2,-3],[1,-4],[0,-5],[3,-2],[3,-2],[3,-7],[5,-5],[2,-3],[-3,-1],[-1,0],[-4,3],[-2,0],[-1,0],[-1,-1],[-2,-3],[-1,-1],[-4,0],[-1,-1],[-1,-1],[0,-1],[0,-1],[0,-2],[1,-2],[0,-1],[0,-1],[-1,0],[-2,-1],[-2,0],[-1,-1]],[[5816,8992],[-2,2],[-1,0],[-2,-1],[-2,-1],[-1,0],[-1,1],[0,1],[-1,0],[-2,-1],[-2,-1],[-2,1],[-2,-1],[-1,-1],[-1,-3],[-1,-3],[-3,0],[-2,1],[-5,6],[-2,1],[-3,-1],[-6,-7],[-6,-3],[-2,-3],[-1,-3],[-1,0],[-1,0],[-2,4],[-1,2],[-1,1],[-2,3],[-1,0],[-2,0],[0,-1],[-1,-1],[-1,-1],[-2,0],[-7,5],[-1,-3],[-1,-1]],[[5741,8984],[-8,11],[-4,3],[-6,-2],[1,3],[3,7],[0,2],[0,2],[-1,2],[-1,1],[-3,0],[-1,1],[-1,1],[0,2],[3,7],[0,2],[0,2],[0,1],[-2,1],[-1,0],[0,8]],[[5720,9038],[3,2],[2,3],[1,1],[1,2],[1,0],[2,-1],[1,0],[1,-1],[0,-1],[0,-1],[1,0],[0,-1],[1,1],[0,1],[0,3],[1,1]],[[5735,9047],[2,0],[8,3],[2,0],[4,-2],[2,-1],[1,2],[-1,1],[-4,5],[-2,2],[0,2],[1,3],[2,0],[5,-4],[0,3],[0,2],[0,1],[-1,1],[0,1],[0,1],[1,2],[1,1],[1,1],[1,5],[1,1],[1,1],[3,2],[2,1],[3,4],[2,1],[1,0],[1,0],[1,0],[1,-1],[1,-3],[1,-1],[2,-1],[2,-5],[2,-1],[2,2],[1,3],[0,3],[-1,4],[3,1],[3,2],[3,6],[6,-8],[3,-3],[4,-1],[8,0],[2,0],[1,4],[2,3],[0,2],[1,3],[0,1],[3,0],[6,8],[7,4],[3,3],[1,1],[2,0]],[[5851,8955],[1,0],[1,-1],[-1,0],[-1,0],[-1,0],[0,1],[1,0]],[[5841,8949],[-3,3],[-1,2],[0,4],[2,3],[1,2],[-1,3],[-1,1],[-1,0],[-1,0],[-2,0],[-1,1],[-5,5],[-1,1],[0,1],[1,3],[-1,2],[-1,4],[0,1],[-3,0],[-4,2],[-2,2],[-1,3]],[[5837,9070],[1,-2],[1,-2],[1,-2],[0,-1],[1,-1],[2,-2],[1,-1],[0,-1],[0,-1],[1,-2],[1,-1],[1,0],[1,0],[1,0],[1,0],[1,0],[5,-3],[3,-1],[9,-7],[2,-1],[2,0],[1,-1],[1,-1],[0,-1],[1,-1],[1,0],[3,0],[15,5],[3,0],[3,3],[3,-1],[-1,-4],[1,-3],[1,-2],[1,-3],[1,0],[0,-3],[-1,-1],[-2,-1],[0,-2],[-1,-1],[-1,-3],[0,-2],[-2,-2],[-5,-5],[-1,-3],[-4,-5],[-1,-3],[0,-3],[2,-7],[-1,-1],[-1,0],[-1,0],[1,-2],[-1,-1],[-1,0],[0,-1],[-1,-1],[-1,0],[-1,1],[-1,1],[-2,0],[-1,-2],[-1,-2],[0,-1],[-1,-1],[-1,-1],[0,-2],[-1,-1],[-1,0],[-1,0],[-2,1],[-2,-1],[-1,-1],[-2,-1],[1,-1],[-2,-3],[-1,0],[0,2],[-2,0],[-1,-1],[-1,0],[-1,-1],[0,-1],[-1,-1],[0,-3],[0,-4],[0,-1],[1,-1],[0,-2],[-1,0],[-1,2],[-1,0],[-2,0],[-1,-1],[-1,-1],[-1,-1],[-1,-1],[0,2],[-2,-1],[-2,1],[-1,-1],[-1,-1],[-2,-1],[0,-2],[1,-1],[0,-1],[-2,-3]],[[5661,9200],[0,-3],[0,-2],[0,-4],[0,-5],[1,-5],[0,-4],[0,-3],[2,-1],[-1,-2],[1,-1],[1,-1],[0,-1],[0,-2],[-1,-2],[0,-2],[1,-3],[2,-5],[1,-2],[0,-2],[-2,-7],[-1,-1],[0,-1],[-2,-2],[0,-1],[-1,-2],[-1,-1],[-1,-1],[-1,-2],[-1,-1],[0,-3],[-1,-3],[1,-2],[1,-4],[1,-2],[-1,-5],[-2,-4],[-2,-3],[-2,-5],[-1,-14],[-1,-1],[-1,-4],[-1,-1],[0,-1],[0,-1],[0,-3],[-1,-9]],[[5648,9066],[0,-6]],[[5648,9060],[-4,1],[-2,1],[-1,1],[0,1],[-1,0],[0,1],[-1,0],[0,1],[-3,1],[-2,1],[-2,-1],[-1,0],[-1,-1],[0,-2],[0,-1],[-1,-1],[0,-1],[-1,0],[-1,0],[-1,2],[-1,0],[0,1],[1,1],[0,1],[-1,1],[0,1],[-1,0],[-3,-1],[-1,0],[-2,-2],[-2,-2],[0,-1],[-1,-1],[-1,-1],[-1,0],[-1,0],[-1,0],[-5,4],[-1,1],[-1,0],[0,1],[-1,1],[-1,0],[-1,-1],[-1,0],[-1,0],[-1,0],[-1,0],[-1,0],[0,1],[-1,4],[0,2],[0,1],[1,1],[0,2],[-1,2],[-1,3],[-2,2]],[[5592,9084],[-3,11],[-1,2],[-1,3],[-2,1],[0,2],[-1,4],[-1,5],[-1,4],[0,1],[-1,0],[0,2],[0,2],[0,4]],[[5581,9125],[2,1],[1,1],[4,7],[1,1],[1,0],[1,1],[1,0],[1,0],[0,1],[1,1],[0,2],[1,0],[0,1],[3,-1],[3,1],[3,0],[1,1],[1,0],[0,1],[2,4],[1,2],[1,1],[0,2],[0,1],[1,1],[1,0],[1,-1],[3,2],[1,0],[1,1],[-1,1],[0,2],[0,1],[0,1],[1,1],[1,1],[2,0],[2,1],[0,1],[0,1],[-1,1],[0,1],[0,1],[1,2],[1,1],[1,1],[0,1],[-1,1],[-1,1],[0,1],[1,1],[1,0],[0,-1],[1,0],[1,-1],[1,-1],[1,0],[0,1],[0,1],[1,2],[0,1],[0,1],[2,4],[0,2],[0,1],[1,1],[0,1],[-2,2]],[[5631,9192],[11,0],[1,0],[0,1],[0,1],[0,4],[0,2],[1,2],[2,2],[7,4],[4,1]],[[5657,9209],[1,-1],[0,-3],[1,-1],[1,-2],[1,-2]],[[5710,9795],[0,-2],[-2,-1],[-1,-1],[-4,-4],[-2,-1],[-1,0],[0,1],[-1,1],[-1,1],[-4,-1],[-1,0],[0,1],[-3,2],[-1,1],[-1,-1],[-1,-1],[-1,0],[0,-1],[-1,-1],[0,-1],[0,-1],[0,-1],[0,-2],[-1,-2],[-1,-1],[0,-1],[1,-2],[0,-1],[1,-1],[1,-1],[0,-1],[1,-3],[0,-1],[-1,-1],[-1,-5],[-2,-2],[-2,-4],[-1,-1],[0,-1],[0,-1],[1,-1],[0,-1],[0,-1],[0,-1],[0,-1],[-2,-2],[-4,-4]],[[5675,9743],[-3,3],[-3,0],[-6,-2],[-10,2],[-7,-3],[-1,2],[-2,3],[-2,2],[-2,1],[-9,-2],[-3,1],[-3,5],[-1,0],[-1,0],[-2,0],[-1,1],[-2,2],[-8,7],[-3,1],[-9,1]],[[5610,9843],[6,0],[12,-3],[1,0],[3,0],[11,6],[4,1],[1,0],[1,2],[0,2],[1,5],[0,1],[-1,0],[0,1],[0,1],[1,2],[9,9],[2,1],[1,-2],[1,0],[2,0],[1,-1],[0,-2],[0,-3],[-1,-2],[-1,1],[0,-1],[-2,-3],[0,-1],[0,-2],[0,-1],[-3,-9],[0,-2],[1,-2],[4,-1],[1,-3],[0,-2],[0,-1],[0,-1],[-1,-2],[0,-1],[-1,-1],[0,-1],[1,-1],[0,-1],[0,-5],[1,-2],[2,0],[2,0],[4,2],[1,0],[1,0],[1,-1],[3,-3],[2,-1],[3,-1],[1,-1],[4,-6],[1,-1],[1,-1],[2,-1],[4,1],[2,0],[2,-2],[1,-2],[1,-2],[-1,-1],[0,-2],[0,-1],[2,-1],[1,1],[0,1],[1,0],[1,0],[3,-1],[0,-1]],[[5397,8920],[-1,-3],[0,-1],[1,-3],[1,-2],[0,-2],[0,-1],[1,0],[1,-1],[1,-2],[1,-1],[1,0],[5,-2],[2,-1],[2,-1],[1,-1],[3,0],[0,-1],[1,-1],[1,-1],[0,-1],[1,-1],[0,-2],[-1,0],[0,-1],[-1,-1],[0,-1],[1,0],[1,-2],[1,-1],[0,-1],[0,-2],[1,-3],[0,-2],[0,-1],[-1,0],[-2,-1],[-1,-1],[0,-1],[1,-1],[1,-1],[1,-1],[0,-1],[1,-4],[0,-1],[-1,-1],[-4,-2],[-1,0],[-1,0],[-1,0],[-1,-1],[0,-1],[-1,-1],[0,-1],[0,-1],[0,-1],[1,0],[1,0],[1,-1],[0,-1],[1,-1],[0,-1],[0,-1],[0,-2],[1,-1],[2,-2],[1,0],[1,0],[1,0],[6,2],[1,0],[1,-1],[1,-1],[1,-2],[0,-1],[1,0],[2,-1],[0,-1],[1,-1],[1,-1],[0,-1],[0,-1]],[[5436,8837],[0,-1],[-1,0],[-5,1],[-7,-2],[-1,0],[-2,-1],[-1,-2],[0,-1],[0,-1],[0,-1],[0,-2],[-1,-1],[0,-1],[-1,-1],[-1,0],[-1,-1],[-3,2],[-1,0],[-2,0],[-6,-1],[-1,-1]],[[5402,8823],[-1,2],[-2,0],[-1,1],[0,3],[-9,1],[-1,1],[-5,4],[-1,-1],[-3,-1],[-2,0],[-2,-5],[-1,-1],[-2,2],[-1,5],[-2,2],[-1,4],[-1,0],[-1,0],[0,1],[0,2],[-2,0],[-10,0],[-3,-1],[-1,0],[-2,2],[0,2],[-1,2],[-1,2],[-1,1],[-2,1],[-7,1],[-1,0],[-1,1],[-1,1],[-1,-1],[-1,0],[-1,-1],[-1,1],[-1,1],[-1,1],[-2,1]],[[5325,8857],[-2,10],[0,3],[1,1],[1,1],[1,1],[0,1],[0,2],[1,1],[3,0],[3,1],[2,2],[1,2],[1,2],[-1,7],[0,3],[1,2],[1,1],[1,0],[1,1],[1,1],[1,3],[1,1],[2,0],[2,1],[1,0],[1,0],[4,-3],[2,-2],[0,-2],[1,-2],[2,0],[4,5],[-2,2],[-4,3],[0,1],[1,2],[2,1],[4,0],[4,2],[2,2],[1,2],[-2,2],[-4,2],[-1,2],[0,3],[2,2],[2,-1],[2,-1],[4,-5],[0,-1],[-1,-3],[0,-1],[3,-2],[2,0],[2,2],[1,3],[0,2],[-1,1],[0,2],[0,1],[2,1],[3,-4],[2,-1],[2,1],[1,0],[1,-1],[0,-2],[1,0],[1,0],[1,2],[1,2],[3,-1]],[[5649,9646],[0,-2],[0,-1],[-1,-2],[-2,-3],[0,-1],[1,-2],[3,-2],[3,-5],[3,-2],[2,-4],[4,-2],[0,-1],[0,-1],[0,-1],[0,-1],[0,-1],[1,-1],[1,0],[0,-1],[1,-13],[0,-1],[0,-1],[-1,-2],[0,-3],[-1,-3],[-1,-2],[-1,-1],[-5,2],[-1,0],[-1,-1],[-2,-1],[-1,-3],[2,-5],[-2,-3]],[[5651,9576],[-2,-2],[-1,0],[-1,0],[-3,1],[-1,0],[-1,-1],[-2,-1],[0,-2],[0,-1],[0,-1],[-1,0],[-1,-1],[-18,-3],[-3,-3]],[[5617,9562],[-1,0],[-1,1],[-1,1],[-2,2],[-1,3],[-1,0],[0,-1],[0,-1],[0,-1],[0,-1],[-1,0],[-1,1],[-1,0],[-1,1],[-1,-1],[-1,-1],[0,-1],[-1,0],[-1,0],[-2,0],[-1,0],[-1,0],[-1,0],[-1,-1],[-1,-1],[-1,0],[-2,1],[-1,0],[-3,0],[-2,0],[-1,1],[-1,1],[0,1],[0,1],[0,3],[-1,1],[-1,0],[-1,0],[-1,0],[-2,1],[0,1],[0,1],[1,0],[1,0],[0,1],[0,1],[-6,11],[-2,2],[-1,2],[0,1],[-1,1],[0,1],[-1,1],[-1,0],[-1,0],[0,-1],[-1,-1],[-1,0],[-1,0],[-2,1],[-2,2],[-4,2],[1,1],[0,1],[1,1],[1,1],[0,1],[0,1],[0,2],[0,1],[0,1],[-1,2],[-1,2],[-6,8],[-1,1],[-1,1],[-3,2],[-1,0],[-2,0],[0,1],[-1,2],[0,1],[-1,2]],[[5541,9630],[-1,1],[1,2],[0,1],[0,1],[0,1],[-1,2],[1,1],[2,2],[0,1],[-1,2],[-1,1],[1,0],[0,1],[1,0],[1,0],[1,1],[1,0],[1,2],[1,3],[1,2],[4,4]],[[5553,9658],[2,0],[3,-5],[2,0],[1,-4],[0,-1],[2,1],[2,0],[1,0],[1,1],[1,1],[1,0],[0,-1],[1,-2],[1,-1],[3,-1],[4,0],[1,-1],[1,4],[0,1],[1,2],[2,1],[10,11],[1,0],[1,0],[2,1],[2,4],[1,0],[2,0],[7,2],[9,-1],[1,0],[1,-1],[0,-1],[0,-2],[0,-3],[-1,-4],[0,-1],[1,-1],[17,-11],[1,0],[3,2],[2,1],[6,-3]],[[5470,8941],[2,-1],[-2,-3],[-1,-3],[1,-3],[2,-3],[2,-3],[2,-1],[2,0],[2,4],[1,-3],[1,-2],[0,-2],[2,-1],[2,-1],[7,8],[1,4],[0,3],[1,2],[1,0],[1,0],[3,-9],[1,0],[2,-1],[4,1],[0,-3],[1,-2],[1,-1],[2,0],[1,0],[3,-2],[1,-1],[4,0],[3,-1],[2,-2],[3,-2]],[[5528,8913],[-2,-2],[0,-1],[-1,-1],[-1,-2],[-2,-1],[-1,-2],[-1,-2],[-1,-2],[-2,-2],[-1,-3],[-1,-2],[-1,-3],[-1,-3],[-1,-3],[0,-2],[-1,-4],[-1,-3],[1,-1],[1,-1],[0,-3],[-1,-8],[0,-2]],[[5511,8860],[-13,9],[-2,2],[-1,0],[-6,-3],[-2,-2],[-2,-4],[-1,-1],[-2,-1],[-28,2],[-3,-1],[-1,-3],[2,-10],[0,-2],[-1,-2],[-2,-1],[-1,-1],[-2,1],[-1,0],[-5,-6],[-2,-2],[-2,2]],[[5397,8920],[0,2],[0,1],[2,2],[0,1],[0,1],[1,1],[2,1],[3,0],[1,1],[0,1],[0,1],[0,1],[-1,1],[1,1],[0,1],[1,1],[0,1],[1,1],[0,1],[1,1],[2,0],[0,-1],[0,-1],[0,-1],[1,0],[0,-1],[1,0],[1,1],[1,1],[3,1],[7,1]],[[5425,8941],[2,-3],[1,-1],[1,0],[1,0],[1,0],[1,0],[3,1],[1,0],[1,0],[2,-2],[1,0],[1,1],[1,1],[0,1],[-1,1],[0,1],[1,1],[0,1],[1,1],[1,0],[2,-1],[7,-1],[8,0],[9,-1]],[[5505,9110],[8,-11],[1,-4],[0,-1],[0,-1],[0,-1],[0,-1],[0,-3],[1,-1],[0,-1],[4,-5],[0,-1],[0,-1],[0,-1],[0,-1],[0,-1],[0,-1],[-1,-1],[0,-1],[0,-1],[0,-1],[0,-2],[0,-2],[1,-2],[1,-1],[-1,-1],[-1,-4],[0,-1],[0,-1],[2,0],[1,-2],[3,-2],[1,0],[1,-1],[0,-1],[1,-1],[0,-1],[0,-1],[1,-1],[6,1],[2,0],[1,0],[1,-1],[0,-1],[1,-2]],[[5539,9044],[-3,-2],[-1,-3],[0,-1],[0,-1],[0,-2],[-1,0],[-2,-1],[-1,-1],[0,-1],[1,-1],[1,-1],[1,0],[1,1],[1,-1],[0,-1],[1,0],[1,0],[1,0],[1,-1],[1,0],[1,-2],[2,-1],[0,-1],[1,-1],[0,-1],[0,-1],[-3,-3],[-1,-2],[-1,0],[-1,-2],[-1,-1],[-1,-1],[-1,-4]],[[5536,9008],[-2,-2],[-4,-1],[-1,0],[-1,-2],[-1,-1],[0,-1],[0,-1],[0,-1],[-1,-2],[-1,-1],[-1,-1],[-1,0],[-1,0],[-2,1],[-2,0],[-1,0],[-1,0],[-1,0],[-2,0],[-1,0],[0,-1],[-1,-1],[0,-2],[0,-1],[0,-1],[1,0],[0,-1],[0,-1],[0,-1],[0,-1],[0,-1],[0,-2],[0,-1],[-1,-2],[0,-1],[-1,-1],[-1,0],[-1,0],[0,1],[-1,0],[-1,1],[-2,-1],[-3,0]],[[5501,8979],[-1,4],[-1,2],[-8,2],[-3,-3],[-3,0],[-3,0],[-3,3],[-5,6],[-2,4],[-2,6],[-1,7],[-1,1],[-2,2],[0,1],[0,2],[0,2],[-3,8],[-2,1],[-3,1],[-1,1],[-1,4],[-2,2],[-3,2],[-3,1],[-2,2],[-1,1],[-3,0],[-1,1],[-2,2],[-4,3],[-2,1],[-2,0],[-7,-6],[-3,0],[-1,2]],[[5420,9044],[0,1],[-5,2],[-1,3],[1,3],[4,2],[1,4],[-7,1],[-2,1],[0,2],[0,2],[0,1],[1,2]],[[5412,9068],[2,1],[0,2],[-2,4],[-2,3],[-2,10],[5,3],[3,2],[5,5],[3,2],[2,1],[1,1],[7,-1],[3,1],[2,2],[0,3]],[[5439,9107],[1,3],[2,1],[6,2],[1,0],[1,-1],[1,-1],[1,0],[1,1],[1,0],[1,0],[3,0],[3,0],[1,1],[1,1],[1,2],[3,3],[0,1],[0,1],[1,1],[0,2],[0,1],[1,3],[2,3],[1,1],[0,1],[0,1],[0,1],[1,1],[11,14],[1,-1],[1,-1],[1,-2],[0,-1],[1,-1],[0,-1],[0,-1],[0,-1],[0,-1],[1,0],[2,1],[1,0],[0,-1],[1,0],[1,-2],[1,-2],[1,-1],[0,-3],[1,-1],[0,-1],[1,0],[2,-1],[1,-1],[0,-1],[-1,0],[-1,-1],[0,-1],[1,-1],[0,-1],[0,-1],[0,-3],[0,-1],[1,-2],[0,-2],[1,0],[0,-1],[3,-3]],[[5902,9716],[1,0],[1,1],[1,0],[1,0],[2,-1],[1,0],[1,0],[2,1],[1,1],[7,-3],[5,1],[1,0],[14,-8],[8,-2],[1,-1],[-2,-2],[-2,-5],[-4,-12],[-1,-2],[-1,0],[-3,-2],[-1,0],[0,-1],[-1,0],[0,-2],[-1,-1],[-3,0],[-1,-1],[0,-1],[0,-2],[-1,-2],[0,-1],[-2,-1],[-1,-1],[-2,-3],[-1,-1],[-2,0],[-1,-1],[-3,-6],[-1,-5],[0,-5],[1,-2],[0,-1],[-2,-2],[-1,-1],[0,-2],[-1,-2],[0,-2],[-1,0],[0,-2],[-1,-1],[0,-4],[0,-2],[0,-1],[0,-2],[1,-2],[0,-2],[-1,-2],[-2,-1],[-1,-1],[-1,-3],[0,-3],[-1,-2],[-1,-2],[-5,-8],[0,-2],[-1,-2],[0,-1],[-1,-1],[0,-1],[-1,-1]],[[5896,9590],[-3,0],[-1,1],[-1,3],[-2,0],[-1,0],[-1,1],[0,2],[0,2],[0,1],[0,2],[-14,7],[-1,4],[-3,1],[-4,1]],[[5865,9615],[0,1],[-1,1],[-1,2],[-1,0],[-3,0],[-1,0],[-1,1],[-1,0],[0,1],[0,1],[0,1],[1,2],[0,1],[0,2],[1,7],[0,5],[0,1],[1,0],[1,1],[-1,1],[-4,2]],[[5855,9645],[0,1],[8,1],[1,0],[1,2],[4,2],[0,1],[1,2],[1,1],[0,4],[1,3],[1,1],[-1,1],[-1,1],[-1,0],[0,1],[-1,0],[0,1],[1,2],[2,2],[2,4],[0,1],[0,1],[0,1],[-1,1],[0,1],[-5,6],[-1,0],[-1,1],[-1,0],[0,1],[0,1],[0,1],[-1,1],[-1,-1],[0,-1],[0,-1],[0,-1],[-1,-1],[-1,0],[-1,0],[-1,-1],[-1,-2],[0,-1],[-1,0],[-1,0],[-1,1],[0,2],[-1,1],[-1,1],[0,1],[1,1],[1,2],[0,1],[-2,0],[-5,3],[-1,1],[-1,0],[0,1],[-1,1],[0,1],[0,1],[0,1],[1,1],[0,1],[1,1],[3,3],[1,1],[0,1],[0,1],[0,1],[1,2],[2,2],[0,1],[0,1],[0,1],[0,1],[0,1],[1,0],[2,-1],[0,-1],[1,-4],[1,-1],[0,-1],[1,0],[4,-1],[3,-2],[3,-1],[1,0],[1,-1],[0,-1],[1,-1],[0,-1],[1,0],[2,-1],[3,0],[9,2],[1,0],[1,-1],[3,-1],[0,-1],[1,0],[1,1],[1,0],[0,1],[1,2],[2,4],[3,6]],[[5741,8984],[2,-1],[2,-4],[1,-1],[-2,-4],[-7,-2],[-2,-5],[0,-3],[1,-2],[2,-1],[1,-2],[0,-2],[-2,-5],[0,-2],[1,-1],[5,-9],[-2,-1],[-4,0],[-2,-1],[1,-4],[1,-2],[-1,-1],[0,-1],[-1,-1],[0,-2],[1,-1],[2,0],[3,-2],[1,-3],[-2,-2],[-2,-2],[-2,-2],[-1,-2],[-1,-5]],[[5734,8908],[-1,1],[-2,0],[-1,-2],[-1,-2],[-2,1],[-1,0],[-1,2],[-1,2],[-1,2],[-1,0],[-1,0],[-1,-1],[-4,1],[-2,0],[-2,0],[-1,0],[-3,0],[-2,1],[1,2],[0,2],[1,1],[0,2],[-1,2],[0,1],[0,1],[-1,5],[-4,3],[-5,-4],[-6,0],[-3,0],[-5,0],[-3,1],[-2,3],[-1,4],[2,3],[3,2],[7,0],[3,1],[1,2],[2,2],[1,3],[0,3],[-3,-1],[-2,-1],[-2,0],[-2,2],[-1,3],[0,1],[0,1],[-2,0],[-2,0],[-1,1],[-1,2],[-1,0],[0,-1],[-1,-2],[0,-2],[0,-1],[0,-2],[1,-1],[1,-1],[1,-1],[1,-4],[-1,-3],[-2,-2],[-2,0],[-1,1],[-5,3],[-2,-1],[-1,-1],[-2,-1],[-1,-1],[-1,-2],[1,0],[1,-3],[0,-2],[3,1],[-2,-3],[-2,-1],[-1,2],[-1,4],[-4,2],[-3,3],[-1,4],[0,8],[0,2],[0,2],[-1,3],[-1,2],[-2,1],[0,-1],[3,-5],[0,-1],[0,-10],[1,-5],[2,-3],[3,-2],[2,-2],[0,-3],[-3,0],[-10,0],[-7,2],[-2,1],[0,2],[2,3],[0,1],[-1,2],[-2,2],[-3,2],[-9,-1],[-16,1]],[[5611,8946],[1,2],[1,2],[0,1],[0,1],[1,0],[1,1],[1,1],[2,1],[1,0],[2,1],[3,4],[2,1],[1,0],[0,1],[0,1],[1,1],[2,0],[1,1],[0,2],[0,1],[-1,0],[-1,0],[0,1],[0,1],[0,2],[1,1],[0,1],[0,1],[3,4],[1,1],[3,1],[1,0],[3,-1],[1,-1],[1,0],[1,0],[0,1],[0,2],[1,1],[-1,0],[0,1],[0,1],[2,4],[1,4],[0,1],[0,1],[0,1],[0,3],[0,1],[-1,2],[0,1],[1,1],[1,1],[3,1],[3,4],[1,0],[3,2]],[[5658,9012],[11,-5],[5,-4],[9,-10],[1,-1],[9,-6],[6,0],[4,-1],[2,0],[1,0],[1,-1],[2,-3],[2,-1],[1,-1],[10,-4],[5,0],[3,2],[2,2],[5,1],[3,2],[1,2]],[[5288,9703],[-2,3],[-2,0],[-3,-2],[-1,-1],[-2,1],[-1,1],[-1,2],[-1,0],[-1,-1],[-1,-2],[-1,-1],[-1,0],[-3,0],[0,-1],[-2,-1],[-1,0],[-1,3],[-1,0],[-2,0],[-4,-7],[-17,-10],[-14,4],[-2,0],[0,-1],[0,-1],[0,-1],[-1,-1],[-1,0],[-1,2],[-3,3],[-1,1],[-2,0],[-5,-2],[-10,-3],[-2,0],[-3,1],[-1,0],[-1,0],[-1,-1],[0,-1],[0,-1],[1,0],[0,-1],[-1,-2],[-6,-1],[-1,-1],[-3,-4],[-1,0]],[[5181,9677],[-5,3],[-5,1],[-4,-1],[-4,0],[-4,2],[-1,3],[-3,1],[0,2],[1,2],[3,3],[3,2],[1,1],[1,1],[0,1],[-1,1],[-1,2],[0,2],[0,1],[2,1],[3,-1],[1,0],[3,3],[5,6],[3,2],[-1,2],[-1,9],[0,1],[-3,5],[0,1],[0,2],[1,3],[0,1],[0,1],[-1,0],[-5,-2],[-3,0],[-9,11],[-2,3],[1,2],[1,2],[0,3]],[[5157,9759],[1,0],[0,1],[-1,1],[1,2],[1,2],[2,1],[11,-1],[10,-4],[15,-1],[3,-1],[2,0],[4,1],[2,0],[3,-2],[6,0],[2,0],[2,-2],[4,-1],[8,-5],[3,2],[13,3],[4,2],[2,2],[2,1],[1,1],[2,3],[6,4],[10,3],[1,0]],[[5277,9771],[0,-1],[1,-5],[0,-4],[0,-2],[0,-1],[0,-3],[0,-1],[1,-2],[1,-1],[0,-1],[2,0],[1,0],[1,-1],[0,-1],[0,-1],[-1,-1],[-1,0],[-1,0],[0,-1],[0,-1],[0,-1],[0,-1],[1,-1],[1,-1],[1,0],[1,-2],[1,-4],[0,-2],[2,-2],[0,-1],[0,-1],[-1,-1],[0,-1],[0,-2],[0,-1],[0,-1],[0,-1],[-1,0],[-1,0],[-1,0],[0,-1],[0,-1],[0,-1],[1,-1],[0,-1],[3,-2],[0,-1],[1,-1],[0,-1],[0,-1],[-1,-2],[0,-2],[0,-1],[0,-1],[0,-1]],[[5516,9208],[0,-2],[1,-3],[0,-5],[4,1],[2,-1],[3,-1],[0,-1],[1,-5],[1,-2],[1,-2],[1,-2],[0,-5],[0,-2],[2,-2],[0,-1],[2,0],[1,-1],[0,-2],[-1,-1],[-1,-1],[-1,-1],[0,-3],[0,-2],[5,-6],[1,-2],[0,-3]],[[5538,9153],[-1,0],[-1,-1],[-4,-3],[-1,0],[-1,-1],[0,1],[-1,0],[-1,-1],[-5,-5],[-2,-2],[-1,0],[0,1],[-2,2],[0,1],[-1,-1],[-1,0],[0,-1],[-1,-4],[0,-3],[-1,-1],[-2,0],[0,-2],[-1,-3],[-1,-6],[-1,-4],[0,-1],[-2,-3],[0,-2],[-2,-4]],[[5439,9107],[-2,1],[0,1],[0,2],[-1,4],[-1,1],[-1,1],[-1,0],[0,1],[1,2],[2,8],[-1,1],[0,2],[-1,3],[-4,6],[-1,2],[0,3],[-1,8],[-1,3]],[[5427,9156],[2,1],[3,0],[1,0],[0,1],[0,1],[0,1],[-2,4],[0,1],[0,1],[1,1],[3,3],[1,1],[0,1],[1,2],[0,1],[1,2],[2,4],[0,2],[0,1],[-1,1],[0,1],[-1,1],[0,1],[0,1],[1,1],[3,3],[1,3],[0,1],[2,1],[2,1],[3,6],[1,0],[1,1],[0,2],[1,2],[0,1],[0,1],[0,1],[0,1],[-1,0],[0,1],[0,1],[2,0],[1,0],[1,0],[0,-1],[2,-1],[2,-1],[2,0],[1,0],[1,1],[0,3],[2,8]],[[5466,9225],[2,0],[4,-3],[5,-2],[2,-1],[3,-7],[4,0],[7,2],[6,-4],[1,-2],[1,-4],[2,-2],[4,-3],[3,1],[6,8]],[[5320,9315],[1,-3],[0,-1],[0,-1],[0,-2],[0,-1],[0,-1],[0,-1],[0,-1],[3,-4],[1,-1],[2,1],[1,-1],[0,-1],[3,-5],[0,-1],[-1,-1],[-1,-1],[-1,-1],[-1,-1],[-1,-1],[-1,0],[-1,0],[-2,0],[-1,-1],[0,-1],[0,-2],[0,-1],[-1,-1],[0,-2],[0,-1],[0,-5],[-1,-2],[0,-1],[-1,-1],[0,-1],[-2,0],[-1,1],[-1,1],[-1,0],[-1,-1],[0,-2],[-1,-1],[-1,-1],[-1,-2],[-1,0],[-2,-6]],[[5306,9257],[-3,-3],[-1,-2],[-2,-4],[-1,0],[-1,-1],[0,1],[-1,-1],[-1,0],[0,-1],[0,-1],[0,-3],[0,-1],[-1,-2],[0,-2],[-1,-1],[-2,-3],[-2,-5],[-1,-2],[-1,0],[-1,0],[-2,-1],[-8,-7],[-1,-1],[-1,-1],[0,-1],[-1,-6],[0,-1],[0,-2],[0,-4],[0,-1],[-1,-2],[-1,-1],[-1,-1],[-1,-1],[-3,-1],[0,-1],[-1,0],[0,-1],[0,-2],[-1,-1],[-1,-1],[-1,0],[0,-1],[-1,1],[-1,0],[-1,1],[-1,0],[-1,-1],[-6,-4]],[[5252,9185],[0,5],[-3,2],[-7,1],[1,6],[-3,0],[-6,4],[-3,-1],[-2,-1],[-1,1],[0,1],[0,2],[0,1],[0,1],[0,2],[-2,2],[3,3],[1,2],[1,3],[-2,5],[1,1],[1,3],[-6,5],[0,1],[1,2],[1,1],[-8,7],[-3,1],[0,1],[1,5],[0,8],[0,2],[-4,0],[1,3],[1,2],[2,1],[5,0],[7,3],[2,-1],[2,-2],[2,-1],[2,2],[3,3],[1,3],[1,2],[-1,2],[-2,8],[0,1],[2,0],[3,1],[1,2],[-2,3]],[[5243,9293],[2,0],[2,2],[1,1],[1,3],[2,5],[4,4],[5,3],[4,0],[1,0],[1,-2],[1,0],[2,1]],[[5269,9310],[2,-1],[4,-3],[1,0],[10,0],[4,-2],[1,1],[1,3],[-2,2],[1,3],[0,1],[1,1],[2,0],[1,0],[0,-1],[1,-1],[3,-4],[4,-1],[4,2],[3,3],[1,2],[1,1],[1,0],[7,-1]],[[5143,9297],[1,0],[1,0],[1,0],[1,-1],[1,-2],[-1,-1],[0,-2],[1,-1],[0,-1],[0,-1],[1,-1],[2,-2],[1,-1],[0,-1],[-1,-6],[0,-4],[-2,-2],[-1,1],[-1,5],[-1,2],[-1,2],[-5,6],[-2,1],[-2,3],[-1,3],[0,1],[0,1],[0,3],[-2,5],[2,0],[3,-2],[3,-2],[2,-3]],[[5127,9331],[0,-1],[-2,1],[-1,0],[1,-3],[3,0],[2,1],[2,1],[0,-1],[-1,0],[0,-1],[1,-1],[9,-2],[2,-1],[1,-2],[1,-3],[-1,0],[-1,-1],[0,1],[-1,0],[-3,1],[-9,6],[-4,-1],[-2,1],[-3,4],[-1,1],[0,1],[5,1],[1,0],[1,-1],[0,-1]],[[5188,9339],[1,-3],[0,-2],[0,-1],[-1,-2],[3,-2],[7,-11],[2,-1],[2,-1],[3,0],[2,-1],[2,-2],[1,-2],[4,1],[2,-1],[5,-3],[5,-1],[4,-1],[7,-6],[4,-6],[2,-1]],[[5252,9185],[-1,-2],[0,-1],[1,-1],[0,-1],[0,-1],[-1,-1],[-2,-2]],[[5249,9176],[-2,-2],[-2,1],[-2,0],[-3,-2],[-2,0],[-1,0],[-4,2],[-1,0],[-1,1],[-2,2],[-1,1],[-1,1],[-1,0],[-3,2],[-1,0],[-2,-1],[-1,1],[-1,1],[-1,2],[0,1],[-1,1],[0,1],[0,1],[0,1],[0,2],[0,1],[0,2],[-1,1],[-3,2],[-1,1],[-1,0],[-1,0],[-1,0],[-2,0],[-1,1],[-1,1],[0,3],[0,1],[-1,1],[-1,1],[-1,-1],[-1,-1],[0,-1],[-1,-1],[-1,0],[-3,1],[-3,-1]],[[5192,9203],[-1,6],[-3,8],[-2,4],[-2,4],[-3,5],[-13,10],[0,1],[0,2],[-1,1],[-2,1],[-5,5],[-3,1],[-1,1],[-2,1],[-1,1],[-1,2],[-1,1],[-3,-1],[-2,1],[2,10],[0,1],[5,2],[2,0],[5,-7],[1,-1],[1,-1],[6,-3],[-2,2],[-7,7],[-3,3],[0,2],[0,1],[-1,2],[0,2],[-1,2],[1,0],[1,1],[0,1],[1,1],[1,1],[1,0],[1,1],[0,-1],[1,1],[0,1],[0,2],[0,1],[-1,1],[-1,1],[1,1],[1,1],[-1,1],[-1,2],[-1,4],[1,-1],[2,0],[1,1],[1,2],[0,1],[0,1],[-1,1],[-2,1],[0,1],[0,1],[-1,2],[0,1],[0,1],[-2,1],[-1,1],[0,1],[1,1],[-2,1],[-1,1],[0,1],[0,1],[-2,-1],[0,1],[-1,0],[-1,0],[-1,1],[0,1],[1,1],[1,2],[0,3],[1,2],[6,4],[0,1],[0,2],[0,1],[0,2],[-1,1]],[[5157,9340],[0,1],[2,2],[0,1],[1,0],[5,2],[2,0],[1,0],[2,1],[1,-1],[0,-1],[-1,-1],[0,-1],[-1,-1],[1,0],[0,-1],[2,0],[1,0],[1,1],[3,0],[0,1],[1,0],[2,0],[2,0],[6,-4]],[[5496,9507],[1,-1],[1,-2],[1,-3],[0,-1],[2,-2],[0,-1],[0,-1],[0,-4],[-1,-1],[0,-1],[0,-1],[-1,0],[0,-1],[-1,-2],[-1,-2],[-1,-1],[0,-1],[0,-1],[1,0],[0,-1],[1,-1],[0,-1],[1,0],[1,-1],[2,-3],[1,-1],[1,-1],[1,0],[0,-1],[0,-1],[1,-5],[0,-1],[1,-1],[1,-4],[1,-4],[0,-1],[1,-2],[0,-1],[0,-1],[0,-2],[0,-2],[0,-1],[0,-1],[1,0],[1,-2],[1,0],[0,-1],[0,-2],[0,-4],[0,-2],[0,-1],[0,-1],[0,-1],[-1,-3],[0,-3],[0,-1],[0,-1],[0,-1],[1,-2],[0,-1],[0,-1],[0,-1],[-1,-1],[-2,-4],[0,-2],[0,-3]],[[5444,9355],[-9,0],[-1,0]],[[5434,9355],[0,2],[1,2],[3,3],[0,1],[1,2],[0,1],[-1,4],[-1,1],[-1,1],[0,1],[-1,1],[2,5],[1,2],[0,2],[0,2],[-1,1],[-2,1],[-1,1],[0,2],[1,1],[-1,2],[0,1],[-1,1],[-4,0],[-1,1],[0,1],[0,2],[0,1],[3,3],[1,1],[-1,2],[-1,1],[-1,0],[0,1],[-1,2],[1,3],[0,2],[1,2],[3,3],[0,2],[-1,1],[-2,2],[-1,2],[0,2],[1,4],[0,2],[-1,2],[-1,1],[-2,2],[0,2],[0,1],[0,2],[1,2],[-1,1],[0,2],[-1,0],[-1,1],[-5,1],[-2,0],[-3,-2],[-2,-1],[-7,3],[-2,1],[4,5],[1,3],[0,4]],[[5408,9465],[2,0],[1,-1],[2,1],[1,1],[0,1],[0,2],[0,1],[1,1],[2,3],[1,0],[4,-2],[4,0],[5,0],[3,2],[1,2],[0,2],[-3,7],[0,2],[0,2],[0,2],[1,1],[1,1],[1,1],[5,-2],[3,0],[1,4],[0,2],[0,2],[-1,1],[-2,3],[-2,6],[-1,1],[-4,0],[-1,1],[0,4],[3,2],[6,3]],[[5442,9521],[3,0],[2,0],[4,-3],[3,-1],[4,2],[2,0],[4,-4],[2,-1],[4,0],[2,-1],[3,-7],[3,-3],[2,-1],[2,0],[1,2],[1,2],[0,1],[2,0],[3,-3],[1,0],[2,0],[3,2],[1,1]],[[5464,9261],[2,-4],[1,-2],[0,-1],[0,-2],[0,-2],[-1,-1],[0,-1],[0,-1],[-1,-1],[-1,0],[-1,-1],[-1,-1],[0,-4],[0,-2],[0,-1],[2,-1],[0,-2],[0,-1],[0,-3],[0,-2],[0,-1],[1,-1],[1,-1]],[[5427,9156],[-5,-1],[-1,0],[-1,0],[-2,-1],[-1,0],[-1,1],[-1,0],[-1,0],[-5,-4],[-4,-1],[-2,0],[-1,0],[-1,1],[-1,1],[-1,1],[-1,0],[-1,1],[0,1],[-1,1],[0,1],[-3,3],[-3,2],[-1,1],[-3,1],[-1,0],[-2,-1],[0,1],[0,1],[-1,0],[-1,0],[-1,-1],[0,-1],[-2,0],[0,-1],[-1,0],[-1,-1]],[[5376,9161],[-1,2],[-1,2],[-1,1],[-1,1],[-1,2],[0,2],[0,1],[0,1],[0,1],[0,1],[0,2],[-1,0],[-5,0],[-1,0],[-1,1],[-1,1],[-1,1],[0,1],[0,1],[0,1],[1,1],[0,1],[0,1],[-1,1],[-1,0],[-1,-1],[-1,1],[-1,1],[1,1],[0,1],[2,2],[1,1],[0,1],[-1,1],[-1,1],[-1,1],[0,1],[0,1],[0,1],[0,1],[0,1],[1,1],[0,1],[1,1],[2,2],[2,2],[1,1],[0,1],[0,1],[-1,0],[-1,0],[-1,0],[-1,0],[-1,1],[0,1],[0,1],[0,1],[1,1],[0,1],[1,1],[-1,1],[-1,0],[-1,0],[0,1]],[[5359,9221],[0,1],[2,3],[2,2],[2,1],[2,0],[2,1],[3,3],[1,2],[2,6],[5,-4],[5,0],[11,10],[5,2],[1,2],[1,1],[1,2],[2,0],[0,-1],[1,-1],[1,0],[1,0],[1,0],[1,0],[3,2],[-1,2]],[[5413,9255],[2,0],[5,1],[1,3],[1,2],[2,2],[1,1],[2,0],[1,0],[0,-1],[2,-2],[1,-1],[6,-1],[10,-7],[1,0],[1,0],[1,1],[1,1],[1,3],[1,0],[6,0],[2,1],[3,3]],[[6039,8653],[-1,1],[1,0],[0,-1]],[[6039,8658],[1,0],[0,-1],[-1,0],[-1,0],[0,1],[1,0]],[[5980,8798],[2,-1],[3,0],[7,-5],[10,-3],[3,1],[1,-1],[1,-5],[0,-2],[9,-8],[2,0],[2,0],[1,-1],[0,-1],[1,-4],[0,-1],[6,-9],[1,-2],[0,-4],[1,-3],[1,-1],[5,1],[-1,-2],[1,-8],[1,-4],[1,-3],[0,-2],[-2,-5],[6,-3],[2,0],[3,3],[2,1],[2,0]],[[6051,8726],[-1,-2],[1,-9],[0,-11],[-1,-1],[-1,0],[0,-2],[-1,-1],[1,0],[0,-2],[0,-2],[-1,-1],[-1,0],[-1,0],[0,-3],[-1,1],[-1,1],[-1,0],[-1,-1],[0,-1],[-1,-1],[0,-1],[1,-1],[3,1],[1,0],[1,-1],[0,-2],[-1,-1],[-1,-2],[-2,0],[-1,-1],[0,-1],[-1,-1],[-2,-1],[1,-1],[0,-1],[0,-1],[-1,-1],[1,0],[1,-1],[-1,-1],[-1,-1],[1,-1],[-1,-1],[-3,-2],[-1,0],[0,-1],[1,-1],[0,-1],[0,-1],[-1,-1],[0,-1],[1,1],[1,1],[1,1],[0,-2],[-1,-2],[0,-2],[-1,-2],[-1,-1],[-2,1],[-2,2],[-1,1],[-3,0],[-2,2],[1,3],[0,1],[1,0],[-1,1],[-2,1],[-1,2],[1,2],[0,1],[-1,-1],[-3,-2],[0,1],[0,1],[-1,-1],[-1,1],[-1,1],[-2,0],[-2,1],[-2,-1],[0,1],[-1,1],[-1,1],[-2,0],[0,1],[0,1],[-1,0],[-1,0],[-1,1],[-1,0],[1,1],[0,1],[-1,0],[0,1],[-1,0],[-1,0],[-1,1],[-1,0],[1,3],[-1,1],[-1,1],[1,1],[0,3],[1,2],[2,-1],[4,3],[1,1],[0,2],[1,1],[1,0],[1,2],[-2,0],[-5,2],[-2,0],[-2,0],[-1,2],[1,2],[-2,0],[-4,-1],[-2,0],[1,1],[-2,0],[0,1],[-1,0],[-1,0],[1,1],[2,1],[1,0],[1,1],[0,2],[0,1],[-1,1],[0,1],[2,0],[2,1],[3,2],[-1,1],[0,1],[-1,0],[-1,1],[3,1],[0,1],[0,1],[-1,1],[0,-1],[1,2],[0,1],[1,1],[0,1],[-1,1],[0,1],[-1,1],[0,1],[-1,0],[-2,0],[-3,-2],[-2,-1],[-3,0],[-2,-1],[-1,-1],[0,2],[1,2],[-1,2],[-2,4],[4,0],[2,1],[1,2],[-1,1],[0,2],[2,1],[2,1],[0,1],[3,1],[0,2],[0,1],[-2,1],[-1,4],[-1,1],[-3,0],[-1,2],[-2,1],[-1,0],[-2,0],[0,2],[0,1],[-1,0],[-1,0],[1,1],[1,1],[0,1],[-2,0],[0,1],[1,0],[0,2],[0,1],[-1,1],[1,1],[-1,1],[-1,1],[-1,0],[1,1],[1,1],[2,0],[1,1],[1,0],[3,1],[1,1],[1,0],[1,1],[0,-1],[0,1],[0,1],[-1,1],[-3,2],[0,1],[-1,0],[0,1],[-1,-1],[-1,0],[0,1],[0,1],[3,2],[-2,2],[-2,-1],[-3,-1],[1,1],[-1,1],[0,1],[0,2],[0,1],[1,0]],[[5709,9519],[3,-2],[1,1],[0,1],[1,1],[1,0],[1,0],[1,-1],[0,-1],[1,0],[0,-1],[-1,-1],[0,-1],[1,-1],[0,-1],[1,-1],[0,-1],[0,-1],[0,-1],[0,-1],[-1,-1],[-1,-1],[-1,-2],[-2,0],[0,-1],[-1,0],[-1,-1],[0,-2],[0,-1],[0,-1],[0,-1],[1,0],[1,0],[0,-1],[1,0],[0,-1],[1,-1],[0,-1],[0,-2],[0,-2],[1,-1],[1,-1],[1,-1],[0,-1],[0,-1],[0,-4],[0,-1],[1,-2],[0,-1],[1,-1]],[[5721,9475],[-2,-8],[0,-4],[-1,-2],[-7,-12],[-1,-2],[0,-1],[-2,0],[-1,-1],[-1,-1],[-2,-1],[-1,0],[0,-1],[0,-1],[0,-1],[0,-1],[0,-1],[0,-1],[0,-1],[0,-1],[-3,-1],[-2,-2]],[[5698,9432],[-1,1],[-2,0],[-4,-3],[-7,0],[-1,0],[-1,2],[-1,0],[-1,0],[-4,-1],[-7,-1],[-10,-5],[-4,-1],[-1,0],[-2,-2],[-1,0],[-1,0],[-1,1],[0,2],[-1,2],[-5,1],[-2,2],[-2,7],[-1,1],[-2,-1],[-1,0],[-6,3],[-1,1],[-2,3],[0,1],[-2,0],[-1,-1],[-1,0],[-1,1],[0,2],[-1,2],[-2,1],[-1,0],[-2,1],[-4,5],[-1,0]],[[5610,9456],[0,3],[1,4],[0,2],[-1,2],[-2,2],[-1,0],[-2,0],[-2,0],[-1,11],[-1,2]],[[5601,9482],[0,4],[-1,1],[-1,0],[-1,4],[0,1],[0,2],[1,1],[2,1],[1,2],[0,7],[1,1],[1,1],[5,11],[2,4],[2,3],[0,2],[1,3],[0,4],[0,2],[6,4],[1,2],[0,2],[-2,7],[-1,1],[-1,0],[-2,0],[-1,-1],[0,4],[1,2],[2,5]],[[5651,9576],[3,-2],[5,-1],[1,-1],[1,-1],[-1,-2],[0,-1],[1,0],[3,-1],[1,-1],[0,-1],[0,-1],[-1,-2],[0,-1],[0,-1],[0,-1],[1,0],[1,0],[1,1],[0,1],[1,0],[4,-7],[2,-3],[2,-4],[0,-1],[0,-1],[-1,-1],[-1,0],[-1,0],[-1,-1],[-1,0],[0,-1],[1,-1],[0,-1],[1,-1],[0,-1],[1,-4],[0,-2],[1,-1],[0,-1],[1,0],[1,0],[1,2],[1,0],[1,0],[1,-1],[1,-3],[1,-1],[1,-1],[1,-1],[1,-1],[1,0],[1,0],[1,1],[1,1],[0,1],[1,1],[1,0],[1,0],[0,-1],[0,-1],[0,-1],[1,-1],[2,-1],[2,-2],[1,0],[0,-1],[1,0],[0,-2],[0,-2],[1,0],[1,0],[2,2],[1,1],[1,0],[0,-1],[1,-1],[1,0],[0,1],[1,1]],[[5086,9647],[2,2],[0,-1],[2,-6],[0,-2],[-1,-2],[-2,-3],[-1,-3],[0,-1],[2,-8],[0,-1],[-1,-1],[-1,0],[-1,-1],[0,-1],[0,-3],[0,-2],[-1,-2],[-3,0],[-2,1],[-3,1],[-2,-2],[-1,-2],[-1,-1],[-4,0],[0,-1],[-1,-1],[-1,-3],[0,-1],[-2,-1],[0,-1],[-1,-4],[-1,-1],[-1,-2],[-2,-1],[-1,-2]],[[5058,9591],[-2,0],[-3,-2],[-1,0],[-1,1],[-1,3],[-1,2],[-1,0],[-2,1],[-7,0],[-1,-1],[-1,-2],[0,-4],[-1,-2],[-1,-2],[-4,-5],[-3,-2],[-2,1],[0,11],[-1,1],[-5,-2],[-2,-3],[-1,0],[-1,1],[-2,4],[-1,1],[-3,0],[-6,4],[-2,1],[-4,-2],[-1,0],[0,1],[-1,3],[0,1],[-2,1],[-5,1],[-2,-1],[-1,-1],[-1,-3],[0,-2],[-2,-1],[-11,-1],[-2,1],[-1,1],[0,1],[-1,0],[-1,0],[-4,-2],[-2,0],[-1,1],[0,1],[0,1],[0,1],[-1,0],[-8,0],[-2,1]],[[4949,9599],[2,1],[-1,4],[1,2],[1,3],[1,3],[-1,1],[-2,5],[0,1],[-1,5],[-1,1],[0,1],[-3,1],[0,2],[0,1],[0,1],[1,0],[2,0],[1,0],[1,1],[0,2],[0,1],[-1,1],[0,1],[-2,0],[-1,1],[0,2],[2,4],[1,2],[0,2],[0,1],[-1,2],[-4,5],[-1,1],[0,2],[0,9]],[[4943,9668],[2,-1],[2,0],[2,1],[-1,3],[-1,2],[1,1],[4,1],[-1,1],[-3,4],[0,2],[1,1],[2,1],[2,4],[0,1],[1,0],[1,-1],[2,0],[3,-2],[1,0],[0,-1],[-1,-1],[2,0],[1,0],[1,1],[1,1],[8,3],[1,1],[1,0],[3,3],[1,0],[0,-2],[0,-3],[0,-2],[-1,-2],[0,-1],[1,1],[0,2],[3,3],[2,2],[1,1],[1,0],[1,2],[1,0],[1,-1],[1,-1],[0,-2],[-1,-1],[0,-1],[2,-1],[-1,-1],[-1,-3],[-1,-2],[-2,-2],[0,-1],[1,0],[3,6],[2,3],[1,-1],[1,1],[1,0],[1,0],[0,-1],[0,-1],[0,-1],[-1,0],[-2,-1],[0,-1],[2,-1],[2,-1],[4,0],[2,-1],[0,-1],[0,-1],[0,-1],[-1,-1],[0,-1],[1,-1],[1,-1],[2,-2],[0,-1],[6,-5],[1,-4],[0,-2],[0,-1],[0,-1],[0,-1],[2,0],[2,-2],[4,-3],[0,-1],[0,-1],[-1,-1],[1,0],[0,-1],[1,-1],[1,-1],[1,-1],[0,1],[0,2],[1,1],[3,0],[1,1],[2,2],[2,3],[1,1],[1,1],[1,0],[6,4],[1,2],[0,1],[-1,0],[-1,1],[3,1],[2,0],[1,-2],[2,1],[3,1],[2,3],[1,2],[1,-1],[0,-1],[1,-1],[1,1],[0,-2],[-1,0],[0,-1],[0,-1],[-1,0],[-2,-3],[2,-1],[1,1],[2,2],[2,1],[0,-1],[1,-3],[0,-1],[1,-1],[0,-1],[1,-1],[0,-2],[1,1],[0,1],[1,1],[0,2],[0,-2],[1,-2],[0,-1],[2,1],[0,1],[-1,0],[-1,1],[1,2],[1,0],[1,0],[2,-1],[-1,1],[-1,1],[0,2],[4,1],[4,1],[0,-1],[2,-4],[0,-1],[0,-1],[1,-1],[1,-1],[0,-1],[-1,-1],[3,-3],[0,-2],[0,-3],[1,1],[2,2],[-1,0]],[[5470,9316],[0,-7],[0,-1],[0,-1],[0,-1],[2,-3],[1,-2],[0,-2],[0,-1],[-1,-1],[1,-1],[-1,-1],[1,-2],[-1,-1],[-1,-2],[-1,0],[0,-2],[-1,-1],[0,-2],[-1,-1],[-1,-1],[0,-1],[-1,-1],[-1,-2],[-1,0],[-2,0],[-1,0],[0,-1],[-1,-1],[-1,-1],[-2,-1],[-1,-2],[0,-1],[0,-1],[2,-2],[0,-1],[1,-1],[0,-2],[0,-1],[1,-1],[1,0],[1,0],[1,-1],[0,-1],[1,0]],[[5413,9255],[-2,2],[1,4],[0,5],[-1,2],[-6,4],[-1,1],[-1,1],[0,2],[-1,1],[-1,0],[-2,0],[-6,-2],[-2,0],[-1,1],[-1,0],[0,2],[1,4],[0,2],[-1,1],[-1,1],[-6,0],[-1,1],[0,3],[2,2],[2,1],[1,3],[-2,1],[-1,3],[0,4],[-1,3],[-3,2],[-1,1],[1,2],[0,2],[0,1],[-1,2],[-1,3],[-2,1],[-4,2],[-1,3],[0,4],[4,10],[0,3],[-2,2]],[[5372,9345],[3,2],[6,7],[1,0],[1,0],[1,-1],[1,0],[2,1],[1,-1],[0,-1],[0,-1],[1,-1],[1,0],[2,0],[0,1],[1,0],[1,1],[1,1],[4,-1],[1,0],[0,1],[1,0],[0,1],[0,1],[0,1],[0,1],[0,1],[1,1],[1,0],[1,0],[2,-3],[1,-1],[1,0],[1,0],[1,2],[1,0],[1,0],[8,0],[1,0],[1,-1],[1,0],[5,0],[3,-2],[3,1]],[[5243,9445],[2,-6],[0,-3],[1,-2],[2,0],[0,-1],[1,-1],[0,-1],[-1,-1],[1,-1],[2,-9],[1,-3],[2,-2],[0,-1],[0,-2],[-1,-1],[-1,0],[-1,0],[-1,-2],[1,-4],[0,-2],[0,-1],[2,-1],[0,-1],[0,-1],[0,-2],[-1,-3],[-1,-3],[-1,-2],[0,-2],[0,-3],[0,-1],[1,0],[0,-1],[2,-1],[1,0],[0,-2],[0,-1],[-3,-7],[-1,-2],[-1,-2],[0,-1],[0,-1],[0,-1],[1,-1],[0,-1],[1,-1],[0,-2],[0,-5],[1,-2],[1,-2],[1,-1],[0,-1],[0,-2],[0,-3],[2,-2],[2,-2],[1,1],[1,2],[2,2],[1,1],[2,-1],[2,-1],[0,-3],[0,-4],[-2,-2],[-3,-5],[0,-2],[-1,-2],[0,-1],[0,-1],[1,-1],[1,-1],[5,-2],[1,-1],[0,-2],[0,-2],[0,-1],[0,-1],[0,-2]],[[5188,9339],[1,0],[1,1],[1,0],[2,2],[1,0],[2,0],[1,0],[1,0],[2,4],[1,0],[1,0],[1,0],[1,0],[1,1],[0,1],[0,1],[-1,1],[-3,3],[-1,0],[-1,0],[-1,2],[0,2],[1,2],[0,1],[0,1],[-1,7],[0,1],[0,1],[1,1],[1,1],[0,1],[0,1],[-1,4],[0,3],[0,1],[-1,1],[-1,1],[0,2],[-1,1],[0,1],[0,1],[0,1],[0,1],[-3,5],[-2,5],[-1,2],[0,1],[1,2],[0,1],[1,1],[-1,0],[0,2],[-2,1],[-5,4],[-1,1],[-1,1],[0,3],[0,3],[-1,1],[-1,2],[-2,1],[-1,1],[-1,3],[-1,2],[-3,2]],[[5172,9435],[0,1],[0,1],[1,0],[1,0],[1,0],[3,-3],[1,0],[1,0],[1,0],[5,1],[2,-1],[5,-1],[5,1],[2,1],[2,1],[3,2],[1,1],[0,1],[-1,2],[0,1],[1,1],[0,1],[2,0],[1,0],[1,0],[2,-1],[1,0],[5,2],[2,1],[9,1],[5,0],[2,1],[1,0],[1,-1],[1,0],[0,-2],[0,-1],[0,-1],[1,0],[2,-1],[1,2]],[[5376,9161],[-2,-2],[-1,-2],[2,-7],[0,-2],[0,-1],[-1,-1],[0,-1],[0,-1],[0,-1],[0,-1],[-1,-1],[-2,-2],[-1,-1],[0,-2],[-1,-2],[-1,-1],[-1,-1],[-1,0],[-1,0],[-1,-2],[-1,-1],[1,-1],[0,-1],[0,-1],[0,-1],[0,-2],[-1,-2],[-1,-1],[-1,-1],[-2,0],[-1,-1],[-1,-1],[-1,-1],[-2,-1],[-1,0],[-1,-1],[-4,-8],[-1,-2],[-2,-2],[-1,-2]],[[5344,9100],[-2,4],[-4,3],[-3,2],[-3,0],[-6,-5],[-2,0],[-2,3],[1,2],[1,3],[-1,2],[-2,2],[-2,0],[-4,-2],[-5,0],[-1,1],[-2,2],[0,1],[-4,0],[-1,-1],[-1,-1],[-1,-2],[-1,-1],[-1,0],[-2,1],[-1,0],[-6,-3],[-2,-1],[-3,2],[-2,4],[-2,5],[-3,5]],[[5277,9126],[-1,2],[-1,2],[-1,5],[2,0],[1,1],[2,1],[0,2],[0,1],[-1,0],[0,1],[-5,1],[-1,1],[0,-2],[-1,-2],[-3,-3],[-1,-1],[-12,2],[-1,0],[-1,2],[-1,1],[-1,0],[4,7],[0,1],[-2,2],[-1,2],[1,1],[0,2],[1,2],[1,1],[0,2],[0,2],[3,6],[-1,2],[-1,4],[-1,2],[-6,0]],[[5306,9257],[2,-2],[2,0],[3,0],[1,0],[2,-2],[2,-3],[0,-1],[0,-1],[-1,-3],[0,-1],[0,-1],[2,-1],[3,-1],[1,0],[1,1],[1,2],[1,0],[1,0],[1,-1],[1,0],[3,1],[3,-1],[2,1],[1,0],[1,-1],[0,-1],[2,-1],[2,-5],[0,-1],[1,-1],[2,0],[3,-1],[1,0],[1,-1],[0,-1],[-1,-1],[-1,-1],[-1,-1],[0,-1],[0,-1],[1,-1],[2,-1],[1,-1],[2,-1],[2,1],[3,-2]],[[5842,9494],[-1,0],[0,-3],[-3,-1],[-1,-2],[-1,-2],[0,-2],[10,1],[1,1],[2,-1],[1,-2],[1,-1],[-1,-2],[-1,0],[-1,0],[0,-1],[-2,-2],[-1,0],[-2,-2],[0,-3],[0,-3],[-6,-5],[-2,-3],[-2,-3],[-5,-5],[-3,-1],[0,-3],[-1,0],[0,-1],[0,-1],[-3,0],[0,-1],[-2,-2],[1,-3],[-1,-3],[-6,-5],[-9,-3],[-4,-3],[-2,-5],[1,-1],[1,-2],[0,-2],[0,-2],[0,-1],[-1,0],[0,-1],[-1,-5],[-1,0],[1,-1],[0,-1],[1,-1],[0,-2],[-1,-1],[0,-1],[-1,-1],[-3,-2],[-2,-3],[-1,0],[-6,-4],[-12,-12],[-1,-2],[0,-1],[2,-2]],[[5774,9374],[-2,1],[-3,2],[-2,3],[0,2],[0,1],[1,1],[2,2],[0,1],[0,1],[-1,2],[0,1],[0,1],[1,1],[8,8],[2,2],[-11,11],[-1,0],[-2,0],[-1,1],[-1,0],[-2,4],[-1,2],[0,5],[0,2],[-1,2],[-1,2],[-1,1],[-3,2],[-7,1],[-2,2],[-1,1],[-1,0],[-1,-2],[-1,0],[-1,1],[0,1],[0,2],[1,1],[1,1],[0,1],[0,2],[0,2],[1,0],[1,2],[1,1],[0,1],[0,1],[0,2],[0,1],[-3,5],[-4,4],[-1,1],[-1,4],[-1,2]],[[5736,9472],[3,-1],[17,11],[1,0],[3,-1],[2,0],[6,3],[2,1],[2,4],[3,0],[1,0],[1,1],[0,1],[1,2],[1,1],[1,0],[1,1],[2,-1],[1,0],[1,2],[3,7],[1,1],[2,1],[7,1],[1,0],[1,0],[2,-2],[0,-1],[1,1],[1,1],[1,0],[4,-2],[1,1],[2,4],[1,1],[2,0],[1,-1],[1,1],[2,2],[3,1],[6,-2],[3,3]],[[5831,9513],[1,-2],[2,0],[2,0],[2,0],[1,-1],[1,-1],[0,-2],[0,-4],[0,-1],[1,-5],[1,-3]],[[5746,9119],[1,-1],[0,-1],[1,-1],[0,-1],[-1,-1],[-1,-1],[-1,-1],[-1,-1],[-2,0],[-2,-1],[-1,0],[-1,-1],[-1,1],[-1,0],[-1,0],[-1,0],[-1,-1],[0,-1],[-1,-2],[0,-1],[-3,-5],[0,-1],[0,-1],[0,-1],[0,-1],[1,-1],[2,-1],[1,-1],[0,-1],[0,-2],[-1,-1],[-3,-3],[-1,0],[-1,0],[-5,2],[-3,1],[-1,0],[-1,-1],[0,-1],[0,-1],[0,-1],[0,-1],[1,-1],[1,-1],[1,-1],[0,-1],[-1,0],[0,-1],[-1,0],[-1,0],[-2,1],[-1,0],[-1,0],[0,-1],[1,-1],[1,-2],[0,-1],[1,-2],[0,-1],[3,-3],[1,0],[2,-1],[1,0],[1,-1],[1,-1],[4,1],[1,0],[0,-1],[1,0],[-1,-1],[0,-1],[0,-1],[0,-1],[1,-1],[1,-1],[1,-1],[1,-1],[1,0],[0,-1],[0,-4],[0,-5],[0,-1]],[[5720,9038],[-3,0],[-1,1],[-3,3],[-1,1],[-1,0],[-1,1],[0,1],[0,1],[0,2],[-1,1],[-1,1],[-1,0],[-1,0],[-6,2],[-1,0],[-2,0],[-1,0],[-3,1],[-1,0],[-1,1],[0,1],[0,1],[0,2],[0,1],[1,2],[0,1],[0,1],[-1,0],[-1,0],[-1,-2],[-1,0],[-2,0],[-3,1],[-2,0],[-5,-2],[-2,-1],[-2,-1],[-1,-1],[-1,0],[-2,0],[-1,-1],[-1,0],[-1,-1],[-1,-1],[-1,0],[-1,0],[-1,0],[0,1],[-2,7],[-1,1],[0,1],[-1,1],[-1,1],[-1,0],[-2,0],[-3,0],[-2,0]],[[5661,9200],[6,0],[7,6],[2,0],[1,0],[1,-1],[0,-1],[1,-1],[1,0],[1,0],[1,-1],[1,-3],[1,-1],[4,0],[-1,-5],[4,1],[1,-2],[0,-5],[1,-7],[-1,-7],[0,-3],[1,1],[4,0],[1,-3],[1,-1],[2,1],[2,-1],[2,1],[1,-1],[0,-1],[1,-1],[3,0],[6,5],[2,0],[-1,-3],[0,-3],[1,-2],[1,-4],[0,-1],[-1,-4],[0,-5],[-2,-14],[0,-3],[1,-1],[7,-3],[0,3],[1,0],[2,-3],[3,-2],[2,-3],[1,-1],[10,-2],[3,0]],[[5668,9064],[7,0],[1,1],[1,1],[1,2],[1,2],[1,1],[1,1],[0,1],[-1,1],[0,1],[-4,4],[-1,1],[-1,0],[-1,0],[-1,-2],[-4,-8],[-1,-2],[0,-1],[0,-1],[0,-1],[1,-1]],[[5449,9676],[2,-1],[3,-2],[1,0],[9,1],[1,0],[2,-4],[1,-1],[1,-1],[2,0]],[[5471,9668],[0,-2],[-1,-2],[-2,-2],[-1,-2],[-1,-7],[0,-3],[-2,-6],[0,-3],[1,-2],[0,-5],[0,-1],[2,-2],[-1,-1],[-3,-2],[-8,-10],[0,-2]],[[5455,9616],[-2,0],[-4,2],[-1,0],[-1,0],[0,-1],[-1,-1],[-2,-1],[-1,1],[-1,0],[0,1],[0,1],[-1,1],[-1,1],[-1,0],[-1,-1],[0,-2],[-1,-1],[-1,0],[-3,-2],[-12,-3]],[[5421,9611],[-1,1],[0,1],[0,1],[1,1],[1,2],[0,1],[-2,1],[-1,2],[0,2],[-1,3],[0,1],[-1,1],[-1,1],[-1,1],[0,1],[0,3]],[[5415,9634],[0,3],[3,12],[0,1],[1,0],[3,0],[1,1],[2,2],[0,2],[0,3],[-1,5],[1,2],[1,3],[1,0],[2,1],[1,0],[0,2],[1,4],[1,1],[1,1],[7,3],[1,0]],[[5441,9680],[1,-1],[3,-2],[2,-3],[1,0],[1,1],[0,1]],[[5398,9768],[0,-4],[3,-10],[2,-6],[1,-2],[0,-1],[-1,0],[-1,0],[-1,0],[-1,2],[0,1],[-1,0],[-1,0],[-1,0],[-1,-2],[0,-1],[0,-1],[0,-1]],[[5396,9743],[-2,-6],[-4,-15]],[[5390,9722],[-4,-2],[-10,-2],[-1,-1],[0,-1],[1,-2],[0,-1],[0,-1],[-1,-1],[0,-1],[0,-1],[1,-1],[1,0],[1,0],[1,-1],[0,-1],[-1,-1],[1,-1],[0,-1]],[[5379,9703],[-3,-3],[-1,0],[0,-2],[1,-2],[0,-2],[-1,-1],[0,-1],[-1,-1],[-2,-1],[-1,-1],[-2,-1],[-1,-2],[-1,-1],[0,-1],[-1,-2],[-1,-1],[0,-1],[-2,-1],[-4,-2],[0,-1],[-1,0],[-1,1],[-1,1],[-3,-1],[-1,0],[-1,0],[-1,1],[-2,2],[-1,0],[-1,0],[0,-2],[0,-1],[-1,0],[-1,-1],[-1,1],[-1,0],[-2,-1],[0,-1],[-1,-1],[0,-1],[-1,-1],[-1,0],[-1,0],[-1,0],[-1,0],[-8,-3],[-1,0],[-1,-1],[-3,-3]],[[5321,9665],[-2,1],[-1,0],[-1,1],[-1,2],[-1,1],[-1,0],[0,1],[1,1],[0,1],[1,1],[0,1],[1,1],[0,1],[-1,1],[0,1],[-1,1],[0,1],[-1,0],[-4,1],[-1,1],[-1,1],[-4,6],[0,1],[0,1],[-1,1],[0,1],[-1,0],[-1,0],[-1,-1],[-1,0],[-1,0],[-7,2],[-2,-1],[0,1],[-1,0],[-1,1],[-1,1],[0,1],[0,1],[1,4],[1,0]],[[5277,9771],[10,2],[4,2],[2,2],[1,2]],[[5294,9779],[1,0],[1,-1],[2,-2],[3,-4],[1,-1],[2,1],[2,0],[2,-5],[4,-1],[8,3],[2,-1],[4,-4],[3,-2],[1,-1],[0,-3],[-5,1],[1,-5],[3,-1],[3,-2],[2,-1],[2,-2],[1,-1],[2,-1],[2,1],[-1,2],[1,2],[1,2],[6,1],[1,1],[1,2],[2,2],[2,0],[6,0],[1,1],[4,9],[2,3],[3,2],[13,-2],[12,-6],[3,2]],[[5421,9611],[-2,-3],[0,-1],[0,-2],[1,-4],[0,-2],[-1,-1],[-1,-1],[-1,0],[-2,-1],[-1,-2],[-1,-5],[-2,-3],[-1,-1],[-2,-1],[-2,1],[-2,0],[-5,-3],[-5,1],[-2,0],[-1,-1],[-2,-3],[-1,-1],[-1,-1],[-3,2],[-1,0],[-2,-2],[0,-2],[0,-4]],[[5381,9571],[0,-1],[-2,2],[-2,0],[-2,-1],[-6,-4],[-2,-1],[-2,0],[-7,4],[-1,-1],[-2,-1],[-1,1],[-1,1],[-2,5],[-4,4],[-2,3],[-1,1],[-3,0],[-1,1],[0,2],[-1,3],[0,2],[-1,0],[-2,-1],[-2,-1],[-3,-2],[-5,0],[-3,-1]],[[5323,9586],[0,1],[0,1],[1,0],[3,3],[2,0],[1,1],[0,1],[-1,1],[-1,0],[0,1],[-3,0],[-1,0],[-4,4]],[[5320,9599],[1,0],[1,1],[0,1],[0,1],[0,1],[0,1],[-2,3],[0,1],[0,1],[0,1],[0,2],[0,1],[0,1],[-1,0],[-1,1],[0,1],[0,2],[1,1],[1,0],[1,1],[1,0],[6,3],[2,1],[2,2],[1,1],[0,2],[1,1],[0,1],[1,1],[0,1],[0,1],[-1,1],[0,1],[-1,1],[0,1],[0,1],[-1,1],[1,1],[0,1],[0,1],[0,1],[-1,1],[-4,5],[-3,2],[-1,1],[-1,3],[-1,3],[-1,6]],[[5379,9703],[5,-10],[1,-2],[1,-1],[0,-2],[0,-2],[0,-1],[-1,-2],[0,-1],[0,-1],[0,-1],[1,-1],[0,-1],[3,-1],[0,-1],[-1,-1],[0,-1],[-1,-2],[-1,-1],[0,-1],[0,-1],[2,-1],[0,-1],[1,-2],[1,-2],[1,-1],[4,-4],[1,-1],[1,-1],[0,-2],[0,-1],[1,-1],[2,-1],[1,-1],[0,-1],[1,-1],[0,-1],[0,-1],[0,-1],[0,-2],[0,-1],[1,-2],[1,-1],[1,-2],[4,-2],[2,-1],[3,1],[1,-1]],[[4823,9638],[1,0],[0,-1],[-4,-2],[-2,-1],[0,1],[1,0],[0,2],[-1,0],[-2,-1],[0,1],[3,2],[2,1],[2,-1],[0,-1]],[[4949,9599],[-12,-6],[-2,-2],[0,-2],[0,-2],[1,-1],[0,-1],[3,-3],[1,-2],[2,-8],[2,-1],[5,1],[1,-1],[5,-3],[2,-1],[4,1],[1,0],[2,-2],[0,-2],[0,-3],[0,-4],[-1,-2],[-1,-1],[-2,0],[-1,0],[-1,-1],[0,-1],[0,-2],[-2,-1],[-1,0],[-1,1],[-1,1],[-1,-1],[-1,0],[0,-1],[-1,-2],[0,-1],[0,-2],[1,-1],[0,-1]],[[4951,9542],[-1,0],[-3,1],[-2,-1],[-1,1],[-1,0],[-1,1],[-3,0],[-2,1],[-1,2],[-5,-3],[-1,2],[-2,0],[-2,-1],[-1,0],[0,1],[-2,3],[-1,1],[0,1],[-1,0],[1,2],[-1,0],[-2,1],[0,1],[-1,2],[-3,2],[-2,1],[1,-3],[-1,-2],[-2,-3],[-1,1],[1,0],[1,1],[0,1],[-1,-1],[-1,0],[-1,0],[0,-1],[-2,2],[-2,1],[-1,0],[-1,0],[-1,2],[-1,2],[0,2],[-1,-1],[0,-2],[2,-2],[1,-1],[0,-1],[-1,0],[-1,-1],[-1,0],[-1,-1],[-1,3],[-2,0],[0,-2],[1,-1],[0,-1],[0,-1],[2,0],[0,-1],[-3,-3],[-1,-1],[-2,0],[-12,0],[0,1],[-1,2],[1,1],[1,0],[1,1],[0,1],[0,2],[-2,4],[-1,3],[-1,3],[-4,6],[-7,6],[-1,1],[-1,-1],[-1,-2],[-2,0],[-2,2],[-2,1],[-2,0],[-7,2],[1,0],[0,1],[1,1],[0,1],[0,1],[1,0],[1,-1],[27,7],[5,-2],[1,1],[1,1],[1,4],[-1,1],[-1,2],[0,1],[-1,3],[-1,1],[-3,1],[-1,1],[-1,0],[0,1],[0,1],[-2,-1],[-5,3],[-2,-1],[-1,-2],[-2,-3],[-1,-3],[-2,-1],[0,3],[1,1],[-1,2],[-1,1],[0,1],[1,2],[1,1],[-1,1],[-1,0],[-5,1],[0,1],[0,2],[1,0],[1,0],[1,0],[1,0],[0,1],[0,1],[2,5],[1,1],[1,-1],[-1,-5],[2,-1],[8,0],[1,0],[0,-1],[1,0],[1,0],[1,0],[4,1],[6,0],[-1,0],[-2,-1],[2,0],[7,1],[0,1],[-2,0],[-1,1],[-1,1],[-1,-1],[-1,0],[-1,0],[0,2],[-1,0],[-3,-1],[0,2],[1,0],[0,1],[1,0],[1,1],[1,2],[-1,0],[-2,-2],[-1,0],[0,1],[0,1],[-1,-1],[-1,-1],[-1,1],[-3,-2],[-1,-1],[0,1],[0,1],[-1,-1],[-1,0],[-1,-1],[-1,0],[0,1],[4,6],[1,1],[8,5],[-1,0],[-3,-2],[-1,0],[-6,-1],[-3,-2],[-5,-3],[-4,-1],[-3,-2],[-1,0],[-2,0],[-3,2],[-2,0],[0,-1],[0,-1],[-1,-1],[-4,0],[-1,1],[-1,1],[0,3],[1,0],[0,2],[-1,4],[-1,2],[1,3],[1,2],[1,0],[0,1],[-2,2],[1,4],[2,4],[2,2],[1,0],[1,-1],[-1,1],[1,1],[2,1],[3,0],[1,0],[3,-2],[1,0],[-2,3],[-1,2],[2,1],[3,-1],[2,0],[-2,1],[0,1],[-1,1],[0,1],[7,0],[2,0],[3,2],[2,0],[-2,0],[0,1],[0,1],[2,0],[3,2],[2,1],[2,0],[2,-2],[-1,-4],[2,1],[3,1],[1,1],[1,-1],[2,0],[1,0],[0,1],[-2,0],[0,2],[2,1],[1,1],[2,1],[2,0],[2,0],[1,-1],[1,1],[1,-1],[0,-1],[1,0],[0,1],[1,1],[0,1],[-1,1],[1,0],[2,1],[1,1],[3,1],[1,0],[0,-2],[-1,-1],[1,-1],[0,-1],[0,-1],[1,0],[0,-1],[0,-2],[0,-1],[2,2],[2,1],[1,0],[-1,-1],[0,-1],[1,-2],[3,-2],[1,-1],[0,1],[0,1],[0,1],[0,1],[0,1],[-1,2],[1,0],[0,-1],[1,-1],[0,3],[0,3],[1,1],[1,-1],[0,1],[0,1],[0,1],[1,-2],[2,0],[4,0],[1,0],[2,-2],[1,-1],[1,0],[3,1],[0,-2]],[[5648,9060],[1,-3],[1,-2],[0,-1],[1,0],[0,-1],[0,-1],[-1,-1],[1,0],[0,-1],[1,-1],[1,-1],[0,-1],[1,-4],[0,-1],[-1,-2],[0,-1],[0,-1],[0,-4],[1,-1],[1,0],[1,1],[1,-1],[1,0],[4,-7],[2,-2],[0,-1],[0,-1],[0,-1],[-1,0],[-1,0],[0,-1],[0,-2],[0,-1],[0,-1],[-1,-1],[0,-1],[-1,0],[-1,-1],[-1,0],[0,-1]],[[5611,8946],[-1,0],[-3,1],[-1,1],[-3,2],[-1,3],[1,3],[0,1],[-2,2]],[[5601,8959],[0,1],[-1,4],[5,2],[2,5],[0,7],[-3,7],[-1,1],[-4,2],[-5,5],[-4,0],[0,1],[-1,1],[0,5],[0,2],[-1,1],[-1,1],[-3,0],[-6,-1],[-3,3],[2,6],[-3,4],[-6,1],[-3,-4],[-1,-3],[0,-1],[-1,0],[-2,0],[-2,0],[-2,-5],[-2,-2],[-2,1],[-2,2],[-2,1],[-1,-1],[-1,-1],[0,-2],[-1,-1],[-1,0],[-1,0],[-1,2],[-1,4],[-2,1],[-4,0]],[[5539,9044],[9,-6],[3,-1],[8,0],[2,2],[0,2],[0,3],[1,1],[2,1],[2,0],[8,-6],[7,-1],[4,5],[3,8],[1,3],[0,2],[-2,6],[-1,5],[0,1],[-3,6],[1,1],[3,1],[2,1],[2,5],[1,1]],[[5315,9030],[1,-1],[0,-1],[1,-1],[0,-2],[1,1],[4,2],[1,0],[1,-2],[0,-2],[-1,-2],[-4,-7],[-1,-1],[-1,-1],[1,-2],[2,-1],[3,0],[2,0],[1,0],[1,-2],[1,-2],[0,-5],[1,-5],[0,-2],[-1,-2],[5,0]],[[5333,8992],[1,-2],[1,-3],[3,-5],[3,-2],[1,-1],[0,-2],[0,-1],[1,-1],[6,-5],[4,-4],[-1,-6],[-4,-3],[-5,0],[-1,-2],[-2,-6],[0,-9],[-1,-5],[-2,-2],[-2,0],[-4,5],[-1,1],[-11,1],[-1,-1],[-2,-3],[-3,-2],[-5,-6],[-2,-2],[-2,0]],[[5304,8926],[-12,3],[-4,0],[-1,0],[-1,1],[0,1],[0,1],[-1,1],[-1,-1],[-1,-1],[-1,0],[-1,0],[-1,1],[-1,3],[-1,0],[-1,0],[-6,-1],[-1,0],[-1,0],[-1,2],[-2,2],[0,1],[-2,1],[0,1],[0,1],[1,3],[0,1],[-1,1],[-1,2],[0,4],[-1,0],[-1,0],[-1,0],[-4,4],[-2,0],[-2,5],[0,5],[-3,0],[-2,-1],[-3,-1],[-1,-3]],[[5243,8962],[-8,2],[-3,0]],[[5232,8964],[-1,1],[0,1],[0,1],[0,1],[-2,1],[0,1],[1,1],[1,1],[0,2],[0,1],[0,1],[-1,1],[1,1],[2,0],[0,1],[1,0],[1,5],[0,1],[0,1],[0,1],[-1,0],[0,1],[0,2],[0,2],[0,1],[1,1],[1,2],[0,2],[0,1],[0,1],[0,1],[-1,2],[-1,2],[-1,1],[0,1],[1,1],[3,3],[1,0],[3,0],[2,0],[1,0],[1,1],[1,2],[2,2],[1,1],[1,0],[1,-1],[1,0],[0,-1],[0,-1],[0,-1],[-1,-1],[0,-1],[0,-1],[1,0],[0,-1],[1,0],[1,-1],[3,0],[1,0],[0,1],[1,1],[0,1],[0,4],[0,1]],[[5259,9016],[1,1],[2,1],[1,0],[1,-1],[1,-1],[0,1],[1,0],[1,1],[1,1],[1,3],[0,1],[1,0],[1,1],[4,-2],[1,-1],[1,-1],[1,0],[1,1],[2,2],[1,0],[2,1],[6,3],[1,1],[1,1],[1,0],[1,-1],[1,0],[6,3],[1,0],[2,-1],[1,-1],[2,-2],[1,-1],[2,1],[5,3]],[[5277,9126],[-1,-1],[-1,0],[-3,1],[-1,-1],[0,-1],[0,-3],[0,-1],[-1,0],[-1,-1],[-1,1],[-1,2],[0,1],[-1,0],[-2,0],[-1,-1],[-1,-1],[-1,-2],[0,-2],[1,-2],[1,-1],[3,-1],[1,-2],[0,-2],[-8,-11],[-1,-1],[-1,0],[-1,0],[-1,0],[-3,-6],[-1,-1],[0,-2],[0,-2],[0,-1],[2,-1],[0,-1],[0,-1],[-1,-3],[0,-1],[0,-2],[1,-1],[0,-1],[0,-2],[-1,0],[-6,-2],[-1,-1],[1,-2],[2,-4],[1,-4],[-3,-3],[-6,-4]],[[5240,9052],[-5,5],[-2,0],[0,-7],[-1,-2],[-12,2],[-1,1],[-1,3],[1,6],[0,1],[-4,4],[-6,2],[-1,1],[0,1],[-1,2],[-7,5],[-1,2],[0,3],[-2,2],[-3,0],[-13,-4],[-7,3],[-5,-2],[-1,0],[-2,1],[2,7],[-1,3],[-7,3],[0,-1],[-5,-4],[-9,-3]],[[5146,9086],[0,5],[0,2],[-1,4],[0,1],[2,3],[1,1],[0,2],[2,6],[1,3],[2,0],[6,-2],[3,1],[1,1],[0,2],[-2,3],[1,0],[0,2],[-7,7],[-1,0],[0,1],[-1,0],[-1,0],[0,-1],[-1,-2],[-4,-7],[-1,-6],[0,-3],[-1,-1],[5,68],[4,21],[1,30],[1,2],[3,6],[1,2],[1,1],[1,0],[0,-1],[0,-1],[0,-2],[0,-1],[0,-1],[1,-2],[1,-1],[5,-5],[4,-2],[1,-1],[11,-13],[2,-4],[1,-4],[0,-3],[1,-5],[2,-13],[0,-1],[3,-9],[3,-4],[3,-4],[3,-1],[1,-1],[0,-2],[1,-1],[-1,-3],[0,-2],[1,-3],[0,-3],[2,-1],[-1,2],[0,4],[-1,2],[1,4],[-1,3],[-2,2],[-2,1],[3,0],[2,0],[2,-1],[2,-2],[-2,4],[-3,2],[-4,1],[-3,3],[-2,4],[-1,4],[-3,26]],[[5896,9590],[0,-1],[0,-3],[0,-6],[4,-7],[0,-4],[-1,-2],[-2,-2],[-1,-2],[0,-2],[0,-1],[0,-1],[-1,-1],[0,-1],[-1,0],[0,-1],[0,-1],[1,-3],[0,-1],[-1,-1],[-1,-1],[-1,-4],[0,-2],[1,-5],[0,-2],[-1,-1],[-1,-2],[-1,0],[1,-3],[0,-2],[0,-1],[2,0],[1,-2],[2,-4],[0,-1],[1,0],[0,-1],[0,-1],[0,-1],[0,-1],[-3,-2],[-2,-1],[-1,0],[-3,-3],[2,-2],[0,-1],[0,-1],[-1,0],[-1,0],[-1,0],[1,-1],[0,-1],[0,-1],[-1,-2],[-1,1],[-1,0],[-1,0],[-1,1],[-1,0],[0,-1],[1,-1],[0,-1],[0,-1],[0,-1],[0,-1],[-1,-2],[-2,0],[-1,-1],[-3,1],[-3,0],[-2,-1],[-3,-1],[-1,-1],[0,1],[-1,0],[0,1],[-3,1],[-2,1],[0,2],[1,4],[-2,0],[-1,0]],[[5859,9502],[0,2],[1,1],[0,1],[0,1],[0,1],[-1,1],[-1,2],[-4,5],[-1,1],[-1,0],[-1,0],[-1,0],[-1,1],[0,1],[0,1],[0,1],[2,2],[0,1],[0,1],[1,1],[0,1],[0,1],[0,1],[0,3],[-1,2],[-1,1],[-1,1],[-12,8],[-1,1],[0,1],[0,2]],[[5836,9548],[1,0],[2,2],[1,0],[1,1],[0,2],[-1,1],[0,1],[0,1],[0,1],[1,3],[1,2],[0,1],[0,1],[1,2],[0,1],[1,1],[3,5],[1,1],[1,4],[3,7],[2,2],[0,2],[0,1],[0,1],[-1,1],[0,1],[0,1],[1,2],[11,19]],[[6057,8831],[0,-1],[-1,4],[2,-3],[-1,0]],[[5980,8798],[1,0],[1,1],[1,-1],[0,1],[0,1],[1,1],[0,1],[1,1],[2,0],[1,1],[0,2],[0,1],[1,2],[0,1],[0,1],[-1,0],[0,1],[1,3],[1,2],[1,1],[2,0],[-1,1],[1,4],[-1,1],[0,1],[1,-1],[0,-1],[2,1],[1,-1],[1,-1],[1,0],[1,1],[1,1],[1,2],[0,2],[-1,1],[4,0],[5,3],[10,3],[2,1],[0,3],[5,6],[1,1],[2,0],[2,0],[1,0],[1,0],[4,-1],[2,-2],[1,-1],[0,-1],[1,-3],[1,0],[3,6],[1,4],[-1,3],[1,3],[-1,2],[-1,3],[-1,2],[2,4],[0,1],[0,1],[0,1],[0,2],[1,1],[2,2],[-1,1],[0,1],[1,1],[-1,1],[-1,2],[0,3],[0,1],[2,2],[3,0],[2,0],[1,-2],[1,0],[1,-1],[0,-1],[0,-2],[0,-1],[0,-2],[1,-1],[0,-3],[1,-12],[0,-4],[-3,-13],[0,-2],[0,-2],[0,-4],[0,-1],[0,-1],[1,0],[0,-2],[0,-1],[0,-1],[0,-1],[1,-1],[0,-1],[0,-1],[1,-1],[2,-1],[0,2],[0,1],[-1,3],[2,-4],[1,-2],[0,-3],[0,-8],[0,-4],[1,-3],[0,-2],[-1,-2],[0,-2],[0,-2],[1,-3],[1,-6],[1,-2],[-1,-18],[1,-3],[-1,-1],[0,-2],[0,-1],[-1,-2],[-2,-2],[-1,-2],[-1,-3],[-6,-11],[-1,-1],[-1,-2],[0,-4],[0,-8]],[[5325,8857],[-4,3],[-1,0],[-2,0],[-1,0],[-3,2],[-2,0],[-2,0],[-2,-1],[-1,-2],[1,-3],[-2,-4],[1,-2],[-1,-1],[0,-1],[1,-1],[1,-1],[1,-2],[0,-3],[-1,0],[0,-1],[-1,-1],[-3,1],[-11,0],[-1,0]],[[5292,8840],[0,2],[-1,9],[0,8],[1,3],[1,3],[1,0],[5,0],[2,2],[6,10],[-1,2],[-1,4],[-1,4],[-3,-1],[-3,-2],[-1,-1],[0,2],[1,2],[1,4],[1,2],[-10,8],[5,7],[1,2],[1,1],[3,1],[0,2],[0,1],[0,1],[0,2],[3,3],[1,2],[0,3]],[[5333,8992],[8,2],[5,0],[3,1],[2,1],[2,-2],[1,-2],[2,-2],[2,0],[10,6],[-1,1],[-3,2],[-1,1],[6,5],[2,0],[2,-1],[1,0],[2,1],[1,3],[1,0],[1,0],[1,-1],[1,0],[2,2],[1,1]],[[5384,9010],[0,-5],[2,-6],[0,-4],[3,-2],[3,-1],[0,-1],[3,-10],[1,-2],[2,-2],[1,-1],[0,-2],[-1,-1],[-1,0],[-1,-1],[0,-2],[8,-6],[3,-1],[1,-2],[4,-6],[1,-1],[2,-2],[3,-3],[1,0],[2,1],[1,3],[1,0],[1,0],[2,-1],[1,-2],[-1,-1],[-1,-1],[-1,-2],[0,-2],[1,-3]],[[5582,9208],[1,-1],[1,0],[1,1],[1,1],[1,0],[2,1],[1,0],[0,-1],[1,-1],[0,-1],[1,0],[1,0],[3,0],[7,1],[1,1],[1,1],[0,1],[0,1],[1,0],[1,0],[2,0],[1,0],[4,-2],[1,0],[0,1],[1,0],[1,2],[1,0],[1,0],[1,-1],[1,-4],[1,-2],[0,-1],[0,-1],[-1,-1],[0,-1],[0,-1],[0,-1],[1,-2],[0,-1],[1,0],[1,-1],[2,0],[3,-1],[2,-3]],[[5581,9125],[-2,0],[-1,1],[-1,0],[0,1],[-1,0],[-1,1],[-3,3],[-2,3],[-1,0],[-1,1],[-5,1],[0,1],[0,1],[0,1],[0,1],[0,1],[-1,1],[-2,0],[-1,0],[-1,0],[0,-1],[-1,-1],[0,-2],[0,-1],[-1,-1],[-1,-1],[-3,0],[-1,0],[-1,-1],[-1,0],[-1,0],[-2,2],[-5,11],[0,3],[-1,2],[0,1],[-1,0],[-1,0]],[[5516,9208],[5,0],[3,1],[3,3],[1,1],[3,1],[2,1],[2,2],[1,0],[3,-2],[2,-1],[7,2],[2,0],[5,-3],[1,-1],[2,-3],[1,-1],[1,-1],[1,0],[2,2],[2,1],[1,0],[3,-3],[3,0],[1,1],[1,3],[1,1],[7,-4]],[[5676,9669],[1,-1],[0,-5],[1,-1],[0,-1],[1,-2],[1,-1],[3,-3],[4,-2],[6,-5],[7,-5],[1,0],[3,0],[1,0],[1,-1],[0,-1],[1,0],[0,-2],[9,-8]],[[5716,9631],[-1,-2],[-2,-3],[0,-1],[0,-1],[1,-3],[0,-2],[1,-1],[1,1],[0,1],[1,1],[1,0],[0,1],[2,-1],[1,-1],[1,-1],[2,-4],[2,-2],[1,-1],[2,0],[1,0],[1,0],[1,-1],[0,-1],[1,0],[0,-1],[-1,-2],[1,-1],[3,-2],[2,-2],[0,-1],[0,-1],[-1,-1],[-1,-1],[0,-1],[0,-1],[0,-1],[0,-1],[0,-1],[-2,-3],[0,-1],[-1,-1],[0,-1],[0,-1],[2,-2],[3,-3],[1,-2],[1,-1],[1,0],[1,0],[1,-1],[1,-1],[0,-1],[1,-1],[0,-1],[0,-3],[0,-1],[0,-1],[0,-1],[1,0],[1,1],[2,0],[4,-4]],[[5753,9564],[0,-2],[0,-1],[0,-1],[-1,0],[-1,0],[-1,-1],[-1,-1],[-1,-3],[-1,-1],[-9,-7],[-1,-2],[-1,-1],[1,-2],[0,-2],[0,-2],[0,-2],[0,-1],[0,-1],[0,-2],[0,-1],[-1,-1],[-1,-1],[-8,-3],[-1,0],[-1,0],[-1,0],[-4,3],[-2,0],[-1,-1],[-2,0],[-1,0],[-1,0],[-1,-1],[0,-1],[-3,-7]],[[5649,9646],[9,1],[1,0],[0,2],[-2,3],[0,2],[1,1],[1,1],[5,2],[1,-1],[-2,5],[-3,0],[-2,0],[2,5],[6,2],[10,0]],[[5833,9549],[-4,-6],[-2,-4],[-1,-4],[1,-2],[2,-8],[0,-1],[0,-5],[0,-1],[0,-1],[1,-1],[1,-1],[0,-1],[0,-1]],[[5736,9472],[-1,0],[-1,0],[-5,-1],[-1,0],[-1,0],[-4,3],[-1,1],[-1,0]],[[5753,9564],[1,0],[1,1],[1,1],[1,3],[1,1],[1,0],[0,-1],[0,-1],[0,-2],[0,-1],[1,0],[1,1],[1,1],[2,1],[1,1],[1,3],[1,1],[1,1],[1,0],[1,0],[4,-1],[2,-1],[1,-1],[1,-1],[0,-1],[-1,-2],[1,-1],[1,0],[1,-1],[1,-1],[2,0],[2,0],[1,0],[1,1],[1,1],[1,0],[5,0],[3,-1],[7,-5],[1,-1],[1,0],[2,0],[1,0],[1,1],[1,0],[1,1],[0,1],[1,2],[1,0],[0,1],[1,0],[1,-1],[2,-2],[1,-3],[1,0],[1,-1],[3,-1],[1,-1],[2,-2],[6,-5]],[[5829,9265],[-7,-6],[-1,0],[0,5],[-1,3],[-3,1],[-4,1],[-1,1],[-3,3],[-1,2],[1,2],[0,2],[1,2],[0,1],[-1,0],[-1,1],[-1,1],[-1,0],[-5,-5],[-1,-3],[-2,-5],[-1,-2],[-4,-4],[0,-1],[-1,-5],[-2,-3],[-2,-2],[-2,-1],[-2,0],[-1,1],[-4,6],[-3,2],[-2,2],[-3,0],[-1,-1],[-1,-1],[-1,0],[-2,-1],[-2,1],[-2,1],[-1,1],[0,1],[-1,1],[0,3],[-1,1],[-1,1],[-3,1],[-2,1],[-1,1],[0,2],[-1,10],[-1,2],[-2,0]],[[5758,9315],[3,1],[3,1],[4,1],[3,-2],[3,2],[4,5],[6,4],[2,3],[-1,3],[0,1],[-2,-1],[-1,1],[-1,2],[0,1],[0,2],[-1,1],[1,2],[1,3],[3,4],[3,2],[2,1],[3,0],[3,1],[7,6],[5,1],[6,0],[13,-4],[1,-1],[1,-1],[0,-1],[0,-2],[-1,-2],[-2,-3],[0,-1],[1,-4],[3,-3],[2,-4],[-3,-6],[-1,-5],[-1,-5],[1,-2],[7,-2],[1,-2],[0,-1],[-1,-1],[-1,-1],[0,-2],[1,-1],[-1,0],[0,-1],[0,-1],[1,-1],[1,0],[1,1],[1,1],[2,-1],[6,-8],[0,-1],[1,-3],[1,-3],[0,-1],[1,-1],[-1,-1],[-1,-1],[-1,-2],[0,-2],[-2,-2],[-1,-2],[-2,-1],[-2,0],[-2,0],[-1,0],[0,-1],[0,-1],[0,-1],[-1,0],[0,1],[-1,0],[0,1],[-3,-1],[-1,-1],[-1,-2],[0,-2],[-1,-3],[1,-1]],[[5320,9315],[2,0],[0,1],[0,6],[-1,1],[-1,1],[0,1],[-1,2],[1,1],[0,1],[2,0],[1,0],[1,1],[2,3],[2,2],[1,0],[5,0],[1,0],[1,1],[0,1],[1,0],[0,1],[0,1],[0,1],[2,1],[0,2],[1,2],[1,1],[1,1],[1,0],[1,0],[1,0],[1,0],[1,0],[4,3],[1,0]],[[5352,9350],[2,-1],[1,0],[1,-1],[1,0],[1,0],[4,0],[1,1],[1,0],[0,1],[0,1],[1,1],[1,0],[1,-1],[1,-1],[0,-1],[0,-1],[4,-3]],[[5815,9176],[-1,-1],[-1,-2],[2,-2],[1,-2],[0,-1],[0,-1],[0,-1],[1,-2],[1,-1],[3,0],[2,-2],[1,-4],[0,-8],[1,-3],[3,-3],[6,-4],[2,0],[4,1],[1,0],[5,-2],[1,-2],[0,-1],[1,-1],[-1,0],[0,-1],[0,-2],[0,-1],[1,-3],[0,-3],[1,-1],[1,-4],[1,-2],[1,-2],[-2,0],[-3,1],[-1,0],[-2,-1],[-2,-2],[0,-1]],[[5746,9119],[2,4],[1,1],[1,1],[1,0],[2,0],[2,0],[3,2],[1,0],[1,1],[0,1],[-1,1],[0,2],[1,0],[2,2],[1,1],[1,1],[1,0],[2,-1],[1,0],[1,0],[4,4],[1,0],[1,0],[1,0],[1,0],[3,0],[2,0],[1,0],[3,1],[0,1],[1,0],[1,0],[3,-2],[1,0],[1,1],[0,1],[0,2],[0,4],[0,1],[0,1],[-1,2],[-1,0],[-1,2],[0,1],[0,3],[0,1],[0,1],[-1,1],[-1,0],[-4,-1],[-1,0],[-1,0],[-1,1],[0,1],[0,3],[1,5],[0,2],[0,2],[1,0],[2,3]],[[5785,9176],[1,-1],[1,0],[1,-1],[2,0],[2,0],[2,-1],[0,-1],[1,-2],[0,-1],[6,-3],[1,0],[1,1],[1,2],[1,1],[0,1],[0,1],[0,1],[1,0],[3,0],[1,0],[3,3],[2,0]],[[5243,8917],[-1,0],[-1,1],[0,1],[-1,0],[0,1],[0,2],[2,3],[2,-1],[1,-3],[-1,-3],[-1,-1]],[[5245,8928],[-1,0],[-1,1],[0,1],[-1,1],[1,3],[0,1],[1,1],[1,0],[1,0],[0,-1],[1,-1],[0,-1],[-1,-2],[0,-2],[-1,0],[0,-1]],[[5292,8840],[-3,-1],[-2,0],[-2,1],[0,1],[0,1],[-3,2],[-1,-1],[-2,-2],[-2,-4],[-2,0],[-1,2],[-2,4],[-1,1],[-5,1],[-1,0],[-2,-1],[-5,-1],[-6,-3],[-3,0],[-4,1],[0,1],[-1,1],[-1,0],[-1,1],[0,1],[0,1],[-1,1],[-1,1],[-1,2],[-1,2],[0,3],[-1,-1],[-3,-1],[-2,0],[-1,3],[-5,4]],[[5226,8860],[0,2],[-1,4],[0,1],[0,1],[0,1],[1,1],[0,1],[1,1],[0,2],[1,1],[0,2],[0,1],[0,2],[-1,1],[1,1],[0,1],[2,2],[1,2],[1,0],[2,0],[1,1],[1,0],[0,1],[0,3],[0,2],[0,2],[0,1],[1,1],[2,1],[1,1],[1,1],[1,4],[1,1],[1,0],[1,0],[0,1],[1,1],[0,3],[0,1],[1,1],[1,2],[1,1],[1,1],[0,1],[0,1],[-1,2],[0,2],[0,2],[1,1],[0,1],[1,0],[0,1],[2,0],[1,1],[0,1],[0,1],[-1,3],[0,2],[0,5],[0,1],[-1,1],[-1,0],[0,-1],[-1,0],[0,-1],[-1,-1],[-1,0],[0,1],[0,3],[0,1],[1,0],[1,0],[0,1],[1,0],[0,2],[-1,1],[-2,6],[0,1],[-1,1],[-1,0],[-1,1],[-1,3],[-1,1]],[[5445,9697],[-2,-2],[-1,-2],[-1,-2],[1,-3],[2,1],[6,-3]],[[5450,9686],[0,-2],[-1,-3],[0,-3],[0,-2]],[[5441,9680],[-5,6],[-1,3],[0,6]],[[5435,9695],[1,1],[2,3],[1,1],[1,0],[2,1],[2,2],[3,2],[2,0]],[[5449,9705],[1,-1],[0,-3],[-1,-1],[-3,-1],[-1,-2]],[[5601,8959],[-5,1],[-5,-1],[-3,-2],[-1,-1],[-17,-16],[-10,-5],[-3,-3],[-6,-10],[-2,-1],[-4,2],[-2,-1],[-3,0],[-6,-3],[-6,-6]],[[5470,8941],[1,0],[1,1],[2,0],[2,2],[2,3],[0,1],[0,1],[-1,1],[0,1],[0,1],[1,0],[0,3],[0,1],[-1,1],[-1,1],[0,1],[-1,1],[0,1],[0,1],[0,2],[0,1],[0,1],[1,2],[0,1],[1,1],[0,1],[2,0],[2,0],[1,0],[4,-3],[1,0],[1,0],[9,5],[1,1],[1,1],[1,2],[1,2]],[[5117,9662],[0,-1],[0,-1],[1,-1],[0,-2],[2,-3],[0,-2],[1,-1],[0,-2],[0,-1],[1,-2],[3,-5],[0,-1],[2,-1],[1,-1],[1,-1],[1,0],[2,0],[3,1],[1,1],[2,2],[1,0],[2,1],[0,1],[1,0],[1,1],[1,2],[0,1],[2,0],[2,0],[9,-3],[1,-1],[2,-1]],[[5160,9642],[0,-6],[0,-2],[0,-3],[1,-10],[0,-3],[0,-1],[0,-1],[-2,-3],[0,-2],[-1,-1],[1,-1],[0,-1],[0,-1],[1,-1],[0,-1],[0,-3],[1,-1],[0,-4],[0,-1],[0,-1],[-1,0],[0,-1],[1,-9],[0,-1],[1,0],[1,-2],[1,0],[0,-1],[-1,-2],[0,-2],[1,-2],[0,-1],[0,-1],[-1,0],[0,-1],[-1,0],[-1,0],[-1,-1],[-2,0],[-2,0],[-1,-1],[-1,-1],[-1,-1],[-1,-1],[0,-1],[-1,-2],[0,-5],[-1,-2],[-1,-2],[0,-2],[-1,-3],[0,-1],[-1,-1],[-1,-1]],[[5146,9547],[0,-4]],[[5146,9543],[-9,1],[-1,1],[-1,1],[0,1],[-1,1],[-1,0],[-1,1],[-2,0],[-2,0],[-1,-1],[-1,-2],[-9,-4],[-2,-2],[-1,0],[0,-1],[-1,-1],[0,-1],[-2,-1],[-2,-2],[-10,-4],[-1,0],[-2,1],[-3,1],[-6,-3],[-1,-1],[-3,0],[-3,0],[-1,0],[0,-1],[-1,-1],[-3,-1],[0,-3]],[[5075,9522],[-2,1],[0,1],[0,3],[0,1],[-1,2],[0,1],[-1,3],[1,1],[0,1],[2,0],[2,0],[0,1],[1,1],[-1,1],[-3,1],[-1,0],[0,2],[0,1],[1,0],[2,1],[1,0],[0,1],[1,1],[1,2],[0,2],[-1,2],[-1,0],[-3,0],[0,2],[0,4],[1,3],[0,1],[-1,2],[0,1],[-1,2],[0,1],[-4,3],[-8,2],[-1,1],[0,2],[1,2],[6,2],[1,2],[0,1],[-1,1],[-1,0],[-2,0],[-1,0],[-1,1],[-1,3],[-1,2],[-1,1]],[[5086,9647],[-1,1],[0,2],[-1,2],[0,2],[1,0],[0,-1],[1,-1],[-1,2],[0,1],[-1,0],[-1,0],[-1,1],[-2,4],[0,2],[0,1],[1,1],[1,1],[1,0],[0,1],[0,1],[0,1],[1,0],[3,0],[0,1],[8,2],[0,-1],[0,-1],[1,-1],[-2,-3],[0,-4],[2,-2],[3,-1],[7,0],[6,1],[4,2],[1,0],[0,1]],[[5352,9350],[2,6],[-1,2],[-2,1],[-1,1],[-1,1],[0,1],[1,4],[0,1],[-1,1],[-1,1],[-1,1],[-1,1],[-6,0],[-1,0],[0,1],[0,2],[-1,1],[-2,1],[-2,1],[-2,2],[-1,2],[-1,1],[-1,2],[0,2],[0,3],[0,1],[1,1],[0,1],[0,1],[0,2],[-1,3],[-1,1],[-1,2]],[[5327,9401],[3,2],[2,-3],[3,1],[3,7],[2,15],[0,3],[0,1],[2,1],[0,2],[0,3],[0,1],[1,3],[3,1],[4,2],[2,0],[4,-3],[1,0],[3,4],[2,4],[1,0],[0,1],[1,3],[1,0],[2,0],[0,1],[1,3],[-1,3],[-1,3],[-1,2]],[[5365,9461],[8,5],[4,1],[5,-1],[0,3],[2,2],[2,0],[1,-1],[1,1],[0,2],[0,1],[3,0],[2,-1],[1,0],[5,2],[9,-10]],[[5327,9401],[-1,0],[-3,3],[-10,17],[-2,6],[-1,2],[-1,1],[-1,1],[-2,1],[-4,3],[-1,0],[-1,0],[0,-1],[1,-1],[0,-1],[0,-1],[1,0],[0,-1],[-1,-1],[-1,-1],[-7,0],[-1,0],[-1,-1],[-1,0],[0,-1],[-1,0],[-4,1],[-4,-1],[-1,0],[-1,1],[-1,1],[0,1],[0,1],[0,2],[0,3],[0,3],[1,1],[-1,1],[0,1],[-1,0],[-1,0],[-1,1],[0,1],[-1,1],[-1,0],[-2,-1],[-1,0],[-1,0],[-1,0],[0,1],[0,1],[1,1],[0,1],[0,1],[-1,1],[-2,0],[-1,0],[-1,0],[0,1],[0,1],[0,1],[-1,0],[-1,0],[-1,-1],[-1,1],[-1,1],[0,1],[-1,2]],[[5258,9456],[1,11],[2,8],[0,1],[0,1],[1,2],[3,4],[2,4],[0,1],[0,3],[0,1],[1,4],[0,2],[3,6],[0,1],[0,1],[-1,3],[0,2],[1,1],[2,6]],[[5273,9518],[3,-1],[3,0],[5,-2],[1,0],[0,1],[0,1],[0,1],[0,1],[-1,1],[1,1],[1,1],[1,0],[2,-1],[1,-1],[0,1],[1,0],[0,1],[2,1],[3,1],[5,3],[1,0],[1,0],[1,1],[0,1],[0,1]],[[5304,9530],[1,1],[1,1],[1,0],[1,0],[4,-3],[1,0],[1,2],[1,0],[8,-3],[1,0],[1,-2],[0,-2],[0,-3],[0,-1],[0,-2],[1,0],[1,0],[1,0],[2,3],[1,0],[3,1],[1,0],[1,-1],[0,-1],[0,-2],[1,-1],[1,0],[1,1],[1,0],[2,-4],[1,-1],[0,-1],[0,-1],[-1,-2],[-1,0],[1,-2],[0,-1],[1,-1],[3,-5],[1,-4],[1,-5],[-1,-5],[-2,-6],[1,-2],[1,-1],[3,-3],[1,0],[3,0],[3,-1],[3,-3],[5,-9]],[[5728,9249],[2,-5],[10,-23],[1,-1],[13,-7],[0,3],[0,7],[1,2],[1,1],[2,0],[1,0],[2,0],[5,-6],[6,-1],[1,0],[3,-5],[2,-3],[1,-3],[-1,-4],[-1,-1],[-1,-1],[-2,-2],[-1,-2],[0,-3],[2,-9],[0,-5],[1,-1],[5,0],[3,-1],[1,-3]],[[5657,9209],[-1,5],[1,6]],[[5657,9220],[2,4],[6,6],[1,5],[-3,3],[-3,3],[1,0],[1,1],[16,1],[2,2],[1,4],[1,1],[4,4],[2,2],[2,0],[0,2],[-1,1],[-5,3],[-1,2],[0,2],[2,5],[1,2]],[[5774,9374],[0,-1],[-3,-4],[-3,-6],[-1,-1],[0,-1],[0,-1],[0,-1],[1,0],[0,-1],[0,-1],[0,-1],[-1,-1]],[[5703,9360],[2,1],[6,1],[1,1],[1,1],[0,1],[0,1],[-1,1],[0,1],[-3,1],[-1,1],[0,1],[0,1],[0,2],[0,1],[0,1],[1,1],[1,1],[1,0],[1,1],[0,1],[0,1],[0,1],[1,1],[0,1],[0,2],[0,2],[-2,8],[0,1],[-2,2],[-1,1],[1,1],[1,2],[0,1],[-1,1],[-1,1],[-1,1],[0,2],[0,1],[1,0],[1,0],[5,1],[1,1],[0,1],[1,1],[0,1],[-1,1],[-2,0],[-1,1],[-1,1],[0,1],[-2,0],[-1,0],[-1,1],[-2,2],[-5,5],[-2,5]],[[5240,9052],[1,-2],[0,-3],[0,-5],[4,0],[17,-4],[2,-1],[-3,-5],[-2,-6],[-2,-2],[2,-8]],[[5232,8964],[-3,-1],[-4,-2],[-10,-2],[-1,1],[0,2],[0,1],[0,1],[-1,1],[-1,-1],[-7,-6],[-1,0],[-9,2],[-3,-1],[-1,0],[-4,2],[-1,1],[-2,-1],[-5,-3],[-4,0],[-1,0],[0,-1],[-2,0],[-4,1],[0,-3],[0,-1],[-1,-1],[-2,-1],[-1,0],[-4,3],[-2,-1],[-2,-2],[-2,-1],[-2,2],[1,4],[-1,2],[-2,2],[-1,-2],[-3,-3],[-3,-2],[-3,-1],[-6,0],[-2,-1],[-2,0],[-3,1],[-4,4]],[[5123,8957],[1,2],[3,4],[0,4],[2,8],[4,23],[2,8],[3,18],[5,39],[2,19],[1,4]],[[5381,9571],[2,0],[1,0],[1,-1],[0,-2],[0,-1],[-2,-3],[0,-1],[1,-1],[1,-1],[1,-1],[0,-6],[-2,-3],[-2,-2],[4,-4],[-1,-1],[-1,-2],[0,-1],[4,-5],[1,1],[1,0],[0,3],[4,-2],[3,-2],[1,-1],[1,-7],[2,-3],[3,-2],[3,1],[1,3],[1,3],[0,1],[1,1],[3,-1],[4,-4],[3,0],[17,1],[4,-2],[1,-5]],[[5304,9530],[-1,2],[1,3],[2,2],[2,1],[1,0],[2,1],[2,2],[2,1],[0,2],[3,7],[0,1],[0,1],[0,1],[0,1],[0,1],[0,1],[0,2],[0,1],[1,1],[1,1],[2,2],[1,1],[1,2],[-1,2],[0,1],[0,2],[1,3],[0,1],[-1,1],[-1,0],[-1,0],[0,1],[-1,1],[0,1],[0,2],[1,1],[2,0],[1,0],[1,1],[-1,1],[-1,0],[0,1]],[[5625,9328],[1,-1],[2,-1],[1,-3],[0,-2],[0,-3],[-2,-1],[-5,0],[-1,-2],[-7,-9],[-1,-2],[2,-2],[3,-2],[0,-1],[-1,-2],[-2,-1],[-1,-1],[0,-2],[6,-4],[1,-2],[0,-2],[-1,-2],[0,-2],[1,-1],[3,-2],[1,-3],[0,-3],[-4,-6],[0,-2],[2,-1],[1,0],[2,-1],[0,-1],[-2,-4],[-1,-2],[2,-6],[4,-5],[5,-4],[4,-1],[6,1],[2,-1],[2,-2],[1,-1],[-2,-7],[1,-2],[0,-2],[2,0],[3,0],[1,-1],[3,-4]],[[5582,9208],[1,6],[1,2],[1,2],[2,2],[1,1],[1,2],[0,3],[0,1],[0,1],[-1,1],[-2,8],[0,1],[-1,1],[-10,10],[-1,1],[-1,3],[-2,7],[-1,2],[-1,0],[0,1],[-1,3],[-2,2],[0,1],[0,1],[1,2],[0,1],[0,1],[0,1],[0,1],[0,1],[1,0],[1,3],[0,1],[0,1],[0,1],[-1,1],[0,1],[-2,2],[-1,1],[-1,1],[0,1],[1,1]],[[5582,9335],[1,-2],[0,-1],[0,-1],[0,-3],[0,-1],[0,-1],[1,0],[1,-1],[2,0],[0,-1],[3,-2],[1,-1],[2,0],[4,3],[1,0],[2,-1],[3,-1],[1,0],[1,0],[2,1],[1,0],[4,-1],[3,-1],[1,0],[1,0],[1,0],[1,0],[1,1],[2,2],[3,4]],[[5146,9543],[0,-2],[0,-5],[1,-1],[0,-1],[2,0],[2,-1],[0,-1],[1,-1],[0,-1],[0,-5],[1,-2],[1,-1],[10,-4],[2,-2],[-2,-2],[-2,-1],[-9,1],[-1,-1],[0,-3],[2,-4],[2,-1],[14,-2],[0,-4],[1,-4],[1,-3],[2,-3],[-1,0],[-1,0],[-1,0],[-1,0],[0,-1],[-1,0],[-1,0],[-1,0],[-11,0],[-3,-1],[-5,-4],[-2,0],[-3,0],[-2,-1],[0,-1],[-1,0],[0,-1],[-1,0],[-1,-4],[3,0],[5,-7],[2,-1],[2,1],[1,-2],[1,-4],[1,-2],[-5,-8],[0,-3],[5,-3],[3,-3],[1,-3],[-3,-2]],[[5154,9439],[-7,5],[-3,1],[-2,-2],[-1,-3],[-3,1],[-2,-1],[0,-2],[0,-5],[0,-2],[0,-1],[-1,-1],[-4,-3],[-2,0],[-1,1],[-1,2],[0,7],[0,3],[-1,1],[-1,0],[-4,-2],[-1,-4],[1,-7],[2,-6],[2,-2],[-1,-1],[-1,-1],[-3,-1],[-8,2],[-5,0],[-1,1],[-5,6],[-8,4],[-3,3],[-5,6],[-2,2]],[[5083,9440],[0,2],[-1,3],[-1,1],[-1,2],[-6,3],[-9,2],[-3,2],[1,0],[1,1],[1,1],[2,1],[1,0],[0,1],[1,2],[0,2],[-1,2],[-1,2],[1,2],[0,2],[0,1],[1,2],[2,1],[8,0],[1,1],[1,0],[1,-1],[5,-2],[1,1],[-1,0],[1,0],[1,0],[1,0],[1,-1],[-2,0],[0,-1],[3,-3],[4,-1],[1,-1],[2,-2],[2,-1],[4,0],[-1,1],[-4,1],[-1,1],[-3,4],[-3,3],[-3,1],[-2,1],[-2,0],[0,1],[-2,1],[-3,1],[-12,-1],[-2,-2],[-1,-1],[0,-1],[-1,0],[0,-1],[-3,-1],[-2,-2],[-2,-1],[-1,0],[-2,1],[-1,1],[-2,3],[-1,0],[-2,1],[-1,0],[0,-1],[-1,0],[0,-1],[0,-1],[-1,0],[-2,0],[-8,4],[0,1],[2,0],[4,-2],[2,0],[1,2],[-1,2],[-1,2],[-2,2],[-1,-1],[0,-1],[1,0],[-1,-2],[-1,0],[0,4],[-1,2],[-3,3],[7,4],[1,0],[2,0],[0,-1],[-1,-1],[1,0],[1,1],[3,1],[0,1],[-2,1],[-2,0],[-1,0],[1,2],[-2,1]],[[5043,9497],[1,2],[1,0],[1,0],[1,-1],[1,0],[1,0],[1,0],[1,0],[1,0],[1,0],[1,1],[1,2],[1,1],[0,1],[0,1],[1,0],[0,1],[1,0],[1,0],[0,-1],[1,0],[1,-1],[1,0],[1,1],[1,1],[1,0],[0,-1],[0,-1],[0,-1],[1,0],[0,-1],[1,1],[1,1],[0,2],[1,1],[1,1],[1,0],[1,1],[1,2],[1,6],[0,2],[1,0],[0,1],[0,1],[0,1],[0,1]],[[5455,9616],[1,0],[1,-2],[1,-1],[1,-5],[0,-1],[5,-3],[1,-1],[1,-2],[-1,-1],[0,-2],[0,-1],[0,-1],[0,-1],[0,-1],[-1,0],[-2,1],[-1,0],[0,-1],[-1,-1],[0,-1],[0,-1],[1,0],[1,-1],[1,0],[1,0],[3,1],[2,0],[11,-1],[1,0],[2,1],[1,1],[1,1],[0,1],[2,1],[2,0],[1,0],[0,-1],[0,-1],[0,-1],[0,-1],[1,0],[1,0],[9,3]],[[5501,9594],[1,0],[1,0],[4,-1],[1,0],[0,-1],[1,-1],[0,-1],[2,-7],[1,-1],[0,-1],[3,-2],[1,-2],[1,-1],[0,-1],[0,-2],[0,-2],[-2,-4],[-1,-1],[-1,-1],[-1,-1],[-1,-1],[-1,-2],[-1,0],[-1,-1],[-1,0],[-1,-1],[1,-3],[0,-2],[1,-1],[0,-1],[0,-1],[-1,-1],[0,-1],[0,-2],[0,-1],[-1,-2],[-3,-2],[-3,-1],[-1,-1],[-2,0],[-2,0],[-1,0],[0,-1],[-1,0],[0,-1],[0,-1],[0,-1],[0,-1],[0,-1],[1,-1],[1,0],[1,0],[0,-1],[3,-2],[1,-2],[1,-2],[0,-2],[0,-1],[0,-2],[0,-1],[0,-1],[3,-4],[0,-2]],[[5504,9513],[-1,0],[-4,0],[0,-1],[-4,-2],[0,-1],[1,-2]],[[5412,9068],[-3,-1],[-7,-1],[-7,-3],[-2,-4],[-1,-1],[-1,1],[-1,2],[-1,1],[-2,0],[-1,0],[-1,-2],[1,-3],[0,-2],[-1,-2],[-2,0],[-1,2],[-1,2],[-1,1],[-1,1],[-2,1],[-1,-3],[-2,-2],[-6,-4],[-2,1],[-5,1],[0,1],[0,2],[1,1],[1,1],[-2,2],[-1,0],[-2,-2],[-3,1],[-5,4],[-2,2],[-1,2],[0,2],[1,3],[0,2],[-1,1],[-1,0],[-3,-2]],[[5343,9073],[0,4],[0,1],[0,1],[-1,1],[-1,2],[-1,1],[0,2],[-1,1],[0,1],[0,1],[0,2],[0,1],[-1,1],[-1,1],[0,1],[0,1],[1,2],[4,2],[2,1]],[[5343,9073],[-2,-1],[-7,-1],[-1,0],[-1,1],[-1,1],[-1,0],[-1,-1],[0,-1],[0,-1],[0,-1],[0,-1],[-1,-1],[-1,-2],[0,-1],[1,-1],[0,-1],[1,-1],[2,0],[1,-1],[0,-1],[1,0],[-1,-1],[0,-1],[-3,-8],[-1,-1],[-2,-2],[0,-1],[1,0],[0,-1],[1,0],[0,-1],[0,-1],[0,-1],[-1,-1],[-1,0],[-1,0],[-2,1],[-1,1],[-1,-1],[-1,0],[0,-1],[0,-1],[0,-1],[-1,-1],[-2,-1],[0,-1],[-1,0],[-1,-2],[0,-1],[0,-2]],[[5216,9540],[15,-8],[1,1],[3,2],[1,-1],[0,-2],[-1,-1],[-1,-1],[0,-1],[0,-2],[2,-2],[2,-2],[2,-1],[2,1],[1,2],[1,1],[4,-1],[9,-6],[3,0],[5,-3],[2,0],[1,4],[5,-2]],[[5258,9456],[-5,1],[-1,0],[-3,-4],[0,-1],[-1,-1],[0,-1],[0,-2],[-1,0],[-3,-1],[0,-1],[-1,-1]],[[5172,9435],[-2,0],[-1,2],[-1,1],[-4,-3],[-3,1],[-7,3]],[[5146,9547],[5,-3],[4,-2],[10,0],[3,-2],[1,1],[1,3],[1,0],[28,-8],[1,0],[1,1],[1,2],[1,0],[2,0],[1,0],[1,0],[2,3],[4,-2],[2,0],[1,0]],[[5097,9693],[-1,0],[0,1],[1,0],[0,-1]],[[5181,9677],[-1,-4],[2,0],[7,-5],[-1,-3],[-1,-1],[0,-2],[1,-3],[0,-2],[0,-1],[-1,-1],[-2,-5],[-4,-5],[-2,-3]],[[5179,9642],[-3,0],[-1,0],[-1,0],[-2,1],[-1,-1],[-1,0],[-2,-1],[-3,0],[-5,1]],[[5117,9662],[1,0],[7,-1],[9,2],[3,-1],[-2,2],[-1,1],[-4,0],[-1,-1],[0,1],[0,1],[0,1],[-1,0],[-3,1],[-1,1],[0,1],[-1,3],[-3,3],[-1,3],[0,4],[0,3],[-1,3],[-2,0],[0,1],[1,1],[1,1],[0,2],[1,6],[1,2],[0,-2],[1,2],[0,1],[0,1],[-1,0],[-1,1],[1,8],[1,2],[1,1],[2,-1],[0,1],[-2,0],[-2,0],[-1,-1],[-1,-2],[-1,1],[0,1],[-1,1],[0,3],[1,2],[0,1],[-1,1],[-1,1],[0,1],[1,2],[0,2],[1,1],[2,1],[-1,1],[-1,-1],[-1,2],[0,3],[-1,2],[0,3],[1,1],[1,0],[3,-1],[0,1],[-1,1],[-3,1],[-1,0],[-1,-3],[-1,2],[-2,5],[-1,2],[1,0],[0,1],[-2,2],[-1,1],[-1,2],[2,0],[0,1],[-1,3],[-1,0],[-1,-2],[-1,1],[-2,2],[-2,1],[0,1],[1,0],[0,1],[-1,0],[-1,-1],[-1,0],[-1,1],[-1,2],[1,4],[0,2],[-1,1],[0,1],[-1,3],[0,1],[-1,1],[0,2],[-3,2],[0,1],[0,2],[3,2],[0,2],[1,4],[0,2],[-1,2],[-1,2],[0,1],[-1,1],[-3,1],[-3,1],[0,4],[0,2],[1,1],[2,0],[1,0],[1,-1],[1,-1],[3,1],[1,-1],[0,-2],[1,-1],[1,0],[2,0],[6,-1],[6,-3],[2,1],[0,-1],[0,-1],[1,0],[1,1],[1,1],[1,-1],[2,0],[1,0],[2,0],[1,2],[2,3],[1,1],[4,1],[2,0],[10,-2],[1,0],[0,-1],[0,-2],[2,-5],[1,-2],[-2,-2],[-1,-1],[0,-1],[0,-1],[-2,0],[-1,0],[-1,-1],[0,-3],[1,-3],[2,-2],[1,-4],[6,-9],[1,-2],[0,-3],[0,-1],[0,-1],[-1,-1],[0,-1],[1,-1],[1,1],[1,0],[1,-1],[1,-1],[1,0]],[[5675,9743],[0,-3],[-1,-2],[-1,-2],[0,-1],[0,-1],[2,-7],[1,-2],[0,-2],[0,-5],[0,-2],[1,-1],[2,-1],[1,-1],[0,-1],[0,-1],[-1,0],[0,-1],[-1,-2],[1,-2],[0,-1],[-1,-1],[0,-1],[0,-1],[-1,-1],[-1,0],[-3,-1],[-1,-1],[0,-1],[-1,-1],[-1,-3],[0,-1],[0,-2],[1,-1],[0,-1],[0,-1],[-1,-2],[-1,-2],[0,-1],[1,-1],[3,-3],[3,-3],[0,-3],[0,-4]],[[5553,9658],[-2,2],[-1,1],[0,1],[-1,0],[-1,-1],[-1,0],[-1,1],[0,1],[0,1],[0,4],[0,1],[0,2],[0,1],[-1,1],[0,1],[-1,0],[0,1],[-1,1],[-1,1],[-1,-1],[0,1],[0,1],[0,1],[1,1],[1,1],[0,1],[0,1],[-1,1],[0,1],[1,1],[3,-1],[0,1],[1,1],[1,3]],[[5248,9625],[-2,0],[-5,-1],[-1,-1],[0,-1],[-1,-2],[1,-15],[-1,-4],[-6,-5],[-1,0],[0,-1],[0,-2],[0,-2],[1,-3],[0,-2],[0,-1],[0,-2],[-1,-1],[-2,-1],[-6,-2],[-1,0],[0,-2],[1,-2],[2,-3],[1,-2],[0,-1],[0,-2],[0,-2],[-2,0],[-4,-1],[-1,0],[-1,-1],[0,-1],[-1,-2],[1,-1],[0,-2],[1,-1],[0,-1],[-1,-1],[-1,-1],[-2,-1],[-2,-1],[0,-2],[1,-2],[2,-1],[3,-1],[-1,-2],[-1,-2],[-2,-1]],[[5179,9642],[1,-1],[1,-2],[1,-3],[1,0],[0,-1],[1,1],[1,0],[1,-1],[1,-1],[1,0],[1,0],[1,1],[0,1],[0,1],[1,0],[4,1],[1,0],[0,-1],[1,-1],[1,0],[7,2],[1,0],[1,1],[2,3],[1,1],[1,0],[1,0],[4,0],[6,-2],[1,0],[1,1],[1,2],[1,0],[1,0],[2,0],[1,1],[1,1],[1,1],[-1,1],[0,1],[1,1],[6,-2],[0,-1],[1,-1],[-1,-1],[0,-1],[0,-2],[1,-1],[3,-4],[1,-2],[2,0],[1,0],[1,-1],[0,-2],[1,-7]],[[5756,9777],[1,-3],[0,-4],[0,-2],[-1,-3],[0,-2],[0,-1],[0,-1],[1,-1],[1,0],[0,-1],[1,-2],[0,-2],[3,-2],[0,-2],[1,-3],[1,-3],[0,-2],[-1,-1],[-1,-2],[-1,-1],[1,-3],[1,-2],[0,-2],[0,-3],[-2,-2],[-3,-1],[-2,-1],[0,-2],[2,-5],[1,-1],[6,-3],[0,-1],[1,-1],[0,-3],[0,-1],[1,0],[4,-2],[1,-1],[1,-2],[1,-1],[12,-1],[2,0],[1,-1],[0,-2],[0,-1],[-1,-1],[0,-1],[-1,-2],[0,-2],[1,-1],[1,-2],[5,-7],[1,0],[2,0],[2,1],[2,-1],[3,-3],[2,-1],[3,0],[1,0],[2,-4],[1,-1],[2,-2],[4,-1],[3,-4],[14,-6],[1,0],[2,0],[2,0],[3,-2],[11,-12]],[[5855,9645],[-3,-1],[-8,-6],[-4,-5],[-3,-2],[-2,2],[-4,-5],[-6,2],[-7,1],[-1,2],[0,2],[0,1],[-1,2],[-2,0],[-9,-8],[-6,0],[-3,-3],[-1,0],[0,2],[-2,0],[-3,0],[-2,1],[-2,3],[-1,-1],[-1,-2],[0,-1],[-7,-1],[-2,1],[0,-5],[-3,-1],[-12,-1],[-2,1],[0,3],[-6,3],[-1,1],[0,1],[1,1],[1,1],[0,2],[1,1],[0,2],[0,1],[-1,1],[-2,2],[-2,0],[-2,0],[-3,-2],[-1,0],[-1,1]],[[5742,9641],[0,1],[0,3],[0,1],[0,1],[-1,1],[-2,2],[-1,0],[0,2],[0,2],[3,2],[0,1],[0,2],[0,11],[-1,1],[-1,1],[0,2],[0,1],[0,2],[2,2],[1,1],[1,7],[0,3],[0,3],[-1,3],[0,1],[-1,1],[0,1],[1,1],[0,1],[3,2],[1,1],[2,-1],[1,0],[0,1],[0,1],[0,1],[0,1],[-1,1],[-1,0],[0,2],[0,1],[0,2],[1,3],[1,1],[0,2],[-2,6],[-1,1],[-3,0],[-1,0],[-1,1],[0,2],[0,3],[0,1],[1,3],[0,2],[-3,1],[-1,1],[0,2],[1,3],[0,2],[2,4],[1,1],[-1,1],[-1,1],[-1,1],[0,2],[0,1],[0,2],[0,2],[-1,2],[-2,2],[-3,4],[-1,1],[-2,-1],[-2,-1],[-2,-1],[-6,-1],[-1,1],[0,1],[-1,0],[-1,5],[-1,1],[1,1],[0,2],[1,1]],[[5718,9779],[2,2],[2,1],[2,1],[2,-1],[1,0],[1,0],[1,1],[1,2],[2,1],[2,0],[2,-1],[1,-1],[1,1],[2,1],[0,1],[1,0],[2,-2],[1,0],[3,-4],[1,-1],[2,-1],[6,-2]],[[5742,9641],[-1,-2],[-1,-2],[-2,0],[-4,0],[-5,-3],[-1,-1],[-3,1],[-1,0],[-4,-3],[-2,-1],[-2,1]],[[5710,9795],[1,-1],[4,-8],[1,-1],[0,-1],[-1,-2],[0,-1],[1,-1],[2,-1]],[[4987,9481],[1,-1],[3,0],[1,-1],[-1,-2],[-2,-1],[-6,1],[-5,1],[-1,1],[0,2],[-1,3],[-1,2],[0,2],[1,1],[1,0],[1,-1],[4,-2],[2,-2],[3,-3]],[[5043,9497],[-1,1],[-1,0],[0,3],[-1,2],[1,1],[5,0],[3,1],[2,0],[-1,0],[-3,0],[-1,0],[-7,3],[-1,0],[-1,0],[-3,-1],[-3,0],[-1,-1],[-1,0],[-1,1],[2,0],[1,1],[1,2],[1,1],[-1,-1],[-1,0],[-2,0],[-1,-1],[1,0],[1,-1],[-3,0],[-1,0],[0,1],[-1,-4],[-1,0],[-3,1],[-1,0],[-4,-2],[-2,0],[-1,0],[-1,0],[-2,2],[-1,3],[-1,1],[-1,0],[-1,0],[0,1],[-1,1],[1,1],[3,0],[1,-3],[1,1],[1,0],[1,-1],[0,1],[0,2],[2,-1],[2,-1],[2,0],[2,1],[-1,1],[4,5],[0,3],[-2,3],[0,-1],[1,-1],[0,-1],[-1,-1],[-1,0],[2,-1],[-1,-1],[-1,0],[-1,1],[-4,3],[2,-1],[2,0],[-1,1],[-1,1],[-3,1],[1,-1],[-2,-1],[-4,-1],[-1,-1],[-1,-1],[-1,-1],[-3,-1],[0,1],[1,0],[0,1],[-2,0],[0,-1],[-1,0],[0,2],[0,1],[0,1],[1,1],[-1,0],[-1,1],[-1,1],[0,2],[-1,0],[0,-2],[1,-1],[0,-1],[0,-4],[0,-1],[1,-1],[1,-2],[1,-1],[0,-1],[-1,0],[0,-1],[0,1],[-1,1],[-1,0],[0,1],[-1,1],[-1,1],[0,-2],[0,-1],[-1,1],[-1,2],[0,2],[-1,-2],[1,-2],[-1,0],[-1,0],[-1,1],[-2,-2],[-2,0],[-1,1],[1,1],[0,1],[-1,1],[-1,0],[-1,-2],[1,-1],[-1,-4],[1,-4],[1,-4],[2,-2],[-1,0],[-2,1],[-1,-1],[-1,4],[0,1],[0,2],[1,2],[0,2],[0,3],[-1,2],[-1,2],[-1,2],[-1,0],[-1,1],[-1,0],[0,1],[0,2],[1,4],[7,3],[-1,1],[0,1],[0,1],[0,1],[-1,-1],[-1,0],[0,3],[0,1],[-1,-2],[-1,1],[-1,0],[-1,0],[1,-1],[1,-1],[0,-1],[1,-2],[-1,0],[0,-1],[-1,1],[-1,-1],[-2,-1],[1,0],[1,-2],[-2,0],[0,-2],[0,-1],[-1,0],[-1,0],[-2,3],[-2,1],[-4,1],[-2,0],[1,1],[2,0],[3,-2],[0,1],[-1,1],[-2,1],[-3,0],[0,1],[1,0],[0,1],[0,1],[0,1],[2,0],[1,3],[1,2],[1,1],[0,1],[-2,-3],[-2,-2],[-3,-2],[-1,0],[0,-1],[1,0],[0,-1],[0,-1],[-7,-2],[-1,1],[-3,4],[-1,3],[-1,1],[0,1],[-1,1],[-1,-1]],[[5756,9777],[1,-1],[2,-4],[1,0],[7,1],[2,0],[0,2],[1,0],[1,1],[0,1],[0,1],[1,0],[2,0],[0,1],[4,1],[3,0],[2,-1],[0,-1],[4,-3],[3,-1],[1,0],[1,0],[1,0],[2,1],[1,0],[8,-4],[1,-1],[1,-2],[0,-1],[0,-1],[1,0],[4,-5],[0,-1],[0,-1],[-2,0],[0,-1],[0,-2],[2,-2],[5,-6],[0,-2],[1,-1],[1,0],[1,-3],[0,-1],[1,-1],[1,0],[1,0],[0,-2],[0,-2],[0,-1],[1,-2],[1,-1],[3,0],[4,-1],[1,0],[1,2],[0,3],[-1,2],[1,2],[1,0],[3,-1],[3,0],[1,0],[5,-3],[2,0],[0,-5],[1,-4],[2,-1],[2,2],[0,1],[0,1],[1,1],[0,-1],[3,-2],[2,-1],[1,0],[7,0],[3,-1],[0,-1],[1,1],[1,2],[0,1],[1,0],[2,0],[1,1],[0,2],[1,1],[1,1],[1,0],[1,0],[2,0],[0,-1],[4,-1],[1,0],[1,-2],[-1,-1],[1,-2],[2,-3],[1,-2],[2,-1],[4,0],[2,-2],[1,-2],[1,-1],[1,0]],[[5610,9456],[-2,0],[-5,-4],[-6,-1],[-1,-3],[0,-1],[0,-2],[1,-4],[1,-1],[-1,-1],[0,-2],[-1,0],[-1,-1],[-2,0],[-1,-1],[0,-2],[0,-1],[1,-1],[2,0],[1,-2],[0,-2],[0,-5],[1,-1],[1,-1],[2,-1],[0,-3],[-1,-1],[-3,-2],[-1,-1],[1,-2],[1,-3],[-1,-1],[0,-1],[-1,0],[-2,0],[-1,-1],[-7,-5],[-5,-2],[-2,-2],[-2,-1],[-4,5],[-2,2],[-10,-2]],[[5504,9513],[3,0],[8,2],[1,0],[1,-1],[0,-1],[1,-3],[0,-1],[1,-2],[4,0],[2,-1],[2,-2],[0,-1],[2,0],[2,1],[1,0],[3,-3],[1,0],[2,1],[2,3],[2,0],[7,-2],[0,5],[0,4],[1,-1],[2,-4],[3,-3],[1,-2],[0,-1],[1,-2],[1,0],[2,0],[2,-1],[6,-6],[7,-4],[1,0],[1,1],[0,1],[1,2],[0,1],[1,1],[1,1],[1,-1],[1,-2],[0,-1],[-1,-3],[0,-1],[1,-1],[6,3],[1,-2],[1,-7],[2,-2],[2,0],[0,1],[1,2],[1,1],[1,0],[4,0]],[[5513,9870],[0,-3],[-2,0],[-2,-1],[-2,0],[0,4],[2,0],[1,0],[1,1],[1,2],[1,-3]],[[5520,9852],[-5,4]],[[5515,9856],[0,3],[3,15],[1,2],[2,3],[0,1],[0,1],[0,1],[-3,3],[-1,1],[-2,0],[-1,0],[-3,-2],[-1,1],[-1,1],[0,1],[0,2],[3,2],[0,2],[0,1],[-1,3],[-2,2],[-2,3],[1,2],[2,2],[2,2],[0,2],[-1,1],[-3,1],[-1,2],[0,2],[-1,1],[0,1],[-1,1],[-2,0],[-4,-1],[0,1],[-1,2],[-1,1],[-2,0],[-3,-1],[-1,1],[-1,0],[0,1],[-1,1],[0,1],[0,1],[1,1],[1,2],[-1,3],[1,1],[1,1],[1,1],[2,1],[1,0],[-3,4],[-1,1],[-2,0],[-1,-1],[-3,-3],[-2,-2],[-2,1],[-18,0],[-2,1],[-4,4],[-1,1],[-2,0],[-1,0],[-1,1],[0,1],[0,2],[0,1],[0,1],[-1,0],[0,1],[0,2],[1,1],[2,2],[0,1],[-1,2],[-1,0],[-8,0],[-2,1],[-2,2],[-3,10],[-7,15],[-4,4]],[[5427,9989],[6,1],[15,5],[1,0],[1,0],[5,0],[7,1],[3,2],[1,1],[2,-3],[1,-6],[0,-3],[3,-3],[2,-2],[0,-3],[0,-1],[-2,-2],[-1,-1],[2,-6],[0,-1],[-1,-2],[0,-1],[1,0],[1,-1],[0,-2],[1,0],[0,-1],[2,0],[2,0],[1,0],[1,0],[0,-1],[1,-1],[0,-1],[3,-3],[1,-1],[1,-3],[0,-1],[2,-1],[7,-3],[0,-1],[1,0],[2,1],[2,5],[2,1],[2,2],[4,1],[7,2],[2,-1],[1,-1],[2,-3],[1,-2],[1,-2],[1,-1],[1,0],[1,-1],[1,-1],[1,-3],[-1,-3],[0,-4],[2,-7],[1,-5],[0,-1],[1,-2],[2,-1],[3,-2],[2,0],[2,0],[3,1],[2,1],[0,1],[1,1],[2,0],[1,-1],[0,-2],[-1,-1],[1,-1],[6,0],[2,0],[2,-1],[1,-2],[2,-3],[1,-5],[0,-6],[0,-6],[3,-3],[1,1],[0,1],[1,1],[1,2],[1,1],[1,1],[4,0],[3,0],[2,-1],[2,-1],[1,-1],[2,0],[5,2],[2,0],[2,0],[3,-4],[2,-1],[1,-1],[3,-6],[1,0],[1,0],[0,1],[0,1],[1,1],[1,-1],[1,0],[1,-1],[0,-1],[0,-2],[-1,-1],[-2,-1],[-1,-2],[0,-1],[0,-2],[-2,-6],[0,-2],[1,-1],[2,1],[1,0],[0,-1],[2,-5],[0,-2],[1,-1],[0,-1],[-2,-1],[-2,-1],[-2,-2],[0,-1],[-1,-1],[0,-1],[1,-3],[0,-2],[-1,0]],[[5514,9726],[-2,-2],[-1,0],[-1,0],[-2,0],[-1,-1],[-1,-1],[-1,0],[-1,1],[-1,0],[-1,0],[-7,-2],[-5,2],[-1,0],[-1,-1],[-1,-1],[-1,-1],[-1,0],[0,1],[-1,0],[-1,1],[-2,-1],[-1,0],[-1,1],[-2,2],[-2,0],[-3,-1]],[[5472,9723],[-2,1],[-1,1],[0,1],[-1,1],[-2,-1],[-1,0],[-14,9],[-2,1],[-1,-1],[-3,-2],[-1,0],[-2,0],[-5,3],[-2,1],[-2,-1],[-2,2],[-1,1],[-1,1],[-1,0],[-1,0],[-1,-1],[-4,-3],[-1,-1],[-2,0],[-4,0],[-3,-1],[-1,1],[-3,0],[-4,2],[-2,0],[-1,0],[-1,0],[-1,1],[-1,1],[0,1],[0,1],[-2,2]],[[5398,9768],[0,1],[0,2],[1,2],[1,2],[0,1],[1,0],[1,1],[0,2],[0,1],[0,1],[-1,0],[-1,0],[-1,0],[0,-1],[-1,0],[0,1],[-1,2],[0,5],[0,1],[-1,2],[0,4],[0,2],[0,1],[-1,1],[0,1],[0,1],[2,1],[1,1],[1,1],[1,2],[-1,1],[-1,0],[-1,0],[0,-1],[-1,0],[-1,0],[0,1],[0,2],[3,5],[1,1],[1,1],[1,1]],[[5401,9817],[6,-3],[1,-1],[1,-1],[0,-4],[1,0],[10,2],[8,-5],[14,2],[6,-1],[4,-3],[7,-2],[3,-3],[1,-1],[2,1],[1,0],[4,-4],[1,0],[1,0],[2,1],[1,0],[0,-1],[1,-3],[1,-1],[1,1],[0,1],[0,1],[1,1],[2,3],[2,0],[2,0],[3,-1],[1,0],[1,1],[0,1],[0,1],[0,1],[0,2],[1,0],[3,1],[1,1],[1,4],[1,1],[2,0],[3,-2],[1,0],[1,1],[2,0],[1,0],[2,-2],[2,0],[1,1],[-1,2],[6,-1]],[[5320,9599],[-2,-1],[-2,0],[-2,2],[-1,1],[-1,1],[-2,3],[-1,2],[-1,1],[-1,0],[-1,-1],[-3,0],[-7,3],[-1,0],[-1,1],[1,1],[0,1],[-1,1],[0,1],[-1,0],[-2,0],[-1,0],[-3,2],[-1,1],[-1,1],[0,2],[-1,1],[0,2],[0,4],[0,4],[0,1],[0,1],[0,1],[-1,1],[-1,0],[-4,2],[-1,0],[-1,0],[-8,-2],[-1,-1],[-1,0],[-1,-1],[-1,0],[0,-1],[-1,-2],[-1,-1],[-1,0],[0,-1],[-1,0],[-1,0],[-1,-1],[0,-2],[-1,-1],[-1,0],[-1,1],[-2,0],[-5,-1]],[[5462,9692],[0,-4],[-1,-2],[-1,0],[-10,0]],[[5445,9697],[9,0],[1,0],[2,-3],[2,-1],[3,-1]],[[5515,9856],[-5,3],[-1,0],[-1,0],[-2,0],[-1,0],[0,-1],[0,-2],[0,-1],[-1,-1],[-2,0],[-3,0],[-1,-1],[-2,-2],[-1,0],[-1,1],[0,1],[0,1],[0,1],[0,1],[0,1],[0,1],[-1,0],[0,1],[-1,-1],[-3,-3],[-2,-1],[-1,0],[-1,2],[2,2],[0,1],[0,1],[0,1],[-1,2],[-1,1],[-1,2],[-1,0],[-1,1],[0,-1],[-1,0],[0,-1],[0,-1],[0,-2],[0,-1],[0,-1],[-1,0],[-1,1],[-2,1],[-2,0],[-3,1],[-1,1],[-1,0],[1,1],[0,1],[0,1],[-1,0],[-1,0],[-1,0],[-1,-1],[-1,0],[-1,0],[-2,1],[-2,0],[-1,-1],[-1,-1],[-1,0],[0,-2],[-1,-1],[-1,0],[-1,1],[-1,1],[0,1],[0,1],[0,1],[0,1],[0,1],[2,2],[1,1],[3,2],[1,1],[1,1],[0,1],[-1,1],[-4,2],[-1,0],[-1,0],[-1,-1],[-1,-1],[-1,1],[-1,1],[0,1],[-1,1],[-1,0],[0,-1],[-1,-1],[0,-1],[-1,0],[-2,0],[-3,-1],[-1,0],[-1,0],[-1,0],[-2,-1],[-5,0],[-2,0],[-1,1],[-1,1],[-1,1],[0,1],[0,1],[0,1],[-1,1],[-2,1],[-7,5],[0,1],[1,1],[0,1],[0,1],[-1,0],[-2,0],[-1,-1],[-1,-1],[-1,0],[-1,1],[-1,1],[-1,2],[-1,1],[-1,1],[-2,0],[-1,0],[-4,0],[-5,-2],[-1,0],[-1,0],[-2,0],[0,1],[-3,3]],[[5388,9900],[1,0],[0,1],[-5,4],[0,1],[2,4],[0,7],[0,6],[3,2],[-2,3],[-1,2],[0,7],[-1,6],[0,2],[0,3],[2,5],[1,2],[1,3],[-1,3],[-1,5],[-1,2],[0,1],[2,2],[1,0],[2,0],[2,1],[1,1],[2,4],[3,2],[16,7],[2,0],[3,2],[7,1]],[[5226,8860],[-1,1],[-1,-1],[0,-1],[-1,-1],[-1,1],[-4,-3],[-2,-2],[-3,0],[-4,2],[-2,0],[0,-3],[-1,0],[-2,-1],[-1,0],[0,1],[0,1],[0,1],[-1,0],[-1,0],[-1,0],[0,1],[0,1],[-3,5],[-2,2],[-2,2],[-1,0],[-1,0],[-1,0],[-1,1],[0,1],[0,1],[0,1],[0,1],[0,1],[-2,4],[-2,1],[-6,-2],[-7,1],[-3,1],[-3,3],[-1,1],[-2,1],[-3,0],[0,1],[-2,1],[-4,0],[-2,2],[-3,2],[-5,1],[-2,2],[-1,2],[-1,1],[1,2],[2,2],[-2,1],[-2,-1],[-2,-2],[0,-3],[0,-4],[-1,-1],[-1,-1],[-3,0],[-2,1],[-2,1],[-1,2],[-1,3],[0,1],[4,5],[1,2],[1,4],[1,5],[0,6],[-3,3],[-1,0],[-1,-1],[-1,0],[-3,2],[-3,1],[-1,0],[-2,-1],[0,-2],[-1,-1],[-1,-1],[-1,0],[-1,0],[-1,1],[-1,3],[0,1],[0,1],[-1,1],[-1,1],[-1,0],[-2,-1],[-2,0],[-1,-1],[-1,1],[0,3],[-1,2],[-3,1],[0,2],[0,3],[1,1],[1,-1],[1,1],[1,1],[8,1],[2,3],[2,2],[1,1],[1,1],[2,4],[0,2],[1,1],[3,5]],[[5511,8860],[-1,-6],[0,-6],[1,-3],[-1,-6],[1,-7],[0,-6],[0,-4],[2,-2],[1,-1],[3,-1],[2,-1],[0,-1],[0,-2],[0,-1],[1,-2],[1,0],[1,-3],[0,-3],[0,-1],[-3,0],[-2,0],[-3,0],[-1,1],[-1,0],[-1,1],[-1,2],[0,1],[-1,0],[-3,0],[0,1],[-2,-1],[-3,1],[-2,-3],[-2,0],[-1,0],[-2,0],[-1,-1],[-3,-3],[-1,-1],[-2,-1],[-3,1],[-2,0],[-1,-1],[-4,-3],[-1,-2],[1,-2],[1,-2],[-2,0],[-2,0],[-4,2],[-1,0],[-1,-1],[-1,-2],[0,-1],[-1,0],[-1,0],[-2,1],[-1,1],[-2,2],[-1,2],[-1,2],[-1,0],[-3,1],[-5,2],[-1,1],[-2,2],[-3,0],[-5,-2],[-4,0],[-2,0],[0,-1],[-1,-2],[0,-1],[-2,-2],[-2,-2],[-1,0],[-1,-1],[-2,0],[-1,0],[-1,1],[-2,2],[-1,2],[-1,5],[-1,2],[-1,1],[-2,0],[-2,1],[-5,4],[-2,0],[-5,1],[-1,1],[0,1],[-1,0],[0,4],[1,1],[0,2],[2,1],[2,1]],[[5421,8806],[1,0],[-1,2],[-1,3],[-1,1],[-1,-1],[-1,-2],[1,-2],[1,-1],[2,0]],[[5625,9328],[0,1],[1,3],[0,3],[0,1],[1,1],[1,1],[3,-2],[3,-1],[2,0],[1,1],[1,0],[0,1],[1,0],[1,-1],[1,-1],[0,-1],[1,-1],[1,0],[1,1],[1,1],[0,1],[0,1],[0,1],[1,0],[3,-1],[0,-1],[0,-1],[0,-1],[1,-1],[1,-1],[1,-1],[0,-1],[0,-2],[0,-1],[1,-2],[0,-2],[2,-2],[5,0]],[[5829,9265],[0,-1],[1,-6],[1,-3],[3,-2],[2,0],[1,-1],[2,-2],[1,-1],[3,-1],[1,-1],[0,-2],[-1,-3],[0,-1],[0,-1],[1,-2],[0,-1],[1,-6],[1,-2],[3,-2],[4,-3],[0,-1],[1,-1],[1,-1],[0,-2],[1,-1],[4,-2],[1,0],[0,-2],[-1,-2],[-2,-4],[-3,-4],[0,-4],[1,-3],[0,-2],[-2,-3],[-2,-3],[0,-1],[-1,1],[-1,1],[-3,-1],[-4,-1],[-1,-1],[-1,-3],[-1,-2],[-1,0],[-2,0],[-1,0],[0,-1],[0,-1],[1,-1],[-1,-1],[-2,-1],[-3,1],[-3,2],[-3,1],[-1,-1],[-2,-1],[0,-1],[-1,0],[-2,0],[-3,-2],[-1,0]],[[5541,9630],[-3,-3],[-1,-2],[-1,-1],[-2,1],[-1,0],[-8,-2],[-2,1],[-1,0],[-4,0],[-1,0],[-1,0],[-1,-1],[-4,0],[-1,-1],[-1,-1],[0,-1],[0,-1],[0,-1],[-1,-1],[0,-1],[0,-1],[0,-1],[0,-1],[1,-1],[0,-1],[1,-1],[-1,-1],[0,-1],[-1,-1],[0,-2],[-1,0],[-1,-2],[-2,-1],[-1,-1],[-1,-1],[-1,-2],[0,-2],[0,-2]],[[5471,9668],[0,2],[0,1],[1,1],[0,2],[1,2],[-1,8]],[[5472,9684],[0,3],[-1,4],[0,2],[1,4],[0,3],[0,2],[-1,5],[0,1],[0,2],[0,1],[-1,1],[-1,0]],[[5469,9712],[1,3],[1,5],[1,3]],[[5294,9779],[-6,-4],[-7,-1],[-7,1],[-6,2],[-2,0],[-1,0],[-2,1],[-2,1],[-1,1],[0,1],[-1,1],[-1,1],[1,2],[0,1],[4,8],[4,12],[1,2],[4,4],[1,0],[1,0],[11,6],[1,1],[10,7],[3,1],[4,2],[6,3],[8,0],[35,12],[2,1],[2,1],[3,4],[10,8]],[[5369,9858],[12,-9],[14,-15],[1,-2],[1,-6],[1,-2],[2,-3],[1,-2],[0,-1],[0,-1]],[[5472,9684],[-3,4],[-3,2],[-4,1],[0,1]],[[5449,9705],[2,2],[9,-2],[2,1],[5,5],[2,1]],[[5369,9858],[1,1],[5,6],[1,1],[1,1],[1,7],[3,5],[3,0],[9,-4],[1,0],[0,1],[-1,0],[0,1],[-1,0],[0,1],[2,0],[0,1],[-2,0],[-2,1],[-1,1],[-1,2],[0,1],[-4,2],[-1,1],[0,5],[1,5],[2,4],[2,-1]],[[5384,9010],[0,1],[0,3],[0,1],[1,1],[4,0],[1,0],[2,4],[3,3],[1,2],[0,3],[-1,2],[-1,2],[-2,2],[1,3],[2,1],[8,-4],[1,1],[1,3],[1,1],[4,2],[1,0],[2,0],[3,3],[3,-1],[1,1]],[[5859,9502],[-1,1],[-2,0],[-4,0],[-3,0],[0,1],[-1,0],[-1,0],[-1,-1],[-1,-1],[0,-1],[1,-2],[0,-2],[0,-1],[-2,-1],[-1,-1],[-1,0]],[[5833,9549],[1,-1],[2,0]],[[5435,9695],[-2,0],[-1,4],[2,3],[2,3],[1,0],[0,1],[0,2],[0,1],[-1,1],[-2,1],[-4,0],[-2,-1],[-1,-1],[-1,-5],[-2,-1],[-1,1],[-1,1],[1,3],[-2,3],[-1,1],[-1,1],[-2,0],[-5,-2],[-1,2],[-1,6],[-1,0],[0,1],[-2,1],[-2,0],[-1,-1],[-5,-3],[-2,0],[-1,3],[-2,1],[-1,1],[-3,0]],[[5783,8885],[0,-2],[-1,-1],[-2,0],[-1,-1],[-1,1],[-2,1],[0,1],[1,0],[2,0],[1,1],[1,0],[1,0],[0,1],[1,0],[0,-1]],[[5800,8885],[-1,-1],[0,2],[0,1],[2,0],[0,2],[1,1],[2,0],[1,1],[0,-1],[0,-1],[-1,0],[-1,-1],[-1,-2],[-2,-1]],[[5841,8949],[0,-1],[-1,-3],[-2,-2],[0,-1],[-2,0],[0,1],[-1,1],[0,-1],[0,-1],[0,-2],[-1,0],[-1,0],[-1,0],[-3,-1],[-1,2],[-2,0],[-1,0],[-1,-2],[0,-3],[-1,-2],[0,-3],[-2,0],[-2,0],[0,-2],[-1,-2],[-1,-1],[-2,-2],[-2,-2],[-1,-2],[2,-1],[5,2],[2,0],[0,-1],[-1,-3],[-1,-1],[0,-3],[0,-1],[1,-1],[-2,-2],[-2,-1],[-1,0],[-1,-1],[-1,0],[0,1],[-1,1],[-1,-1],[-1,0],[-2,0],[0,-1],[-1,-2],[-2,-1],[-2,0],[-3,0],[-2,0],[-2,-1],[-2,-1],[-1,-3],[0,-1],[1,-3],[-3,0],[-1,2],[-2,1],[-2,1],[-2,1],[-3,-1],[-3,-1],[-1,-1],[-1,-1],[-1,-3],[0,-3],[2,-1],[1,0],[-1,-1],[-2,0],[-5,-1],[0,1],[1,1],[1,0],[1,1],[0,3],[-2,2],[-1,-1],[-4,0],[-2,0],[-1,3],[-2,0],[-3,0],[-2,2],[1,0],[0,2],[-1,0],[-2,0],[-2,-1],[1,-1],[1,-3],[2,-1],[2,-1],[-1,-1],[-2,0],[-3,0],[-1,-1],[-1,-3],[-3,1],[-3,3],[-1,1],[2,1],[2,2],[-1,1],[-1,0],[-1,1],[-1,1],[0,1],[-1,0],[-2,0],[-4,2],[-1,3],[-1,2]],[[5058,9395],[1,-2],[-2,1],[-6,0],[-1,3],[0,1],[2,0],[1,0],[4,-2],[1,-1]],[[5066,9432],[3,-2],[1,-1],[0,-2],[0,-3],[0,-2],[-1,1],[-2,4],[-1,3],[-3,1],[-2,-1],[-1,2],[-2,5],[-1,3],[5,0],[1,0],[2,-2],[0,-1],[0,-2],[0,-2],[1,-1]],[[5157,9340],[-1,2],[-4,0],[-3,-2],[0,-5],[-2,1],[-2,2],[-2,3],[-1,0],[-1,1],[-2,1],[-2,2],[-1,1],[-5,-2],[-2,0],[-1,3],[0,4],[-2,2],[-2,2],[-2,0],[-6,1],[-2,0],[1,2],[-2,2],[-4,1],[-3,2],[-3,1],[-1,1],[0,1],[-1,3],[-1,1],[0,-1],[1,-2],[0,-2],[-1,0],[-1,0],[0,1],[-2,11],[0,2],[-1,1],[-1,1],[0,2],[-1,2],[-1,1],[-1,2],[-1,1],[-1,3],[-1,1],[-2,1],[-1,0],[-1,1],[-2,6],[-5,5],[-3,2],[-2,1],[-1,1],[-1,2],[0,3],[0,2],[0,3],[1,2],[2,1],[-1,2],[2,2],[3,2],[1,2],[1,5],[1,3],[2,1]]],"transform":{"scale":[0.011766411016101602,0.0072465569599440265],"translate":[-61.79784094999988,-21.3707821589999]}};
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
