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
  Datamap.prototype.gnbTopo = '__GNB__';
  Datamap.prototype.gnqTopo = '__GNQ__';
  Datamap.prototype.grcTopo = '__GRC__';
  Datamap.prototype.grdTopo = '__GRD__';
  Datamap.prototype.grlTopo = '__GRL__';
  Datamap.prototype.gtmTopo = {"type":"Topology","objects":{"gtm":{"type":"GeometryCollection","geometries":[{"type":"Polygon","properties":{"name":"Baja Verapaz"},"id":"GT.BV","arcs":[[0,1,2,3]]},{"type":"Polygon","properties":{"name":"Huehuetenango"},"id":"GT.HU","arcs":[[4,5,6,7,8]]},{"type":"Polygon","properties":{"name":"Petén"},"id":"GT.PE","arcs":[[9,10,11]]},{"type":"Polygon","properties":{"name":"Quezaltenango"},"id":"GT.QZ","arcs":[[12,13,14,15,16,-6]]},{"type":"Polygon","properties":{"name":"Retalhuleu"},"id":"GT.RE","arcs":[[17,18,19,-16]]},{"type":"Polygon","properties":{"name":"San Marcos"},"id":"GT.SM","arcs":[[-17,-20,20,-7]]},{"type":"Polygon","properties":{"name":"Alta Verapaz"},"id":"GT.AV","arcs":[[21,22,23,-4,24,25,-11]]},{"type":"Polygon","properties":{"name":"Chimaltenango"},"id":"GT.CM","arcs":[[26,27,28,29,30,31]]},{"type":"Polygon","properties":{"name":"Escuintla"},"id":"GT.ES","arcs":[[32,33,34,35,-29,36]]},{"type":"Polygon","properties":{"name":"Guatemala"},"id":"GT.GU","arcs":[[37,38,39,-33,40,-27,-2]]},{"type":"Polygon","properties":{"name":"Suchitepéquez"},"id":"GT.SU","arcs":[[-30,-36,41,-18,-15,42]]},{"type":"Polygon","properties":{"name":"Sacatepéquez"},"id":"GT.SA","arcs":[[-37,-28,-41]]},{"type":"Polygon","properties":{"name":"Sololá"},"id":"GT.SO","arcs":[[-31,-43,-14,43,44]]},{"type":"Polygon","properties":{"name":"Totonicapán"},"id":"GT.TO","arcs":[[45,-44,-13,-5]]},{"type":"Polygon","properties":{"name":"El Progreso"},"id":"GT.PR","arcs":[[46,-38,-1,-24,47]]},{"type":"Polygon","properties":{"name":"Santa Rosa"},"id":"GT.SR","arcs":[[48,49,-34,-40,50]]},{"type":"Polygon","properties":{"name":"Izabal"},"id":"GT.IZ","arcs":[[51,-22,-10,52]]},{"type":"Polygon","properties":{"name":"Chiquimula"},"id":"GT.CQ","arcs":[[53,54,55,56]]},{"type":"Polygon","properties":{"name":"Jalapa"},"id":"GT.JA","arcs":[[57,-56,58,-51,-39,-47]]},{"type":"Polygon","properties":{"name":"Jutiapa"},"id":"GT.JU","arcs":[[59,-49,-59,-55]]},{"type":"Polygon","properties":{"name":"Zacapa"},"id":"GT.ZA","arcs":[[60,-57,-58,-48,-23,-52]]},{"type":"Polygon","properties":{"name":"Quiché"},"id":"GT.QC","arcs":[[-3,-32,-45,-46,-9,61,-25]]}]}},"arcs":[[[5647,3493],[-67,-36],[-96,-62],[-212,-135],[-394,-262],[-40,-119],[-12,-39],[-126,-20],[-83,14],[-31,29]],[[4586,2863],[-11,28],[-19,16],[-40,-8],[-21,-14],[-6,-14],[-10,-12],[-33,-8],[-28,-3],[-24,3],[-19,11],[-12,22],[-18,0],[-41,-22],[-63,-21],[-62,-13],[-38,6],[-15,0],[-12,-6],[-10,-3],[-13,5],[-19,21],[-37,-7],[-89,31]],[[3946,2875],[-28,62],[-11,24],[-18,16],[-17,10],[-17,14],[-44,45],[11,53],[1,11],[-224,134],[-185,229],[15,265],[21,-10],[412,-92],[291,-13],[82,7],[93,121]],[[4328,3751],[58,-2],[57,-1],[83,-2],[59,2],[53,-16],[137,-89],[27,-25],[7,-2],[10,1],[25,13],[10,10],[30,36],[12,10],[17,23],[20,76],[1,15],[3,5],[6,12],[4,5],[4,4],[11,7],[33,-2],[120,-27],[271,-37],[97,4],[82,31],[22,5],[112,9],[8,-2],[9,-3],[19,-10],[28,-25],[11,-14],[6,-11],[5,-12],[-2,-25],[-27,-71],[-109,-150]],[[2312,3753],[-64,5],[-29,-5],[-60,-26],[-38,-27],[-108,-24],[-25,-7],[-12,-5],[-9,-9],[-33,-47],[-15,-27],[-1,-6],[-6,-62],[-1,-7],[-11,-6],[-10,-4],[-83,-5]],[[1807,3491],[-49,57],[-8,22],[1,24],[-19,15],[-167,41]],[[1565,3650],[-13,33],[-24,23],[-25,16],[-49,40],[-46,47],[-41,54],[-35,61],[-12,33],[-2,9],[-38,0],[-136,-37],[-52,4],[-85,51],[-22,9],[-16,-1],[-17,-6],[-42,-24],[-75,-45],[-81,-6],[-34,-21],[-84,-92],[-7,-8],[-127,5],[-28,21],[-24,253],[-6,37],[-37,13],[-43,52],[-15,51]],[[349,4222],[92,152],[196,323],[197,323],[171,282],[121,199],[46,76],[56,92],[30,36],[40,19],[113,1],[342,0],[343,1],[342,0],[342,1],[329,0]],[[3109,5727],[-305,-576],[-24,-45],[-162,-314],[-6,-8],[-46,-42],[3,-16],[3,-5],[2,-6],[-5,-4],[-9,-3],[-22,-2],[-10,-2],[-10,-14],[-67,-45],[-8,-1],[-16,0],[-7,-1],[-7,-2],[-6,-3],[-30,-25],[-11,-3],[-9,-2],[-8,1],[-7,-5],[-6,-10],[-3,-29],[-7,-23],[-14,-28],[-8,-11],[-6,-15],[-3,-8],[-3,-57],[-14,-22],[-5,-12],[-1,-6],[-2,-8],[0,-8],[2,-15],[2,-6],[2,-7],[6,-11],[3,-5],[3,-5],[7,-11],[50,-58],[4,-7],[2,-8],[0,-31],[3,-14],[10,-23],[15,-21],[15,-17],[47,-41],[10,-2],[14,-1],[72,9],[32,-6],[69,-31],[5,-44],[-21,-88],[2,-14],[15,-36],[12,-49],[-38,-9],[-22,-2],[-61,10],[-23,0],[-56,-18],[-108,-19],[-19,-13],[-12,-21]],[[7477,5327],[-1,2],[-2,1],[-13,10],[-58,8],[-229,-5],[-28,-28],[-16,-40],[-5,-17],[-3,-8],[-4,-8],[-10,-9],[-29,-16]],[[7079,5217],[-74,-18],[-30,-13],[-20,2],[-42,21],[-53,-10],[-66,-29],[-3,0],[-2,2],[-6,128],[-2,6],[-10,4],[-16,1],[-35,-1],[-15,-4],[-11,-3],[-5,-4],[-6,-3],[-6,-2],[-7,-2],[-10,0],[-154,20],[-17,-1],[-29,-23],[-6,-3],[-6,-2],[-13,-3],[-34,2],[-11,3],[-14,7],[-52,34],[-39,31],[-7,4],[-59,26],[-7,2],[-8,1],[-9,-7],[-13,-7],[-7,-1],[-22,2],[-7,-1],[-7,-2],[-5,-3],[-4,-4],[-10,-15],[-3,-3],[-3,-2],[-5,-3],[-13,-4],[-84,-4],[-38,6],[-11,0],[-9,-1],[-7,-1],[-8,2],[-9,8],[-11,22],[-4,12],[-7,14],[-32,42],[-9,15],[-7,10],[-6,3],[-14,-2],[-24,3],[-43,28],[-11,-11],[-6,-3],[-28,6],[-43,31],[7,17],[-1,5],[-5,4],[-7,4],[-3,6],[0,1],[1,2],[2,4],[1,6],[0,6],[-4,4],[-5,4],[-19,7],[-5,1],[-4,-1],[-1,-7],[5,-19],[1,-5],[0,-3],[-1,-2],[-5,-3],[-20,-3],[-7,-3],[-7,-2],[-6,2],[-10,10],[-4,1],[-6,0],[-14,-3],[-9,2],[-7,8],[-2,8],[-7,7],[-11,3],[-27,-4],[-11,-6],[-7,-6],[-1,-5],[-1,-3],[-1,-1],[-4,-3],[-16,2],[-423,129],[-506,74],[-68,-7]],[[4467,5751],[9,12],[17,35],[7,20],[-14,-5],[-6,-2],[-4,-2],[-9,-9],[-19,0],[-10,42],[60,48],[-31,29],[0,15],[54,21],[-16,25],[-72,39],[-10,46],[18,34],[30,22],[29,13],[-33,13],[-25,19],[-4,24],[29,29],[10,-10],[8,-4],[32,-4],[-9,13],[-15,27],[-9,13],[11,-1],[3,3],[0,7],[2,6],[15,-9],[21,-6],[15,6],[0,26],[-15,-6],[-36,13],[-25,18],[17,9],[46,14],[36,33],[15,40],[-21,31],[-17,0],[0,-18],[-17,0],[7,34],[23,13],[34,-2],[38,-10],[-28,45],[-4,14],[0,33],[-5,35],[-14,3],[-22,-9],[-29,-4],[-14,6],[-19,12],[-25,10],[-78,10],[-7,14],[4,21],[-13,27],[-15,13],[-24,16],[-27,8],[-60,-28],[-15,22],[-12,52],[-24,1],[-64,-19],[-14,-6],[-14,8],[-35,7],[-40,1],[-31,-8],[13,23],[22,18],[17,18],[-1,26],[-29,16],[-38,3],[-21,9],[20,37],[-9,40],[16,41],[8,35],[-33,19],[-8,-16],[-8,-8],[-13,-4],[-21,-4],[0,15],[33,58],[-34,88],[-168,230],[-36,27],[-89,42],[-36,29],[8,29],[0,17],[-34,18],[-23,-19],[-29,1],[-171,50],[-46,25],[-73,70],[-51,23],[40,41],[-6,19],[-34,6],[-43,0],[-4,-11],[9,-22],[2,-22],[-24,-11],[-13,7],[-31,32],[-15,11],[-95,33],[-29,25],[-11,50],[-14,26],[-88,100],[-10,22],[-12,47],[-14,15],[-26,4],[-60,-6],[-25,10],[-88,92],[-23,33],[-10,25],[-13,43],[-11,18],[-22,12],[-51,13],[-10,15],[-5,38],[-14,45],[-22,38],[-27,22],[-68,4],[-66,-10],[-51,8],[-20,58],[-38,20],[-77,15],[-57,25],[10,38],[12,2],[7,1],[1090,-7],[1,673],[1,673],[20,21],[52,13],[107,0],[546,-1],[546,0],[546,-1],[546,0],[546,-1],[546,0],[546,-1],[546,0],[11,-529],[13,-678],[4,-697],[-42,-634],[-45,-688],[-22,-252],[-38,-505],[-64,-566],[-5,-119]],[[1807,3491],[-44,-13],[-127,-48],[-5,-3],[-6,-3],[-5,-20],[13,-71],[61,-222],[10,-36],[19,-23],[41,-36],[0,-29],[-6,-13],[0,-15],[5,-17],[39,-44],[4,-5],[3,-5],[17,-5],[48,5],[53,2],[21,-48],[8,-73],[27,-24],[49,-81]],[[2032,2664],[-30,-96],[-73,-95]],[[1929,2473],[-101,-66]],[[1828,2407],[-40,16],[-30,3],[-15,-5],[-51,-33],[-14,-6],[-12,-4],[-9,0],[-13,3],[-15,5],[-26,7],[-9,-1],[-7,-3],[-8,-8],[-15,-21],[-2,-5],[-13,-17],[-18,-20],[-9,-3],[-7,0],[-15,9],[-15,4],[-8,-4],[-5,-4],[-7,-16],[-24,-21],[-19,1],[-15,4],[-31,5],[-12,6],[-7,7],[7,43],[36,81],[4,30],[-3,5],[-4,6],[-7,2],[-8,1],[-11,-2],[-7,-2],[-7,-4],[-11,-7],[-18,-15],[-34,-35],[-89,-42],[-16,-25],[-22,-67],[-11,-24],[-45,-63],[-11,-23],[-8,-22],[-9,-35],[-6,-16],[-5,-10],[-25,-27],[-77,-111],[-104,-23],[-72,-6],[-28,4],[-146,60],[-11,3],[-6,-1],[-13,-5],[-20,-14]],[[570,1962],[-59,167],[-22,42],[-7,3],[-21,5],[-147,15],[-13,3],[-21,8],[-8,7],[-3,7],[10,15],[85,94],[68,52],[29,14],[53,10],[218,60],[156,-16],[70,-4],[25,3],[21,8],[25,15],[32,56],[6,8],[11,13],[33,23],[9,9],[6,9],[3,7],[66,136],[5,6],[18,32],[17,92],[23,30],[4,23],[-2,17],[3,10],[3,7],[20,11],[19,8],[73,68],[20,26],[9,25],[16,105],[-10,39],[-47,38],[-30,68],[23,73],[48,66],[45,47],[86,66],[16,16],[11,46]],[[1828,2407],[-75,-63],[-56,-60],[-7,-10],[-8,-15],[-1,-7],[-2,-27],[2,-32],[2,-24],[-98,-192],[-2,-15],[1,-8],[1,-7],[-20,-143],[2,-15],[4,-13],[5,-12],[31,-54],[2,-18],[-12,-159],[2,-33],[-1,-15],[-3,-12],[-28,-40],[-31,-90],[-11,-73],[-5,-80],[-3,-16],[-3,-5],[-71,-101],[15,-98],[2,-20]],[[1460,950],[-259,154],[-361,254],[-352,303],[-280,194]],[[208,1855],[0,1],[4,6],[7,3],[10,1],[26,-6],[13,1],[12,5],[22,16],[22,19],[9,3],[12,3],[25,-2],[23,-5],[13,-4],[7,-1],[8,-1],[7,1],[9,4],[10,7],[28,29],[21,9],[74,18]],[[208,1855],[-208,145],[50,7],[45,52],[54,144],[53,95],[10,37],[-2,46],[-44,121],[-2,18],[3,35],[-1,20],[-23,60],[-5,20],[-2,52],[12,29],[51,58],[28,73],[-7,152],[9,81],[29,28],[31,8],[32,4],[33,13],[25,29],[49,108],[-321,400],[-19,40],[-1,45],[16,43],[46,76],[121,199],[79,129]],[[7079,5217],[-68,-87],[-25,-19],[-48,-5],[-9,-4],[-6,-5],[-13,-22],[-2,-7],[-30,-52],[-10,-12],[-9,-7],[-26,-11],[-41,-28],[-13,-6],[-26,-7],[-7,-5],[-5,-7],[-6,-12],[-156,-210],[-140,-188],[-18,-41],[7,-2],[11,-6],[5,-4],[5,-6],[3,-4],[10,-15],[55,-56],[19,-28],[22,-23],[32,-28],[9,-14],[4,-9],[-20,-31],[-4,-6],[-4,-12],[-7,-27],[-6,-12],[-4,-5],[-4,-5],[-4,-4],[-6,-4],[-47,-21],[-15,-11],[-4,-5],[-22,-286],[0,-37],[3,-9],[10,-23],[6,-11],[16,-21],[14,-24],[2,-10],[0,-13],[-8,-40],[0,-13],[0,-11],[5,-13],[11,-23],[45,-60]],[[6560,3550],[-172,-38],[-79,5],[-159,-23],[-29,6],[-87,31],[-57,2],[-26,-3],[-68,-29]],[[5883,3501],[-73,-18],[-41,-4],[-122,14]],[[4328,3751],[17,21],[23,41],[23,57],[2,49],[-39,22],[-391,57],[-77,29],[-52,47],[-12,35],[-5,44],[10,39],[33,16],[100,9],[30,15],[-20,26],[0,17],[69,59],[14,7],[27,26],[17,29],[-16,14],[-13,23],[-17,50],[-25,51],[-38,25],[22,40],[-2,35],[-25,31],[-47,29],[-1,12],[4,3],[7,0],[8,2],[-20,11],[-23,4],[-22,-4],[-21,-11],[-30,15],[-105,30],[-92,15],[-19,23],[9,28],[34,22],[-15,8],[-36,27],[0,15],[12,4],[11,9],[12,6],[-16,22],[-24,12],[-29,3],[-33,-4],[16,36],[68,81],[33,86],[10,14],[60,23],[26,47],[-15,43],[-62,6],[24,81],[19,36],[25,16],[0,17],[-13,2],[-2,3],[1,4],[-5,8],[-17,-17],[-22,24],[-10,8],[0,18],[33,8],[39,30],[28,12],[7,-7],[7,-17],[12,-10],[17,10],[10,20],[-5,13],[-1,11],[23,14],[-19,33],[106,55],[64,13],[35,-35],[17,0],[8,20],[12,9],[14,0],[17,-10],[0,-19],[-11,-4],[-12,-7],[-12,-4],[0,-18],[41,2],[25,-14],[22,-20],[33,-17],[8,8],[16,14],[10,10],[5,-15],[2,0],[3,7],[6,8],[18,-16],[8,1],[9,15],[17,0],[26,-11],[48,29],[29,-18],[16,0],[4,12],[8,11],[5,12],[30,-10],[25,10],[11,22],[-15,27],[21,27],[5,23],[-12,19],[-30,15]],[[4466,5750],[1,0],[0,1]],[[3946,2875],[-6,-38],[-2,-6],[-2,-7],[-3,-6],[-5,-7],[-9,-7],[-11,-8],[-27,-9],[-12,-6],[-38,-29],[-12,-4],[-10,-1],[-7,2],[-7,1],[-6,-1],[-6,-3],[-11,-7],[-10,-9],[-15,-24],[-23,-73],[-45,-67]],[[3679,2566],[-39,-67],[-7,-31],[14,-71],[8,-23],[7,-43],[1,-15],[-1,-11],[-7,-12],[-15,-18],[-33,-69],[-62,-43],[-112,-119],[-54,-100],[-14,-67],[2,-14],[1,-3]],[[3368,1860],[-67,-50],[-52,-47],[-17,-21],[-3,-6],[-15,-36],[-47,-92],[-18,-8],[-7,7],[-4,6],[-1,8],[0,20],[-5,40],[-7,9],[-6,5],[-7,-2],[-9,-7],[-13,-14],[-7,-4],[-9,-3],[-18,-2],[-13,6],[-15,9],[-25,21],[-13,8],[-11,4],[-7,-1],[-7,-2],[-7,-2],[-33,-18],[-8,-3],[-12,-3],[-22,-3],[-11,2],[-12,5],[-6,6],[-35,24]],[[2819,1716],[35,91],[0,32],[5,55],[-5,24],[-9,11],[-16,17],[-17,15]],[[2812,1961],[21,195],[0,54],[8,23],[20,27],[51,117],[-6,52],[2,9],[17,47],[-40,184],[-6,16]],[[2879,2685],[66,31],[18,14],[56,151],[16,25],[5,4],[4,3],[24,11],[43,11],[41,25],[46,-9],[161,4],[29,6],[35,6],[38,1],[119,-34],[128,0],[42,-5],[73,-24],[89,-18],[34,-12]],[[3964,1810],[32,-91],[36,-31],[21,-6],[32,0],[7,-1],[6,-2],[11,-33],[16,-126],[-2,-81],[8,-29],[30,-67],[15,-53]],[[4176,1290],[-36,-34],[-15,-27],[-8,-27],[0,-12],[4,-7],[6,-3],[10,-3],[34,-6],[16,-1],[16,1],[7,1],[39,13],[9,1],[11,-2],[22,-10],[6,-8],[2,-7],[-31,-38],[-40,-36],[-16,-10],[-7,-3],[-46,-7],[-16,-7],[0,-34],[9,-16],[5,-5],[35,-32],[5,-11],[1,-8],[-3,-5],[-7,-10],[-10,-7],[-33,-19],[-12,-12],[-19,-34],[-7,-24],[-6,-4],[-8,-3],[-27,-4],[-28,-7],[-11,-11],[-5,-12],[-1,-304],[0,-27]],[[4021,469],[-26,4],[-172,16],[-192,-18],[-29,-8],[-284,-17],[-331,6],[-303,32],[-374,71],[-527,224]],[[1783,779],[0,2],[-3,20],[-8,38],[2,12],[6,13],[120,171],[21,42],[11,19],[13,12],[16,20],[3,39],[-6,99],[-9,57],[-1,20],[1,30],[4,17],[4,8],[26,15],[20,-13],[8,-12],[7,-18],[3,-6],[7,-2],[10,3],[17,10],[9,7],[5,7],[-1,6],[-2,6],[-12,22],[-5,12],[-4,21],[-2,16],[1,15],[5,20],[5,12],[4,5],[9,9],[71,50],[11,5],[20,7],[10,-4],[11,-8],[16,-24],[4,-12],[1,-9],[-18,-26],[-3,-6],[-2,-6],[0,-7],[3,-6],[3,-6],[12,-16],[3,-8],[0,-7],[-5,-21],[-1,-7],[1,-7],[2,-7],[6,-8],[10,-10],[13,-7],[9,-4],[16,-2],[25,0],[20,12],[46,48],[26,-25],[-12,-59],[16,-4],[290,-20],[15,9],[22,42],[11,16],[4,9],[2,14],[8,117],[16,42],[70,138]],[[3368,1860],[73,-60],[20,-21],[2,-6],[2,-7],[19,-38],[31,-49],[15,-17],[12,-8],[66,54],[17,18],[4,5],[12,22],[11,14],[6,5],[5,3],[21,12],[36,0],[15,8],[12,19],[17,4],[9,-6],[4,-6],[27,-56],[160,60]],[[4586,2863],[-30,-53],[-7,-6],[-7,-10],[0,-10],[3,-13],[4,-8],[4,-6],[5,-4],[5,-3],[6,-2],[16,-2],[15,1],[35,10],[57,4],[18,-6],[4,-6],[11,-22],[23,-61],[9,-60],[-3,-20],[-4,-4],[-3,-4],[-10,-13],[-10,-17],[-3,-11],[1,-11],[2,-5],[11,-21],[52,-53],[23,-17],[145,-50],[34,-16],[15,-12],[27,-31],[26,-8]],[[5060,2313],[-22,-55],[-12,-17],[-5,-4],[-21,-13],[-81,-65],[-14,-58],[-1,-38],[-7,-20],[-6,-11],[-9,-8],[-5,-15],[-2,-12],[-4,-76]],[[4871,1921],[-29,-13],[-22,0],[-21,-7],[-13,-14],[-48,-42],[-16,-9],[-11,-3],[-5,5],[-2,5],[-3,6],[-3,30],[-5,7],[-7,7],[-18,4],[-11,-1],[-42,-18],[-102,-154],[-46,-112],[14,-114],[-4,-31],[-12,-13],[-5,-4],[-5,-4],[-5,-3],[-7,-2],[-8,-4],[-8,-7],[-20,-24],[-5,-3],[-6,-2],[-15,-3],[-19,-7],[-48,-22],[-47,-42],[-20,-12],[-71,-25]],[[3964,1810],[21,92],[18,196],[13,30],[21,22],[-5,29],[14,45],[-2,18],[-3,6],[-24,26],[-33,37],[-22,70],[-75,91],[-25,23],[-7,2],[-8,0],[-30,-5],[-24,1],[-24,5],[-32,18],[-58,50]],[[1783,779],[-58,24],[-212,116],[-53,31]],[[1929,2473],[12,-15],[7,-11],[31,-79],[3,-13],[1,-8],[-12,-35],[-59,-108],[36,-33],[114,-15],[33,-9],[12,34],[2,18],[-1,31],[0,7],[2,7],[4,7],[7,7],[12,8],[9,4],[15,5],[19,-2],[37,-17],[29,-31],[2,-2],[55,5],[28,6],[10,-2],[7,-2],[26,-27],[72,-61],[11,-13],[5,-10],[4,-20],[1,-23],[-1,-7],[-6,-28],[0,-7],[1,-7],[7,-5],[7,-4],[56,8],[69,35],[22,3],[26,-1],[14,-3],[24,-8],[33,-20],[97,-71]],[[2032,2664],[9,8],[114,92],[22,7],[29,4],[57,-8],[23,-6],[14,-6],[18,-2],[51,21],[34,0],[18,-3],[39,-13],[8,-1],[16,0],[14,2],[27,8],[35,33],[33,45],[48,46]],[[2641,2891],[30,-13],[13,-33],[24,-40],[15,-11],[7,-1],[7,-1],[11,-1],[13,-4],[29,-10],[11,-8],[5,-8],[-2,-6],[-6,-12],[-7,-10],[-21,-22],[-3,-5],[-2,-10],[0,-13],[3,-26],[5,-12],[7,-6],[7,-1],[8,0],[6,2],[5,4],[4,4],[4,5],[2,6],[10,33],[12,7],[41,-14]],[[2312,3753],[-11,-68],[-1,-44],[13,-38],[33,-16],[8,-17],[69,-68],[17,-7],[13,-48],[24,-33],[3,-33],[18,-6],[15,-27],[0,-13],[-2,-25],[-6,-9],[-7,-6],[-26,0],[-11,-3],[-12,-5],[-20,-15],[-9,-11],[-6,-16],[-1,-19],[0,-8],[1,-7],[3,-6],[4,-5],[27,-16],[44,-32],[5,-7],[7,-12],[12,-44],[17,-26],[41,-28],[7,-13],[1,-16],[-14,-40],[-6,-16],[79,-59]],[[5992,2808],[-39,2],[-32,-1],[-14,-3],[-14,-5],[-34,-29],[-87,-104],[-72,-38],[-75,-26],[-84,-10],[-57,-16],[-77,-138],[-10,-10],[-11,-5],[-20,6],[-31,14],[-37,5],[-84,-27],[-65,-24],[-10,-6],[-5,-7],[-2,-16],[-10,-26],[-40,-22],[-17,-7],[-5,-2]],[[5883,3501],[92,-126],[110,-159],[3,-33],[-121,-3],[-11,-1],[-10,-4],[2,-10],[7,-11],[109,-144],[20,-27],[30,-15],[32,-5],[12,-7],[7,-8],[-6,-48],[-5,-12],[-10,-4],[-12,-2],[-53,-1],[-31,-13],[-56,-60]],[[5451,1724],[-45,-135],[-35,-4],[8,-46],[-3,-8],[-6,-2],[-12,4],[-12,6],[-28,1],[-86,-16],[-5,-4],[-33,-28],[-89,-210],[36,-25],[115,-31],[14,-6],[10,-7],[17,-17],[77,-61],[61,-57],[12,-24],[-4,-54],[12,-97],[-1,-7],[-2,-14],[-7,-21],[-13,-28],[-44,-59],[-14,-14],[-6,-3],[-33,-6],[-29,-8],[-14,-8],[-8,-6],[-16,-27],[-39,-70],[-38,-26],[-9,-1],[-10,-1],[-25,10],[-97,22],[-13,5],[-48,39],[-70,39],[-45,-12],[-15,-11],[-4,-9],[-3,-14],[1,-13],[1,-9],[9,-17],[8,-10],[13,-13],[4,-10],[18,-101],[2,-5],[5,-5],[5,-3],[12,-6],[8,-12],[8,-19],[24,-86],[32,-55],[4,-13],[2,-12],[-1,-43],[-16,-61],[-9,-34]],[[4982,146],[-12,5],[-387,166],[-246,89],[-199,45],[-117,18]],[[4871,1921],[31,-31],[5,-7],[10,-7],[5,-2],[35,4],[32,6],[273,49],[12,-58],[23,-33],[88,-70],[66,-48]],[[7699,3284],[-2,1],[-6,5],[-18,8],[-11,7],[-48,56],[-5,13],[-15,69],[-4,39],[2,23],[-1,15],[-20,78],[0,16],[3,10],[31,12],[10,7],[5,4],[4,5],[6,11],[2,5],[3,16],[6,61],[-2,16],[-2,7],[-4,8],[-5,8],[-13,13],[-8,6],[-7,5],[-58,30],[-24,6],[-77,7],[-57,-12],[-36,-17],[-65,-47],[-291,-111],[-294,-95],[-37,-8],[-101,-11]],[[7477,5327],[-1,-30],[21,-32],[5,7],[24,12],[29,9],[22,1],[46,18],[190,-8],[71,11],[80,1],[219,-54],[94,35],[35,-15],[84,-68],[86,21],[110,-24],[85,-47],[9,-51],[56,-9],[251,-150],[-31,-110],[5,-17],[67,0],[27,10],[8,21],[-3,18],[-5,3],[-1,10],[-9,9],[-7,11],[0,19],[12,3],[23,-2],[23,3],[10,22],[9,39],[22,27],[24,21],[14,22],[3,37],[-19,58],[-3,38],[19,0],[-1,-25],[1,-8],[15,0],[30,18],[72,-13],[35,13],[-57,51],[-32,23],[-46,20],[-19,25],[-17,28],[-17,20],[-106,58],[-31,36],[36,40],[38,-21],[70,-29],[29,-17],[72,-72],[52,-29],[130,-103],[256,-115],[84,-72],[27,-11],[109,-92],[86,-35],[2,-1],[-29,-10],[-8,-22],[2,-27],[-16,-33],[-16,19],[-42,-18],[-37,-19],[-39,-14],[-53,-1],[-14,-18],[-75,-123],[-115,-108],[-170,-127],[-81,-61],[-217,-161],[-216,-159],[-215,-159],[-214,-159],[-314,-232],[-87,-39],[-252,-81],[-76,-36],[-16,-13]],[[7594,2897],[-24,-32],[-62,-51],[-19,-29],[-3,-46],[12,-34],[22,-32],[50,-57],[23,-37],[47,-108],[27,-34],[23,-19],[11,-16],[4,-6],[4,-42],[-6,-19],[-26,-27],[-9,-15],[10,-124],[-1,-43],[-12,-41],[-29,-26],[-29,-2],[-62,20],[-30,5],[-43,-5],[-19,-12],[-12,-19],[-22,-27],[-78,-64],[-35,-36],[-24,-42],[-21,-21],[-55,-14],[-25,-16],[-16,-32],[-5,-38],[5,-76],[-72,50],[-2,-6],[-13,-18],[-3,47],[-26,-10],[-56,-55],[-39,-8],[-28,10],[-28,14],[-40,5],[-27,-11]],[[6831,1698],[-1,1],[-32,37],[-3,4],[-2,4],[0,9],[1,13],[6,28],[9,24],[7,15],[12,34],[2,13],[1,11],[-7,17],[-35,36],[-15,6],[-187,-7],[-9,2],[-9,6],[-28,40],[-12,22],[-14,20],[-17,18],[-6,4],[-31,11],[-100,10]],[[6361,2076],[-27,-1],[-8,1],[9,53],[89,236],[-10,29],[-9,20],[-3,14],[1,14],[1,8],[2,7],[6,29],[0,8],[-5,28],[-10,26],[-13,20],[-32,9],[-117,-6]],[[6235,2571],[58,102],[10,40],[-7,60],[3,12],[57,51],[42,32],[30,-4],[84,-41],[80,-38],[36,-8],[133,-2],[38,9],[150,115],[48,13],[21,0],[54,-16],[34,-22],[41,0],[122,39],[39,-11],[10,-13],[16,-10],[19,0],[29,10],[16,12],[11,12],[13,19],[10,9],[17,11],[55,27],[19,5],[13,2],[6,-3],[5,-3],[4,-4],[4,-4],[4,-6],[10,-16],[7,-18],[3,-5],[3,-6],[3,-5],[8,-17],[1,-2]],[[5992,2808],[-19,-41],[7,-9],[15,-25],[23,-31],[39,-73],[21,-28],[14,-16],[8,-1],[67,0],[39,-5],[29,-8]],[[6361,2076],[19,-54],[0,-24],[-1,-8],[-54,-30],[-155,-72],[-5,2],[-27,21],[-17,16],[-8,9],[-9,8],[-18,3],[-49,-13],[-40,-26],[-48,-30],[-50,-33],[-21,-30],[-13,-84],[-111,84],[-8,3],[-6,2],[-8,2],[-10,0],[-11,0],[-17,-4],[-9,-3],[-8,-4],[-10,-10],[-59,-75],[-157,-2]],[[6831,1698],[-17,-7],[-61,-71],[-34,-23],[-7,45],[-27,26],[-37,3],[-35,-25],[-16,-39],[10,-27],[19,-24],[7,-29],[-16,-24],[-25,-17],[-15,-20],[16,-35],[52,-7],[17,-7],[14,-13],[7,-9],[15,-27],[3,-11],[5,-37],[4,-16],[11,-11],[32,-15],[7,-10],[1,-38],[-16,-15],[-267,-61],[-65,-29],[-63,-46],[-50,-52],[-106,-180],[-7,-20],[3,-18],[16,-36],[2,-4],[-1,-14],[-37,-18],[-36,14],[-65,48],[-45,11],[-37,-2],[-109,-40],[-27,-17],[-53,-51],[-239,-160],[-36,-31],[-21,-34],[-17,-36],[-23,-34],[-30,-24],[-69,-35],[-29,-29],[-20,-35],[-13,-39],[-6,-40],[1,-38],[53,-165],[-14,6],[-353,140]],[[7699,3284],[-35,-27],[-29,-44],[-40,-113],[49,-43],[0,-65],[-31,-69],[-19,-26]],[[3109,5727],[14,0],[343,1],[342,0],[342,1],[223,0],[49,6],[44,15]]],"transform":{"scale":[0.0004025714268388078,0.0004087525297635521],"translate":[-92.24623383208248,13.728903047894377]}};
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
