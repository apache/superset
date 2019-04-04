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
  Datamap.prototype.gtmTopo = '__GTM__';
  Datamap.prototype.gumTopo = '__GUM__';
  Datamap.prototype.guyTopo = '__GUY__';
  Datamap.prototype.hkgTopo = '__HKG__';
  Datamap.prototype.hmdTopo = '__HMD__';
  Datamap.prototype.hndTopo = '__HND__';
  Datamap.prototype.hrvTopo = {"type":"Topology","objects":{"hrv":{"type":"GeometryCollection","geometries":[{"type":"MultiPolygon","properties":{"name":null},"id":"-99","arcs":[[[0]],[[1]],[[2]],[[3]],[[4]],[[5]],[[6]],[[7]],[[8]],[[9]],[[10]],[[11]],[[12]],[[13]],[[14]],[[15]],[[16]],[[17]],[[18]],[[19]],[[20]],[[21]]]},{"type":"MultiPolygon","properties":{"name":"Dubrovacko-Neretvanska"},"id":"HR.DN","arcs":[[[22]],[[23]],[[24]],[[25]],[[26,27]]]},{"type":"MultiPolygon","properties":{"name":"Šibensko-Kninska"},"id":"HR.SB","arcs":[[[28]],[[29]],[[30,31,32]]]},{"type":"MultiPolygon","properties":{"name":"Splitsko-Dalmatinska"},"id":"HR.SD","arcs":[[[33]],[[34]],[[35]],[[36]],[[37]],[[-28,38,-31,39,40]]]},{"type":"MultiPolygon","properties":{"name":"Zadarska"},"id":"HR.ZD","arcs":[[[41]],[[42]],[[43]],[[44]],[[45]],[[46]],[[47]],[[48,-40,-33,49,50,51]]]},{"type":"Polygon","properties":{"name":"Krapinsko-Zagorska"},"id":"HR.KZ","arcs":[[52,53,54,55,56]]},{"type":"Polygon","properties":{"name":"Karlovacka"},"id":"HR.KA","arcs":[[57,58,-52,59,60,61,62]]},{"type":"MultiPolygon","properties":{"name":"Licko-Senjska"},"id":"HR.LS","arcs":[[[63]],[[-51,64,65,-60]]]},{"type":"MultiPolygon","properties":{"name":"Primorsko-Goranska"},"id":"HR.PG","arcs":[[[66]],[[67]],[[68]],[[69]],[[70]],[[-61,-66,71,72,73]]]},{"type":"Polygon","properties":{"name":"Sisacko-Moslavacka"},"id":"HR.SM","arcs":[[74,75,76,77,-58,78]]},{"type":"Polygon","properties":{"name":"Zagrebacka"},"id":"HR.ZG","arcs":[[79,80,81,-79,-63,82,-55,83,-53]]},{"type":"Polygon","properties":{"name":"Grad Zagreb"},"id":"HR.GZ","arcs":[[-54,-84]]},{"type":"Polygon","properties":{"name":"Istarska"},"id":"HR.IS","arcs":[[-73,84]]},{"type":"Polygon","properties":{"name":"Brodsko-Posavska"},"id":"HR.SP","arcs":[[85,86,87,-77,88]]},{"type":"Polygon","properties":{"name":"Osjecko-Baranjska"},"id":"HR.OB","arcs":[[89,-86,90,91,92]]},{"type":"Polygon","properties":{"name":"Brodsko-Posavska"},"id":"HR.SP","arcs":[[-89,-76,93,94,-91]]},{"type":"Polygon","properties":{"name":"Vukovarsko-Srijemska"},"id":"HR.VS","arcs":[[95,-87,-90]]},{"type":"Polygon","properties":{"name":"Viroviticko-Podravska"},"id":"HR.VP","arcs":[[-92,-95,96,97,98]]},{"type":"Polygon","properties":{"name":"Bjelovarska-Bilogorska"},"id":"HR.BB","arcs":[[-97,-94,-75,-82,99]]},{"type":"Polygon","properties":{"name":"Koprivničko-Križevačka"},"id":"HR.KK","arcs":[[-98,-100,-81,100,101,102]]},{"type":"Polygon","properties":{"name":"Medimurska"},"id":"HR.ME","arcs":[[-102,103,104]]},{"type":"Polygon","properties":{"name":"Varaždinska"},"id":"HR.VA","arcs":[[-104,-101,-80,-57,105]]}]}},"arcs":[[[4806,1],[-2,-1],[-1,5],[3,-4]],[[4799,6],[-2,0],[1,3],[2,-2],[-1,-1]],[[4689,30],[1,-5],[-3,2],[2,3]],[[4696,33],[1,-3],[-2,0],[1,3]],[[4669,44],[13,-10],[-15,1],[2,9]],[[7465,790],[-9,-11],[-103,76],[2,4],[8,0],[-5,14],[-13,17],[-6,15],[20,2],[85,-50],[24,-28],[5,-20],[-8,-19]],[[5134,929],[-14,-15],[-22,8],[-4,-1],[-5,-4],[-12,-5],[-1,-2],[-5,-6],[-3,-4],[-2,-8],[-5,-1],[-3,-1],[-5,12],[5,2],[5,11],[4,5],[10,16],[11,13],[20,5],[13,-13],[13,-12]],[[4269,1436],[-9,-42],[-14,9],[-17,-19],[-11,-1],[2,13],[9,38],[6,45],[13,-3],[9,-11],[7,-2],[2,-5],[2,-11],[1,-11]],[[3807,1577],[7,-1],[12,0],[7,-4],[-3,-20],[-23,-14],[-21,-6],[-21,4],[-7,4],[7,17],[13,6],[7,3],[12,5],[10,6]],[[5406,1735],[5,-9],[5,1],[8,1],[3,-1],[10,4],[9,-3],[12,0],[21,-10],[1,-13],[-12,-5],[-9,-1],[-11,-6],[-6,2],[0,-2],[-60,4],[-13,3],[-22,11],[8,11],[5,4],[12,7],[13,3],[21,-1]],[[4510,2575],[8,-33],[-9,-7],[-20,7],[-8,-2],[-6,-9],[-6,-5],[-10,0],[-10,-3],[-25,3],[-3,10],[15,26],[-1,8],[8,7],[20,-2],[-1,5],[-5,10],[6,6],[20,1],[27,-22]],[[4008,3104],[-1,-19],[-8,0],[-15,23],[-49,48],[-3,19],[13,5],[8,10],[9,2],[28,-34],[6,-9],[8,-20],[4,-25]],[[3755,3121],[0,-11],[-38,20],[-4,10],[7,6],[8,1],[0,2],[-35,25],[-5,12],[-3,14],[-8,8],[2,8],[13,0],[12,-4],[4,-5],[1,-9],[25,-24],[11,-18],[22,-5],[-8,-21],[-2,-4],[-2,-5]],[[3522,3473],[7,-4],[7,4],[0,9],[2,8],[6,0],[7,-8],[6,-4],[4,-5],[2,-18],[7,-19],[19,-12],[11,-14],[7,-3],[6,4],[9,-2],[15,-21],[0,-7],[-2,-7],[19,-18],[8,-11],[2,-11],[-10,-6],[-49,18],[-37,54],[-7,-1],[-9,1],[-32,35],[-22,46],[0,10],[6,3],[7,-5],[7,-8],[4,-8]],[[2805,3902],[2,-11],[-139,130],[-7,20],[1,19],[-5,16],[3,11],[18,-7],[28,-22],[13,-20],[2,-15],[56,-63],[9,-5],[19,-53]],[[2669,4644],[14,-10],[19,2],[24,-16],[14,-16],[2,-2],[11,-7],[11,-3],[5,-7],[-4,-6],[-16,-7],[-14,-3],[-3,11],[-8,13],[-38,17],[-11,-2],[-9,-8],[-4,-13],[-8,-8],[-19,0],[-25,9],[-22,20],[-8,41],[9,28],[25,-2],[7,-8],[12,-4],[15,0],[11,-6],[10,-13]],[[2068,4737],[-16,-1],[-21,14],[-7,1],[-7,5],[-5,20],[-1,16],[-16,34],[-21,8],[-10,18],[6,19],[12,11],[25,-7],[25,-18],[4,-13],[-4,-10],[-2,-12],[3,-22],[8,-13],[16,-11],[10,-11],[1,-28]],[[2461,4885],[13,-22],[-3,-10],[-7,9],[-5,9],[-13,0],[-22,7],[-68,75],[-11,23],[3,12],[98,-89],[15,-14]],[[1371,5115],[7,-3],[1,5],[8,-3],[-20,-9],[-8,-17],[-9,-4],[-16,22],[-12,40],[14,-1],[19,-9],[10,-17],[6,-4]],[[417,6111],[18,-11],[5,1],[21,-13],[8,-11],[2,-14],[-3,-6],[-22,-1],[-7,4],[-3,-7],[-2,-16],[-3,-10],[-7,-7],[-8,1],[-2,10],[2,11],[-3,11],[3,9],[6,8],[-1,13],[-9,11],[-13,5],[-3,10],[9,4],[12,-2]],[[2251,6047],[8,-27],[-10,0],[-87,52],[-18,22],[0,26],[9,12],[12,-2],[45,-30],[37,-41],[4,-12]],[[1771,6197],[-8,-13],[-14,1],[-30,16],[-7,9],[-38,28],[-8,14],[71,5],[31,-43],[3,-17]],[[5811,948],[4,-37],[-20,-34],[-32,-23],[-35,-6],[-5,17],[-14,3],[-26,13],[-18,-23],[-23,-6],[-23,12],[-18,33],[21,13],[3,21],[-9,13],[-15,-14],[-12,0],[12,28],[31,14],[51,7],[106,-16],[22,-15]],[[6569,1012],[-17,-16],[19,1],[18,-1],[17,-5],[15,-12],[13,17],[28,-20],[84,-1],[63,-42],[86,-17],[39,-19],[-5,-5],[-1,-1],[-5,-10],[97,-11],[18,11],[35,-32],[86,-39],[32,-45],[-615,183],[-20,-26],[-34,16],[-33,32],[-18,26],[30,6],[55,22],[31,-2],[-8,-4],[-10,-6]],[[5531,1430],[94,-24],[92,0],[24,8],[39,22],[197,19],[134,-44],[35,13],[28,-41],[27,-26],[61,-48],[-12,-18],[-32,19],[-36,-2],[-77,-17],[-156,35],[-72,-5],[-126,-50],[-80,-12],[-189,39],[-82,27],[-31,-4],[-1,-12],[-29,11],[-28,21],[115,65],[0,18],[-32,10],[-67,10],[-28,11],[36,24],[37,1],[39,-7],[39,0],[35,-23],[46,-20]],[[6017,1566],[30,-11],[144,16],[138,-20],[255,-107],[60,-41],[48,-44],[2,-10],[1,-13],[1,-14],[6,-13],[8,-2],[20,4],[8,-2],[30,-23],[14,-7],[19,-2],[7,5],[-1,22],[6,5],[10,-2],[16,-13],[9,-3],[21,-3],[16,-9],[26,-20],[66,-23],[32,-16],[19,-27],[10,0],[25,4],[72,-74],[43,-11],[-52,41],[-15,29],[20,29],[-11,15],[-48,-18],[-43,27],[21,35],[23,25],[37,9],[38,-8],[71,-29],[36,-6],[13,7],[14,12],[15,1],[20,-28],[4,-23],[-1,-58],[3,-27],[53,-87],[19,-12],[59,-18],[41,-33],[73,-85],[40,-35],[91,-62],[296,-208],[56,-31],[92,-33],[46,3],[19,-15],[34,-52],[1,-2],[25,-17],[60,-7],[28,-11],[8,-39],[-10,-77],[2,-41],[12,-38],[18,-31],[21,-27],[14,-9],[29,-18],[8,-27],[-2,-35],[-37,60],[-23,16],[-56,17],[-25,16],[-2,34],[-293,199],[-31,48],[1,22],[3,33],[1,30],[-10,13],[-87,17],[-70,42],[-27,7],[-29,2],[-27,7],[-20,15],[-11,25],[34,0],[-37,36],[-13,18],[-8,28],[-25,-26],[-43,22],[-71,69],[-101,54],[-35,41],[20,53],[-47,-3],[-51,42],[-48,11],[-11,-2],[-13,-6],[-11,-8],[-10,-20],[-10,4],[-11,9],[-4,5],[-11,8],[-40,34],[-24,10],[32,-31],[15,-23],[23,-60],[0,-10],[-12,-8],[-11,2],[0,15],[3,18],[-2,13],[-35,23],[-85,37],[-76,16],[-90,44],[-93,18],[-144,59],[4,61],[-43,30],[-112,25],[-135,100],[-57,19],[-27,20],[-13,7],[-20,4],[-181,1],[-55,13],[-28,12],[-32,20],[-16,25],[17,25],[0,16],[-15,8],[-10,12],[-9,15],[-10,14],[36,-6],[55,-48]],[[6686,1852],[231,-158],[18,-22],[52,-63],[51,-127],[1,0],[0,-1],[6,-66],[-48,-37],[-91,-20],[-1,1],[-52,31],[-25,-11],[-32,19],[-29,32],[-18,25],[-23,45],[-6,29],[14,22],[39,20],[-24,10],[-28,-11],[-31,-19],[-33,-12],[12,6],[33,26],[-17,1],[-16,2],[-14,10],[-11,20],[13,16],[-11,23],[-2,10],[-36,-33],[-57,54],[-10,13]],[[6541,1687],[1,0],[47,35],[11,7],[11,9],[-2,8],[-6,5],[-17,13],[-8,8],[-5,9],[-9,22],[-6,11],[-8,9],[-10,4],[-19,2],[-8,3],[-5,5],[-1,7],[3,21],[4,6],[6,2],[30,-9],[35,-6],[8,-3],[4,-3],[7,-9],[7,-6],[9,-4],[12,-1],[31,3],[12,7],[9,6],[2,4]],[[3686,3050],[104,-49],[-100,31],[-15,-7],[-16,20],[-73,55],[-27,14],[13,18],[7,-12],[7,-4],[52,-6],[19,-18],[14,-23],[15,-19]],[[3159,3391],[48,-43],[-15,11],[-100,47],[-32,22],[-35,48],[-46,34],[-22,22],[-25,32],[-9,29],[21,15],[35,-33],[9,-24],[129,-108],[20,-28],[22,-24]],[[4824,3717],[-23,-73],[4,-12],[5,-14],[47,-24],[12,-9],[15,-13],[68,-82],[9,-15],[0,-16],[-11,-15],[-116,-82],[-11,-12],[-3,-19],[1,-11],[2,-8],[-1,-6],[-18,-36],[3,-13],[4,-9],[9,-9],[7,-11],[-4,-15],[-15,-14],[-40,-18],[-46,-12],[-37,-15],[-14,-8],[-12,-10],[-14,-19],[-11,-10],[-17,-2],[-93,40],[-8,1],[-14,-12],[-117,-155],[-11,-4],[-8,0],[-9,4],[-8,0],[-10,-5],[-20,-22],[-7,-11],[-5,-13],[3,-27],[6,-18],[9,-17],[23,-28],[9,-20],[6,-5],[8,-2],[-1,-6],[-8,-6],[-29,-12],[-16,-4],[-13,-6],[-7,-7],[0,-16],[6,-8],[8,-6],[8,-3],[5,-4],[1,-6],[-9,-5],[-36,-2],[-18,-3],[-10,-12],[-1,0]],[[4251,2705],[-8,0],[0,-16],[-20,14],[-38,0],[-12,18],[-2,-4],[1,-7],[-3,-5],[-8,0],[3,26],[9,5],[13,0],[16,10],[6,15],[-5,11],[-3,13],[8,18],[-27,-3],[-10,-4],[-10,-9],[-5,23],[-14,12],[-39,14],[28,3],[4,16],[-15,15],[-29,0],[0,15],[8,5],[8,7],[8,6],[-17,13],[-7,3],[12,15],[-12,16],[12,18],[-10,36],[18,13],[62,-1],[0,18],[-76,16],[-28,0],[20,14],[17,-2],[13,-7],[13,-5],[18,7],[-2,16],[-15,16],[-18,10],[23,9],[11,18],[-3,21],[-20,19],[2,-45],[-15,-3],[-41,36],[-23,22],[-12,0],[-16,3],[-10,3],[-11,12],[-23,38],[-11,15],[-69,39],[-19,19],[-36,14],[-109,8],[-24,27],[-17,54],[-40,19],[-44,13],[-26,36],[51,-23],[26,-7],[27,-3],[0,18],[-10,4],[-7,0],[-3,-3],[-2,-1],[-46,40],[-109,56],[-46,41]],[[3463,3598],[48,48],[37,-24],[54,-50],[7,-5],[9,0],[9,6],[58,52],[6,4],[6,0],[38,-31],[34,-18],[10,-2],[11,2],[11,12],[7,12],[4,13],[1,14],[1,6],[5,8],[9,6],[15,8],[10,9],[9,12],[5,10],[3,9],[0,6],[-2,4],[-20,21],[-3,8],[0,6],[9,12],[6,3],[8,0],[24,-14],[9,-2],[35,6],[21,-1],[60,-22],[6,-5],[33,-38],[7,-5],[4,-2],[4,1],[7,3],[11,9],[34,40],[13,10],[15,10],[11,4],[63,14],[7,6],[1,8],[-4,19],[0,7],[2,8],[3,8],[5,6],[5,5],[6,2],[17,3],[7,3],[3,3],[3,6],[1,7],[-2,8],[-7,14],[-2,6],[-1,6],[0,2],[0,2],[1,3],[3,6],[7,13],[5,6],[12,4],[42,-1],[33,-7],[7,0],[7,1],[9,4],[12,7],[44,42],[18,3],[12,-20],[2,-10],[0,-10],[-2,-6],[0,-7],[1,-6],[2,-4],[1,-3],[1,-1],[3,-11],[2,-5],[2,-32],[-1,-11],[-2,-23],[-1,-48],[2,-19],[9,-21],[18,-21],[36,-16],[31,-6],[36,1],[122,37],[18,13],[8,4],[10,1],[11,-1],[16,-6],[7,-5],[11,-24]],[[4559,1675],[-3,-6],[39,18],[21,-2],[22,-16],[7,11],[8,7],[6,-3],[2,-23],[-4,-15],[-12,-11],[-19,-15],[-20,-27],[-20,-16],[-151,-48],[-58,-5],[-40,15],[36,20],[4,37],[-13,29],[-17,-5],[-10,0],[-25,33],[8,8],[7,4],[8,3],[12,1],[39,26],[64,14],[68,-2],[50,-20],[-9,-12]],[[5183,2046],[34,-31],[7,0],[16,13],[12,5],[21,0],[50,-9],[23,-9],[12,-13],[10,-18],[14,-20],[21,-15],[1,-11],[-2,-3],[-5,0],[-5,-2],[33,-27],[37,-15],[40,-6],[164,1],[27,16],[24,-24],[31,-10],[105,-6],[101,-27],[155,7],[77,-9],[64,-31],[-423,0],[-424,0],[-39,-4],[-186,42],[-143,56],[-52,10],[-30,22],[-19,5],[-75,33],[7,10],[8,5],[18,1],[22,-12],[19,3],[41,27],[11,-18],[5,10],[19,23],[0,-15],[61,20],[52,-33],[47,-40],[48,2],[-46,51],[-45,28],[-15,18],[25,-3],[47,3]],[[5596,2318],[16,-6],[13,2],[10,13],[16,-13],[32,-38],[18,-6],[15,2],[12,-3],[12,-24],[-21,-44],[-12,-14],[-14,9],[-31,-44],[-56,-13],[-313,-10],[-108,15],[-107,34],[-134,80],[-27,36],[13,-9],[10,-9],[11,0],[1,15],[5,3],[8,-2],[9,2],[-9,18],[1,15],[12,12],[19,4],[-23,43],[-23,56],[36,1],[10,-1],[69,-29],[328,-12],[207,-58],[0,-16],[-23,0],[18,-9]],[[4735,2464],[7,-39],[46,6],[32,-27],[31,-41],[41,-36],[-26,-31],[-46,13],[-113,73],[-84,36],[-43,7],[-1,11],[3,3],[4,0],[5,3],[-17,14],[-5,17],[9,14],[24,5],[97,-8],[36,-20]],[[4796,2699],[69,-27],[-7,-14],[-64,-7],[-87,15],[-25,-2],[-14,-8],[-21,-5],[-27,4],[-21,8],[-11,9],[0,13],[12,5],[8,-1],[11,-3],[23,-3],[15,12],[-7,20],[27,11],[78,-12],[41,-15]],[[6541,1687],[-83,115],[-243,131],[-59,49],[-28,15],[-12,11],[-11,32],[-13,12],[-17,9],[-17,3],[-11,6],[-11,14],[-18,29],[-3,10],[-6,31],[-2,9],[-8,5],[-21,6],[-8,4],[-159,214],[-47,33],[-18,18],[-12,16],[-13,11],[-217,32],[-100,46],[-115,25],[-154,116],[-2,6],[-2,11],[-4,10],[-9,5],[-10,-2],[-16,-11],[-8,-3],[-64,16],[-128,0],[0,17],[34,0],[39,10],[37,17],[29,22],[-28,18],[-39,10],[-164,3],[-20,-6],[-32,-21],[-11,-4],[-31,-5],[-71,-23],[-206,-5],[0,-16],[56,-15],[24,-18],[13,-34],[-105,0],[4,-26],[-24,3],[-55,23],[-45,2],[-19,10],[-24,22],[-3,0]],[[4824,3717],[53,-16],[30,1],[18,6],[6,8],[4,11],[3,12],[31,31],[57,38],[24,10],[16,5],[57,-6]],[[5123,3817],[48,-73],[83,-87],[55,-79],[70,-66],[12,-35],[7,-40],[14,-51],[24,-40],[188,-154],[268,-282],[82,-98],[54,-50],[38,-35],[98,-57],[164,-26],[53,-37],[27,-62],[-32,-201],[38,-120],[65,-103],[69,-67],[34,-22],[18,-17],[11,-26],[15,-49],[19,-46],[26,-32],[15,-10]],[[3286,3652],[6,-28],[-12,8],[-13,5],[-13,3],[-14,1],[-14,4],[-6,10],[-3,11],[-7,8],[-43,13],[-23,14],[-15,23],[8,6],[4,9],[-23,10],[-30,21],[-27,24],[-12,19],[-9,28],[-46,54],[-15,25],[32,0],[28,-13],[90,-70],[49,-11],[9,-4],[4,-13],[5,-41],[4,-13],[10,-12],[23,-10],[13,-9],[13,-17],[15,-26],[12,-29]],[[2919,4053],[36,-47],[13,-69],[-22,23],[-16,33],[-15,21],[-18,-12],[-10,0],[-3,11],[-3,7],[-3,6],[-4,9],[-17,-27],[-33,27],[-35,42],[-46,38],[-59,75],[-31,25],[4,9],[0,2],[2,1],[6,4],[-7,14],[-15,37],[276,-229]],[[2258,4256],[13,-7],[13,10],[11,-1],[11,-9],[9,-18],[-22,-9],[-35,11],[-26,28],[4,37],[9,-26],[13,-16]],[[2512,4112],[14,-8],[23,13],[-7,-24],[-4,-9],[23,-3],[14,-14],[7,-24],[2,-32],[7,-30],[16,-24],[79,-88],[19,-11],[25,-3],[5,-12],[47,-70],[122,-88],[6,-28],[-42,-14],[-85,68],[-20,-6],[7,-8],[4,-12],[8,-11],[42,-32],[10,-10],[13,-9],[13,1],[10,-2],[4,-21],[-8,-12],[-17,10],[-16,17],[-4,8],[-61,37],[-26,23],[-25,31],[-67,106],[-41,50],[-67,148],[-34,34],[-47,22],[-144,156],[-4,27],[-8,22],[-23,35],[10,2],[7,-1],[6,-1],[34,-40],[95,-76],[8,-17],[8,-22],[10,-19],[14,-8],[23,-7],[15,-14]],[[2141,4529],[-11,-12],[-19,4],[-17,25],[2,19],[17,1],[6,7],[0,18],[11,3],[23,-17],[31,-30],[-3,-13],[-24,-1],[-16,-4]],[[1964,4634],[-7,-8],[-28,15],[-71,66],[-7,19],[31,-15],[51,-36],[31,-41]],[[2217,4733],[-17,-17],[-27,9],[-18,14],[-31,27],[3,20],[18,29],[-9,74],[7,4],[7,3],[19,2],[20,-11],[15,-21],[3,-24],[-9,-19],[-5,-15],[2,-9],[13,-23],[9,-43]],[[3780,6134],[-6,-18],[6,-60],[23,-48],[27,-43],[16,-46],[-8,-42],[-29,-14],[-35,-11],[-25,-33],[2,-40],[19,-42],[43,-71],[9,-12],[40,-28],[13,-22],[11,-24],[15,-16],[25,4],[16,5],[30,2],[15,5],[12,16],[9,20],[12,15],[22,-1],[11,-14],[6,-22],[5,-25],[6,-21],[13,-13],[14,4],[14,8],[13,-2],[18,-26],[13,-59],[22,-34],[17,-11],[22,-8],[41,-5],[21,-11],[13,-22],[8,-30],[7,-32],[-3,-3],[-14,-7],[-8,-32],[-28,-36],[-13,-38],[35,-38],[35,-5],[62,28],[35,-6],[20,-26],[11,-42],[9,-47],[42,-118],[11,-46],[0,-37],[-10,-17],[-14,-9],[-11,-10],[-1,-19],[6,8],[19,-1],[31,-8],[35,-23],[18,-19],[5,-22],[0,-2],[-4,-40],[-6,-20],[-17,-39],[-5,-26],[1,-36],[16,-75],[32,-103],[28,-41],[73,-81],[25,-44],[37,-93],[25,-43],[33,-33],[19,-15],[16,-10],[19,-2],[44,4],[17,-7],[22,-37],[7,-35],[14,-29],[74,-27],[30,-24],[26,-31],[19,-28]],[[3463,3598],[-3,3],[-34,54],[-22,26],[-24,10],[-26,4],[-15,5],[-13,6],[-19,15],[-9,16],[-7,16],[-11,20],[-93,115],[-44,68],[-31,32],[-34,14],[-71,89],[1,8],[-76,85],[-19,11],[-16,13],[-7,17],[7,24],[-27,20],[-88,93],[26,43],[-13,53],[-35,46],[-36,24],[20,25],[31,18],[29,-5],[12,-46],[20,-27],[36,18],[17,37],[-38,30],[13,3],[2,5],[8,-8],[13,0],[-10,29],[-5,10],[84,-57],[35,-47],[19,-16],[27,-2],[-23,83],[15,5],[7,7],[5,9],[8,12],[-22,7],[-19,18],[-16,26],[-13,29],[33,-12],[47,-44],[48,-18],[122,-70],[27,-11],[133,-21],[37,4],[6,26],[-24,16],[-111,17],[-8,7],[-51,68],[-14,9],[-166,81],[-24,25]],[[3034,4768],[1,1],[37,84],[7,12],[13,16],[15,5],[13,-1],[12,-4],[21,-13],[37,-34],[26,-29],[7,-6],[10,-5],[11,-3],[129,-13],[14,-3],[18,-19],[56,-70],[13,40],[8,5],[14,6],[16,3],[22,9],[19,18],[27,36],[14,26],[11,27],[6,24],[2,16],[-3,9],[-6,5],[-6,4],[-7,5],[-4,7],[-2,8],[-2,9],[-4,7],[-7,4],[-9,4],[-7,4],[-7,6],[-7,10],[-4,12],[5,11],[13,14],[87,65],[-27,78],[-24,33],[-102,97],[-7,16],[-1,10],[5,9],[4,8],[1,6],[-1,7],[-4,13],[-9,49],[-8,13],[-26,28],[-4,17],[-2,44],[-8,37],[-9,23],[-9,15],[-11,9],[-29,20],[-12,11],[-17,20],[-6,19],[0,22],[5,9],[12,3],[60,0],[14,2],[11,6],[10,8],[10,7],[19,8],[17,16],[48,29],[4,6],[5,8],[4,18],[-2,11],[-6,6],[-28,6],[-10,5],[-20,16],[-27,13],[-27,20],[-9,10],[-2,8],[4,6],[34,25],[21,23],[12,47]],[[3496,6000],[-5,33],[-44,63],[-6,11],[-2,10],[0,8],[3,5],[4,4],[4,4],[5,6],[17,25],[10,2],[15,-3],[37,-14],[36,-31],[14,-3],[22,10],[11,7],[31,28],[7,1],[9,-2],[39,-26],[25,-7],[6,-3],[7,-6],[13,-1],[11,1],[14,11],[1,1]],[[4663,8834],[-24,7],[-3,0],[-2,-1],[-7,-2],[-24,-13],[-5,-1],[-7,0],[-25,7],[-8,1],[-6,-4],[-4,-8],[0,-14],[4,-7],[5,-5],[10,-4],[6,-5],[5,-4],[5,-6],[-1,-7],[-5,-8],[-26,-14],[-6,-5],[3,-10],[3,-4],[16,-12],[4,-5],[5,-6],[0,-6],[-5,-4],[-16,-4],[-8,-1],[-5,0],[-10,5],[-7,3],[-7,1],[-6,-1],[-3,0],[-2,-3],[-2,-6],[0,-14],[1,-8],[2,-5],[9,-9],[3,-2],[1,-3],[-5,-6],[-5,-5],[-51,-19]],[[4460,8617],[-24,-2],[-20,-18],[-32,-9],[-212,-113],[-17,7],[-6,11],[-1,13],[-2,7],[-19,16]],[[4127,8529],[-7,17],[-16,29],[-10,10],[-13,8],[-106,30],[-22,9],[-14,9],[-10,4],[-13,0],[-29,-11],[-22,-16],[-35,-6],[-120,9],[-30,1]],[[3680,8622],[-2,50],[13,48],[20,30],[8,25],[-9,13],[-15,22],[-21,15],[-47,20],[-21,12],[-13,14],[-34,35],[-23,54],[0,60],[24,68],[31,59],[7,9],[22,30],[36,18],[29,-2],[121,-9],[33,21],[34,57],[17,13],[6,4],[26,12],[27,7],[77,2]],[[4026,9309],[4,-10],[3,-21],[0,-19],[6,-13],[13,-12],[73,-23],[10,-8],[8,-9],[4,-17],[2,-12],[5,-8],[8,-5],[16,-1],[23,1],[14,-3],[48,-17],[19,-2],[15,0],[19,9],[11,3],[12,1],[25,-1],[26,2],[24,6],[13,0],[15,-2],[25,-10],[30,-1],[10,4],[10,7],[9,10],[14,22],[8,11],[12,6],[9,0],[11,-11],[7,-11],[9,-18],[10,-7],[12,-2],[21,1],[7,-3],[3,-8],[-9,-30],[0,-14],[8,-18],[11,-21],[2,-3],[1,-9],[0,-12],[-7,-33],[-1,-21],[-3,-19],[12,-124]],[[3913,7546],[24,-94],[9,-14],[9,-17],[8,-13],[-1,-12],[-6,-13],[-3,-10],[-3,-17],[4,-19],[-4,-13],[-17,-34],[-1,-23],[-5,-12],[-12,-8],[-34,-12],[-13,-1],[-11,4],[-8,6],[-15,14],[-15,11],[-14,8],[-12,0],[-17,-2],[-8,2],[-11,17],[-8,6],[-22,-1],[-45,11],[-23,-7],[-9,-8],[-1,-9],[6,-8],[16,-15],[4,-8],[0,-10],[-11,-39],[-1,-12],[1,-8],[4,-9],[10,-15],[6,-11],[5,-13],[0,-7],[-2,-4],[-26,-22],[-4,-11],[1,-11],[3,-12],[2,-13],[0,-15],[-2,-14],[-3,-14],[-8,-29],[-2,-12],[1,-11],[3,-10],[3,-9],[2,-10],[-3,-6],[-23,-20],[-6,-17],[-12,-18],[-8,-8],[-1,-9],[1,-11],[4,-14],[1,-19],[4,-11],[5,-5],[111,-24],[4,1],[5,2],[10,9],[5,4],[6,2],[24,1],[11,-3],[6,-2],[6,0],[15,8],[4,0],[4,-1],[4,-3],[5,-2],[6,-1],[7,0],[7,-1],[7,-3],[29,-21],[1,0]],[[3896,6762],[-18,-16],[-19,-52],[-2,-19],[7,-142],[-8,-37],[-39,-104],[-1,-45],[20,-72],[-6,-43],[-42,-73],[-8,-25]],[[3496,6000],[-66,56],[-11,13],[-5,10],[-3,8],[-8,8],[-11,6],[-21,2],[-26,-3],[-7,0],[-8,3],[-7,6],[-9,15],[-6,13],[-13,44],[-5,11],[-8,9],[-35,27],[-19,21],[-8,14],[-34,76],[-6,9],[-6,6],[-227,140],[-10,8],[-8,9],[-10,16],[-7,7],[-15,13],[-9,12],[-8,12],[-6,11],[-8,10],[-7,3],[-10,-7],[-43,-42],[-57,-3],[-199,45]],[[2550,6588],[-62,62],[-4,8],[-1,12],[8,4],[6,5],[5,7],[3,11],[2,124],[7,48],[-4,13],[-6,13],[-7,15],[-9,24],[-1,13],[4,9],[6,4],[4,5],[3,4],[3,8],[1,14],[10,29],[9,18],[59,40],[8,1],[9,-3],[14,-10],[20,-12],[49,-16],[18,-10],[12,-11],[4,-9],[14,-12],[6,-2],[4,0],[22,38],[6,9],[5,5],[55,23],[11,11],[5,12],[-2,20],[2,8],[3,8],[9,10],[33,28],[11,11],[7,12],[15,47],[5,23],[2,12],[1,10],[0,12],[-3,18],[-7,18],[-5,8]],[[2919,7337],[95,35],[55,-1],[18,5],[15,14],[30,42],[17,14],[-86,58],[-24,40],[-14,52],[-10,63],[0,2],[-10,27],[-12,25],[-1,20],[21,11],[11,10],[7,19],[9,18],[50,15],[21,12],[24,8],[35,-1],[-10,22],[-27,45],[-4,4]],[[3129,7896],[1,0],[24,14],[31,36],[64,12],[17,-3],[9,-6],[8,-8],[13,-22],[25,-27],[18,-15],[57,-28],[10,-7],[0,-5],[-2,-8],[-1,-7],[0,-6],[4,-9],[29,-32],[45,-33],[18,-8],[12,1],[16,27],[6,8],[9,8],[12,6],[19,3],[14,-3],[10,-4],[63,-39],[44,-9],[17,-6],[16,-7],[20,-13],[10,-4],[8,0],[5,3],[16,18],[4,-1],[2,-4],[9,-46],[-2,-12],[-6,-10],[-9,-9],[-6,-10],[3,-12],[25,-21],[9,-11],[32,-44],[7,-4],[9,-2],[18,3],[22,6]],[[2275,5333],[65,-50],[-6,71],[40,2],[58,-38],[48,-50],[38,-64],[26,-25],[63,-21],[18,-27],[16,-37],[24,-40],[-33,5],[-47,41],[-36,3],[8,25],[4,9],[-70,42],[-34,13],[-18,14],[-23,12],[-30,0],[0,-17],[93,-51],[139,-203],[83,-58],[-27,23],[-27,32],[-24,41],[-16,51],[71,-35],[158,-169],[38,-25],[24,-28],[48,-44],[22,-26],[-33,-9],[-40,24],[-41,32],[-38,18],[0,-16],[30,-6],[30,-20],[26,-28],[19,-28],[-34,0],[2,-13],[5,-8],[7,-6],[9,-5],[-36,10],[-75,33],[-41,4],[0,-15],[71,-50],[0,-15],[-39,10],[-35,21],[-30,30],[-24,37],[0,15],[23,0],[0,18],[-14,8],[-9,10],[-13,31],[18,-2],[12,4],[9,11],[8,18],[-43,29],[-15,5],[-16,-2],[-26,-15],[-15,1],[-18,21],[-30,64],[-105,88],[-15,3],[-89,55],[0,14],[10,4],[16,10],[10,4],[-21,39],[-48,73],[-1,21],[-19,15],[-177,222],[-30,52],[-17,54],[8,0],[5,-3],[65,-77],[111,-166]],[[3034,4768],[-235,245],[-79,113],[-48,53],[-47,22],[-7,12],[-55,45],[-14,2],[-10,21],[-169,267],[-30,80],[19,30],[-2,36],[-11,42],[-6,49],[-4,132],[4,42],[37,151],[16,37],[11,45],[-12,54],[-56,130]],[[2336,6376],[0,1],[9,15],[-1,31],[2,9],[5,6],[61,39],[14,3],[9,-2],[8,-10],[5,-3],[7,-2],[27,4],[47,-5],[29,2],[11,4],[6,8],[6,19],[2,16],[0,13],[-33,64]],[[1303,5362],[-12,-2],[-20,12],[-21,8],[-12,15],[1,21],[4,17],[14,46],[37,44],[25,-5],[-1,-23],[-10,-15],[-22,-5],[-3,-3],[-3,-4],[-1,-9],[3,-12],[-4,-13],[1,-13],[4,-7],[11,-21],[9,-31]],[[1538,5334],[60,-83],[137,-150],[14,-47],[-38,-4],[-46,44],[-56,75],[-23,16],[0,16],[35,-10],[12,-6],[-48,62],[-26,22],[-31,14],[-12,-25],[-18,-8],[-20,4],[-19,14],[0,15],[11,0],[0,1],[-2,5],[-7,12],[31,39],[-12,47],[-45,78],[-8,31],[-12,75],[-3,41],[34,-23],[43,-20],[28,-32],[-12,-56],[8,-21],[7,-38],[8,-65],[10,-23]],[[2119,5921],[5,-24],[-26,-22],[0,-14],[12,-9],[67,-66],[41,-24],[18,-19],[49,-82],[13,-48],[-16,-34],[-47,42],[-82,95],[-55,43],[0,-18],[4,-12],[19,-19],[-23,16],[-27,8],[-25,1],[-18,-7],[-70,81],[21,1],[21,-1],[20,-6],[19,-9],[0,15],[-6,8],[-2,5],[0,7],[-3,14],[28,-24],[7,-10],[11,0],[-21,47],[-14,20],[-23,16],[-4,8],[-7,25],[36,-6],[33,-11],[-4,10],[-7,24],[32,-2],[24,-19]],[[1641,6180],[-14,-43],[-18,-32],[12,-17],[-15,-42],[-3,-34],[6,-79],[22,-70],[3,-40],[-25,-14],[9,-27],[20,-35],[7,-19],[1,-25],[-10,-30],[-3,-30],[10,-52],[23,-38],[27,-34],[21,-38],[-10,-21],[1,-19],[11,-8],[21,14],[12,-33],[-12,-17],[-12,-13],[-12,-7],[-19,4],[-49,0],[-77,87],[-56,122],[4,106],[-7,2],[-5,3],[-4,5],[-7,4],[-15,-9],[-11,17],[-6,32],[-2,77],[-3,23],[-8,9],[-18,2],[-28,32],[-26,143],[-34,36],[2,11],[1,6],[9,16],[-15,43],[15,7],[41,-16],[12,-11],[30,-46],[16,-10],[29,-1],[18,2],[10,14],[6,34],[-6,14],[-7,37],[2,24],[23,-26],[12,16],[-33,32],[-25,41],[-51,146],[-10,19],[-90,109],[-16,30],[-1,35],[19,50],[18,32],[24,24],[31,8],[41,-15],[13,-28],[-6,-96],[5,-58],[11,-43],[30,-88],[42,-84],[9,-14],[22,-18],[39,-6],[21,-10],[13,-30],[-5,-42]],[[1798,6890],[55,-30],[-18,1],[-5,-1],[3,-17],[5,-14],[7,-11],[8,-8],[25,-44],[22,-54],[-45,-22],[26,-17],[53,-6],[36,12],[10,-44],[-20,-84],[10,-51],[22,-23],[30,-10],[76,-1],[-1,-69],[101,-94],[26,-66],[-11,0],[-19,-15],[-22,-5],[-21,5],[-19,15],[-23,-18],[0,-15],[23,-21],[-7,-15],[-25,-10],[-31,-3],[-29,8],[-82,56],[-49,20],[-8,17],[-1,38],[4,86],[-9,20],[-30,-16],[0,-16],[23,-18],[-44,-3],[-136,21],[-42,14],[-43,34],[-36,44],[-23,40],[13,21],[15,9],[16,3],[19,0],[7,10],[-1,23],[2,22],[15,11],[64,1],[27,14],[-15,34],[22,32],[9,19],[4,21],[-4,19],[-6,17],[2,18],[19,21],[3,27],[-2,21],[-8,13],[-16,4],[24,27],[25,3]],[[2336,6376],[-42,98],[-6,41],[-18,29],[-25,20],[-104,56],[-183,142],[-87,115],[-23,13],[-29,30],[-12,32],[23,23],[-20,20],[-61,45],[30,-36],[5,-4],[-6,-19],[-14,-10],[-18,0],[-14,12],[-24,26],[-183,94],[-65,14],[-30,17],[-28,5],[-31,-24],[-35,-56],[-32,-73],[-22,-82],[-19,-166],[-22,-77]],[[1241,6661],[-1,1],[-39,16],[-7,9],[-7,15],[-2,15],[0,22],[3,22],[-2,56],[-13,133],[0,41],[1,15],[4,13],[16,33],[6,25],[1,18],[-3,24],[-16,72],[-3,24],[0,18],[5,12],[5,14],[-4,9],[-15,11],[-91,53],[-15,16],[-15,24],[-6,19],[-2,13],[2,21]],[[1043,7425],[4,-1],[43,8],[81,38],[43,13],[37,-10],[68,-29],[78,-15],[78,7],[65,37],[31,29],[67,49],[22,40],[9,34],[7,54],[1,10],[11,31],[16,23],[42,48],[18,25],[21,49],[14,14],[8,4],[20,9],[19,-11],[4,-37],[-2,-44],[1,-32],[16,-30],[22,-23],[58,-46],[12,-5],[11,-6],[0,-1],[10,-13],[3,-18],[-6,-43],[1,-12],[33,-29],[157,-69],[1,0],[27,-67],[70,-15],[72,26],[33,56],[6,51],[31,1],[38,-25],[30,-27],[25,-3],[15,-2],[19,-9],[16,-16],[83,-2],[17,-14],[124,-105],[76,-11],[70,26]],[[5071,8125],[25,-27],[0,-15],[-7,-14],[-6,-18],[-5,-30],[1,-10],[6,-5],[12,-2],[15,-5],[19,-15],[14,-8],[19,-5],[22,-9],[38,-29],[26,-33],[15,-15],[9,-5],[32,0],[34,-8],[115,-53],[9,-8],[19,-24],[11,-8],[16,-6],[41,-5],[11,-7],[6,-10],[25,-63],[7,-16],[13,-23],[11,-8],[14,-6],[6,-4],[4,-4],[17,-27],[25,-33],[8,-14],[2,-9],[-30,-31],[-7,0],[-6,0],[-5,2],[-6,1],[-5,-1],[-4,-1],[-3,-6],[1,-10],[10,-22],[12,-13],[14,-10],[13,-5],[15,-2],[33,2],[12,-6],[7,-9],[9,-17],[5,-4],[9,2],[29,18]],[[5803,7432],[60,-50],[57,-28],[11,-10],[3,-4],[28,-46],[20,5],[23,10],[8,2],[7,-1],[6,-6],[3,-14],[-2,-13],[-4,-9],[-8,-12],[-8,-16],[-1,-9],[0,-10],[4,-8],[18,-16],[138,-86],[63,14]],[[6229,7125],[15,-41],[0,-9],[-3,-9],[-9,-7],[-6,-7],[-2,-8],[8,-12],[23,-22],[6,-6],[1,-7],[-3,-6],[-11,-8],[-20,-4],[-15,-1],[-10,-2],[-20,-8],[-5,-3],[-6,-8],[-20,-35],[-26,-25],[-9,-6],[-44,-44],[-5,-8],[-3,-7],[-4,-23],[2,-10],[8,-10],[16,-11],[23,-25],[23,-56],[1,-1]],[[6134,6696],[-45,21],[-72,54],[-33,72],[-10,-8],[-27,-17],[-10,-9],[7,20],[2,15],[-3,14],[-6,18],[-17,-30],[-17,12],[-21,25],[-25,9],[7,-16],[5,-16],[-35,-4],[-10,13],[1,21],[-3,19],[-13,50],[-14,14],[-47,-39],[-5,-11],[-14,-20],[-17,-20],[-14,-9],[-9,-26],[-17,-12],[-19,-8],[-17,-17],[-9,-29],[1,-20],[-3,-18],[-21,-19],[-43,-5],[-337,100],[-99,4],[-79,-55],[-56,-123],[-23,-37],[-18,-13],[-45,-14],[-15,-11],[-13,-22],[0,-14],[4,-15],[-4,-28],[-7,-20],[-35,-65],[-18,-68],[-10,-34],[-41,-11],[-62,14],[-65,28],[-48,30],[-154,155],[-30,40],[-36,93],[-26,43],[-21,17],[-37,8],[-15,11],[1,11],[6,17],[1,21],[-15,22],[-20,10],[-18,1],[-39,-8],[-162,5],[-92,-15],[-37,-35]],[[3913,7546],[45,54],[25,9],[10,-2],[7,-4],[5,-6],[3,-8],[0,-9],[-1,-7],[6,-6],[5,-3],[46,-8],[35,-40],[10,-19],[0,-8],[-1,-8],[-1,-29],[14,-23],[71,-5],[24,6],[14,14],[12,10],[14,2],[17,-1],[13,-4],[7,-5],[16,-14],[47,57],[11,6],[21,5],[21,-2],[5,2],[3,5],[-3,7],[-3,5],[-6,7],[-3,10],[0,35],[-4,13],[-10,13],[-29,23],[-6,7],[-4,8],[-2,9],[-1,18],[-3,8],[-8,6],[-15,6],[-6,4],[-5,6],[-2,13],[1,12],[5,8],[9,4],[36,-4],[17,2],[12,6],[49,39],[27,31],[7,6],[10,4],[10,0],[13,-2],[17,-11],[14,-23],[6,-8],[7,-4],[17,-2],[12,-4],[12,-9],[12,-12],[14,-11],[19,-4],[45,19],[23,20],[32,70],[-9,71],[7,31],[-11,64],[3,23],[4,17],[27,40],[9,7],[8,1],[29,-17],[12,-3],[5,-1],[33,10],[7,4],[4,5],[1,4],[6,48],[12,49],[2,15],[0,10],[-2,11],[-4,18],[68,0],[3,3],[8,17],[1,3],[4,2],[4,2],[6,-2],[5,-4],[4,-15],[19,-33],[73,-85]],[[4663,8834],[26,-43],[5,-10],[8,-30],[5,-10],[6,-9],[9,-10],[5,-3],[11,-1],[20,3],[28,15],[52,11]],[[4838,8747],[124,-40],[19,-9],[27,-40],[14,-16],[4,-5],[2,-6],[1,-5],[-2,-6],[-4,-12],[-3,-14],[4,-5],[10,-1],[23,6],[12,8],[7,5],[5,11],[3,6],[5,6],[5,4],[6,0],[10,-5],[43,-44],[10,-8],[65,-38],[10,-10],[7,-9],[2,-7],[5,-3],[7,-1],[14,4],[10,0],[14,-8],[7,-6],[11,-4],[13,2],[50,21],[24,-12]],[[5402,8506],[-1,-25],[0,-23],[7,-75],[-1,-15],[-3,-31],[-9,-35],[-24,-31],[-13,-9],[-14,-5],[-22,0],[-13,5],[-6,10],[1,11],[4,12],[0,11],[-5,9],[-9,1],[-11,-7],[-37,-59],[-4,-17],[1,-20],[6,-36],[-5,-12],[-10,-5],[-56,21],[-48,0],[-14,-7],[-18,-32],[-27,-17]],[[3129,7896],[-27,31],[-5,5],[-6,-4],[-21,-5],[-8,-6],[-2,-10],[-7,-5],[-22,8],[-15,11],[-9,12],[-17,32],[-16,16],[-12,6],[-4,10],[2,5],[9,23],[14,17],[68,37],[46,16],[166,54],[1,1],[20,16],[-3,23],[-7,25],[8,22],[19,9],[19,-2],[19,-7],[20,-3],[16,6],[32,26],[16,8],[45,-8],[63,-10],[66,2],[33,9],[34,18],[17,24],[-1,35],[-20,48],[-7,30],[7,29],[12,29],[9,29],[2,40],[-3,74]],[[4127,8529],[-43,-24],[-89,-20],[-24,-1],[-31,1],[-14,-4],[-6,-8],[1,-13],[3,-14],[2,-17],[-2,-16],[-9,-18],[-13,-7],[-42,-8],[-12,-5],[-5,-5],[-1,-7],[0,-8],[-9,-36],[4,-5],[10,-8],[61,1],[21,-19],[42,-57],[-19,-27],[-38,-54],[34,-49],[-34,-73],[-53,32],[-13,-30],[-6,-23],[-2,-14],[1,-11],[3,-8],[2,-4],[7,-9],[12,-13],[48,-35],[105,-47],[11,-7],[10,-8],[7,-9],[5,-11],[4,-10],[5,-11],[7,-9],[30,-18],[29,49],[13,122],[34,55],[208,135],[83,84],[5,-1],[48,-30],[30,-12],[4,2],[4,7],[5,20],[11,25],[1,3],[4,16],[3,23],[2,6],[3,5],[26,29],[4,6],[-4,14],[-10,21],[-62,84],[-9,17],[-23,65],[-46,89]],[[1241,6661],[-1,-3],[-2,-9],[-40,-55],[-50,19],[27,-33],[-4,-36],[-22,-34],[-27,-28],[-10,18],[-7,-20],[0,-17],[7,-45],[-7,5],[-11,5],[-6,5],[0,-15],[26,-30],[11,-52],[-4,-55],[-21,-44],[-19,-15],[-14,2],[-13,8],[-18,5],[-20,-8],[-20,-18],[-16,-23],[-8,-18],[-11,0],[4,47],[14,21],[7,20],[-14,44],[-36,33],[-5,18],[3,17],[-2,12],[-20,2],[7,-28],[-8,-43],[8,-19],[18,-11],[16,-2],[12,-6],[7,-23],[-18,-18],[-24,-47],[-11,-13],[-7,12],[-9,0],[7,-16],[2,-20],[-2,-23],[-7,-22],[-14,4],[-7,-2],[0,-6],[9,-13],[0,-16],[-9,-1],[-2,-2],[1,-6],[-2,-9],[-17,10],[-38,-11],[-26,1],[13,-11],[9,-11],[12,-26],[-11,0],[0,-15],[11,0],[0,-17],[-12,-9],[-8,-10],[-14,-30],[3,-18],[3,-6],[0,-6],[-6,-20],[18,1],[10,-4],[8,-11],[10,-18],[-61,-3],[-30,5],[-25,16],[-3,-10],[0,-3],[-8,-5],[-11,38],[-15,5],[-17,-5],[-16,11],[-12,-17],[18,-7],[18,-15],[9,-20],[-9,-24],[15,-40],[8,-10],[-25,-14],[-6,23],[0,39],[-4,36],[-13,9],[-50,21],[-18,2],[3,8],[5,17],[3,8],[-5,1],[-13,-1],[-5,0],[12,17],[-12,17],[-18,-4],[-27,9],[-28,19],[-20,25],[12,15],[18,-25],[25,-7],[24,13],[14,36],[-46,-11],[-17,4],[-18,23],[0,15],[7,7],[8,16],[8,11],[-19,23],[-38,93],[-70,75],[-88,123],[-13,11],[-21,25],[-29,22],[-35,6],[8,15],[9,24],[6,10],[-41,58],[44,30],[149,10],[-34,16],[-39,6],[-79,-4],[-42,-12],[-19,1],[-8,19],[3,26],[5,20],[-2,16],[-18,11],[8,16],[1,12],[-6,11],[-14,11],[0,15],[14,9],[6,15],[0,19],[-9,24],[12,23],[-1,25],[-12,21],[-22,13],[6,14],[9,13],[13,7],[18,0],[0,15],[-17,8],[-13,11],[-10,14],[-6,17],[18,4],[14,8],[26,21],[-20,10],[-45,2],[-16,3],[-19,19],[-16,29],[-1,25],[25,10],[0,15],[-20,22],[-51,144],[4,4],[5,5],[4,7],[-8,10],[-1,2],[4,4],[5,18],[-28,64],[-5,35],[10,32],[10,0],[17,-14],[77,-37],[35,-4],[67,-72],[52,2],[168,8],[80,-50],[23,-23],[27,-9],[90,-13],[18,14],[15,23],[25,24],[79,34],[22,29],[-36,43],[0,26],[6,17],[11,7],[27,-5],[45,-9],[24,-13],[22,-23],[43,-31],[44,-15],[41,-2],[1,0]],[[7754,6942],[66,-50],[1,-2],[2,-2],[5,-6],[15,-9],[113,-42],[38,-6],[53,4],[22,9],[13,12],[8,12],[13,9],[20,5],[46,5],[61,-9],[210,-74],[85,-43]],[[8525,6755],[-42,-49],[-7,-14],[-5,-14],[-3,-14],[-2,-20],[0,-19],[3,-25],[13,-36],[38,-60],[0,-1],[1,0]],[[8521,6503],[-1,-17],[9,-29],[3,-34],[-41,2],[-44,16],[-16,10],[-26,17],[-24,27],[-39,41],[-29,24],[-32,15],[-120,10],[-25,12],[-77,55],[-41,16],[-41,-8],[-19,-24],[-4,-30],[-1,-30],[-11,-25],[-30,-19],[-36,-7],[-17,0],[-20,0],[-33,7],[-37,18],[-94,84],[-27,15],[-26,0],[-26,-13],[-103,-125],[-28,-26],[-14,-8],[-47,-9],[-50,-21],[-16,-2],[-35,14],[-30,28],[-54,70],[-41,53],[-46,45],[-50,29],[-56,3],[-37,-19],[-62,-66],[-35,-23],[-19,-2],[-37,4],[-85,-11],[-13,-5],[9,16],[16,50],[-41,-22],[-20,-3],[-21,7],[12,15],[5,13],[-2,14],[-9,16],[-14,8],[-7,-9],[-5,-15],[-3,-8],[-57,-18],[-31,-3],[-23,13],[-16,13],[-56,37],[-31,13],[-66,43],[-33,-71],[-7,-11],[-80,-5],[-19,-11],[-105,49]],[[6229,7125],[75,61],[21,13],[22,4],[28,-8],[18,-12],[21,-6],[24,3],[85,38],[63,1],[147,-105],[29,-29],[62,-76],[31,-26],[45,-29],[47,-20],[28,-5],[51,5],[26,0],[35,-10],[15,-7],[9,-6],[2,-5],[4,-10],[1,-5],[0,-4],[1,-7],[-1,-8],[-2,-14],[0,-4],[2,-5],[22,-38],[4,-10],[0,-3],[-17,-32],[-4,-11],[4,-6],[29,-9],[29,-4],[23,2],[10,2],[8,4],[6,3],[4,4],[2,5],[3,7],[2,8],[2,8],[2,22],[0,8],[5,5],[10,2],[41,-4],[12,1],[37,15],[18,13],[18,20],[7,13],[3,9],[4,6],[2,4],[4,4],[4,2],[15,2],[3,3],[2,3],[0,5],[-2,5],[-6,8],[-3,6],[-2,6],[-1,6],[3,6],[4,7],[7,8],[8,7],[10,6],[12,4],[16,2],[276,-41]],[[9329,7366],[-17,-12],[-26,-20],[-57,-12],[-16,1],[-9,5],[-1,5],[-3,5],[-3,5],[-8,10],[-6,5],[-19,12],[-5,4],[-4,6],[-3,6],[-2,11],[-2,5],[-6,8],[-10,10],[-23,17],[-15,6],[-21,2],[-10,-3],[-9,-3],[-7,-5],[-10,-11],[-10,-7],[-16,-6],[-47,-8],[-10,-3],[-4,-5],[0,-6],[1,-6],[4,-6],[13,-16],[3,-5],[3,-5],[1,-17],[0,-15],[-2,-14],[-10,-11],[-15,-11],[-123,6],[-33,-20],[-40,-19],[-17,-10],[-10,-9],[-3,-8],[-1,-9],[-4,-57],[-3,-11],[-4,-8],[-12,-9],[-4,-4],[-3,-6],[-1,-8],[-1,-10],[1,-11],[-1,-13],[-3,-15],[-5,-6],[-7,-2],[-60,2],[-9,-5],[-7,-8],[-5,-10],[-8,-9],[-73,-11],[-18,-9],[-12,-11],[-3,-12],[-1,-9],[-5,-69],[0,-9],[2,-4],[4,-4],[7,-5],[10,-3],[56,-8],[10,-3],[9,-8],[4,-10],[2,-14],[-1,-29],[-3,-16],[-3,-13],[-9,-17],[-8,-8],[-9,-3],[-7,0],[-12,7]],[[7754,6942],[45,74],[2,23],[-4,8],[-5,10],[-4,20],[-4,11],[-5,10],[-4,5],[-15,9],[-14,6],[-2,8],[0,5],[4,5],[4,5],[5,4],[5,4],[6,3],[7,2],[12,3],[9,5],[9,10],[21,40],[8,11],[58,57],[19,14],[19,7],[43,1],[35,7],[10,4],[95,76],[18,9],[13,0],[42,-15],[18,-2],[3,1],[73,33],[27,7],[38,1],[18,3],[4,4],[0,5],[-12,16],[-5,9],[-4,11],[1,14],[-2,8],[-5,7],[-33,22],[-17,18],[-7,4],[-7,2],[-5,-1],[-4,-1],[-4,-4],[-2,-6],[-3,-10],[-1,-26],[-1,-8],[-4,-7],[-8,-5],[-11,-3],[-70,5],[-10,-3],[-14,-5],[-8,0],[-6,3],[-7,6],[-19,26],[-5,5],[-4,4],[-4,1],[-72,-1],[-9,2],[-8,4],[-7,7],[-15,25],[-6,7],[-7,4],[-7,2],[-5,2],[-5,5],[-3,43],[0,9],[2,5],[3,3],[23,8],[11,7],[12,16],[2,11],[-6,12],[-6,12],[-16,24],[-13,7],[-32,9],[-10,6],[-20,21],[-9,6],[-11,5],[-115,24]],[[7757,7802],[-4,28],[-3,4],[-4,4],[-83,44],[-19,14],[-12,12],[-2,18],[-3,15],[-6,18],[-14,28],[-11,15],[-11,10],[-10,5],[-47,10],[-8,6],[-8,13],[-7,22],[-19,35],[-16,40],[-13,45],[0,2]],[[7457,8190],[117,0],[178,-49],[19,0],[19,7],[29,21],[15,4],[139,0],[32,-9],[52,-39],[38,-1],[29,-31],[29,-11],[30,11],[27,16],[27,-1],[28,-36],[1,0],[11,-3],[12,-1],[11,1],[13,3],[32,25],[59,72],[27,19],[38,-18],[44,17],[73,61],[21,25],[37,71],[25,28],[2,1],[5,15],[5,29],[6,12],[39,37],[31,7],[84,-29],[67,-34],[21,-3],[17,10],[8,17],[7,21],[17,26],[22,-20],[8,1],[10,0],[29,20],[34,10],[19,10],[16,19],[25,2],[10,-37],[-29,-19],[-13,-13],[-16,-17],[35,-27],[18,-20],[5,-19],[-12,-15],[-21,-5],[-54,-5],[-5,-65],[-4,-14],[-6,-11],[-3,-10],[6,-15],[26,-26],[12,-21],[50,-60],[7,-36],[7,-73],[15,-30],[23,-19],[29,-16],[24,-22],[10,-34],[-9,-21],[-47,-64],[-18,-13],[-21,-21],[-7,-45],[-2,-45],[-6,-20],[15,-12],[33,-54],[17,-16],[31,0],[22,17],[17,21],[30,15],[14,10],[15,5],[16,-12],[10,-19],[5,-12],[8,-11],[17,-14],[28,-14],[25,-5],[22,-12],[18,-35],[-49,-48],[-100,15],[-14,2],[-23,-59],[12,-45],[15,-16]],[[5803,7432],[-6,19],[2,22],[1,11],[0,6],[0,7],[5,36],[23,69],[26,-10],[3,-7],[2,-12],[-1,-10],[1,-13],[5,-7],[6,-5],[80,-38],[17,-3],[10,0],[9,5],[12,3],[23,2],[21,-7],[20,3],[44,14],[26,5],[39,1],[22,6],[16,8],[8,10],[11,10],[8,0],[8,-7],[15,-15],[24,-19],[17,-11],[18,-2],[172,28],[25,-2],[57,-16],[27,-2],[19,4],[13,6],[9,10],[8,14],[21,71],[3,13],[-2,10],[-4,8],[-14,21]],[[6652,7668],[70,-13],[11,-9],[12,-7],[5,-6],[6,-5],[7,-5],[7,-1],[7,2],[9,9],[4,9],[2,8],[0,17],[1,5],[5,0],[117,-66],[11,-3],[6,-4],[20,-22],[12,-11],[60,-40],[95,-29],[15,-8],[17,-6],[75,-9],[16,-7],[10,-9],[7,-12],[3,-10],[5,-9],[9,-6],[14,-3],[17,1],[57,9],[28,-2],[13,-4],[6,-3],[9,2],[11,6],[59,44],[11,12],[12,16],[15,29],[26,64],[160,194],[43,16]],[[9329,7366],[33,-35],[10,-28],[-15,-24],[-89,-41],[22,-38],[25,-32],[29,-21],[34,-7],[70,0],[16,-10],[6,-23],[1,-27],[5,-22],[44,-53],[63,-31],[340,-88],[26,-45],[32,-15],[18,-48],[-4,-56],[-20,-20],[-5,-5],[-146,-7],[-9,6],[-13,21],[-8,4],[-12,-5],[-7,-11],[-5,-11],[-8,-6],[-71,-9],[-36,2],[-33,13],[-18,18],[-32,46],[-20,11],[-37,-9],[12,-35],[21,-45],[-6,-39],[-37,-8],[-95,10],[-25,-23],[2,-21],[13,-19],[17,-17],[13,-15],[13,-30],[5,-23],[6,-58],[14,-71],[2,-25],[-4,-22],[-8,-29],[-5,-30],[3,-24],[19,-17],[34,13],[16,-17],[6,-36],[-12,-18],[-19,-8],[-16,-10],[-27,-45],[-15,-21],[-21,-12],[-24,3],[-34,37],[-23,8],[-46,-26],[5,-48],[36,-70],[-18,-6],[-51,-1],[-144,-4],[-53,18],[-28,18],[-41,27],[-58,63],[-18,69],[12,23],[37,29],[5,23],[-3,9],[-8,11],[-4,7],[-1,7],[0,13],[-1,5],[-5,15],[-5,10],[-7,6],[-11,5],[-47,4],[-20,9],[-21,25],[-63,129],[-8,11],[-10,6],[-12,-1],[-9,-9],[-4,-14],[-4,-15],[-5,-11],[-16,-9],[-14,7],[-12,15],[-9,20],[-12,31],[-7,11],[-13,6],[-11,-2],[-24,-15],[-11,-4],[-14,0],[-27,7],[-14,1],[-25,-10],[0,-5]],[[6652,7668],[-11,43],[115,198],[1,32],[-5,11],[-69,49],[-13,7],[-16,5],[-9,1],[-7,-2],[-11,-10],[-9,-6],[-14,-15],[-9,-5],[-20,-1],[-32,27],[-7,9],[-4,9],[2,9],[9,17],[1,11],[-2,13],[-6,19],[-7,8],[-8,3],[-50,-10],[-4,0],[-2,4],[-9,10],[-16,20],[-26,15],[-12,15],[-7,13],[-1,8],[1,18],[0,11],[-3,12],[-232,161]],[[6160,8377],[-11,44],[-2,12],[1,8],[8,16],[-1,6],[-7,13],[3,10],[11,14],[28,29],[49,76],[10,10],[9,7],[32,20],[17,5],[16,1],[89,-13],[17,1],[11,2],[2,2]],[[6442,8640],[17,-15],[18,-4],[18,30],[10,-41],[-3,-21],[5,-7],[34,2],[41,15],[17,-7],[11,-39],[9,7],[7,7],[5,8],[14,9],[144,-7],[72,-14],[62,-28],[81,-84],[12,-22],[2,-20],[9,-36],[2,-27],[2,-13],[3,-16],[14,-9],[38,-2],[207,-63],[49,-35],[33,-57],[0,-10],[21,4],[9,17],[8,19],[16,9],[28,0]],[[5402,8506],[2,100],[6,37],[23,48],[14,42],[20,35],[17,29],[29,18],[31,13],[13,1],[10,-7],[6,-13],[13,-11],[7,1],[6,5],[4,5],[16,14],[7,8],[4,6],[6,25],[7,14],[8,6],[9,2],[12,-2],[12,-3],[12,-5],[6,-6],[4,-9],[4,-15],[2,-10],[2,-7],[5,-10],[8,-10],[11,-9],[28,-16],[9,-6],[5,-9],[-1,-11],[-18,-47],[11,-19],[24,-18],[69,-35],[30,-20],[18,-23],[0,-20],[-3,-23],[-1,-20],[7,-18],[8,-5],[10,1],[28,21],[11,4],[13,0],[22,-2],[14,-10],[14,-15],[22,-36],[10,-12],[10,-9],[24,-17],[58,-56]],[[4838,8747],[-11,42],[4,88],[-4,27],[-12,48],[1,18],[6,12],[25,7],[7,1],[24,-3],[8,2],[8,3],[60,44],[6,2],[4,-2],[2,-4],[4,-10],[3,-6],[5,-3],[8,-1],[44,10],[21,8],[10,9],[5,11],[5,18],[5,8],[163,99],[61,21],[28,3],[9,-3],[5,-7],[6,-16],[6,-4],[21,7],[32,16],[62,41],[29,25],[15,22],[9,29],[12,23],[5,14],[2,13],[-2,10],[-2,8],[-3,5],[-4,3],[-16,11],[-23,25]],[[5491,9421],[58,-8],[21,-11],[6,-9],[9,-14],[14,-18],[5,3],[5,6],[51,113],[2,6],[2,12],[14,45],[7,16]],[[5685,9562],[10,-13],[16,-39],[-5,-38],[12,-36],[17,-48],[12,-14],[12,-10],[63,-73],[42,-77],[16,-21],[90,-72],[14,-18],[9,-26],[19,-21],[82,-61],[25,-12],[138,-5],[19,-11],[68,-87],[9,-22],[21,-77],[4,-24],[12,-40],[26,-10],[28,-4],[15,-21],[-13,-2],[-21,-10],[-11,-3],[0,-16],[25,-9],[3,-2]],[[5491,9421],[-42,13],[-194,11],[-18,5],[-16,-3],[-117,-36],[-55,0],[-208,44],[-4,1],[-5,6],[-7,8],[-8,19],[-3,11],[-2,11],[-1,8],[-1,5],[-3,8],[-18,23],[-9,9],[-11,8],[-35,3],[-27,19],[-3,2]],[[4704,9596],[-2,20],[-8,12],[-29,18],[-10,13],[-5,20],[3,38],[-1,20],[-20,66],[-7,32],[1,15],[1,20],[45,49],[5,6],[53,20],[10,6],[16,10],[32,10],[18,20],[6,8],[12,-17],[1,-1],[11,18],[19,-15],[22,-3],[21,2],[20,-2],[15,-9],[28,-30],[14,-10],[15,-2],[37,5],[18,-3],[16,-9],[41,-33],[10,-7],[73,-45],[23,-22],[10,0],[7,21],[11,9],[13,-3],[15,-9],[45,-9],[37,-24],[31,-38],[27,-45],[32,-41],[51,-31],[21,-43],[12,0],[12,34],[12,-7],[46,-10],[8,-4],[7,-5],[7,-8],[8,-9],[11,-10],[4,8],[4,11],[9,0],[22,-21],[15,-20]],[[4026,9309],[2,1],[5,0],[60,32],[50,27],[56,10],[20,5],[8,3],[35,17],[34,23],[18,20],[4,5],[13,32],[0,32],[-4,34],[1,43],[52,-11],[10,-2],[19,4],[16,13],[13,18],[15,15],[20,4],[17,-8],[40,-38],[25,-14],[28,-6],[14,0],[61,15],[38,-1],[8,8],[0,6]]],"transform":{"scale":[0.0005906953413341303,0.00041718812121213],"translate":[13.50147545700014,42.37551504100004]}};
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
