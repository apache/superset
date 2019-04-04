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
  Datamap.prototype.kazTopo = '__KAZ__';
  Datamap.prototype.kenTopo = '__KEN__';
  Datamap.prototype.kgzTopo = '__KGZ__';
  Datamap.prototype.khmTopo = {"type":"Topology","objects":{"khm":{"type":"GeometryCollection","geometries":[{"type":"Polygon","properties":{"name":"Bântéay Méanchey"},"id":"KH.OM","arcs":[[0,1,2,3]]},{"type":"Polygon","properties":{"name":"Batdâmbâng"},"id":"KH.BA","arcs":[[4,5,6,7,8,-2]]},{"type":"MultiPolygon","properties":{"name":"Kaôh Kong"},"id":"KH.KK","arcs":[[[9]],[[10]],[[11]],[[12]],[[13,14,15,16,17]]]},{"type":"Polygon","properties":{"name":"Pouthisat"},"id":"KH.PO","arcs":[[18,19,20,-18,21,-6,22]]},{"type":"Polygon","properties":{"name":"Siemréab"},"id":"KH.SI","arcs":[[23,24,-23,-5,-1,25,26]]},{"type":"Polygon","properties":{"name":"Otdar Mean Chey"},"id":"KH.OC","arcs":[[-26,-4,27]]},{"type":"Polygon","properties":{"name":"Krong Pailin"},"id":"KH.PL","arcs":[[28,-8]]},{"type":"Polygon","properties":{"name":"Kâmpóng Cham"},"id":"KH.KM","arcs":[[29,30,31,32,33,34]]},{"type":"Polygon","properties":{"name":"Kâmpóng Chhnang"},"id":"KH.KG","arcs":[[-33,35,36,-20,37]]},{"type":"Polygon","properties":{"name":"Kândal"},"id":"KH.KN","arcs":[[38,39,40,41,-36,-32],[42]]},{"type":"Polygon","properties":{"name":"Kâmpóng Spœ"},"id":"KH.KS","arcs":[[-42,43,44,-14,-21,-37]]},{"type":"Polygon","properties":{"name":"Kâmpóng Thum"},"id":"KH.KT","arcs":[[45,-34,-38,-19,-25,46,47]]},{"type":"Polygon","properties":{"name":"Phnom Penh"},"id":"KH.PP","arcs":[[-43]]},{"type":"Polygon","properties":{"name":"Prey Vêng"},"id":"KH.PY","arcs":[[48,49,50,-39,-31]]},{"type":"Polygon","properties":{"name":"Preah Vihéar"},"id":"KH.PH","arcs":[[51,-47,-24,52]]},{"type":"Polygon","properties":{"name":"Stœng Trêng"},"id":"KH.ST","arcs":[[53,54,55,-48,-52,56]]},{"type":"Polygon","properties":{"name":"Krâchéh"},"id":"KH.KH","arcs":[[57,-35,-46,-56,58]]},{"type":"Polygon","properties":{"name":"Môndól Kiri"},"id":"KH.MK","arcs":[[59,60,-59,-55]]},{"type":"Polygon","properties":{"name":"Rôtânôkiri"},"id":"KH.RO","arcs":[[-60,-54,61]]},{"type":"Polygon","properties":{"name":"Kâmpôt"},"id":"KH.KP","arcs":[[62,63,64,65,66,-15,-45]]},{"type":"Polygon","properties":{"name":"Kep"},"id":"KH","arcs":[[67,-65]]},{"type":"MultiPolygon","properties":{"name":"Krong Preah Sihanouk"},"id":"KH.KA","arcs":[[[68]],[[69,-16,-67]]]},{"type":"Polygon","properties":{"name":"Svay Rieng"},"id":"KH.SR","arcs":[[-50,70]]},{"type":"Polygon","properties":{"name":"Takêv"},"id":"KH.TA","arcs":[[71,-63,-44,-41]]}]}},"arcs":[[[2114,8093],[-24,-35],[-5,-51],[4,-101],[-5,-77],[27,-136],[-3,-43],[-21,-50],[-19,-29],[-10,-35],[3,-513]],[[2061,7023],[-289,-13],[-57,14],[-50,29],[-42,32],[-23,9],[-95,-14],[-250,-93],[-27,-10],[-126,13],[-163,50],[-60,37],[-31,37],[-31,-35],[-15,-27],[-42,-55],[-16,1],[-74,17],[-52,85],[-536,53],[-52,2]],[[30,7155],[2,27],[-2,19],[-7,21],[-20,39],[-3,25],[36,55],[73,10],[153,-15],[115,11],[37,16],[88,62],[35,11],[-67,53],[-40,48],[2,49],[61,57],[189,112],[45,46],[8,22],[2,48],[5,24],[9,19],[34,51],[15,41],[32,127],[35,74],[47,56],[108,103],[28,38],[7,30],[-1,35],[6,54],[14,36],[39,68],[14,37],[4,46],[1,31],[0,10],[8,38],[30,36],[31,18],[70,24],[32,23],[23,23]],[[1328,8913],[26,-13],[88,-79],[21,-12],[10,-9],[10,-12],[15,-33],[17,-51],[12,-28],[6,-8],[11,-8],[20,-7],[92,-14],[4,-4],[1,-12],[0,-11],[-18,-116],[1,-14],[10,-2],[10,1],[9,2],[17,0],[5,0],[25,-23],[74,-102],[53,80],[27,32],[45,35],[23,-140],[2,-6],[12,-14],[113,-109],[14,-17],[26,-52],[5,-74]],[[2061,7023],[37,-53],[14,-14],[16,-11],[29,-7],[62,13],[64,-31],[29,-6],[9,-5],[9,-10],[22,-36],[13,-14],[16,-11],[28,-12],[151,-35],[27,-28],[51,-119],[72,-134],[113,-146]],[[2823,6364],[-148,-180],[-77,-72],[-9,-11],[-7,-13],[-3,-18],[4,-22],[10,-16],[7,-9],[13,-10],[10,-11],[5,-19],[-5,-25],[-32,-56],[-10,-21],[-2,-28],[0,-15],[3,-19],[-1,-18],[-6,-19],[-15,-23],[-13,-11],[-12,-9],[-38,-19],[-7,-6],[-9,-13],[-7,-21],[-3,-32],[5,-22],[8,-14],[15,-7],[4,-3],[3,-5],[2,-6],[1,-8],[0,-4],[-1,-9],[-37,-127],[1,-17],[12,-61],[12,-33],[12,-59],[1,-9],[-2,-10],[-12,-37],[-39,-72],[-4,-11],[-1,-5],[-18,-45],[-13,-18],[-18,-18],[-30,-21],[-56,-22],[-66,-9],[-130,40],[-183,28],[-38,-6],[-159,-54],[-83,-41],[-43,-37],[-33,-22],[-21,-5],[-54,0],[-37,-10],[-15,-8],[-8,-7],[-7,-14],[-4,-5],[-9,-6],[-13,-6],[-19,-3],[-15,0],[-12,1],[-12,2],[-22,11],[-25,26],[-11,15],[-5,3],[-10,-2],[-8,-3],[-36,-51],[-21,-34],[-15,-11],[-102,-50],[-35,-25],[-28,-12],[-19,-6],[-18,-3],[-14,-11],[-34,-34],[-13,-7],[-12,-3],[-9,2],[-7,2],[-5,3],[-3,2],[-7,8],[-46,22]],[[850,4685],[-3,25],[-22,30],[-61,40],[-25,33],[-5,19],[-3,39],[-7,19],[-14,15],[-47,34],[-144,176],[-56,50],[-107,43],[-12,11]],[[344,5219],[1,0],[39,15],[271,79],[149,110],[27,60],[9,97],[-1,304],[-10,141],[-23,100],[-36,77],[-45,58],[-44,29],[-46,5],[-39,-16],[-39,-30],[-25,-45],[-10,-38],[0,-45],[-7,-50],[-18,-30],[-31,-14],[-26,-5],[-57,0],[-49,-7]],[[334,6014],[0,2],[-32,23],[-19,31],[-30,73],[-86,122],[-37,78],[-100,318],[-2,5],[-2,164],[12,142],[-8,176],[0,7]],[[1895,370],[14,-1],[13,13],[5,10],[3,-1],[6,-9],[0,-17],[-8,-18],[-9,-26],[-12,-19],[-21,15],[-38,73],[-14,37],[8,32],[25,13],[21,3],[11,-5],[4,-16],[-18,-32],[-2,-11],[0,-12],[3,-18],[9,-11]],[[1820,758],[10,-3],[12,1],[11,-4],[4,-17],[8,-9],[16,-3],[14,-11],[2,-34],[-25,-10],[-22,-13],[-18,-21],[-12,-35],[-17,16],[-8,27],[-5,25],[-3,11],[1,6],[-60,28],[-29,28],[-22,34],[-6,34],[18,31],[38,16],[32,-11],[26,-26],[22,-28],[4,-8],[3,-16],[6,-8]],[[1284,2334],[3,-10],[22,22],[18,2],[15,-13],[23,-59],[1,-25],[-2,-24],[2,-31],[9,-26],[10,-20],[3,-17],[-10,-16],[10,-32],[-2,-43],[-8,-42],[-12,-28],[-26,-15],[-30,0],[-18,12],[10,20],[-21,26],[-7,49],[2,85],[-15,99],[0,58],[15,50],[3,-10],[5,-12]],[[1362,2369],[-9,-13],[-19,1],[-1,24],[7,54],[-17,38],[-25,44],[-10,43],[25,36],[33,-24],[7,-8],[4,-12],[0,-11],[-2,-8],[-2,-1],[10,-22],[21,-38],[8,-19],[0,-18],[-9,-16],[-21,-50]],[[2926,3480],[-133,-24],[-8,-5],[-4,-3],[-3,-5],[-3,-8],[-1,-16],[1,-17],[2,-17],[4,-17],[2,-22],[-1,-29],[-13,-44],[-5,-29],[-2,-25],[4,-44],[35,-165],[2,-24],[-1,-39],[1,-19],[3,-16],[5,-13],[5,-7],[7,-6],[19,-8],[15,-4],[38,-45],[133,-104],[19,-20],[14,-30],[7,-7],[7,-4],[26,-6],[9,1],[19,8],[15,4],[22,-1],[34,-11],[33,-22],[53,-22],[35,-42],[1,-13],[0,-16],[-21,-37],[-12,-28],[0,-20],[3,-18],[28,-69],[7,-14],[25,-32],[17,-29],[25,-59],[10,-32],[2,-24],[-3,-12],[-7,-10],[-14,-16],[-8,-18],[-7,-26],[-8,-54],[-1,-24],[1,-17],[6,-14],[4,-6],[17,-21],[12,-18],[59,-209]],[[3457,1737],[-65,-17],[-7,-5],[-10,-9],[-12,-56],[-2,-5],[-54,-116],[-28,-40],[-9,-6],[-20,-9],[-15,1],[-15,5],[-12,8],[-14,6],[-10,-2],[-9,-7],[-18,-22],[-83,-127]],[[3074,1336],[-162,-167],[-31,-25],[-13,-6],[-14,-3],[-9,-1],[-40,4],[-12,-9],[-11,-15],[-14,-38],[-6,-20],[-3,-16],[-1,-30],[-2,-19],[-3,-8],[-5,-14],[-28,-56],[-14,-33],[-3,-9],[-3,-9],[-9,-15],[-44,-48],[-51,-36]],[[2596,763],[0,11],[-25,9],[-6,15],[11,101],[6,18],[16,16],[22,15],[23,19],[17,33],[3,26],[-3,91],[-29,82],[-54,117],[-36,115],[28,80],[-36,34],[-18,9],[-56,7],[-23,12],[-16,18],[-23,84],[-40,42],[-55,25],[-57,7],[4,-8],[1,-2],[1,-1],[8,-5],[-26,-47],[-14,0],[-9,16],[-6,6],[-24,8],[0,-14],[12,-28],[-12,-35],[-38,-66],[38,21],[4,-24],[-15,-43],[-48,-106],[-12,-44],[-5,-52],[-21,-61],[-4,-27],[1,-22],[9,-37],[2,-28],[-10,-35],[-26,-23],[-30,-8],[-25,10],[-8,-11],[-9,-8],[-22,-12],[-15,55],[-40,33],[-47,25],[-39,29],[-78,-57],[-33,-37],[7,-33],[-26,1],[-23,-5],[-17,-11],[-12,-17],[-37,22],[-43,6],[-23,11],[26,41],[-59,55],[-14,8],[-12,19],[9,40],[16,37],[8,9],[-4,73],[-19,119],[-4,64],[6,22],[13,24],[14,31],[6,43],[-3,40],[-8,28],[-28,59],[-4,18],[-3,19],[-3,20],[-9,16],[-12,4],[-37,0],[-9,3],[3,26],[22,15],[16,16],[-15,24],[0,14],[14,28],[50,59],[54,40],[24,-31],[12,0],[-2,36],[-18,59],[-4,33],[-28,-13],[-12,-8],[-12,-12],[-24,29],[-7,26],[-1,31],[-7,43],[-12,35],[-28,48],[-12,30],[15,-6],[6,-1],[2,-6],[4,-20],[11,0],[12,25],[20,20],[24,13],[29,5],[26,-13],[30,-55],[28,-11],[-60,137],[-17,22],[8,25],[5,8],[-13,0],[-5,-8],[-8,-25],[8,-19],[-4,-21],[-13,-17],[-17,-5],[-19,11],[-22,42],[-50,30],[-14,51],[-2,58],[3,46],[-13,-15],[6,47],[7,18],[-18,0],[-9,7],[-12,24],[1,-80],[-4,-37],[-10,-27],[-13,0],[-20,8],[-27,-8],[-26,-16],[-18,-16],[-39,65],[39,30],[10,-14],[28,-33],[15,0],[-7,23],[-21,30],[-11,26],[0,96],[21,25],[27,-10],[31,-18],[36,3],[0,17],[-23,-2],[-19,6],[-14,13],[-9,15],[0,16],[15,0],[0,16],[-20,-11],[-6,-5],[-15,0],[-2,17],[-9,31],[-13,0],[0,-48],[-14,16],[0,-49],[-12,0],[3,64],[10,50],[20,36],[32,26],[18,10],[17,5],[16,-5],[19,-17],[23,-13],[27,6],[23,19],[11,27],[-11,0],[-17,-30],[-26,3],[-28,20],[-21,23],[-13,0],[-77,-48],[-11,15],[-13,29],[-11,33],[-5,27],[-10,19],[-44,29],[-63,119],[-12,0],[28,-76],[92,-119],[23,-76],[-4,-39],[-22,-69],[-1,-35],[20,-100],[-2,-41],[-18,-52],[-3,30],[-18,42],[-4,33],[-7,16],[-34,38],[-11,18],[29,53],[-7,133],[-22,93],[-54,98],[-79,136],[-87,203],[-19,116],[-30,81],[-12,16]],[[852,3797],[1,0],[29,0],[415,-36],[74,-37],[39,-27],[47,-25],[48,-19],[35,-7],[32,0],[22,7],[49,37],[31,12],[176,59],[75,51],[37,41],[55,81],[24,48],[17,23],[16,7],[50,0],[53,12],[46,1],[52,-19],[14,-7],[13,-11],[21,-24],[11,-9],[46,-25],[5,-4],[76,-93],[31,-55],[15,-19],[16,-16],[40,-30],[31,-18],[54,-25],[31,-10],[32,-16],[6,-6],[58,-31],[17,-13],[41,-40],[72,-55],[21,-19]],[[3546,5440],[92,-135],[310,-326]],[[3948,4979],[-5,-95],[0,-25],[-15,-83],[-1,-30],[9,-42],[-3,-12],[-8,-16],[-53,-61],[-10,-20],[-18,-63],[-11,-29],[-4,-8],[-9,-13],[-13,-15],[-35,-26],[-10,-4],[-6,-2],[-14,-5],[-16,-13],[-30,-34],[-10,-7],[-8,-6],[-57,-14],[-12,-6],[-5,-2],[-5,-8],[-54,-89],[-9,-34],[-12,-96],[34,-176]],[[3558,3945],[-31,-41],[-11,-10],[-16,-8],[-33,10],[-15,0],[-41,-5],[-17,-8],[-16,-22],[-9,-20],[-20,-72],[-11,-20],[-37,-45],[-6,-13],[3,-13],[22,-29],[3,-7],[-6,-6],[-100,-63],[-20,-7],[-23,1],[-12,4],[-10,10],[-24,38],[-11,12],[-13,11],[-13,7],[-12,3],[-12,-6],[-14,-17],[-29,-44],[-18,-23],[-18,-12],[-7,-2],[-10,-8],[-6,-6],[-39,-54]],[[852,3797],[-26,39],[-96,181],[-15,93],[43,381],[10,45],[20,44],[48,51],[17,33],[-3,21]],[[2823,6364],[655,-810],[68,-114]],[[4049,9189],[-1,-42],[-7,-48],[0,-76],[-2,-18],[-5,-12],[-8,-7],[-8,-8],[-7,-13],[1,-13],[5,-9],[57,-85],[39,-36],[10,-10],[2,-7],[-3,-9],[-9,-9],[-33,-30],[-11,-14],[-19,-36],[-15,-40],[-10,-109],[-85,-292],[-5,-27],[1,-17],[-1,-30],[-6,-19],[-8,-18],[-70,-118],[-1,-12],[7,-8],[23,-4],[10,-4],[8,-8],[7,-15],[13,-41],[4,-8],[7,-6],[8,-6],[7,-9],[7,-47],[5,-20],[6,-15],[8,-13],[7,-18],[5,-20],[12,-116],[-2,-26],[-6,-24],[-20,-50],[-9,-33],[-2,-23],[2,-19],[4,-16],[5,-14],[7,-17],[7,-12],[8,-8],[7,-4],[35,-10],[166,-29],[162,-52],[23,-2],[47,20],[7,5],[18,18],[14,2],[3,-5],[1,-9],[-3,-14],[-159,-259],[-22,-50],[-12,-45],[-28,-305]],[[4247,6686],[-15,-44],[-9,-16],[-25,-25],[-16,-11],[-67,-30],[-11,-7],[-6,-10],[-5,-15],[-9,-36],[-15,-204],[3,-60],[-2,-13],[-5,-8],[-16,1],[-10,3],[-11,1],[-4,-6],[-3,-14],[-4,-37],[-2,-15],[-66,-136],[-26,-121],[-15,-50],[-8,-9],[-14,-13],[-32,-24],[-52,-29],[-5,-3],[-24,-22],[-49,-31],[-24,-22],[-79,-108],[-10,-23],[-17,-72],[-48,-37]],[[2114,8093],[52,31],[36,10],[74,11],[37,12],[30,20],[82,81],[34,21],[107,45],[26,21],[239,302],[70,55],[130,68],[292,156],[8,30],[7,15],[2,15],[-3,13],[-16,18],[-25,21],[-12,22],[-7,19],[-8,104],[0,6]],[[3269,9189],[1,0],[53,32],[69,22],[11,-7],[10,-14],[13,-12],[24,0],[14,8],[47,62],[3,12],[4,7],[16,-1],[-6,-8],[2,-21],[11,-21],[23,-10],[33,11],[25,24],[29,18],[45,-4],[102,-50],[215,-38],[13,-6],[12,-5],[11,1]],[[1328,8913],[128,133],[63,41],[38,15],[114,20],[84,32],[58,21],[127,-1],[41,6],[33,18],[52,46],[28,10],[7,-6],[10,-12],[14,-10],[20,-3],[14,6],[71,60],[73,44],[32,7],[33,-14],[26,-20],[27,-7],[39,24],[12,18],[3,19],[5,17],[19,13],[19,1],[19,-6],[15,-12],[12,-15],[4,-24],[-4,-55],[6,-22],[14,-6],[65,-5],[110,-34],[36,-5],[25,3],[15,4],[16,0],[28,-10],[20,-15],[19,-18],[21,-14],[28,-7],[33,5],[10,13],[5,19],[17,19],[103,7],[51,-52],[66,17],[17,11]],[[344,5219],[-18,16],[-13,37],[-5,50],[3,49],[9,37],[23,25],[20,74],[2,23],[-5,28],[-7,16],[-9,14],[-11,24],[-12,49],[-8,89],[-10,54],[-11,26],[-6,26],[3,24],[21,28],[2,9],[-2,8],[-16,19],[-4,10],[3,9],[10,8],[14,9],[10,9],[6,13],[1,12]],[[7705,3614],[16,-54],[56,-127],[10,-57],[-5,-6],[-28,-55],[-2,-16],[-1,-44],[-2,-20],[-14,-33],[-15,-31],[-10,-32],[2,-37],[51,-107],[16,-51],[1,-3],[-17,-35],[-25,-1],[-24,16],[-41,35],[-27,11],[-18,4],[-20,-2],[-107,-34],[-25,5],[-17,17],[-27,51],[-14,20],[-37,24],[-130,50],[-78,2],[-99,37],[-86,17],[-44,-56],[-2,-32],[-4,-32],[-11,-28],[-53,-67],[-17,-49],[-22,-33],[-54,3],[-90,40],[-32,-7],[-38,-39]],[[6621,2858],[0,1],[2,10],[19,56],[2,37],[-3,15],[-11,6],[-67,-14],[-5,0],[-23,5],[-15,6],[-14,7],[-16,11],[-45,42],[-53,61],[-137,2],[-234,49],[-68,9],[-13,4],[-22,10],[-6,5],[-6,5],[-9,15],[-6,11],[-22,64],[-29,49],[-111,54],[-36,10],[-20,-5],[-16,-8],[-19,-14],[-34,-33],[-18,-20],[-72,-82],[-151,-122]],[[5363,3104],[-154,37],[-38,21],[-2,12],[-1,40],[1,10],[2,8],[3,9],[6,5],[6,1],[17,3],[7,5],[4,9],[-3,14],[-6,9],[-6,5],[-71,43],[-58,100],[-36,10],[-8,-50],[-8,-9],[-9,7],[-6,2],[-13,-2],[-8,-9],[-6,-11],[-29,-90],[-8,-12],[-8,-6],[-7,3],[-9,0],[-10,-4],[-16,-10],[-8,-4],[-8,1],[-12,14],[-37,10],[-6,6],[-10,14],[-5,2],[-4,-2],[-4,-6],[-4,-4],[-10,-2],[-6,7],[-2,14],[1,16],[-6,42],[-39,79]],[[4729,3441],[61,167],[14,28],[8,10],[9,8],[9,6],[8,3],[8,1],[46,-11],[9,2],[4,6],[-1,9],[-10,10],[-16,5],[-2,5],[-4,12],[-1,93],[-3,14],[-3,10],[-28,37],[-14,16],[-2,10],[0,13],[17,48],[13,69],[32,90],[2,12],[-2,32],[-24,96]],[[4859,4242],[45,45],[25,14],[14,2],[70,-6],[10,-2],[6,-3],[5,-4],[38,-51],[58,-22],[126,-13],[5,-3],[22,-22],[8,-4],[6,-2],[10,2],[10,5],[18,6],[48,7],[47,-45],[17,-4],[7,6],[2,4],[1,6],[0,8],[-3,17],[-4,15],[-64,174],[-2,50],[-2,12],[-3,10],[-44,83],[-5,19],[0,12],[6,4],[24,14],[28,27],[7,3],[7,3],[30,-4],[15,1],[16,4],[13,1],[16,-2],[8,-2],[17,-2],[55,3],[7,-2],[7,-3],[6,-4],[14,-14],[6,-4],[7,-3],[8,-2],[25,-1],[8,-2],[6,-3],[6,-4],[5,-4],[4,-6],[4,-7],[5,-13],[4,-7],[4,-5],[4,-5],[6,-4],[9,-2],[9,1],[15,9],[8,7],[14,32],[63,259],[65,8],[25,-3],[22,-12],[10,-7],[4,-4],[22,-17],[30,-17],[15,-6],[11,-2],[18,6],[12,5],[9,7],[25,29],[28,19],[9,3],[360,47]],[[6491,4877],[22,-87],[26,-181],[6,-117],[-2,-16],[-7,-22],[-17,-31],[-11,-14],[-9,-9],[-5,-11],[-3,-10],[-4,-70],[7,-2],[11,7],[94,-26],[34,-2],[7,1],[10,-9],[16,-95],[53,13],[6,2],[15,14],[6,3],[8,1],[8,1],[11,-2],[15,-5],[58,-27],[63,-15],[27,-16],[50,-42],[6,-9],[3,-7],[10,-45],[25,-8],[7,1],[8,1],[9,-5],[9,-10],[14,-28],[5,-16],[3,-14],[-1,-10],[-2,-8],[-2,-8],[-7,-14],[-5,-5],[-3,-6],[-3,-6],[5,-7],[8,-7],[19,-10],[34,-21],[8,-4],[23,-1],[8,-1],[10,-6],[33,-30],[22,-15],[12,-6],[6,-5],[10,-12],[12,-21],[30,-72],[0,-2],[-1,-7],[-2,-7],[-5,-11],[-10,-12],[-5,-5],[-4,-5],[-4,-6],[-3,-7],[-3,-8],[-1,-8],[0,-9],[2,-8],[22,-11],[89,0],[11,-17],[4,-6],[5,-4],[6,-3],[10,0],[14,3],[53,24],[9,1],[13,-1],[43,-11],[16,1],[132,38],[12,0]],[[4729,3441],[-31,-15],[-28,-9],[-10,-10],[-27,-65],[-13,-62]],[[4620,3280],[-41,-10],[-33,-17],[-8,-2],[-14,0],[-14,2],[-34,-1],[-18,-3],[-88,-33],[-135,-76],[-55,-52],[-12,-7],[-7,-3],[-8,8],[-6,5],[-20,11],[-66,25],[-6,4],[-54,46],[-23,14],[-68,7],[-21,9],[-15,24],[-78,91],[-7,10],[-1,8],[-5,46],[-3,16],[-68,119],[-14,36],[-10,50],[-5,45],[-17,34],[-3,4],[-9,10],[-48,39],[-14,16],[-9,12],[-1,8],[-2,18],[-1,58],[-3,29],[-18,65]],[[3948,4979],[55,-50],[22,-8],[31,-8],[79,-9],[31,50],[8,18],[5,16],[4,7],[10,10],[39,26],[30,16],[27,20],[32,17],[41,10],[10,1],[71,-24],[195,-107],[113,-29],[-12,-76],[-1,-20],[9,-27],[13,-28],[11,-34],[45,-95],[5,-15],[0,-17],[-6,-50],[4,0],[5,1],[48,32],[20,1],[6,-2],[5,-5],[3,-7],[4,-25],[1,-9],[-2,-10],[-9,-31],[-9,-19],[-12,-21],[-53,-69],[-34,-17],[9,-44],[4,-15],[23,-54],[31,-37]],[[5363,3104],[5,-23],[1,-7],[0,-20],[-4,-14],[-7,-18],[-31,-57],[-3,-2],[-2,-3],[-3,-8],[-1,-12],[1,-20],[4,-21],[6,-17],[2,-9],[-7,-35],[-41,-88],[5,-23],[5,-14],[37,-82],[10,-14],[13,-15],[94,-62],[138,-139],[26,-20],[17,-25],[-1,-52],[-43,-29],[-16,-17],[10,-100],[39,-188],[3,-64],[-16,-54],[-62,-81],[-24,-48],[-27,-118],[-43,-125],[-11,-66],[1,-65],[28,-240]],[[5466,1109],[-184,42],[-27,11],[-21,36],[-5,30],[-11,10],[-41,-26],[-25,-22],[-8,-8]],[[5144,1182],[-9,16],[-2,7],[-3,8],[-17,76],[-5,15],[-6,10],[-4,5],[-4,6],[-3,11],[-2,48],[14,74],[-8,112],[3,55],[24,112],[-1,22],[-12,35],[-37,32],[-37,34],[-21,27],[-40,70],[-11,8],[-9,10],[-4,6],[-2,7],[-3,35],[4,106],[-7,13],[-4,4],[-12,6],[-67,18],[-10,5],[-6,5],[-6,4],[-9,2],[-12,0],[-58,-19],[-58,-5],[-25,-6],[-16,-9],[-3,-2],[-19,6],[-49,40]],[[4588,2191],[82,129],[-6,10],[-21,2],[-150,-4],[-51,22],[-30,51],[29,292],[7,96],[57,165],[15,95],[5,12],[8,15],[17,25],[18,18],[19,10],[11,7],[9,9],[9,12],[5,29],[-1,94]],[[4723,2374],[20,2],[39,14],[11,6],[9,8],[20,33],[16,15],[13,2],[11,-4],[39,-40],[26,-8],[5,4],[5,6],[17,54],[24,23],[24,28],[4,28],[4,102],[-37,18],[-3,5],[-4,8],[-5,69],[-14,70],[-18,67],[-1,48],[-6,8],[-9,3],[-84,7],[-22,-7],[0,-7],[1,-11],[8,-22],[9,-33],[-102,-2],[-50,-111],[-9,-48],[0,-60],[2,-19],[4,-15],[12,-22],[7,-17],[-3,-21],[-28,-123],[51,-56],[14,-2]],[[4588,2191],[-58,-65],[-15,-21],[-5,-25],[-26,-198],[-11,-69],[-19,-105],[1,-113],[-64,-6],[-21,-7],[-10,-8],[-12,-6],[-7,-2],[-98,0],[-11,4],[-42,30],[-19,6],[-21,3],[-55,1],[-23,6],[-62,29]],[[4010,1645],[-51,25],[-136,-6],[-145,-24],[-149,39],[-25,13],[-16,13],[-31,32]],[[6162,6654],[61,-306],[4,-6],[27,-30],[16,-26],[15,-31],[6,-17],[2,-14],[-3,-18],[-13,-39],[-2,-13],[0,-18],[21,-159],[4,-15],[5,-5],[10,-8],[7,-7],[7,-10],[10,-18],[4,-12],[1,-11],[-1,-8],[-6,-15],[-13,-20],[-3,-9],[-4,-14],[1,-9],[3,-8],[22,-26],[13,-25],[12,-30],[4,-18],[2,-14],[-2,-9],[-2,-9],[-6,-15],[-3,-6],[-5,-26],[4,-76],[-4,-46],[23,-96],[3,-52],[58,-207],[51,-276]],[[4247,6686],[182,121],[65,32],[62,22],[117,-3],[181,-43],[18,-8],[12,-11],[2,-18],[-5,-18],[-19,-47],[-10,-44],[-10,-107],[6,-90],[8,-47],[16,-47],[10,-18],[8,-11],[23,-24],[42,-17],[111,-14],[185,110],[131,138],[14,20],[25,47],[8,10],[373,317],[44,19],[256,163]],[[6102,7118],[4,-178],[-5,-55],[11,-78],[50,-153]],[[6621,2858],[-6,-6],[-24,-33],[-22,-41],[-6,-46],[6,-11]],[[6569,2721],[-13,-10],[-6,-3],[-7,-4],[-6,-1],[-16,-2],[-32,0],[-8,-1],[-7,-4],[-20,-14],[-50,-13],[-11,-6],[-8,-10],[-9,-14],[-24,-75],[-26,-147],[-12,-50],[-10,-29],[-2,-11],[-2,-15],[0,-186],[13,-118],[5,-16],[1,-8],[5,-15],[-3,-11],[-30,5],[-12,-9],[-4,-7],[-9,-19],[-14,-15],[-3,-6],[-3,-7],[-10,-60],[-5,-19],[-9,-23],[0,-20],[1,-30],[16,-97],[5,-19],[5,-5],[3,-6],[2,-8],[-1,-11],[-6,-17],[-5,-11],[-4,-8],[-21,-27],[-3,-7],[-7,-15],[-4,-17],[-7,-76],[-5,-16],[-8,-18],[0,-7],[5,-8],[16,-16],[18,-26],[14,-38],[0,-1]],[[6236,1294],[-176,-45],[-94,-25],[-15,2],[-43,26],[-53,19],[-9,5],[-24,-20],[-76,-108],[-57,-140],[-18,-22],[-28,12],[-65,70],[-29,23],[-83,18]],[[6762,8181],[-12,-8],[-19,-8],[-37,-8],[-222,-1],[-31,-5],[-15,-4],[-6,-3],[-6,-7],[-5,-11],[-4,-24],[2,-12],[3,-10],[3,-6],[4,-16],[-1,-9],[-5,-9],[-13,-10],[-18,-8],[-7,-1],[-6,1],[-6,3],[-4,5],[-10,10],[-5,4],[-7,1],[-7,-1],[-12,-4],[-24,-2],[-8,-3],[-8,-5],[-14,-17],[-6,-6],[-6,-2],[-7,0],[-6,4],[-4,5],[-4,6],[-17,32],[-4,5],[-5,5],[-5,5],[-7,3],[-8,2],[-8,1],[-14,-3],[-6,-2],[-6,-3],[-6,-4],[-12,-9],[-25,-31],[-5,-5],[-11,-9],[-12,-13],[-7,-11],[-5,-9],[-3,-9],[-1,-15],[8,-100],[-4,-27],[1,-9],[2,-12],[6,-15],[14,-23],[9,-12],[7,-7],[6,-4],[5,-4],[7,-11],[7,-17],[20,-72],[16,-127],[-24,-330],[-40,-62]],[[4049,9189],[7,0],[10,7],[12,13],[15,13],[21,6],[34,-8],[30,-16],[30,-7],[38,18],[21,29],[18,35],[21,33],[30,21],[30,1],[47,-24],[32,1],[12,12],[19,37],[16,8],[15,-9],[10,-42],[12,-12],[29,7],[56,54],[26,16],[32,-4],[25,-19],[25,-24],[31,-19],[13,0],[36,6],[17,-1],[15,-7],[30,-25],[15,-9],[33,-7],[75,-16],[35,-13],[9,-29],[1,-31],[-9,-106],[3,-20],[60,-133],[33,-46],[42,-24],[102,39],[58,117],[43,116],[55,35],[0,-73],[7,-54],[18,-49],[112,-204],[35,-41],[13,-9],[27,-10],[14,-10],[48,-82],[16,-17],[19,-9],[31,-5],[53,-1],[56,10],[53,21],[45,36],[31,11],[28,19],[53,44],[15,-12],[14,-14],[13,-16],[11,-19],[29,14],[34,-18],[28,-36],[14,-42],[30,26],[19,-1],[19,-15],[31,-16],[27,-3],[40,7],[21,-1],[53,-34],[28,-57],[21,-65],[32,-57],[162,-171],[43,-28]],[[8133,9423],[-4,-8],[-3,-12],[-23,-97],[-3,-28],[0,-22],[15,-52],[8,-39],[10,-33],[5,-39],[0,-43],[-9,-52],[-20,-65],[-4,-29],[-11,-35],[-3,-16],[-23,-177],[0,-30],[3,-28],[12,-31],[13,-22],[15,-20],[13,-21],[23,-104],[29,-322],[32,-117],[5,-29],[-12,-24],[2,-55],[-3,-15],[-180,-405],[-12,-63],[-3,-55],[6,-16],[9,-14],[6,-18],[30,-60],[16,-88],[19,-36],[5,-24],[1,-25],[-4,-87],[1,-23],[9,-18],[12,-18],[3,-7],[2,-7],[2,-10],[1,-11],[-1,-27],[-14,-39]],[[8108,6807],[-121,64],[-25,6],[-23,9],[-34,20],[-118,100],[-38,9],[-107,-6]],[[7642,7009],[-70,-7],[-31,-9],[-109,-57],[-13,-9],[-10,-9],[-20,-30],[-12,-15],[-12,-5],[-15,-2],[-50,11],[-86,-8],[-17,-5],[-16,-9],[-10,-8],[-23,-22],[-117,-209],[-5,-14],[-12,-76],[-4,-11],[-3,-6],[-5,-4],[-6,-3],[-7,-2],[-7,-1],[-6,1],[-4,1],[-31,14],[-3,2],[-6,1],[-7,0],[-13,-6],[-5,-9],[-3,-9],[0,-31],[-6,-19],[-34,-77],[-13,-22],[-10,-13],[-6,-3],[-75,-30],[-27,-3],[-21,-1],[-16,4],[-42,22],[-60,40],[-170,160],[-25,16],[-73,22],[-164,95]],[[6762,8181],[8,-5],[47,-13],[46,6],[47,22],[44,-2],[98,-30],[37,3],[28,40],[-3,110],[23,35],[27,33],[34,28],[29,30],[14,43],[-9,44],[-25,34],[-31,31],[-25,35],[-48,138],[-30,41],[-64,49],[-27,30],[-15,47],[7,58],[-7,44],[-21,38],[-36,35],[-9,25],[-3,27],[3,27],[9,25],[38,-8],[83,-34],[33,2],[5,11],[4,36],[6,10],[10,1],[20,-2],[29,2],[46,-9],[66,-5],[36,5],[30,22],[28,49],[13,50],[19,121],[17,40],[11,-14],[115,-85],[18,-6],[26,-2],[25,8],[13,2],[101,17],[48,24],[20,45],[7,2],[14,14],[8,16],[-22,14],[-1,16],[3,17],[4,10],[17,12],[21,-3],[24,-7],[29,-2],[0,14],[-14,6],[-8,11],[-4,17],[-1,23],[3,22],[10,7],[12,1],[14,9],[40,45],[12,-13],[23,-44],[8,-30],[10,-73],[6,-23],[17,-12],[43,-11],[19,-14],[38,-69],[31,-21]],[[8451,3851],[-35,-4],[-43,-31],[-31,-55],[-22,-76],[-37,-60],[-40,-13],[-94,26],[15,-35],[-162,27],[-91,1],[-58,-49],[-25,2],[-10,16],[-8,20],[-17,15],[-24,5],[-22,-3],[-44,-14],[2,-9]],[[7642,7009],[5,-256],[-9,-44],[0,-9],[9,-49],[27,-89],[19,-30],[58,-39],[17,-17],[10,-16],[4,-7],[3,-8],[2,-9],[2,-10],[0,-12],[-2,-9],[-4,-7],[-6,-3],[-8,-1],[-108,2],[-9,-5],[-10,-10],[-15,-22],[-7,-14],[-4,-12],[0,-9],[2,-63],[3,-15],[4,-10],[9,-10],[58,-97],[5,-8],[5,-4],[5,-4],[24,-14],[6,-6],[4,-7],[14,-25],[12,-15],[17,-12],[20,-11],[6,-3],[6,-1],[33,0],[8,-1],[15,-4],[6,-4],[6,-5],[23,-33],[112,-82],[70,-34],[13,-11],[7,-7],[5,-8],[4,-17],[2,-28],[9,-87],[-4,-28],[-4,-6],[-5,-5],[-6,-4],[-12,-5],[-10,-11],[-13,-17],[-24,-42],[-12,-18],[-10,-11],[-54,-29],[-40,-14],[-35,-25],[-46,-13],[-75,-57],[-28,-33],[-43,-85],[-49,-222],[-7,-59],[5,-36],[-1,-51],[1,-9],[2,-8],[7,-11],[10,-8],[54,-32],[89,-69],[25,-13],[39,-28],[15,-13],[8,-6],[11,-6],[27,-11],[6,-4],[6,-4],[46,-50],[7,-11],[9,-17],[21,-57],[24,-102],[8,-22],[6,-9],[8,-9],[29,-21],[30,-13],[48,-9],[78,-26],[26,-14],[22,-17],[17,-10],[7,-6],[7,-7],[20,-26],[12,-13],[15,-19],[14,-27],[9,-25],[27,-51],[2,-21],[-9,-155],[10,-103],[2,-14]],[[8108,6807],[94,-111],[12,-12],[73,-56],[66,-83],[91,-75],[121,-55],[32,-5],[78,-2],[30,0],[58,14],[21,-1],[8,-2],[13,1],[47,12],[29,2],[6,-3],[5,-5],[5,-5],[5,-5],[6,-2],[11,3],[13,8],[40,40],[8,11],[4,6],[3,8],[5,44],[3,11],[6,13],[3,8],[2,8],[1,10],[0,8],[-3,14],[0,2],[-7,34],[-3,7],[-7,14],[-7,12],[-6,13],[-4,16],[0,9],[1,8],[3,8],[3,6],[25,32],[4,2],[5,1],[23,-2],[16,-19],[65,30],[114,-19],[54,37],[16,35],[10,35],[17,21],[35,-10],[19,-25],[25,-74],[21,-30],[19,12],[20,4],[44,0],[10,-10],[18,-44],[11,-10],[-2,-13],[18,-15],[36,21],[9,8],[12,14],[11,15],[8,9],[5,4],[5,3],[23,8],[13,7],[23,9],[7,5],[5,6],[6,12],[5,3],[6,0],[11,-8],[18,-21],[15,-10],[7,-8],[8,-11],[5,-4],[6,-3],[20,-8],[8,-4],[10,-3],[52,-8],[16,-5],[17,5],[1,0]],[[9932,6709],[-25,-73],[-191,-561],[5,-33],[29,-26],[5,-17],[0,-15],[-4,-13],[-10,-9],[-11,-23],[-4,-26],[5,-25],[21,-59],[7,-71],[8,-35],[13,-27],[53,-73],[25,-65],[5,-61],[-1,-63],[4,-70],[47,-257],[4,-75],[-7,-71],[-10,-30],[-12,-25],[-4,-25],[13,-31],[1,0],[-1,-54],[-55,-191],[-10,-57],[-15,-53],[-27,-42],[-49,-24],[-46,-38],[-63,-105],[-44,-3],[-36,39],[-56,106],[-45,33],[-83,-9],[-91,-34],[-30,-12],[-113,-67],[-55,-71],[-13,-33],[-23,-26],[-50,-43],[-60,-89],[-129,-157],[-45,-37],[-70,-34],[-70,-9],[-144,13],[-24,-2]],[[8133,9423],[23,-15],[138,-51],[8,-8],[15,-18],[8,-15],[15,-35],[66,-113],[50,-60],[26,-22],[26,-13],[29,-1],[73,50],[9,10],[11,7],[20,1],[17,-7],[35,-26],[19,-4],[24,8],[7,12],[0,14],[21,60],[24,6],[8,5],[37,70],[55,81],[1,12],[6,2],[24,-12],[31,-30],[16,-28],[20,-12],[42,16],[58,46],[51,56],[15,36],[11,40],[15,28],[29,0],[29,-6],[16,10],[20,48],[4,46],[3,16],[8,11],[21,16],[10,10],[33,57],[29,31],[35,-3],[51,-45],[35,-38],[19,-9],[35,-9],[44,-24],[22,-1],[24,24],[6,18],[0,20],[-2,20],[1,18],[5,19],[14,22],[6,13],[15,53],[13,16],[29,17],[62,110],[26,26],[23,-62],[-10,-59],[-44,-118],[-3,-36],[8,-69],[-3,-37],[-9,-27],[-28,-47],[-8,-31],[-2,-17],[-7,-32],[-22,-61],[-17,-35],[-24,-24],[-36,-11],[-13,7],[-7,16],[-11,10],[-24,-9],[-15,-17],[-6,-19],[-3,-21],[-5,-22],[-39,-82],[-13,-42],[-4,-48],[4,-21],[17,-45],[5,-23],[0,-22],[-10,-82],[-63,-221],[-9,-56],[8,-28],[17,-22],[21,-40],[4,-46],[-6,-48],[-1,-48],[22,-42],[32,-14],[71,8],[29,-14],[12,-22],[1,-23],[-3,-22],[2,-21],[27,-69],[1,-11],[4,-29],[-5,-27],[-10,-26],[-9,-39],[21,-71],[-2,-21],[-13,-50],[0,-24],[9,-35],[36,-52],[18,-36],[4,-10],[43,-57],[33,-57],[156,-368],[14,-85],[12,-229],[-7,-71],[-60,-178]],[[4010,1645],[-4,-76],[1,-22],[5,-18],[10,-17],[19,-16],[15,-6],[61,-15],[37,-14],[21,-14],[22,-25],[5,-17],[22,-129],[4,-6],[4,-15],[-2,-29],[-20,-75],[2,-15],[4,-4],[58,-29],[61,20],[38,17],[30,-4],[107,-32],[69,-225],[-48,-49],[-16,-25],[-15,-30],[-35,-83],[-5,-40],[23,-88],[15,-22],[7,-3],[6,-3],[6,-5],[4,-5],[2,-52],[-15,-205],[-2,-16]],[[4506,253],[-142,21],[-81,-4],[-29,-8],[-25,-23],[-18,-34],[-16,-37],[-78,-140],[-20,-23],[-27,-5],[-34,9],[-4,14],[-32,48],[-16,11]],[[3984,82],[0,1],[-3,19],[-8,10],[-12,12],[-4,19],[2,70],[-14,43],[-30,67],[-22,27],[-42,19],[-78,-5],[-18,4],[-23,0],[-14,5],[-27,-55]],[[3691,318],[-23,32],[-13,10],[-13,-3],[-12,-10],[-12,-3],[-14,16],[-30,-47],[-48,-1],[-97,31],[-32,-5],[-45,-14],[-33,3],[-180,62],[-32,3],[-26,10],[-52,54],[-2,11]],[[3027,467],[4,5],[9,13],[35,67],[16,40],[6,20],[2,34],[-2,48],[-20,194],[0,19],[13,110],[1,241],[-17,78]],[[3984,82],[-4,3],[-27,-14],[-67,84],[-17,13],[-58,0],[-32,-16],[-17,-6],[-16,6],[-15,39],[-7,100],[-23,20],[-10,7]],[[2815,111],[-19,-23],[-31,1],[-27,6],[-23,19],[-16,38],[16,5],[8,7],[15,20],[-12,28],[5,17],[19,6],[27,-4],[26,-22],[14,-49],[-2,-49]],[[3027,467],[-1,6],[-42,93],[-6,1],[-27,-1],[-6,4],[0,9],[2,11],[-2,9],[-5,14],[-3,35],[-6,13],[-14,-46],[2,-50],[12,-86],[-6,-41],[-16,-40],[-42,-71],[-22,-28],[-24,-14],[-32,-5],[-45,-1],[-24,5],[-12,13],[-8,16],[-15,14],[-18,6],[-32,1],[-14,9],[0,-16],[40,-26],[36,-43],[9,-41],[-39,-17],[-62,4],[-71,-19],[-35,-1],[-25,15],[-13,32],[-3,33],[1,15],[-6,7],[-4,30],[-9,11],[-14,1],[-9,-7],[-6,-8],[-9,-2],[-12,4],[-18,10],[-16,17],[-15,54],[-19,25],[-37,35],[-32,-17],[-9,30],[9,43],[25,22],[15,17],[19,41],[17,45],[7,33],[31,54],[73,26],[147,8],[2,0],[7,0],[0,5]],[[6569,2721],[19,-39],[23,-15],[50,-11],[21,-19],[9,-26],[1,-31],[-4,-61],[30,-123],[3,-36],[-6,-34],[-20,-80],[-32,-175],[2,-33],[24,-23],[31,-10],[25,-18],[5,-50],[0,-1],[20,-64],[39,-36],[101,-30],[28,-31],[46,-88],[28,-39],[66,-68],[25,-38],[19,-49],[22,51],[29,21],[33,-7],[34,-31],[22,-40],[30,-134],[22,-46],[-14,-14],[-19,1],[-41,1],[-33,-5],[-6,-8],[-11,-24],[4,-5],[-2,-60],[-3,-5],[10,-38],[46,-107],[49,-224],[-42,41],[-50,16],[-107,12],[-50,21],[-52,33],[-48,42],[-35,49],[-18,25],[-63,62],[-2,-38],[-18,-51],[-22,-46],[-18,-23],[-39,-1],[-33,26],[-26,38],[-14,33],[-22,81],[-13,36],[-64,108],[-34,71],[-31,44],[-51,7],[-54,-19],[-44,-32],[-1,-1],[-35,-28],[-43,-24],[-29,-7]],[[5144,1182],[-18,-20],[-21,-34],[-12,-37],[6,-80],[30,-88],[67,-152],[1,-76],[-46,-54],[-185,-114],[-24,-26],[-22,-29],[-78,-145],[-46,-58],[-67,-33],[-85,-4],[-93,14],[-45,7]]],"transform":{"scale":[0.0005297622455245493,0.00042892369086908595],"translate":[102.3134237060001,10.415773620000039]}};
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
