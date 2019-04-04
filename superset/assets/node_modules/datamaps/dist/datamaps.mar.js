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
  Datamap.prototype.marTopo = {"type":"Topology","objects":{"mar":{"type":"GeometryCollection","geometries":[{"type":"Polygon","properties":{"name":"Tanger - Tétouan"},"id":"MA.TO","arcs":[[0,1,2]]},{"type":"Polygon","properties":{"name":"Fès - Boulemane"},"id":"MA.FB","arcs":[[3,4,5]]},{"type":"Polygon","properties":{"name":"Taza - Al Hoceima - Taounate"},"id":"MA.TH","arcs":[[6,-6,7,-1,8]]},{"type":"Polygon","properties":{"name":"Gharb - Chrarda - Béni Hssen"},"id":"MA.GB","arcs":[[-8,9,10,11,-2]]},{"type":"Polygon","properties":{"name":"Chaouia - Ouardigha"},"id":"MA.CO","arcs":[[12,13,14,15,16,17,18,19]]},{"type":"Polygon","properties":{"name":"Grand Casablanca"},"id":"MA.GC","arcs":[[-18,20]]},{"type":"Polygon","properties":{"name":"Rabat - Salé - Zemmour - Zaer"},"id":"MA.RZ","arcs":[[21,-20,22,-11]]},{"type":"Polygon","properties":{"name":"Meknès - Tafilalet"},"id":"MA.MT","arcs":[[23,24,25,26,-13,-22,-10,-5]]},{"type":"Polygon","properties":{"name":"Tadla - Azilal"},"id":"MA.TD","arcs":[[27,28,-14,-27]]},{"type":"Polygon","properties":{"name":"Oriental"},"id":"MA.OR","arcs":[[-24,-4,-7,29]]},{"type":"Polygon","properties":{"name":"Souss - Massa - Draâ"},"id":"MA.SM","arcs":[[30,31,32,33,-28,-26]]},{"type":"Polygon","properties":{"name":"Marrakech - Tensift - Al Haouz"},"id":"MA.MK","arcs":[[-29,-34,34,35,-15]]},{"type":"Polygon","properties":{"name":"Doukkala - Abda"},"id":"MA.DA","arcs":[[-36,36,-16]]},{"type":"Polygon","properties":{"name":"Laâyoune - Boujdour - Sakia El Hamra"},"id":"MA.LB","arcs":[[37,38,39,40]]},{"type":"Polygon","properties":{"name":"Guelmim - Es-Semara"},"id":"MA.GE","arcs":[[41,-41,42,-32]]},{"type":"Polygon","properties":{"name":"Oued el Dahab"},"id":"MA.OD","arcs":[[43,-39]]}]}},"arcs":[[[7832,9485],[0,-4],[0,-25],[11,-8],[2,-17],[7,-16],[-7,-19],[-19,-22],[-22,-21],[-25,-18],[-22,-7],[-19,-3],[-12,-1],[-13,-8],[-9,-10],[-28,-14],[-26,-23],[-13,-3],[-16,-12],[-31,-8],[-25,-12],[-32,-11],[-46,-6],[-52,-17],[-38,-35]],[[7397,9165],[-30,6],[-43,-2],[-26,-5],[-19,8],[-25,8],[-19,19],[-26,21],[-14,16],[-16,5],[-29,-6],[-12,2],[-18,1],[-40,40],[-36,22],[-17,13],[-22,6],[-61,11],[-27,7],[-23,11],[-23,1],[-19,4],[-15,6],[-17,8],[-13,-1],[-32,-7],[-37,3],[-3,-1]],[[6735,9361],[27,85],[114,260],[3,13],[1,17],[3,10],[14,27],[13,37],[1,6],[2,6],[8,11],[2,7],[3,32],[5,16],[5,11],[12,11],[22,3],[58,-7],[7,1],[17,15],[8,5],[11,6],[12,2],[7,-3],[11,5],[15,0],[15,-3],[11,-7],[37,20],[10,8],[22,24],[12,9],[13,5],[5,0],[3,-2],[7,-4],[6,0],[3,5],[1,6],[2,1],[4,-1],[6,-16],[7,-14],[9,-12],[14,-12],[-3,-10],[2,-17],[10,-36],[3,-29],[2,-8],[4,-6],[5,-5],[3,-1],[11,2],[3,-1],[1,-4],[-1,-11],[0,-4],[11,-37],[6,-14],[14,-11],[26,-17],[22,-19],[53,-68],[10,-7],[15,-2],[11,-3],[13,-8],[21,-18],[17,-22],[11,-11],[28,-8],[34,-29],[25,-13],[89,-25],[83,-17]],[[8704,8523],[20,-11],[12,-10],[-6,-26],[-32,-42],[-68,-59],[-11,-18],[15,-22],[78,-50],[66,-67],[28,-52],[8,-39],[-32,-25],[-35,-18],[-179,-32],[-71,-3],[-37,4],[-34,-4],[-33,-7],[-49,-40],[-115,-142],[-29,-49],[-31,-40],[-15,-24],[-11,-29]],[[8143,7718],[-44,-2],[-24,4],[-50,-5],[-31,11],[-27,16],[-12,23],[-62,81],[-60,56],[-39,12],[-52,4],[-50,12],[-22,18],[-5,23],[-11,27],[-53,71],[-81,200],[9,29],[51,57],[-4,36],[-17,31],[-28,19],[-89,19],[-18,17],[-3,21],[31,44],[9,16],[-12,28],[-53,86],[-26,59],[-9,15],[-14,-4],[-10,-7],[-17,-2],[-10,9],[-1,16],[-6,25],[-7,24],[-17,22],[-26,36]],[[7253,8865],[11,-6],[13,-2],[39,-1],[23,4],[56,22],[12,3],[12,0],[12,-5],[12,-15],[7,-4],[10,10],[5,1],[6,-1],[51,2],[11,-1],[6,-5],[5,-7],[7,-6],[5,-1],[13,0],[2,1],[8,-9],[-1,-2],[5,-9],[2,-4],[9,-7],[21,0],[23,-19],[15,-20],[19,-31],[19,-21],[42,-23],[36,-13],[19,-20],[5,-21],[-1,-16],[15,-13],[37,-21],[18,1],[46,-6],[9,6],[17,0],[34,-5],[22,9],[23,2],[13,-7],[-3,-9],[2,-14],[33,-43],[17,-30],[27,-39],[-11,-27],[3,-29],[-4,-20],[7,-18],[13,-10],[15,-6],[15,-3],[18,-5],[41,11],[15,-1],[9,-15],[4,-11],[8,2],[25,40],[-4,17],[4,17],[8,14],[49,55],[7,11],[11,7],[72,75],[24,20],[25,13],[24,-1],[21,-7],[16,-12],[12,-14],[24,-14],[151,-36]],[[8253,9503],[1,-5],[4,-25],[-6,-24],[9,-136],[18,-21],[32,-20],[24,-5],[50,-16],[10,-31],[-2,-19],[-6,-20],[0,-15],[-11,-11],[-5,-12],[1,-15],[6,-14],[18,-8],[31,-26],[21,0],[92,65],[21,23],[14,19],[22,17],[47,3],[133,-49],[9,-14],[3,-17],[3,-14],[8,-14],[-8,-7],[-10,3],[-15,1],[-15,-5],[-9,-9],[0,-13],[-15,-47],[-2,-1],[-2,-6],[-3,-3],[-6,-3],[-3,-4],[-1,-6],[-4,-6],[-46,-28],[-9,-9],[-6,-8],[0,-7],[-1,-19],[15,-24],[39,-49],[10,-38],[15,-39],[-8,-35],[-17,-24],[-58,-24],[-5,-21],[10,-34],[58,-111]],[[7253,8865],[-30,38],[-6,6],[-4,7],[-4,10],[14,12],[75,49],[16,26],[34,25],[12,11],[20,8],[13,11],[8,17],[4,21],[-1,36],[-7,23]],[[7832,9485],[1,0],[74,-20],[18,-1],[12,3],[37,21],[86,14],[53,21],[53,10],[27,11],[6,-8],[-2,-3],[-8,-2],[-3,-3],[3,-4],[4,-4],[9,-12],[9,-4],[13,-1],[18,-1],[11,1]],[[7253,8865],[-21,-47],[4,-12],[-1,-12],[-12,-9],[-64,-25],[-22,2],[-26,-1],[-19,2],[-15,6],[-5,16],[-11,8],[-9,10],[-29,14],[-7,-7],[-11,-8],[-8,-16],[-20,-13],[-14,-21]],[[6963,8752],[-20,-8],[-15,1],[-20,-2],[-28,2],[-33,6],[-40,18],[-43,11],[-47,3],[-30,0],[-23,4],[-22,-7],[-25,1],[-28,-15],[-27,-5],[-19,-7],[-20,7],[-25,4],[-23,14],[-15,0],[-21,18]],[[6439,8797],[34,67],[69,95],[6,12],[11,27],[14,21],[135,259],[27,83]],[[6628,8146],[10,-29],[28,-20],[23,-11],[75,-51],[44,-45],[-6,-20],[-5,-13],[-2,-26],[10,-11],[32,0],[18,-9],[13,-28],[-4,-15],[1,-29]],[[6865,7839],[-14,-22],[-18,-9],[-77,-23],[-48,-9],[-179,14],[-20,-11],[-19,-4],[-13,-10],[-12,3],[-15,0],[-13,3],[-39,1],[-32,-6],[-12,3],[-55,-31],[-21,-5],[-10,-20],[-18,-75],[-29,-65],[-35,-42]],[[6186,7531],[-43,7],[-66,41],[-22,12],[-22,18],[-47,11],[-82,3],[-15,5],[-12,2],[-16,10],[-65,84],[-50,38],[-27,15],[-22,23],[-38,45],[-13,22]],[[5646,7867],[-8,24],[-8,5],[-12,3],[-7,12],[-5,11],[0,16],[-7,15],[0,25],[-7,61],[-26,58],[8,17],[9,15],[17,8],[16,5],[11,9],[3,10],[7,12],[13,10],[9,30],[0,32],[-6,23],[-20,34],[-1,1]],[[5632,8303],[31,13],[29,7],[15,6],[4,4]],[[5711,8333],[1,-1],[14,-8],[32,-6],[16,-6],[23,-5],[42,-21],[18,4],[39,-1],[8,-9],[-21,-19],[-2,-15],[6,-10],[14,-4],[10,4],[10,7],[21,28],[56,36],[21,37],[-1,18],[-2,14],[0,11],[-1,11],[3,21],[5,13],[12,15],[5,15],[8,10],[4,12],[0,2]],[[6052,8486],[46,28],[24,20],[22,11],[26,9],[22,3]],[[6192,8557],[1,-1],[24,-26],[12,-8],[12,-22],[11,-26],[6,-24],[20,-45],[19,-8],[59,-21],[16,-7],[26,-6],[3,-13],[-7,-16],[-10,-12],[-4,-19],[9,-17],[0,-13],[-4,-7],[-8,-57],[9,-32],[19,-15],[28,-13],[74,-21],[36,-17],[32,7],[53,28]],[[5711,8333],[10,12],[16,6],[41,12],[25,12],[12,3],[12,6],[10,11],[10,9],[13,-3],[7,4],[6,0],[6,-3],[7,-1],[6,2],[11,7],[18,3],[13,5],[12,6],[8,6],[21,25],[18,8],[18,20],[12,4],[-4,-5],[12,-4],[14,3],[7,5]],[[6963,8752],[22,-12],[8,-8],[14,-26],[1,-15],[11,-16],[15,-17],[7,-18],[-17,-47],[6,-13],[10,-12],[5,-15],[11,-11],[7,-17],[-9,-48],[-18,-29],[-13,-39],[0,-15],[2,-22],[-3,-23],[-8,-22],[2,-17],[-4,-19],[1,-16],[-1,-17],[0,-12],[4,-13],[7,-10],[-12,-9],[-17,-6],[-72,3],[-17,-4],[-13,-7],[-16,-1],[-35,10],[-12,8],[-16,5],[-16,2],[-30,10],[-8,10],[1,13],[-2,12],[-1,15],[-13,10],[-42,14],[-17,2],[-15,-5],[-10,-25],[-19,-35],[-2,-13],[-4,-19],[4,-15],[6,-31],[-17,-21]],[[6192,8557],[11,4],[20,16],[22,7],[66,49],[65,65],[56,85],[7,14]],[[8143,7718],[38,-54],[17,-32],[41,-57],[27,-52],[9,-34],[25,-15],[8,-29],[24,-22],[7,-25],[17,-8],[36,7],[27,12],[18,11],[25,0],[30,-8],[21,-8],[28,-6],[29,6],[29,2],[25,-7],[-12,-34],[-1,-58],[7,-44],[30,-64],[24,-18],[-4,-35],[-1,-38]],[[8667,7108],[-36,-10],[-183,-31],[-24,-2],[-26,6],[-43,-21],[-9,-178],[-46,-3],[-34,-24],[-8,-9],[-3,-13],[4,-52],[-1,-16],[-13,-21],[-5,-13],[3,-12],[7,-7],[10,0],[12,4],[18,17],[9,4],[11,-2],[9,-9],[17,-26],[11,-10],[23,-11],[7,-6],[6,-13],[3,-12],[1,-13],[34,-52],[-35,-53],[-31,-29],[4,-43],[5,-44],[-118,-58],[-105,-24],[-96,-4],[-75,-20],[-61,-33],[-70,-87],[-87,-68],[-92,-38]],[[7660,6072],[-97,62],[-66,43],[-50,39],[-32,11],[-36,30],[-5,43],[12,30],[2,34],[-24,25],[-22,31],[-11,26],[-21,22],[-19,14],[-2,33],[2,24],[17,15],[19,48],[-5,35],[4,43],[44,131],[13,77],[-25,42],[-96,63],[-30,30],[-37,13],[-32,7],[-47,-10],[-34,1],[-26,9],[14,46],[58,66],[31,51],[-11,44],[-44,22],[-92,-28]],[[7012,7244],[-14,38],[-19,20],[5,30],[19,31],[46,27],[68,51],[27,11],[25,8],[50,2],[4,11],[-18,39],[-4,24],[-14,25],[12,35],[19,20],[23,17],[2,10],[-53,14],[-82,51],[-76,28],[-78,69],[-89,34]],[[7012,7244],[-34,-42],[-122,-80],[-195,-91],[-40,-25],[-31,-7],[-139,-55],[-29,-43],[-34,-27],[-54,-14],[-59,0],[-40,13],[-38,8],[-23,16],[-26,15]],[[6148,6912],[23,79],[-18,14],[-49,51],[-17,28],[10,26],[28,17],[90,18],[25,30],[8,36],[-19,67],[-25,60],[-10,60],[3,45],[-3,33],[3,27],[-11,28]],[[8253,9503],[22,2],[14,6],[6,12],[5,19],[13,13],[17,6],[16,-2],[12,-8],[27,-22],[13,-8],[47,-7],[17,-8],[7,0],[8,0],[7,0],[7,-2],[12,-5],[6,-2],[32,-3],[27,5],[78,26],[13,7],[28,27],[7,4],[5,0],[6,-3],[7,-2],[8,1],[19,18],[25,55],[16,21],[-2,7],[4,6],[5,2],[8,-3],[3,-6],[-4,-12],[3,-8],[-6,-21],[8,-27],[1,-3],[-12,-11],[2,-19],[13,-13],[19,6],[9,-11],[-6,-7],[-2,-10],[-1,-12],[2,-22],[3,-9],[6,-8],[9,-10],[16,-11],[22,-7],[45,-4],[-27,20],[-48,50],[-9,15],[3,5],[8,-6],[31,-30],[4,-7],[30,-28],[27,-14],[32,-10],[65,-8],[29,2],[15,3],[10,6],[13,14],[12,8],[13,3],[59,-21],[14,-2],[15,-4],[17,-9],[16,-5],[1,-27],[6,-18],[11,-14],[19,-7],[24,-15],[19,-17],[21,-12],[28,-2],[8,-6],[3,-8],[0,-10],[3,-9],[9,-9],[33,-19],[21,-18],[66,-38],[12,-11],[-3,-5],[-8,-6],[-15,-31],[-33,-46],[-5,-12],[75,-70],[23,-7],[7,-3],[-67,-74],[24,-26],[16,-31],[45,-127],[2,-9],[1,-9],[-1,-14],[-30,-111],[-2,-32],[6,-34],[7,-20],[-1,-8],[-5,-10],[-6,-8],[-7,-5],[-6,-7],[-3,-11],[4,-11],[9,-6],[22,-7],[11,-8],[7,-8],[28,-62],[3,-23],[-8,-19],[-10,-12],[-11,-39],[-9,-17],[-6,-18],[-1,-67],[6,-23],[32,-29],[11,-19],[9,-22],[13,-17],[16,-14],[18,-12],[11,-10],[4,-14],[-1,-16],[-2,-15],[-1,-7],[-3,-7],[-3,-5],[-5,-5],[-27,-18],[85,-132],[21,-16],[39,-14],[175,-125],[10,-16],[-36,-38],[-21,-14],[-23,-9],[-26,-4],[-10,-5],[-10,-12],[-7,-12],[-8,-25],[-10,-63],[-1,-9],[0,-5],[-1,-6],[-4,-7],[-4,-4],[-10,-8],[-3,-4],[3,-11],[10,0],[23,8],[12,0],[13,-3],[11,-9],[3,-14],[-13,-25],[-24,-5],[-47,2],[-6,0],[-15,1],[-23,1],[-32,1],[-38,2],[-43,2],[-48,2],[-51,2],[-54,3],[-55,2],[-55,2],[-54,3],[-52,2],[-49,2],[-45,2],[-40,2],[-86,4],[-112,-30],[-116,-9],[-36,-19],[43,-108],[26,-67],[-109,-14],[-99,-29]],[[7660,6072],[-66,-34],[-52,-38],[-70,-58],[-66,-44],[-61,-62],[-44,-82],[-57,-87],[-65,-82],[-61,-19],[-53,19],[-22,63],[-78,-10],[-75,-14],[-78,0],[-92,0],[-44,-5]],[[6676,5619],[-83,180],[-12,39],[6,25],[42,64],[2,20],[-24,9],[-36,7],[-18,24],[-18,67],[-3,30],[18,50],[11,23],[-35,44],[-49,36],[-34,13],[-52,-12],[-28,-12],[-20,-35],[-22,-18],[-31,-4],[-47,-1],[-41,14],[-48,2],[-26,-25],[-26,-44],[-18,-38],[-22,-32],[-66,13],[-23,10],[-23,1],[-22,4],[-55,-8],[-32,-18],[-27,-19],[-24,-25],[-101,0],[-29,-9],[-19,-27],[-14,-35],[-22,-20],[-28,-11],[-35,18],[-39,0],[-50,-7],[-43,-29],[-91,-4],[-38,12],[-45,-2],[-16,-25],[-11,-21],[3,-21],[8,-15],[-15,-18],[-4,-18],[2,-20],[2,-123],[10,-40],[17,-37],[4,-21],[-16,-11],[-21,-5],[-22,-10],[-85,36],[-67,-5],[-60,-17],[-28,-33],[-16,-31],[-14,3],[-11,13],[-19,-1],[-54,-11],[-33,-11],[-36,-4],[-30,4],[-29,-1],[-46,-31],[-30,-5],[-30,10],[-29,12],[-38,-14],[-16,-19],[-10,-29],[-28,-31],[-32,5],[-32,-8],[-31,-16],[-46,-41],[-30,-2],[-25,16],[-14,14],[-18,6],[-16,4],[-44,-2],[-41,21],[-1,0]],[[4138,5336],[33,47],[16,20],[12,9],[24,9],[10,10],[15,23],[16,20],[7,12],[3,13],[3,5],[22,16],[3,5],[6,14],[26,37],[4,8],[1,15],[4,15],[5,14],[7,10],[30,27],[5,8],[3,11],[26,34],[82,85],[64,109],[39,89],[6,26],[11,88],[11,46],[2,13],[-3,19],[-7,9],[-9,6],[-11,11],[-7,12],[-16,34],[-5,23],[-5,3],[-7,1],[-7,3],[-6,5],[-12,18],[-44,29],[-14,1],[-14,3],[-9,10],[1,26],[13,26],[17,25],[12,22],[4,16],[0,8],[-2,7],[-5,6],[0,4],[2,5],[1,8],[-2,62]],[[4499,6576],[34,-24],[26,-44],[23,-22],[29,0],[36,18],[24,18],[63,-4],[73,4],[59,-24],[70,-1],[47,7],[28,11],[25,21],[65,38],[25,8],[18,-11],[10,-17],[4,-24],[12,-11],[15,1],[36,8],[45,5],[148,0],[87,25],[36,15],[52,-8],[29,1],[28,20],[28,45],[34,38],[41,31],[43,20],[31,6],[24,17],[214,95],[36,28],[21,24],[19,12],[11,10]],[[4499,6576],[-3,74],[-2,12],[-10,25],[7,16],[17,98],[1,39],[-3,16],[-6,9],[-8,6],[-8,10],[19,23],[15,24],[14,42],[7,9],[12,10],[4,5],[4,13],[8,8],[4,8],[8,12],[4,6],[8,55],[5,11],[58,59],[25,33],[5,5],[9,6],[5,6],[5,6],[5,12],[3,5],[16,15]],[[4727,7254],[2,-1],[24,-14],[21,-8],[31,-5],[93,18],[81,-14],[21,-24],[9,-25],[24,-27],[70,-23],[36,1],[74,-4],[72,-11],[40,4],[33,15],[73,149],[36,46],[7,39],[-8,21],[-72,40],[-20,29],[-16,32],[0,31],[25,24],[22,13],[26,22],[26,11],[29,22],[29,16],[35,27],[32,36],[12,40],[-2,35],[16,66],[12,18],[26,14]],[[4727,7254],[58,57],[7,14],[5,10],[7,28],[1,11],[4,8],[22,27],[9,19],[5,21],[3,71],[-2,4],[-12,5],[-3,5],[2,15],[4,11],[16,31],[5,13],[1,14],[-5,11],[-5,7],[-6,10],[-3,12],[-1,11],[12,21],[93,73],[71,79],[60,40],[22,18],[70,89],[79,81],[5,8],[0,9],[0,14],[6,9],[51,57],[5,3],[6,-2],[6,-6],[5,-1],[16,0],[11,3],[23,11],[22,17],[37,42],[22,17],[26,10],[86,18],[59,24]],[[3102,3154],[-3,-4],[-12,-48],[0,-35],[-13,-27],[-18,-69],[-25,-62],[-19,-83],[-19,-69],[-25,-110],[-25,-103],[-31,-97],[-25,-62],[-19,-34],[-44,-42],[-38,-27],[-43,-35],[-50,-34],[-69,-41],[-57,-36],[-23,-15]],[[2544,2121],[-73,15],[-54,4],[-52,-3],[-50,-10],[-206,-71],[-26,-6],[-26,3],[-53,20],[-87,23],[-68,13],[-52,3],[-103,-9],[-50,-12],[-128,-32],[-26,-1],[-29,10],[-22,23],[-19,29],[-26,21],[-66,24],[-68,18],[-8,3]],[[1252,2186],[8,16],[15,18],[15,13],[16,8],[12,10],[7,14],[6,45],[15,41],[6,32],[8,19],[2,10],[-1,11],[-2,10],[-1,11],[4,11],[-4,4],[4,10],[3,11],[1,11],[1,11],[-2,11],[-6,15],[-1,9],[0,61],[-4,17],[19,80],[4,11],[19,70],[29,40],[8,7],[5,7],[19,45],[4,31],[1,4],[6,12],[4,22],[25,64],[47,66],[17,30],[3,9],[2,14],[10,31],[5,10],[-2,11],[6,38],[-2,11],[-6,20],[2,7],[5,8],[6,20],[4,8],[35,45],[6,4],[30,7],[34,18],[51,51],[9,11],[6,12],[8,10],[14,7],[69,7],[12,6],[65,33],[114,81],[76,49],[37,41],[38,76],[13,36],[12,56],[18,40],[18,87],[12,27],[52,75],[0,4],[-4,6],[0,4],[8,5],[34,78],[20,70],[2,15],[3,12],[12,27],[2,12],[0,3],[4,12],[7,7],[19,9],[20,17],[23,7],[10,12],[26,42],[15,50],[7,15],[10,9],[12,7],[59,22],[113,19],[91,-2],[111,36],[171,29],[7,5],[14,14],[3,2],[11,2],[140,60]],[[3273,4680],[2,-2],[46,-94],[27,-39],[68,-124],[6,-30],[-79,-36],[-80,-49],[-9,-3],[-71,-60],[-67,-93],[-75,-222],[-68,-143],[-32,-46],[-109,-112],[-26,-45],[-20,-52],[-7,-27],[-3,-29],[2,-24],[8,-25],[40,-108],[32,-164],[244,1]],[[6676,5619],[-44,-5],[-92,-24],[-87,-9],[-52,-49],[-110,44],[-70,5],[-48,-5],[-70,-29],[-57,-58],[-71,4],[-13,-5],[-14,-1],[-14,0],[-27,5],[-29,1],[-22,-9],[-38,-37],[-10,-8],[-30,-15],[-38,-35],[-66,-43],[-57,-52],[-21,-15],[-71,-30],[-42,-28],[-42,-38],[-10,-6],[-22,-10],[-9,-7],[-22,-37],[-8,-8],[-28,-15],[-28,-22],[-80,-42],[-12,-10],[-7,-13],[-2,-19],[0,-31],[0,-41],[0,-42],[0,-41],[0,-41],[0,-42],[0,-41],[0,-41],[0,-41],[0,-42],[0,-41],[0,-41],[0,-42],[0,-41],[0,-41],[0,-42],[0,-41],[-44,0],[-40,0],[-1,0],[-1,-1],[4,-32],[18,-57],[7,-49],[-10,-30],[-8,-38],[4,-37],[14,-39],[12,-42],[0,-27],[-25,-21],[-59,-11],[-71,-10],[-51,0],[-78,7],[-48,-1],[-42,0],[-38,-7],[-46,-26],[-52,-42],[-65,-55],[-39,-34],[-51,-7],[-52,0],[-50,27],[-33,14],[-21,-1],[-35,-20],[-42,-13],[-39,0],[-64,28],[-78,41],[-45,20],[-65,7],[-64,14],[-46,-7],[-58,0],[-77,-28],[-65,-20],[-71,-21],[-80,-19],[19,-61],[28,-34],[0,-42],[-13,-35],[-39,-34],[-44,-44],[-26,-34],[-26,-48],[-19,-28],[-34,-45],[-29,-56],[-9,-35],[-12,-41],[-23,-12],[-79,-11],[-50,-14],[-44,-13],[-16,-24]],[[3273,4680],[186,80],[20,16],[15,19],[25,40],[10,10],[11,10],[9,11],[4,14],[6,11],[37,25],[29,35],[5,10],[26,15],[5,6],[5,9],[3,5],[22,16],[2,3],[13,21],[17,18],[10,6],[178,89],[43,28],[51,25],[24,16],[77,70],[32,48]],[[2544,2121],[-27,-19],[-43,-48],[-38,-69],[-25,-55],[-44,-90],[-31,-48],[-19,-27],[-50,-28],[-56,-21],[-63,-27],[-50,-28],[-69,-27],[-43,-28],[-32,-41],[-25,-48],[-31,-70],[-25,-75],[-12,-49],[-38,-165],[-13,-96],[-12,-62],[-19,-76],[-12,-118],[0,-96],[-13,-55],[-6,-42],[-31,-48],[-25,-34],[-44,-48],[-38,-28],[-12,-28],[-38,-34],[-37,-55],[-32,-34],[7,-28],[6,-48],[-19,-49],[-19,-55],[-50,-69],[-56,-34],[-81,-7],[-113,0],[-88,7],[-106,0],[-94,13],[-87,14],[-107,7],[-75,0],[-94,-13],[-244,0],[-93,-8],[-138,-27],[-40,-7],[1,17],[26,102],[2,30],[-2,26],[2,16],[10,19],[2,8],[1,8],[0,8],[-2,4],[-8,7],[-3,4],[4,10],[3,21],[12,28],[5,28],[5,16],[65,138],[23,24],[3,6],[1,5],[7,16],[4,4],[10,7],[4,4],[10,24],[7,10],[15,6],[4,3],[4,4],[7,0],[5,-2],[5,-4],[7,-8],[69,28],[12,10],[13,16],[9,17],[22,80],[2,12],[6,7],[31,32],[8,11],[8,44],[2,58],[3,15],[7,25],[5,11],[13,18],[0,7],[-2,6],[-2,4],[0,8],[1,5],[6,13],[1,4],[3,2],[14,2],[15,4],[20,18],[21,25],[6,13],[4,14],[3,15],[1,17],[-6,16],[-12,2],[-26,-7],[5,13],[11,22],[5,8],[30,28],[3,5],[46,110],[8,9],[6,4],[8,8],[28,48],[9,47],[7,13],[9,13],[22,41],[31,35],[2,4],[10,8],[4,5],[4,7],[3,14],[2,8],[10,15],[10,13],[8,13],[3,17],[1,31],[-2,13],[-8,15],[2,4],[2,6],[-7,-6],[-1,-8],[1,-9],[-1,-10],[-5,-5],[-16,-12],[-6,-3],[-8,0],[-5,2],[-6,-2],[-10,-9],[-7,-8],[-4,-8],[-10,-23],[-8,-15],[-1,-5],[-2,-8],[-6,-14],[-1,-6],[-5,-8],[-30,-27],[-9,7],[4,11],[14,17],[3,10],[23,44],[39,54],[4,11],[9,12],[10,11],[45,40],[21,7],[27,17],[8,9],[20,2],[17,10],[13,16],[10,15],[26,30],[17,26],[24,18],[10,10],[4,12],[6,8],[57,48],[34,37],[43,66],[16,19],[20,18],[12,8],[12,6],[13,4],[27,5],[14,7],[21,17],[-1,16],[2,4]]],"transform":{"scale":[0.0015983342188564096,0.001450799885130351],"translate":[-17.01374332534519,21.41997109758168]}};
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
