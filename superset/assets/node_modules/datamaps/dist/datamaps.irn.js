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
  Datamap.prototype.hrvTopo = '__HRV__';
  Datamap.prototype.htiTopo = '__HTI__';
  Datamap.prototype.hunTopo = '__HUN__';
  Datamap.prototype.idnTopo = '__IDN__';
  Datamap.prototype.imnTopo = '__IMN__';
  Datamap.prototype.indTopo = '__IND__';
  Datamap.prototype.ioaTopo = '__IOA__';
  Datamap.prototype.iotTopo = '__IOT__';
  Datamap.prototype.irlTopo = '__IRL__';
  Datamap.prototype.irnTopo = {"type":"Topology","objects":{"irn":{"type":"GeometryCollection","geometries":[{"type":"MultiPolygon","properties":{"name":null},"id":"-99","arcs":[[[0]],[[1]]]},{"type":"Polygon","properties":{"name":"Kohgiluyeh and Buyer Ahmad"},"id":"IR.KB","arcs":[[2,3,4,5,6]]},{"type":"MultiPolygon","properties":{"name":"Bushehr"},"id":"IR.BS","arcs":[[[7]],[[8,9,10,-5,11]]]},{"type":"Polygon","properties":{"name":"Esfahan"},"id":"IR.ES","arcs":[[12,13,-3,14,15,16,17,18,19]]},{"type":"Polygon","properties":{"name":"Fars"},"id":"IR.FA","arcs":[[20,21,22,-12,-4,-14]]},{"type":"Polygon","properties":{"name":"Golestan"},"id":"IR.GO","arcs":[[23,24,25,26]]},{"type":"Polygon","properties":{"name":"Mazandaran"},"id":"IR.MN","arcs":[[-26,27,28,29,30,31,32]]},{"type":"Polygon","properties":{"name":"Semnan"},"id":"IR.SM","arcs":[[33,34,-20,35,36,-28,-25,37]]},{"type":"Polygon","properties":{"name":"Tehran"},"id":"IR.TH","arcs":[[-37,38,39,40,-29]]},{"type":"Polygon","properties":{"name":"Yazd"},"id":"IR.YA","arcs":[[41,42,-21,-13,-35,43]]},{"type":"Polygon","properties":{"name":"Chahar Mahall and Bakhtiari"},"id":"IR.CM","arcs":[[-7,44,-15]]},{"type":"Polygon","properties":{"name":"Khuzestan"},"id":"IR.KZ","arcs":[[-16,-45,-6,-11,45,46,47]]},{"type":"Polygon","properties":{"name":"Lorestan"},"id":"IR.LO","arcs":[[48,49,-17,-48,50,51]]},{"type":"Polygon","properties":{"name":"Ilam"},"id":"IR.IL","arcs":[[-51,-47,52,53]]},{"type":"MultiPolygon","properties":{"name":"Hormozgan"},"id":"IR.HG","arcs":[[[54]],[[55]],[[56]],[[57]],[[58]],[[59]],[[60]],[[61]],[[62]],[[63]],[[64,65,-9,-23,66]]]},{"type":"Polygon","properties":{"name":"Ardebil"},"id":"IR.AR","arcs":[[67,68,69,70]]},{"type":"Polygon","properties":{"name":"Markazi"},"id":"IR.MK","arcs":[[-40,71,-18,-50,72,73,74]]},{"type":"Polygon","properties":{"name":"Qom"},"id":"IR.QM","arcs":[[-36,-19,-72,-39]]},{"type":"Polygon","properties":{"name":"Hamadan"},"id":"IR.HD","arcs":[[75,76,-73,-49,77,78]]},{"type":"Polygon","properties":{"name":"Zanjan"},"id":"IR.ZA","arcs":[[79,80,-76,81,82,83,-69]]},{"type":"Polygon","properties":{"name":"Qazvin"},"id":"IR.QZ","arcs":[[-31,84,-74,-77,-81,85]]},{"type":"Polygon","properties":{"name":"West Azarbaijan"},"id":"IR.WA","arcs":[[86,-83,87,88]]},{"type":"Polygon","properties":{"name":"East Azarbaijan"},"id":"IR.EA","arcs":[[-84,-87,89,-70]]},{"type":"Polygon","properties":{"name":"Kermanshah"},"id":"IR.BK","arcs":[[-78,-52,-54,90,91]]},{"type":"Polygon","properties":{"name":"Gilan"},"id":"IR.GI","arcs":[[-32,-86,-80,-68,92]]},{"type":"Polygon","properties":{"name":"Kordestan"},"id":"IR.KD","arcs":[[-79,-92,93,-88,-82]]},{"type":"Polygon","properties":{"name":"South Khorasan"},"id":"IR.KJ","arcs":[[94,95,96,-42,97]]},{"type":"Polygon","properties":{"name":"Razavi Khorasan"},"id":"IR.KV","arcs":[[-98,-44,-34,98,99]]},{"type":"Polygon","properties":{"name":"North Khorasan"},"id":"IR.KS","arcs":[[-99,-38,-24,100]]},{"type":"Polygon","properties":{"name":"Sistan and Baluchestan"},"id":"IR.SB","arcs":[[-65,101,-96,102]]},{"type":"Polygon","properties":{"name":"Kerman"},"id":"IR.KE","arcs":[[-97,-102,-67,-22,-43]]},{"type":"Polygon","properties":{"name":"Alborz"},"id":"IR.AL","arcs":[[-30,-41,-75,-85]]}]}},"arcs":[[[5852,808],[-5,0],[-4,1],[-3,4],[-2,6],[2,6],[4,2],[6,5],[6,-4],[1,-10],[-1,-4],[1,-2],[-5,-4]],[[2611,3700],[3,-1],[1,-4],[-1,-3],[-2,-1],[2,-2],[1,-5],[0,-7],[0,-3],[-7,0],[-5,0],[0,3],[-1,0],[-1,-3],[-4,-5],[-1,3],[0,3],[-3,-4],[-3,2],[-4,2],[0,7],[0,2],[0,4],[2,2],[0,7],[6,1],[3,1],[2,-3],[1,0],[3,3],[2,0],[6,1]],[[3779,4149],[4,-45],[28,-84],[56,-67],[73,-59],[10,-11]],[[3950,3883],[15,-85],[1,-33],[-3,-6],[-13,-15],[-26,-17],[-29,-9],[-55,16],[-19,13],[-11,17],[-14,3],[-59,33],[-42,12],[-8,-11],[9,-57],[16,-52],[1,-15],[-7,-15],[4,-14],[12,-24],[0,-36],[-11,-26],[-139,-92],[-22,-3],[-86,5],[-52,-14],[0,-2]],[[3412,3456],[-9,10],[-20,16],[-60,25]],[[3323,3507],[-9,106],[-10,45],[-16,22],[-4,35],[30,80],[-9,36],[-29,24],[-50,29],[-40,46],[-21,30],[-88,-13],[-4,16],[5,22],[3,21],[2,10],[-1,28],[-24,96],[0,39],[8,22],[13,20],[18,15],[40,19],[62,62],[34,52]],[[3233,4369],[37,-25],[91,-41],[27,2],[16,-3],[193,-192],[17,0],[60,-9],[28,17],[26,25],[33,7],[18,-1]],[[3269,2820],[-5,-1],[-5,6],[-5,15],[-4,13],[-3,8],[6,4],[5,-2],[10,-5],[5,-4],[-2,-12],[2,-12],[-4,-10]],[[4639,1579],[-23,-16],[-7,-2],[-24,1],[-25,7],[-9,1],[-34,-4],[-5,0],[-11,-5],[-2,0],[-3,-4],[-8,-19]],[[4488,1538],[-41,21],[-10,13],[-1,14],[5,9],[8,4],[11,1],[10,0],[11,1],[7,7],[-5,16],[-8,8],[-21,10],[-8,7],[-4,8],[-9,23],[-3,6],[-39,47],[-17,16],[-19,9],[-92,24],[-20,11],[-61,67],[-19,14],[-21,11],[-25,4],[-36,-5],[-8,3],[-10,7],[-18,-2],[-20,-5],[-33,-7],[-20,3],[-45,11],[-6,2],[-3,5],[0,6],[-2,5],[-3,3],[-16,3],[-22,8],[-11,14],[-12,23],[-12,9],[-4,-19],[-11,-1],[-10,41],[-10,17],[-8,24],[-20,37],[-9,10],[-10,13],[-3,14],[12,36],[-1,18],[-11,20],[-18,19],[-6,9],[-19,33],[-17,21],[-4,7],[-31,90],[-4,22],[-1,86],[-7,30],[-11,25],[-13,18],[-17,12],[-22,5],[-21,2],[-10,3],[-5,7],[-4,14],[-24,35],[-4,13],[-3,19],[2,17],[10,7],[11,-4],[10,-10],[8,-12],[5,-12],[6,6],[-1,5],[-2,5],[1,8],[3,5],[11,11],[3,7],[2,15],[-1,15],[-5,10],[-10,-3],[-4,20],[-4,7],[-6,6],[-3,-1],[-5,-3],[-4,-1],[-2,3],[-1,11],[-1,6],[-2,4],[-12,2],[-41,-3],[-9,-2],[-14,-9],[-14,2],[-11,12],[-5,19],[-1,16],[1,8],[5,9],[4,9],[3,11],[5,5],[8,-10],[2,28],[1,5],[-5,2],[-3,4],[-6,13],[3,17],[0,26],[-3,27],[-4,18],[-6,14],[-10,16],[-8,5],[-1,-21],[-3,8],[-14,25],[-28,26],[-4,9],[-4,12],[-8,13],[-17,19],[-30,14],[-5,7],[-3,14],[-8,13],[-14,18],[-14,22],[-23,50],[-13,20],[-9,10],[-22,15],[-20,24],[-2,3],[-1,8],[-1,12],[-2,8],[9,1],[1,4],[-3,5],[-7,4],[6,23],[-12,38],[3,18],[-7,6],[-8,13],[-7,14],[-3,11],[-3,7],[-7,6],[-5,2]],[[3126,3499],[34,19],[53,10],[30,-17],[80,-4]],[[3412,3456],[0,-35],[13,-49],[27,-29],[31,-74],[30,-12],[114,-10],[71,-26],[35,-45],[28,-72],[36,-67],[34,-40],[41,-17],[46,-48],[232,-504],[12,-61],[76,-248],[13,-25],[23,-10],[17,-12],[39,-53],[71,-183],[68,-98],[66,-73],[104,-86]],[[5884,6309],[6,-460],[-14,-48],[-44,-84],[-30,-23],[-40,-5],[-51,-30],[-28,-38],[-24,-114],[-17,-50],[-20,-42],[-28,-38],[-55,-35],[-548,-208],[-164,41],[-38,-1],[-50,-22],[-31,-22],[-23,-21],[-33,-21],[-38,-12],[-20,-16],[-4,-22],[15,-209],[-5,-44],[-22,-95],[-10,-83],[-5,-16],[1,-48],[23,-99]],[[4587,4444],[-1,0],[-177,-58],[-38,0],[-116,29],[-24,24],[-5,63],[-7,18],[-9,2],[-71,-44],[-10,-15],[-15,-7],[-70,-53],[-38,-6],[-51,13],[-2,-20],[13,-32],[15,-18],[21,-9],[23,-5],[29,-25],[15,-46],[-12,-46],[-11,-70],[-43,-123],[-5,-59],[6,-40],[0,-22],[-15,-6],[-39,-6]],[[3779,4149],[5,23],[2,53],[-48,176],[-11,77],[3,37],[17,14],[22,10],[-1,21],[-15,22],[-11,21],[2,21],[21,16],[17,36],[-10,71],[-27,55],[-60,50],[-27,31],[-66,57],[-5,53],[3,49],[-12,20],[-4,20],[-8,10],[-14,3],[-5,17],[-5,31],[-20,19],[-23,-4],[-11,-14],[-21,-8],[-68,-2],[-21,-4],[-57,-42],[-24,-5],[-16,6],[-25,-7],[-34,5],[-32,29],[-31,19],[-23,-5],[-17,-9],[-18,-4],[-36,5],[-102,-61]],[[2963,5061],[14,51],[11,19],[-21,32],[-52,22],[-45,-3],[-28,16],[-25,69]],[[2817,5267],[-1,7],[4,16],[7,14],[11,8],[42,15],[24,20],[9,80],[30,39],[77,24],[12,8],[1,13],[3,16],[52,115],[-1,30],[2,37],[12,27]],[[3101,5736],[43,39],[82,53],[216,62],[32,22],[29,27],[33,11],[30,1],[13,26],[50,131],[6,40]],[[3635,6148],[-15,9],[-10,29],[15,134],[6,19],[20,22],[49,23],[112,14],[40,-2],[175,49]],[[4027,6445],[100,-59],[50,-9],[142,10],[36,-6],[220,-79],[27,-5],[1236,40],[29,-10],[12,-11],[5,-7]],[[4587,4444],[132,-57],[78,-81],[67,-91],[121,-344],[86,-174],[82,-115],[23,-45],[18,-149],[15,-41],[81,-69],[105,-61]],[[5395,3217],[0,-13],[14,-54],[42,-100],[6,-26],[11,-22],[12,-15],[24,-17],[118,-12],[30,-15],[105,-298]],[[5757,2645],[30,-104],[0,-19],[-17,-14],[3,-32],[156,-174],[13,-43],[-6,-77],[-26,-110],[-3,-29],[3,-22],[44,-41],[24,-47],[-3,-39],[-9,-16],[-11,-10],[-16,-8],[-30,2],[-47,-14],[-71,-45],[-20,-37],[-17,-60],[-30,-33],[-65,-23],[-138,22],[-47,-12],[-26,-13],[-24,10],[-32,4],[-138,-14],[-54,-22],[-23,-33],[-7,-54],[-11,-37],[0,-7],[6,-20],[-14,-27],[-54,-33],[-159,33],[-13,0],[-38,-12],[-9,2],[-9,5],[-43,42],[-20,8],[-115,13],[-38,42],[-14,32]],[[6294,8850],[4,-48],[-4,-19],[2,-25],[6,-28],[-1,-16],[-10,-44],[1,-31],[18,-22],[24,-12],[21,-17],[10,-42],[-29,-41],[-60,-22],[-14,-2],[-16,-8],[-16,-15],[-37,-16],[-38,-70],[-16,-16]],[[6139,8356],[-21,-18],[-97,-156],[-43,-100],[-10,-74],[-17,-47],[-26,-13],[-185,27],[-44,-6],[-91,-55],[-88,-72],[-32,-37],[-73,-36],[-36,-9],[-40,7],[-102,-2]],[[5234,7765],[-21,34],[-55,60],[-114,73],[-18,33],[-6,17],[-1,8]],[[5019,7990],[79,-7],[8,-5],[8,-3],[65,19],[6,5],[4,12],[0,70],[-3,11],[-7,5],[-10,4],[1,10],[12,23],[-12,20],[-8,25],[-12,58],[-16,44],[-2,10],[-5,57],[142,-13],[10,1],[9,4],[10,10],[9,7],[12,0],[12,-2],[11,0],[18,7],[88,53],[12,2],[31,-7],[12,0],[8,4],[12,14],[11,4],[6,7],[25,17],[13,11],[2,5],[2,10],[7,17],[1,10],[1,16],[-1,5],[-2,5],[-6,5],[-2,4],[0,14],[8,21],[2,14],[3,11],[7,11],[16,18],[77,55],[25,28],[4,8],[2,9],[7,3],[7,2],[5,2],[4,5],[6,12],[4,6],[10,3],[30,6],[7,3],[4,10],[12,7],[23,8],[6,1],[11,9],[10,6],[39,31],[13,5],[32,1],[103,23],[15,0],[32,-8],[21,-12],[7,-3],[27,0],[8,-3],[14,-7],[8,-3],[8,0],[74,14],[21,-3],[2,-1]],[[5234,7765],[-52,-16],[-43,-27],[-39,-41],[-18,-38],[-12,-41],[-8,-55],[-21,-25],[-53,-50],[-12,-19],[-6,-17],[-12,-18],[-23,-22],[-36,-21],[-40,-13],[-26,-4],[-17,10],[-27,-10],[-32,-20],[-25,-7],[-53,-7],[-7,-3]],[[4672,7321],[-47,34],[-22,6],[-17,-11],[-27,-4],[-40,9],[-59,34],[-46,9],[-37,17],[-35,5],[-47,-40],[-67,-87],[-36,-16],[-41,3],[-25,10],[-16,10],[-18,22],[-30,60],[-53,61],[-71,29],[-79,8],[-56,35]],[[3803,7515],[-34,42],[-85,20],[-21,10],[-20,19],[-10,14],[-33,14],[-85,18]],[[3515,7652],[-1,14],[-6,18],[-84,68],[-28,16],[-138,123]],[[3258,7891],[27,19],[31,59],[12,57],[21,22],[27,15],[17,25],[5,18],[1,2]],[[3399,8108],[24,-18],[11,-2],[7,-4],[16,-17],[7,-7],[82,-47],[74,-56],[44,-20],[145,-31],[92,-28],[96,-18],[92,-28],[96,13],[85,33],[89,23],[92,19],[89,19],[88,28],[86,28],[172,40],[23,4],[204,12],[37,10],[25,22],[-1,-26],[-29,-10],[-37,-5],[-24,-8],[-6,-3],[-8,1],[-14,4],[-7,-1],[-15,-6],[-8,-2],[-30,5],[-27,0],[4,-8],[8,-2],[17,0],[-11,-3],[-4,-1],[13,-17],[21,-10],[2,-1]],[[6556,7872],[10,3],[16,0],[21,-13],[13,-54],[-14,-63],[-21,-43],[-7,-74],[9,-127],[17,-82],[14,-38],[123,-107],[34,-42],[-8,-47],[-90,-166],[-22,-55],[-16,-13],[-109,-45],[-59,-37],[-67,-66],[-83,-111]],[[6317,6692],[-186,-339],[-57,-32],[-133,4],[-48,-10],[-9,-5],[0,-1]],[[4027,6445],[17,26],[23,58],[14,60],[1,55],[-7,27]],[[4075,6671],[2,30],[16,54],[26,44],[7,42],[-24,46],[-58,83],[-4,29],[3,31],[10,41],[7,63],[9,9],[9,-4],[7,-7],[11,-4],[31,-2],[28,-27],[95,-61],[38,-14],[39,-1],[117,-37],[42,-1],[59,20],[51,30],[82,80],[17,61],[-7,69],[-16,76]],[[6139,8356],[78,-109],[37,-27],[21,4],[25,-11],[-6,-16],[-30,-10],[-13,-11],[-3,-10],[3,-5],[3,-7],[3,-18],[-3,-46],[-9,-41],[-2,-14],[9,-21],[62,-73],[58,-53],[30,-10],[49,-9],[26,-11],[79,14]],[[4075,6671],[-295,190],[-125,40],[-148,2],[-1,2]],[[3506,6905],[45,155],[0,47],[-13,28],[-24,32]],[[3514,7167],[13,34],[34,22],[27,35],[15,42],[46,2],[6,33],[2,44],[31,38],[42,17],[42,-6],[29,20],[0,38],[2,29]],[[7320,5226],[3,-52],[-5,-21],[-14,-25],[-8,-25],[3,-15],[8,-15],[16,-20],[0,-20],[16,-38],[21,-38],[-1,-38],[-12,-38],[-5,-33],[-8,-32],[-69,-103],[-19,-59],[-53,-92],[-28,-78],[-7,-13]],[[7158,4471],[-556,267],[-66,13],[-11,-19],[-24,-29],[-108,-68],[-36,-44],[-275,-162],[-23,-55],[-7,-214],[-8,-47],[-87,-44],[-98,-15],[-43,10],[-66,3],[-291,-58],[-46,-58],[-23,-51],[-12,-49],[1,-34],[29,-62],[31,-91],[12,-68],[17,-23],[17,-13],[-7,-220],[6,-39],[7,-27],[0,-19],[-16,-14],[-52,-7],[-6,-5],[-22,-12]],[[6317,6692],[211,60],[206,105],[131,36],[57,-16],[151,-125],[18,-43],[-7,-43],[-50,-53],[-205,-158],[-36,-68],[-65,-214],[-4,-115],[32,-195],[25,-42],[102,-14],[133,34],[22,-31],[20,-43],[39,-288],[34,-84],[44,-28],[12,-11],[34,-16],[44,-31],[42,-72],[13,-11]],[[3233,4369],[19,40],[28,40],[1,31],[-15,38],[-44,53],[-10,20],[-25,26],[-16,28],[-16,41],[-14,57],[-7,18],[-8,9],[-25,9],[-7,9],[-13,11],[-13,18],[-16,46],[-78,137],[-9,41],[-2,20]],[[3126,3499],[-13,6],[-19,2],[-19,-3],[-19,-8],[-163,-118],[-19,-9],[-16,4],[-15,25],[-1,11],[0,30],[-4,12],[-4,6],[-1,4],[-2,3],[-6,4],[-5,2],[-5,1],[-11,1],[-6,0],[-11,-4],[-6,0],[-6,1],[-7,7],[-5,1],[-10,-2],[-20,-9],[-10,-3],[-14,1],[-5,6],[1,28],[-2,2],[-7,6],[-2,4],[0,4],[0,10],[1,5],[2,4],[0,5],[-7,4],[-3,-11],[-5,-12],[-7,-8],[-9,-1],[-10,7],[-4,8],[-6,7],[-9,1],[-12,5],[-34,23],[-7,7],[-3,22],[-10,14],[-13,8],[-17,5],[6,11],[8,2],[22,-4],[11,1],[17,7],[9,1],[11,-3],[21,-12],[7,-3],[12,-2],[8,-4],[7,-7],[7,-11],[3,10],[10,19],[15,23],[3,7],[1,11],[-11,-2],[-8,6],[-4,10],[-5,25],[-6,-3],[-8,-10],[-8,-7],[1,9],[1,2],[2,3],[-5,8],[-4,-2],[-5,-4],[-7,-2],[-4,2],[-5,10],[-4,2],[-3,-1],[-5,-3],[-3,-1],[-10,2],[-9,3],[-9,1],[-9,-6],[-19,3],[-14,-10],[-4,-14],[14,-7],[16,-4],[13,-9],[4,-12],[-10,-12],[-9,0],[-28,4],[-6,-2],[-28,-30],[-2,-3],[-5,-8],[-2,-8],[6,-6],[-2,-5],[-4,-6],[-2,-3],[4,-15],[9,-10],[11,-9],[8,-11],[5,-12],[3,-15],[3,-31],[-1,-8],[-5,-14],[-1,-8],[0,-7],[3,-13],[0,-8],[-3,-13],[-7,-12],[-9,-9],[-11,-4],[-35,5],[-9,-5],[-10,6],[-36,0],[-22,13],[-9,3],[-1,-12],[2,-8],[7,-13],[2,-10],[-2,-6],[-3,-6],[-5,-5],[-5,-3],[-11,-4],[-39,4],[0,4],[-2,-4],[-1,-1],[-3,1],[-17,6],[-7,5],[-7,6],[-4,4],[-2,5],[-5,13],[-1,9],[-9,34],[-2,1],[-3,7],[-10,13],[-6,16],[-1,5],[1,7],[4,6],[5,5],[3,6],[2,7],[-1,7],[-3,7],[-3,6],[-20,21],[-17,22],[-11,19],[-4,5],[-7,3],[-6,0],[-19,-4],[-6,0],[-6,1],[-6,3],[-4,5],[-3,6],[-4,30],[-5,15],[-6,14],[-9,10],[-5,4],[-6,2],[-55,9],[-1,21],[2,327],[-2,9],[-5,4],[-170,0],[2,164],[1,117],[79,240],[3,16],[-2,14],[-7,12],[-20,17],[-8,11],[-2,5],[-3,12],[-3,6],[-4,4],[-9,7],[-4,5],[-18,37],[-3,12],[0,1],[-5,12],[-18,9],[-8,11],[-12,29],[-7,12]],[[1847,4787],[14,7],[54,39],[18,34],[-6,43],[-1,35],[38,58],[48,123]],[[2012,5126],[28,46],[71,205],[28,24],[128,9],[36,13],[55,4],[54,-17],[26,-29],[33,-11],[114,-13],[121,-91],[73,-8],[38,9]],[[1906,6314],[13,-6],[22,-16],[10,-17],[223,-159],[115,-15],[19,-8],[15,5],[28,30],[13,4],[28,-1],[34,4],[141,-66]],[[2567,6069],[-8,-14],[-4,-23],[7,-18],[1,-15],[-20,-53],[-5,-15],[-2,-16],[6,-14],[27,-17],[34,-14],[58,-5],[15,-6],[41,29],[10,11],[18,59],[23,15],[28,10],[26,16],[29,-9],[22,-31],[15,-26],[0,-18],[-8,-19],[-6,-21],[5,-16],[17,-15],[39,-22],[18,-20],[16,-14],[12,9],[3,17],[10,22],[19,15],[11,-8],[8,-16],[17,-14],[11,-13],[0,-20],[3,-19],[33,-20],[5,-5]],[[2012,5126],[-7,7],[-10,16],[-83,194],[-61,88],[-17,21],[-8,4],[-10,4],[-6,8],[-10,21],[-13,16],[-6,3],[-7,1],[-7,2],[-3,8],[-5,7],[-64,36],[-22,6],[-13,8],[-10,11],[0,9],[-9,5],[-25,21],[-3,3],[-3,3],[-4,1],[-3,-1],[-3,-3],[-3,-1],[-3,2],[-2,3],[-1,3],[-1,2],[-19,7],[-10,4],[-6,7],[-7,9],[-2,6],[6,12],[1,6],[-2,6],[-5,3],[-29,19],[-10,4],[-14,19],[-16,9],[-12,23],[-8,5],[-1,5],[8,27],[2,10],[9,4],[9,1],[11,31],[32,33],[182,56],[10,16],[29,21],[12,14],[7,16],[3,21],[-5,34],[-12,30],[-7,10]],[[1746,6102],[9,7],[8,13],[-2,5],[-1,8],[2,12],[-1,8],[-3,6],[-4,4],[-3,4],[-1,7],[3,10],[30,16],[37,2],[25,14],[3,38],[-5,37],[2,15],[10,7],[15,4],[36,-5]],[[1847,4787],[-1,2],[-10,5],[-8,1],[-5,6],[-4,7],[-7,4],[-8,3],[-3,3],[-1,6],[1,9],[2,7],[3,6],[3,7],[1,9],[-3,9],[-10,9],[-3,8],[-5,3],[-3,4],[-9,14],[-2,4],[-3,4],[-15,16],[-2,4],[-4,9],[0,4],[2,2],[5,13],[3,4],[2,4],[-1,8],[-3,5],[-14,12],[-9,12],[-5,10],[-7,9],[-11,6],[-29,12],[-8,0],[-23,-14],[-10,-4],[-18,-3],[-16,4],[-16,10],[-16,13],[-1,0],[-156,151],[-21,27],[-34,23],[-24,21],[-2,1],[-48,31],[-15,16],[-51,27],[-55,19],[-61,-7],[-31,4],[-11,27],[7,8],[8,8],[8,9],[4,11],[-3,10],[-8,7],[-10,5],[-22,3],[-8,6],[1,9],[10,6],[12,1],[8,-1],[9,2],[11,9],[14,16],[7,9],[4,9],[-1,6],[-6,4],[-2,7],[0,5],[3,13],[0,7],[-4,12],[-8,8],[-16,14],[-21,32],[-17,19],[-3,10],[0,11],[-2,14],[-4,13],[-6,11],[-17,24],[-2,2],[-1,1],[-2,1],[-1,0],[-2,1],[-3,-1],[-3,-1],[-9,-10],[-16,-3],[-15,4],[-9,9],[8,11],[25,17],[6,10],[-4,15],[-11,8],[-9,11],[2,21],[-11,-3],[-25,-1],[-10,-4],[-15,-16],[-8,-6],[-9,-3],[-4,5],[0,24],[-1,5]],[[886,5827],[11,11],[11,98],[20,68],[6,44],[-8,26],[10,12],[31,-1],[80,11],[77,-35],[42,-3],[42,-11],[35,-23],[38,-36],[130,-46],[60,-5],[89,24],[81,-4],[11,24],[7,44],[-8,17],[-14,23],[0,21],[83,21],[18,-2],[8,-3]],[[5718,547],[-4,-4],[-4,0],[-3,-3],[-5,6],[-3,-2],[1,4],[-2,4],[-2,7],[8,5],[8,2],[3,-4],[1,-7],[2,-8]],[[5458,571],[-5,-4],[-7,2],[-8,4],[-2,8],[7,4],[12,4],[3,-6],[0,-12]],[[5444,811],[-2,-1],[-6,2],[-6,4],[-3,4],[-1,9],[-1,7],[0,6],[2,8],[3,5],[4,3],[5,-2],[5,-6],[4,-2],[3,-3],[2,-4],[2,-4],[-11,-26]],[[5197,975],[-6,-4],[-38,3],[-4,0],[-17,10],[-10,20],[5,9],[7,7],[10,3],[10,0],[8,-4],[20,-2],[7,-4],[1,-3],[0,-1],[0,-6],[0,-1],[1,-5],[3,-2],[3,-2],[1,-2],[0,-4],[1,-4],[-1,-4],[-1,-4]],[[6151,1063],[-11,-7],[-8,5],[1,16],[7,15],[8,8],[5,1],[4,-7],[1,-16],[-7,-15]],[[4995,1094],[-6,-8],[-9,1],[-10,6],[-5,8],[4,8],[11,0],[5,-2],[6,-3],[4,-10]],[[4852,1185],[-8,-2],[-20,2],[-6,-2],[-9,-6],[-10,0],[-30,6],[-9,4],[-1,1],[-7,5],[-16,16],[-5,7],[2,2],[4,1],[4,2],[5,1],[44,-16],[39,-4],[12,-5],[7,-7],[4,-5]],[[6404,1209],[-20,-7],[-9,4],[2,18],[7,13],[14,7],[19,2],[3,-21],[-16,-16]],[[6297,1256],[-12,-31],[-6,-12],[-22,-25],[-3,-9],[-4,-6],[-20,-12],[-5,-6],[-4,-3],[-25,-29],[-16,-11],[-12,6],[-11,14],[-13,12],[-35,-21],[-9,-9],[-10,-7],[-11,0],[-24,4],[-10,-2],[-11,-7],[-28,-23],[-29,-15],[-18,-15],[-9,-5],[-32,-5],[-22,-7],[-10,-7],[-5,-2],[-1,0],[-3,1],[-6,2],[-5,0],[-3,-6],[-2,-4],[-6,-4],[-6,-2],[-5,-1],[-2,2],[-2,1],[-2,8],[-3,17],[4,12],[1,7],[-3,4],[-5,21],[5,7],[25,-10],[5,3],[4,-1],[1,-1],[27,18],[70,27],[10,1],[6,3],[2,1],[24,17],[11,10],[33,16],[6,0],[10,-1],[6,1],[3,2],[6,5],[5,2],[-2,4],[-2,5],[8,11],[2,13],[-3,30],[-4,12],[-9,9],[-8,8],[-4,6],[13,9],[73,-32],[19,5],[55,41],[68,19],[21,0],[10,-3],[13,-7],[8,-7],[4,-3],[4,-13],[-9,-5],[-8,-6],[-32,-9],[-11,-12]],[[6457,1350],[-8,-1],[-16,7],[1,17],[10,16],[9,2],[5,-4],[6,-3],[5,-5],[0,-1],[2,-9],[-2,-8],[-5,-7],[-3,-2],[-4,-2]],[[7691,646],[-6,-4],[-10,-17],[-2,-21],[2,-13],[7,-3],[18,-14],[98,-103],[17,-32],[3,-25],[11,-13],[16,-8],[8,-12],[4,-14],[7,-11],[9,-10],[18,-37],[4,-7],[10,-5],[-2,-11],[0,-10],[-14,-7],[3,-17]],[[7892,252],[-29,-5],[-30,-17],[-11,-2],[-4,1],[-4,4],[-4,3],[-4,-1],[-5,-3],[-5,-2],[-12,1],[-10,3],[-9,4],[-6,7],[-24,45],[-13,19],[-20,10],[-18,0],[-5,3],[-3,6],[-2,7],[-3,5],[-6,3],[-44,0],[-94,20],[-33,-6],[-27,2],[-10,6],[4,11],[-15,-2],[-17,-3],[-7,-5],[-12,-12],[-8,-2],[-3,2],[-2,2],[-3,0],[-6,-6],[-4,-4],[-5,-2],[-5,1],[-2,5],[-3,-2],[-18,-15],[-19,-4],[-17,4],[-16,6],[-17,4],[-14,7],[-12,19],[-15,39],[-16,23],[-20,5],[-21,-6],[-21,-13],[-18,-17],[-11,-8],[-9,0],[3,30],[2,7],[1,4],[0,2],[0,6],[-6,15],[-8,8],[-11,4],[-13,0],[-11,-1],[-29,-8],[-6,2],[-11,6],[-6,1],[-6,0],[-10,-4],[-6,0],[-13,1],[-35,13],[4,4],[-69,6],[-8,5],[-4,10],[-3,33],[-12,35],[-7,27],[-4,13],[-5,6],[-1,2],[-11,17],[-3,0],[-6,-1],[-2,1],[-1,3],[-2,8],[-7,24],[-2,11],[-5,14],[-1,8],[3,14],[16,21],[6,13],[-7,22],[-34,45],[2,18],[-3,4],[-3,31],[-4,15],[-6,12],[-10,11],[-2,6],[-2,6],[-2,15],[0,6],[9,85],[-2,32],[-33,158],[-7,12],[-18,18],[-6,11],[0,10],[-16,13],[-5,6],[8,0],[5,2],[6,4],[6,4],[-4,4],[-1,7],[2,6],[3,6],[-16,-8],[-5,-1],[-5,1],[-3,3],[-2,3],[-3,2],[-2,2],[-3,5],[-4,2],[-10,-5],[-3,2],[-1,6],[0,6],[-7,-1],[-3,3],[0,5],[5,3],[2,2],[9,12],[5,4],[0,5],[-15,2],[-13,10],[-8,14],[-3,16],[-6,-7],[-7,-3],[-14,0],[-8,3],[-5,7],[-3,6],[-5,3],[-54,1],[-12,4],[-3,-5],[-13,8],[-15,4],[-33,2],[-15,3],[-27,13],[-16,3],[-32,-2],[-17,-5],[-12,-10],[-11,-6],[-33,-2],[-14,-3],[-4,-3],[-9,-10],[-2,-4],[-1,-7],[-3,-2],[-4,-1],[-4,-3],[-9,-9],[-35,-25],[-12,-12],[-1,-3],[-2,-2],[-10,-10],[-5,-2],[-23,-3],[-22,-6],[-5,-1],[-18,1],[-5,-2],[-8,-6],[-5,-2],[-19,0],[-16,5],[-5,0],[-10,-5],[-18,-19],[-6,-4],[-6,-6],[-28,-36],[7,3],[4,2],[3,4],[3,-16],[-4,-21],[-6,-19],[-7,-14],[-17,-17],[-19,-12],[-22,-5],[-23,1],[-42,17],[-24,4],[-20,-11],[-6,-13],[-3,-12],[-5,-9],[-12,-4],[-10,-1],[-23,-8],[-8,-4],[-34,-36],[-5,-4],[-50,-48],[-56,-38],[-4,-4],[-3,-4],[-4,-4],[-5,-2],[-7,2],[-9,6],[-6,1],[-44,-5],[-23,5],[-9,15],[-6,20],[-15,17],[-24,5],[-47,-2],[-18,11],[-10,17],[-7,22],[-10,21],[-16,14],[-11,3],[-10,-2],[-10,-4],[-39,-3],[-11,2],[-36,12],[-9,1],[-5,3],[-10,9],[-5,2],[-5,1],[-11,-3],[-34,-19],[-23,-4],[-22,-7],[-11,0],[-23,9],[-13,1],[-12,-8],[-6,3],[-27,27],[-39,27],[-50,45],[-8,11],[-3,13],[-1,32],[-4,14],[-9,12],[-17,13],[-176,70],[-11,1],[-11,4],[-7,9],[-6,10],[-6,10],[-31,9],[-5,7],[-4,14],[-11,8],[-24,8],[-41,44],[-19,15],[-27,14]],[[5757,2645],[44,-4],[94,-31],[46,-41],[23,-34],[22,-19],[23,-13],[27,8],[104,90],[60,33],[16,2],[15,-24],[9,-259],[-12,-50],[10,-67],[47,-69],[44,-47],[53,-38],[62,-11],[33,7],[61,35],[56,62],[16,22],[24,22],[28,-1],[54,-31],[4,-11],[-4,-69],[18,-106],[8,-14],[10,-10],[16,-3],[27,-17],[21,-31],[12,-27],[23,-30],[24,-41],[3,-34],[-14,-14],[-9,-21],[12,-20],[14,-8],[14,-34],[15,-53],[17,-254],[10,-40],[160,-99],[35,-31],[16,-5],[24,27],[13,20],[21,17],[34,-1],[36,-25],[38,-38],[31,-42],[15,-37],[-5,-13],[-32,23],[-11,1],[-1,-14],[13,-44],[0,-17],[-3,-11],[-9,-14],[-7,-21],[-12,-133],[3,-19],[0,-20],[-6,-38],[-11,-15],[1,-14],[69,6],[42,-9],[28,3],[18,10],[18,-5],[20,-11],[32,-6],[10,-7],[-1,-7],[-5,-13],[2,-13],[5,-15],[1,-21],[9,-18],[22,-6],[25,-1],[22,3],[16,19],[15,4],[20,-9],[14,0],[8,-7],[21,-38]],[[2382,9064],[3,-7],[16,-15],[11,-15],[3,-13],[12,-5],[20,-4],[8,-9],[-5,-12],[-117,-144],[-10,-26],[-5,-36],[-16,-27],[-2,-37],[48,-137],[86,-141],[29,-31],[33,-27],[17,-23],[0,-20],[-2,-29],[5,-36],[5,-17]],[[2521,8253],[-35,20],[-18,-6],[-20,-15],[-19,3],[-15,8],[-10,-4],[-6,-11],[0,-12],[-7,-12],[-16,-3],[-39,43],[-21,8],[-15,-4]],[[2300,8268],[-7,2],[-7,4],[-5,0],[-7,15],[-8,4],[-17,-1],[-8,-3],[-5,-6],[-4,0],[3,11],[1,3],[-23,21],[-11,11],[-32,22],[-14,34],[-4,49],[-14,12],[-38,21],[-11,2],[-4,-2],[-50,33],[-16,74],[5,62],[12,26],[5,19],[-5,12],[-35,33],[-41,58],[-26,67],[-3,54],[-16,50],[-36,19],[-116,-18],[-15,3],[-8,5],[-16,17],[-33,-4],[-25,-10],[-6,21],[2,35],[11,24],[13,18],[17,32],[41,31],[22,24],[35,11],[37,-6],[25,17],[-9,34],[-28,15],[0,19],[19,27],[6,45],[-30,77],[-2,51],[-8,12],[7,77],[-20,8],[-33,-31],[-35,-21],[-21,2],[-39,-27],[-60,-106],[7,-11],[8,-3],[-6,-8],[-33,-26],[-19,-27],[-22,-18],[-78,23],[-34,-10],[-35,-20],[-36,-13],[-26,15],[-15,37],[9,42],[20,29],[14,8],[5,10],[20,2],[27,-7],[7,6],[4,19],[0,20],[2,10],[10,1],[24,-20],[23,4],[21,13],[32,4],[45,32],[11,15],[3,12],[2,14],[-10,41],[-7,14],[-16,8],[-7,8],[-1,7],[-2,1],[-4,14]],[[1553,9602],[4,2],[5,6],[3,5],[9,26],[18,31],[2,6],[5,6],[25,16],[52,20],[6,4],[15,9],[17,17],[0,1],[26,33],[17,15],[22,12],[36,12],[11,2],[7,4],[28,29],[9,5],[62,36],[22,23],[8,8],[11,7],[12,3],[39,0],[7,1],[5,5],[6,9],[7,-2],[10,-7],[32,-30],[87,-106],[36,-33],[14,-20],[12,-25],[-6,-2],[-13,-4],[-27,-19],[-33,-6],[-17,-10],[-15,-14],[-10,-19],[-1,-24],[7,-18],[13,-18],[29,-29],[30,-13],[8,-8],[15,-34],[3,-9],[0,-9],[-3,-9],[-4,-9],[-4,-7],[-1,0],[0,-1],[-21,-13],[-96,-17],[-1,-5],[0,-5],[-2,-4],[-27,-18],[-5,-7],[2,-28],[10,-20],[34,-27],[68,-35],[7,-6],[1,-5],[2,-10],[-2,-13],[1,-12],[25,-21],[8,-12],[10,-9],[16,0],[26,12],[12,0],[6,-15],[4,-18],[6,-9],[9,-8],[8,-13],[9,-10],[8,-11],[13,-17],[6,-9],[14,-24],[17,-17],[3,0]],[[3506,6905],[-14,-23],[-17,-53],[-10,-104],[-6,-26],[-9,-6],[-54,-20],[-64,-11],[-31,-22],[-45,-13],[-47,6],[-29,-25],[-1,-45],[11,-16],[-6,-14],[-48,-29],[-5,-35],[28,-36],[23,-22],[19,-9],[21,2],[15,-11],[15,-19],[8,-20],[-2,-28],[12,-34],[24,-32],[35,-31],[133,-13],[54,-32],[119,-36]],[[2567,6069],[54,53],[9,14],[2,16],[-10,43],[-3,38],[-8,37],[-37,78],[-4,72],[-9,43],[-26,11],[-7,19],[18,8],[53,-6],[24,-13],[12,3],[-9,53],[2,47],[14,25],[6,24],[-6,39],[13,21],[94,6],[45,-9],[12,-19],[-11,-25],[8,-31],[21,-26],[16,-17],[23,-2],[13,27],[-12,73],[-13,34],[-24,32],[-27,14],[-56,16],[-23,13],[-12,12],[-1,10],[9,11],[16,2],[30,10],[25,32],[-7,31],[-23,41],[-10,46],[17,22],[14,1],[1,-13],[-1,-17],[10,-16],[18,-3],[18,21],[2,26],[-13,17],[-4,24],[0,16]],[[2810,7053],[91,3],[16,38],[21,18],[92,29],[26,15],[29,8],[24,2],[93,43],[30,2],[16,-2]],[[3248,7209],[22,-6],[53,-3],[50,-16],[30,-29],[13,-8],[6,10],[0,11],[-21,30],[7,18],[29,0],[20,-25],[0,-38],[4,-23],[14,3],[15,32],[24,2]],[[2181,7225],[18,-34],[23,-15],[111,-4],[45,-27],[44,-11],[39,15],[19,27],[0,12]],[[2480,7188],[24,11],[57,-1],[43,-26],[19,-26],[-15,-26],[35,-29],[66,-12],[15,4],[73,-20],[13,-10]],[[1906,6314],[9,19],[19,32],[51,4],[58,-14],[16,14],[-1,32],[5,45],[-5,28],[-10,16],[-12,-3],[-24,-11],[-44,-50],[-13,21],[-8,29],[-14,8],[-17,3],[-38,23],[-26,23],[-5,27],[7,10],[17,7],[52,7],[24,39],[21,49],[17,22],[2,19],[0,10]],[[1987,6723],[16,9],[32,10],[19,11],[5,19],[10,3],[17,-45],[11,-6],[17,16],[18,32],[11,51],[-15,62],[-29,32],[-21,14],[-26,33],[-56,134],[-36,57],[8,17],[27,33],[12,1],[25,-54],[16,-5],[17,8],[15,16],[37,13],[0,17],[-6,15],[-16,21],[-9,27],[19,6],[76,-45]],[[2521,8253],[78,-52],[58,-64],[22,-37],[30,-112]],[[2709,7988],[-42,-15],[-56,-39],[-21,-52],[11,-43],[27,-37],[17,-44],[17,-27],[26,-14],[16,-1],[10,-6],[9,-11],[14,-8],[10,-19],[8,-33],[16,-29],[12,-28],[8,-72],[-11,-19],[-95,-27],[-52,-31],[-32,-38],[-3,-27],[1,-8],[-47,23],[-34,3],[-47,-14],[-29,-23],[-19,-4],[-22,-1],[-16,-3],[-11,-8],[2,-21],[65,-63],[39,-61]],[[2181,7225],[-5,15],[-10,18],[-9,10],[-143,92],[-7,18],[9,25],[20,23],[11,49],[0,69],[-9,39],[-9,1],[-2,1],[-1,5],[2,4],[2,5],[0,4],[-3,17],[1,6],[6,5],[-5,8],[-6,13],[-5,15],[-2,13],[-4,8],[-16,19],[-2,3],[-261,55],[-15,16]],[[1718,7781],[-71,169]],[[1647,7950],[-3,22],[-1,33],[10,21],[79,84],[22,38],[15,12],[34,17],[28,32],[18,12],[19,8],[163,19],[49,-8],[33,6],[124,-13],[39,16],[18,15],[6,4]],[[3515,7652],[-123,14],[-59,-5],[-15,-24],[26,-38],[20,-18],[36,-11],[24,-22],[-16,-59],[-25,-55],[-6,-25],[-18,-18],[-105,-55],[-28,-29],[-7,-26],[5,-21],[13,-32],[11,-19]],[[2709,7988],[49,-24],[1,-12],[7,-22],[29,-39],[32,-31],[71,-22],[26,1],[16,-3],[11,-8],[48,-10],[26,4],[97,56],[11,4],[11,7],[43,10],[71,-8]],[[766,9462],[-3,-3],[-57,-62],[-11,-29],[-15,-72],[7,-39],[13,-36],[0,-33],[-20,-36],[-89,-95],[-29,-51],[-5,-30],[6,-22],[33,-46],[4,0],[0,-10],[3,-5],[4,-3],[3,-6],[4,-12],[0,-7],[-2,-4],[-1,-3],[-1,-23],[19,-183],[10,-15],[2,-5],[1,-3],[4,-41],[-2,-3],[-5,-3],[-5,-4],[-2,-8],[4,-11],[7,-13],[3,-13],[35,-43],[13,-31],[-6,-85],[7,-36],[20,-31],[151,-104],[67,-12],[56,-1],[71,-69],[9,-18],[65,-38],[22,-22],[24,-11],[15,11],[9,14],[1,6],[8,20],[17,22],[31,21],[26,6],[12,-2],[14,14],[22,16],[24,-5],[17,-17],[20,-13],[27,-7],[16,-14],[2,-15],[-7,-10],[21,-63],[-1,-45],[19,-29],[51,-7],[123,15]],[[1718,7781],[-12,-4],[-16,-10],[-2,-14],[4,-11],[-3,-11],[-9,-18],[-22,-27],[-39,-18],[-59,5],[-53,16],[-20,14],[-9,11],[-10,9],[-8,10],[-3,8],[-7,6],[-267,-26],[-131,19],[-45,-19],[-12,-15],[0,-33],[-25,-40],[-84,-29],[-16,-18],[-6,-11],[-11,-12],[-8,-33],[-28,-35],[-9,-22],[-20,-22],[-18,-11],[0,-1]],[[770,7439],[-11,5],[-14,0],[-17,-9],[-9,-3],[-1,0],[-10,-8],[-11,-4],[-12,2],[-9,10],[-3,11],[3,14],[6,14],[7,11],[2,13],[-7,14],[-16,22],[-3,14],[2,32],[-3,13],[-7,8],[-10,8],[-3,8],[13,9],[-10,13],[-4,12],[-1,29],[-2,16],[-6,17],[-9,12],[-13,1],[-29,-12],[-15,-2],[-14,7],[-6,7],[-2,7],[-1,6],[-3,9],[-4,7],[-4,4],[-3,6],[-1,9],[-7,8],[-8,8],[-2,1],[-7,10],[1,11],[2,2],[7,3],[1,1],[1,14],[5,23],[10,25],[1,13],[-5,14],[-13,25],[-8,11],[-8,5],[-7,0],[-6,2],[-6,4],[-4,6],[-7,6],[-7,1],[-16,-1],[-14,4],[-10,7],[-4,12],[5,17],[19,23],[7,12],[3,17],[-3,15],[-5,11],[-2,12],[2,18],[6,8],[1,7],[-4,6],[-11,7],[-6,6],[-3,2],[-5,0],[-11,-3],[-4,1],[-3,3],[-2,11],[-2,4],[-4,3],[-4,1],[-4,2],[-3,5],[-4,12],[0,6],[7,20],[3,13],[-3,11],[-5,12],[-1,14],[3,12],[7,6],[7,4],[6,8],[1,22],[-11,15],[-30,20],[-4,9],[-3,9],[-5,7],[-19,-3],[-5,5],[-7,20],[-8,6],[-19,2],[-7,4],[-4,11],[7,21],[-2,11],[-3,14],[1,17],[4,17],[5,13],[-2,12],[-12,9],[-11,12],[3,21],[4,6],[18,15],[5,9],[-1,6],[-19,24],[-13,12],[-14,7],[-14,-2],[-7,-4],[-8,-3],[-8,1],[-3,8],[0,4],[2,11],[0,3],[-4,3],[-4,0],[-3,-2],[-4,2],[-6,7],[-3,9],[-2,8],[-3,6],[-6,4],[-18,9],[-6,2],[-34,-4],[-18,3],[-9,15],[1,5],[1,3],[6,7],[4,7],[0,9],[-3,9],[1,9],[3,8],[5,9],[4,10],[13,14],[4,11],[5,14],[5,9],[6,5],[10,5],[3,5],[-4,12],[1,6],[4,4],[9,4],[4,5],[3,10],[4,14],[1,13],[-2,33],[15,17],[19,15],[11,17],[0,11],[-4,11],[-6,9],[-8,6],[-8,3],[-6,-1],[-17,-10],[-26,5],[-8,3],[-5,4],[-1,6],[1,11],[1,6],[-2,17],[0,8],[7,28],[0,11],[-4,35],[2,27],[0,14],[-4,11],[-3,5],[-4,2],[-10,3],[-6,4],[1,4],[5,5],[2,5],[-2,12],[-3,8],[-1,9],[2,13],[14,49],[-2,20],[-28,14],[-8,8],[-7,10],[-5,16],[-2,5],[-2,5],[0,6],[0,6],[-4,4],[-5,4],[-3,5],[-2,10],[-2,5],[-3,4],[0,1],[8,12],[8,7],[5,8],[-5,27],[3,11],[10,21],[-4,16],[-20,15],[-23,12],[-13,11],[-1,5],[4,13],[-1,6],[-6,13],[-2,6],[0,6],[1,5],[0,5],[-6,13],[-3,15],[-2,6],[-14,17],[-3,8],[6,8],[10,7],[8,3],[8,0],[12,-2],[12,2],[28,7],[12,-1],[36,-18],[13,-1],[11,3],[27,12],[10,7],[9,14],[0,12],[-2,13],[3,15],[5,8],[1,8],[-2,9],[-1,10],[1,11],[2,9],[17,35],[3,9],[1,2],[1,8],[-3,23],[2,7],[55,46],[13,4],[8,-6],[14,-21],[7,-8],[31,-15],[10,-9],[42,-30],[2,-2],[7,-5],[2,-1],[11,-2],[12,-1],[-1,-3],[-2,-2],[10,-8],[7,-14],[15,-66],[7,-13],[10,-10],[-4,-8],[2,-5],[13,-10],[3,0],[6,0],[4,-1],[1,-3],[2,-3],[1,-2],[19,-13],[3,-4],[2,-5],[4,-7],[5,-6],[5,-3],[4,-7],[9,-21],[4,-7],[4,-7],[4,-7],[5,-34],[3,-10],[14,4],[54,-18],[1,1],[4,3],[5,2],[4,-1],[2,-4],[-1,-7],[-1,-6],[5,-2],[8,-2],[7,-4],[3,-7],[-5,-10],[4,-7],[4,-4],[5,-3],[5,-5],[2,-5],[4,-15],[3,-6],[4,-3],[13,-6],[2,-4],[-1,-7],[-2,-6],[-1,-6],[0,-7],[6,-7],[11,-8],[12,-6],[6,-2]],[[766,9462],[9,-2],[10,-6],[3,-1],[4,-1],[14,0],[29,-8],[47,0],[26,-11],[12,-5],[109,-23],[34,-16],[31,-8],[5,1],[34,5],[9,4],[27,20],[10,5],[7,2],[20,1],[13,4],[5,0],[7,-1],[54,-25],[9,-2],[10,0],[11,5],[8,5],[8,7],[8,8],[6,10],[14,31],[7,9],[9,8],[30,16],[9,8],[9,21],[6,10],[4,3],[9,5],[4,3],[3,4],[13,24],[7,8],[8,7],[9,4],[8,0],[14,-6],[8,-2],[6,1],[31,18]],[[886,5827],[-2,5],[-25,19],[-8,9],[-7,11],[-5,11],[-3,12],[-3,14],[-3,11],[-7,8],[-8,8],[-7,8],[-46,92],[-1,1],[-1,0],[-1,0],[-16,-2],[-13,1],[-12,7],[-11,16],[11,6],[5,4],[5,5],[8,18],[4,18],[6,15],[13,12],[7,9],[21,19],[5,7],[0,8],[-3,6],[-3,6],[-3,7],[1,7],[7,12],[3,7],[7,32],[1,17],[-3,15],[-8,14],[-11,7],[-11,0],[-10,-9],[-10,8],[-7,15],[-16,55],[5,9],[28,7],[3,4],[4,4],[3,5],[2,5],[1,20],[-5,28],[3,19],[20,-7],[18,-10],[16,-4],[35,-3],[12,-5],[3,1],[2,4],[1,8],[0,7],[-1,4],[-6,9],[-2,12],[0,13],[-2,12],[-2,5],[-2,3],[-3,5],[-2,7],[-1,5],[-4,5],[-5,4],[-4,3],[-8,9],[4,11],[15,18],[1,8],[-1,14],[2,8],[5,8],[6,3],[15,1],[14,11],[3,17],[-1,17],[3,13],[12,1],[10,-6],[6,-3],[14,-6],[8,12],[4,16],[4,13],[1,13],[-4,17],[-2,10],[0,9],[3,7],[5,6],[4,1],[7,1],[3,2],[1,3],[-1,9],[0,3],[7,12],[4,2],[8,-3],[10,-7],[6,-3],[6,1],[16,-8],[8,3],[8,7],[14,9],[5,1],[9,-3],[13,5],[7,1],[5,4],[4,8],[-10,13],[7,20],[11,20],[2,18],[-8,7],[-20,0],[-7,5],[-2,11],[5,9],[6,8],[3,7]],[[1093,6950],[14,-5],[99,-84],[124,-183],[23,-16],[11,0],[2,-14],[-4,-20],[1,-27],[17,-20],[31,4],[47,-6],[35,5],[20,12],[2,22],[10,15],[17,3],[11,13],[0,20],[7,15],[22,8],[31,35],[32,3],[21,-1],[10,6],[3,44],[6,14],[74,5],[18,17],[1,23],[-9,21],[5,13],[16,-2],[20,-19],[59,-28],[80,-97],[22,-4],[16,1]],[[2382,9064],[24,-2],[12,4],[14,6],[13,8],[10,11],[12,6],[17,0],[33,-7],[1,-60],[-5,-20],[3,-14],[1,-36],[10,-25],[7,-83],[22,-80],[-4,-13],[-1,-15],[2,-15],[4,-10],[19,-31],[0,-7],[-2,-6],[-1,-5],[6,-27],[11,-25],[26,-41],[35,-38],[38,-28],[83,-46],[39,-13],[199,-28],[21,3],[18,8],[17,3],[18,-10],[-5,-1],[-5,2],[-3,0],[-4,-5],[43,-18],[67,-16],[24,-10],[17,-16],[-2,-25],[4,-9],[7,-25],[5,-10],[7,-12],[12,-37],[16,-26],[18,-19],[37,-29],[26,-33],[8,-5],[10,-3],[33,-23]],[[1093,6950],[1,3],[-4,20],[-12,15],[-29,27],[-33,57],[-6,20],[-1,6],[2,6],[2,4],[4,4],[3,2],[0,3],[-1,3],[-2,3],[-5,13],[-5,13],[3,1],[2,0],[16,-5],[1,9],[-5,26],[0,12],[2,12],[4,10],[7,8],[10,4],[37,-1],[10,3],[26,14],[21,-1],[10,1],[9,9],[7,11],[15,11],[9,7],[6,12],[1,10],[-4,9],[-9,7],[-11,1],[-9,-5],[-9,-6],[-10,-4],[-22,-5],[-11,-1],[-11,5],[-4,4],[-3,3],[-2,5],[-3,14],[-2,2],[-4,1],[-16,7],[-8,0],[-9,-4],[-10,-6],[-10,-3],[-33,1],[-17,-6],[-5,1],[-6,1],[-5,1],[-12,-12],[-10,-5],[-11,-1],[-8,6],[-6,2],[-20,-7],[-9,3],[-6,9],[-14,35],[-24,36],[-15,15],[-14,3],[-7,5],[-19,19],[-20,7]],[[8533,6131],[5,-58],[15,-104],[-1,-27],[-16,-39],[-4,-23],[13,-49],[32,-35],[42,-19],[41,-3],[38,2],[20,-1],[17,-5],[8,-5],[9,-9],[5,-10],[-1,-1],[-4,-7],[-8,-3],[-24,-2],[-9,-7],[-2,-10],[2,-11],[1,-12],[-3,-13],[-5,-8],[-17,-12],[-15,-14],[-20,-30],[-25,-37],[-28,-42],[-25,-37],[-4,-10],[1,-54],[8,-43],[15,-56],[17,-66],[18,-68],[19,-71],[21,-79],[23,-94],[18,-73],[-1,-55],[-7,-54],[-3,-11],[-14,-20],[-4,-10],[2,-5],[4,-2],[3,-4],[-4,-15],[1,-7],[2,-7],[2,-7],[1,-15],[-4,-42],[2,-33],[7,-63],[-7,-50],[1,-16],[8,-33],[6,-63],[17,-8],[53,-9],[87,-14]],[[8862,4343],[10,-40],[-7,-82],[-34,-89],[-24,-100],[-11,-178],[2,-52],[27,-132],[-1,-21],[-8,-14],[-18,-8],[-70,-2],[-43,41],[-81,131],[-64,53],[-48,15],[-12,11],[-18,22],[-29,5],[-388,-124],[-16,-9]],[[8029,3770],[-207,340],[-74,62],[-590,299]],[[7320,5226],[13,17],[22,42],[17,81],[72,120],[163,118],[23,26],[26,46],[3,19],[16,31],[-79,63],[-4,20],[-6,16],[-12,9],[-14,16],[-3,29],[8,38],[13,35],[2,27],[-5,30],[11,50],[5,45],[-21,36],[-3,18],[8,19],[28,12],[82,-12],[53,-17],[15,11],[14,18],[154,24],[48,31],[54,21],[28,-26],[51,-90],[68,-26],[322,1],[40,7],[1,0]],[[6556,7872],[1,19],[-4,24],[4,31],[30,42],[125,106],[83,-4],[343,-200],[143,-23],[39,10],[20,19],[17,53],[-4,21],[-19,12],[-7,11],[4,19],[31,34],[-2,16],[-18,9],[-10,17],[-4,17],[-7,-3],[-8,-21],[-13,-2],[-10,19],[-14,17],[-25,18],[-3,24],[21,27],[31,96],[19,28],[5,20],[1,13],[4,12],[14,18],[11,22],[-3,27],[-14,30],[-47,46],[-12,29],[-6,23],[-10,12],[-233,12],[-19,15],[8,23],[6,25],[0,30],[20,21],[62,40]],[[7106,8726],[2,0],[9,2],[4,-1],[4,-4],[4,-10],[3,-5],[8,-3],[9,1],[8,2],[9,0],[18,-5],[81,-40],[34,-8],[17,-2],[9,-2],[9,-4],[4,-5],[0,-5],[-2,-5],[1,-5],[8,-16],[2,-5],[1,-12],[0,-10],[3,-7],[9,-8],[8,-3],[41,-7],[6,-3],[14,-10],[7,-2],[47,5],[9,4],[7,11],[5,12],[6,9],[8,6],[10,1],[9,-4],[26,-24],[22,-10],[12,-2],[11,1],[5,3],[3,4],[4,3],[6,1],[11,-3],[5,1],[6,2],[6,9],[2,10],[3,4],[31,-18],[40,-9],[20,-10],[8,-5],[6,-3],[16,-2],[5,-4],[17,-18],[69,-52],[11,-1],[29,14],[12,-3],[11,-11],[10,-14],[2,-9],[-1,-15],[3,-7],[1,-6],[-2,-6],[-3,-7],[-2,-7],[1,-15],[10,-47],[7,-9],[32,-28],[10,-11],[3,-5],[-1,-3],[-2,-3],[-1,-2],[0,-4],[-2,-6],[2,-5],[8,-2],[4,-4],[4,-3],[4,-2],[5,-1],[16,7],[8,-1],[8,-10],[4,-11],[2,-12],[4,-12],[7,-5],[5,1],[4,4],[6,10],[4,2],[6,0],[75,-25],[34,-31],[19,-11],[42,-8],[20,-9],[15,-22],[19,-43],[24,-39],[55,-70],[11,-19],[15,-41],[11,-20],[17,-10],[82,1],[73,2],[110,2],[62,1],[53,1],[25,-5],[21,-3],[5,-23],[4,-10],[2,-7],[1,-8],[-1,-9],[-2,-7],[-3,-7],[-3,-5],[-2,-7],[1,-8],[3,-10],[-11,-55],[-3,-33],[7,-20],[-2,-3],[-1,-2],[-1,-4],[5,-3],[4,-3],[3,-4],[3,-4],[2,-7],[1,-7],[0,-16],[1,-7],[8,-13],[8,-42],[1,-21],[1,-3],[-1,-4],[-6,-8],[-2,-5],[-2,-6],[-1,-6],[0,-7],[-2,-7],[-4,-3],[-5,-2],[-3,-4],[-2,-8],[2,-14],[0,-6],[-7,-7],[-10,-9],[-6,-8],[7,-4],[13,-2],[10,-6],[9,-9],[8,-11],[6,-9],[4,-11],[4,-12],[2,-25],[2,-10],[0,-11],[-3,-15],[3,-5],[0,-7],[-3,-16],[0,-4],[0,-12],[-2,-5],[-7,-7],[-2,-4],[2,-18],[7,-16],[12,-21],[4,-6],[5,-28],[2,-13],[-3,-15],[-7,-12],[-13,-16],[-5,-13],[-5,-22],[-3,-7],[-10,-15],[-3,-8],[-3,-14],[3,-35],[-5,-12],[-10,-6],[-12,-2],[-11,0],[-7,-7],[-3,-14],[-1,-15],[1,-7],[2,-3],[3,-6],[0,-7],[-5,-3],[-4,-3],[3,-6],[19,-27],[1,-3],[-1,-8],[-1,-6],[0,-5],[6,-7],[-13,-19],[-3,-9],[-4,-28],[-7,-26],[-2,-13],[-1,-7],[-8,-12],[-1,-9],[0,-7],[2,-13],[1,-5],[-2,-24],[-5,-23],[-15,-6],[-3,-11],[-10,-19],[-17,-14],[-9,-12],[-1,-16],[2,-18],[-2,-16],[-6,-8],[-6,-2],[-6,1],[-8,-1],[-7,-5],[-3,-4],[-3,-5],[-23,-30],[-10,-7],[-13,-4],[-29,-4],[-12,-7],[-8,-15],[6,0],[4,-3],[3,-5],[5,-16],[4,-5],[13,-6],[6,-6],[5,-8],[8,-18],[39,-54],[6,-13],[-39,-2],[-52,-4],[-37,-2],[4,-15],[-9,-9],[-24,-14],[-18,-21],[-17,-23],[-14,-32],[-3,-31],[1,-9]],[[6294,8850],[16,-7],[9,-1],[44,8],[8,6],[5,11],[2,12],[-2,12],[-14,17],[3,9],[33,31],[17,13],[19,7],[47,2],[9,-2],[7,-5],[7,-5],[7,-4],[8,2],[42,19],[25,4],[5,-1],[20,-17],[18,-10],[8,-3],[78,-15],[20,-9],[11,-2],[9,6],[7,6],[17,12],[6,7],[11,19],[1,1],[5,5],[9,5],[5,1],[6,-1],[11,-4],[6,-4],[1,-4],[0,-5],[3,-6],[12,-21],[9,-24],[6,-9],[17,-19],[6,-21],[11,-16],[3,-12],[-2,-11],[-10,-36],[13,-18],[75,-31],[8,1],[8,3],[9,1],[8,-1],[27,-8],[25,1],[8,2],[8,0],[7,-5],[6,-6],[7,-4],[2,0]],[[7691,646],[10,30],[3,25],[0,42],[6,18],[7,11],[-1,22],[10,14],[8,26],[-4,26],[-18,25],[-10,40],[13,31],[17,23],[-1,24],[-16,17],[-9,16],[15,29],[14,52],[-27,65],[-39,53],[-11,46],[2,44],[-2,25],[-13,57],[0,68],[60,273],[7,77],[-4,236],[60,90],[16,62],[-19,34],[-42,38],[-19,34],[30,18],[58,24],[121,80],[23,22],[16,19],[0,25],[-5,26],[-15,37],[-1,56],[-7,45],[7,44],[44,76],[15,67],[2,59],[-18,144],[-21,59],[-23,18],[-12,15],[4,56],[107,561]],[[8862,4343],[88,-15],[102,-17],[60,-9],[28,-5],[13,-6],[11,-9],[18,-26],[4,-13],[-4,-29],[0,-14],[5,-14],[14,-25],[5,-16],[0,-20],[2,-7],[9,-21],[6,-22],[3,-14],[0,-13],[-4,-15],[-10,-22],[2,-8],[2,-46],[-3,-2],[-1,-5],[-1,-12],[1,-1],[1,-3],[-9,-11],[-43,-58],[-65,-90],[-59,-81],[-42,-57],[-56,-76],[-30,-40],[-43,-58],[-80,-109],[-39,-53],[-30,-40],[42,-56],[27,-37],[34,-46],[39,-54],[41,-55],[42,-58],[10,-10],[11,-5],[9,-7],[5,-18],[-1,-13],[-6,-24],[0,-13],[5,-14],[16,-21],[7,-11],[2,-8],[1,-17],[3,-8],[5,-7],[5,-2],[5,0],[5,-4],[6,-10],[2,-11],[4,-10],[9,-4],[5,-5],[2,-6],[-2,-6],[-5,-6],[-4,-4],[-1,-4],[1,-4],[4,-4],[7,-3],[6,-6],[4,-7],[22,-58],[3,-13],[1,-11],[3,-10],[15,-20],[15,-37],[15,-21],[53,-56],[22,-33],[33,-35],[16,-22],[10,-6],[31,-10],[24,-16],[16,-6],[34,-3],[17,-4],[43,-23],[68,-16],[15,-8],[6,-9],[4,-9],[6,-8],[8,-5],[9,-4],[5,-4],[4,-7],[3,-11],[7,-15],[33,-41],[11,-8],[84,20],[12,-8],[2,-24],[-7,-70],[-8,-77],[9,-47],[14,-65],[3,-41],[4,-54],[3,-35],[5,-62],[2,-36],[-3,-28],[-27,-72],[10,-14],[3,-7],[-1,-11],[-3,-10],[-3,-8],[-5,-4],[-8,-1],[22,-23],[8,-5],[4,0],[7,5],[4,1],[4,-2],[12,-8],[17,-4],[14,1],[30,7],[13,2],[28,10],[13,1],[9,-1],[7,0],[28,11],[5,0],[7,-3],[13,-15],[6,-4],[13,-5],[4,-4],[6,-7],[7,-13],[18,-45],[-9,4],[-11,0],[-10,-6],[-6,-10],[-2,-7],[-6,-10],[-2,-6],[0,-8],[2,-77],[5,-13],[6,-11],[5,-11],[-2,-12],[-8,-9],[-21,-4],[-8,-5],[-4,-10],[-4,-99],[-6,-27],[-11,-14],[-6,1],[-4,2],[-3,3],[-5,3],[-5,0],[-15,-4],[-20,1],[-20,3],[-47,2],[-41,1],[-35,1],[-6,-2],[-4,-6],[-5,-12],[-4,-3],[-3,-2],[-5,-2],[-16,-5],[-4,1],[-6,3],[-6,2],[-4,-4],[-4,-5],[-5,-4],[-10,-4],[-87,-11],[-5,-2],[-4,-3],[-4,-9],[-3,-3],[-5,-2],[-11,1],[-5,-1],[-4,-2],[-7,-6],[-4,-3],[-11,-5],[-4,-3],[-3,-5],[-1,-6],[1,-5],[2,-3],[1,-5],[-6,-11],[-16,-19],[-4,-9],[3,-15],[5,-13],[1,-9],[-11,-7],[-20,3],[-23,9],[-19,3],[-9,-16],[-2,-17],[-5,-7],[-21,-4],[-11,-4],[-9,-5],[-19,-15],[-63,-21],[-12,-12],[-8,-18],[-4,-21],[-5,-41],[-4,-37],[-5,-42],[-6,-57],[-6,-47],[-3,-12],[-8,-11],[-9,-3],[-10,0],[-11,-3],[-10,-18],[2,-25],[6,-27],[-2,-23],[-3,-5],[-7,-9],[-4,-7],[-1,-10],[-2,-39],[-4,-58],[-3,-68],[-3,-57],[-17,-57],[-3,10],[-1,11],[-9,8],[-2,4],[-2,2],[-5,-4],[-2,-4],[-1,-10],[-1,-5],[3,-3],[5,-7],[3,-3],[-11,1],[-9,4],[-8,1],[-11,-11],[12,-4],[5,-4],[4,-6],[-3,-6],[-8,-13],[-2,-7],[0,-3],[-1,-3],[-4,-5],[-7,-4],[-29,-11],[8,-6],[-12,-19],[-87,36],[-31,7],[1,12],[-8,16],[-73,31],[-84,17],[-72,20],[-49,8],[-9,5],[8,9],[-12,21],[-2,9],[0,39],[-2,6],[-19,22],[-8,5],[-9,2],[-9,-1],[-36,-13],[-8,-6],[-5,-9],[-9,-12],[-4,-8],[0,-4],[2,-4],[2,-14],[2,-2],[4,0],[6,-4],[4,0],[2,-1],[2,-5],[6,-7],[-6,1],[0,-1],[15,-9],[-1,-9],[-6,2],[-17,8],[-21,10],[-11,7],[-22,0],[-15,14],[5,11],[2,3],[-8,4],[-9,2],[-19,-1],[-14,-4],[-3,-1],[-5,-6],[0,-4],[2,-4],[10,-8],[-3,-13],[-14,0],[-11,8],[-5,2],[-18,4],[-4,3],[-6,9],[-8,5],[-19,-1],[-26,-5],[-28,-1],[-19,-17],[-22,9],[-22,24],[-23,8],[-60,-5],[-23,0],[-40,11],[-24,30],[-19,12],[-30,-6],[-61,-12],[-14,-3]]],"transform":{"scale":[0.001930669548054798,0.00147135901920193],"translate":[44.01486332200011,25.059408165]}};
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
