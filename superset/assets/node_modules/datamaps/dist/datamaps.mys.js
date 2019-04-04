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
  Datamap.prototype.mozTopo = '__MOZ__';
  Datamap.prototype.mrtTopo = '__MRT__';
  Datamap.prototype.msrTopo = '__MSR__';
  Datamap.prototype.musTopo = '__MUS__';
  Datamap.prototype.mwiTopo = '__MWI__';
  Datamap.prototype.mysTopo = {"type":"Topology","objects":{"mys":{"type":"GeometryCollection","geometries":[{"type":"MultiPolygon","properties":{"name":null},"id":"-99","arcs":[[[0]],[[1]],[[2]],[[3]],[[4]],[[5]],[[6]],[[7]],[[8]],[[9]],[[10]],[[11]],[[12]],[[13]],[[14]],[[15]],[[16]],[[17]]]},{"type":"Polygon","properties":{"name":"Perak"},"id":"MY.PK","arcs":[[18,19,20,21,22,23,24]]},{"type":"MultiPolygon","properties":{"name":"Pulau Pinang"},"id":"MY.PG","arcs":[[[25]],[[-23,26,27]]]},{"type":"Polygon","properties":{"name":"Kedah"},"id":"MY.KH","arcs":[[-24,-28,28,29,30]]},{"type":"MultiPolygon","properties":{"name":"Perlis"},"id":"MY.PL","arcs":[[[31]],[[32]],[[-30,33]]]},{"type":"MultiPolygon","properties":{"name":"Johor"},"id":"MY.JH","arcs":[[[34,35,36,37]],[[38]]]},{"type":"Polygon","properties":{"name":"Kelantan"},"id":"MY.KN","arcs":[[39,40,-19,41]]},{"type":"Polygon","properties":{"name":"Melaka"},"id":"MY.ME","arcs":[[-36,42,43]]},{"type":"Polygon","properties":{"name":"Negeri Sembilan"},"id":"MY.NS","arcs":[[-37,-44,44,45,46]]},{"type":"Polygon","properties":{"name":"Pahang"},"id":"MY.PH","arcs":[[47,48,-38,-47,49,-20,-41]]},{"type":"MultiPolygon","properties":{"name":"Selangor"},"id":"MY.SL","arcs":[[[50]],[[51]],[[-50,-46,52,-21],[53],[54]]]},{"type":"Polygon","properties":{"name":"Trengganu"},"id":"MY.TE","arcs":[[-48,-40,55]]},{"type":"MultiPolygon","properties":{"name":"Sabah"},"id":"MY.SA","arcs":[[[56]],[[57]],[[58]],[[59]],[[60]],[[61,62]],[[63]],[[64]]]},{"type":"MultiPolygon","properties":{"name":"Sarawak"},"id":"MY.SK","arcs":[[[65]],[[66,-62]]]},{"type":"Polygon","properties":{"name":"Kuala Lumpur"},"id":"MY.KL","arcs":[[-54]]},{"type":"Polygon","properties":{"name":"Putrajaya"},"id":"MY.PJ","arcs":[[-55]]},{"type":"Polygon","properties":{"name":"Labuan"},"id":"MY.LA","arcs":[[67]]}]}},"arcs":[[[1925,704],[-1,0],[-2,7],[-2,34],[5,11],[6,-26],[-2,-14],[-4,-12]],[[2276,2262],[8,-5],[6,-17],[-2,-24],[-3,-9],[-8,4],[-6,15],[-5,18],[1,8],[-2,5],[2,4],[3,-2],[4,2],[2,1]],[[2493,2441],[-7,-11],[-5,16],[-2,11],[-4,7],[0,8],[-1,11],[4,13],[6,4],[2,-5],[2,-14],[6,-9],[-1,-31]],[[2396,2659],[-6,-17],[-5,10],[-4,16],[-4,9],[0,15],[5,4],[5,-6],[3,-5],[0,-6],[3,-10],[3,-10]],[[2179,2842],[0,-19],[-2,-9],[-3,11],[-1,-1],[0,-8],[0,-2],[-4,24],[2,17],[5,-6],[3,-7]],[[820,3168],[-6,-7],[-5,9],[0,26],[-1,12],[3,28],[7,21],[4,-5],[-2,-84]],[[476,5145],[-2,-5],[-5,8],[-8,29],[-2,4],[-2,8],[0,7],[2,16],[-3,13],[1,11],[-3,18],[2,3],[4,-3],[2,-7],[1,-10],[1,-4],[4,-1],[3,-4],[2,-21],[2,-34],[1,-6],[0,-22]],[[9731,5812],[4,-3],[2,3],[4,-9],[2,-12],[2,-8],[-6,3],[-5,7],[-5,10],[-2,-6],[-5,-15],[-6,-15],[1,27],[7,15],[4,3],[1,4],[2,-4]],[[9522,6351],[1,-4],[3,6],[2,2],[1,0],[1,-6],[3,-1],[7,2],[2,-5],[-4,-9],[-25,-34],[-4,-1],[-1,-2],[-4,3],[-2,10],[1,13],[2,7],[1,6],[2,3],[1,-6],[-1,-7],[0,-4],[7,7],[-3,9],[-1,6],[0,7],[2,8],[4,5],[5,-3],[1,-6],[-1,-6]],[[9921,7054],[-5,-4],[-6,18],[9,18],[9,2],[8,-9],[1,-3],[-4,-6],[-6,-9],[-6,-7]],[[9331,7584],[0,-1],[1,2],[1,4],[4,6],[1,-7],[1,5],[3,-6],[-2,-9],[-1,-4],[2,3],[1,6],[1,5],[2,1],[0,-3],[1,-10],[0,-5],[1,-4],[1,3],[-1,4],[0,6],[2,-3],[3,2],[2,-3],[0,-6],[0,1],[3,0],[2,-2],[-2,-21],[-5,-12],[-2,-13],[-17,3],[-5,25],[-4,26],[-9,2],[-9,6],[-1,8],[6,0],[6,2],[3,3],[3,0],[12,-1],[-3,-7],[-1,-6]],[[1719,7600],[3,-7],[4,3],[2,-2],[2,-6],[-2,-24],[-2,-9],[-5,-9],[-5,-6],[-7,6],[-3,39],[1,42],[5,9],[6,-14],[1,-22]],[[1593,7771],[1,-12],[-2,-15],[-3,1],[-6,15],[-4,-21],[-3,21],[1,15],[2,9],[5,2],[1,12],[5,-3],[3,-18],[0,-6]],[[9199,7918],[1,-1],[1,0],[3,-9],[1,-10],[-1,-12],[-4,-12],[-1,-3],[-5,-19],[-5,-5],[-4,-23],[-7,5],[1,13],[10,16],[1,25],[-1,11],[1,10],[0,6],[-3,9],[0,7],[4,2],[4,6],[2,3],[0,-5],[1,-12],[1,-2]],[[9358,8090],[-4,-4],[-3,6],[3,5],[5,12],[2,-12],[-3,-7]],[[9374,8149],[-1,-4],[0,1],[1,3]],[[9403,8173],[0,-1],[0,-3],[0,-1],[0,1],[-1,0],[0,2],[1,2]],[[9378,8187],[-1,-5],[-1,2],[2,3]],[[1045,7557],[1,-9],[0,-80],[-2,-22],[-1,-3],[-6,-12],[-4,-12],[-3,-13],[-1,-9],[-1,-8],[1,-10],[0,-4],[0,-17],[0,-20],[0,-11],[1,-7],[1,-4],[1,-3],[5,-8],[1,-6],[1,-9],[1,-18],[0,-10],[0,-8],[-2,-15],[-4,-21],[-3,-28],[0,-10],[0,-6],[2,-2],[2,-1],[4,1],[2,0],[1,-2],[4,-9],[2,-1],[2,1],[2,2],[2,5],[2,1],[2,1],[1,-2],[3,-4],[2,-2],[2,0],[2,-1],[2,-4],[2,-13],[1,-11],[1,-9],[-1,-7],[0,-6],[-1,-5],[-2,-12],[0,-15],[0,-11],[2,-18],[0,-10],[0,-7],[-1,-16],[-1,-44],[2,-22],[0,-7],[-2,-9],[-1,-5],[-6,-13],[-2,-3],[-2,-2],[-2,-1],[-2,0],[-2,2],[-2,1],[-2,0],[-3,-1],[-4,-4],[-3,-6],[-3,-10],[-2,-3],[-1,1],[-6,12],[-3,4],[-4,2],[-4,0],[-2,2],[-1,2],[-4,13],[-3,5],[-2,0],[-1,-3],[-1,-4],[-2,-6],[-3,-8],[-6,-13],[-3,-7],[-2,-8],[0,-6],[1,-6],[0,-6],[-1,-8],[-2,-9],[-8,-19],[-2,-6],[-2,-13],[-1,-8],[-2,-3],[-2,-1],[-2,2],[-4,0],[-2,-3],[0,-5],[-1,-14],[-1,-8],[-3,-18],[0,-7],[0,-24],[0,-6],[-2,-7],[-7,-32],[-1,-7],[-1,-6],[-1,-23],[0,-13],[-1,-14],[-1,-9],[0,-7],[0,-13],[0,-6],[0,-7],[-1,-7],[-1,-9],[-1,-7],[0,-7],[0,-5],[0,-9],[-1,-11],[-6,-33],[-1,-9],[-1,-11],[0,-13],[-1,-24],[0,-5],[-2,-9],[-1,-10],[-1,-5],[0,-15],[0,-11],[-2,-8],[-2,-5],[-7,-19],[4,-27],[5,-16],[1,-9],[4,-61],[0,-7],[-1,-12],[-5,-44],[-1,-8],[-2,-5],[-4,-2],[-2,0],[-4,-2],[-2,-3],[-1,-3],[-3,-15],[-2,-7],[0,-6],[0,-5],[3,-24],[2,-14],[-1,-8],[0,-6],[-1,-4],[-2,-6],[-1,-8],[-2,-16],[-1,-8],[-2,-5],[-2,-1],[-2,-1],[-3,-5],[-1,-6],[0,-5],[0,-6],[1,-5],[1,-18],[0,-19],[0,-9],[-2,-6],[-1,-1],[-2,1],[-2,1],[-2,-1],[-1,-2],[-2,-2],[-1,-1],[-2,-3],[-2,-1],[-6,-29],[10,-42],[4,-22],[4,-42]],[[883,5782],[-7,-59],[-1,-25],[0,-12],[3,-30],[0,-5],[1,-5],[5,-14],[3,-15],[0,-9],[-1,-5],[-1,-3],[-2,-2],[-2,-5],[-4,-27],[-1,-15],[-1,-7],[-2,-6],[-1,-3],[-3,-9],[-5,-22],[7,-14],[5,-25],[3,-6],[2,-2],[3,3],[24,-21],[6,-4],[2,-3],[1,-4],[1,-6],[0,-5],[-1,-5],[-1,-9],[-1,-5],[-1,-11],[-2,-7],[-1,-5],[0,-6],[0,-7],[2,-5],[4,-7],[2,-4],[1,-16],[1,-64],[3,-18],[2,-4],[2,-9],[1,-7],[0,-6],[-1,-7],[-1,-10],[-1,-18],[1,-8],[1,-5],[2,-3],[5,-6],[7,-5],[1,-2],[5,-5],[3,-4],[0,-5],[0,-4],[-2,-8],[0,-11],[0,-17],[3,-40],[2,-18],[2,-10],[1,0],[5,7],[1,1],[2,-1],[4,-8],[2,-3],[4,-14],[13,-52],[-11,-92],[-1,-27],[0,-5],[0,-2],[6,-17],[1,-14],[3,-112],[3,-26],[1,-8],[4,-14],[2,-13],[1,-12],[0,-17],[-2,-64],[0,-14],[1,-8],[2,-1],[2,-1],[4,-6],[5,-24]],[[1009,4489],[-9,-8],[-1,-4],[-2,-6],[-2,-8],[-18,-70],[-10,-31],[-5,-11],[-5,-7],[-2,-2],[-3,-1],[-2,1],[-1,3],[-1,2],[-1,3],[-3,16],[-1,3],[-2,3],[-3,5],[-1,3],[-1,3],[-2,3],[0,4],[-2,4],[-1,3],[-5,4],[-1,2],[-1,2],[0,4],[-3,20],[-1,4],[-4,15],[-1,3],[-1,3],[-2,1],[-6,3],[-4,3],[-3,5],[-2,4],[-1,4],[-2,4],[-1,2],[-2,2],[-1,3],[-1,4],[-1,5],[-1,5],[0,5],[-2,6],[-1,6],[-5,7],[-5,1],[-7,-2],[-3,-2],[-3,-3],[-1,-3],[-1,-4],[-1,-5],[0,-5],[-1,-10],[-1,-4],[0,-5],[0,-4],[1,-4],[3,-10],[1,-4],[2,-21],[3,-27],[1,-27],[-5,-21],[-11,-19],[-5,-5],[-12,-8],[-9,-1],[-2,2],[-1,2],[-2,3],[-1,4],[0,4],[-2,10],[0,5],[-1,6],[0,6],[1,6],[0,5],[0,13],[-5,9],[-3,-1],[-7,-11],[-2,0],[-2,3],[-3,10],[-3,7],[-2,1],[-1,-1],[-4,-8],[-4,-3],[-2,0],[-1,3],[-4,19],[-1,5],[-2,5],[-2,0],[-1,-3],[-1,-6],[-1,-1],[-2,1],[-1,4],[0,4],[0,10],[-1,5],[-4,12],[-2,0],[-2,-2],[0,-5],[-1,-6],[-1,-6],[-6,-10],[-3,0],[-3,4],[-2,1],[-2,-1],[-4,-9],[-1,0],[0,3],[1,9],[0,5],[0,5],[0,5],[1,3],[2,0],[5,-3],[2,1],[1,3],[0,4],[-1,4],[-2,7],[-1,3],[-1,5],[0,11],[-1,5],[-1,1],[-1,-2],[-2,-4],[0,-4],[-2,-4],[-1,-2],[-3,-5],[-1,-3],[-2,-9],[-1,-4],[-2,1],[0,4],[0,5],[0,6],[-1,10],[1,18],[-1,7],[-2,2],[-2,0],[-4,-4],[-4,0],[-2,3],[-2,5],[0,7],[-2,7],[-2,2],[-2,0],[-1,-2],[-2,-4],[-1,-2],[-2,-1],[-3,0],[-1,0],[-1,-2],[-1,-3],[-1,-4],[-1,-6],[0,-10],[-1,-4],[-2,-3],[-3,-3],[-2,0],[-2,3],[-1,4],[-1,4],[0,6],[0,6],[2,10],[1,8],[2,8],[1,4],[-1,7],[-2,8],[-13,23],[-1,4],[0,4],[0,6],[0,5],[1,5],[0,5],[0,7],[-1,8],[-2,3],[-2,1],[-4,-2],[-14,-12],[-19,-5],[-9,-8],[-2,-2]],[[609,4599],[0,1],[2,12],[-6,4],[-11,-4],[-6,-6],[-2,-6],[-6,-7],[-12,12],[-13,19],[-7,13],[-6,23],[-3,25],[-1,28],[0,77],[2,25],[7,11],[32,-4],[10,5],[8,30],[9,12],[10,5],[9,-5],[-6,33],[-11,-3],[-13,-19],[-5,-11],[-13,4],[-3,24],[2,36],[0,40],[-5,21],[-27,54],[-8,24],[-10,22],[-11,7],[-12,-22],[-5,32],[-5,50],[-2,46],[3,20],[-8,8],[-2,18],[0,24],[-2,25],[-6,17],[-5,3],[-2,9],[2,34],[5,39],[2,21],[0,29],[2,20],[10,21],[2,22],[2,42],[9,100],[6,42],[-7,-9],[-9,7],[-8,20],[-3,30],[1,30],[5,29],[7,13],[8,-14],[3,22],[4,18],[5,14],[5,9],[-12,7],[-11,-13],[-9,0],[-3,42],[-2,77],[5,20],[15,3],[0,11],[-3,2],[-8,9],[4,21],[-1,10],[-10,11],[-5,2],[-3,-5],[-3,2],[-3,22],[0,21],[4,26],[0,16],[-3,5],[-5,1],[-5,5],[-1,21],[-5,-8],[-6,-4],[-12,1],[-6,6],[3,14],[5,11],[3,1],[0,21],[-2,6],[-4,5],[-6,15],[-5,8],[-6,-4],[-5,-10],[-3,-10],[-6,21],[-3,20],[-2,21],[-3,22],[-13,44],[-3,32],[-7,52],[-5,22],[-4,35],[1,13],[2,1],[2,-2],[3,4],[5,17],[5,14],[2,8]],[[386,6562],[1,0],[39,27],[5,2],[6,-7]],[[437,6584],[4,-42],[3,-12],[2,-2],[6,-7],[5,-12],[3,-4],[4,-3],[4,1],[2,2],[1,2],[2,4],[7,26],[8,19],[1,4],[0,4],[3,22],[2,13],[36,97],[2,9],[1,2],[0,4],[2,23],[4,25],[2,7],[1,6],[13,26],[2,7],[2,8],[1,4],[1,18],[5,28],[3,8],[18,7],[13,10],[5,6],[3,6],[7,22],[2,8],[1,10],[2,9],[3,45],[0,13],[0,12],[0,13],[3,60],[2,20],[2,9],[4,18],[3,7],[1,3],[2,-2],[2,-6],[3,1],[3,4],[7,21],[3,15],[3,23],[2,19],[0,6],[0,13],[1,26],[0,8],[0,6],[-1,5],[-1,3],[-2,2],[-2,2],[-1,2],[-2,4],[-1,7],[0,12],[0,7],[1,5],[5,12],[3,15],[3,8],[6,12],[2,6],[1,6],[7,88],[0,9],[-1,4],[-1,3],[-1,3],[-4,8],[-1,3],[-2,9],[-2,8],[-1,4],[-2,26],[1,4],[1,3],[2,2],[2,1],[3,0]],[[676,7566],[4,-19],[6,-36],[3,-12],[5,-6],[10,1],[5,-3],[11,-23],[10,-33],[8,-39],[6,-38],[8,-12],[14,13],[24,44],[8,22],[7,27],[4,31],[2,35],[6,69],[15,25],[20,11],[20,28],[18,35],[55,64],[17,20],[12,9],[11,-8],[8,-32],[2,-18],[3,-12],[4,-7],[6,-3],[5,-6],[0,-13],[-1,-15],[-1,-14],[10,-70],[8,-27],[11,-6],[5,7],[0,2]],[[338,7070],[5,-23],[8,-13],[5,-14],[-10,-53],[-2,-60],[-2,-27],[-12,-71],[-2,-28],[-28,16],[-20,-1],[-1,-3],[0,-4],[-2,-2],[-2,3],[-3,8],[0,7],[7,12],[2,22],[-3,80],[1,72],[-1,14],[-2,12],[-3,10],[-1,7],[1,15],[2,12],[0,10],[-3,11],[7,7],[2,-9],[2,-13],[5,-7],[4,4],[3,10],[2,11],[3,7],[10,7],[10,-1],[10,-9],[8,-19]],[[386,6562],[3,10],[4,51],[7,48],[1,31],[-1,17],[-5,31],[-1,10],[1,18],[5,28],[1,17],[-1,20],[-13,70],[-10,44],[-3,21],[0,35],[3,132],[-4,36],[-11,62],[-1,9]],[[361,7252],[74,-13],[8,-4],[9,-12],[-2,-19],[-1,-13],[-1,-92],[9,-316],[8,-180],[0,-6],[0,-7],[-1,-6],[-2,-4],[-1,-2],[-2,-2],[-6,0],[-16,8]],[[361,7252],[-2,24],[-3,130],[5,-6],[6,-4],[5,1],[5,9],[0,16],[-3,9],[-5,7],[-3,7],[6,179],[-13,310],[-5,27],[-7,29],[-6,33],[-9,69],[-19,101],[-6,61],[-8,24],[-16,35],[-1,2]],[[282,8315],[0,1],[4,12],[2,19],[1,16],[0,7],[1,4],[56,192],[5,13],[12,24],[2,6],[2,6],[5,69],[0,12],[0,6],[1,23]],[[373,8725],[5,-8],[11,-10],[9,-2],[13,4],[8,-5],[16,-35],[9,-13],[31,-28],[18,-23],[9,-6],[9,3],[33,71],[8,0],[1,-10],[0,-34],[1,-13],[5,-9],[4,-2],[6,0],[6,-3],[11,-20],[5,-30],[1,-73],[2,-17],[2,-17],[6,-31],[1,-13],[-1,-14],[-2,-13],[0,-2],[-1,-13],[0,-45],[2,-13],[4,-22],[2,0],[3,11],[6,6],[7,-3],[21,-16],[10,8],[13,43],[10,6],[16,-40],[9,-9],[23,15],[7,-6],[3,-20],[1,-32],[-1,-37],[-4,-13],[-7,-9],[-7,-26],[0,-35],[8,-23],[9,-22],[4,-30],[-3,-61],[0,-87],[-4,-50],[-1,-29],[-4,-28],[-9,-11],[-11,-6],[-8,-16],[-21,-128],[-3,-17],[-2,-18],[1,-18],[3,-12]],[[87,8186],[-5,-7],[-9,22],[-2,23],[-5,4],[-4,31],[10,28],[7,47],[12,15],[7,18],[1,-26],[-4,-13],[-4,-17],[1,-19],[-1,-10],[0,-25],[3,-26],[-2,-23],[-5,-22]],[[113,8575],[6,-15],[10,-14],[0,-13],[3,-7],[5,-11],[-3,-19],[-4,-21],[5,-24],[2,-14],[1,-13],[-5,-8],[-7,-6],[-5,-14],[-6,-12],[-3,-23],[-8,16],[-2,37],[-10,-1],[-9,-10],[-8,-29],[-7,-24],[-9,0],[-6,-20],[-6,-8],[-4,-5],[-7,74],[3,27],[-1,40],[-9,8],[-13,8],[-9,-2],[-5,22],[-2,27],[0,64],[12,-14],[10,13],[17,-2],[7,-15],[18,-7],[8,5],[8,20],[6,28],[5,1],[8,0],[-3,13],[0,12],[4,-2],[5,-6],[4,-34],[4,-22]],[[282,8315],[-12,47],[-11,66],[-8,72],[-4,66],[-1,29],[4,23],[4,34],[2,38],[0,14],[-2,26],[1,14],[3,16],[5,12],[3,13],[-1,22],[-4,36],[-1,26],[4,62],[0,35],[2,17],[3,13],[7,7],[5,-8],[1,-5],[2,-9],[5,-7],[8,0],[0,3],[7,14],[5,2],[6,-2],[5,-6],[4,-11],[19,-173],[5,-29],[10,-26],[15,-21]],[[2035,2798],[6,-8],[8,-5],[8,-1],[3,-5],[8,-21],[5,-6],[5,2],[12,18],[8,-9],[1,-11],[-1,-13],[1,-14],[18,-42],[6,-23],[13,-87],[-4,-36],[-1,-30],[4,-28],[38,-143],[4,-13],[11,-25],[4,-10],[2,-16],[0,-31],[1,-17],[4,-17],[9,-33],[2,-18],[-2,-15],[-5,-30],[-1,-18],[4,-32],[24,-89],[13,-96],[9,-38],[6,-39],[3,-16],[11,-37],[3,-17],[4,-34],[1,-30],[-1,-67],[2,-31],[6,-33],[7,-18],[6,15],[3,0],[14,-75],[5,-70],[9,-40],[3,-23],[1,-52],[3,-21],[6,-21],[4,-20],[-3,-16],[4,-21],[3,-64],[11,-84],[4,-71],[1,-38],[-4,-17],[-4,-14],[2,-67],[-3,-24],[-19,0],[-3,-5],[-5,-22],[-2,-5],[-23,3],[-10,6],[-21,25],[-4,10],[-1,16],[1,29],[-3,22],[-6,17],[-7,14],[-5,15],[-3,57],[14,27],[19,22],[12,43],[-9,7],[-9,-8],[-9,-15],[-17,-38],[-4,-6],[-2,10],[-3,28],[-16,101],[-12,55],[-11,23],[-3,-18],[5,-42],[19,-92],[0,-21],[-2,-43],[1,-20],[2,-22],[1,-24],[-1,-24],[-18,-44],[-25,18],[-44,69],[-13,-3],[-20,-32],[-11,-8],[-20,5],[-8,-2],[-8,-13],[-27,-99],[-15,-37],[-18,10],[-1,7],[-3,16],[-4,11],[-2,-8],[0,-17],[3,-23],[0,-12],[-1,-18],[-9,-40],[-7,-54],[-7,30],[-18,46],[-7,30],[-4,31],[-17,167],[-9,59],[-14,49],[-22,42],[-60,69],[-87,161],[-20,30],[-12,10],[-11,3],[-9,7],[-6,16],[-8,40],[-10,35],[-12,32],[-14,27],[-16,23],[-8,-9],[-25,-12],[-9,1],[-12,19],[-6,30],[-10,65],[-8,30],[-42,101],[-6,19],[-3,19],[4,3],[1,5],[-1,6],[-1,7],[-6,19],[-9,21],[-20,34]],[[1448,1909],[9,42],[5,7],[6,-2],[2,0],[1,7],[2,13],[0,30],[0,14],[-1,9],[-1,3],[-2,2],[-4,1],[-2,2],[-2,5],[-8,10],[-4,3],[-1,2],[-1,4],[-1,10],[-2,9],[0,5],[1,7],[8,22],[1,5],[1,6],[0,11],[0,7],[-1,12],[0,6],[0,6],[1,16],[10,81],[1,12],[0,6],[-2,16],[0,5],[1,10],[3,13],[10,40],[4,10],[12,15],[11,23]],[[1505,2414],[1,40],[2,14],[6,22],[1,7],[1,9],[-1,5],[-1,14],[-1,18],[0,7],[3,19],[1,8],[-1,12],[-1,7],[-1,8],[0,8],[1,17],[1,14],[3,21],[2,9],[1,7],[4,11],[0,5],[0,6],[-1,10],[-3,12],[0,9],[0,7],[5,42],[28,227],[3,47]],[[1558,3056],[22,-23],[27,-32],[7,-14],[72,-262],[19,-44],[80,-100],[3,-1],[1,0],[77,86],[21,13],[7,0],[7,-10],[6,-14],[29,-33],[2,-6],[5,-14],[2,-12],[2,-4],[72,-130],[5,-5],[2,2],[-1,6],[0,6],[0,4],[0,3],[1,4],[5,22],[1,5],[1,6],[0,11],[0,6],[-1,10],[-1,8],[-2,8],[-2,10],[-2,2],[-1,2],[-5,4],[-1,2],[-2,3],[0,4],[-1,3],[0,3],[1,3],[1,10],[1,6],[3,11],[1,3],[0,3],[0,3],[-3,19],[0,7],[0,4],[2,4],[2,5],[0,2],[2,7],[0,5],[1,9],[0,5],[0,4],[-1,6],[-1,6],[-1,5],[-1,3],[-2,3],[-4,7],[-1,2],[-1,4],[0,7],[2,8],[12,17],[0,3],[5,21],[2,11]],[[2316,2856],[-10,-2],[-8,8],[-10,32],[-4,18],[0,14],[0,8],[-2,26],[1,13],[2,9],[6,10],[4,7],[5,24],[0,23],[-3,23],[-1,25],[1,16],[3,16],[5,10],[5,-2],[3,-7],[1,-9],[0,-19],[1,-11],[7,-30],[3,-20],[6,-65],[2,-76],[-2,-18],[-6,-14],[-9,-9]],[[1475,7692],[-1,-3],[-18,-70],[-40,-110],[-17,-57],[-3,-20],[7,-85],[1,-10],[2,-15],[0,-9],[-1,-26],[0,-83],[0,-5],[-1,-4],[-4,-8],[-1,-15],[4,-91],[0,-25],[-1,-14],[-2,-2],[0,-6],[1,-8],[8,-31],[12,-28],[2,-8],[1,-14],[-3,-38],[-6,-38],[-1,-7],[-1,-35],[-1,-89],[1,-23],[0,-6],[0,-6],[-1,-11],[-3,-25],[0,-7],[2,-6],[3,-5],[7,-5],[1,-2],[3,-6],[1,-3],[2,-1],[2,0],[2,-1],[2,-4],[3,-6],[4,-6],[1,-3],[7,-24],[3,-6],[2,-4],[1,-2],[2,-2],[2,-5],[4,-16],[4,-9],[1,-3],[0,-7],[-3,-9],[0,-4],[-1,-6],[0,-5],[-1,-4],[-1,-2],[-4,-3],[-2,-3],[0,-4],[0,-8],[6,-75],[-1,-8],[-1,-5],[-1,-2],[-2,-3],[-1,-3],[-1,-3],[-1,-4],[0,-3],[0,-1],[0,-1],[0,-1],[0,-8],[1,-12],[5,-43],[1,-25],[-1,-12],[0,-30],[1,-7],[2,-7],[5,-7],[3,1],[1,2],[1,4],[2,3],[1,2],[2,-1],[2,-1],[12,-17],[26,-54],[2,-2],[3,-3],[2,-5],[1,-9],[1,-22],[1,-12],[2,-12],[2,-5],[2,-6],[4,-33],[1,-12],[-3,-22]],[[1536,6022],[-10,1],[-5,4],[-5,12],[-1,3],[-2,-1],[-2,-2],[-3,-9],[0,-7],[-1,-6],[0,-6],[0,-6],[0,-5],[-2,-9],[-1,-5],[0,-5],[0,-5],[0,-5],[2,-9],[1,-4],[1,-24],[0,-12],[0,-6],[-1,-4],[-1,-4],[-2,-1],[-7,4],[-7,2],[-2,2],[-2,3],[-1,4],[-1,3],[-2,3],[-1,1],[-2,-2],[-2,-7],[-2,-10],[-1,-4],[-1,-3],[-3,-7],[-1,-3],[-3,-7],[-4,-7],[-2,-2],[-2,-1],[-5,3],[-2,3],[-2,3],[-5,12],[-9,15],[-2,7],[-3,13],[-1,3],[-2,2],[-3,0],[-5,0],[-3,1],[-2,1],[-3,5],[-3,0],[-4,0],[-6,-4],[-5,-5],[-4,-13],[-1,-6],[1,-5],[0,-4],[1,-5],[-1,-5],[0,-5],[-6,-23],[-5,-13],[-1,-5],[-3,-19],[-2,-3],[-4,0],[-8,4],[-4,3],[-3,4],[-10,18],[-3,0],[-3,-1],[-11,-9],[-4,-5],[-1,-3],[-6,-21],[-10,5],[-2,2],[-2,4],[-1,5],[-1,9],[-1,4],[-2,3],[-1,2],[-2,2],[-1,2],[-2,4],[0,5],[0,5],[-1,6],[0,6],[-1,5],[0,4],[-4,11],[-18,42],[-1,4],[-1,5],[0,5],[0,12],[0,5],[-4,24],[0,4],[-2,3],[-4,-2],[-28,-36],[-5,-1],[-3,7],[-3,7],[-1,2],[-2,1],[-2,-1],[-2,1],[-1,2],[-5,20],[-1,4],[-1,2],[-1,0],[-2,-3],[-2,-8],[-2,-5],[-4,0],[-1,3],[-2,3],[-2,9],[-1,1],[-2,-3],[-4,-14],[-1,-8],[0,-8],[0,-5],[0,-6],[1,-12],[-1,-13],[-5,-68],[-1,-9],[-2,-6],[-5,-15],[-3,-12],[-2,-10],[0,-5],[-1,-5],[0,-19],[-1,-4],[-2,-1],[-3,4],[-2,4],[-1,5],[-1,4],[-2,20],[0,6],[0,5],[1,11],[0,6],[-1,6],[0,5],[-1,5],[-1,4],[-1,3],[-9,15],[-2,6],[-2,3],[-2,2],[-2,1],[-2,3],[-1,5],[0,6],[0,6],[0,6],[-1,5],[-1,4],[-1,4],[-1,3],[-2,1],[-4,1],[-2,1],[-1,3],[-1,4],[-1,5],[0,7],[0,13],[0,13],[-1,5],[0,5],[-1,4],[-2,3],[-2,1],[-3,0],[-4,-2],[-2,-2],[-3,-5],[-1,-7],[-2,-14],[0,-10],[0,-39],[0,-6],[-2,-36],[1,-32],[-1,-12],[-2,-22],[0,-4],[-1,-5],[-2,-4],[-4,-5],[-11,-7],[-3,-4],[-4,-15],[-4,-7],[-15,-25],[-4,-9],[-3,-8],[-2,-9],[-3,-11],[-2,-5],[-4,-4],[-11,-10],[-4,1],[-2,6],[-4,5],[-7,-4],[-6,15],[-4,12],[-2,3],[-7,8],[-3,4],[-1,5],[-1,3],[-2,4],[-4,3],[-6,3],[-6,-4],[-3,-3],[-2,-2],[-7,-5],[-1,-4],[-1,-5],[0,-6],[0,-7],[0,-5],[-2,-4],[-3,0],[-6,4],[-7,14],[-1,5],[-8,20],[-6,6],[-20,16]],[[1045,7557],[9,24],[6,6],[7,-7],[4,-15],[3,-19],[5,-16],[10,-18],[9,3],[6,19],[4,33],[2,9],[15,28],[3,13],[2,14],[3,13],[5,11],[17,44],[3,58],[0,66],[8,64],[13,46],[37,87],[14,41],[6,49],[-3,120],[4,81],[13,-29],[27,-55],[6,-9],[12,10],[2,17],[-4,13],[-9,-8],[6,24],[11,-1],[59,-66],[12,-20],[21,-68],[61,-362],[11,-39],[10,-26]],[[1448,1909],[-71,87],[-82,102],[-17,30],[-14,33],[-39,129],[-5,8],[-11,6],[-10,18],[-6,24],[0,21]],[[1193,2367],[1,1],[16,27],[4,13],[9,31],[2,-11],[1,-3],[1,-4],[2,-1],[1,3],[2,14],[1,4],[2,3],[1,3],[1,3],[0,16],[0,4],[0,2],[2,2],[2,1],[10,-8],[3,0],[22,17],[2,4],[2,4],[8,26],[2,4],[1,1],[2,-1],[9,-15],[13,-16],[20,-13],[5,1],[34,35],[5,3],[16,-1],[29,-38],[8,-13],[73,-51]],[[1193,2367],[1,5],[-9,6],[-8,10],[-15,27],[-9,-18],[-16,-3],[-6,-22],[-4,39],[-1,49],[-3,42],[-8,18],[-4,5],[-5,13],[-7,24],[-10,89],[-5,16],[-6,9],[-21,6]],[[1057,2682],[2,38],[2,19],[3,13],[1,11],[1,27],[1,7],[4,22],[12,81],[0,63],[-6,92],[0,24],[0,13],[1,1],[7,4],[4,0],[16,-3],[19,-11],[1,0],[3,2],[4,6],[6,14],[3,8],[1,7],[2,17],[2,36],[2,29],[2,8],[1,5],[1,4],[9,20],[2,6],[1,6],[1,10],[0,6],[0,13],[1,20],[2,20],[2,10],[1,6],[2,3],[4,5],[2,4],[2,6],[0,6],[0,11],[-2,21],[-1,25],[-1,24],[0,22],[3,47],[0,12],[-1,5],[-1,10],[-1,5],[0,5],[-4,18],[-2,14],[0,6],[0,6],[1,41],[0,6],[0,5],[-2,10],[-3,18],[-2,15],[-1,8],[-2,4],[-2,5],[-4,1]],[[1156,3704],[3,7],[1,2],[2,3],[1,4],[0,5],[1,5],[0,5],[1,4],[4,-2],[4,-7],[10,-19],[3,-11],[2,-9],[0,-6],[1,-5],[1,-4],[1,-3],[3,-5],[3,-6],[1,-3],[1,-5],[2,-2],[3,-2],[9,-1],[7,2],[2,-1],[2,-4],[3,-8],[1,-7],[2,-17],[1,-5],[0,-5],[1,-5],[0,-19],[0,-5],[1,-5],[1,-3],[3,0],[5,3],[4,6],[4,9],[2,3],[1,2],[6,2],[2,3],[1,3],[1,4],[3,0],[4,-4],[21,-30],[63,-62],[4,-3],[39,-19],[4,-7],[20,-66],[1,-4],[15,-59],[103,-211],[1,-2],[2,-2],[1,1],[2,2],[1,3],[1,3],[1,2],[4,-16],[5,-72]],[[1536,6022],[11,-62],[4,-17],[8,-14],[9,-20],[5,-9],[10,-9],[3,-2],[3,-3],[9,-4],[9,0],[14,5],[8,-8],[10,-26],[4,-16],[1,-4],[2,-13],[0,-10],[2,-18],[0,-9],[-1,-6],[-1,-4],[-1,-7],[-1,-34],[-1,-5],[0,-5],[-1,-4],[-1,-3],[-2,-2],[-5,-5],[-2,-3],[-1,-4],[-1,-7],[-1,-13],[0,-12],[1,-16],[3,-27],[1,-12],[2,-8],[4,-8],[4,-12],[3,-14],[2,-6],[2,-3],[7,-1],[1,-1],[2,-2],[4,0],[2,1],[6,-1],[2,0],[2,-3],[1,-3],[3,-9],[2,-3],[1,1],[1,2],[1,5],[1,11],[1,5],[1,4],[1,2],[1,3],[2,0],[3,-3],[17,-49],[2,-6],[0,-6],[1,-16],[1,-13],[1,-5],[3,-1],[0,-20],[-2,-21],[-4,-23],[-1,-12],[-1,-8],[3,-24],[0,-6],[-1,-4],[-4,-2],[-2,1],[-4,3],[-2,0],[-2,0],[-2,-2],[-3,-5],[-5,-12],[-2,-7],[-2,-9],[-2,-23],[-2,-10],[-5,-13],[-2,-10],[-1,-8],[0,-6],[-1,-27],[-5,-60],[0,-27],[0,-12],[-1,-21],[-1,-11],[-1,-7],[-6,-25],[-1,-7],[0,-6],[5,-26],[2,-8],[2,-3],[1,-3],[1,-3],[2,-1],[5,1],[28,36],[8,3],[2,-6],[1,-3],[2,-3],[7,-7],[14,-9],[3,-4],[2,-5],[2,-6],[4,-8],[17,-19],[2,-3],[1,-3],[1,-3],[1,-5],[1,-5],[1,-4],[1,-4],[1,-2],[1,-4],[2,-9],[2,-5],[3,-5],[3,-5],[12,-25],[3,-3],[2,0],[4,7],[3,2],[1,-2],[1,-5],[1,-12],[0,-6],[2,-6],[1,-6],[2,-2],[2,0],[2,4],[2,3],[4,1],[2,-3],[1,-5],[0,-22],[1,-3],[1,-8],[2,-9],[4,-15],[8,-24],[2,-9],[0,-4],[1,-6],[0,-5],[-1,-11],[0,-6],[1,-7],[6,-17],[1,-9],[5,-34],[1,-6],[2,-6],[4,-11],[2,-1],[1,2],[0,5],[-1,34],[0,5],[1,4],[1,4],[1,3],[1,3],[3,9],[2,12],[1,10],[2,16],[0,7],[-1,6],[0,5],[-4,42],[-4,24],[0,1],[-1,1],[0,7],[-1,6],[0,6],[1,12],[1,11],[0,6],[0,6],[0,13],[-1,10],[-1,3],[-1,4],[-2,3],[-3,5],[-1,3],[-1,4],[-1,4],[0,5],[-1,12],[0,6],[0,6],[2,36],[1,5],[1,3],[2,7],[1,4],[2,9],[1,5],[0,6],[1,11],[0,13],[-1,23],[-1,6],[-1,29],[0,7],[1,1],[4,-5],[2,-3],[1,-3],[1,-4],[1,-3],[2,-3],[1,-1],[38,-4],[7,-5],[3,-4],[2,-4]],[[1934,5100],[-1,-2],[-4,-4],[-4,-9],[-11,-42],[-4,-24],[-1,-27],[4,-48],[19,-142],[-2,-39],[-12,22],[-8,-45],[-6,-68],[-2,-51],[1,-57],[-2,-27],[-9,-1],[-5,-20],[-4,-26],[-2,-21],[1,-31],[2,-26],[20,-129],[2,-20],[9,-38],[17,-49],[12,-52],[-7,-45],[17,11],[-25,-159],[-2,-64],[8,-190],[3,-30],[3,-31],[-11,-372],[3,-61],[17,-109],[24,-95],[60,-180],[1,-1]],[[1156,3704],[-13,4],[-3,3],[-19,28],[-5,4],[-1,2],[-2,3],[-33,129],[5,42],[5,24],[0,6],[0,9],[-3,49],[-1,5],[-1,10],[-4,17],[-1,5],[0,5],[-1,6],[0,5],[1,11],[2,14],[8,50],[2,3],[1,2],[4,4],[1,2],[1,3],[1,4],[1,8],[4,47],[-1,14],[-5,22],[-7,31],[-2,16],[0,5],[-1,5],[-1,4],[-2,8],[-1,4],[-2,14],[-3,8],[-17,31],[-10,11],[-2,1],[-5,1],[-1,0],[-3,2],[-9,14],[-3,4],[-6,18],[-15,68]],[[822,3349],[-8,-6],[-3,14],[3,21],[10,12],[4,-16],[-2,-17],[-4,-8]],[[830,3253],[-3,-4],[-1,10],[1,17],[12,93],[7,32],[9,11],[6,-9],[1,-20],[-1,-11],[1,-20],[-1,-35],[-7,-20],[-10,-11],[-8,-16],[-3,-9],[-3,-8]],[[1057,2682],[-4,1],[-6,11],[-5,17],[-9,19],[-28,15],[-10,14],[-18,9],[-11,14],[-20,44],[-12,42],[-25,116],[-16,41],[-22,16],[-23,6],[-12,25],[9,69],[-12,5],[1,21],[25,94],[8,20],[7,8],[6,18],[0,40],[-4,73],[-3,20],[-15,35],[-3,19],[-10,201],[-3,30],[-8,25],[-17,45],[-2,12],[-2,13],[-3,12],[-10,8],[-5,7],[-4,8],[-2,8],[-4,24],[-24,97],[-16,48],[-3,13],[-4,36],[-10,44],[-5,68],[-4,33],[-8,33],[-37,77],[-13,16],[-5,11],[-3,11],[-8,42],[-13,50],[-8,18],[-24,12],[-6,16],[1,27],[5,35],[9,25]],[[1031,3358],[4,-1],[3,0],[14,6],[3,-2],[2,-1],[1,-3],[0,-4],[1,-7],[2,-2],[1,5],[1,7],[1,8],[2,5],[1,2],[2,0],[2,2],[1,4],[1,6],[0,9],[-2,58],[-2,30],[-1,17],[0,11],[1,4],[2,6],[1,6],[1,22],[1,7],[3,9],[1,5],[1,7],[-1,9],[-1,9],[-2,13],[-2,17],[-2,6],[-1,5],[-2,2],[-2,0],[-5,-7],[-3,-5],[-3,-3],[-4,1],[-12,17],[-6,20],[-3,2],[-1,-1],[-1,-1],[-1,-4],[-3,-8],[-7,-9],[-1,-3],[0,-2],[-2,-12],[-7,-37],[0,-5],[1,-54],[1,-5],[2,-11],[1,-4],[1,-5],[2,-4],[6,-12],[2,-5],[1,-6],[1,-7],[0,-8],[0,-4],[0,-2],[1,-1],[1,-3],[1,-3],[1,-9],[0,-6],[0,-5],[-1,-4],[-2,-11],[-1,-5],[-1,-6],[0,-7],[2,-11],[0,-8],[1,-6],[2,-5],[2,-3]],[[1035,3112],[2,-2],[4,3],[7,19],[2,11],[2,12],[10,39],[0,26],[-3,15],[-4,12],[-2,27],[-4,-7],[-2,-2],[-3,-5],[-7,-4],[-4,-5],[-1,-9],[1,-9],[2,-8],[0,-7],[-1,-6],[-1,-10],[2,-24],[0,-7],[-1,-5],[-1,-8],[-2,-4],[-1,-14],[0,-11],[2,-12],[3,-5]],[[1475,7692],[5,-11],[27,-50],[11,-28],[10,-37],[7,-50],[5,-24],[14,-19],[91,-217],[22,-32],[21,-13],[8,-17],[27,-70],[47,-160],[52,-247],[18,-130],[50,-255],[30,-165],[3,-29],[2,-11],[9,-31],[3,-16],[0,-17],[-4,-46],[1,-35],[5,-64],[9,-232],[-1,-35],[-5,-29],[-4,-31],[7,-69],[-1,-22],[16,-142],[1,-47],[-1,-17],[-7,-54],[-4,-18],[-3,-10],[-7,-26],[-2,-11],[0,-14],[3,-40],[-3,-16],[-3,-5]],[[9298,5104],[3,-23],[-28,1],[-35,0],[-23,0],[-18,9],[-3,9],[-27,71],[-2,19],[4,20],[9,19],[10,15],[8,8],[10,-2],[18,-18],[9,-5],[6,-8],[5,-17],[6,-33],[5,-14],[5,-8],[5,-4],[7,-1],[23,-23],[2,-15],[1,0]],[[9695,5512],[-3,-1],[-3,5],[0,5],[-1,32],[-2,9],[-6,15],[-2,8],[-2,17],[2,4],[5,0],[2,0],[7,0],[26,-10],[11,-9],[6,-22],[-2,-22],[-12,-10],[-19,0],[-7,-21]],[[9599,5858],[9,-20],[7,26],[13,-1],[14,-16],[11,-19],[0,-11],[-7,-2],[-5,-10],[-2,-18],[1,-23],[-10,28],[-3,4],[-2,-7],[-2,-14],[-2,-10],[-4,5],[-8,18],[-9,11],[-7,6],[-7,2],[-2,3],[-5,13],[-2,5],[-18,10],[-34,32],[0,10],[40,0],[5,4],[4,11],[3,11],[3,6],[11,-5],[4,-22],[4,-27]],[[9448,7639],[-4,-1],[-3,1],[-5,3],[-4,8],[0,10],[3,15],[5,11],[6,5],[14,2],[7,-7],[1,-15],[-2,-15],[-6,-6],[-3,-2],[-9,-9]],[[9064,8892],[-15,-1],[-16,7],[-13,13],[-5,11],[-1,13],[1,13],[5,12],[5,5],[26,3],[8,7],[6,14],[2,25],[-4,14],[-19,3],[-2,20],[6,19],[21,8],[9,15],[12,-48],[9,-48],[-2,-47],[-19,-47],[-14,-11]],[[8146,5065],[-3,12],[-2,20],[-2,24],[0,37],[1,22],[2,18],[16,60],[2,13],[3,33],[1,17],[-1,16],[-3,20],[-7,27],[-5,14],[-4,8],[-4,4],[-8,5],[-4,4],[-4,6],[-3,12],[-2,17],[-1,27],[0,37],[0,12],[-2,14],[-8,38],[-3,22],[-1,118],[0,12],[1,8],[17,88],[2,16],[1,15],[1,54],[2,29],[2,14],[2,12],[11,30],[2,14],[3,17],[8,77],[0,16],[-1,17],[-11,145],[-3,17],[-4,10],[-7,4],[-9,-1],[-14,-7],[-25,-4],[-47,15]],[[8035,6320],[13,35],[17,63],[6,9],[10,6],[10,13],[8,17],[5,18],[3,24],[3,63],[1,56],[1,14],[6,32],[4,13],[4,9],[2,12],[-3,20],[-19,-27],[-19,2],[-17,21],[-46,119],[-1,14],[1,13],[0,10],[-6,4],[-2,-4],[-10,-26],[-3,19],[2,22],[3,24],[3,50],[4,20],[4,16],[1,12],[6,16],[27,47],[6,31],[5,23],[36,78],[18,117],[10,30],[7,-35],[-17,-99],[10,-45],[3,16],[2,42],[3,17],[17,-45],[10,-15],[45,-9],[15,2],[14,13],[15,41],[13,61],[11,67],[6,62],[4,68],[3,30],[5,24],[8,19],[45,77],[8,26],[4,35],[1,71],[3,30],[32,153],[7,66],[-8,45],[-12,-12],[-4,20],[5,29],[16,15],[9,17],[24,109],[11,29],[6,10],[9,4],[6,-6],[8,-11],[6,-4],[3,16],[-2,51],[-7,4],[-9,-14],[-13,-5],[0,10],[14,22],[8,26],[2,5],[3,2],[11,-2],[4,10],[1,5],[0,8],[5,49],[1,10],[3,13],[5,16],[45,104],[7,23],[10,21],[9,13],[8,17],[3,33],[0,28],[2,29],[4,23],[6,10],[9,20],[32,127],[8,22],[5,22],[3,27],[1,39],[-1,52],[1,16],[2,12],[6,26],[2,15],[0,59],[1,26],[15,21],[4,24],[5,60],[0,34],[2,13],[3,6],[2,5],[6,25],[3,18],[4,13],[6,10],[5,2],[2,-6],[5,-35],[21,-41],[3,-17],[7,-111],[-9,17],[-6,5],[-2,-7],[-3,-48],[-1,-9],[6,-15],[8,-9],[8,-13],[3,-32],[-2,-60],[-6,-41],[-17,-73],[-9,-54],[-7,-66],[3,-54],[20,-15],[11,16],[8,28],[6,28],[5,12],[7,9],[23,65],[16,36],[4,19],[2,53],[2,7],[4,3],[3,8],[7,42],[19,57],[2,23],[-3,31],[-11,68],[0,32],[4,18],[4,2],[5,-6],[6,-3],[5,5],[3,11],[2,11],[-2,5],[-4,7],[-1,17],[1,17],[2,11],[5,3],[6,-5],[6,-6],[4,-3],[4,8],[8,20],[3,-1],[4,-7],[13,-17],[4,-3],[2,-6],[26,-48],[3,-7],[2,-12],[1,-27],[-3,-73],[-3,-16],[-7,-11],[-2,-27],[1,-31],[3,-26],[18,-73],[3,-27],[2,-96],[2,-25],[5,-32],[7,-12],[21,2],[8,-7],[6,-18],[11,-38],[13,-36],[9,-19],[8,-8],[9,6],[5,16],[12,62],[8,28],[5,1],[1,-24],[1,-42],[2,-1],[12,-36],[-2,2],[-2,-7],[0,-10],[0,-7],[2,-3],[6,-5],[2,-2],[8,-21],[5,-8],[7,-3],[7,11],[5,3],[5,-8],[12,-43],[6,-24],[5,-33],[3,0],[2,13],[3,6],[3,-1],[3,-8],[2,-11],[1,-11],[0,-14],[0,-17],[2,-15],[5,-26],[1,-11],[-2,-14],[-4,-14],[-2,-14],[5,-41],[-5,-102],[-3,-23],[-8,-2],[-17,9],[-9,-10],[-9,-18],[-15,-40],[-4,-26],[2,-25],[11,-39],[8,-60],[8,-9],[1,-9],[1,-15],[2,-12],[0,-12],[-3,-19],[-4,-13],[-4,-5],[-4,-6],[-2,-19],[4,-25],[7,-6],[7,-10],[3,-37],[-3,-25],[-7,-22],[-18,-32],[-64,-66],[-12,-40],[9,5],[29,38],[13,10],[36,0],[34,13],[25,-8],[9,2],[3,18],[-4,38],[5,10],[5,-1],[6,-5],[8,-4],[9,2],[24,14],[5,10],[3,20],[7,19],[14,30],[17,64],[9,14],[2,8],[3,4],[8,-5],[17,-54],[1,-15],[0,-17],[0,-14],[9,-14],[2,-18],[-1,-32],[2,-35],[22,-87],[2,-7],[1,-10],[-15,-61],[-8,-14],[-11,-10],[-12,-2],[-9,11],[-9,-9],[-32,9],[-8,-9],[-6,-18],[-1,-19],[5,-9],[2,-11],[16,-119],[4,-11],[2,-2],[3,4],[6,4],[8,7],[20,29],[9,6],[4,-3],[4,-13],[4,-5],[4,2],[5,7],[5,3],[5,-7],[6,-22],[3,-6],[5,7],[4,17],[0,13],[-2,16],[3,27],[3,11],[3,11],[1,13],[-4,28],[1,16],[8,18],[23,7],[21,28],[11,-7],[26,-42],[3,-2],[2,6],[6,19],[4,5],[5,-6],[5,-10],[3,-4],[10,-8],[52,-91],[18,-44],[7,-13],[9,-12],[8,-15],[2,-20],[-1,-15],[-4,-9],[-4,-5],[-1,-6],[-5,-87],[-4,-33],[-1,-33],[3,-32],[4,0],[5,39],[3,18],[4,13],[2,15],[-1,41],[2,17],[13,27],[12,0],[9,-21],[24,-88],[10,-27],[9,-12],[13,-7],[11,-21],[6,-30],[3,-37],[4,8],[2,8],[1,10],[0,16],[24,-55],[9,-8],[11,-15],[9,-32],[2,-33],[-9,-15],[5,-14],[8,-8],[8,0],[6,11],[2,20],[-3,17],[-1,13],[6,13],[13,-1],[24,-39],[15,-1],[40,57],[13,5],[8,-11],[7,-24],[12,-49],[11,-33],[5,-20],[2,-26],[-1,-33],[-5,-51],[-1,-26],[3,-72],[-2,-38],[-11,-31],[-25,-81],[-20,-34],[-93,-102],[-95,-83],[-19,-34],[-12,-15],[-12,-12],[-11,-3],[-8,6],[-16,20],[-14,7],[-11,9],[-6,0],[-7,-7],[-15,-35],[-11,-20],[-5,0],[-6,14],[-3,12],[-9,47],[-18,61],[-16,25],[-10,10],[-5,-8],[-5,4],[-11,-21],[-16,-40],[-4,9],[-2,-6],[-1,-15],[0,-21],[-19,15],[-18,-33],[-29,-97],[-9,-19],[-3,-12],[-2,-17],[1,-18],[2,-7],[3,-3],[13,-26],[4,-9],[3,-13],[5,-45],[13,-56],[14,-50],[15,-44],[18,-39],[7,-18],[4,-10],[5,-4],[4,-1],[11,-4],[4,-5],[2,-9],[4,-28],[3,-11],[3,-8],[3,-7],[9,-11],[2,26],[7,6],[9,-8],[7,-14],[5,-20],[1,-20],[-2,-19],[-6,-19],[-2,-20],[5,-17],[6,-15],[3,-12],[4,-9],[10,14],[14,32],[6,-8],[12,-5],[6,-8],[-2,-21],[6,-28],[20,-66],[0,-11],[-4,-17],[-6,-10],[-4,2],[-5,7],[-8,6],[2,-26],[-2,-23],[-5,-20],[-5,-15],[-8,-17],[-7,-5],[-21,2],[-8,-3],[-17,-14],[-9,-5],[-22,-1],[-12,6],[-8,17],[-7,-27],[-4,-8],[-46,-39],[-41,-11],[-12,-12],[-68,-103],[-11,0],[-31,27],[-9,4],[-6,8],[-19,55],[-8,13],[-4,6],[-4,2],[-2,7],[-4,28],[-2,7],[-6,2],[-16,19],[-13,7],[-5,5],[-11,23],[-6,27],[-4,30],[-8,29],[-8,-3],[-11,-21],[-10,-26],[-5,-17],[2,-14],[10,-18],[2,-16],[0,-64],[2,-16],[8,-22],[1,-19],[-3,-18],[-4,-14],[-11,-22],[-3,-10],[-3,-13],[-3,-11],[-1,-13],[2,-8],[9,-26],[3,-12],[-5,1],[-4,-2],[-21,-25],[-5,12],[-8,10],[-14,-3],[-8,1],[-18,8],[-14,12],[-12,22],[-29,91],[-41,64],[-19,40],[-4,16],[-3,14],[-4,11],[-7,4],[-6,-5],[-8,-22],[-5,-9],[-94,-5],[-29,24],[-21,-1],[-40,-22],[-19,13],[-19,40],[-9,3],[-16,-41],[-10,-9],[-10,0],[-13,15],[-13,-20],[-7,2],[-22,97],[-6,2],[-3,-19],[-11,-32],[-4,-22],[0,-16],[3,-11],[1,-10],[-4,-13],[-9,-7],[-6,7],[-5,1],[-13,-39],[-5,-5],[-5,2],[-5,7],[-13,66],[-2,20],[-2,8],[-4,3],[-3,-1],[-4,0],[-13,41],[-13,-8],[-15,-22],[-14,-12],[-7,2],[-23,19],[-12,2],[-5,3],[-5,9],[-5,-34],[-4,-18],[-5,-13],[-9,-17],[-25,-74],[-6,-10],[-8,9],[-6,18],[-3,25],[-2,25],[-3,11],[-6,11],[-13,14],[-21,4],[-10,8],[-5,22],[-2,24],[-5,13],[-6,-2],[-7,-21],[-5,-48],[1,-51],[-2,-46],[-20,-50],[-2,-20],[-2,-16],[-7,-5],[-5,8],[-4,13],[-4,5],[-21,-60],[-4,-15],[-4,-10],[-10,-8],[-4,-15],[-4,-35]],[[8850,9942],[-1,-37],[-5,-23],[-10,27],[-7,-11],[-3,-29],[6,-27],[-49,-37],[2,-15],[5,-8],[2,-9],[-2,-16],[-5,-7],[-7,-2],[-7,3],[-6,6],[25,137],[7,10],[17,12],[7,9],[21,74],[7,-20],[3,-37]],[[8972,9763],[-7,-29],[-9,13],[-10,-11],[-29,-18],[-7,-8],[-3,-9],[-13,-19],[-5,-9],[-3,-18],[-2,-17],[-3,-16],[-6,-12],[-4,37],[-3,117],[2,25],[2,11],[-1,68],[2,15],[3,7],[8,8],[5,9],[12,37],[12,24],[6,8],[7,3],[38,20],[12,-11],[6,-25],[1,-36],[-5,-118],[-6,-46]],[[5993,2361],[0,-14],[-1,-9],[-5,9],[-5,6],[-5,-6],[-3,-14],[-3,-14],[-5,20],[-9,63],[-5,13],[-10,14],[-2,32],[4,68],[1,62],[-10,255],[1,77],[8,49],[17,-21],[11,-48],[5,-64],[0,-269],[5,-114],[11,-89],[0,-6]],[[8146,5065],[-3,-27],[-6,-136],[-6,-66],[-10,-60],[-5,-17],[-18,-30],[-3,-11],[-1,-35],[8,-22],[11,-17],[7,-23],[0,-50],[-19,-179],[-3,-61],[-1,-61],[3,-36],[12,-93],[1,-16],[-1,-31],[0,-16],[2,-19],[8,-46],[4,-32],[0,-17],[-3,-14],[-5,-6],[-4,4],[-5,7],[-5,2],[-11,-34],[-9,-71],[-18,-232],[0,-26],[8,-30],[8,-8],[1,-11],[-17,-71],[-3,-28],[-2,-65],[-4,-31],[-9,-10],[-21,-7],[-33,-44],[-16,-8],[-15,21],[-13,59],[-7,6],[-8,-40],[-9,-54],[-6,-20],[-29,-60],[-8,-24],[-7,-32],[-2,-18],[-1,-16],[-2,-16],[-4,-17],[-7,-18],[-5,-6],[-1,-7],[3,-21],[13,-52],[3,-30],[-5,-37],[-6,-12],[-5,-3],[-5,-6],[-3,-19],[1,-15],[5,-31],[2,-14],[-2,-32],[-5,-35],[-1,-31],[8,-21],[5,-1],[11,16],[6,5],[6,-1],[6,-7],[7,-8],[5,-11],[7,-25],[8,-35],[6,-36],[1,-27],[-7,-30],[-10,-11],[-23,-7],[-11,-20],[-19,-66],[-8,-14],[-9,-11],[-22,-57],[-10,-19],[-19,5],[-6,-10],[-4,-34],[1,-32],[1,-24],[-3,-18],[-14,-13],[-39,-16],[-15,-27],[-8,-60],[-6,-84],[0,-29],[2,-13],[6,-25],[1,-15],[0,-52],[0,-13],[5,-34],[6,-2],[9,11],[11,5],[5,-10],[2,-21],[0,-23],[-1,-20],[-4,-31],[-3,-26],[0,-26],[2,-33],[0,-29],[-7,-19],[-28,-33],[-28,-10],[-5,-6],[-5,-12],[-5,-15],[-3,-14],[-1,-16],[0,-11],[2,-11],[2,-19],[0,-48],[-5,-107],[-10,-80],[-13,-66],[-8,-26],[-18,-44],[-5,-26],[0,-37],[2,-33],[0,-33],[-3,-30],[-8,-23],[-12,-8],[-11,10],[-41,86],[-11,18],[-12,5],[-10,-8],[-75,-96],[-2,-2],[-11,-23],[-5,-4],[-6,7],[-6,14],[-4,17],[-5,14],[-19,17],[-21,-1],[-73,-34],[-10,-12],[-11,-30],[-31,-116],[-81,-164],[-12,-9],[-15,22],[-25,92],[-11,19],[-11,1],[-11,-9],[-20,-25],[-23,2],[-38,89],[-24,27],[-30,18],[-22,4],[-8,7],[-16,39],[-19,28],[-20,5],[-20,-11],[-19,-19],[-8,0],[-1,13],[3,16],[15,35],[8,25],[6,29],[3,34],[0,35],[-5,21],[-9,15],[-12,15],[-9,3],[-24,-2],[-10,6],[-9,9],[-8,3],[-10,-10],[-5,-14],[-3,-14],[-3,-13],[-7,-9],[-3,1],[-13,12],[-152,24],[-13,-8],[-8,-18],[-7,-22],[-9,-20],[-9,-9],[-31,-9],[-12,-12],[-59,-84],[-9,-23],[-4,-38],[2,-13],[12,-2],[3,-13],[0,-18],[-2,-16],[-16,-97],[-27,-232],[-3,-18],[-7,-10],[-13,-5],[-41,1],[-33,-31],[-44,-162],[-31,-24],[-14,13],[-27,34],[-13,11],[-9,2],[-8,-3],[-43,-50],[-12,-51],[-6,-9],[-5,34],[-2,26],[-3,23],[-6,15],[-9,0],[-20,-19],[-10,-6],[-10,2],[-12,10],[-68,91],[-10,3],[-115,-88],[-32,-3],[-15,-8],[-14,-21],[-28,-73],[-5,-24],[-1,-27],[-1,-13],[-4,-7],[-3,2],[-5,13],[-1,2],[-7,-10],[0,-4],[-10,-12],[-2,0],[-6,6],[-3,0],[-5,-10],[-10,-28],[-7,-7],[-6,3],[-5,10],[-3,12],[-4,7],[-6,1],[-2,-4],[-2,-12],[-5,-19],[-21,-30],[-24,9],[-24,35],[-19,45],[-21,88],[-9,23],[-6,8],[-26,17],[-7,-4],[-7,-6],[-5,5],[-1,31],[-3,38],[-25,111],[-11,66],[-8,31],[-9,14],[-30,12],[-9,11],[-12,26],[-11,58],[-9,26],[-18,27],[-7,16],[-6,33],[-10,90],[-6,25],[-9,14],[-10,0],[-10,-3],[-10,2],[-9,22],[-9,66],[-4,10],[-10,-16],[-3,2],[-1,43],[-3,17],[-46,117],[-9,38],[-6,31],[-3,30],[0,70],[3,122],[-3,29],[-9,11],[-22,0],[-7,7],[-6,15],[-4,18],[-4,19],[-2,19],[0,12],[0,11],[-3,56],[0,23],[4,19],[19,48],[5,19],[8,34],[14,71],[9,83],[0,-1],[2,-26],[2,-34],[5,-63],[0,-30],[-1,-25],[-3,-21],[0,-25],[4,-34],[15,-64],[10,-29],[10,-23],[31,-40],[19,-36],[20,-26],[9,-20],[6,-26],[9,-54],[6,-24],[7,-5],[25,1],[6,4],[8,12],[11,4],[65,-2],[7,-4],[10,-21],[5,-5],[3,4],[8,20],[3,6],[5,6],[3,1],[3,-5],[12,-41],[4,-3],[2,27],[5,18],[1,9],[0,9],[-2,16],[-1,6],[-1,49],[1,14],[6,34],[8,15],[7,-8],[4,-44],[5,-19],[2,-9],[0,-10],[-1,-22],[1,-10],[1,-11],[3,-9],[2,-7],[4,-6],[3,-4],[5,-3],[11,-2],[5,6],[7,29],[15,16],[9,15],[8,3],[7,-27],[-6,-24],[-5,-21],[-2,-24],[-1,-31],[-2,-12],[-9,-28],[-3,-18],[13,18],[8,2],[7,-9],[5,-17],[1,-17],[2,-13],[6,-7],[4,4],[11,16],[6,1],[7,-7],[20,-34],[30,-27],[13,-22],[6,-36],[-3,-39],[-9,-28],[-19,-37],[0,-12],[13,1],[11,6],[9,14],[11,27],[5,29],[-1,30],[-3,28],[0,24],[14,31],[23,-9],[44,-54],[22,-43],[38,-117],[20,-39],[30,-46],[7,-7],[12,5],[17,27],[10,10],[17,-20],[18,-45],[20,-29],[22,31],[-8,1],[-14,16],[-7,4],[-3,10],[-4,42],[-4,10],[-8,4],[-14,15],[-8,2],[-6,-5],[-18,-25],[-11,-2],[-10,9],[-8,16],[-7,23],[-9,21],[-23,27],[-8,21],[-10,74],[-9,28],[-3,19],[0,45],[0,12],[7,54],[5,56],[4,20],[30,17],[11,1],[10,-10],[6,-28],[7,-35],[8,-22],[12,16],[7,4],[7,-15],[8,-13],[11,9],[-10,9],[-5,7],[-9,21],[-4,2],[-5,-1],[-10,8],[-3,-1],[-2,4],[0,19],[-6,25],[-1,7],[-2,5],[-10,6],[-3,3],[-2,8],[-12,60],[-2,21],[-1,23],[2,9],[12,8],[3,10],[-1,9],[-7,14],[-2,13],[2,31],[4,28],[11,53],[16,100],[15,142],[1,36],[3,7],[6,-2],[10,-10],[12,3],[-13,33],[-1,37],[7,20],[9,-3],[10,-10],[19,-12],[4,3],[7,13],[4,12],[9,39],[1,12],[-4,13],[-6,-6],[-5,-16],[-5,-38],[-4,-3],[-6,6],[-14,27],[-10,5],[-37,-16],[-7,3],[-3,16],[0,36],[3,24],[8,25],[10,15],[10,-7],[-5,29],[-10,11],[-9,5],[-4,13],[1,27],[6,73],[5,108],[7,41],[12,31],[5,-26],[6,-12],[18,-16],[5,-15],[13,-48],[4,-10],[3,-4],[4,-9],[3,-6],[4,3],[16,33],[5,4],[17,8],[4,-2],[9,-21],[10,-17],[-4,28],[-10,31],[-17,47],[-4,19],[-6,64],[-4,23],[16,-3],[14,-11],[12,-2],[10,26],[3,-4],[1,-2],[1,1],[2,5],[-11,13],[-19,14],[-8,15],[-7,17],[-5,16],[-3,24],[1,38],[9,94],[2,60],[4,23],[5,16],[37,85],[55,104],[16,23],[97,57],[78,9],[145,115],[141,112],[78,50],[31,37],[6,-1],[89,84],[17,27],[27,87],[10,59],[-6,34],[4,13],[13,28],[25,65],[5,8],[2,15],[17,81],[40,105],[9,43],[2,12],[1,12],[1,33],[3,16],[11,28],[3,9],[4,17],[24,83],[12,62],[4,34],[2,36],[4,29],[9,24],[21,36],[124,321],[107,419],[10,75],[-3,60],[11,51],[5,65],[0,73],[-12,145],[4,25],[11,9],[34,-47],[27,-13],[11,-17],[17,-39],[12,-15],[6,-12],[4,-31],[3,-5],[8,0],[4,-5],[1,-10],[1,-12],[1,-10],[6,-18],[3,-17],[4,-43],[0,-43],[7,-31],[3,-69],[-2,-15],[-7,-18],[-1,-9],[0,-23],[3,-14],[17,-4],[22,-13],[21,11],[10,-2],[6,-20],[11,-97],[5,-30],[7,-30],[32,-89],[11,-23],[4,-12],[2,-15],[4,-39],[3,-12],[21,-7],[24,42],[46,135],[4,22],[3,64],[4,30],[11,52],[4,28],[-2,27],[-16,-19],[0,31],[3,14],[3,10],[13,36],[5,26],[4,25],[5,59],[1,44],[-4,7],[-8,-4],[-10,11],[-9,43],[-3,57],[-2,179],[-2,34],[-3,32],[-10,57],[-4,28],[1,26],[0,1],[5,13],[18,23],[9,17],[17,47],[9,17],[11,10],[9,-2],[10,-4],[9,0],[8,15],[3,24],[1,25],[1,24],[12,35],[5,8],[5,9],[4,11],[3,14],[4,-31],[0,-60],[3,-56],[-3,-122],[2,-125],[4,-60],[17,-119],[6,-61],[6,-151],[4,-22],[7,-14],[29,-32],[10,-7],[16,4],[4,-4],[8,-20],[5,-7],[10,1],[4,-5],[10,-19],[11,-15],[12,-1],[7,24],[-1,32],[-8,33],[-18,50],[-11,48],[-7,60],[-3,65],[0,60],[4,61],[1,27],[-2,36],[-33,290],[-13,55],[-7,14],[-6,9],[-5,15],[0,35],[8,-1],[8,3],[6,12],[4,51],[6,14],[7,-3],[6,-21],[2,-11],[2,-3],[11,3],[5,-3],[5,-6],[5,-9],[5,-30],[9,-9],[11,0],[8,4],[6,13],[17,51],[2,9],[7,19]],[[7947,6939],[5,-77],[0,-37],[-9,-28],[-5,0],[-10,19],[-4,-2],[-10,-26],[-13,-23],[1,23],[15,120],[4,15],[14,40],[8,10],[4,-34]]],"transform":{"scale":[0.0019634822207220673,0.0006505060506050669],"translate":[99.64522806000011,0.851370341000077]}};
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
