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
  Datamap.prototype.khmTopo = '__KHM__';
  Datamap.prototype.kirTopo = '__KIR__';
  Datamap.prototype.knaTopo = '__KNA__';
  Datamap.prototype.korTopo = '__KOR__';
  Datamap.prototype.kosTopo = '__KOS__';
  Datamap.prototype.kwtTopo = '__KWT__';
  Datamap.prototype.laoTopo = '__LAO__';
  Datamap.prototype.lbnTopo = '__LBN__';
  Datamap.prototype.lbrTopo = '__LBR__';
  Datamap.prototype.lbyTopo = {"type":"Topology","objects":{"lby":{"type":"GeometryCollection","geometries":[{"type":"Polygon","properties":{"name":"Ghadamis"},"id":"LY.GD","arcs":[[0,1,2,3]]},{"type":"Polygon","properties":{"name":"Al Jufrah"},"id":"LY.JU","arcs":[[4,5,6,7,8,9,10,11]]},{"type":"Polygon","properties":{"name":"Al Kufrah"},"id":"LY.KF","arcs":[[12,-7,13,14]]},{"type":"Polygon","properties":{"name":"Al Marqab"},"id":"LY.MB","arcs":[[15,16,17,18,19]]},{"type":"Polygon","properties":{"name":"Ash Shati'"},"id":"LY.SH","arcs":[[-10,20,21,22,23,-2,24]]},{"type":"Polygon","properties":{"name":"Ghat"},"id":"LY.GT","arcs":[[25,26,27,-23]]},{"type":"Polygon","properties":{"name":"Murzuq"},"id":"LY.MQ","arcs":[[-13,28,-27,29,30,-8]]},{"type":"Polygon","properties":{"name":"Misratah"},"id":"LY.MI","arcs":[[31,-12,32,-16,33]]},{"type":"Polygon","properties":{"name":"Sabha"},"id":"LY.SB","arcs":[[-9,-31,34,-21]]},{"type":"Polygon","properties":{"name":"Al Jifarah"},"id":"LY.JI","arcs":[[-18,35,36,37]]},{"type":"Polygon","properties":{"name":"An Nuqat al Khams"},"id":"LY.NQ","arcs":[[38,-4,39]]},{"type":"Polygon","properties":{"name":"Az Zawiyah"},"id":"LY.ZA","arcs":[[-37,40,-39,41,42]]},{"type":"Polygon","properties":{"name":"Mizdah"},"id":"LY.MZ","arcs":[[-33,-11,-25,-1,-41,-36,-17]]},{"type":"Polygon","properties":{"name":"Tajura' wa an Nawahi al Arba"},"id":"LY.TN","arcs":[[-19,-38,-43,43]]},{"type":"Polygon","properties":{"name":"Al Marj"},"id":"LY.HZ","arcs":[[44,45,46,47]]},{"type":"Polygon","properties":{"name":"Al Jabal al Akhdar"},"id":"LY.JA","arcs":[[48,49,-45,50]]},{"type":"Polygon","properties":{"name":"Ajdabiya"},"id":"LY.AJ","arcs":[[-46,-50,51,52,53,-14,-6,54,55,56]]},{"type":"Polygon","properties":{"name":"Benghazi"},"id":"LY.BA","arcs":[[-57,57,-47]]},{"type":"Polygon","properties":{"name":"Surt"},"id":"LY.SR","arcs":[[-55,-5,-32,58]]},{"type":"Polygon","properties":{"name":"Al Qubbah"},"id":"LY.QB","arcs":[[59,-52,-49,60]]},{"type":"Polygon","properties":{"name":"Al Butnan"},"id":"LY.BU","arcs":[[-53,-60,61]]},{"type":"Polygon","properties":{"name":"Wadi al Hayaa"},"id":"LY.GT","arcs":[[-35,-30,-26,-22]]}]}},"arcs":[[[1623,9361],[0,-87],[-14,-74],[-11,-92],[11,-78],[10,-54],[-12,-73],[-3,-87],[8,-73],[-5,-92],[10,-65],[27,-59],[31,-58],[11,-5],[-60,-109],[-85,-125],[-51,-83],[-33,-35],[-6,-41],[17,-94],[-3,-129],[5,-149],[19,-163],[25,-169],[25,-155],[0,-204],[50,-87],[56,-80],[15,-61],[19,-132]],[[1679,6648],[-1,-2],[-11,-17],[-22,-29],[-68,16],[-41,43],[-64,-13],[-22,-2],[-60,10],[-24,-14],[-42,-28],[-40,-1],[-84,36],[-29,21],[-81,14],[-40,53],[-9,54],[-18,41],[-36,-12],[-46,-31],[-12,-10],[-35,-30],[-56,-26],[-56,-25],[-55,-26],[-41,-8],[-91,52],[-59,23],[-29,-8],[-56,-18],[-50,-17],[-33,-18],[-27,-11]],[[341,6665],[15,123],[-2,138],[-14,112],[-50,175],[-50,175],[-74,142],[-81,122],[-33,39],[-37,45],[-15,24],[147,82],[141,75],[18,5],[46,3],[16,9],[79,102],[66,108],[58,65],[39,81],[9,29],[1,25],[-16,51],[-3,26],[4,28],[-1,13],[-20,42],[-19,77],[-47,125],[-2,13],[7,48],[10,16],[40,45],[43,74],[32,26],[71,-1],[35,14],[10,8],[9,9],[8,11],[10,26],[27,24],[8,25],[5,58],[15,15],[11,-2],[12,-6],[11,-4],[13,3],[21,17],[22,14],[21,21],[26,58],[17,18],[194,92],[165,77],[44,29],[8,7]],[[1411,9441],[5,-3],[37,-32],[32,-34],[36,-13],[102,2]],[[4494,7243],[10,7],[75,-20],[121,7],[67,28],[81,-6],[68,-61],[94,-27],[60,-21],[61,55],[47,27],[48,0],[53,-47],[13,-55],[27,-68],[54,-61],[53,-68],[26,-82],[27,-102],[66,-68],[87,-62],[100,-28],[73,-24],[0,13]],[[5805,6580],[138,-48],[180,-55],[0,-2],[106,-8],[-2,-975]],[[6227,5492],[0,-369],[-1,-368]],[[6226,4755],[-26,13],[-67,24],[-85,23],[-99,20],[-71,19],[-63,7],[-65,62],[-58,70],[-73,34],[-89,-23],[-69,-37],[-29,-38],[-82,-62],[-51,-16],[-82,-7],[-46,-30],[-53,-24],[-92,36],[-108,24],[-95,21],[-37,52],[-50,37],[-48,30],[-67,73],[-33,75],[4,75],[-34,52],[-38,22],[-56,30],[-31,14],[-28,39],[-6,61],[2,54],[5,53]],[[4406,5538],[1,6],[-15,50],[-41,24],[-40,39],[-42,24],[-24,25],[-20,57],[-18,61],[-60,93],[-46,71],[0,22]],[[4101,6010],[1,16],[21,55],[25,71],[15,59],[-9,60],[-55,57],[-45,13],[-83,29],[-52,3],[-80,-8],[-82,-48],[-80,-9],[-66,11],[-15,53],[-1,58],[-21,81],[-75,83],[-113,74],[-47,38],[-37,33],[-37,58],[-29,58],[-9,80],[5,90],[2,72]],[[3234,7097],[55,16],[79,59],[50,32],[26,36],[4,38],[-1,59],[-12,51],[-1,55],[17,40],[37,52],[20,39]],[[3508,7574],[29,-17],[48,-47],[48,-53],[94,-33],[61,-12],[55,-20],[74,1],[40,-20],[21,-20],[41,-67],[47,-54],[88,-13],[40,35],[61,34],[60,21],[88,-26],[61,-20],[30,-20]],[[6237,1730],[0,57],[0,8],[0,8],[0,8],[0,7],[0,8],[0,8],[0,7],[0,8],[-1,363],[-2,363],[-1,364],[-1,363],[-2,363],[-1,363],[-2,364],[-1,363]],[[6227,5492],[214,1],[214,1],[275,2],[276,3],[378,-6],[378,-5],[368,3],[368,2],[369,7],[368,7],[233,6],[220,6],[1,0]],[[9889,5519],[0,-139],[0,-142],[0,-214],[0,-213],[0,-213],[0,-213],[0,-213],[0,-214],[0,-213],[0,-213],[0,-213],[0,-214],[0,-213],[0,-213],[0,-213],[0,-214],[0,-213],[0,-213],[0,-91],[0,-91],[0,-91],[0,-91],[0,-91],[0,-91],[0,-91],[0,-91],[0,-91],[-1,-91],[0,-91],[0,-91],[0,-70],[0,-69],[0,-70],[0,-69],[0,-82],[0,-4],[0,-1],[-1,-2],[0,-1],[-1,-1],[-1,0],[-2,0],[-1,0],[-2,-1],[-63,0],[-92,1],[-77,0],[-78,0],[-85,0],[-71,0],[-54,0],[-101,0],[0,-91],[0,-92],[0,-91],[0,-91],[-78,45],[-78,44],[-78,45],[-78,44],[-77,45],[-78,44],[-78,45],[-78,45],[-78,44],[-78,45],[-77,44],[-78,45],[-78,44],[-78,45],[-78,44],[-77,45],[-78,45],[-78,44],[-78,45],[-78,44],[-78,45],[-77,44],[-78,45],[-78,45],[-78,44],[-78,45],[-78,44],[-77,45],[-78,44],[-78,45],[-78,45],[-78,44],[-77,45],[-78,44],[-78,45],[-78,44],[-78,45],[-78,44],[-64,37]],[[3446,9464],[0,-7],[-8,-17],[-13,-52],[6,-38],[17,-40],[-2,-43],[-25,-30],[-21,-60],[-10,-65],[-41,-6],[-83,-10],[-66,23],[-51,51],[-102,70],[-36,-41],[-46,-9],[-20,2],[-39,18],[-41,-1],[-36,-14],[-62,-18],[-39,-6],[-99,3],[-39,-1]],[[2590,9173],[-3,43],[-18,67],[-40,51],[-31,34]],[[2498,9368],[-9,12]],[[2489,9380],[71,22],[22,14],[10,38],[32,68],[47,14],[30,10],[82,37],[10,1],[56,6],[3,13],[49,52],[40,35]],[[2941,9690],[23,-10],[116,-20],[7,-2],[11,-10],[4,-3],[10,-4],[23,-23],[35,-21],[54,-47],[29,-30],[13,-5],[5,-1],[97,-16],[10,-5],[9,-9],[28,-15],[13,-4],[18,-1]],[[4101,6010],[-146,14],[-93,-35],[-39,-21],[-114,-16],[-66,-8],[-93,-42],[-45,-83],[-79,-49],[-66,-42],[-60,-43],[-26,-41],[-39,-35],[-66,-8],[-210,-24]],[[2959,5577],[-225,44],[-174,57],[-100,18],[-112,-30],[-151,-101],[-123,-99],[-169,-136],[-188,-137],[-169,-122],[-148,-102],[-84,-58]],[[1316,4911],[-10,102],[-23,95],[-40,191],[-24,149],[-17,102],[-19,171],[-36,80],[-55,39],[-81,31],[-147,28],[-121,36],[-122,35],[-122,56],[-90,54],[-3,1]],[[406,6081],[2,6],[1,29],[-92,250],[-8,43],[32,256]],[[1679,6648],[20,38],[80,-23],[30,-4],[76,-33],[46,-5],[50,-3],[39,-8],[6,-56],[55,-29],[62,3],[44,46],[21,51],[37,33],[36,23],[54,34],[71,39],[65,75],[58,82],[37,59],[38,53],[32,52],[30,64],[50,66],[39,47],[34,32],[70,59],[54,16],[52,-11],[37,-23],[82,-40],[67,-48],[52,-58],[33,-42],[-2,-40]],[[1316,4911],[-14,-93],[-23,-109],[-8,-140],[19,-82],[41,-63]],[[1331,4424],[-42,-118],[5,-144],[-2,-151],[-2,-138],[77,-148],[16,-96],[-9,-100]],[[1374,3529],[-200,70],[-150,53],[-120,42],[-14,3],[-14,-2],[-69,-27],[-74,-29],[-25,-2],[-12,4],[-82,71],[-12,14],[-8,25],[-11,68],[-12,20],[-93,58],[-8,19],[-2,102],[-2,103],[-3,96],[-8,47],[-25,46],[-96,141],[-77,114],[-96,141],[-89,129],[-14,40],[15,35],[9,12],[11,29],[22,21],[5,11],[3,12],[1,15],[222,110],[12,15],[26,94],[-1,15],[-7,21],[1,25],[16,78],[-2,11],[-10,8],[-28,17],[-7,6],[-6,15],[-13,76],[-53,195],[0,12],[3,12],[11,29],[8,43],[9,15],[27,31],[5,14],[-6,15],[-9,17],[-2,15],[15,12],[18,10],[10,14],[43,146]],[[6237,1730],[-13,8],[-78,45],[-78,44],[-78,45],[-78,44],[-78,45],[-77,44],[-78,45],[-78,45],[-78,44],[-78,45],[-78,44],[-77,45],[-78,44],[-78,45],[-78,45],[-78,44],[-77,45],[-78,44],[-78,45],[-78,44],[-78,45],[-78,44],[-77,45],[-78,45],[-78,44],[-57,33],[-13,-2],[-28,-15],[-37,-19],[-36,-19],[-36,-19],[-37,-19],[-36,-19],[-36,-19],[-37,-19],[-36,-19],[-36,-19],[-37,-20],[-36,-19],[-36,-19],[-37,-19],[-36,-19],[-36,-19],[-37,-19],[-11,-6],[-108,-63],[-108,-64],[-108,-63],[-107,-63],[-40,-23],[-10,-1],[-9,5],[-29,27],[-79,75],[-78,76],[-79,75],[-79,75],[-36,34],[-73,44],[-64,17],[-56,14],[-56,15],[-55,14],[-56,15],[-55,14],[-56,14],[-56,15],[-55,14],[-56,14],[-55,15],[-56,14],[-56,15],[-55,14],[-56,14],[-55,15],[-56,14],[-48,104],[-44,96],[-71,153],[-1,2],[-45,98],[-44,95],[-16,22],[-21,12],[-26,9]],[[1331,4424],[123,74],[113,-58],[53,-18],[118,11],[72,9],[65,57],[64,57],[86,-17],[78,9],[52,43],[59,22],[104,38],[151,11],[65,50],[64,84],[45,42],[118,31],[167,63]],[[2928,4932],[1,-1],[125,17],[72,29],[111,50],[72,77],[65,76],[65,70],[52,56],[92,36],[80,22],[112,29],[119,15],[119,22],[66,15],[327,93]],[[4316,8596],[-3,-7],[-11,-26],[1,-122],[28,-108],[41,-155],[28,-142],[21,-135],[48,-135],[54,-149],[21,-116],[21,-95],[-14,-74],[-57,-89]],[[3508,7574],[7,14],[42,43],[30,56],[2,84],[-8,92],[-13,111],[-53,39],[-4,2],[-49,24],[-139,38],[-69,50],[-59,25],[-92,49],[-34,85],[-58,143],[-83,154],[-11,12],[-34,22],[-40,24],[-69,85],[-36,51],[-20,77],[-29,67],[-41,79],[-23,107],[-35,66]],[[3446,9464],[98,-4],[128,-22],[29,-11],[14,-2],[8,-4],[24,-31],[23,-14],[8,-8],[6,-27],[5,-14],[14,-27],[27,-36],[3,-12],[-1,-15],[-6,-26],[-1,-30],[-1,-17],[3,-53],[6,-27],[76,-193],[15,-27],[68,-95],[41,-44],[47,-36],[178,-82],[58,-11]],[[2928,4932],[-1,74],[25,83],[72,70],[38,83],[-7,41],[-34,41],[-27,54],[4,96],[-14,75],[-25,28]],[[2498,9368],[-39,-4],[-22,-14],[-66,-10],[-55,-1],[-90,-13]],[[2226,9326],[6,56],[-4,51],[47,112],[18,31],[27,49],[66,34],[2,4]],[[2388,9663],[55,-53],[6,-60],[10,-78],[-1,-51],[31,-41]],[[2071,9730],[-12,-10],[-33,-104],[-25,-41],[-79,-51],[-32,-42],[-49,-23],[-54,-26],[-16,-38],[-148,-34]],[[1411,9441],[13,12],[11,23],[-2,31],[-15,26],[-42,41],[-13,28],[0,40],[9,77],[-5,76],[12,50],[0,40],[1,12],[18,69],[0,33],[13,-3],[22,-8],[9,-6],[8,-19],[10,-8],[20,-9],[76,-12],[24,-8],[-13,13],[-41,13],[-11,14],[30,-17],[68,-22],[148,-91],[26,-27],[24,-7],[40,-26],[50,-24],[28,-8],[142,-14]],[[2226,9326],[-53,-7],[-30,-7],[-24,-6],[-48,15],[-53,14],[-55,23],[-69,-5],[-94,2],[-177,6]],[[2071,9730],[99,-11],[59,5],[158,45],[18,8]],[[2405,9777],[0,-5],[0,-5],[5,-59],[-22,-45]],[[2405,9777],[8,3],[20,16],[11,7],[14,2],[44,2],[59,-10],[8,-4],[6,-5],[125,-65],[28,-7],[108,4],[27,-4],[53,-15],[25,-11]],[[7605,9706],[2,-3],[5,-1],[5,3],[6,1],[1,0],[5,-9],[40,-51],[2,-47],[-46,-46],[-36,-43],[2,-61],[19,-74],[39,-72],[22,-71],[40,-45],[68,-52],[18,-68],[4,-97],[-5,-71],[-26,-64],[-2,-84],[25,-88],[16,-34],[20,-18],[3,-158]],[[7832,8453],[-39,-16],[-162,-8],[-50,2]],[[7581,8431],[-19,176],[-29,58],[-12,75],[-5,61],[-43,41],[-35,-9],[-75,-6],[-82,12],[-48,-2],[-52,-23],[-85,15],[-27,37],[-26,78],[-33,58],[-39,82],[-26,78],[1,54],[29,80],[46,63],[56,50],[29,46],[9,81],[-2,11]],[[7113,9547],[139,59],[87,58],[73,36],[29,7],[120,-8],[28,3],[16,4]],[[8002,9803],[-4,-9],[-2,-45],[-5,-60],[16,-55],[19,-40],[5,-54],[-8,-40],[-19,-54],[-8,-53],[-11,-24],[12,-64],[1,-64],[15,-68],[-3,-117],[1,-75],[-6,-81],[-15,-40],[0,-118],[-12,-53],[-19,-78],[122,-118]],[[8081,8493],[-89,-9],[-112,-11],[-48,-20]],[[7605,9706],[37,10],[25,14],[97,86],[9,4],[31,3],[28,7],[17,-14],[27,-11],[31,-7],[26,-2],[69,7]],[[8081,8493],[92,18],[49,-42],[76,-69],[35,-73],[67,-47],[45,-8],[63,-19],[62,1],[51,5]],[[8621,8259],[1,0],[1,0],[1,0],[13,-5],[13,-6],[13,-5],[13,-6],[1,-480],[1,-481],[1,-480],[1,-481],[299,-7],[299,-7],[299,-7],[299,-7],[6,-2],[6,-1],[1,0]],[[9889,6284],[0,-57],[0,-257],[0,-29],[0,-111],[0,-246],[0,-65]],[[5805,6580],[0,273],[9,211],[41,150],[76,108],[21,109],[-12,122],[8,122],[22,142],[18,128]],[[5988,7945],[85,-56],[27,-11],[56,-9],[56,-1],[59,7],[33,9],[29,9],[51,25],[70,47],[13,6],[29,5],[13,7],[83,65],[104,126],[28,48],[15,22],[23,18],[11,11],[40,85],[30,81],[3,31],[-3,94],[-4,5]],[[6839,8569],[8,3],[-2,7],[-2,3],[-7,7],[-2,7],[35,1],[70,-22],[27,-42],[47,-63],[67,-46],[44,-14],[91,5],[124,24],[242,-8]],[[6839,8569],[-8,14],[-16,48],[-13,20],[-28,29],[-10,15],[-42,119],[-4,30],[-1,33],[-2,12],[-11,27],[-4,14],[-2,30],[2,33],[9,61],[8,28],[-1,7],[-2,8],[-2,8],[3,7],[8,11],[57,120],[15,22],[120,119],[10,16],[30,35],[13,8],[25,11],[11,9],[9,9],[92,72],[8,3]],[[4316,8596],[140,-25],[233,-2],[134,-30],[138,-47],[107,-24],[23,1],[5,-3],[5,-3],[23,-12],[18,-17],[6,-4],[6,-3],[93,-27],[49,-24],[53,-18],[46,-8],[8,-8],[17,-26],[12,-10],[12,-7],[57,-12],[100,-38],[20,-12],[18,-17],[55,-65],[154,-115],[35,-40],[19,-17],[41,-22],[27,-6],[12,-6],[6,-4]],[[8799,9294],[-1,-5],[-20,-64],[-31,-87],[-32,-113],[-8,-131],[-22,-114],[-54,-80],[-18,-124],[-1,-112],[9,-54],[0,-151]],[[8002,9803],[69,7],[3,3],[7,10],[3,3],[14,2],[7,1],[7,-3],[5,-5],[1,-3],[0,-5],[3,-8],[20,-20],[25,-5],[58,0],[25,-8],[62,-46],[12,-8],[11,-4],[12,-3],[29,-2],[147,-44],[34,-22],[12,-3],[7,-1],[21,-9],[8,-1],[22,1],[14,-4],[26,-13],[29,-5],[12,-5],[8,-7],[2,-11],[-4,-7],[-11,-13],[-2,-7],[6,-45],[6,-11],[9,-9],[13,-8],[-5,-14],[-8,-46],[-12,5],[2,7],[-1,6],[-4,6],[-6,6],[-10,-60],[1,-15],[10,-8],[38,-14],[14,-3],[10,-6],[13,-14],[10,-16],[8,-22],[5,-3]],[[8799,9294],[4,-2],[10,-3],[7,-4],[5,-9],[6,-15],[6,-6],[-1,12],[-7,33],[12,-5],[27,0],[6,-3],[18,-14],[4,-3],[79,-7],[87,2],[108,-25],[100,-40],[-15,-15],[-3,-5],[5,-4],[17,-6],[39,-31],[15,-4],[119,1],[168,-11],[56,17],[14,10],[8,3],[25,-5],[5,1],[5,3],[5,1],[5,-3],[2,-2],[8,-4],[9,-3],[12,-6],[21,-4],[26,-10],[73,-15],[23,-14],[10,-24],[-6,-29],[-1,-16],[4,-13],[22,-24],[33,-48],[3,-13],[10,-21],[12,-21],[-2,-3],[-1,-2],[-40,-31],[-17,-25],[-24,-62],[-102,-84],[-8,-23],[0,-27],[6,-61],[1,-60],[15,-78],[4,-15],[22,-45],[8,-38],[28,-58],[8,-30],[-4,-25],[-9,-25],[-8,-29],[-7,-40],[-19,-51],[-2,-14],[-6,-25],[-12,-25],[-37,-56],[-19,-20],[-17,-21],[-6,-11],[-10,-25],[-27,-47],[-10,-26],[0,-28],[6,-16],[18,-32],[54,-137],[3,-16],[-1,-15],[-11,-38],[5,-31],[32,-55],[9,-30],[0,-17],[-6,-53],[2,-29],[6,-25],[52,-128],[11,-39],[5,-42],[0,-91],[0,-122],[0,-292],[0,-288]]],"transform":{"scale":[0.0015871303920392112,0.0013686470202748371],"translate":[9.286543823000073,19.496123759000028]}};
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
