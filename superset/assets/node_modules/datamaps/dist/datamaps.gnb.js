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
  Datamap.prototype.gnbTopo = {"type":"Topology","objects":{"gnb":{"type":"GeometryCollection","geometries":[{"type":"MultiPolygon","properties":{"name":"Biombo"},"id":"GW.BM","arcs":[[[0]],[[1,2,3,4]]]},{"type":"Polygon","properties":{"name":"Bissau"},"id":"GW.BS","arcs":[[5,-2,6]]},{"type":"MultiPolygon","properties":{"name":"Bolama"},"id":"GW.BL","arcs":[[[7]],[[8]],[[9]],[[10]],[[11]],[[12]],[[13]],[[14]],[[15]],[[16]],[[17]],[[18,19]]]},{"type":"Polygon","properties":{"name":"Cacheu"},"id":"GW.CA","arcs":[[-4,20,21]]},{"type":"Polygon","properties":{"name":"Oio"},"id":"GW.OI","arcs":[[22,23,-7,-5,-22,24]]},{"type":"Polygon","properties":{"name":"Quinara"},"id":"GW.QU","arcs":[[25,26,27,-19,28]]},{"type":"Polygon","properties":{"name":"Bafatá"},"id":"GW.BA","arcs":[[29,30,-26,31,-23,32]]},{"type":"Polygon","properties":{"name":"Gabú"},"id":"GW.GA","arcs":[[33,-30,34]]},{"type":"Polygon","properties":{"name":"Tombali"},"id":"GW.TO","arcs":[[-34,35,-27,-31]]}]}},"arcs":[[[2421,5478],[-11,-148],[-26,-69],[-32,-65],[-26,-79],[-28,-222],[-20,-92],[-39,-80],[-33,41],[-38,-9],[-37,-24],[-29,-8],[-41,45],[-82,210],[-38,33],[-39,0],[-32,13],[-13,71],[-2,159],[-6,74],[-14,58],[57,34],[63,-3],[115,-31],[44,11],[48,30],[97,83],[-12,23],[0,4],[7,9],[47,2],[43,4],[47,-7],[24,-49],[6,-18]],[[3599,5926],[-154,-484],[-20,-191],[-2,-98],[5,-147]],[[3428,5006],[-9,-6],[-211,-67],[-32,-32],[-31,-49],[-156,-140],[-62,-27],[67,463],[60,192],[79,9],[18,-21],[25,-14],[30,-6],[35,3],[0,39],[-62,7],[-76,111],[-62,-1],[-53,-67],[-13,-98],[-7,-108],[-105,-355],[-34,-34],[-64,28],[-13,73],[21,211],[-54,-45],[-13,-93],[-2,-113],[-22,-104],[-20,-18],[-72,-45],[-30,-34],[-33,-49],[-19,-9],[-13,26],[-13,52],[-8,113],[18,114],[57,205],[47,317],[20,76],[13,23],[20,24],[24,19],[22,8],[12,21],[22,139],[84,218],[27,51],[46,48],[69,48],[73,31],[57,-3],[17,-33],[13,-54],[17,-50],[32,-23],[64,-6],[29,-13],[28,-23],[11,81],[23,82],[13,70],[-3,4]],[[3329,6172],[1,1],[3,5],[131,122]],[[3464,6300],[104,-223],[11,-33],[20,-118]],[[3856,5539],[-12,-8],[-21,-21],[-96,-238],[-27,-38],[-65,-32],[-145,-150],[-62,-46]],[[3599,5926],[39,-120],[12,-21],[18,-24],[40,-22],[26,-21],[43,-90],[18,-27],[61,-62]],[[2695,1225],[22,-248],[23,-54],[23,-41],[10,-49],[-16,-74],[-39,-36],[-45,-5],[-33,16],[-26,-27],[-34,3],[-86,24],[-7,-13],[-21,-24],[-21,-10],[-9,28],[-1,46],[1,30],[10,16],[25,5],[34,15],[91,74],[20,28],[-15,64],[-37,21],[-33,-31],[-4,-93],[-24,38],[-21,44],[29,84],[15,67],[3,69],[-2,87],[-18,129],[5,74],[35,74],[63,-82],[50,-112],[33,-137]],[[2460,1322],[7,-168],[-10,-78],[-31,-85],[-70,-145],[-37,-41],[-17,67],[-11,90],[-19,71],[-4,73],[34,99],[-74,0],[-37,56],[-2,86],[26,89],[47,64],[174,95],[13,-47],[7,-77],[4,-149]],[[2160,1400],[-12,-58],[6,-85],[14,-53],[47,-116],[-47,0],[0,-42],[32,-110],[-12,-105],[-17,-85],[22,-51],[-67,-76],[-58,-4],[-57,7],[-67,-44],[-11,50],[-4,47],[4,47],[11,54],[-20,0],[-43,-120],[21,-78],[-41,22],[-11,15],[-15,41],[-75,-17],[-80,91],[-71,143],[-43,138],[42,75],[54,67],[55,34],[49,-21],[-45,-32],[-20,-7],[3,-25],[3,-18],[6,-16],[10,-22],[29,50],[37,29],[32,43],[26,194],[27,34],[30,20],[20,62],[16,-30],[51,-48],[8,140],[49,61],[66,-11],[54,-76],[22,-44],[-10,-32],[-20,-38]],[[2875,1560],[-81,-4],[-81,103],[-1,174],[51,182],[77,126],[85,1],[17,-58],[-35,-212],[-3,-237],[-29,-75]],[[3478,2038],[16,-188],[-6,-103],[-17,-22],[-20,65],[-30,74],[-47,8],[0,-43],[25,0],[0,-39],[-25,-77],[-17,-39],[-25,-37],[-18,45],[-9,15],[-40,-24],[18,-60],[3,-83],[-7,-90],[-14,-79],[-7,24],[-10,28],[-7,23],[-20,-3],[-8,-4],[-5,0],[-12,7],[-20,0],[-32,-65],[-31,30],[-22,77],[-6,78],[23,37],[37,44],[13,42],[-51,33],[0,35],[69,125],[3,24],[-6,68],[3,24],[16,7],[21,-7],[20,-2],[8,20],[34,114],[79,39],[83,-5],[51,-13],[-10,-103]],[[1701,2183],[30,-67],[36,-6],[43,10],[47,-15],[14,-41],[9,-75],[4,-74],[-3,-43],[-38,-28],[-32,-35],[-15,-54],[15,-82],[-214,-31],[-42,14],[-88,72],[-15,2],[4,68],[12,56],[22,38],[33,15],[-4,96],[45,91],[63,55],[50,-8],[24,42]],[[3465,3235],[7,-13],[6,-15],[11,-10],[21,3],[-3,-27],[-3,-17],[-16,-38],[18,-45],[-16,-46],[-71,-100],[-16,53],[-4,22],[-25,0],[-37,-62],[-53,0],[-46,41],[-18,60],[17,51],[26,6],[28,-13],[16,-2],[25,43],[18,46],[14,51],[10,55],[25,-43],[17,25],[49,57],[17,-23],[0,-16],[-17,-43]],[[1704,2983],[-10,-32],[-17,-24],[-28,-2],[-105,41],[-69,-2],[-39,10],[-46,28],[39,46],[59,53],[54,67],[24,89],[37,56],[84,42],[91,18],[57,-17],[16,-57],[-12,-54],[-97,-178],[-19,-26],[-11,-25],[-8,-33]],[[1584,3711],[4,-43],[-11,-103],[-25,-85],[-53,-124],[-13,-50],[-3,-34],[-7,-31],[-20,-13],[-33,0],[-33,-28],[-15,-9],[-11,-23],[-13,-12],[-19,23],[-43,83],[-13,16],[-7,-4],[-171,4],[-29,-45],[-26,-27],[-36,-6],[10,39],[14,39],[-20,71],[4,16],[16,30],[-32,32],[-14,7],[121,105],[134,5],[124,28],[88,173],[16,-8],[3,-3],[-1,-7],[7,-21],[24,0],[24,6],[22,13],[19,20],[12,-16],[6,-18]],[[2600,3716],[27,-4],[13,76],[40,-73],[-10,-153],[37,-50],[-41,-116],[-10,-138],[16,-140],[35,-116],[-65,-40],[-84,-83],[-72,-30],[-26,117],[-24,0],[-5,-27],[-9,-28],[-7,-26],[-10,21],[-24,39],[-10,21],[-19,-62],[-29,-46],[-33,-31],[-31,-17],[-31,75],[-112,136],[-14,62],[113,117],[74,137],[13,-1],[10,95],[25,123],[33,107],[33,45],[53,37],[74,133],[41,-10],[4,-91],[25,-59]],[[4090,4022],[-1,-78],[-36,-66],[-9,-71],[19,-63],[30,-58],[3,-41],[-62,-16],[-41,10],[-28,36],[-30,-7],[-5,-16],[-64,-101],[-16,-7],[-73,7],[0,-39],[69,-44],[-12,-90],[-46,-51],[-31,68],[-37,-18],[-44,8],[-37,18],[-16,11],[-16,-19],[-28,37],[-8,53],[40,27],[43,41],[30,86],[41,71],[76,-4],[6,87],[33,63],[40,56],[30,67],[55,-25],[50,26],[42,35],[33,7]],[[4240,4296],[1,1],[9,15],[111,46],[45,9],[18,-2],[60,-20],[36,-25],[1,-10]],[[4521,4310],[-28,-15],[22,-78],[-44,0],[13,-150],[15,-65],[39,-58],[-23,-78],[-49,60],[-43,81],[-66,171],[-10,-101],[23,-95],[33,-94],[21,-100],[-15,12],[-52,27],[-14,-77],[-28,-1],[-23,58],[-1,98],[-23,0],[-13,-52],[-9,-58],[-4,-63],[2,-64],[-29,24],[-11,14],[0,-113],[-34,38],[-13,51],[-9,61],[-24,64],[-19,64],[14,44],[38,47],[16,86],[34,88],[30,104],[3,56]],[[3329,6172],[-22,39],[-18,-21],[-31,-53],[-45,-45],[-61,2],[-20,23],[-22,66],[-25,28],[-29,15],[-13,-2],[-14,-8],[-124,-16],[-42,21],[-23,68],[-22,0],[-23,-94],[-61,-59],[-75,-32],[-66,-10],[9,-41],[4,-17],[10,-23],[-11,-5],[-8,0],[-4,-6],[0,-25],[-26,25],[-18,25],[1,-26],[11,-77],[-7,-71],[-27,-74],[-48,-75],[-45,-32],[-241,-6],[-32,-19],[-65,-52],[-26,-11],[-17,-19],[-21,-42],[-27,-40],[-37,-16],[-31,20],[-29,41],[-51,99],[-80,-32],[-104,34],[-91,66],[-38,66],[-67,252],[-32,31],[-87,23],[-37,27],[-28,53],[-20,71],[-13,81],[-11,175],[-32,145],[-7,79],[88,331],[35,72],[37,54],[40,41],[42,32],[2,-68],[16,-50],[25,-11],[28,51],[3,48],[-29,84],[2,63],[36,90],[56,58],[60,45],[240,242],[53,75],[25,54],[37,97],[29,44],[29,23],[72,30],[32,21],[-86,6],[-58,-42],[-45,-77],[-45,-99],[-66,-79],[-168,-60],[-68,-38],[-112,-125],[-32,-49],[-110,-216],[-62,44],[5,106],[24,128],[-2,112],[-17,-85],[-41,-113],[-20,-208],[-32,-82],[-50,-28],[-62,48],[-23,-39],[-9,25],[-37,53],[-7,-75],[-26,-34],[-40,-9],[-50,1],[-7,-21],[-20,-41],[-19,-25],[-9,27],[-6,23],[-14,19],[-18,13],[-63,20],[-31,39],[-18,56],[-6,65],[-20,30],[-78,153],[-2,35],[-23,22],[-69,100],[-30,31],[-16,-6],[-49,-32],[-25,2],[-19,28],[-30,89],[-17,39],[-122,163],[-36,32],[-49,0],[-37,-27],[-33,-33],[-39,-22],[-24,51],[74,88],[120,50],[442,-51],[60,4],[170,73],[164,3],[99,69],[261,241],[225,210],[34,12],[35,-11],[71,-47],[26,-8],[16,10],[14,19],[22,17],[246,73],[116,-18],[204,-117],[62,-19],[259,31],[32,-3],[563,-57],[112,40],[823,661],[9,12]],[[4259,9301],[8,-33],[60,-349],[12,-130],[-3,-78],[-7,-81],[-19,-126],[-16,-35],[-17,-23],[-16,-13],[-109,-131],[-19,-13],[-18,1],[-13,15],[-10,23],[-17,92],[-13,16],[-18,4],[-19,-2],[-16,-7],[-10,-2],[-15,-2],[-16,8],[-25,-8],[-32,-20],[-60,-74],[-33,-28],[-63,-40],[-124,-135],[-17,-36],[-18,-52],[-16,-26],[-65,-55],[-18,-7],[-62,7],[-23,-7],[-30,-21],[-10,-26],[1,-28],[4,-29],[-3,-36],[-13,-18],[-19,-10],[-20,-3],[-17,0],[-11,13],[-6,55],[-10,27],[-17,-18],[-20,-39],[-37,-86],[-3,-37],[7,-27],[7,-20],[-4,-36],[-26,-38],[-5,-25],[1,-25],[6,-23],[9,-24],[45,-86],[75,-109],[32,-62],[12,-18],[14,-16],[16,-14],[87,-48],[15,-16],[11,-22],[8,-24],[2,-45],[-4,-60],[-39,-234],[0,-35],[4,-31],[3,-39],[-1,-47],[-25,-166],[0,-36],[3,-27],[10,-45]],[[6050,9991],[37,-114],[6,-67],[-1,-66],[-6,-40],[-9,-29],[-51,-149],[-15,-56],[-32,-81],[-14,-47],[-20,-88],[-1,-48],[6,-34],[12,-18],[82,-96],[44,-73],[7,-17],[8,-22],[9,-30],[12,-49],[-4,-31],[-10,-23],[-13,-17],[-15,-13],[-17,-10],[-15,-14],[-39,-53],[-14,-15],[-52,-32],[-157,-55],[-17,-13],[-5,-30],[12,-561],[4,-35],[6,-30],[7,-25],[10,-21],[63,-89],[13,-25],[9,-46],[7,-77],[-9,-111],[-2,-263],[-7,-47],[-13,-16],[-36,10],[-63,6],[-19,6],[-17,8],[-86,80],[-11,7],[-12,4],[-16,0],[-17,-7],[-16,-10],[-18,-4],[-18,4],[-17,8],[-16,1],[-14,-10],[-13,-16],[-13,-19],[-31,-64],[-24,-66],[-6,-42],[1,-35],[102,-302],[14,-56],[12,-141],[6,-28],[10,-22],[15,-14],[37,-15],[27,-23],[17,-23],[132,-130],[10,-27],[-5,-30],[-12,-50],[-6,-40],[-1,-36],[1,-14],[5,-27],[22,-81],[8,-37],[1,-21],[-2,-17],[-5,-8],[-11,-13],[-12,-14],[-16,-12],[-17,-11],[-35,-13],[-37,3],[-9,4],[-1,1]],[[5654,5879],[-1,35],[-20,39],[-23,24],[0,20],[-34,18],[-37,4],[-31,-24],[-26,-8],[-72,50],[-36,15],[-46,-24],[-101,-105],[-52,-24],[-28,-38],[-93,-177],[-47,-57],[-74,-22],[-62,21],[-131,75],[-127,36],[-40,34],[-47,70],[-61,70],[-73,28],[-76,-5],[-72,-35],[-24,-26],[-53,-78],[-21,-16],[-70,6],[-37,-3],[-26,-21],[-103,-177],[-19,-20],[-35,-25]],[[4259,9301],[173,218],[198,156],[190,234],[84,66],[94,24],[159,-1],[893,-7]],[[5877,4805],[0,1],[14,74],[22,31],[34,5],[30,-24],[11,-40],[6,-44],[17,-51],[12,-50],[10,-20],[18,18],[15,10],[13,-2],[83,-65],[13,-23],[-12,-46],[-82,-167],[4,-30],[103,19]],[[6188,4401],[-77,-245],[-148,-377],[-44,-164],[-4,-33],[-4,-70],[3,-106],[-1,-35],[-5,-32],[-5,-29],[-8,-21],[-10,-23],[-14,-25],[-19,-42],[-38,-136],[-36,-92],[-19,-24],[-28,-23],[-127,-50],[-16,-10],[-31,-25],[-18,-9],[-78,-21],[-118,-73],[-23,2],[-26,8],[-36,32],[-20,25],[-15,23],[-51,112],[-11,16],[-12,11],[-26,17],[-54,69],[-59,52],[-16,10],[-60,-34],[-160,-231],[-30,-37],[-1,0]],[[4743,2811],[17,74],[-179,-251],[-66,-61],[-50,51],[-10,67],[16,174],[19,56],[38,70],[27,63],[-17,29],[-56,-25],[-43,-72],[-27,-97],[-10,-100],[-21,-66],[-46,-41],[-54,-32],[-37,-38],[-30,-90],[-17,-76],[-28,-52],[-67,-19],[-43,-24],[-36,-32],[-28,16],[-14,121],[10,61],[49,206],[16,45],[10,39],[91,234],[-57,4],[-20,39],[1,66],[9,85],[26,-27],[29,-3],[29,23],[30,50],[2,-37],[18,-84],[15,76],[24,64],[27,14],[23,-76],[24,0],[-3,57],[-8,51],[-15,48],[-20,43],[15,4],[3,6],[-1,9],[5,20],[30,-23],[35,-12],[46,-4],[55,-24],[18,18],[-26,84],[11,43],[11,74],[22,0],[27,-63],[45,11],[38,-3],[2,-101],[62,38],[-2,78],[-38,87],[-47,69],[-13,-15],[-12,-7],[-39,-17],[0,39],[71,43],[33,32],[31,46],[24,-71],[41,-82],[53,-45],[60,38],[-40,11],[-2,38],[6,54],[-8,57],[-26,22],[-28,-1],[-23,17],[-13,75],[38,-21],[71,-26],[25,-27],[45,39],[-7,-37],[-9,-82],[-9,-37],[81,-99],[24,8],[31,91],[-17,50],[-41,96],[-9,28],[9,39],[23,44],[28,37],[27,18],[7,-13],[25,-27],[34,-26],[36,-12],[21,-20],[11,-49],[5,-63],[-1,-63],[63,39],[-7,19],[-7,41],[-7,18],[49,-5],[34,-31],[26,-53],[25,-67],[-129,-44],[-47,1],[15,-30],[7,-22],[12,-15],[29,-10],[-14,-90],[18,-51],[28,4],[31,152],[38,7],[39,-14],[17,11],[104,10],[30,9],[37,33],[26,37],[17,52],[11,77],[-41,-23],[-29,-28],[-34,-22],[-109,-20],[-24,14],[-10,59],[7,26],[16,19],[22,11],[24,3],[-13,51],[-1,31],[14,74],[-37,15],[-30,-30],[-19,-62],[-5,-79],[-45,88],[-28,26],[-40,-1],[0,43],[23,22],[47,95],[0,39],[-24,77],[-22,0],[-45,-194],[-39,-16],[-49,48],[-45,7],[33,87],[47,39],[39,45],[14,105],[-27,-50],[-31,-27],[-30,2],[-25,36],[-20,0],[-3,-59],[-10,-36],[-20,-19],[-34,-6],[10,-84],[-24,-22],[-34,30],[-19,76],[-49,-123],[-28,33],[17,97],[80,70],[-29,37],[-11,46],[3,54],[17,59],[20,0],[14,-16],[13,-7],[40,-13],[-14,79],[-29,52],[-66,60],[-22,0],[-9,-93],[-23,-74],[-17,-78],[4,-106],[-34,-23],[-29,-73],[-28,-20],[-20,19],[9,53],[33,87],[-38,29],[-7,70],[23,171],[-32,-33],[-20,-49],[-11,-61],[-4,-70],[-13,-5],[-68,2],[-30,-15],[45,-39],[0,-43],[37,-45],[38,-40],[15,-51],[-12,-76],[-29,-19],[-31,24],[-18,52],[-16,-45],[-13,-48],[-9,-50],[-7,-52],[-25,220],[-20,77],[-16,-9]],[[4240,4296],[4,76],[-106,-175],[-56,-49],[-58,69],[15,49],[0,120],[5,68],[-43,3],[-26,-23],[-19,-33],[-21,-29],[-1,-18],[-25,-51],[-29,-30],[-14,41],[-11,95],[-18,93],[0,96],[60,155],[26,126],[23,58],[122,215],[36,43],[20,13],[9,19],[2,65],[8,56],[19,50],[42,69],[20,0],[9,-37],[10,-16],[12,-10],[13,-18],[13,53],[16,21],[19,-6],[21,13],[75,-4],[131,-62],[71,-15],[403,0],[17,19],[55,85],[17,20],[86,35],[54,82],[43,90],[52,62],[74,0],[14,-86],[-22,-116],[-33,-88],[-24,-108],[2,-143],[22,-140],[33,-98],[63,-49],[83,-24],[72,-42],[31,-102],[35,-65],[76,-30],[76,23],[34,94]],[[7775,9979],[-53,-188],[-14,-79],[-14,-39],[-16,-27],[-17,-10],[-18,-2],[-15,6],[-11,18],[-19,48],[-24,36],[-12,13],[-12,-11],[-6,-41],[15,-324],[11,-75],[9,-24],[12,-18],[33,-21],[21,-37],[13,-8],[12,-3],[6,-24],[-3,-41],[-18,-77],[-13,-39],[-11,-27],[-7,-7],[-6,-3],[-9,-2],[-15,4],[-6,6],[-11,12],[-21,37],[-14,17],[-15,11],[-19,-1],[-15,-10],[-13,-17],[-37,-67],[-10,-12],[-14,-8],[-13,2],[-10,11],[-5,13],[-12,50],[-11,16],[-16,8],[-36,-9],[-18,0],[-15,10],[-9,19],[-9,12],[-7,3],[-27,-17],[-16,-4],[-12,9],[-4,26],[4,37],[-1,29],[-15,22],[-16,-1],[-14,-13],[-8,-37],[-2,-52],[10,-101],[10,-52],[13,-36],[14,-12],[19,0],[16,8],[15,10],[45,46],[15,8],[15,-2],[14,-11],[12,-18],[43,-85],[9,-25],[6,-29],[0,-35],[-6,-34],[-19,-30],[-18,-10],[-16,-13],[-12,-18],[-9,-21],[-12,-13],[-13,1],[-11,16],[-15,46],[-8,15],[-8,5],[-13,-5],[-7,-24],[-1,-38],[16,-99],[7,-28],[3,-20],[-1,-19],[-12,-26],[-15,-17],[-18,-11],[-20,-6],[-19,-2],[-18,3],[-24,21],[-13,-3],[-13,-12],[-12,-19],[-10,-20],[-9,-23],[-4,-22],[4,-19],[15,-9],[9,-16],[-5,-25],[-8,-19],[-6,-11],[-3,-8],[1,-13],[5,-12],[54,-17],[15,-14],[11,-19],[19,-48],[11,-21],[13,-16],[15,-13],[56,-27],[14,-10],[28,-29],[24,-38],[9,-23],[5,-33],[0,-39],[-11,-67],[-9,-37],[-18,-55],[-4,-36],[0,-46],[52,-298],[5,-17],[7,-16],[10,-19],[13,-15],[15,-14],[33,-20],[14,-14],[11,-22],[3,-46],[-7,-67],[-27,-124],[-22,-43],[-20,-18],[-16,3],[-17,-5],[-13,-13],[-36,-51],[-14,-13],[-15,-7],[-16,1],[-40,14],[-19,-1],[-17,-7],[-15,-21],[-10,-35],[-6,-64],[0,-49],[11,-56],[13,-29],[14,-21],[27,-27],[48,-38],[13,-13],[9,-45],[-1,-75],[-15,-159],[-12,-69],[-12,-41],[-7,-12],[-6,-25],[0,-35],[9,-55],[10,-28],[12,-23],[67,-84],[11,-19],[5,-34],[-1,-45],[-40,-193],[-5,-50],[-2,-66],[7,-260],[18,-210],[-1,-107],[6,-37],[9,-30],[24,-36],[11,-21],[3,-29],[-5,-34],[-24,-47],[-19,-25],[-53,-40],[-13,-15],[-11,-15],[-13,-77],[-17,-318]],[[7240,4075],[-74,8],[-149,-27],[-73,-28],[-92,-68],[-30,-6],[-21,15],[-37,52],[-11,12],[-54,5],[-33,-19],[-87,-152],[-78,-43],[-90,65],[-82,121],[-53,128],[-16,94],[0,66],[-14,51],[-58,52]],[[5877,4805],[-85,-50],[-59,90],[-45,128],[-44,66],[-96,20],[-29,15],[-38,39],[-18,40],[-16,45],[-28,55],[-14,73],[29,69],[41,66],[21,67],[60,278],[3,36],[14,15],[48,4],[33,16],[0,2]],[[6050,9991],[263,-1],[1155,-9],[307,-2]],[[7484,3613],[-1,2],[-73,180],[-17,99],[0,42],[-12,83],[-141,56]],[[7775,9979],[848,-6],[1156,-9],[-26,-375],[5,-127],[31,-155],[164,-355],[37,-115],[9,-98],[-12,-98],[-57,-235],[-7,-48],[-4,-73],[11,-165],[-4,-66],[-26,-111],[-13,-150],[-1,-3],[-54,-142],[-94,-61],[-221,-4],[42,129],[-55,28],[-89,-37],[-62,-64],[-79,-111],[-198,-159],[-71,-139],[-8,-59],[-1,-122],[-13,-63],[25,-21],[85,-21],[66,-37],[62,-66],[64,-105],[33,-40],[89,-54],[15,-34],[8,-43],[18,-55],[72,-136],[38,-46],[53,-40],[115,-31],[31,-26],[36,-94],[4,-108],[-28,-231],[-11,-237],[50,-673],[-1,-102],[-17,-246],[-17,-75],[-51,-67],[-79,-54],[-84,-27],[-65,16],[-20,43],[7,42],[-2,37],[-47,23],[-27,29],[-11,114],[-28,35],[-49,2],[-10,-31],[15,-64],[-7,-131],[-10,-55],[-42,-108],[-56,-58],[-65,-2],[-71,61],[-26,-35],[-140,-147],[-61,-38],[-143,39],[-51,-2],[-98,-29],[-45,-3],[-54,21],[-31,32],[-28,43],[-28,35],[-33,10],[-76,-17],[-272,30],[-19,18],[-17,4],[-35,-33],[-25,-49],[-38,-137],[-22,-57],[-42,-57],[-303,-285]],[[7484,3613],[-289,-272],[-135,-42],[-270,54],[-135,-25],[-80,-75],[-58,-112],[-323,-817],[-49,-215],[-65,-448],[-313,-1044],[-109,-225],[0,-1],[-93,-164],[-126,-154],[-83,-73],[-38,10],[9,75],[23,39],[29,25],[28,36],[48,129],[21,30],[0,39],[-24,0],[-14,-53],[-16,-46],[-24,-36],[-35,-21],[-38,-2],[-36,14],[-27,32],[-10,52],[58,419],[19,70],[35,32],[20,74],[16,84],[19,65],[19,16],[41,-4],[17,9],[3,22],[-5,76],[2,19],[136,20],[-6,48],[-17,38],[-21,30],[-23,20],[44,80],[26,108],[-4,101],[-46,62],[-29,-149],[-49,-108],[-65,-67],[-79,-27],[18,-91],[-14,-57],[-32,-12],[-37,43],[-7,-29],[-9,-23],[-6,-26],[-2,-39],[-13,15],[-33,24],[-2,-109],[-19,-52],[-33,-36],[-45,-59],[-37,-83],[-48,-161],[-85,-198],[-35,-60],[-40,-25],[-42,33],[-51,75],[-37,85],[-4,61],[36,45],[97,84],[35,46],[17,66],[25,249],[-35,481],[35,139],[-73,-19],[-19,-85],[11,-110],[17,-97],[4,-87],[-4,-138],[-23,-99],[-85,58],[-115,-4],[-34,18],[-25,24],[-18,23],[-14,13],[-76,-19],[-40,11],[-18,65],[-8,62],[-24,42],[-32,23],[-37,8],[-48,59],[-12,138],[4,274],[8,61],[-2,39],[-17,17],[-21,0],[-10,7],[-4,17],[-1,36],[4,61],[17,75],[3,60],[17,53],[82,192],[35,48],[21,-8],[66,-54],[37,-12],[33,17],[46,78],[33,18],[33,32],[39,76],[33,90],[0,1]]],"transform":{"scale":[0.0003068031747314899,0.00017519700320031987],"translate":[-16.728436777140104,10.92763906500008]}};
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
