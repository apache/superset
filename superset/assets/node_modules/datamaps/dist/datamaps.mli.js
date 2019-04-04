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
  Datamap.prototype.mdvTopo = '__MDV__';
  Datamap.prototype.mexTopo = '__MEX__';
  Datamap.prototype.mhlTopo = '__MHL__';
  Datamap.prototype.mkdTopo = '__MKD__';
  Datamap.prototype.mliTopo = {"type":"Topology","objects":{"mli":{"type":"GeometryCollection","geometries":[{"type":"Polygon","properties":{"name":"Timbuktu"},"id":"ML.TB","arcs":[[0,1,2,3,4,5]]},{"type":"Polygon","properties":{"name":"Kidal"},"id":"ML.KD","arcs":[[6,-1,7]]},{"type":"Polygon","properties":{"name":"Gao"},"id":"ML.GA","arcs":[[8,-2,-7]]},{"type":"Polygon","properties":{"name":"Bamako"},"id":"ML.KK","arcs":[[9]]},{"type":"Polygon","properties":{"name":"Kayes"},"id":"ML.KY","arcs":[[10,11]]},{"type":"Polygon","properties":{"name":"Sikasso"},"id":"ML.SK","arcs":[[12,13,14]]},{"type":"Polygon","properties":{"name":"Mopti"},"id":"ML.MO","arcs":[[15,16,-4]]},{"type":"Polygon","properties":{"name":"Ségou"},"id":"ML.SG","arcs":[[17,-15,18,19,-5,-17]]},{"type":"Polygon","properties":{"name":"Koulikoro"},"id":"ML.KK","arcs":[[-19,-14,20,-11,21],[-10]]}]}},"arcs":[[[7434,7881],[-2,-7],[-134,-461],[-390,-347],[-276,-240],[-438,-246],[378,-340],[276,-233],[48,-73]],[[6896,5934],[-30,-720],[-114,-58],[-308,-159],[-46,-33],[38,-172],[21,-90],[-7,-33],[7,-28],[42,-3],[257,-27],[180,-19],[39,-5],[23,-3],[20,-12],[-1,-75],[-1,-56],[-14,-84],[5,-187],[2,-88],[3,-106],[24,-136],[5,-27],[10,-42],[29,-133],[13,-65],[36,-247],[0,-1]],[[7129,3325],[-133,-1],[-20,-6],[-11,-9]],[[6965,3309],[-1,0],[-268,83],[-55,56],[-49,40],[-66,36],[-116,37],[-79,-3],[-59,5],[-45,-4],[-96,-14],[-111,-46],[-73,-23],[-49,12],[-40,32],[-31,64],[-64,118],[-11,52],[-59,57],[-33,35],[-23,4],[-48,-13],[-69,-5],[-5,30],[-23,12],[-25,-20],[-53,-64],[-55,2],[-37,-27],[-9,-31],[4,-59],[-20,-19],[-45,-22],[-27,-32],[-53,11],[-70,-9],[-2,76],[-12,44],[-53,42],[-17,61],[-43,-4],[-49,-7],[-17,-12],[-46,-49],[-83,-9],[-45,-33],[-144,-51],[-96,6],[-95,9],[-54,-3],[-35,7],[-48,44],[-39,-44],[-38,-38]],[[4186,3643],[-91,-30],[-1,-1]],[[4094,3612],[0,3],[1,3],[11,66],[12,65],[11,65],[11,66],[11,63],[11,64],[12,64],[11,63],[3,20],[-1,5],[0,4],[-3,3],[-3,4],[-24,18],[-25,18],[-24,18],[-27,20],[-22,16],[-24,18],[-5,11],[-6,11],[-2,27],[-6,61],[-6,60],[-6,61],[-6,61],[-6,60],[-6,61],[-6,61],[-6,61],[-6,60],[-6,61],[-6,61],[-6,61],[-6,60],[-6,61],[-6,61],[-6,60],[-6,63],[-7,62],[-6,63],[-6,62],[-6,63],[-6,62],[-7,62],[-6,63],[-6,62],[-6,63],[-6,62],[-6,63],[-4,39],[-4,39],[-4,39],[-4,40],[-9,92],[-9,84],[-8,85],[-9,84],[-9,84],[-9,84],[-8,84],[-9,84],[-9,84],[-7,73],[-5,39],[-9,87],[-9,87],[-4,39],[-8,81],[-9,82],[-9,81],[-8,81],[-9,81],[-8,82],[-9,81],[-8,81],[-9,81],[-8,82],[-9,81],[-9,81],[-8,81],[-9,81],[-8,82],[-9,81],[-8,81],[-7,64],[-2,17],[-8,81],[-9,82],[-9,81],[-8,81],[-9,81],[-8,82],[-5,41],[-9,92],[-10,91],[-4,42],[-1,4],[-5,55],[-6,53],[-6,54],[-6,53],[-6,54],[-6,54],[-6,53],[-5,54],[-6,53],[134,0],[134,1],[134,0],[134,0],[135,0],[134,0],[134,0],[134,0],[47,-32],[46,-32],[46,-33],[46,-32],[68,-49],[48,-35],[48,-35],[49,-35],[48,-35],[48,-35],[49,-35],[48,-35],[48,-35],[48,-35],[49,-35],[48,-35],[48,-35],[49,-35],[48,-36],[48,-35],[49,-35],[52,-38],[53,-38],[52,-38],[53,-38],[52,-38],[53,-39],[52,-38],[53,-38],[52,-38],[53,-38],[52,-38],[53,-38],[52,-38],[53,-39],[52,-38],[53,-38],[52,-38],[53,-38],[52,-38],[53,-38],[52,-38],[53,-39],[52,-38],[53,-38],[52,-38],[53,-38],[52,-38],[53,-38],[52,-39],[53,-38],[52,-38],[53,-38],[52,-38],[53,-38],[52,-38],[53,-38],[8,-7]],[[9997,5274],[-330,0],[-462,0],[-575,0],[-108,-147],[-360,-86],[-384,340],[-126,146],[-180,240],[-576,167]],[[7434,7881],[44,-32],[53,-38],[52,-38],[53,-38],[52,-38],[53,-38],[52,-38],[53,-39],[52,-38],[53,-38],[52,-38],[53,-38],[71,-52],[8,-13],[11,-43],[1,-15],[-7,-74],[-14,-60],[0,-14],[1,-16],[5,-9],[8,-4],[14,-1],[13,0],[24,5],[13,0],[14,-4],[8,-7],[13,-23],[9,-13],[11,-7],[26,-9],[24,-4],[11,-4],[11,-7],[23,-4],[23,-13],[39,-31],[12,-19],[4,-24],[0,-51],[6,-10],[72,-62],[13,-7],[13,-1],[11,2],[9,-1],[10,-7],[6,-14],[2,-13],[4,-8],[14,-1],[6,4],[11,10],[8,2],[7,-1],[5,-3],[5,-4],[6,-4],[38,-14],[9,-2],[16,8],[25,24],[14,10],[13,2],[11,-3],[10,-6],[38,-32],[22,-25],[19,-29],[25,-47],[7,-7],[9,-4],[15,-3],[12,-5],[21,-13],[12,-2],[7,-1],[55,-11],[33,-2],[166,-36],[77,-36],[35,-29],[10,-5],[22,-7],[10,-5],[8,-9],[3,-9],[-12,-136],[1,-26],[8,-24],[3,-4],[3,-2],[3,-3],[3,-6],[0,-4],[-4,-13],[0,-7],[5,-12],[8,-10],[7,-11],[1,-15],[-6,-15],[-11,-9],[-13,-8],[-11,-10],[-5,-12],[-3,-26],[-3,-12],[-13,-14],[-8,-6],[-3,-6],[-5,-13],[-9,-15],[-6,-12],[1,-12],[10,-15],[11,-12],[12,-9],[13,-8],[28,-13],[36,-37],[14,-10],[6,-2],[9,-2],[16,1],[49,13],[63,13],[104,21],[45,10],[58,12],[104,21],[104,21],[0,-83],[0,-83],[0,-83],[1,-83],[0,-2],[0,-82],[0,-83],[0,-83],[1,-83],[0,-84],[0,-36]],[[9997,5274],[0,-47],[0,-83],[1,-83],[0,-84],[0,-83],[0,-83],[1,-83],[0,-43],[0,-70],[-8,-7],[-7,0],[-4,-2],[-4,-12],[-1,-12],[4,-66],[-3,-7],[-8,-14],[-2,-6],[1,-42],[0,-90],[0,-58],[1,-75],[-5,-15],[-9,-9],[-26,-14],[-14,-12],[-12,-14],[-9,-15],[-54,-143],[-3,-18],[3,-19],[7,-20],[0,-1],[1,0],[0,-1],[0,-1],[0,-4],[0,-2],[-1,-2],[-35,-38],[-9,-16],[-4,-12],[-6,-66],[-5,-26],[-7,-20],[-2,-4],[-15,-19],[-23,-14],[-48,-10],[-22,-13],[-48,-56],[-53,-35],[-6,-18],[-5,-77],[-12,2],[-3,1],[-62,12],[-114,21],[-73,13],[-23,-1],[-10,-2],[-5,-4],[-1,-6],[-1,-13],[0,-25],[-4,-8],[-30,-2],[-58,-2],[-59,-2],[-58,-2],[-59,-2],[-58,-2],[-59,-3],[-58,-2],[-59,-2],[-59,-2],[-58,-2],[-59,-2],[-58,-2],[-59,-3],[-58,-2],[-59,-2],[-58,-2],[-45,-2],[-20,-5],[-17,-11],[-41,-41],[-48,-49],[-40,-40],[-51,-51],[-15,-7],[-16,-4],[-93,-4],[-17,-7],[-18,-7],[-16,-5],[-9,0],[-94,36],[-19,-1],[-39,-15],[-19,-4],[-21,0],[-80,22],[-5,-8],[0,-16],[4,-34],[-153,58],[-81,36],[-42,10],[-38,-7],[-38,-25],[-22,-10],[-17,0],[-6,8],[-14,41],[-5,3],[-20,0]],[[2597,1617],[-19,6],[-12,4],[-5,8],[-10,7],[-6,17],[-3,25],[3,19],[8,14],[14,7],[16,2],[16,-4],[13,-9],[9,-16],[3,-17],[2,-21],[-1,-20],[-7,-15],[-21,-7]],[[1892,3605],[12,-15],[30,-26],[33,-27],[17,-18],[86,-51],[27,-32],[5,-16],[5,-53],[28,-78],[39,-30],[64,-4],[39,-9],[9,-14],[10,-44],[-3,-58],[-3,-38],[13,-24],[62,-49],[37,-30],[38,-41],[45,-11],[8,-10],[-2,-21],[-4,-16],[15,-51],[2,-12],[-18,-13],[-39,-6],[-28,-5],[-32,8],[-44,-6],[-27,-6],[-18,2],[-16,17],[-18,36],[-13,15],[-13,7],[-14,-3],[-14,-33],[-20,-31],[-24,-7],[-19,-10],[-53,0],[27,-72],[3,-14],[1,-15],[-4,-19],[-9,-1],[-11,4],[-13,-5],[-3,-10],[3,-23],[-3,-11],[-5,-6],[-2,-6],[-3,-13],[-3,-5],[-4,-2],[-2,-3],[1,-9],[4,-5],[19,-18],[6,-3],[6,-1],[5,-3],[4,-5],[3,-8],[4,-5],[5,1],[6,7],[17,-34],[12,-11],[52,-9],[15,2],[8,16],[-9,2],[1,9],[10,22],[2,16],[4,7],[12,4],[21,0],[16,-6],[12,-14],[8,-22],[1,-10],[-3,-14],[0,-10],[-1,-11],[-6,-8],[-7,-7],[-7,-8],[-9,-22],[-5,-8],[-17,-17],[-6,-10],[-2,-14],[7,-70],[2,-7],[3,-5],[6,-5],[6,-6],[4,-7],[7,-18],[18,-19],[6,-11],[4,-13],[1,-14],[-1,-13],[-7,-9],[-6,-4],[-5,-2],[-4,-3],[-4,-8],[-4,-8],[-12,-41],[-2,-14],[-2,-8],[-4,-8],[-10,-13],[-4,-7],[-3,-15],[-2,-42],[-3,-9],[-3,-7],[-3,-7],[0,-10],[5,-36],[0,-16],[-5,-20],[-27,-46],[-6,-17],[0,-17],[5,-10],[9,-9],[8,-16],[-51,-30],[-10,-9],[-15,-23],[-24,-17],[-28,-9],[-27,-5],[-23,-13],[-20,-43],[-23,-21],[-25,-21],[-25,-51],[21,-16],[-8,-9],[-3,-4]],[[1961,1524],[-72,41],[-26,10],[-46,10],[-8,0],[-4,-4],[-5,-3],[-9,3],[-8,5],[-3,1],[-4,-1],[-11,-8],[-28,-8],[-9,-12],[3,-6],[9,-12],[11,-11],[17,-10],[1,-5],[1,-6],[3,-7],[4,-2],[10,-3],[4,-3],[0,-9],[-3,-13],[-5,-10],[-8,-3],[2,-16],[-3,-8],[-14,-16],[-37,7],[-11,-2],[-25,-12],[-9,-8],[-12,-12],[-69,-25],[-19,-13],[-9,-11],[-4,-10],[-1,-12],[1,-14],[-3,-8],[-7,-12],[-15,-17],[-34,1],[-11,4],[-6,4],[-10,8],[-6,3],[-4,0],[-13,-2],[-6,0],[-11,6],[-20,18],[-11,3],[-13,3],[-21,12],[-11,4],[-8,4],[-12,10],[-7,4],[-7,2],[-10,0],[-2,1],[-4,1],[-5,4],[-8,7],[-6,3],[-4,1],[-15,-1],[-12,3],[-21,11],[-20,4],[-4,4],[-3,5],[-5,3],[-23,-10],[-3,-8],[-2,0],[-2,3],[-4,4],[-1,-2],[-3,-6],[-6,-3],[-5,-1],[-4,-2],[1,-10],[-9,3],[-4,3],[-4,3],[-8,-6],[-21,-19],[-4,-5],[-6,-10],[-29,3],[-11,-5],[-1,-6],[5,-14],[-2,-2],[-5,-3],[-1,-6],[2,-8],[0,-4],[-12,-10],[-13,-6],[-6,-8],[4,-15],[-9,-4],[-13,-7],[-11,-8],[-5,-7],[-2,-9],[-5,-12],[-7,-12],[-6,-6],[-9,-5],[-25,-1],[-18,20],[-24,51],[-16,18],[-3,7],[1,6],[6,12],[1,6],[-4,19],[-11,9],[-14,8],[-14,11],[-24,42],[-11,8],[-15,5],[-12,-1],[-26,-9],[-14,0],[-9,-2],[-4,-7],[-8,-28],[-7,-9],[-20,-16],[-3,-4],[-9,-15],[-4,-2],[-5,-1],[-5,-2],[-3,-19],[-7,-13],[-5,-6],[-4,-4],[-9,-3],[-10,-1],[-20,-9],[-12,0],[-12,5],[-12,7],[-12,9],[-10,9],[-24,36],[-11,10],[-37,18],[-12,11],[-11,27],[10,20],[17,19],[12,27],[-1,15],[-4,27],[3,15],[9,6],[15,-1],[12,2],[0,13],[1,18],[4,17],[1,16],[-8,12],[-1,-4],[-5,-8],[-1,6],[-4,11],[-1,5],[-4,11],[-4,-2],[-4,-7],[1,-5],[-5,5],[-7,13],[-5,3],[-6,3],[4,4],[13,6],[1,8],[-1,5],[-1,5],[-1,7],[3,21],[0,7],[-3,7],[-4,4],[-5,1],[-2,2],[-1,10],[4,5],[5,4],[6,17],[8,3],[8,2],[5,8],[-1,7],[-6,12],[0,3],[4,5],[1,8],[0,8],[-1,6],[-2,6],[-3,5],[-2,3],[-1,1],[-2,0],[-2,1],[-3,1],[0,4],[1,4],[2,3],[1,3],[-2,11],[3,7],[3,7],[3,6],[-2,4],[-3,3],[-3,4],[0,4],[4,3],[4,-2],[4,-2],[3,0],[5,4],[4,3],[2,4],[-1,18],[-2,7],[-2,7],[-5,6],[-2,-12],[-4,-7],[-7,-4],[-10,2],[2,7],[1,13],[0,6],[2,3],[4,3],[1,2],[-6,3],[-2,2],[-2,5],[-4,8],[-8,13],[1,4],[4,5],[0,5],[-6,2],[-10,3],[-8,5],[-7,6],[-8,6],[-11,2],[-3,11],[0,24],[-6,9],[-7,7],[-6,8],[-2,12],[3,7],[7,13],[1,7],[-2,6],[-14,14],[-15,22],[-4,13],[0,15],[-5,-2],[-7,-2],[-7,0],[-2,7],[1,10],[-3,3],[-15,-1],[-12,-3],[-6,1],[-6,5],[-3,7],[-4,5],[-9,2],[-9,-6],[-6,-11],[-4,-14],[-2,-13],[-25,-21],[-3,-4],[-4,1],[-7,6],[-3,5],[-3,13],[-3,5],[-5,4],[-16,8],[-5,2],[-1,7],[8,36],[2,12],[-5,8],[-4,2],[-6,1],[-6,4],[-4,4],[-5,10],[-4,5],[-35,27],[-11,14],[-14,23],[-7,24],[-13,26],[-8,13],[-8,8],[52,32],[20,22],[10,30],[3,28],[0,13],[-3,13],[-11,14],[-11,9],[-10,11],[-6,17],[0,28],[13,52],[5,27],[-1,15],[-23,57],[-6,9],[-8,7],[-24,9],[-8,7],[-5,8],[-5,9],[9,4],[2,8],[-4,9],[-56,23],[-8,2],[1,29],[-2,13],[-7,30],[-1,14],[3,11],[12,8],[4,4],[2,8],[1,8],[1,7],[4,7],[12,12],[4,6],[0,11],[-5,4],[-6,2],[-4,4],[-1,7],[1,5],[2,4],[4,9],[-7,0],[-10,2],[-9,5],[-5,7],[-3,9],[-12,12],[-5,20],[11,-6],[13,-2],[13,2],[26,10],[13,2],[9,-5],[26,-25],[6,-4],[5,8],[3,11],[5,4],[11,-3],[12,0],[12,3],[11,8],[14,21],[9,9],[24,5],[11,7],[9,8],[5,9],[2,6],[4,5],[3,3],[2,3],[2,1],[4,2],[4,2],[0,4],[-4,6],[-2,4],[0,4],[3,24],[3,12],[4,11],[2,12],[-2,9],[-5,8],[-7,6],[-3,0],[-4,-3],[-4,-1],[-6,4],[1,4],[2,20],[7,27],[0,7],[-1,9],[-1,7],[2,14],[11,36],[4,32],[2,11],[20,47],[10,48],[8,21],[15,18],[1,8],[0,23],[16,-3],[2,0],[17,-6],[16,-1],[17,10],[22,24],[10,7],[16,5],[7,3],[6,7],[1,3],[1,4],[-1,3],[-1,3],[-3,2],[-2,2],[-1,2],[-1,3],[1,0],[6,1],[34,-8],[15,-6],[15,-14],[56,-88],[11,-14],[154,-122],[19,-20],[17,-36],[23,-23],[19,-33],[6,11],[9,38],[5,11],[17,17],[7,11],[5,25],[5,11],[10,10],[6,3],[6,0],[5,1],[7,11],[10,6],[5,5],[4,14],[0,28],[2,13],[7,7],[9,0],[37,-6],[25,0],[12,2],[2,0],[20,8],[10,2],[12,-3],[9,2],[62,-1],[16,-4],[30,2],[8,-1],[52,-22],[5,0],[11,2],[5,0],[12,-7],[22,-15],[14,-4],[25,-1],[71,11],[70,-7],[23,6],[34,22],[12,6],[30,6],[150,7],[-7,37],[-10,43],[0,19],[9,18],[37,48],[12,8],[15,-7],[2,-22],[-9,-46],[-4,-61],[106,0],[20,0]],[[4727,1735],[-7,-1],[-4,1],[-2,-2],[-4,-35],[6,-11],[26,-22],[10,-11],[13,-32],[5,-8],[3,-3],[1,-2],[-4,-9],[-9,-13],[-11,-12],[-11,-14],[-5,-16],[22,-57],[6,-29],[-18,-4],[-5,5],[-5,8],[-6,5],[-9,-1],[-7,-4],[-1,-5],[0,-5],[-2,-11],[1,-7],[-1,-4],[-2,-3],[-54,-48],[15,-32],[-5,-8],[-19,0],[-21,-14],[-7,-13],[-1,-11],[-2,-7],[-1,-2],[-12,-6],[-6,0],[-13,1],[-6,-1],[-6,-6],[-5,-9],[-4,-8],[-4,-7],[-9,-6],[-17,-3],[-11,-4],[-12,11],[-12,1],[-26,-10],[-13,0],[-13,3],[-13,1],[-13,-6],[-5,-5],[-6,-3],[-7,-2],[-7,0],[-11,-1],[-24,1],[-9,-1],[-9,-4],[-20,-14],[-19,-6],[-9,-9],[-16,-19],[-23,-21],[-12,-19],[-5,-3],[-4,-1],[-3,2],[-4,2],[-4,3],[-4,-1],[-2,-2],[-3,-2],[-2,-1],[-21,-4],[-2,-2],[-5,-5],[-3,-1],[-3,1],[-8,6],[-3,1],[-8,-1],[-4,-1],[0,-4],[4,-7],[3,-2],[16,-10],[3,-3],[10,3],[5,-1],[7,-2],[11,-5],[10,-7],[7,-9],[5,-14],[0,-12],[-1,-14],[-5,-27],[-4,-6],[-4,-7],[-3,-8],[0,-7],[4,-8],[6,-1],[6,1],[7,-2],[21,-18],[6,-24],[0,-56],[3,-15],[1,-9],[-5,-6],[-13,-7],[-10,-9],[-2,-12],[4,-70],[-1,-11],[-8,-14],[-19,-21],[-5,-15],[-4,-28],[-6,-9],[-15,-10],[-10,-5],[-10,-3],[-61,-9],[-8,-6],[-2,-11],[1,-6],[6,-35],[-4,-17],[14,3],[8,-18],[11,-47],[7,-14],[3,-9],[-9,-39],[0,-5],[0,-7],[-4,-3],[-5,-3],[-4,-5],[-4,-10],[-5,-36],[0,-6],[3,-11],[1,-5],[9,-4],[-6,-6],[-4,-11],[-1,-11],[5,-4],[1,-7],[-8,-35],[-14,-24],[-2,-6],[-5,-34],[-4,-10],[-16,7],[-13,10],[-8,2],[-6,0],[-17,-4],[-33,-4],[-78,-19],[-44,-25],[-9,-8],[-7,-11],[-3,-12],[3,-37],[-7,-6],[-28,11],[-8,-6],[-2,-17],[-4,-14],[-7,-13],[-12,-12],[-54,-1],[-45,18],[-9,6],[-12,16],[-6,4],[-9,-2],[-2,25],[1,9],[8,9],[1,-1],[3,-2],[4,-2],[5,2],[2,3],[-1,5],[-2,4],[0,2],[15,18],[-9,8],[2,13],[9,21],[-10,12],[-2,7],[1,6],[6,12],[2,4],[-3,6],[-4,3],[-5,-1],[-7,-1],[-4,2],[-3,4],[-3,4],[-4,4],[-5,1],[-5,-2],[-3,2],[0,10],[3,5],[11,10],[4,6],[1,8],[-2,8],[-4,9],[5,6],[7,4],[6,4],[3,8],[-2,5],[-5,5],[-7,4],[-11,4],[-2,6],[3,28],[-1,9],[-6,4],[-15,-2],[-14,-7],[-11,-9],[-12,-6],[-16,1],[-12,2],[-13,-1],[-11,-5],[-4,-13],[-1,-26],[3,-9],[7,-5],[8,-4],[4,-6],[-2,-16],[-11,-9],[-15,-3],[-13,1],[-33,8],[-10,3],[-24,15],[-13,9],[-9,9],[-12,23],[-8,6],[-13,-5],[0,-2],[-8,-16],[-2,-1],[-2,-12],[-2,-13],[1,-5],[3,-5],[1,-5],[-3,-31],[-6,-22],[1,-11],[8,-13],[5,-3],[6,-2],[7,-3],[4,-5],[-1,-7],[-3,-6],[-4,-5],[-2,-5],[-3,-22],[0,-3],[-5,-8],[-14,-5],[-14,1],[-23,15],[-13,5],[-13,-2],[-36,-18],[-11,-2],[-35,5],[-13,-2],[-8,-9],[-14,-53],[1,-9],[7,-6],[8,-6],[5,-7],[2,-17],[-8,-15],[-12,-10],[-14,-5],[-15,-1],[-11,11],[-9,15],[-10,13],[-10,6],[-60,19],[-48,8],[-38,1],[-10,2],[-5,9],[-1,16],[4,27],[-4,11],[-13,1],[-17,-7],[-5,-2],[-8,1],[-1,4],[1,6],[0,8],[-11,18],[-2,7],[0,6],[0,7],[0,8],[-4,8],[-5,6],[-6,4],[-7,1],[-8,0],[-15,-20],[-5,-5],[-5,-2],[-11,0],[-6,-1],[-14,2],[-22,14],[-13,-2],[-3,-6],[-2,-8],[-3,-7],[-6,-2],[-7,1],[-5,-1],[-9,-8],[0,-4],[-2,-2],[-6,-3],[7,-10],[-7,-11],[-13,-8],[-12,-3],[8,-12],[-7,-13],[-2,-10],[-3,-5],[-4,-3],[-4,-4],[-2,-7],[-3,-5],[-14,-21],[-6,-5],[-5,-4],[-6,-2],[-16,-3],[-6,-4],[-11,-10],[-11,-6],[-13,-4],[-12,0],[-12,5],[13,32],[4,16],[-1,17],[-4,15],[-7,17],[-9,15],[-11,7],[-33,2],[-16,3],[-12,9],[-3,9],[-1,18],[-2,8],[-6,10],[-4,2],[-5,-4],[-9,-4],[-14,-3],[-14,0],[-11,7],[-15,31],[-18,28],[-7,17],[-9,134],[-3,12],[-16,6],[1,14],[13,38],[4,5],[4,6],[1,13],[-1,69],[-3,15],[-10,16],[-12,13],[-14,7],[-7,0],[-12,-7],[-6,-1],[-11,4],[-5,1],[-7,-1],[-12,-1],[-12,4],[-10,0],[-16,-36],[-6,-10],[-11,-8],[-10,-4],[-10,-1],[-11,0],[-11,2],[-12,-1],[-10,-6],[-10,-3],[-9,7],[-3,10],[3,12],[5,11],[5,9],[28,31],[6,13],[1,8],[-2,6],[1,7],[5,8],[5,2],[12,0],[6,3],[5,11],[3,24],[8,12],[4,3],[12,5],[6,4],[2,1],[6,0],[2,2],[1,5],[-1,4],[-2,3],[-1,3],[7,15],[5,5],[24,-6],[10,-2],[13,1],[11,4],[7,9],[3,18],[-6,3],[-11,-2],[-11,2],[-5,10],[7,9],[13,6],[11,3],[-14,13],[-18,9],[-37,12],[-16,1],[-8,3],[-4,10],[-3,12]],[[2257,886],[9,8],[22,32],[35,85],[21,11],[38,-1],[77,32],[31,2],[51,-14],[22,14],[44,47],[15,7],[46,37],[69,42],[65,31],[39,20],[19,17],[24,61],[15,35],[15,10],[61,33],[22,10],[9,18],[9,35],[21,9],[26,19],[24,44],[34,13],[7,-19],[10,-74],[23,-82],[1,-23],[-19,-48],[0,-37],[21,-22],[18,-9],[28,8],[12,-15],[1,-63],[31,6],[15,-6],[18,-25],[44,-12],[78,-40],[53,-1],[10,-12],[-4,-39],[27,-14],[18,2],[14,33],[9,27],[14,42],[7,28],[38,40],[-8,50],[0,32],[27,31],[30,3],[31,-13],[29,-30],[8,6],[-1,17],[-2,31],[17,9],[18,-1],[42,13],[22,-2],[22,61],[-3,59],[-18,9],[-54,-4],[-20,11],[-12,29],[-32,27],[-22,-4],[0,18],[-8,24],[-1,26],[-21,35]],[[3638,1625],[30,34],[126,21],[14,25],[6,1],[18,-13],[27,-2],[93,52],[99,59],[9,-5],[20,-50],[17,-14],[6,-37],[36,-36],[17,7],[18,43],[48,64],[17,14],[12,-4],[63,-31],[8,-26],[23,-32],[-2,-40],[20,-16],[74,13],[78,12],[23,7],[13,26],[38,53],[38,11],[10,-36],[17,1],[9,11],[53,1],[1,-1],[9,-2],[1,0]],[[6965,3309],[-7,-5],[-33,-35],[-125,-120],[-21,-15],[-24,-11],[-115,-30],[-26,-14],[-210,-147],[-42,-9],[-43,-2],[-50,4],[-29,-1],[-18,-9],[-5,-18],[-11,-165],[-2,-7],[-6,-5],[-29,-14],[-12,-6],[-9,-2],[-20,5],[-142,73],[-46,11],[-33,-9],[-49,-30],[-13,-13],[-35,-41],[-10,-13],[-89,-54],[-16,-28],[3,0],[2,-1],[1,-1],[1,-1],[-24,-88],[-11,-19],[-9,-26],[3,-36],[17,-63],[-22,-9],[-21,-9],[-4,-1],[-4,2],[-5,3],[-5,2],[-14,2],[-5,-1],[-7,-4],[-11,-13],[-7,-3],[-4,11],[-2,10],[-3,6],[-10,11],[-16,10],[-12,0],[-14,-4],[-17,2],[-27,23],[-16,6],[-12,-13],[13,-11],[4,-16],[-3,-37],[-3,-16],[-9,-25],[21,-168],[-8,-6],[-99,-6],[-14,-6],[-2,-19],[7,-23],[1,-13],[-6,-10],[-8,-2],[-7,1],[-26,4],[-13,0],[-4,1],[-6,3],[-9,11],[-4,2],[-8,-1],[-5,1],[-49,42],[-28,18],[-45,40],[-11,5],[-25,7],[-21,9],[-10,2],[-12,-1],[-12,0],[-14,4],[-7,7],[7,8],[6,3],[12,13],[5,2],[5,1],[4,2],[1,8],[-3,1],[-15,3],[-5,3],[-2,4],[-3,13],[-1,1]],[[5029,2254],[3,6],[0,4],[2,64],[-32,68],[-19,94],[-27,59],[-17,7],[-33,-10],[-69,-58],[-52,-98],[-11,-29],[-30,-4],[-46,-11],[-55,-34],[-26,20],[-14,16],[-9,4],[-31,-7],[-22,5],[-16,-4],[-35,-25],[-13,33],[-1,38],[13,57],[-16,31],[1,19],[16,16],[8,35],[-7,27],[-28,2],[-92,-17],[-45,7],[-50,22],[-4,31],[17,91],[-58,86],[-36,27],[-103,68],[-92,62],[1,18],[25,22],[5,47],[11,17],[-5,23],[-3,29],[21,54],[16,59],[26,2],[94,28],[46,-2],[39,34],[44,80],[22,36],[-34,108],[-17,77],[-11,11],[-20,5],[-66,3],[-8,36]],[[5029,2254],[-3,5],[-2,2],[-2,1],[-2,-1],[-2,-2],[-9,-11],[4,-2],[8,-1],[4,-4],[-3,-6],[-8,-8],[-9,-6],[-7,-3],[-7,-2],[-9,-12],[-6,-4],[-16,-4],[-5,-3],[-10,-10],[-6,-13],[-11,-27],[-9,-16],[-11,-15],[-7,-4],[-6,1],[-6,1],[-5,-1],[-10,-7],[-11,-11],[-8,-12],[-3,-10],[4,-6],[13,-8],[1,-6],[-4,-6],[-7,-2],[-39,2],[-10,-4],[-8,-23],[-3,-5],[-4,-6],[0,-9],[4,-6],[17,-17],[17,-39],[7,-11],[18,-17],[11,-15],[5,-19],[-2,-38],[8,-31],[-1,-8],[-13,-43],[-6,-9],[-1,0],[-7,-6],[-11,-4],[-13,-2],[-8,3],[-18,11],[-17,4],[-20,-1],[-21,-6],[-17,-7]],[[3638,1625],[-30,16],[-26,9],[-13,44],[-9,29],[-20,-2],[-28,-11],[-11,8],[-15,50],[-42,16],[-27,12],[-43,-6],[-68,-11],[-26,-13],[-18,1],[-8,15],[7,43],[-2,38],[-13,14],[-30,0],[-37,11],[-30,37],[-8,11],[7,23],[22,25],[7,39],[0,25],[20,41],[11,39],[27,27],[36,12],[56,4],[19,12],[16,46],[-7,12],[-22,17],[-7,20],[-4,67],[-36,45],[-35,39],[-9,45],[9,123],[90,179],[22,40],[47,66],[12,32],[21,7],[75,-23],[18,13],[13,25],[16,23],[0,44],[-13,40],[-20,81],[-30,44],[-36,66],[10,36],[56,79],[19,35],[41,140],[10,80]],[[3602,3604],[60,0],[81,0],[47,0],[44,0],[41,0],[38,0],[81,0],[95,0],[1,0],[1,0],[0,-1],[1,0],[0,1],[0,1],[1,3],[1,4]],[[2257,886],[-3,14],[-3,9],[-15,-14],[-17,2],[-33,16],[-7,10],[-6,12],[-5,14],[-2,12],[-14,49],[-8,6],[-9,-2],[-9,-5],[-13,-2],[-11,4],[-10,7],[-10,5],[-11,-1],[30,172],[0,8],[-4,6],[-4,7],[-3,7],[-1,14],[1,13],[-3,11],[-11,11],[-12,2],[-14,-1],[-14,0],[-11,10],[-2,13],[2,15],[9,26],[1,15],[-5,15],[-8,12],[-9,6],[-12,-6],[-7,0],[-4,8],[-3,7],[-5,10],[-2,7],[1,18],[6,14],[8,13],[5,15],[-1,15],[-6,15],[-11,13],[-21,11]],[[1892,3605],[75,0],[9,0],[56,0],[41,0],[45,0],[48,0],[52,0],[81,0],[87,0],[92,0],[95,0],[99,0],[102,-1],[103,0],[104,0],[103,0],[103,0],[102,0],[99,0],[95,0],[92,0],[27,0]]],"transform":{"scale":[0.0016501418208820899,0.0014856496228622855],"translate":[-12.2641304119999,10.14005401700011]}};
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
