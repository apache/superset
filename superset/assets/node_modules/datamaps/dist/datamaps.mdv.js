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
  Datamap.prototype.marTopo = '__MAR__';
  Datamap.prototype.mcoTopo = '__MCO__';
  Datamap.prototype.mdaTopo = '__MDA__';
  Datamap.prototype.mdgTopo = '__MDG__';
  Datamap.prototype.mdvTopo = {"type":"Topology","objects":{"mdv":{"type":"GeometryCollection","geometries":[{"type":"MultiPolygon","properties":{"name":"Haa Alifu"},"id":"MV.HA","arcs":[[[0]],[[1]],[[2]],[[3]],[[4]],[[5]],[[6]],[[7]],[[8]],[[9]],[[10]],[[11]],[[12]],[[13]],[[14]]]},{"type":"MultiPolygon","properties":{"name":"Haa Dhaalu"},"id":"MV.HD","arcs":[[[15]],[[16]],[[17]],[[18]],[[19]],[[20]],[[21]],[[22]],[[23]],[[24]]]},{"type":"MultiPolygon","properties":{"name":"Shaviyani"},"id":"MV.SH","arcs":[[[25]],[[26]],[[27]],[[28]],[[29]],[[30]],[[31]],[[32]],[[33]],[[34]],[[35]],[[36]],[[37]],[[38]],[[39]],[[40]],[[41]],[[42]],[[43]]]},{"type":"MultiPolygon","properties":{"name":"Raa"},"id":"MV.RA","arcs":[[[44]],[[45]],[[46]],[[47]],[[48]],[[49]],[[50]],[[51]],[[52]],[[53]],[[54]],[[55]]]},{"type":"MultiPolygon","properties":{"name":"Noonu"},"id":"MV.NO","arcs":[[[56]],[[57]],[[58]],[[59]],[[60]]]},{"type":"MultiPolygon","properties":{"name":"Baa"},"id":"MV.BA","arcs":[[[61]],[[62]],[[63]],[[64]],[[65]],[[66]],[[67]],[[68]],[[69]],[[70]],[[71]],[[72]]]},{"type":"MultiPolygon","properties":{"name":"Lhaviyani"},"id":"MV.LV","arcs":[[[73]],[[74]],[[75]],[[76]],[[77]],[[78]],[[79]],[[80]],[[81]],[[82]],[[83]],[[84]]]},{"type":"MultiPolygon","properties":{"name":"Kaafu"},"id":"MV.KA","arcs":[[[85]],[[86]],[[87]],[[88]],[[89]],[[90]],[[91]],[[92]],[[93]],[[94]],[[95]],[[96]],[[97]],[[98]],[[99]],[[100]],[[101]]]},{"type":"MultiPolygon","properties":{"name":"Alifu Alifu"},"id":"MV.AA","arcs":[[[102]],[[103]],[[104]],[[105]]]},{"type":"MultiPolygon","properties":{"name":"Alifu Dhaalu"},"id":"MV.AD","arcs":[[[106]],[[107]],[[108]],[[109]],[[110]],[[111]],[[112]],[[113]]]},{"type":"MultiPolygon","properties":{"name":"Faafu"},"id":"MV.FA","arcs":[[[114]],[[115]],[[116]],[[117]],[[118]]]},{"type":"Polygon","properties":{"name":"Malé"},"id":"MV.MA","arcs":[[119]]},{"type":"MultiPolygon","properties":{"name":"Vaavu"},"id":"MV.WA","arcs":[[[120]],[[121]],[[122]]]},{"type":"MultiPolygon","properties":{"name":"Meemu"},"id":"MV.ME","arcs":[[[123]],[[124]],[[125]],[[126]],[[127]],[[128]],[[129]]]},{"type":"MultiPolygon","properties":{"name":"Dhaalu"},"id":"MV.DA","arcs":[[[130]],[[131]],[[132]],[[133]],[[134]]]},{"type":"MultiPolygon","properties":{"name":"Thaa"},"id":"MV.TH","arcs":[[[135]],[[136]],[[137]],[[138]],[[139]],[[140]],[[141]],[[142]],[[143]]]},{"type":"MultiPolygon","properties":{"name":"Laamu"},"id":"MV.LM","arcs":[[[144]],[[145]],[[146]],[[147]],[[148]],[[149]],[[150]],[[151]],[[152]],[[153]],[[154]],[[155]],[[156]]]},{"type":"MultiPolygon","properties":{"name":"Gaafu Alifu"},"id":"MV.GA","arcs":[[[157]],[[158]],[[159]],[[160]],[[161]]]},{"type":"MultiPolygon","properties":{"name":"Gaafu Dhaalu"},"id":"MV.DD","arcs":[[[162]],[[163]],[[164]],[[165]],[[166]],[[167]],[[168]]]},{"type":"Polygon","properties":{"name":"Gnaviyani"},"id":"MV.NA","arcs":[[169]]},{"type":"MultiPolygon","properties":{"name":"Addu"},"id":"MV.SE","arcs":[[[170]],[[171]],[[172]],[[173]],[[174]],[[175]]]}]}},"arcs":[[[4670,9632],[-28,3],[8,9],[146,-3],[-73,-7],[-53,-2]],[[2879,9654],[-8,-2],[-19,1],[-1,0],[7,6],[17,1],[18,-1],[17,-1],[-20,-2],[-11,-2]],[[4272,9656],[-9,-1],[-21,1],[9,6],[15,1],[18,-2],[17,0],[-20,-2],[-9,-3]],[[2708,9664],[-25,5],[8,2],[19,1],[16,1],[-5,-4],[6,-2],[1,-2],[-20,-1]],[[3840,9667],[-10,-1],[-12,0],[-9,1],[11,6],[14,1],[18,-1],[16,-1],[-19,-2],[-9,-3]],[[2581,9677],[-17,1],[-3,0],[-1,0],[8,6],[18,1],[17,-1],[16,-1],[-19,-2],[-11,-3],[-8,-1]],[[3948,9721],[-22,-1],[-24,5],[5,2],[21,1],[16,1],[-5,-3],[6,-3],[2,-2],[1,0]],[[4904,9722],[-45,-8],[-28,10],[9,12],[28,12],[39,9],[46,0],[-9,-18],[-40,-17]],[[2260,9802],[-16,-2],[13,7],[0,-1],[3,-4]],[[4760,9799],[-2,0],[-1,0],[-5,0],[-6,0],[-7,13],[7,8],[20,4],[42,1],[-36,-26],[-8,0],[-4,0]],[[1925,9843],[13,7],[0,-4],[-13,-3]],[[2760,9897],[16,-18],[-39,7],[0,4],[0,1],[23,6]],[[2481,9934],[-13,-7],[-7,4],[20,3]],[[2134,9980],[-9,-12],[-51,8],[2,2],[28,1],[30,1]],[[1869,9994],[-19,-2],[12,7],[7,-2],[0,-3]],[[25,9108],[15,-1],[17,0],[-1,0],[-19,-3],[-15,-3],[-12,-1],[-10,3],[10,4],[15,1]],[[2566,9291],[-9,-1],[-21,1],[9,6],[15,1],[1,0],[16,-2],[18,0],[-20,-2],[-9,-3]],[[2274,9296],[-44,1],[-5,2],[9,2],[5,3],[14,-3],[18,-1],[12,-1],[-9,-3]],[[3235,9318],[-22,-1],[-7,1],[-17,4],[5,2],[21,1],[15,1],[-1,0],[-3,-4],[6,-2],[2,-2],[1,0]],[[3338,9372],[-7,-2],[-22,2],[10,6],[15,1],[1,0],[17,-2],[17,-1],[-20,-1],[-11,-3]],[[3600,9436],[-72,-9],[5,7],[17,2],[24,0],[26,0]],[[3848,9475],[-1,0],[8,10],[24,3],[63,1],[-23,-5],[-12,-4],[-17,-4],[-42,-1]],[[3295,9545],[-21,-1],[-7,2],[-18,3],[9,2],[18,1],[17,1],[-5,-3],[1,-1],[5,-2],[1,-2]],[[2158,9554],[-10,-1],[-18,1],[-1,0],[9,6],[15,1],[18,-2],[16,0],[-19,-2],[-10,-3]],[[4184,9509],[-2,0],[41,21],[154,34],[66,24],[44,0],[12,-1],[0,-1],[0,-3],[9,-3],[-128,-40],[-75,-18],[-121,-13]],[[5296,8686],[-15,-5],[-34,0],[50,5],[-1,0]],[[5264,8717],[-4,0],[19,3],[30,2],[-1,-1],[-44,-4]],[[5000,8745],[-36,-1],[49,4],[-1,0],[-12,-3]],[[5433,8772],[-2,0],[3,4],[11,1],[15,1],[19,2],[-13,-3],[-7,-3],[-8,-2],[-18,0]],[[4999,8800],[-46,-5],[17,3],[30,2],[-1,0]],[[5485,8822],[-26,-14],[-25,5],[5,3],[23,2],[23,4]],[[3223,8860],[-2,-1],[14,3],[35,2],[-2,0],[-45,-4]],[[5233,8876],[-35,-4],[-36,5],[7,2],[25,3],[18,4],[5,-4],[13,-3],[3,-3]],[[4102,8942],[-2,0],[52,5],[-22,-4],[-28,-1]],[[4907,8947],[-3,-1],[5,1],[55,10],[-20,-7],[-37,-3]],[[3684,8970],[-3,0],[49,5],[-1,-1],[-17,-3],[-28,-1]],[[4840,8992],[-9,-5],[-55,2],[-1,0],[-8,2],[17,4],[10,4],[1,0],[10,-4],[10,0],[10,-1],[15,-2]],[[4070,9001],[-4,0],[16,2],[33,2],[-3,0],[-42,-4]],[[2519,9022],[-8,-3],[-43,2],[-7,2],[11,2],[4,2],[15,-2],[2,0],[17,-2],[3,0],[6,-1]],[[4702,9029],[-22,-2],[-12,-3],[-14,-1],[-18,1],[8,4],[15,0],[21,0],[22,1]],[[3183,9047],[-7,-3],[-46,1],[-5,2],[11,3],[6,2],[12,-3],[20,-1],[9,-1]],[[2084,9138],[-8,-3],[-43,1],[-2,1],[-7,2],[10,2],[6,2],[16,-2],[18,-2],[5,0],[5,-1]],[[3355,9135],[-1,0],[53,10],[-24,-7],[-28,-3]],[[1988,9153],[-8,-2],[-43,1],[-2,0],[-6,2],[11,2],[5,3],[15,-3],[18,-1],[7,-1],[3,-1]],[[2974,7883],[-15,-2],[-18,7],[9,1],[26,0],[26,1],[-13,-2],[-15,-5]],[[2391,7889],[-19,-1],[-12,5],[11,2],[23,0],[23,1],[-14,-3],[-5,-2],[-7,-2]],[[3053,7921],[-10,4],[-2,1],[11,1],[21,0],[25,1],[-14,-2],[-5,-3],[-7,-2],[-19,0]],[[1837,7923],[-18,-1],[-14,5],[10,2],[23,0],[26,1],[-14,-3],[-6,-2],[-7,-2]],[[3082,8081],[-1,0],[-11,5],[10,1],[24,0],[24,2],[-1,-1],[-15,-2],[-4,-3],[-7,-1],[-19,-1]],[[3061,8158],[-20,-1],[-11,5],[11,1],[22,1],[24,1],[0,-1],[-14,-2],[-7,-3],[-5,-1]],[[3002,8211],[-17,-3],[-5,-3],[-9,-2],[-23,0],[-10,6],[13,2],[1,0],[6,0],[18,0],[26,0]],[[2789,8274],[-1,0],[39,11],[-10,-7],[-28,-4]],[[2717,8328],[-25,3],[-14,2],[1,3],[26,1],[26,3],[-14,-12]],[[2636,8387],[-36,4],[-7,4],[16,10],[1,-1],[26,-17]],[[2310,8539],[-14,-15],[-41,8],[6,4],[49,3]],[[2139,8550],[-5,-2],[-14,1],[-14,2],[-2,5],[12,1],[20,-2],[25,0],[-1,0],[-17,-2],[-4,-3]],[[6623,8241],[-110,-28],[-1,0],[-7,0],[-3,0],[28,9],[96,20],[-3,-1]],[[6549,8306],[-36,-4],[-37,4],[9,3],[23,3],[20,4],[3,-4],[15,-3],[3,-3]],[[7010,8362],[-4,0],[52,9],[39,4],[32,1],[31,-1],[-150,-13]],[[6960,8456],[-21,-1],[-29,4],[9,2],[23,2],[23,2],[-5,-3],[0,-3],[0,-3]],[[6598,8541],[52,-16],[-81,5],[-20,4],[49,7]],[[2666,7143],[-2,0],[6,13],[24,5],[32,1],[30,0],[-90,-19]],[[2226,7167],[-16,-2],[-31,1],[-1,0],[50,1],[-2,0]],[[2102,7336],[-2,-1],[9,3],[25,2],[-32,-4]],[[2242,7339],[32,4],[-1,0],[-5,-3],[-1,0],[-12,-1],[-13,0]],[[3357,7449],[-21,-1],[33,4],[-12,-3]],[[3431,7459],[-36,-1],[-22,4],[8,1],[17,2],[11,2],[1,0],[8,-4],[13,-2],[0,-2]],[[3772,7499],[-1,0],[33,4],[-3,-3],[-29,-1]],[[3951,7517],[33,-2],[-3,0],[-29,1],[-30,2],[3,0],[26,-1]],[[1610,7597],[-2,0],[33,4],[-1,0],[-8,-3],[-22,-1]],[[4184,7607],[-32,-1],[32,4],[0,-3]],[[4004,7679],[-32,-4],[0,2],[34,2],[-2,0]],[[2504,7745],[-26,-1],[33,5],[-7,-4]],[[7604,7611],[0,-1],[-32,2],[55,1],[-1,0],[-22,-2]],[[8405,7650],[-49,-2],[-70,3],[-1,0],[55,4],[57,3],[55,1],[53,0],[-100,-9]],[[7296,7690],[-2,0],[27,2],[1,0],[12,-1],[17,0],[-1,0],[-54,-1]],[[8841,7723],[-21,-2],[-37,1],[59,1],[-1,0]],[[8940,7735],[-1,0],[33,2],[30,-1],[-2,0],[-60,-1]],[[6705,7753],[-17,-1],[-30,2],[-2,2],[11,2],[3,3],[1,0],[10,-4],[19,-2],[5,-2]],[[5975,7769],[15,-2],[1,0],[28,0],[3,0],[17,0],[-11,-4],[-89,-1],[-2,0],[-14,3],[14,1],[27,1],[11,2]],[[8869,7792],[0,-1],[-44,35],[17,7],[47,-10],[20,-10],[-8,-11],[-32,-10]],[[6178,7844],[-3,0],[27,2],[31,-1],[-55,-1]],[[7980,7875],[-24,-2],[-34,1],[58,1]],[[6328,7884],[-2,-1],[21,7],[1,-5],[-20,-1]],[[7278,7993],[-29,-2],[-27,1],[-2,0],[58,1]],[[6996,5811],[-8,2],[9,4],[14,1],[17,-1],[14,0],[-19,-2],[-17,-3],[-10,-1]],[[7054,5907],[-3,-1],[50,6],[-1,0],[-4,-3],[-42,-2]],[[7348,5930],[-22,-1],[16,4],[21,2],[54,4],[-2,0],[-67,-9]],[[6178,5943],[-32,-4],[0,2],[33,2],[-1,0]],[[7707,6133],[-35,4],[-20,3],[-1,3],[27,1],[28,2],[1,-13]],[[6872,6162],[-1,0],[34,3],[-1,0],[-10,-2],[-22,-1]],[[8525,6453],[-30,-3],[-29,0],[-2,0],[63,3],[-2,0]],[[8676,6471],[-21,-1],[-18,3],[5,2],[16,1],[15,3],[-2,-3],[7,-3],[-2,-2]],[[8912,6480],[-12,1],[-18,0],[-2,0],[-18,5],[12,2],[23,0],[24,1],[-1,0],[-8,-3],[4,-3],[0,-1],[-4,-2]],[[9205,6510],[-20,-1],[-18,3],[6,2],[15,2],[14,2],[-2,-3],[6,-3],[-1,-2]],[[9479,6567],[-2,0],[51,4],[-19,-3],[-30,-1]],[[9526,6595],[-26,-5],[1,3],[27,2],[-2,0]],[[6476,6622],[5,-12],[-32,3],[0,2],[13,3],[14,4]],[[8134,6801],[-22,-1],[-6,1],[-10,2],[6,2],[14,2],[15,2],[-1,-3],[5,-3],[-1,-2]],[[6743,6820],[-21,-2],[-17,3],[6,2],[16,2],[13,3],[0,-3],[5,-3],[-2,-2]],[[7543,6933],[-22,-1],[-4,1],[-12,2],[6,2],[16,2],[13,2],[0,-3],[5,-3],[-2,-2]],[[7136,7259],[-101,-1],[23,6],[21,0],[25,-2],[32,-3]],[[204,6011],[-19,-2],[-48,2],[-1,0],[-2,2],[-1,0],[20,2],[18,3],[5,-3],[11,-2],[7,0],[6,-1],[5,-1],[-1,0]],[[2723,6348],[-31,0],[-9,1],[0,3],[-10,3],[2,0],[17,-3],[18,-1],[11,-1],[2,-2]],[[2523,6349],[-30,1],[-56,5],[126,-5],[-1,0],[-39,-1]],[[2548,6576],[-9,-21],[-67,1],[-17,0],[-35,11],[128,9]],[[1406,5379],[-37,-2],[-28,2],[-1,0],[6,2],[17,2],[9,3],[1,0],[11,-3],[19,-2],[4,-2],[-1,0]],[[1044,5386],[-49,0],[-3,2],[18,3],[9,3],[1,0],[9,-2],[4,-1],[23,-2],[11,-1],[-23,-2]],[[2124,5426],[-1,0],[38,9],[39,4],[42,1],[38,-1],[-156,-13]],[[2440,5518],[-37,-2],[-29,2],[5,2],[16,2],[11,3],[11,-3],[13,-1],[7,-1],[3,-2]],[[117,5653],[-26,-5],[-19,2],[-26,2],[0,4],[17,3],[9,4],[14,-4],[23,-3],[9,-3],[-1,0]],[[2536,5666],[-35,-3],[-29,2],[4,2],[17,2],[11,3],[13,-3],[19,-2],[0,-1]],[[2476,5715],[-38,-3],[-4,1],[-23,2],[4,2],[17,1],[11,3],[12,-3],[14,-1],[4,0],[3,-2]],[[2464,5798],[-37,-3],[-28,3],[5,2],[16,2],[11,2],[12,-2],[7,-1],[11,-1],[3,-2]],[[2056,4830],[-43,0],[-5,1],[13,3],[8,5],[11,-3],[13,0],[6,-1],[11,-1],[-14,-4]],[[2779,4866],[-33,-3],[-29,2],[2,2],[15,2],[9,3],[1,0],[11,-2],[20,-2],[4,-2]],[[3372,4986],[-41,0],[-5,1],[11,3],[8,5],[12,-3],[20,-1],[12,-1],[-17,-4]],[[3283,5049],[-34,-3],[-2,0],[-26,2],[3,2],[14,2],[9,4],[1,-1],[13,-2],[18,-2],[4,-2]],[[1373,5123],[-1,0],[-2,2],[11,3],[8,4],[12,-3],[20,0],[4,-1],[5,-1],[-14,-4],[-43,0]],[[8062,6325],[62,-8],[-8,-11],[-25,-20],[-104,-37],[-109,-16],[-147,-11],[-224,2],[-96,6],[-426,20],[9,7],[748,-4],[80,6],[52,21],[67,30],[121,15]],[[7808,5188],[1,0],[-26,6],[1,0],[8,-1],[13,-1],[1,-1],[2,-3]],[[9998,5304],[1,0],[-18,1],[-25,1],[-2,0],[-8,4],[2,-1],[50,-5]],[[7709,5368],[-22,1],[-3,5],[25,-6]],[[6239,4437],[-28,6],[8,2],[21,1],[19,1],[-8,-4],[8,-2],[0,-3],[-20,-1]],[[6687,4456],[-81,-13],[11,8],[24,3],[29,2],[17,0]],[[8107,4591],[-18,-3],[-5,5],[2,0],[13,-1],[8,-1]],[[6327,4600],[-1,0],[-32,2],[0,2],[17,2],[11,2],[7,-3],[12,-3],[4,-1],[-18,-1]],[[8230,4673],[-20,-11],[-7,3],[5,2],[22,6]],[[8433,4682],[-78,-14],[9,8],[26,4],[27,1],[17,1],[-1,0]],[[8683,4863],[-39,-3],[43,8],[-4,-5]],[[2074,4320],[-18,-5],[-32,1],[-5,1],[2,3],[-6,3],[23,-1],[25,0],[11,-2]],[[1768,4325],[-60,4],[-3,3],[26,3],[26,4],[11,-14]],[[3212,4395],[-24,-1],[-29,6],[93,4],[-40,-9]],[[3089,4664],[-42,-3],[-4,0],[-9,1],[0,4],[-5,5],[60,-7]],[[1711,4681],[-24,-4],[-1,4],[48,10],[-23,-10]],[[3322,3660],[-14,-1],[1,1],[50,2],[-22,-2],[-15,0]],[[3913,3682],[-6,-1],[-26,1],[-6,3],[9,1],[18,1],[20,1],[-9,-3],[0,-3]],[[4081,3694],[-55,0],[-10,3],[9,3],[6,5],[13,-3],[37,-8]],[[2448,3798],[-1,0],[-30,1],[50,2],[-19,-3]],[[2258,3868],[9,-14],[-42,4],[-2,4],[19,3],[16,3]],[[6153,3888],[-2,-1],[18,8],[0,-1],[-3,-4],[-13,-2]],[[6344,3942],[-1,0],[-81,57],[3,10],[67,-16],[37,-14],[8,-3],[8,-17],[-41,-17]],[[5900,4082],[-14,2],[-18,2],[-2,3],[16,3],[14,5],[4,-15]],[[4271,4154],[-2,0],[43,4],[-16,-4],[-25,0]],[[6467,3177],[-50,-8],[-21,1],[-12,5],[-18,5],[1,0],[100,-3]],[[6699,3186],[-58,-1],[4,5],[3,1],[14,3],[22,2],[12,4],[9,-6],[17,-5],[-9,-3],[-14,0]],[[7289,3226],[-65,-8],[-24,0],[-7,4],[-7,4],[103,0]],[[7622,3228],[0,-1],[-4,1],[-2,0],[-5,1],[-2,0],[21,4],[21,4],[47,4],[99,6],[2,0],[-68,-8],[-109,-11]],[[7938,3271],[-5,-2],[-9,4],[9,3],[6,1],[12,2],[20,3],[-2,-1],[-31,-10]],[[5306,3310],[-76,-4],[3,7],[16,1],[16,-2],[9,0],[32,-2]],[[8015,3311],[-3,-1],[84,42],[30,10],[-40,-27],[-29,-13],[-42,-11]],[[8096,3404],[-20,4],[1,3],[21,7],[-2,-14]],[[5975,3431],[-46,-4],[-27,2],[3,2],[13,3],[1,3],[24,-2],[26,-2],[6,-2]],[[8043,3483],[-11,-6],[-25,0],[18,3],[18,3]],[[6572,3491],[0,-6],[-7,2],[7,4]],[[8111,3541],[-9,5],[7,3],[19,2],[22,3],[-39,-13]],[[8262,3589],[166,0],[1,0],[-18,-2],[-29,-3],[-119,-10],[-55,-4],[0,5],[11,5],[43,9]],[[7754,1380],[-44,-9],[-1,0],[-19,6],[-6,1],[7,3],[30,-1],[34,1],[-1,-1]],[[7555,1534],[24,-11],[-39,2],[-6,3],[11,3],[9,4],[1,-1]],[[6569,1698],[-1,0],[-17,0],[-11,5],[6,1],[20,1],[14,1],[-6,-3],[0,-3],[-5,-2]],[[6435,1856],[-5,-2],[-8,0],[-10,0],[-10,5],[9,1],[1,0],[8,0],[8,1],[13,1],[-6,-3],[0,-3]],[[6236,1961],[-13,5],[7,2],[17,1],[15,1],[-6,-2],[-1,-1],[0,-2],[-1,-1],[-2,-1],[-7,-1],[-9,-1]],[[3913,1157],[-38,4],[-10,3],[-3,1],[-1,1],[-6,4],[-12,6],[32,-4],[35,-3],[16,-4],[-13,-8]],[[4984,1188],[-44,-7],[-16,0],[-6,4],[-12,6],[79,-3],[-1,0]],[[3328,1216],[-40,2],[-3,1],[-4,2],[4,2],[5,2],[4,4],[34,-13]],[[6498,1249],[-89,-7],[14,8],[24,1],[26,-1],[25,-1]],[[2819,1267],[-45,4],[-2,2],[25,2],[11,-3],[21,0],[6,-1],[4,-1],[-20,-3]],[[2586,1389],[1,0],[-32,3],[-6,3],[8,3],[3,2],[1,0],[25,-11]],[[2397,1520],[-3,-12],[-34,6],[0,2],[37,4]],[[7022,519],[74,-11],[19,-6],[-5,-9],[-61,7],[-26,7],[-6,6],[5,6]],[[4476,9],[89,-9],[-63,0],[-21,3],[-5,6]],[[4789,9],[-48,-2],[8,8],[27,3],[84,4],[-27,-5],[-19,-4],[-25,-4]],[[4113,42],[25,-13],[-29,2],[-5,2],[5,4],[4,5]],[[5196,81],[-119,-22],[-4,13],[29,12],[46,5],[48,-8]],[[4060,61],[-70,0],[-152,47],[-35,24],[129,8],[0,-9],[-57,-1],[-10,-4],[8,-5],[-11,-7],[70,-9],[62,-13],[45,-16],[21,-15]],[[5259,128],[-20,-24],[-59,9],[-18,10],[25,11],[78,8],[9,-4],[-5,-3],[-9,-3],[-1,-4]]],"transform":{"scale":[0.00010684662216223326,0.0007796596716671717],"translate":[72.684825066,-0.688571872999901]}};
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
