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
  Datamap.prototype.mliTopo = '__MLI__';
  Datamap.prototype.mltTopo = '__MLT__';
  Datamap.prototype.mmrTopo = '__MMR__';
  Datamap.prototype.mneTopo = '__MNE__';
  Datamap.prototype.mngTopo = '__MNG__';
  Datamap.prototype.mnpTopo = '__MNP__';
  Datamap.prototype.mozTopo = {"type":"Topology","objects":{"moz":{"type":"GeometryCollection","geometries":[{"type":"Polygon","properties":{"name":"Tete"},"id":"MZ.TE","arcs":[[0,1,2,3]]},{"type":"Polygon","properties":{"name":"Manica"},"id":"MZ.MN","arcs":[[4,5,6,7,-3]]},{"type":"Polygon","properties":{"name":"Cabo Delgado"},"id":"MZ.CD","arcs":[[8,9,10]]},{"type":"Polygon","properties":{"name":"Niassa"},"id":"MZ.NS","arcs":[[-10,11,12,13],[14],[15]]},{"type":"MultiPolygon","properties":{"name":"Nampula"},"id":"MZ.NM","arcs":[[[16]],[[17,18,-12,-9]]]},{"type":"Polygon","properties":{"name":"Gaza"},"id":"MZ.GA","arcs":[[-7,19,20,21,22]]},{"type":"Polygon","properties":{"name":"Sofala"},"id":"MZ.SO","arcs":[[23,24,25,-5,-2]]},{"type":"Polygon","properties":{"name":"Zambezia"},"id":"MZ.ZA","arcs":[[26,-24,-1,27,-13,-19]]},{"type":"MultiPolygon","properties":{"name":"Inhambane"},"id":"MZ.IN","arcs":[[[28]],[[-20,-6,-26,29]]]},{"type":"MultiPolygon","properties":{"name":"Maputo"},"id":"MZ.MP","arcs":[[[30]],[[31,32,33,-22]]]},{"type":"Polygon","properties":{"name":"Maputo"},"id":"MZ.MP","arcs":[[34,-33]]}]}},"arcs":[[[4775,5936],[3,-9],[5,-71],[5,-11],[22,-28],[7,-22],[-1,-5],[-11,-11],[-3,-4],[-1,-5],[-1,-15],[0,-3],[11,-34],[-1,-119],[-9,-25]],[[4801,5574],[-11,4],[-21,10],[-60,19],[-12,6],[-7,6],[-9,3],[-25,14],[-29,13],[-15,9],[-12,11],[-5,5],[-1,4],[0,12],[-1,3],[-12,22],[-5,5],[-15,10],[-4,4],[-8,26],[-27,43],[-10,8],[-2,3],[-4,8],[-15,16],[-4,6],[-5,0],[-2,13],[-11,23],[-18,25],[-37,40],[-23,61],[-14,18],[-7,6],[-85,45],[-22,7],[-72,12],[-70,25]],[[4121,6119],[-177,60],[-51,10],[-63,8],[-63,2],[-16,4],[-15,6],[-48,25],[-7,3],[-10,2],[-21,2],[-10,2],[-15,1],[-33,-5],[-16,2],[-7,7],[-3,8],[-5,8],[-11,3],[-16,0],[-12,3],[-23,7],[-18,10],[-29,28],[-32,25],[-27,27],[-17,13],[-2,-3],[-36,0],[-11,-1],[-42,-10],[-16,-1],[-94,5],[-32,-2],[-25,-6],[-23,-10],[-20,-12],[-31,-29],[-8,-4],[2,-14],[0,-4],[-3,-9],[1,-4],[5,-5],[1,-3],[-1,-4],[-5,-6],[-54,-43],[-3,-3],[-1,-5],[-3,-4],[-5,-2],[-11,-3],[-5,-1],[-11,-5],[-17,-12],[-2,-3],[-2,-4],[-1,-7],[1,-9],[-1,-3],[-4,-10],[0,-3],[1,-3],[-2,-5],[-4,-7],[-32,-28],[-3,-4],[-31,-57],[-5,-14],[-1,-7],[-2,-2],[-4,-4],[-8,-4],[-6,-3],[-6,-1],[-33,-4],[-5,-1],[-4,-1],[-4,-2],[-6,-5],[-3,-2],[-8,-4],[-10,-6],[-7,-5],[-12,-12],[-11,-18],[-2,-14],[-2,-5],[-4,-6],[-2,-4],[1,-7],[8,-15],[-1,-3],[-2,-5],[-35,-44],[-8,-7],[-9,-7],[-1,-4],[3,-5],[2,-4],[2,-4],[1,-4],[-7,-17],[-24,-6]],[[2631,5781],[4,4],[6,9],[-1,10],[-6,6],[-21,7],[-9,4],[-9,12],[-4,14],[0,6],[-2,22],[-12,38],[-24,35],[-40,44],[-53,59],[-1,4],[67,41],[15,12],[16,19],[27,65],[6,17],[-11,-1],[-16,-4],[-28,-11],[-16,-3],[-29,2],[-58,8],[-29,1],[-15,-2],[-13,-3],[-8,-3],[-6,1],[-25,12],[-9,24],[-1,14],[-4,9],[-11,6],[-112,28],[-149,38],[-97,24],[-74,7],[-186,-2],[-98,9],[-15,5],[-8,9],[-5,23],[-8,11],[-11,6],[-40,13],[-18,10],[-57,39],[-26,13],[-23,7],[-157,6],[-36,11],[-14,7],[-19,1],[-20,0],[-18,2],[-2,2],[1,3],[0,3],[-4,1],[-4,0],[-7,-1],[-4,0],[-6,4],[-3,6],[-4,6],[-9,4],[-18,6],[-12,8],[-18,21],[-13,11],[-16,7],[-17,4],[-96,14],[-42,2],[-23,-9],[-8,-9],[-7,0],[-7,4],[-8,1],[-14,-4],[-17,-13],[-11,-5],[-21,-6],[-16,1],[-14,7],[-15,10],[-38,17],[-42,5],[-101,0],[-154,-1],[-67,0],[-106,-1],[-1,43],[-2,73],[-1,58],[-1,49],[13,3],[2,2],[-11,18],[-5,5],[-27,18],[-2,8],[6,13],[18,22],[2,6],[-3,6],[-14,12],[-3,7],[-2,39],[-4,13],[-7,11],[-9,11],[-12,8],[-14,3],[-30,13],[-24,29],[-35,76],[-4,27],[0,27],[-7,18],[1,4],[15,3],[82,6],[70,22],[87,28],[100,23],[80,18],[131,30],[93,14],[133,19],[17,1],[98,15],[121,19],[98,15],[80,18],[88,30],[64,21],[135,28],[123,26],[95,20],[71,20],[36,7],[75,9],[88,19],[99,22],[142,30],[158,35],[162,35],[118,25],[82,18],[68,15],[52,-19],[21,-10],[11,-17],[-5,-31],[4,-11],[23,-24],[8,-6],[14,-5],[8,-2],[7,-4],[3,-4],[13,-16],[16,-14],[48,-61],[17,-15],[12,-6],[40,-11],[12,-7],[6,-7],[5,-8],[8,-8],[11,-5],[25,-8],[11,-5],[8,-8],[13,-23],[6,-10],[8,-8],[11,-6],[17,-3],[9,4],[3,11],[0,21],[8,18],[14,13],[20,4],[51,-24],[26,-2],[27,6],[55,21],[25,4],[28,0],[99,-8],[7,3],[11,15],[7,7],[30,8],[69,1],[93,21],[7,1],[15,-2],[7,1],[7,3],[7,4],[7,3],[9,1],[26,-9],[8,-7],[12,-12],[31,-39],[22,-18],[49,-30],[15,-20],[1,-20],[-12,-36],[9,-21],[15,-20],[10,-18],[6,-19],[0,-45],[2,-10],[6,-12],[8,-10],[11,-9],[6,-10],[-1,-10],[-7,-9],[-19,-17],[-6,-8],[2,-9],[6,-7],[2,-7],[-8,-7],[-2,-10],[10,-47],[9,-43],[-4,-16],[-17,-16],[-13,-6],[-12,-4],[-11,-5],[-11,-9],[-4,-8],[-5,-15],[-6,-8],[-19,-7],[-19,-19],[-17,-5],[-11,-11],[0,-20],[8,-37],[-3,-24],[-11,-20],[-58,-51],[-1,0],[-10,-4],[-19,-3],[-16,-5],[-17,-8],[-27,-18],[-10,-16],[-4,-21],[1,-22],[10,-17],[12,-6],[31,-10],[14,-5],[79,-52],[15,-13],[5,-18],[-19,-39],[-4,-21],[39,-53],[18,-12],[33,-1],[41,-3],[21,-14],[27,-42],[10,-10],[12,-7],[30,-14],[6,-5],[5,-5],[12,-19],[6,-2],[7,-2],[59,-20],[13,-8],[16,-21],[10,-8],[44,-23],[7,-8],[7,-14],[9,-9],[15,-5],[16,-5],[9,-4],[6,-3],[4,-5],[3,-11],[4,-5],[7,-2],[14,-2],[7,-1],[12,-6],[9,-6],[17,-14],[28,-14],[26,-3],[28,2],[31,-1],[22,-9],[8,-19],[1,-22],[-3,-20],[-11,-17],[-21,-9],[-24,-7],[-20,-11],[-7,-19],[30,-29],[-3,-16],[15,-9],[49,-5],[95,-2],[54,4]],[[4121,6119],[-57,-41],[-17,-25],[-11,-11],[-11,-7],[-19,-10],[-6,-3],[-69,-20],[-47,-7],[-8,-2],[-28,-10],[-15,-7],[-6,-4],[-56,-72],[-2,-5],[-1,-4],[0,-4],[3,-35],[-3,-11],[-7,-13],[-17,-23],[-13,-26],[-7,-31],[0,-32],[-4,-8],[-38,-57],[-2,-7],[1,-9],[28,-65],[1,-8],[-12,-59],[-1,-8],[3,-7],[9,-5],[77,-18],[6,-3],[3,-2],[3,-3],[12,-9],[4,-2],[8,-3],[3,-4],[2,-7],[-5,-26],[0,-2],[6,-8],[0,-17],[-4,-25],[-23,-53],[-12,-19],[-15,-10],[-40,4],[-12,-1],[-11,-6],[-28,-24],[-2,-1],[-2,0],[-3,-1],[-7,-1],[-5,0],[-9,2],[-10,2],[-13,5],[-9,6],[-4,2],[-12,5],[-4,2],[-6,4],[-2,3],[-2,4],[-2,7],[-3,7],[-10,11],[-3,3],[-13,7],[-2,2],[-3,1],[-9,2],[-28,2],[-6,2],[-10,0],[-6,-8],[-6,-19],[-2,-4],[-3,-3],[-10,-6],[-12,-6],[-22,-7],[-16,-8],[-3,-2],[-11,-10],[-26,-17],[-1,-4],[0,-4],[2,-3],[23,-25],[4,-6],[1,-3],[1,-4],[0,-4],[-2,-7],[-10,-18],[-1,-3],[1,-3],[2,-3],[10,-1],[4,-1],[2,-3],[3,-7],[1,-3],[3,-3],[5,-6],[3,-3],[1,-4],[0,-6],[-3,-4],[-16,-13],[-5,-2],[-5,0],[-5,-1],[-6,-3],[-7,-6],[-10,-7],[-8,-4],[-5,-2],[-5,-4],[-15,-16],[-28,-17],[-14,-11],[-5,-7],[-9,-21],[-2,-8],[11,-14],[30,-1],[13,-2],[32,-13],[34,-6],[9,-5],[7,-6],[3,-7],[5,-6],[10,-5],[10,-3],[10,-1],[10,-3],[9,-5],[6,-6],[6,-14],[5,-7],[8,-6],[10,-3],[22,-2],[11,-4],[6,-6],[6,-6],[8,-6],[12,-2],[7,0],[-5,-19],[-94,-216],[-1,-153],[-2,-10],[-6,-3],[-11,-2],[-24,0],[-11,-1],[-7,-2],[-10,-4],[-3,-4],[-1,-4],[3,-6],[1,-4],[2,-3],[23,-23],[2,-8],[-1,-12],[-5,-29],[0,-12],[2,-6],[6,-1],[20,0],[6,0],[4,-2],[3,-2],[7,-8],[3,-3],[4,-2],[5,-1],[6,0],[11,0],[5,-1],[4,-2],[4,-2],[9,-6],[2,-1],[3,-1],[15,-4],[3,-1],[-4,-2],[-16,-4],[-10,-1],[-12,0],[-2,0],[-1,-1],[-6,-4],[-3,-2],[-23,-8],[-4,-3],[-4,-4],[-8,-9],[-3,-2],[-3,-2],[-8,-4],[-31,-7],[-7,-2],[-5,-3],[-11,-6],[-1,0],[-3,-2],[-7,-1],[-23,-3],[-13,-3],[-1,-1],[-2,0],[-24,-26],[-3,-2],[-4,1],[-11,0],[-4,0],[-2,1],[-1,1],[-18,12],[-8,4],[-4,1],[-9,2],[-4,2],[-3,3],[-4,11],[-3,2],[-3,2],[-4,1],[-5,0],[-5,-1],[-22,-8],[-5,-1],[-6,-1],[-18,1],[-6,-1],[-11,-2],[-5,-1],[-4,-2],[-9,-7],[-5,-1],[-9,-3],[-11,-2],[-5,-1],[-4,-2],[-4,-2],[-10,-5],[-4,-5],[-87,-44],[-4,-3],[0,-4],[23,-51],[3,-3],[4,-2],[24,-5],[8,-4],[3,-3],[2,-3],[1,-3],[2,-12],[2,-8],[3,-2],[12,-10],[5,-6],[2,-3],[1,-5],[-1,-3],[-19,-31],[-3,-8],[0,-6],[2,-4],[0,-6],[-1,-7],[1,-8],[3,-8],[236,-151],[13,-4],[112,-25],[10,-5],[4,-7],[2,-8],[4,-125],[3,-7],[7,-2],[12,-2],[76,-4],[10,-1],[94,-45],[7,-4],[4,-4],[3,-7],[0,-4],[-1,-4],[-5,-9],[-3,-2],[-3,-3],[-3,-2],[-8,-3],[-19,-6],[-10,-3],[-5,-2],[-5,-4],[-6,-6],[-1,-6],[0,-5],[2,-7],[0,-5],[-2,-3],[-3,-2],[-15,-5],[-4,-3],[-5,-8],[-2,-8],[-5,-43]],[[3575,3385],[-47,-3],[-16,-6],[-20,-13],[-26,-22],[-3,-5],[-3,-6],[-3,-4],[-7,-2],[-3,-2],[-10,-2],[-11,-2],[-5,4],[-8,9],[-20,4],[-24,-1],[-53,-5],[-163,4],[-37,-2],[-33,-7],[-64,-31],[-20,-8],[-39,-5],[-35,-11],[-19,-3],[-23,0],[-3,1]],[[2880,3267],[-34,8],[-21,3],[-17,-2],[-57,-15],[-17,-7],[-19,-11],[-15,-11],[-6,-11],[-8,-10],[-18,3],[-18,9],[-8,4],[-22,1],[-14,0],[-7,5],[-3,18],[-6,9],[-15,8],[-17,7],[-13,3],[-14,0],[-54,-4],[-18,1],[-16,2],[-14,4],[-106,50],[-36,10],[-19,1],[-61,-1],[-15,3],[-53,21],[-40,21]],[[2099,3386],[-1,3],[-69,71],[1,3],[4,3],[3,4],[0,4],[-2,1],[-4,0],[-5,0],[-8,8],[-14,5],[-5,5],[73,57],[47,37],[22,27],[6,23],[-13,63],[-13,66],[1,25],[10,26],[30,24],[41,3],[44,-4],[40,5],[24,15],[31,37],[29,35],[61,46],[42,32],[7,8],[6,9],[6,18],[0,5],[-6,8],[-2,5],[2,5],[13,15],[5,9],[7,30],[8,6],[16,1],[15,3],[7,9],[5,19],[13,6],[51,-1],[-3,5],[-6,14],[4,45],[18,36],[1,26],[7,14],[3,12],[-10,6],[-21,6],[-20,8],[-16,9],[-7,11],[7,24],[-1,12],[-17,6],[-17,-4],[-28,-18],[-21,-3],[-22,1],[-17,2],[-11,7],[-3,13],[3,6],[6,6],[4,5],[-2,8],[-2,6],[0,6],[6,44],[0,11],[-6,14],[-14,2],[-17,-1],[-18,1],[-10,7],[-1,12],[6,25],[-2,18],[2,6],[35,25],[14,13],[8,10],[3,11],[1,15],[27,76],[-6,21],[-8,6],[-8,4],[-8,5],[-5,7],[-2,7],[-3,5],[-5,2],[-10,3],[-16,1],[-59,-5],[-13,0],[-10,2],[-8,5],[-2,8],[2,8],[-2,7],[-7,13],[1,8],[9,5],[12,4],[10,5],[-11,5],[-6,9],[-7,33],[2,5],[90,26],[29,3],[38,-2],[25,1],[16,8],[10,14],[7,16],[2,20],[-8,17],[-28,34],[-12,22],[-3,13],[2,10],[12,8],[16,5],[18,3],[17,5],[18,7],[21,6],[16,8],[7,12],[-4,7],[-12,8],[-1,6],[3,0],[19,18],[28,12],[4,7],[-7,12],[-17,12],[-44,22],[-15,13],[-4,9],[2,5],[5,4],[8,9],[8,13],[1,4],[-3,20],[-33,63],[-2,14],[5,12],[0,5],[-11,9],[-2,5],[5,5],[8,3],[7,4],[4,8],[-2,11],[-11,17],[-2,12],[3,12],[6,13],[10,10],[16,4],[24,10],[4,23],[-3,26],[4,24],[15,22],[4,12],[-4,13],[-13,11],[-35,10],[-17,8],[-4,5],[-10,20],[0,7],[6,4],[8,3],[6,5],[37,45],[14,13]],[[9697,8144],[-20,-7],[-26,1],[-22,7],[-9,13],[-7,13],[-16,6],[-44,0],[-36,-4],[-78,-16],[-38,3],[-13,5],[-9,6],[-12,4],[-35,4],[-5,2],[-5,1],[-12,-5],[-23,-16],[-9,-5],[-39,-8],[-18,-5],[-12,-17],[-13,-6],[-27,-10],[-26,-15],[-53,-41],[-31,-11],[-11,0],[-30,4],[-39,0],[-20,-3],[-54,-26],[-18,-4],[-18,-2],[-38,-2],[-10,-2],[-7,-3],[-6,-5],[-7,-3],[-9,-1],[-30,-3],[-14,-4],[-17,-5],[-14,-7],[-6,-7],[-7,-11],[-17,-10],[-21,-9],[-19,-5],[-36,-5],[-8,-2],[-10,-8],[-7,-2],[-20,-2],[-21,-6],[-33,-13],[-33,-18],[-22,-6],[-35,9],[-24,1],[-41,-3],[-21,-5],[-18,-8],[-13,-12],[-5,-14],[-10,-4],[-56,-7],[-40,-18],[-30,-7],[-52,-25],[-17,-3],[-64,-6],[-13,-2],[-32,-12],[-22,-2],[-118,-2],[-37,6],[-35,9],[-29,3],[-29,-3]],[[7716,7768],[-56,31],[-13,10],[-3,7],[-4,6],[-56,52],[-6,12],[-4,4],[-8,6],[-3,4],[-1,4],[0,4],[-1,3],[-1,3],[-12,17],[-5,4],[-5,4],[-13,8],[-5,4],[-29,48],[-2,3],[-4,9],[-1,3],[-1,4],[2,8],[-1,6],[-2,6],[-6,12],[-5,7],[-13,14],[-14,12],[-3,4],[-2,4],[0,4],[7,23],[0,5],[-1,6],[-6,7],[-6,10],[-6,15],[-4,4],[-5,2],[-5,0],[-5,-1],[-5,-1],[-4,-2],[-4,-1],[-5,-1],[-6,0],[-8,4],[-4,3],[-3,5],[-7,26],[0,4],[1,3],[1,3],[2,1],[1,2],[16,11],[19,9],[18,10],[12,5],[7,4],[16,11],[3,2],[2,3],[3,7],[2,3],[3,3],[3,2],[10,6],[2,3],[6,9],[3,3],[6,5],[2,3],[0,3],[0,7],[0,3],[2,3],[5,5],[1,3],[0,7],[1,3],[2,3],[9,7],[2,3],[1,5],[-1,17],[-3,4],[-4,2],[-11,1],[-11,-1],[-5,-1],[-4,-1],[-34,-14],[-4,-1],[-3,0],[-10,2],[-12,2],[-10,2],[-5,1],[-4,2],[-7,4],[-6,5],[-3,2],[-4,2],[-4,1],[-21,5],[-48,5],[-6,2],[-6,4],[0,3],[1,3],[21,17],[5,6],[1,3],[1,5],[1,11],[2,5],[1,5],[1,7],[-2,20],[0,6],[3,7],[1,4],[0,5],[-1,6],[0,5],[3,15],[-1,12],[1,6],[2,5],[6,4],[3,3],[2,3],[1,4],[0,4],[-2,18],[0,4],[2,3],[11,14],[1,4],[-2,28],[-2,5],[-5,6],[-2,4],[-1,4],[10,30],[3,6],[3,11],[1,10],[-1,5],[-2,5],[-5,6],[-9,12],[0,5],[2,3],[4,2],[13,4],[16,7],[6,5],[6,5],[5,5],[6,5],[26,17],[18,14],[10,6],[17,6],[4,3],[4,6],[7,38],[4,10],[14,21],[5,11],[2,4],[4,2],[9,3],[4,2],[12,7],[11,10],[3,2],[4,1],[4,2],[18,5],[12,4],[34,18],[3,6],[2,9],[3,21],[2,9],[4,6],[3,1],[20,5],[4,2],[3,3],[9,14],[4,14],[2,3],[3,2],[11,5],[13,8],[2,3],[2,2],[4,17],[1,3],[2,3],[3,6],[7,31],[0,9],[-1,7],[-4,5],[-11,10],[-8,6],[-9,11],[-3,2],[-4,6],[-6,14],[0,6],[5,43],[7,18],[3,12],[2,7],[2,4],[5,5],[2,3],[3,5],[3,13],[11,17],[5,17],[2,3],[2,3],[2,2],[35,31],[1,1]],[[7784,9423],[23,18],[93,41],[21,17],[15,8],[28,5],[19,5],[10,2],[12,-1],[20,-3],[10,0],[18,5],[37,23],[13,5],[19,3],[17,8],[25,14],[32,4],[123,0],[32,4],[29,9],[22,-3],[39,-13],[19,-5],[25,0],[24,4],[22,8],[184,95],[15,5],[16,3],[73,4],[157,22],[24,6],[94,42],[97,26],[18,6],[118,59],[26,6],[11,7],[18,15],[55,35],[36,17],[61,14],[34,16],[30,19],[14,17],[16,4],[15,-2],[6,-6],[-10,-8],[18,-3],[25,14],[15,-7],[5,-13],[-10,-10],[-14,-8],[-7,-7],[7,-9],[17,-4],[20,-3],[14,-5],[7,-9],[2,-21],[7,-9],[13,-5],[37,-3],[15,-5],[8,-10],[-14,-3],[-36,3],[-31,-6],[-79,-40],[6,-21],[8,3],[5,4],[4,4],[3,6],[18,-10],[66,-21],[17,-13],[-18,-11],[-51,-16],[-17,-10],[-19,-16],[-12,-17],[10,-23],[-8,-21],[8,-6],[11,2],[12,15],[9,4],[24,-6],[0,-18],[-13,-19],[-15,-13],[-30,-20],[-5,-7],[-1,-8],[7,-15],[1,-6],[-12,-11],[-62,-29],[-7,-8],[-14,-21],[-8,-7],[-12,-2],[-22,0],[-11,-1],[9,-10],[8,-11],[8,-5],[7,13],[14,-6],[15,-8],[13,-10],[8,-9],[28,4],[5,-19],[-6,-21],[-7,-23],[-10,-19],[-7,-9],[-11,-8],[-4,-9],[11,-10],[14,-9],[7,-7],[-5,-7],[-22,-15],[-1,-5],[10,-9],[3,-8],[2,-19],[5,-12],[17,-11],[3,-3],[1,-4],[2,-30],[6,-10],[11,-10],[9,3],[5,1],[13,-4],[-26,-16],[-6,-18],[6,-18],[13,-18],[28,-26],[0,-6],[-14,-9],[-6,-7],[-2,-19],[-11,-30],[-2,-8],[4,-11],[17,-17],[5,-10],[-2,-10],[-7,-12],[-11,-11],[-13,-4],[-13,2],[-13,4],[-10,-2],[-2,-13],[23,4],[21,-10],[15,-16],[6,-16],[-3,-8],[-6,-7],[-4,-8],[3,-10],[8,-5],[13,-1],[27,2],[-3,-6],[-5,-6],[-8,-3],[-21,-4],[-6,-5],[-8,-13],[-25,-22],[-2,-11],[13,-9],[10,-3],[12,-1],[39,-1],[5,-3],[-1,-42],[4,-9],[8,-4],[11,-2],[27,-8],[5,-5],[-6,-8],[-10,-1],[-16,12],[-10,0],[-6,-6],[0,-8],[9,-27],[8,0],[10,3],[11,0],[7,-6],[8,-16],[4,-3],[12,-3],[5,-5],[0,-6],[-4,-7],[-15,-10],[-20,-3],[-20,4],[-15,9],[-1,-5],[2,-6],[2,-5],[3,-1],[-14,-5],[-26,1],[-5,-5],[6,-5],[12,-4],[8,-8],[-4,-11],[-10,-17],[-6,-5],[-8,-5],[-3,0],[-2,2],[-6,3],[1,6],[-4,4],[-10,3],[-8,0],[-6,-1],[-27,-9],[-19,-8],[-16,-10],[-7,-10],[2,-11],[4,-7],[48,-27],[14,-3],[15,3],[12,11],[-5,8],[-10,9],[-4,9],[8,5],[14,0],[16,-2],[11,-5],[13,-2],[16,3],[14,0],[5,-11],[-5,-20],[-22,-35],[-5,-20],[2,-11],[9,-21],[2,-10],[-6,-46],[-6,-12],[-12,-7],[-13,-6],[-8,-9],[3,-7],[12,3],[24,12],[0,-50],[4,1],[11,2],[4,1],[-4,-14],[-28,-19],[-7,-10],[-2,-27],[-6,-12],[-11,-9]],[[7716,7768],[-29,-9],[-36,-6],[-82,-6],[-37,-13],[-32,-21],[-19,-9],[-159,-19],[-9,-3],[-6,-6],[-14,-8],[-17,-7],[-15,-2],[-34,11],[-19,19],[-22,16],[-41,0],[-17,-7],[-24,-19],[-13,-3],[-74,4],[-19,-1],[-20,-5],[-12,-9],[9,-13],[0,-11],[-15,-15],[-22,-14],[-18,-8],[-74,0],[-14,-4],[-36,-24],[-34,-30],[-27,-18],[-33,-18],[-96,-33],[-18,-2],[-6,1],[-18,6],[-11,1],[-12,-1],[-5,-2],[-3,-2],[-62,-32],[-18,-5],[-11,-1],[-8,-3],[-16,-8],[-10,-3],[-20,-3],[-9,-3],[-12,-6],[-28,-19],[-5,-6],[-6,-4],[-50,-13],[-25,-21],[-15,-18],[-4,-7],[-9,-11],[-42,-28],[-7,-7],[-2,-5],[-12,-12],[-49,-30]],[[6113,7233],[1,-26],[-4,-9],[-38,-38],[-7,-4],[-7,-2],[-6,-3],[-4,-5],[-5,-8],[-4,-4],[-13,-7],[-52,-36],[-30,-12],[-5,-1],[-5,-1],[-12,0],[-5,-1],[-7,-1],[-33,-15],[-5,-2],[-11,-1],[-6,-1],[-16,-5],[-5,-2],[-5,0],[-6,0],[-16,3],[-6,0],[-7,-1],[-4,-3],[-3,-2],[-26,-32],[-21,-17],[-2,-3],[-1,-3],[-1,-3],[1,-3],[1,-4],[1,-7],[-1,-12],[-3,-6],[-5,-6],[-12,-11],[-8,-4],[-7,-2],[-5,1],[-10,3],[-8,4],[-5,1],[-5,1],[-5,1],[-5,1],[-5,2],[-10,6],[-5,2],[-6,1],[-8,1],[-314,-2],[-24,0]],[[5288,6955],[3,26],[-27,68],[-22,57],[-4,10],[0,14],[6,15],[45,68],[26,38],[36,53],[-21,0],[-12,1],[-6,5],[-10,128],[-5,10],[-11,9],[-46,29],[-34,28],[-34,27],[-99,79],[-81,65],[-63,76],[-81,61],[-86,65],[-101,77],[-82,61],[-82,48],[-96,56],[-29,11],[-32,8],[-32,3],[-120,-2],[-16,2],[-10,4],[-2,2],[-2,4],[-4,7],[-19,21],[-11,10],[-16,10],[-3,2],[-1,1],[-31,44],[-3,50],[7,52],[-11,61],[-13,73],[-16,85],[-12,69],[-52,117],[-55,124],[-24,53],[-1,3],[4,28],[20,31],[102,97],[71,69],[38,60],[7,24],[2,25],[-6,26],[0,11],[9,8],[32,5],[295,-2],[392,-2],[40,0],[1,-3],[6,-4],[9,-2],[23,0],[4,0],[13,3],[0,1],[6,1],[4,1],[4,0],[9,-4],[5,-5],[2,-4],[4,-3],[11,-3],[1,11],[11,0],[15,-4],[15,-2],[22,8],[1,0],[51,8],[9,4],[7,13],[8,8],[10,8],[12,5],[-8,13],[18,7],[47,5],[17,9],[29,23],[12,6],[39,-5],[26,-7],[6,-1],[36,0],[12,-4],[17,-12],[-9,-14],[8,-11],[18,-6],[18,3],[13,1],[20,-6],[34,-13],[10,-3],[20,-3],[9,-3],[8,-4],[6,-4],[7,-3],[8,-1],[16,-5],[5,-11],[2,-14],[6,-12],[-6,-9],[3,-13],[9,-11],[10,-5],[39,4],[11,-1],[15,-6],[10,-1],[13,1],[35,6],[29,3],[7,3],[5,2],[4,2],[110,0],[7,-4],[6,-14],[6,-3],[5,-1],[24,-8],[16,-1],[59,6],[14,3],[25,2],[7,3],[5,4],[9,4],[35,9],[11,3],[8,6],[26,24],[43,32],[16,4],[9,-3],[18,-1],[23,-10],[14,-2],[87,5],[9,3],[9,4],[14,6],[12,-19],[25,-21],[33,-17],[33,-11],[80,-11],[41,-3],[34,2],[9,3],[7,3],[7,2],[9,1],[11,-4],[17,-11],[8,-2],[46,-9],[22,0],[17,2],[7,2],[8,5],[5,6],[5,8],[8,8],[11,3],[20,3],[34,11],[20,3],[30,0],[20,2],[17,6],[42,22],[69,19],[19,9],[12,7],[8,8],[-2,7],[-6,8],[-4,8],[5,14],[23,25],[-1,11],[8,8],[15,27],[2,9],[7,5],[59,22],[15,2],[39,2],[8,1],[9,6],[54,6],[21,0],[7,0],[0,1],[3,1],[5,2],[6,0],[1,-2],[5,-5],[3,-1],[9,-2],[19,-9],[11,-2],[11,1],[21,6],[9,1],[43,-4],[34,-15],[52,-35],[33,-11],[75,-12],[27,-10],[1,0]],[[4089,9079],[-1,-1],[-19,-10],[3,-10],[25,-18],[12,-11],[11,-8],[15,0],[19,12],[9,21],[-13,19],[-27,10],[-34,-4]],[[4208,8989],[21,2],[20,8],[15,11],[10,15],[3,15],[-8,13],[-15,6],[-21,5],[-20,1],[-13,-6],[-17,-26],[-6,-14],[0,-13],[12,-13],[19,-4]],[[9111,6375],[-24,-4],[-20,4],[-23,12],[-14,21],[4,23],[10,11],[27,8],[46,7],[32,-2],[2,-14],[-4,-13],[-25,-16],[-8,-18],[2,-10],[-5,-9]],[[9697,8144],[17,-9],[13,-11],[15,-10],[19,-4],[1,-4],[-12,-9],[-31,-18],[-10,-12],[3,-14],[26,-35],[4,-11],[15,-72],[12,-17],[1,-7],[2,-6],[14,-9],[7,-5],[5,-6],[2,-5],[2,-15],[10,-27],[1,-12],[-4,-17],[-11,-7],[-37,-9],[11,-4],[9,-6],[5,-7],[-2,-9],[-9,-7],[-12,-2],[-27,-3],[-28,-10],[7,-11],[13,-12],[-5,-17],[13,2],[10,12],[9,0],[6,-5],[-3,-6],[-1,-6],[11,-6],[-14,-6],[-6,-2],[10,-4],[10,1],[9,3],[10,4],[0,18],[23,11],[46,13],[12,-5],[11,-9],[6,-9],[-2,-19],[4,-6],[16,-6],[-10,-9],[-5,-11],[0,-12],[2,-10],[-13,-3],[-22,-11],[-10,-3],[-13,3],[-18,11],[-14,3],[19,-67],[-17,3],[-8,-3],[1,-7],[11,-6],[-19,-12],[2,-4],[4,-3],[5,-2],[2,0],[-7,-28],[0,-9],[20,11],[14,14],[26,52],[7,4],[57,18],[12,1],[26,-6],[26,-14],[13,-18],[-10,-18],[-12,-6],[-29,-4],[-14,-3],[-13,-7],[1,-5],[10,-3],[15,0],[9,4],[9,6],[9,4],[12,-5],[5,-9],[-2,-10],[-19,-35],[1,-6],[8,-11],[3,-2],[6,-2],[6,-4],[5,-5],[1,-4],[0,-8],[2,-4],[2,-10],[-13,-36],[-2,-3],[1,-3],[5,-5],[4,-3],[0,-4],[-2,-3],[-5,-2],[-45,-12],[-7,-5],[-4,-5],[-34,-22],[-12,-8],[-16,-5],[-17,-3],[-17,-1],[-7,4],[-11,18],[-11,7],[4,-11],[1,-12],[5,-10],[16,-8],[15,-2],[45,0],[11,2],[10,-10],[10,-14],[7,-13],[-1,-10],[-14,8],[-9,0],[-9,-2],[-12,-1],[-53,8],[-8,-11],[12,-17],[35,-30],[-29,-7],[-29,-2],[-26,-7],[-19,-18],[-14,3],[-19,3],[-19,1],[-13,-3],[-5,-6],[-8,-22],[-6,-9],[33,-3],[17,-4],[14,-6],[8,18],[19,8],[24,-2],[24,-9],[13,-14],[7,-19],[-4,-17],[-20,-7],[12,-9],[-2,-8],[-36,-24],[-4,-4],[2,-9],[-3,-6],[-5,-5],[-5,-4],[-18,-10],[-5,-4],[-2,-5],[2,-10],[-4,-4],[-7,-8],[-4,-10],[3,-6],[12,1],[-6,-9],[-8,-8],[-11,-7],[-14,-5],[-13,-4],[-8,0],[-24,4],[-3,-16],[-14,-11],[-38,-17],[-14,-11],[-58,-61],[-188,-123],[-39,-14],[-6,-6],[-2,-7],[-4,-7],[-11,-3],[-9,-1],[-12,-2],[-10,-4],[-4,-6],[10,-7],[21,7],[33,21],[5,-14],[-7,-11],[-11,-9],[-6,-12],[-4,-15],[-11,-10],[-30,-17],[-39,-47],[-26,-23],[-32,-10],[-60,0],[-18,-3],[-58,-20],[-28,-15],[-2,-3],[1,-5],[7,-2],[10,-1],[1,-7],[-2,-15],[1,-8],[7,-12],[12,-11],[15,-9],[18,-5],[-42,-17],[-16,-4],[-1,4],[-5,8],[-1,5],[-9,-3],[-9,-1],[-10,-1],[-10,1],[5,-3],[9,-7],[5,-3],[-26,-6],[-9,-3],[-10,-8],[1,-1],[1,-4],[-1,-4],[-4,-5],[-16,-11],[-19,-8],[-38,-14],[-28,-14],[-38,-8],[-9,-4],[-24,-15],[-166,-54],[-142,-56],[-16,-9],[-25,-22],[-13,-6],[-17,6],[0,-3]],[[8383,6093],[-2,1],[-1,6],[2,15],[0,4],[0,3],[-3,3],[-7,7],[-3,3],[-7,9],[-23,18],[-5,6],[-2,5],[-1,3],[-9,12],[-8,7],[-9,15],[-5,5],[-5,3],[-7,3],[-26,7],[-4,2],[-5,3],[-6,6],[-2,4],[-2,5],[-1,7],[1,20],[2,4],[2,3],[2,2],[3,3],[4,1],[10,3],[10,2],[14,2],[6,1],[5,2],[3,2],[2,3],[0,4],[1,8],[-1,8],[-2,4],[0,2],[-3,13],[-5,13],[-4,6],[-5,5],[-11,10],[-3,2],[-1,3],[-6,17],[-4,8],[-2,2],[-10,9],[-7,12],[-5,6],[-11,10],[-11,9],[-5,5],[-3,7],[-9,10],[-12,22],[-1,3],[0,4],[2,7],[0,4],[-1,7],[1,4],[1,3],[10,11],[2,3],[1,4],[1,7],[-1,3],[-1,4],[-18,29],[-21,21],[-19,15],[-5,5],[-2,4],[-1,3],[0,4],[2,7],[1,4],[0,3],[-1,3],[-2,3],[-5,4],[-16,11],[-3,4],[-1,4],[1,3],[-2,4],[-3,4],[-8,5],[-4,4],[-2,4],[-4,13],[-2,3],[-2,3],[-19,17],[-6,9],[-5,5],[-7,4],[-50,21],[-3,2],[-3,2],[-12,6],[-4,2],[-3,2],[-4,6],[-4,10],[-2,2],[-6,3],[-9,3],[-46,7],[-43,12],[-13,5],[-7,4],[-2,3],[-3,10],[-5,9],[-2,3],[-6,4],[-4,2],[-8,4],[-7,1],[-23,3],[-10,2],[-14,7],[-16,6],[-4,3],[-2,3],[-3,6],[-3,3],[-5,3],[-9,3],[-9,3],[-1,1],[-3,3],[-6,4],[-11,5],[-7,4],[-3,1],[-29,10],[-5,1],[-7,-1],[-21,-4],[-11,-1],[-6,0],[-50,5],[-10,2],[-15,5],[-13,5],[-13,9],[-5,6],[-9,11],[-2,2],[-4,3],[-14,5],[-3,3],[0,3],[1,4],[1,3],[-2,3],[-4,3],[-16,5],[-11,5],[-12,3],[-10,2],[-13,6],[-10,4],[-47,12],[-13,4],[-8,4],[-2,3],[-2,3],[-3,2],[-11,6],[-3,2],[-5,5],[-5,2],[-6,2],[-34,0],[-11,-3],[-5,0],[-7,1],[-8,2],[-5,3],[-4,2],[-7,5],[-13,12],[-3,3],[-5,2],[-7,1],[-14,-1],[-7,0],[-6,-2],[-8,-3],[-8,-3],[-5,-1],[-6,-1],[-14,-1],[-6,-1],[-4,-2],[-9,-6],[-4,-2],[-25,-10],[-10,-2],[-5,0],[-7,0],[-8,2],[-11,3],[-9,6],[-5,2],[-7,1],[-11,1],[-7,1],[-6,5],[-4,8],[-4,2],[-8,3],[-16,4],[-7,3],[-5,3],[-2,2],[-10,11],[-4,2],[-6,2],[-15,6],[-8,1],[-12,0],[-6,-1],[-5,-1],[-13,-7],[-6,-4],[-19,-19],[-6,-5],[-3,-2],[-4,-1],[-5,-2],[-5,-1],[-17,-1],[-4,-1],[-22,-8],[-4,-1],[-5,1],[-6,4],[-3,4],[-5,6],[-3,2],[-31,9],[-7,4],[-4,3],[-19,33],[-5,6],[-6,4],[-3,2],[-2,3],[-3,7],[-1,3],[-3,3],[-5,4],[-13,9],[-14,8],[-16,8],[-6,4],[-470,5]],[[2880,3267],[-5,-13],[-5,-6],[-4,-6],[-28,-21],[-15,-15],[-6,-5],[-7,-5],[-14,-8],[-20,-13],[-7,-8],[-3,-2],[-5,-6],[-2,-3],[-1,-3],[-1,-4],[0,-3],[1,-4],[12,-32],[2,-7],[-1,-5],[-3,-6],[-2,-7],[0,-7],[1,-5],[4,-4],[96,-73],[64,-31],[2,-2],[1,-3],[0,-15],[2,-9],[4,-10],[30,-28],[1,-6],[1,-5],[-3,-15],[-15,-40],[1,-4],[4,-15],[1,-11],[-1,-11],[1,-8],[10,-24],[2,-12],[0,-4],[-2,-3],[-3,-2],[-5,-2],[-27,-5],[-9,-4],[-3,-2],[-2,-2],[-2,-4],[-2,-22],[0,-4],[-10,-18],[-9,-35],[0,-4],[0,-4],[3,-8],[10,-14],[56,-53],[6,-4],[5,-3],[13,-5],[4,-2],[6,-5],[11,-10],[8,-8],[18,-15],[17,-11],[28,-11],[6,-2],[8,-3],[23,-12],[17,-6],[7,-4],[7,-5],[5,-5],[6,-5],[4,-2],[21,-8],[7,-4],[13,-10],[15,-16],[33,-28],[6,-12],[3,-11],[-1,-11],[2,-4],[6,-4],[5,-3],[5,-2],[4,-2],[9,-7],[4,-2],[8,-3],[11,-8],[10,-8],[7,-3],[7,-2],[5,-1],[5,-2],[11,-7],[5,-3],[6,-4],[6,-5],[21,-24],[3,-2],[3,-2],[7,-5],[2,-3],[1,-4],[0,-9],[2,-5],[3,-6],[12,-13],[4,-5],[1,-8],[0,-17],[2,-4],[3,-4],[8,-5],[6,-3],[10,-4],[4,-2],[2,-2],[-1,-4],[-3,-3],[-4,-2],[-28,-5],[-10,0],[-5,-1],[-4,-1],[-2,-3],[-1,-4],[1,-3],[1,-5],[3,-4],[10,-11],[1,-5],[0,-3],[1,-4],[2,-3],[10,-5],[4,-3],[3,-5],[3,-8],[2,-5],[5,-4],[1,-1],[2,0],[5,-1],[5,-1],[12,0],[7,-2],[6,-4],[13,-15],[2,-4],[-3,-4],[-3,-3],[-4,-2],[-2,-3],[0,-3],[2,-4],[6,-4],[3,-4],[-2,-4],[-3,-3],[-4,-2],[-5,-1],[-4,-2],[-3,-3],[-1,-3],[-5,-5],[-3,-3],[-3,-2],[-16,-8],[-2,-2],[-2,-3],[0,-4],[3,-2],[6,-1],[5,0],[6,1],[9,3],[5,1],[5,1],[5,-1],[4,-3],[14,-16],[2,-5],[0,-4],[-3,-3],[-7,-5],[-2,-2],[-1,-7],[-1,-3],[-11,-10],[-2,-3],[-1,-15],[-2,-11],[0,-10],[-3,-6],[-1,-5],[1,-6],[4,-11],[0,-6],[-2,-4],[-1,-3],[-1,-4],[6,-41],[-2,-12],[1,-6],[-1,-4],[-2,-2],[-1,-1],[-1,-1],[-7,-9],[-3,-6],[0,-4],[0,-4],[7,-17],[1,-5],[0,-6],[1,-1],[2,0],[6,4],[7,2],[6,0],[6,-1],[5,-1],[9,-2],[5,-1],[5,-1],[9,1],[3,-1],[4,-131],[2,-9],[4,-10],[116,-119],[7,-5],[6,-2],[39,8],[40,5],[11,2],[10,3],[4,2],[8,3],[2,0],[1,1],[11,1],[6,1],[4,1],[13,5],[5,2],[7,0],[12,0],[5,1],[14,5],[6,1],[19,0],[6,1],[5,1],[24,7],[6,0],[5,0],[5,-2],[2,-2],[1,-3],[-7,-7],[-29,-17],[-7,-6],[-5,-7],[9,-9],[71,-43],[4,-4],[-5,-4],[-134,-41],[-12,-5],[-8,-5],[1,-7],[4,-9],[2,-8],[3,-9],[6,-6],[8,-7],[17,-2],[73,-1],[29,-7],[29,-30]],[[4012,1225],[-1,0],[-122,-31],[-25,-4],[-104,-26],[-53,-5],[-209,-46],[-193,-42],[-135,-43],[-113,-23],[-139,-45],[-38,-6],[0,4],[16,4],[15,6],[13,7],[8,8],[-12,-2],[-38,-11],[-9,-6],[-11,-5],[-23,-2],[-17,-4],[6,-12],[5,2],[14,3],[-14,-14],[-21,-8],[-48,-12],[-20,-8]],[[2744,904],[-2,27],[1,3],[4,10],[4,14],[0,3],[-3,12],[-1,3],[-4,6],[-8,9],[-5,3],[-7,3],[-13,4],[-16,3],[-67,5],[-4,0],[-3,6],[-1,5],[0,3],[1,2],[3,8],[1,4],[-5,18],[1,11],[-2,5],[-1,3],[-1,2],[1,3],[2,7],[-1,3],[-4,4],[-7,3],[-13,3],[-10,2],[-21,1],[-5,1],[-5,3],[-2,6],[-6,64],[1,3],[3,2],[3,2],[3,3],[3,2],[-1,4],[-3,6],[-9,11],[0,9],[1,9],[16,34],[-2,7],[-8,4],[-48,12],[-13,5],[-14,7],[-7,4],[-5,4],[-4,16],[-4,6],[-4,6],[-58,53],[-36,25],[-3,3],[-2,3],[-2,4],[-4,60],[1,9],[-1,3],[-2,3],[-3,3],[-6,3],[-5,1],[-24,5],[-11,4],[-4,2],[-5,1],[-6,1],[-7,0],[-19,-2],[-23,-5],[-6,-1],[-6,0],[-9,0],[-9,1],[-14,4],[-27,10],[-28,6],[-5,3],[-51,33],[-7,4],[-9,4],[-15,3],[-110,10],[-23,7],[-8,1],[-30,3],[-17,4],[-4,1],[-12,5],[-55,5],[-23,4],[-8,1],[-7,0],[-7,0],[-118,-34],[-15,-6]],[[1610,1576],[-53,69],[-6,26],[-6,96],[-1,10],[-5,10],[-11,8],[-61,27],[-18,10],[-13,12],[-38,54],[-36,76],[-19,22],[-90,58],[-18,22],[-5,25],[19,140],[-5,18],[-65,121],[-39,72],[-48,91],[-49,91],[-41,78],[9,10],[75,32],[61,27],[49,32],[49,34],[50,33],[49,33],[49,33],[49,33],[50,33],[49,34],[49,33],[50,33],[49,33],[49,33],[49,34],[50,33],[49,33],[49,33],[50,33],[45,31],[34,23],[36,-14],[-1,2]],[[4801,5574],[12,-5],[10,-6],[32,-24],[12,-4],[6,-6],[16,-9],[4,-5],[5,-1],[6,-9],[6,-22],[4,-10],[8,-7],[35,-12],[11,-6],[8,-7],[11,-17],[8,-7],[11,-4],[12,-3],[11,-5],[29,-17],[13,-4],[12,0],[24,4],[9,1],[14,-2],[22,-9],[30,-4],[19,-7],[34,-18],[47,-13],[18,-10],[-10,-12],[25,-16],[7,-5],[14,-17],[6,-4],[-2,-16],[19,-12],[57,-18],[41,-9],[10,-4],[12,-11],[10,-6],[21,-6],[13,-10],[10,-11],[8,-14],[5,-15],[5,-8],[6,-3],[1,-5],[13,-23],[6,-7],[4,-7],[-1,-28],[4,-9],[5,-6],[-2,-4],[-17,-2],[-18,-8],[-3,-19],[4,-20],[7,-12],[-18,-5],[4,-6],[17,-2],[23,5],[17,-15],[17,-11],[1,-4],[-17,-15],[-11,-7],[-12,-5],[-14,-2],[-1,0]],[[5566,4912],[0,2],[-9,2],[-9,0],[-5,-3],[-29,-19],[-45,-42],[-19,-9],[-31,-2],[5,12],[-3,7],[-10,0],[-11,-6],[-6,-9],[-3,-11],[-6,-11],[-11,-7],[-20,-3],[-12,6],[-8,7],[-12,3],[-9,-1],[-8,-3],[-6,-5],[-2,-6],[3,-6],[7,1],[8,3],[7,0],[-6,-10],[-136,-57],[-8,-6],[-14,-14],[-10,-5],[-12,2],[-13,-8],[-20,-23],[7,2],[5,1],[14,1],[0,-4],[-26,-9],[-25,-13],[-46,-28],[19,0],[-8,-9],[-42,-29],[-7,-3],[-10,-2],[-9,-2],[-3,-4],[-3,-6],[-5,-6],[-48,-40],[-96,-63],[-110,-54],[-90,-58],[-33,-9],[-24,-4],[-51,-33],[-28,-13],[-9,6],[-11,-4],[-25,-19],[-51,-21],[-30,7],[-8,5],[-7,9],[-5,18],[-4,8],[-7,4],[-8,3],[-40,22],[-45,10],[-10,4],[-37,35],[-8,5],[-14,4],[-7,10],[-3,11],[-6,8],[-9,4],[-15,4],[-16,3],[-14,2],[-15,-4],[-10,-17],[-11,-4],[0,-5],[14,1],[18,10],[16,2],[17,-1],[13,-4],[9,-7],[7,-19],[8,-9],[50,-45],[5,-3],[10,-2],[17,-2],[8,-2],[6,-5],[8,-9],[22,-16],[4,-5],[-4,-16],[-15,-17],[-21,-11],[-24,2],[2,-11],[9,0],[11,5],[10,2],[17,-3],[3,-5],[-7,-17],[0,-10],[7,-20],[0,-8],[-1,-5],[-2,-3],[-2,-3],[-5,-4],[-5,-5],[2,-6],[4,-5],[2,-4],[-1,-14],[1,-6],[3,-4],[8,-9],[3,-9],[4,-9],[1,-6],[-2,-5],[-8,-6],[-2,-4],[-8,-7],[-18,3],[-29,11],[-16,-3],[-13,-3],[-11,0],[-8,10],[1,-5],[0,-4],[-1,-4],[15,-10],[68,-23],[0,-4],[-8,-5],[-7,-7],[-6,-9],[-10,-20],[-4,-7],[-20,-13],[-5,-9],[22,-9],[-4,-7],[-15,-6],[-12,-3],[-12,1],[-16,6],[3,-8],[6,-9],[6,-8],[8,-6],[12,-6],[20,-2],[10,-3],[3,-4],[4,-9],[1,-10],[-5,-8],[-37,-20],[-5,-7],[33,10],[20,3],[15,-3],[2,-16],[7,-6],[14,7],[8,-13],[13,-5],[16,-4],[17,-9],[10,-7],[7,-8],[4,-10],[2,-13],[5,-5],[27,12],[12,-5],[-1,-9],[-12,-6],[-11,-7],[4,-11],[6,5],[7,4],[10,2],[11,1],[45,-2],[4,-5],[31,-16],[4,-5],[0,-9],[-1,-16],[10,3],[8,0],[6,-4],[2,-8],[-3,-4],[-13,-8],[-3,-7],[5,-10],[29,-17],[11,-8],[-6,-8],[-5,-8],[-3,-8],[1,-10],[26,14],[13,2],[19,-7],[6,-4],[2,-1],[1,-2],[4,-6],[-1,-4]],[[4606,3604],[-5,0],[-17,-1],[-19,-9],[-13,-2],[-73,-7],[-96,-25],[-10,-3],[-5,-5],[-6,-5],[-51,-21],[-15,-15],[-20,-13],[-30,-3],[-10,3],[-41,20],[-8,0],[-10,-1],[-11,-1],[-16,-3],[-45,-22],[-110,-20],[-26,-13],[-41,-40],[-27,-21],[-29,-11],[-17,0],[-15,4],[-28,15],[-23,6],[-19,-6],[-26,-19],[-22,-7],[-16,2],[-12,6],[-11,4],[-108,-6]],[[8383,6093],[0,-10],[-11,-8],[-16,-5],[-19,-4],[17,-3],[14,2],[8,0],[0,-11],[-5,-11],[-11,-10],[-14,-8],[-15,-5],[-33,-2],[-33,1],[-31,-2],[-55,-23],[-35,-7],[-148,-8],[-14,3],[-22,15],[-16,2],[21,-17],[-17,-13],[-35,-8],[-32,-4],[4,12],[-44,-28],[-15,0],[-10,4],[-7,5],[-6,1],[-8,-4],[-3,-4],[0,-6],[4,-5],[-265,-66],[-13,-5],[-21,-16],[-13,-5],[-16,0],[-17,14],[-2,41],[-13,12],[6,-12],[-11,-3],[-12,0],[-12,3],[-10,4],[13,-13],[22,-14],[11,-14],[-20,-10],[18,-8],[-21,-10],[-61,-15],[-124,-17],[-51,-17],[-122,-52],[-9,-1],[2,8],[-23,-6],[-35,-19],[-38,-16],[-32,3],[-23,-16],[-121,-44],[-25,-16],[-15,-7],[-13,-2],[-10,5],[-16,-14],[-9,-5],[-13,-1],[-26,-1],[-9,-3],[-4,-9],[-10,-9],[-24,-10],[-28,-6],[-22,4],[-4,-22],[-27,-21],[-66,-36],[-68,-71],[-28,-17],[-1,5],[-6,12],[-6,-4],[-8,8],[-9,6],[-9,4],[-13,4],[-13,7],[-3,7],[0,9],[-3,9],[-20,14],[-27,5],[-24,-3],[-13,-16],[30,12],[21,-9],[13,-21],[7,-19],[5,-23],[7,-8],[31,-5],[11,-4],[11,-5],[12,-5],[-28,-34],[-13,-11],[-25,-15],[-8,-9],[-3,-11],[-7,-7],[-18,1],[-21,5],[-18,1],[-15,-6],[-9,-9],[-15,-19],[18,4],[27,13],[13,4],[-11,-13],[-65,-49],[-38,-20],[-88,-64],[-44,-25],[-31,-5],[-7,-24],[-6,-9],[-6,3],[-20,5],[3,-12],[4,-4],[-13,1],[-17,0],[-13,-2],[1,-5],[5,-8],[-4,-7],[-17,-13],[-37,-48],[-15,-14],[2,8],[-2,5],[-5,2],[-7,-2],[-4,-5],[-3,-14],[-8,-13],[7,-1],[9,2],[-1,5],[3,-1],[7,-2],[2,-1],[2,-2],[0,-6],[12,-14],[-8,-6],[-16,-3],[-12,-4],[-18,-5],[-21,5],[-21,6],[-18,4],[-21,13],[-33,40],[-1,-19],[21,-43],[5,-22],[-13,-19],[8,-2],[6,-3],[4,-4],[1,-6],[-3,-3],[-9,1],[-13,4],[-31,-3],[-27,-5],[-33,-2],[-14,8],[-5,35],[2,5],[4,6],[0,2]],[[4775,5936],[7,7],[5,8],[2,11],[-1,12],[-8,23],[1,10],[10,11],[5,8],[-6,5],[-30,11],[-5,3],[0,4],[5,3],[5,3],[3,3],[-2,23],[2,13],[24,12],[-5,15],[-19,24],[-3,12],[-3,41],[-3,3],[-23,15],[-2,1],[-8,3],[-3,1],[-4,3],[-5,6],[-4,3],[-6,2],[-21,5],[-8,1],[-11,2],[-5,6],[-4,6],[-15,15],[-16,27],[12,5],[66,28],[13,8],[5,11],[0,24],[3,9],[2,3],[22,16],[4,7],[-12,17],[-2,6],[7,28],[17,23],[21,16],[5,4],[66,37],[17,8],[22,3],[18,-1],[19,-3],[16,-7],[7,-10],[8,-4],[12,-4],[12,-1],[6,6],[3,10],[5,3],[22,2],[90,17],[10,0],[18,-2],[8,0],[10,3],[68,30],[15,10],[8,13],[1,10],[-5,19],[0,9],[6,16],[10,23],[9,87],[6,54],[9,77],[5,48]],[[4928,3098],[-19,-1],[-7,9],[-1,12],[11,46],[30,76],[11,12],[8,-1],[5,-9],[1,-15],[-5,-44],[-34,-85]],[[4606,3604],[-4,-4],[0,-3],[11,-2],[-6,-13],[-5,-6],[-8,-6],[-10,4],[-11,1],[-8,-3],[-3,-8],[3,-4],[6,-1],[7,0],[3,-1],[1,-4],[-1,-5],[0,-17],[-7,-9],[-12,-5],[-16,-2],[-7,2],[-7,4],[-8,1],[-7,-7],[-1,-9],[5,-4],[9,-2],[14,-6],[4,-1],[3,0],[4,-3],[0,-3],[-1,-4],[-3,-2],[-2,0],[2,-7],[-1,-5],[2,-5],[10,-4],[-6,-7],[7,-3],[10,-2],[8,-4],[3,-9],[-7,-3],[-11,-1],[-11,-4],[-10,-7],[4,-3],[10,-1],[9,-6],[3,-7],[-3,-26],[24,16],[28,72],[1,-11],[-7,-39],[-9,-18],[8,-53],[30,-47],[57,-60],[14,-10],[12,-4],[29,-42],[2,-26],[-4,-53],[9,-26],[28,-38],[4,-10],[4,-39],[10,-29],[8,-50],[-28,-157],[0,-26],[5,-15],[14,-7],[16,-4],[16,-5],[18,-21],[14,-9],[6,7],[-3,27],[7,9],[22,7],[-22,23],[-13,29],[0,30],[16,23],[-4,5],[1,5],[3,4],[6,3],[11,-18],[9,-4],[13,10],[-24,25],[-9,4],[5,7],[21,18],[0,3],[-1,4],[0,4],[4,1],[4,1],[6,2],[4,2],[2,1],[5,7],[9,3],[11,-1],[7,-2],[4,-6],[0,-7],[-4,-14],[20,-103],[7,10],[4,11],[3,34],[9,14],[2,11],[7,0],[-13,-76],[0,-12],[6,-40],[-2,-13],[-46,-95],[-4,-76],[30,-133],[16,-24],[9,8],[3,3],[1,6],[16,-5],[15,0],[8,4],[-7,5],[0,4],[19,-5],[-5,-18],[-34,-42],[-21,-18],[-36,-54],[-17,-18],[-7,-10],[-2,-12],[2,-13],[9,-23],[1,-12],[-6,-26],[-55,-99],[-15,-80],[0,-52],[-2,-13],[-6,-13],[-9,-5],[-9,12],[1,12],[4,10],[-4,8],[-23,4],[-16,-3],[3,-5],[11,-4],[5,-1],[6,-14],[1,-7],[-3,-12],[-8,-24],[-2,-12],[1,-20],[-1,-8],[-4,-6],[-7,-8],[-2,-7],[0,-3],[5,-12],[1,-7],[-2,-7],[-9,-12],[-2,-7],[8,1],[44,31],[-15,21],[-2,11],[10,10],[14,1],[13,-5],[25,-13],[18,-5],[11,0],[6,5],[7,43],[-4,7],[0,5],[38,-6],[10,-7],[5,-27],[2,-5],[6,-2],[2,-3],[-54,-105],[-2,-13],[2,-8],[9,-12],[1,-7],[-3,-6],[-6,-4],[-7,-3],[-3,-3],[-5,-12],[-11,-12],[-146,-127],[-106,-69],[-3,-7],[0,-7],[-2,-7],[-5,-5],[-70,-41],[-276,-87],[-154,-44],[-156,-23],[-2,-1]],[[2596,519],[-10,-17],[-3,-4],[-8,-6],[-3,0],[-3,2],[-11,4],[-3,3],[-1,4],[-3,3],[-13,-2],[1,-2],[-7,-14],[-11,17],[22,17],[34,13],[26,7],[0,-7],[-7,-18]],[[2744,904],[-244,-101],[-26,-18],[-50,-41],[-21,-25],[-17,-39],[-13,-13],[7,-31],[-5,-5],[1,4],[-2,4],[-4,5],[-6,0],[-6,-5],[-9,-3],[-7,-4],[-4,-6],[-1,-9],[-2,-8],[-4,-8],[-6,-7],[-26,-15]],[[2299,579],[-27,15],[-73,13],[-24,-33],[-10,-19]],[[2165,555],[-15,-3],[-14,-6],[-8,-12],[4,-11],[10,-7],[9,3],[0,3],[0,20],[7,2],[14,-1],[14,-3],[8,-2],[5,-5],[6,-10],[5,-4],[9,-3],[20,-5],[10,-5],[7,-6],[8,-14],[7,-7],[8,-5],[7,-3],[5,-3],[6,-19],[17,-26],[6,-13],[16,9],[24,-3],[23,-8],[14,-6],[20,-15],[12,-14],[14,-12],[18,-9],[11,-3],[9,2],[11,4],[14,0],[-8,20],[-2,16],[5,16],[11,20],[9,28],[8,7],[11,5],[37,10],[1,-17],[-25,-98],[-10,-169],[-13,-46],[-8,-14],[-3,-7],[6,-25],[-6,-49],[-2,-6],[-11,-17],[2,-6],[8,-9],[3,-5],[-145,-3],[-132,-2],[-122,-2],[-109,-2],[-53,5],[-69,7],[-27,0],[-48,-3],[-27,3],[3,158],[-10,50],[-44,52],[-7,17],[-12,63],[5,18],[31,48],[3,16],[-6,21],[-12,23],[-5,22],[13,19],[-63,9],[-27,9],[-24,13],[-37,71],[-4,18],[6,17],[40,61],[7,7],[12,7],[9,3],[7,4],[3,8],[0,14],[-8,38],[-6,13],[-10,12],[-3,19],[1,20],[4,16],[16,30],[-2,132],[0,97],[-1,73],[-1,103],[-1,85],[8,42],[-5,47],[-24,47],[-33,42]],[[2299,579],[-18,-10],[-7,-6],[-5,-4],[-25,-12],[-8,-3],[-12,-1],[-8,2],[-19,7],[-16,3],[-16,0]]],"transform":{"scale":[0.001063521065006502,0.0016392902723272277],"translate":[30.21384525500008,-26.860271503999883]}};
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
