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
  Datamap.prototype.kazTopo = {"type":"Topology","objects":{"kaz":{"type":"GeometryCollection","geometries":[{"type":"MultiPolygon","properties":{"name":null},"id":"-99","arcs":[[[0]],[[1]]]},{"type":"Polygon","properties":{"name":"Aqtöbe"},"id":"KZ.AT","arcs":[[2,3,4,5,6,7,8,9]]},{"type":"Polygon","properties":{"name":"Qostanay"},"id":"KZ.QS","arcs":[[10,11,12,-10,13]]},{"type":"Polygon","properties":{"name":"Qyzylorda"},"id":"KZ.QO","arcs":[[14,15,16,-4],[17]]},{"type":"MultiPolygon","properties":{"name":"Atyrau"},"id":"KZ.AR","arcs":[[[18]],[[19,20,21,-7]]]},{"type":"Polygon","properties":{"name":"West Kazakhstan"},"id":"KZ.WK","arcs":[[-8,-22,22]]},{"type":"Polygon","properties":{"name":"Aqmola"},"id":"KZ.AM","arcs":[[23,24,-12,25],[26]]},{"type":"Polygon","properties":{"name":"Qaraghandy"},"id":"KZ.QG","arcs":[[27,28,29,30,31,-15,-3,-13,-25]]},{"type":"Polygon","properties":{"name":"North Kazakhstan"},"id":"KZ.NK","arcs":[[32,-26,-11,33]]},{"type":"Polygon","properties":{"name":"Pavlodar"},"id":"KZ.PA","arcs":[[34,-28,-24,-33,35]]},{"type":"Polygon","properties":{"name":"East Kazakhstan"},"id":"KZ.EK","arcs":[[36,-29,-35,37]]},{"type":"Polygon","properties":{"name":"Almaty"},"id":"KZ.AA","arcs":[[38,39,-30,-37],[40]]},{"type":"MultiPolygon","properties":{"name":"Mangghystau"},"id":"KZ.MG","arcs":[[[41]],[[42]],[[43]],[[44]],[[-6,45,-20]]]},{"type":"Polygon","properties":{"name":"South Kazakhstan"},"id":"KZ.SK","arcs":[[46,47,-16,-32]]},{"type":"Polygon","properties":{"name":"Zhambyl"},"id":"KZ.ZM","arcs":[[48,-47,-31,-40]]},{"type":"Polygon","properties":{"name":"Almaty City"},"id":"KZ.AC","arcs":[[-41]]},{"type":"Polygon","properties":{"name":"Astana"},"id":"KZ.AS","arcs":[[-27]]}]}},"arcs":[[[1002,2817],[-1,-1],[-1,47],[2,5],[4,-12],[4,-9],[4,-1],[0,-3],[-9,-15],[-3,-11]],[[1596,3909],[-7,-9],[-6,1],[2,12],[13,30],[3,1],[1,-4],[0,-5],[0,-6],[-3,-10],[-3,-10]],[[4282,5095],[47,-144],[10,-40],[-24,-49],[-309,-418]],[[4006,4444],[-22,-2],[-28,25],[-23,7],[-23,13],[4,29],[-36,104],[-37,66],[-29,18],[-47,139],[-70,-1],[-60,-28],[-54,-139],[-22,-112],[-62,-176],[-55,8],[-24,-44],[-7,-83],[-59,-26],[-61,-84],[-62,-121],[-136,-346],[-21,-167],[7,-333]],[[3079,3191],[-22,28],[-31,41],[-24,31],[-15,20],[-5,7],[-19,24],[-7,6],[-5,1],[-20,-11],[-15,-8],[-15,-8],[-14,-9],[-15,-8],[-14,-8],[-14,-8],[-15,-8],[-14,-8],[-30,-19],[-31,-18],[-31,-18],[-30,-18],[-23,-14],[-23,-15],[-23,-14],[-23,-14],[-23,-15],[-23,-14],[-23,-14],[-23,-15],[-5,-3]],[[2504,3082],[0,3],[-41,530],[-16,88]],[[2447,3703],[-13,47],[-5,43],[-6,33],[-20,58],[-6,70],[-190,137],[-50,88],[-30,85],[-21,101],[-20,57],[1,98],[17,235],[-3,78],[-21,168],[-25,53],[1,73],[-9,82],[-11,72],[6,84],[6,15],[1,36],[-12,76],[-22,4],[-11,16],[-8,24],[-13,5],[-10,-13],[-11,-32],[-12,-60],[-91,40],[5,22],[-3,33],[0,64],[-7,75],[-18,82],[-18,-46],[-10,10],[-1,20],[-29,27],[-17,28]],[[1761,5791],[0,69],[11,76],[-1,42],[13,6],[10,38],[12,21],[30,15],[7,24],[12,2],[30,-5],[28,25],[1,29],[10,24],[15,24],[13,34],[4,37],[11,42],[3,27],[6,40],[-7,25],[-11,14],[-13,41],[3,71],[-11,69],[16,31],[4,34],[18,51]],[[1975,6697],[1,0],[10,8],[14,21],[7,19],[-1,22],[-8,49],[0,14],[3,25],[0,14],[-2,4],[-3,8],[-1,5],[1,6],[3,12],[2,6],[-3,26],[-14,14],[-14,7],[-6,8],[4,6],[4,4],[3,7],[-5,25],[2,8],[5,5],[21,12],[5,0],[6,-3],[5,-5],[10,-16],[16,-14],[5,-8],[7,-17],[8,-15],[38,-19],[4,-15],[-1,-26],[6,-18],[54,-89],[6,-6],[4,-3],[5,1],[12,6],[6,0],[7,-3],[5,-7],[4,-11],[2,-11],[2,-9],[12,-8],[4,-7],[7,-19],[11,-13],[8,5],[17,33],[41,40],[36,53],[5,15],[10,82],[2,16],[3,8],[4,3],[20,-17],[8,-3],[6,3],[5,8],[2,10],[2,25],[3,7],[13,3],[4,9],[0,9],[-3,20],[0,10],[2,8],[4,7],[8,11],[7,-4],[22,-56],[5,-4],[17,-6],[5,1],[1,8],[-2,11],[-5,22],[-1,13],[4,9],[5,6],[5,3],[6,2],[4,-3],[9,-13],[6,-3],[7,0],[6,3],[6,5],[6,3],[21,-4],[11,5],[16,18],[5,2],[3,-4],[3,-13],[2,-26],[2,-12],[4,-5],[6,-1],[4,-2],[5,-6],[3,-11],[3,-11],[3,-24],[2,-10],[4,-11],[4,-8],[16,-16],[6,-3],[6,1],[6,5],[4,10],[3,10],[3,9],[6,6],[10,-2],[22,-12],[9,8],[3,19],[0,22],[-2,45],[2,25],[4,16],[4,15],[7,2],[11,-12],[4,-1],[13,0],[3,-3],[2,-4],[4,-10],[3,-1],[7,7],[3,2],[18,5],[2,-1],[1,-3],[0,-4],[0,-4],[1,-3],[5,-7],[7,-6],[7,-1],[5,7],[3,12],[2,15],[3,12],[6,5],[5,3],[10,10],[4,-5],[7,-14],[3,-9],[1,-9],[0,-9],[2,-7],[5,-5],[30,-1],[10,-9],[8,-17],[2,-29],[-1,-12],[-3,-10],[-4,-8],[-4,-7],[-2,-9],[1,-13],[3,-12],[2,-8],[5,-1],[12,1],[3,-7],[-2,-26],[1,-9],[4,-7],[6,-1],[8,3],[7,1],[5,-8],[4,-22],[2,-9],[4,-8],[19,-24],[9,-8],[67,-10],[5,-3],[4,-9],[3,-10],[3,-7],[3,-3],[5,0],[23,10],[12,1],[10,-12],[5,-9],[13,-10],[3,-4],[0,-17],[-7,-5],[-14,4],[-6,-11],[0,-10],[3,-10],[14,-22],[8,7],[8,15],[9,12],[12,3],[13,-1],[12,4],[10,20],[11,40],[3,9],[8,16],[2,9],[1,12],[-1,24],[0,13],[2,12],[10,44],[2,6],[2,4],[10,7],[16,2],[12,-9],[4,-24],[1,-25],[5,-20],[8,-15],[9,-12],[14,-11],[102,-22],[24,7],[68,40],[68,41],[8,13],[5,21],[4,28],[4,60],[2,19],[12,112],[5,32],[8,19],[11,10],[12,6],[-4,3]],[[3713,7190],[6,1],[35,3],[15,18],[12,-38],[3,-36],[6,-38],[17,-43],[31,30],[34,-47],[-9,-19],[-5,-45],[34,-64],[-18,-64],[3,-40],[8,-15],[24,1],[22,-159],[38,-146],[49,-133],[5,-86],[-23,-15],[-25,23],[-26,-36],[-13,-70],[-24,-43],[-11,-58],[10,-54],[-33,3],[-10,-25],[4,-30],[46,-145],[-24,-6],[-26,-22],[23,-13],[18,-79],[53,-116],[38,-18],[22,22],[30,-14],[6,-49],[-6,-66],[154,-150],[76,-214]],[[4803,9462],[0,-2],[32,-227],[-29,-21],[15,-34],[30,-21],[19,-55],[-60,-45],[-26,-28],[5,-58],[13,-65],[16,-5],[17,-40],[-4,-70],[-23,-41],[10,-57],[31,-10],[9,-79],[0,-72],[14,-42],[23,-37],[-23,-27],[-53,-13],[-14,-47],[3,-24],[8,-17],[7,-32],[0,-31],[-3,-51],[-19,-35],[-8,-105],[-1,-114]],[[4792,7957],[-4,-151],[-20,-39],[-13,-63],[-10,-89],[-38,-70],[-47,-27],[-17,3],[-4,-41],[40,-46],[13,-46],[-5,-71],[-5,-26],[-3,-27],[7,-13],[-6,-15],[-11,-17],[-12,-30],[10,-23],[-2,-41],[43,-130],[3,-121],[31,5],[22,56],[30,9],[23,-29],[5,-43],[9,-13],[25,1],[16,-43],[24,-30],[87,-52],[71,21],[27,-37],[0,-54],[-11,-34],[11,-33],[25,-34],[31,31],[33,24],[64,15],[40,22],[18,24]],[[5292,6680],[8,-9],[11,-24],[24,-30],[-15,-54],[-25,-45],[-72,-39],[-14,-12],[0,-24],[3,-13],[-3,-8],[-2,-9],[5,-19],[-2,-34],[-58,-132],[-159,-264],[-22,-54],[-28,-20],[-12,-66],[-28,-16],[-85,-140],[-48,-12],[-33,-32],[-23,-51],[-52,-19],[-110,29],[-81,-24],[-29,-124],[-29,-2],[2,-19],[-2,-36],[10,-47],[-28,-17],[-53,-50],[-1,-70],[-59,-99]],[[3713,7190],[-13,10],[-7,12],[-6,19],[-10,52],[-5,14],[-1,3],[-9,4],[-11,12],[-9,7],[-3,-1],[-6,-4],[-3,0],[-4,1],[-8,9],[-6,2],[-17,-2],[-5,1],[-10,6],[-5,1],[-8,0],[-3,0],[-2,2],[-1,2],[-1,2],[-1,2],[-1,3],[-2,3],[-8,10],[-3,6],[-4,14],[-1,8],[-1,6],[0,22],[1,9],[-4,0],[-100,4],[-2,1],[-1,5],[-1,7],[-1,6],[-2,3],[-27,8],[-5,6],[0,14],[4,9],[12,9],[4,7],[1,5],[0,12],[1,4],[5,6],[3,5],[1,5],[-7,14],[-44,19],[-25,32],[-8,6],[-3,-7],[-2,-10],[-6,-6],[-8,2],[-5,9],[-11,43],[-2,11],[0,11],[4,16],[6,0],[43,1],[35,65],[19,27],[20,15],[14,-1],[13,-5],[14,1],[12,17],[10,27],[4,7],[24,17],[5,6],[12,23],[5,7],[10,10],[8,14],[-15,35],[-5,10],[-1,12],[-1,28],[-2,12],[-2,6],[-3,4],[-22,13],[-4,6],[-2,11],[1,32],[0,13],[-1,11],[-1,4],[-3,1],[-12,-3],[-5,1],[-3,4],[-1,6],[-1,4],[-1,4],[-3,3],[-2,4],[-1,6],[0,7],[0,8],[6,27],[10,11],[12,5],[10,9],[4,8],[5,19],[5,9],[42,65],[-20,33],[0,1],[19,0],[9,4],[8,10],[8,11],[9,3],[8,-5],[8,-9],[7,-5],[8,-2],[7,2],[7,5],[12,16],[6,3],[7,-6],[9,-13],[15,-25],[7,-5],[8,8],[4,7],[5,2],[11,-3],[25,6],[9,-5],[16,-22],[9,-2],[18,12],[10,11],[5,16],[5,33],[0,15],[-2,16],[-6,17],[-8,8],[-53,17],[-17,13],[-14,23],[-10,24],[-6,3],[-23,-22],[-8,-2],[-9,5],[-24,31],[-9,6],[-23,-1],[-11,5],[-10,15],[-5,16],[-2,17],[1,17],[4,16],[11,26],[2,10],[1,8],[1,20],[5,7],[6,3],[6,-2],[5,-8],[5,-14],[6,-14],[7,-10],[8,0],[6,7],[13,22],[6,9],[10,9],[-7,45],[-3,9],[-3,2],[-28,0],[-7,-4],[-11,-25],[-8,-2],[-35,14],[-4,4],[-2,5],[-3,11],[-1,4],[-13,6],[-34,4],[-6,13],[6,16],[25,-14],[8,12],[1,9],[0,8],[0,8],[2,8],[4,4],[9,2],[2,8],[3,16],[6,12],[7,11],[5,10],[0,16],[-6,9],[-8,6],[-7,7],[-5,12],[-2,3],[-5,2],[-16,1],[-5,2],[-2,7],[-1,8],[1,7],[2,8],[4,10],[5,5],[12,4],[8,1],[11,-5],[2,-3],[1,-4],[2,-7],[3,-8],[4,-6],[5,0],[4,12],[0,12],[-1,11],[-5,22],[-1,4],[-2,13],[14,2],[6,5],[5,12],[4,9],[7,3],[19,-5],[4,-6],[7,-24],[4,-6],[18,-7],[1,-21],[2,-6],[4,-3],[5,2],[3,6],[1,10],[1,12],[23,0],[3,-5],[4,-2],[3,1],[5,11],[4,1],[3,-3],[4,-3],[2,-13],[0,-9],[2,-6],[5,-6],[8,-4],[28,-3],[0,41],[-1,4],[0,13],[101,6],[5,-1],[3,-7],[-1,-15],[-10,-12],[-4,-9],[1,-13],[5,-12],[12,-10],[5,-10],[2,-6],[3,-5],[3,-4],[3,0],[4,3],[1,5],[-2,21],[-1,5],[0,5],[3,9],[10,18],[-4,12],[-1,3],[-3,23],[7,18],[12,12],[10,4],[21,3],[14,9],[4,-2],[11,-8],[7,-1],[20,10],[24,-5],[7,5],[4,11],[-1,10],[-2,10],[-2,12],[4,11],[8,4],[14,-1],[28,-10],[1,0],[9,0],[7,5],[13,17],[6,5],[17,2],[40,30],[9,-1],[7,-7],[20,-25],[7,-3],[3,-2],[3,9],[8,5],[9,2],[7,7],[5,18],[-8,17],[-4,11],[1,5],[1,2],[2,6],[2,2],[5,-8],[3,-2],[3,-1],[3,1],[2,2],[4,9],[2,2],[4,1],[11,-5],[6,2],[11,9],[8,3],[5,4],[1,2],[3,4],[4,-1],[6,-5],[24,5],[3,2],[3,5],[1,4],[2,3],[3,-1],[5,-3],[3,-1],[6,2],[10,12],[3,-5],[15,-21],[8,-8],[9,-1],[15,13],[16,21],[15,12],[17,-11],[19,-42],[4,-6],[3,-4],[4,-2],[4,0],[2,2],[3,5],[1,1],[8,-5],[2,0],[7,22],[-7,71],[5,16],[-1,11],[0,3],[0,16],[4,8],[31,22],[7,1],[14,-7],[5,3],[2,14],[-3,25],[1,9],[7,3],[24,-5],[34,-19],[7,3],[7,11],[7,20],[7,17],[8,9],[17,11],[5,-6],[2,-44],[4,-11],[30,17]],[[4006,4444],[-42,-62],[-5,-30],[73,22],[64,-80],[34,-9],[62,-55],[32,-6],[13,7],[8,-12],[292,-224],[22,-4],[59,-102],[52,-47],[349,-158],[41,5],[24,-4],[7,-67]],[[5091,3618],[4,-65],[26,-41],[9,-69],[-18,-60],[-16,-160],[-1,-79],[23,-38],[32,-39],[19,-46],[3,-512],[24,-36],[10,5],[15,-13],[14,-22],[3,-20],[23,-56],[57,-85],[0,-44],[-22,-1],[-17,-39],[7,-26],[2,-45],[-9,-53],[-25,29],[-2,-69],[-18,-63],[-6,-60],[-21,-41],[4,-65],[7,56],[9,8],[0,-25],[9,-1],[2,-47],[17,-29],[7,-9],[-12,-24],[-120,-117],[-119,-159],[-52,-95],[-22,17],[-36,-37],[-77,-152],[-19,6],[-23,7]],[[4782,1204],[0,20],[1,5],[1,5],[3,2],[3,2],[1,6],[1,6],[1,18],[0,17],[5,168],[6,167],[-36,-39],[-35,-38],[-2,0],[-2,1],[-16,65],[-18,76],[-14,55],[-20,86],[-5,9],[-5,9],[-25,31],[-25,32],[-13,26],[-12,26],[-26,68],[-27,69],[-4,7],[-4,8],[-4,1],[-4,1],[-4,-3],[-4,-4],[-24,-26],[-25,-27],[-23,-26],[-25,-27],[-4,-3],[-4,-2],[-14,2],[-34,6],[-33,6],[-34,7],[-34,6],[-38,7],[-37,6],[-37,7],[-38,7],[-22,-7],[-22,-8],[-23,-7],[-22,-7],[-22,-7],[-23,-8],[-22,-7],[-22,-7],[-14,-5],[-14,-5],[-14,-6],[-14,-5],[-8,-3],[-9,-3],[-9,-3],[-8,-3],[-20,-8],[-1,0],[-5,4],[-5,5],[-18,42],[-14,31],[-14,32],[-13,31],[-14,32],[-14,32],[-14,32],[-14,33],[-14,32],[-18,39],[-13,29],[-13,29],[-28,60],[-15,46],[-2,15],[-2,35],[-1,17],[-5,17],[-6,14],[-15,20],[-22,28],[-29,39],[-36,46],[-41,54],[-45,58],[-47,62],[-49,64],[-49,65],[-48,62],[-46,60],[-42,55],[-16,21]],[[4139,3354],[14,1],[14,5],[14,7],[13,9],[13,12],[11,13],[11,16],[10,18],[10,20],[8,21],[7,23],[6,25],[5,25],[3,27],[3,27],[0,29],[0,28],[-3,28],[-3,26],[-5,26],[-6,24],[-7,23],[-8,21],[-10,20],[-10,18],[-11,16],[-11,14],[-13,12],[-13,9],[-14,7],[-14,4],[-14,2],[-15,-2],[-14,-4],[-14,-7],[-13,-9],[-13,-12],[-11,-14],[-11,-16],[-10,-18],[-10,-20],[-8,-21],[-7,-23],[-6,-24],[-5,-26],[-3,-26],[-3,-28],[0,-28],[0,-29],[3,-27],[3,-27],[5,-25],[6,-25],[7,-23],[8,-21],[10,-20],[10,-18],[11,-16],[11,-13],[13,-12],[13,-9],[14,-7],[14,-5],[15,-1]],[[818,3793],[-4,-5],[-5,9],[-4,16],[-11,61],[0,13],[7,0],[10,-12],[5,-9],[3,-8],[4,-19],[0,-16],[-5,-30]],[[2447,3703],[-27,25],[-12,-1],[-19,14],[-26,-3],[-14,18],[-8,30],[-24,-6],[-27,25],[-2,65],[-20,37],[-17,-20],[-48,83],[-57,-91],[-84,-8],[-191,-75],[-9,-13],[-14,2],[-19,-12],[-39,-101],[-24,-45],[16,-34],[-54,-64],[-122,-59],[-43,20]],[[1563,3490],[3,7],[3,4],[6,4],[2,4],[8,23],[4,12],[4,26],[4,13],[7,14],[2,7],[1,5],[3,15],[1,8],[6,18],[1,10],[-1,12],[0,-4],[-2,11],[2,8],[5,16],[2,9],[2,11],[2,47],[7,60],[0,46],[-7,36],[-11,27],[-13,24],[6,-1],[7,-13],[5,-4],[0,5],[-5,6],[-2,11],[0,12],[2,12],[-5,-4],[-5,-11],[-6,-7],[-5,4],[0,13],[3,18],[7,29],[1,-13],[3,-6],[4,-1],[4,6],[2,10],[1,25],[2,11],[2,-14],[2,4],[2,11],[2,8],[3,2],[5,-2],[3,0],[2,3],[2,3],[1,8],[0,26],[-4,16],[-8,7],[-8,2],[-5,4],[-1,9],[1,22],[-5,47],[-5,18],[-1,8],[-2,4],[-10,-2],[-4,0],[-5,9],[-9,27],[-4,6],[-11,0],[-23,-9],[-13,4],[-28,0],[-6,3],[-4,5],[-9,18],[-4,4],[-16,4],[-4,-1],[-3,-6],[-1,-7],[0,-17],[-1,-7],[-11,-27],[-4,-7],[-23,-16],[-7,-1],[-8,12],[-3,-2],[-2,-5],[0,-9],[2,-2],[7,-5],[2,-2],[1,-5],[2,-6],[1,-8],[1,-7],[-2,-2],[-31,4],[-6,5],[-2,3],[-2,3],[-1,5],[0,10],[-1,-1],[-3,4],[-8,16],[-3,3],[-1,4],[-1,8],[2,5],[2,5],[2,6],[-1,7],[-5,3],[-4,-12],[-5,-25],[-5,-4],[-7,1],[-8,4],[-6,5],[8,20],[2,4],[-5,3],[-6,-5],[-11,-13],[-5,1],[-5,4],[-5,7],[-4,10],[-9,14],[-4,11],[5,29],[0,14],[-4,10],[-6,2],[-4,-7],[-3,-14],[-1,-14],[-2,-13],[-5,-1],[-5,12],[-6,24],[-5,8],[-6,6],[-16,5],[-14,10],[-31,13],[-10,12],[-6,-3],[-11,-15],[-10,-9],[-32,-14],[-5,-5],[-7,-18],[-4,-5],[-4,3],[-5,9],[-3,3],[-3,-3],[-1,-4],[0,-5],[1,-3],[-2,-6],[-19,-63],[-5,-6],[-2,11],[1,8],[5,13],[1,9],[-2,5],[-3,-4],[-9,-18],[-6,-7],[-6,-3],[-5,4],[-4,1],[-1,-13],[-1,-32],[-2,-11],[-4,-10],[-4,-5],[-4,3],[5,12],[2,11],[0,7],[-6,3],[-8,-6],[-2,-2],[-3,-5],[-2,1],[-2,5],[-8,13],[-2,2],[-2,1],[-2,0],[-1,-3],[-2,-6],[-8,-44],[-4,-8],[1,9],[1,24],[-4,-6],[-1,-7],[-2,-9],[-2,-6],[-1,-2],[-5,-1],[-2,-2],[-2,-3],[-1,-2],[-10,-38],[-5,-11],[-5,2],[0,6],[2,8],[1,8],[-3,3],[-3,-2],[-8,-9],[-21,-44],[-7,-23],[-5,-10],[-4,-4],[-10,2],[-3,-2],[-2,-4],[-4,-10],[-2,-5],[-9,-7],[-3,-10],[-3,0],[-7,3],[-4,-6],[0,-12],[-2,-9],[-6,5],[-3,10],[-2,3],[-2,-2],[0,-15],[-1,-7],[-3,3],[-5,13],[-3,4],[-3,0],[0,-6],[1,-17],[-1,-5],[-16,39],[-3,4],[-1,-13],[2,-30],[-5,5],[-2,-4],[-2,-8],[-3,-7],[-2,16],[-3,8],[-15,13],[-4,5],[-3,9],[0,14],[0,-22],[1,-11],[3,-8],[3,-17],[2,-7],[-3,1],[-4,3],[-3,1],[-2,2],[0,6],[1,6],[0,4],[0,3],[-5,9],[-3,3],[-1,-3],[0,-5],[-1,-2],[-7,3],[-9,6],[-8,10],[-4,13],[2,-17],[16,-35],[4,-22],[-5,4],[-9,1],[-1,0],[-4,8],[-2,10],[-3,8],[-5,1],[0,-4],[4,-8],[1,-14],[2,-14],[6,-6],[9,-18],[1,-6],[1,-7],[-1,-8],[-1,-7],[-10,15],[-5,9],[-3,9],[-4,11],[-2,7],[-4,3],[-7,1],[3,-4],[2,-4],[1,-6],[1,-11],[1,-6],[9,-19],[-1,-1],[-3,-4],[-3,5],[-19,12],[-3,0],[-1,-3],[0,-7],[2,-4],[3,-2],[2,-1],[4,-6],[2,-12],[0,-13],[1,-6],[0,-4],[-48,52],[-17,27],[-11,20],[-5,5],[-7,0],[-6,-2],[-6,0],[-15,23],[-6,14],[-7,11],[-10,5],[-22,0],[-8,7],[5,16],[-4,5],[-1,9],[0,10],[-3,7],[-9,10],[-4,4],[-5,1],[6,16],[6,33],[13,19],[15,6],[14,-8],[5,-9],[4,-11],[7,-26],[6,-5],[37,13],[8,12],[14,33],[-76,224],[-37,180],[-2,17],[-3,11],[-4,5],[-9,2],[-8,6],[-7,11],[-12,32],[-46,148],[-15,24],[-17,14],[-96,-3],[-53,47],[-5,1],[-5,-7],[-1,-10],[0,-40],[-2,-31],[-2,-14],[-3,-1],[-46,59],[-8,14],[-4,11],[-1,8],[1,8],[4,12],[1,4],[2,2],[1,3],[1,6],[-1,4],[-8,25],[-18,40],[-1,8],[3,5],[19,22],[10,17],[4,13],[-5,9],[-13,2],[-4,9],[0,12],[2,12],[1,12],[-2,13],[-1,4],[-6,11],[-1,6],[2,5],[2,3],[2,4],[3,13]],[[155,5156],[440,-123],[128,-82],[6,51],[111,19],[200,256],[18,9],[12,20],[13,11],[11,1],[24,58],[27,41],[25,4],[27,18],[95,-21],[18,-11],[3,-21],[-7,-53],[38,-27],[20,-8],[21,-1],[10,21],[85,-52],[16,14],[0,30],[8,79],[36,104],[-1,80],[36,84],[14,-8],[87,1],[27,13],[8,9],[-4,20],[7,16],[47,83]],[[155,5156],[0,6],[-3,10],[-5,6],[-24,13],[-62,39],[-61,39],[0,1],[35,174],[32,165],[6,14],[9,12],[18,18],[6,9],[5,7],[12,29],[10,34],[5,36],[-3,34],[-12,29],[-37,50],[-13,9],[15,165],[15,164],[6,27],[9,16],[53,42],[17,31],[15,35],[5,19],[0,24],[-13,33],[-2,19],[2,9],[9,15],[3,11],[-2,10],[-3,7],[-2,8],[3,13],[4,7],[17,12],[3,8],[7,28],[1,5],[8,19],[10,17],[11,10],[10,1],[7,-8],[16,-37],[11,-11],[3,-7],[3,-9],[1,-6],[3,-5],[5,-4],[3,-3],[11,-23],[5,-13],[9,-15],[10,-26],[10,-16],[2,-8],[1,-9],[2,-10],[3,-7],[12,-17],[5,-18],[2,-19],[2,-19],[3,-20],[2,-6],[2,-14],[2,-6],[3,-5],[10,-15],[4,-16],[2,-14],[3,-10],[9,-1],[7,2],[2,-2],[12,-20],[14,-15],[3,-1],[3,3],[6,14],[3,5],[50,35],[25,26],[19,40],[4,11],[1,7],[0,7],[-2,27],[-3,11],[-3,7],[-17,10],[0,17],[2,24],[-5,26],[-10,36],[-7,47],[-6,97],[1,47],[-2,21],[-6,15],[-12,4],[-6,6],[-1,13],[3,9],[7,-1],[32,-34],[11,-5],[11,4],[44,59],[22,50],[11,16],[34,15],[21,15],[9,15],[4,23],[-4,21],[-9,17],[-6,17],[3,19],[6,18],[2,10],[2,22],[3,13],[3,11],[3,7],[6,2],[19,-10],[59,1],[4,5],[12,28],[35,53],[10,9],[44,15],[29,25],[4,7],[2,6],[-1,9],[-2,12],[0,13],[2,6],[4,4],[3,6],[-1,3],[-2,4],[-1,4],[2,4],[3,2],[15,1],[4,2],[3,7],[2,12],[6,1],[4,3],[2,7],[1,15],[-2,39],[1,10],[4,8],[5,2],[3,5],[1,17],[1,15],[4,-1],[10,-12],[11,0],[2,-3],[-5,-12],[-4,-12],[3,-6],[7,-1],[5,1],[11,8],[7,12],[1,20],[-12,55],[-1,23],[6,11],[13,-4],[5,-5],[4,-7],[4,-9],[3,-11],[4,-12],[6,-5],[59,-7],[5,3],[6,5],[5,3],[5,-5],[6,-18],[3,-6],[4,-4],[11,-1],[5,-4],[2,-13],[0,-16],[-2,-10],[-3,-7],[-5,-4],[-24,-8],[-1,-5],[3,-10],[4,-11],[2,-8],[7,-14],[19,-3],[20,5],[13,12],[4,10],[3,11],[4,7],[6,0],[6,-5],[3,-6],[0,-9],[1,-16],[5,-20],[12,2],[12,13],[9,13],[1,25],[-4,22],[-1,21],[14,26],[7,20],[5,7],[6,5],[7,-1],[7,-5],[6,-7],[7,-4],[7,-2],[8,1],[6,4],[5,7],[5,22],[4,9],[6,6],[14,-1],[7,1],[5,7],[3,21],[4,6],[7,-8],[4,-22],[3,-27],[3,-20],[17,-54],[6,-44],[2,-7],[3,-8],[4,-10],[4,-7],[5,-6],[2,-1],[6,7],[21,-3],[1,-5],[3,2],[3,6],[2,6],[2,4],[3,2],[6,1],[2,2],[1,5],[2,5],[4,2],[2,-2],[5,-10],[3,-2],[13,2],[5,-3],[-3,-12],[5,-2],[6,-6],[4,-2],[4,2],[3,5],[3,6],[3,5],[10,7],[29,-2],[-2,12],[1,5],[3,2],[4,-1],[2,-1],[1,-3],[1,-4],[2,-3],[2,-2],[2,1],[1,2],[1,1],[19,-4],[3,1],[6,5],[5,-7],[1,1],[9,-7],[3,-6],[5,-16],[4,-6],[24,-18],[11,-13],[3,-5],[2,-11],[-2,-6],[-9,-7],[5,-10],[0,-11],[-1,-11],[1,-11],[8,-15],[4,-8],[1,-12],[6,-12],[45,-24],[13,4],[7,-3],[9,-13],[5,-9],[6,-23],[5,-6],[13,-3],[5,-6],[2,-10],[2,-26],[2,-10],[2,-6],[1,-6],[-1,-12],[8,-17],[4,-6],[9,-10],[4,-8],[3,-10],[4,-8],[6,-7],[20,-6],[2,-3],[5,-8],[2,-3],[11,-5],[3,-3],[2,-5],[1,-7],[-1,-6],[-2,-7],[-13,-32],[-2,-13],[-1,-30],[-1,-13],[-5,-31],[-2,-13],[1,-13],[4,-15],[9,-21],[5,-8],[5,-6],[6,-2],[11,5]],[[6729,8069],[8,-14],[7,-53],[6,-379],[-12,-21],[-25,-32],[-17,-71],[1,-66],[30,9],[17,-1],[6,-24],[28,-17],[26,-25],[-20,-22],[-23,-8],[-36,-26],[-24,-30],[-6,-34],[-11,-35],[-17,-34]],[[6667,7186],[-46,11],[-44,-14],[-13,4],[-6,-23],[4,-17],[14,-35],[6,-27],[-1,-14],[14,10],[13,27],[23,-14],[11,-15],[-13,-28],[-25,-34],[-42,-24],[-15,-14],[5,-22],[-22,-23],[-13,-9],[-7,-17],[-42,17],[-19,-41],[-1,-22],[-10,-28],[-21,-10],[-9,-1],[-11,-13],[-16,-15],[-2,-17],[1,-8],[-7,-13],[1,-26],[10,-11],[-14,-24],[-30,22],[-9,-21],[-12,-7],[-4,-71],[-65,11],[-27,-10],[-10,-12],[-1,26],[8,19],[4,32],[3,46],[-6,9],[12,38],[-27,45],[-11,-1],[-7,17],[-13,-2],[-7,13],[-9,2],[-3,-16],[-27,-22],[-24,-71],[-13,-12],[-10,-14],[-27,-12],[-7,-12],[2,-20],[-11,-17],[-24,-24],[-14,-3],[-10,-10],[-11,-68],[-3,-65],[-8,17],[-13,18],[-33,-23],[-14,-109],[-80,-58],[-10,53],[19,56],[-13,23],[-6,26],[-17,2],[-61,-30],[-24,-5],[-20,10],[3,38],[-9,6],[-17,42],[-17,-7],[-3,24],[-18,-6],[-12,-44],[-14,-42],[-13,0],[-7,12],[4,-40],[-14,-17],[-28,-14],[-83,48],[14,62],[12,79],[5,58],[5,30],[6,42],[1,74],[-53,36],[-27,-16],[-25,-24],[-44,-53],[-87,-1],[10,-26],[6,-47]],[[4792,7957],[45,-22],[18,-49],[24,14],[57,3],[12,-48],[30,-2],[82,-26],[24,10],[51,8],[3,99],[26,9],[31,-16],[57,-60],[23,-13],[5,20],[0,18],[19,9],[25,49],[-18,40],[-1,31],[15,3],[50,42],[11,-1],[8,23],[8,13],[3,17],[9,27],[22,18],[17,27],[29,24],[-2,7],[-7,103],[19,28],[7,73],[-13,38],[-11,50],[-26,19],[-17,32],[-16,56],[18,17],[5,14],[8,16],[16,9],[-6,8],[-4,25],[27,8],[14,7],[-4,12],[-6,34],[11,0],[7,7],[17,7],[8,-4],[1,-12],[20,-3],[15,16],[12,19],[24,-34],[9,-20],[9,-9],[8,-51],[15,2],[2,24],[-12,19],[3,17],[8,21],[40,41],[42,3],[15,-16],[8,-20],[9,-55],[1,-45],[8,10],[13,-5],[26,0],[9,-10],[-3,-25],[-10,-24],[-8,-29],[15,-2],[32,4],[24,-29],[15,-41],[17,-15],[6,45],[18,13],[10,47],[33,9],[62,3],[7,-12],[2,-8],[0,-37],[30,-13],[8,-10],[15,-3],[12,7],[60,53],[17,-48],[25,-45],[11,-30],[-8,-23],[-2,-67],[-13,-35],[14,-46],[33,-20],[77,-4],[50,58],[20,8],[26,-8],[30,15],[13,2],[8,16],[14,-32],[1,-35],[10,-40],[5,-82],[25,-4],[101,-59],[44,-58],[76,-9]],[[6118,6996],[14,12],[12,30],[6,40],[2,43],[-7,31],[-8,8],[-11,28],[-19,27],[-12,4],[-15,-12],[-8,-14],[-7,-21],[-2,-27],[1,-27],[9,-27],[13,-25],[11,-26],[10,-31],[11,-13]],[[6667,7186],[79,-53],[6,-29],[6,-35],[2,-31],[-6,-35],[-9,-124],[-11,-10],[3,-50],[-6,-46],[26,-44],[59,13],[19,10],[13,18],[7,-15],[16,-7],[28,-22],[-3,-54],[17,-32],[22,35],[26,-43],[9,-2],[12,-28],[9,-29],[-6,-12],[16,-39],[21,-29],[-27,-35],[-25,-21],[-5,-18],[-10,-20],[15,-44],[22,-13],[57,62],[25,37],[69,0],[14,31],[20,-11],[93,30],[30,-23],[17,52],[11,2],[15,14],[27,4],[30,-20],[5,78],[9,71],[53,99],[34,-4],[21,-39],[49,-29],[53,-46],[12,-49],[-3,-66],[3,-40],[15,-19]],[[7651,6476],[-15,-52],[-54,-94],[-29,-24],[-21,-11],[-13,-23],[-2,-16],[2,-23],[1,-28],[0,-34],[-7,-70],[-48,-67],[-50,-37],[-34,-93],[15,-47],[28,-28],[24,-46],[1,-28],[34,-53],[-16,-30],[-23,-17],[0,-81],[21,-39],[54,12],[41,-4],[3,-69],[-5,-35],[-1,-33],[-22,-46],[-32,-37],[-26,-3],[-8,-23],[-4,-30],[-11,-16],[6,-22],[19,-20],[6,-27],[25,-3],[22,-18],[-24,-18],[6,-50],[29,-32],[29,-20],[-34,-35],[-9,-58],[-17,-49],[-23,-158],[7,-15],[5,-34],[10,-84],[-44,-23],[1,-26],[-5,-36],[-10,-28],[-12,-11],[14,-15],[31,-64],[50,-25],[13,50],[65,7]],[[7614,4437],[7,-241],[-2,-95],[-22,-18],[-5,-6],[-7,2],[-18,-13],[-20,-4],[-6,-4],[-5,-7],[-3,-10],[-2,-10],[-4,-9],[-16,-8],[-3,1],[-3,4],[-1,4],[1,5],[0,5],[-9,24],[-9,17],[-11,8],[-12,-3],[-6,-4],[-3,-1],[-3,1],[-2,3],[-12,27],[-5,6],[-4,-4],[2,-21],[8,-24],[11,-21],[6,-17],[-7,5],[-14,16],[-23,17],[-6,10],[-4,12],[3,4],[1,6],[-1,7],[-1,6],[-5,-9],[-5,-3],[-5,0],[-13,6],[-3,0],[-12,-10],[-2,-3],[-2,-4],[-1,-3],[-1,-4],[0,-10],[-1,-7],[-2,1],[-5,9],[-20,23],[-2,-13],[-3,2],[-2,5],[-13,-3],[-41,21],[-65,6],[-63,-14],[-57,7],[-157,-189],[-142,-298]],[[6782,3617],[-1227,-13]],[[5555,3604],[-464,14]],[[6603,8662],[0,-2],[31,-103],[-16,-5],[-15,-18],[-1,-51],[10,-37],[16,23],[14,28],[11,12],[6,-10],[8,4],[14,-14],[-17,-41],[-10,-44],[-21,-64],[-8,-20],[23,18],[12,-9],[-6,-27],[-4,-58],[30,-12],[18,57],[28,12],[19,-39],[-7,-51],[-8,-20],[-5,-32],[-10,-42],[-8,24],[-26,27],[-8,3],[6,-56],[33,-18],[17,-28]],[[4803,9462],[85,50],[16,4],[31,-2],[15,3],[6,6],[9,16],[5,5],[48,3],[8,3],[14,13],[8,3],[18,0],[10,4],[6,10],[5,17],[6,11],[7,4],[16,-7],[16,5],[44,-2],[19,9],[14,21],[10,26],[5,10],[7,8],[9,5],[7,-1],[24,-18],[38,9],[4,7],[2,17],[6,4],[2,7],[1,8],[2,12],[5,5],[6,1],[6,4],[1,13],[-20,20],[-9,16],[4,19],[-5,9],[-2,2],[15,14],[6,2],[3,-2],[3,-4],[4,-2],[5,0],[13,9],[6,0],[18,-8],[17,9],[5,0],[7,-2],[3,1],[2,7],[1,6],[-1,13],[0,6],[4,8],[11,12],[2,11],[-1,14],[1,12],[1,11],[3,11],[5,-5],[3,-1],[22,-5],[6,-5],[5,-7],[9,-24],[4,-10],[6,-4],[6,6],[3,9],[0,11],[-1,26],[-6,6],[-5,3],[-4,7],[-3,23],[-1,5],[0,5],[3,5],[4,4],[3,1],[44,-25],[7,-13],[4,-21],[5,-14],[10,5],[20,32],[6,3],[35,-24],[48,-11],[32,-28],[7,-10],[20,-44],[7,-8],[19,-3],[9,-6],[34,-36],[4,-1],[5,7],[8,21],[5,7],[21,11],[3,4],[0,5],[1,6],[0,5],[3,11],[10,25],[5,3],[2,-1],[17,-11],[6,0],[5,2],[6,5],[4,8],[10,12],[14,2],[13,-4],[11,-9],[-4,-8],[-4,-11],[-1,-11],[2,-11],[17,-35],[24,-51],[4,-18],[1,-8],[-1,-9],[0,-1],[0,-2],[0,-2],[-1,-18],[-1,-9],[-1,-9],[-2,-12],[5,-18],[-2,-8],[-3,-8],[-2,-12],[0,-12],[1,-10],[9,-17],[2,-9],[-1,-18],[3,-23],[10,-17],[13,-10],[9,-4],[11,0],[5,-2],[4,-7],[9,-21],[3,-14],[0,-16],[-3,-9],[-6,-5],[-12,-6],[-8,-12],[-1,-18],[1,-48],[0,-5],[-1,-3],[1,-3],[5,-9],[1,-8],[-1,-23],[0,-4],[2,-2],[4,-3],[1,-3],[0,-5],[0,-12],[0,-9],[-1,-29],[-14,-4],[-5,0],[-4,3],[-9,8],[-5,3],[-9,0],[-6,-5],[-2,-14],[1,-23],[15,-2],[4,-3],[1,-11],[0,-16],[-1,-15],[-2,-10],[9,-8],[4,-6],[4,-10],[7,-24],[4,-8],[6,-1],[8,10],[7,13],[12,36],[6,8],[8,-2],[7,-6],[8,-3],[8,1],[2,-3],[2,-6],[2,-9],[2,-33],[5,1],[12,11],[6,1],[3,-2],[5,-8],[2,-3],[5,-2],[3,1],[9,7],[6,9],[3,10],[-2,29],[1,14],[3,12],[3,9],[6,4],[47,-8],[7,-3],[4,-4],[4,-7],[15,-45],[5,-11],[7,-4],[7,2],[5,5],[3,10],[0,19],[-5,12],[-6,4],[-8,2],[-6,5],[-5,6],[0,4],[0,8],[0,7],[1,8],[2,7],[5,18],[1,8],[-2,6],[-6,8],[-8,9],[-3,6],[0,11],[4,5],[27,-7],[8,-8],[9,-16],[8,-20],[3,-20],[3,-7],[11,-6],[3,-12],[-1,-8],[-8,-31],[22,-14],[23,-15],[0,-2],[0,-3],[-2,-3],[-2,-9],[-3,-2],[-4,1],[-4,0],[-1,-2],[-1,-8],[-1,-3],[-3,0],[-7,5],[-3,-2],[0,-8],[1,-9],[1,-6],[4,-11],[6,-8],[3,-10],[-2,-16],[-6,-24],[-3,-14],[0,-11],[5,-8],[7,-3],[8,1],[5,6],[11,20],[6,18],[3,5],[4,-1],[25,-17],[6,5],[-1,23],[-5,20],[-5,14],[-6,7],[-8,1],[-22,-8],[-1,5],[1,12],[3,13],[2,8],[11,20],[13,4],[32,-6],[32,-6],[13,3],[4,-3],[3,-9],[1,-12],[1,-26],[11,-9],[3,-9],[2,-19],[5,-9],[31,-12],[42,-15],[3,1],[1,6],[1,7],[1,7],[2,3],[7,-1],[3,-2],[3,-4],[5,-11],[3,-2],[6,3],[3,4],[1,9],[0,16],[2,12],[14,6],[4,10],[0,9],[-3,7],[0,6],[3,3],[13,5],[4,-2],[0,-2],[1,-14],[2,-2],[14,6],[-11,-106],[-3,-18],[-5,-9],[-7,-2],[-37,12],[-7,-1],[-6,-6],[-5,-10],[-5,-15],[12,-13],[-22,-14],[-4,-8],[-6,-61],[-11,-3],[-5,-4],[-3,-8],[-3,-13],[2,-9],[8,-16],[-7,-23],[39,-35],[-10,-41],[15,-20],[3,2],[7,11]],[[8036,7475],[-5,-1],[-8,-55],[-35,-27],[0,-17],[-5,-32],[-12,-20],[-13,-16],[-8,8],[-34,-7],[-10,-40],[11,-7],[-3,-28],[-12,-20],[-65,-60],[-15,-5],[-6,16],[-11,-6],[-6,-21],[-27,-29],[-9,1],[-13,-20],[-2,-7],[-4,-7],[-1,-1],[1,-12],[4,-8],[3,-9],[-2,-13],[6,-7],[6,-2],[5,-8],[2,-22],[1,-4],[1,-4],[2,-2],[2,-1],[2,-1],[0,-2],[0,-3],[0,-4],[7,-26],[3,-9],[3,-4],[8,-1],[4,-4],[2,-6],[2,-3],[16,-35],[64,-72],[9,-91],[-2,-69],[12,-13],[13,-63],[-13,-61],[-23,-70],[-49,-87],[-76,35],[-53,39],[-31,48],[-21,-4]],[[6603,8662],[18,29],[5,10],[2,5],[2,8],[3,11],[1,7],[1,4],[5,3],[1,0],[6,-2],[2,2],[1,5],[0,6],[2,10],[0,6],[0,4],[2,2],[19,-2],[4,-2],[8,-8],[4,3],[17,22],[8,5],[8,0],[10,-3],[16,-3],[4,-4],[1,-10],[-1,-13],[1,-11],[3,-5],[8,-1],[2,3],[5,17],[3,2],[16,0],[2,-2],[3,-8],[1,-10],[3,-7],[5,-3],[-2,-15],[1,-10],[9,-16],[13,-17],[7,-3],[5,10],[12,62],[0,6],[-3,5],[-4,7],[-2,5],[3,34],[2,13],[3,8],[40,-3],[3,5],[4,31],[3,10],[2,4],[2,2],[13,1],[2,4],[2,10],[3,19],[2,10],[2,5],[9,5],[20,-1],[9,-4],[18,-16],[7,1],[32,38],[29,36],[38,46],[-18,49],[17,21],[9,7],[8,1],[26,-5],[9,3],[12,9],[15,12],[28,21],[43,34],[35,26],[-3,16],[-1,11],[2,11],[4,12],[6,11],[4,4],[49,-21],[11,5],[15,18],[5,4],[4,0],[8,-1],[3,1],[5,7],[1,12],[0,13],[1,12],[6,10],[7,3],[13,-3],[6,2],[18,15],[4,2],[6,-1],[4,-6],[-2,-15],[-4,-6],[-20,-9],[-4,-5],[-6,-8],[-3,-9],[3,-8],[13,-6],[4,-7],[2,-16],[-1,-17],[-4,-13],[-5,-11],[-5,-13],[-3,-19],[-1,-7],[-3,-6],[-6,-10],[-3,-6],[-12,-25],[-15,1],[-31,20],[-16,1],[-5,-3],[-4,-5],[0,-4],[25,-72],[1,-8],[3,-25],[8,-21],[20,-27],[31,-40],[45,-59],[45,-60],[46,-59],[45,-60],[34,-44],[29,-55],[13,-23],[20,-37],[27,-70],[16,-48],[27,-77],[26,-78],[27,-77],[26,-77],[35,-109],[34,-108],[35,-109],[35,-109],[26,-84],[26,-84],[12,-38]],[[8768,3346],[-5,-4],[-37,27],[4,68],[-14,79],[-24,65],[-17,108],[-66,167],[-10,53],[-47,40],[-1,17],[-9,13],[-27,-2],[-7,17],[-16,16],[-28,2],[-67,33],[-105,97],[-19,23],[-1,30],[-61,44],[-129,-12],[-45,114],[-65,22],[-23,-5],[-35,8],[-17,45],[-24,7],[-19,32],[-70,75],[-41,-61],[-15,31],[-24,-19],[-24,-35],[-48,15],[-18,-19]],[[8036,7475],[14,-46],[26,-84],[22,-81],[22,-81],[22,-81],[22,-81],[11,-41],[13,-49],[7,-35],[3,-11],[6,-15],[7,-14],[9,-9],[7,-1],[-13,38],[-4,21],[8,9],[5,-4],[8,-17],[4,-5],[6,2],[3,7],[3,22],[4,10],[3,5],[10,7],[2,4],[3,8],[3,3],[3,1],[10,-2],[9,4],[11,9],[9,17],[5,23],[1,10],[0,12],[0,12],[-1,11],[-2,10],[-7,12],[-3,9],[-1,8],[0,12],[1,22],[2,13],[3,9],[5,5],[6,1],[21,-5],[9,4],[3,18],[0,10],[2,10],[3,9],[3,8],[5,7],[4,1],[33,-27],[6,-3],[3,5],[3,8],[4,6],[6,-1],[2,-9],[0,-23],[2,-13],[3,-7],[10,-10],[11,-10],[6,-2],[6,-1],[7,13],[4,3],[4,-1],[5,-5],[2,-9],[-1,-11],[-2,-14],[-16,-71],[-7,-41],[0,-10],[1,-6],[5,-4],[6,-3],[14,1],[29,17],[30,-2],[0,-25],[4,-22],[6,-20],[6,-18],[-5,-14],[-5,-17],[-2,-17],[3,-15],[8,-7],[52,4],[6,6],[7,20],[4,7],[5,0],[9,-11],[5,-2],[18,6],[12,-3],[11,-7],[6,-6],[15,-23],[5,-5],[13,-5],[6,1],[6,4],[5,7],[5,10],[4,8],[5,-2],[3,-4],[3,3],[4,4],[3,3],[3,-1],[3,-3],[2,-3],[12,5],[5,-5],[11,-19],[32,38],[16,13],[7,15],[0,47],[7,13],[9,4],[19,-10],[33,-6],[11,6],[9,17],[7,24],[5,27],[2,1],[3,1],[2,-1],[7,-4],[4,-1],[4,1],[3,3],[28,7],[27,-7],[7,-19],[3,-7],[6,-6],[27,-9],[5,-5],[15,-22],[5,-6],[5,-2],[11,0],[5,-3],[5,-5],[5,-8],[7,-23],[4,-7],[9,-7],[7,-14],[0,-42],[6,-21],[28,-35],[3,-4],[8,-19],[2,-13],[1,-10],[1,-9],[9,-17],[2,-11],[1,-12],[-5,-37],[3,-21],[7,-20],[5,-22],[1,-16],[-1,-15],[0,-14],[3,-12],[2,-5],[8,-3],[3,-4],[2,-4],[3,-11],[1,-5],[10,-1],[9,13],[8,9],[9,-11],[7,-16],[7,-9],[9,-3],[9,1],[8,-2],[7,-10],[5,-13],[8,-9],[4,-1],[9,2],[4,-4],[3,-6],[6,-25],[3,-4],[4,3],[4,5],[4,3],[5,-1],[16,-14],[3,-5],[8,-23],[2,-8],[-1,-12],[-4,-4],[-10,-3],[-1,0],[0,-1],[-2,-1],[-1,-38],[1,-18],[5,-9],[14,-6],[6,-8],[3,-15],[2,-25],[1,-9],[4,-12],[16,-32],[5,-20],[3,-53],[7,-20],[10,-10],[9,6],[5,6],[5,6],[5,4],[5,1],[6,-4],[11,-14],[6,-4],[9,2],[4,2],[5,4],[7,12],[4,4],[5,-1],[3,-7],[3,-20],[4,-8],[4,-3],[4,1],[9,7],[5,0],[4,-4],[4,-7],[4,-10],[3,-3],[5,3],[8,11],[5,4],[4,0],[10,-3],[1,-6],[-3,-27],[0,-12],[4,-7],[4,-2],[4,3],[4,6],[8,16],[10,7],[10,-4],[6,-19],[10,-20],[9,22],[8,37],[7,22],[14,18],[15,10],[16,28],[4,3],[2,4],[0,6],[-1,8],[-1,7],[11,13],[1,2],[4,6],[2,2],[1,0],[2,0],[1,0],[5,12],[3,14],[3,10],[8,-1],[11,-11],[3,0],[8,3],[4,1],[3,-3],[0,-8],[-2,-8],[-2,-7],[-1,-7],[0,-8],[3,-7],[6,-12],[-5,-9],[-5,-6],[-5,-4],[-12,-1],[-5,-7],[-8,-23],[-4,-12],[-1,-10],[2,-9],[4,-11],[6,-7],[6,0],[11,5],[5,-3],[17,-19],[6,-9],[-1,-11],[-2,-13],[0,-16],[4,-11],[6,-8],[13,-11],[6,-10],[0,-6],[-4,-8],[-3,-12],[2,-9],[5,-9],[17,-24],[3,-6],[1,-5],[0,-9],[2,-7],[3,-4],[3,-3],[6,-1],[21,3],[7,-2],[7,-6],[13,-17],[4,-14],[5,-47],[4,-19],[-30,16],[-10,9],[-11,5],[-34,-25],[-7,1],[-15,8],[-7,-1],[-5,-7],[-5,-24],[-4,-11],[-10,-15],[-4,-8],[-4,-12],[-3,-14],[-1,-10],[0,-12],[2,-17],[6,-22],[7,-14],[4,-13],[-6,-21],[-4,-10],[-2,-6],[0,-8],[3,-29],[0,-9],[-2,-8],[-18,-47],[-12,-21],[-4,-9],[-3,-10],[-4,-23],[-3,-9],[-4,-7],[-29,-21],[-23,3],[-7,-5],[-5,-9],[-10,-21],[-13,-13],[-46,7],[-54,-15],[-9,-11],[-7,-21],[-32,-147],[-6,-74],[-4,-26],[-4,-17],[-3,-15],[-1,-17],[20,-199],[0,-22],[-4,-46],[1,-20],[4,-20],[17,-54],[2,-13],[-1,-13],[-2,-13],[1,-11],[2,-13],[0,-10],[-2,-22],[-1,-14],[-1,-10],[-3,-6],[-12,-2],[-5,-4],[-6,-7],[-2,-11],[-1,-13],[-1,-10],[-2,-9],[-3,-10],[-2,-12],[-1,-12],[-2,-8],[-16,0],[-32,-9],[-14,4],[-5,-2],[-5,-6],[-3,-7],[-6,-20],[-5,-10],[-17,-23],[-7,-16],[-3,-4],[-11,-4],[-4,-4],[-4,-8],[-5,-20],[-5,-7],[-19,-8],[-18,-14],[-7,-2],[-4,4],[-1,10],[2,10],[3,11],[3,11],[0,23],[-5,21],[-7,15],[-9,9],[-12,1],[-23,-11],[-11,4],[-13,12],[-4,1],[-4,-1],[-1,0],[-30,5],[-26,-5],[-16,-17],[-6,-2],[-17,6],[-23,0],[-93,63],[-42,52],[-10,9],[-22,9],[-5,6],[-13,21],[-6,4],[-6,2],[-7,-1],[-6,-3],[-6,-6],[-2,-7],[0,-27],[0,-8],[-3,-15],[-1,-7],[0,-7],[2,-13],[0,-7],[-4,-26],[-1,-13],[1,-13],[1,-12],[0,-11],[-2,-11],[-36,-141],[-22,-161],[-10,-40],[-2,-12],[-3,-37],[-3,-21],[-16,-51],[-10,-39],[-7,-44],[-6,-93],[-7,-62],[-3,-19],[-7,-32],[-18,-62],[-9,-66],[-8,-36],[-2,-19]],[[8768,3346],[-1,-14],[9,-27],[9,-8],[36,-10],[25,-21],[4,-13],[2,-25],[-1,-26],[-5,-62],[-7,-48],[-11,-36],[-16,-5],[-12,14],[-21,46],[-11,16],[-12,2],[-13,-6],[-47,-47],[-12,-6],[-10,9],[-5,11],[-4,5],[-16,5],[-4,5],[-1,9],[0,15],[-2,24],[-4,27],[-6,21],[-9,1],[-9,5],[-11,-9],[-19,-27],[-98,-60],[-20,-22],[-10,-7],[-11,-1],[-30,-23],[-6,0],[-20,12],[-12,0],[-39,-29],[-17,4],[-6,-2],[-5,-8],[-4,-24],[-4,-7],[-6,-2],[-19,2],[-17,-13],[-18,5],[-11,-1],[-10,-9],[-9,-18],[-24,-41],[-12,-11],[-5,-8],[-3,-20],[6,-16],[30,-38],[12,-2],[44,19],[6,-2],[5,-4],[12,-20],[40,-30],[4,-5],[1,-9],[-1,-9],[-4,-5],[-16,-8],[-9,-7],[-5,-13],[0,-7],[1,-6],[4,-12],[2,-8],[-1,-8],[-4,-15],[-6,-51],[-2,-27],[1,-24],[9,-99],[0,-27],[-6,-48],[-2,-26],[2,-12],[3,-9],[8,-16],[3,-11],[2,-12],[0,-12],[0,-14],[3,-14],[4,-16],[9,-26],[29,-152],[29,-152],[-1,-22],[-4,-21],[-12,-46],[3,-10],[10,-5],[9,-10],[3,-9],[2,-12],[1,-13],[0,-13],[1,-13],[6,-21],[1,-13],[-1,-14],[-4,-11],[-4,-6],[-6,-2],[-5,3],[-12,19],[-10,1],[-11,-10],[-19,-29],[-21,-19],[-11,-13],[-3,-19],[5,-17],[8,-14],[17,-17],[11,-3],[5,-6],[3,-12],[-2,-13],[-5,-7],[-12,-3],[-19,-14],[-4,-8],[-12,-10],[-4,-1],[-9,5],[-4,1],[-4,-5],[-5,-17],[-6,-41],[-4,-20],[-9,-27],[-2,-11],[-1,-15],[2,-10],[2,-11],[2,-26],[3,-10],[6,-20],[3,-11],[0,-9],[-1,-8],[-3,-13],[0,-8],[6,-54],[1,-11],[3,-9],[3,-10],[5,-49],[-2,-14],[-3,-8],[-9,-10],[-11,13],[-7,20],[-7,23],[-8,22],[-16,29],[-9,29],[-4,8],[-10,14],[-54,24],[-11,0],[-20,-7],[-23,3],[-12,10],[-7,19],[-11,54],[-8,16],[-19,19],[-9,18],[-4,12],[-2,13],[-2,14],[0,15],[2,26],[-2,7],[-6,4],[-10,-4],[-19,-20],[-9,1],[-10,7],[-16,2],[-20,17],[-29,6],[-4,4],[-9,15],[-10,12],[-24,17],[-16,3],[-11,-2],[-5,-3],[-9,-12],[-4,-3],[-5,0],[-10,8],[-5,1],[-12,-3],[-11,1],[-26,-5],[-11,4],[-14,17],[-5,4],[-6,1],[-5,-1],[-3,-2],[-4,-6],[-6,-5],[-3,4],[-1,4],[-1,4],[-2,4],[-17,8],[-16,1],[-5,-2],[-13,-12],[-4,0],[-4,6],[-5,7],[-4,5],[-10,0],[-7,4],[-4,1],[-4,-2],[-10,-10],[-8,-5],[-24,9],[-4,0],[-5,0],[-4,2],[-3,6],[-7,20],[-3,5],[-8,6],[-28,9],[-5,5],[-5,-2],[-9,-8],[-11,0],[-5,-2],[-5,-7],[-5,-12],[-2,-2],[-1,-1],[-5,2],[-2,-1],[0,-2],[0,-3],[-1,-3],[-10,-10],[-4,-2],[-11,1],[-10,-9],[-5,-2],[-6,2],[-13,11],[-6,1],[-5,-4],[-7,-14],[-5,-3],[-2,3],[-3,11],[-2,3],[-3,-1],[-5,-4],[-3,-1],[-21,13],[-22,0],[-18,9],[-6,0],[-16,-11],[-6,1],[-19,11],[-10,3],[-12,-2]],[[7180,1584],[-9,15],[-46,14],[17,25],[-21,36],[-28,24],[-21,35],[-8,25],[-3,16],[-2,22],[-4,31],[15,66],[17,49],[-21,23],[-22,0],[-7,21],[-10,-8],[-20,10],[-20,17],[62,212],[11,60],[2,75],[-19,49],[-24,47],[-42,48],[-54,15],[-36,67],[-13,70],[-5,93],[-94,170],[-10,44],[-5,58],[-23,11],[-24,1],[-21,64],[8,58],[60,7],[-5,32],[-5,37],[-5,111],[6,162],[31,121]],[[7434,1762],[15,2],[13,-8],[10,21],[7,43],[1,62],[-9,14],[-14,-8],[-9,-16],[-8,-23],[-8,-27],[-7,-13],[0,-32],[9,-15]],[[1024,2932],[4,-2],[4,3],[2,5],[1,4],[2,0],[1,-5],[1,-3],[1,-1],[2,-7],[1,-15],[-1,-8],[2,-7],[4,-10],[0,-4],[-5,2],[-3,-1],[-3,-4],[-4,-2],[-1,5],[2,7],[0,4],[-2,1],[-1,4],[1,7],[-2,9],[-11,14],[-4,12],[1,11],[2,0],[2,-10],[4,-9]],[[869,2926],[4,-4],[3,3],[0,-17],[1,-16],[3,-12],[6,-5],[2,-2],[3,-4],[2,-3],[4,-1],[8,13],[3,2],[-4,-21],[-7,-9],[-8,2],[-7,9],[-4,7],[-1,6],[-1,8],[-1,11],[-3,9],[-9,19],[-4,16],[0,14],[13,61],[3,5],[4,4],[11,6],[0,-12],[-15,-16],[-3,-16],[-1,-9],[-4,-17],[-1,-11],[1,-11],[2,-9]],[[947,3030],[2,-8],[-3,-14],[-1,-6],[-2,-3],[-1,-4],[2,-26],[-2,-14],[-5,-9],[-6,-3],[-4,6],[-2,15],[1,16],[2,16],[1,15],[1,10],[3,5],[3,1],[1,0],[1,0],[5,0],[2,2],[1,2],[1,-1]],[[1524,3246],[-7,-6],[-12,9],[-9,15],[-7,16],[-2,15],[3,10],[4,6],[3,5],[1,5],[-1,5],[2,2],[8,-1],[5,-3],[4,-12],[4,-19],[1,-10],[2,-13],[1,-10],[0,-14]],[[2504,3082],[-18,-11],[-23,-14],[-23,-15],[-23,-14],[-23,-15],[-22,-14],[-23,-14],[-23,-15],[-1,0],[0,-1],[0,-1],[0,-154],[0,-155],[0,-154],[0,-155],[0,-154],[0,-155],[0,-154],[0,-155],[0,-154],[0,-155],[0,-154],[0,-155],[1,-154],[0,-155],[0,-154],[0,-155],[-17,4],[-8,-2],[-22,-22],[-23,-7],[-14,-11],[-31,-4],[-8,5],[-7,8],[-5,8],[-4,12],[-7,34],[-3,12],[-4,9],[-15,21],[-8,16],[-8,19],[-15,57],[-16,58],[-11,31],[-26,71],[-3,12],[-1,14],[1,15],[1,11],[0,12],[-3,13],[-6,15],[-41,78],[-29,40],[-25,34],[-41,56],[-38,52],[-18,13],[-18,6],[-59,-22],[-37,-14],[-43,-16],[-17,-7],[-54,-44],[-13,-17],[-39,-28],[-52,-89],[-33,-67],[-37,-77],[-10,-21],[-1,13],[2,15],[10,49],[2,26],[-2,27],[-2,14],[-3,11],[-3,5],[-2,4],[-2,5],[-1,9],[2,23],[0,7],[-2,6],[-7,17],[3,10],[2,12],[2,14],[0,12],[2,11],[3,5],[4,4],[4,6],[12,47],[14,37],[1,6],[1,6],[1,8],[0,14],[0,8],[1,5],[7,15],[2,6],[1,6],[0,11],[1,6],[4,27],[2,25],[0,24],[-3,26],[-6,28],[-5,16],[-10,13],[-3,15],[0,15],[2,5],[2,-7],[2,-14],[3,-14],[4,-6],[2,-2],[9,-12],[1,-5],[1,-5],[0,-4],[1,0],[4,-25],[2,-12],[3,-5],[2,6],[3,13],[2,17],[1,13],[-2,29],[-6,20],[-9,11],[-11,2],[-1,17],[-13,16],[-25,18],[-24,5],[-4,-1],[-3,-2],[-3,-2],[-3,-5],[-1,-4],[-3,-11],[-1,-3],[-6,5],[-17,45],[-9,14],[-6,1],[-21,-6],[-16,-13],[-9,-13],[-6,-4],[-5,5],[-14,35],[-3,10],[-6,22],[-4,12],[-2,10],[-3,25],[-2,13],[-12,27],[-3,14],[-3,2],[-4,1],[-2,3],[-1,8],[1,6],[1,5],[1,8],[-1,13],[-3,13],[-4,8],[-9,-9],[-12,1],[-6,-3],[-2,-4],[-1,-4],[-2,-4],[-3,-2],[-3,2],[-5,7],[-3,1],[-23,-10],[-23,0],[-3,7],[1,16],[9,54],[3,29],[1,88],[-1,14],[-8,31],[-1,6],[0,6],[-1,16],[0,5],[-4,10],[-10,14],[-2,11],[0,10],[-2,1],[-3,-2],[-3,-2],[-3,2],[-2,1],[-3,6],[-7,18],[-22,95],[-2,12],[-1,11],[-1,7],[-2,6],[-1,4],[-1,4],[0,7],[0,14],[0,7],[-2,7],[-8,13],[-1,6],[-2,13],[-4,11],[-3,13],[-2,6],[-3,3],[-5,3],[-2,4],[-2,9],[0,6],[1,6],[1,8],[-1,57],[-1,13],[-1,11],[-7,17],[-10,15],[-20,19],[-87,31],[-11,10],[-5,7],[-5,10],[-5,12],[-2,15],[2,30],[0,15],[-2,13],[2,5],[-2,12],[-1,22],[0,22],[3,13],[4,-20],[4,9],[2,19],[1,10],[3,3],[0,9],[0,9],[1,7],[3,5],[2,-2],[3,-4],[2,-4],[39,-15],[12,1],[11,8],[6,0],[3,-10],[3,-2],[22,0],[4,-8],[2,-3],[3,4],[2,7],[1,5],[1,3],[3,1],[13,-1],[6,-3],[5,-5],[9,-16],[7,-19],[3,-3],[6,2],[2,-1],[2,-6],[-1,-4],[-2,-3],[-2,-1],[4,-11],[6,-9],[20,-18],[7,-3],[7,1],[8,3],[5,6],[13,26],[1,2],[0,2],[1,3],[1,3],[2,0],[6,0],[4,1],[7,4],[3,0],[-2,-22],[7,-4],[17,7],[17,-15],[5,1],[3,8],[-1,10],[-3,8],[-4,7],[-15,15],[-10,18],[-5,2],[-12,-8],[-12,-3],[-7,12],[-8,51],[-6,20],[-8,15],[-19,25],[-3,5],[-2,4],[-2,3],[-8,3],[-3,2],[-1,4],[-3,5],[-15,20],[-2,11],[-1,16],[1,13],[4,6],[2,2],[1,6],[0,6],[0,5],[-3,3],[-3,1],[-3,2],[-1,8],[2,10],[6,7],[6,4],[5,2],[6,-2],[3,1],[3,5],[2,5],[3,9],[2,5],[11,14],[6,6],[5,2],[4,-5],[5,-12],[4,-9],[6,-1],[2,8],[-2,13],[-3,14],[-3,9],[-1,7],[1,8],[1,8],[1,7],[0,4],[-2,11],[-1,3],[1,9],[3,12],[8,22],[1,10],[3,11],[21,51],[2,11],[1,15],[2,13],[3,-6],[7,-23],[9,-9],[12,1],[12,6],[9,11],[7,16],[2,3],[6,0],[2,2],[4,12],[3,13],[3,12],[5,7],[3,-6],[2,-10],[2,-10],[1,-9],[21,-7],[4,-3],[6,-13],[5,-3],[4,3],[8,13],[5,3],[5,-1],[10,-7],[6,-1],[75,19],[11,-6],[18,5],[11,-5],[42,-36],[24,-7],[12,-13],[6,-3],[23,5],[7,-3],[13,-10],[6,-1],[5,3],[10,12],[6,3],[2,1],[3,7],[1,1],[6,-3],[1,-1],[1,2],[2,4],[2,5],[0,7],[-5,6],[-25,10],[-3,3],[-1,5],[-2,4],[-2,3],[-7,1],[-12,7],[-31,30],[-6,3],[-2,2],[-4,12],[-2,4],[-2,2],[-9,2],[-12,11],[-5,6],[2,8],[-2,6],[-1,5],[1,6],[2,7],[0,5],[-1,5],[-1,6],[1,16],[1,12],[3,8],[5,3],[4,5],[3,12],[4,25],[9,32],[1,2]],[[5555,3604],[31,-97],[54,-272],[70,-489],[26,-331],[2,-51],[-8,-24],[-59,-355],[-22,-60],[-6,-21],[13,-10],[9,-18],[-1,-28],[14,-44],[11,-10],[26,-18],[20,-3],[12,-7],[17,-20],[19,-14],[5,-43],[9,-19],[10,3],[6,-14],[-5,-23],[13,-21],[-3,-18],[6,-24],[-3,-49],[3,-59],[13,-40],[18,-10],[10,-8],[17,-30],[10,-29],[7,-24],[12,-9],[25,-58],[18,-14],[1,-20],[6,-8],[1,-9],[13,-25],[1,0]],[[5976,1181],[-6,-11],[-3,-11],[1,-10],[10,-20],[5,-5],[7,-4],[-8,-14],[-8,-14],[-5,-5],[-5,-4],[-4,-2],[-5,-1],[-6,3],[-5,3],[-3,0],[-3,0],[-2,-5],[-2,-5],[-1,-6],[-1,-6],[-1,-5],[-1,-4],[-4,-9],[-3,-8],[-3,-11],[-3,-11],[-2,-12],[-2,-13],[-3,-10],[-2,-10],[-4,-3],[-4,-4],[-3,1],[-3,1],[-2,2],[-3,2],[-2,4],[-2,4],[-1,6],[-1,6],[0,5],[-1,4],[-2,5],[-2,4],[-3,3],[-2,4],[-2,0],[-1,1],[-12,-10],[-12,-11],[-6,-9],[-5,-10],[-3,-13],[-3,-14],[-1,-6],[-1,-6],[-1,-4],[-2,-3],[-2,-2],[-2,-3],[-2,-1],[-2,-2],[-2,-2],[-2,-3],[-2,-3],[-2,-4],[-8,-30],[-8,-29],[-4,-8],[-3,-7],[-10,-16],[-10,-15],[-7,-5],[-7,-6],[-2,-3],[-2,-3],[-1,-5],[-2,-5],[-4,-9],[-3,-9],[-5,-5],[-5,-4],[-14,-1],[-14,-1],[-16,-10],[-17,-9],[-2,-4],[-2,-3],[-3,-8],[-4,-9],[-12,-20],[-13,-20],[-7,-5],[-7,-5],[-3,-4],[-3,-5],[-2,-9],[-1,-9],[0,-4],[0,-3],[2,-8],[3,-8],[0,-3],[0,-4],[-2,-1],[-1,-2],[-7,3],[-8,2],[-1,-1],[-2,-1],[-5,-6],[-5,-6],[-2,-1],[-1,0],[-4,2],[-4,3],[-2,-1],[-2,-1],[-6,-8],[-7,-9],[-3,-6],[-3,-6],[-1,-7],[-1,-7],[-3,2],[-2,1],[-2,-1],[-2,-1],[-6,-6],[-6,-6],[-1,-2],[-1,-1],[0,-3],[-1,-2],[0,-3],[1,-3],[1,-3],[1,-3],[1,-1],[0,-1],[1,-1],[0,-1],[0,-4],[1,-4],[0,-5],[0,-6],[-2,-32],[-2,-32],[-1,-4],[-1,-4],[-2,-4],[-2,-4],[-4,-6],[-5,-6],[-4,-5],[-4,-4],[-6,-2],[-5,-1],[-2,-2],[-3,-2],[-2,-4],[-1,-4],[-3,-11],[-3,-11],[-9,-8],[-8,-8],[-3,-7],[-4,-8],[-4,-27],[-5,-27],[-2,-7],[-3,-6],[-7,-7],[-2,-2],[-6,-5],[-3,-5],[-4,-4],[-1,-8],[-1,-8],[-1,1],[-1,1],[-2,1],[0,1],[-1,0],[0,-3],[0,-4],[1,-7],[0,-8],[0,-3],[0,-4],[-1,-3],[-1,-4],[-1,-1],[-1,-2],[0,-1],[-1,-2],[0,-5],[-1,-5],[1,-29],[2,-28],[0,-6],[1,-6],[1,-3],[1,-3],[1,-1],[2,-2],[3,-1],[3,-2],[0,-4],[-1,-4],[1,-4],[0,-5],[1,-4],[1,-4],[1,-4],[1,-3],[0,-3],[0,-2],[-3,-10],[-3,-10],[2,-3],[2,-3],[0,-4],[-1,-5],[-3,-3],[-2,-3],[-4,1],[-3,1],[-5,5],[-5,5],[-1,1],[-1,0],[-2,-1],[-1,-2],[0,-3],[-1,-3],[-1,-2],[-1,-3],[-2,1],[-2,0],[-1,-3],[-2,-4],[0,-1],[0,-2],[-29,32],[-19,21],[-10,10],[-8,14],[-9,14],[-11,23],[-11,23],[-4,4],[-3,5],[-5,2],[-5,2],[-1,1],[-1,1],[1,3],[0,3],[1,2],[1,2],[5,4],[4,4],[2,3],[2,4],[2,4],[2,4],[1,5],[1,4],[2,9],[2,9],[2,11],[2,11],[1,11],[1,11],[0,10],[0,10],[-1,3],[-1,4],[0,2],[-1,2],[-1,1],[-1,1],[1,1],[1,1],[3,4],[3,5],[-1,0],[0,1],[-1,1],[-1,1],[0,3],[0,3],[0,1],[0,7],[-1,8],[-2,-1],[-3,0],[-2,-8],[-1,-8],[-2,4],[-1,4],[-2,0],[-1,1],[-2,-2],[-1,-2],[-2,-2],[-1,-3],[-2,6],[-1,5],[-1,14],[-1,13],[-1,6],[-2,6],[-5,14],[-6,15],[0,4],[-1,4],[-1,0],[-1,10],[-2,10],[-3,-5],[-3,-4],[-7,-10],[-7,-9],[-3,-1],[-2,-1],[-3,2],[-2,2],[-5,6],[-6,5],[-2,2],[-3,2],[-31,-4],[-32,-4],[-20,-3],[-31,-4],[-26,-3],[-36,-4],[-24,-3],[-28,-4],[-11,6],[-4,2],[-6,3],[-5,14],[-6,14],[-10,99],[-11,99],[-7,83],[-8,83],[-4,86],[-5,85],[-1,1],[-1,0],[-1,1],[-1,0],[-1,0],[-1,-1],[-30,1],[-27,0],[-26,0],[-30,0],[-1,2],[-1,2],[0,3],[0,4],[0,131],[1,111]],[[7180,1584],[-3,-1],[-3,-2],[-3,-5],[-8,-43],[-3,-9],[-6,-12],[-7,-10],[-7,-6],[-6,-1],[-16,14],[-5,1],[-9,-2],[-55,14],[-17,0],[-6,3],[-15,18],[-6,9],[-7,9],[-15,9],[-7,7],[-6,12],[-21,21],[-28,10],[-9,6],[-25,40],[-4,8],[-6,21],[-3,9],[-5,5],[-10,6],[-8,11],[-11,3],[-5,5],[-12,21],[-7,7],[-8,4],[-7,6],[-13,23],[-7,8],[7,-19],[2,-12],[0,-9],[-4,-5],[-39,-9],[-4,3],[-9,17],[-5,3],[-8,-11],[-8,-46],[-9,-10],[-10,0],[-4,-1],[-42,-36],[-12,-13],[-4,-7],[-2,-10],[-10,-55],[-5,-18],[-2,-9],[-1,-12],[1,-11],[3,-23],[1,-12],[-1,-10],[-7,-29],[-13,-60],[-2,-24],[-1,-25],[2,-23],[4,-21],[17,-69],[0,-1],[0,-12],[-7,-2],[-14,12],[-23,8],[-2,8],[-1,15],[1,20],[-4,9],[-5,5],[-18,2],[-4,3],[-4,4],[-5,8],[-9,8],[-11,1],[-32,-11],[-8,1],[-8,4],[-8,8],[-7,12],[-8,32],[-6,13],[-8,9],[-34,17],[-18,-1],[-9,4],[-29,39],[-16,13],[-31,3],[-4,-2],[-7,-7],[-4,-1],[-7,5],[-29,32],[-15,7],[-4,4],[-4,5],[-4,4],[-4,-2],[-8,-6],[-17,-2],[-8,-5],[-27,-35],[-4,-2],[-3,2],[-10,17],[-3,3],[-2,-1],[-4,-3],[-12,8],[-6,-1],[-4,-8],[-3,-10],[-3,-9],[-4,-8],[-4,-4],[-6,2],[-5,6],[-6,3],[-4,-4],[-5,-20],[-3,-8],[-4,-6],[-9,-6],[-3,-7],[0,-14],[0,-26],[-1,-10],[-4,-8],[-21,-7],[-9,-12],[2,-25],[2,-6],[9,-16],[2,-7],[0,-8],[-3,-7],[-3,-4],[-4,1],[-12,15],[-3,-7],[-4,-11],[-3,-13],[-1,-13],[0,-8],[2,-4],[0,-5],[-2,-8],[-7,-20],[-3,-5]]],"transform":{"scale":[0.004084960213221331,0.0014851379750975017],"translate":[46.47827884900005,40.584655660000124]}};
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
