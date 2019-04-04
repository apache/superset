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
  Datamap.prototype.mysTopo = '__MYS__';
  Datamap.prototype.namTopo = '__NAM__';
  Datamap.prototype.nclTopo = '__NCL__';
  Datamap.prototype.nerTopo = '__NER__';
  Datamap.prototype.nfkTopo = '__NFK__';
  Datamap.prototype.ngaTopo = {"type":"Topology","objects":{"nga":{"type":"GeometryCollection","geometries":[{"type":"Polygon","properties":{"name":"Borno"},"id":"NG.BO","arcs":[[0,1,2,3]]},{"type":"Polygon","properties":{"name":"Abia"},"id":"NG.AB","arcs":[[4,5,6,7,8,9,10]]},{"type":"Polygon","properties":{"name":"Akwa Ibom"},"id":"NG.AK","arcs":[[11,12,13,-7]]},{"type":"Polygon","properties":{"name":"Imo"},"id":"NG.IM","arcs":[[14,15,-9]]},{"type":"MultiPolygon","properties":{"name":"Rivers"},"id":"NG.RI","arcs":[[[16]],[[17]],[[-8,-14,18,19,20,21,-15]]]},{"type":"Polygon","properties":{"name":"Bayelsa"},"id":"NG.BY","arcs":[[22,23,-20]]},{"type":"Polygon","properties":{"name":"Benue"},"id":"NG.BE","arcs":[[24,25,26,27,28,29,30]]},{"type":"Polygon","properties":{"name":"Cross River"},"id":"NG.CR","arcs":[[31,-12,-6,32,-27]]},{"type":"Polygon","properties":{"name":"Taraba"},"id":"NG.TA","arcs":[[33,34,35,-25,36,37,38]]},{"type":"Polygon","properties":{"name":"Kwara"},"id":"NG.KW","arcs":[[39,40,41,42,43,44]]},{"type":"Polygon","properties":{"name":"Lagos"},"id":"NG.LA","arcs":[[45,46]]},{"type":"Polygon","properties":{"name":"Niger"},"id":"NG.NI","arcs":[[47,48,49,50,-45,51,52]]},{"type":"Polygon","properties":{"name":"Ogun"},"id":"NG.OG","arcs":[[53,54,55,-47,56,57]]},{"type":"Polygon","properties":{"name":"Ondo"},"id":"NG.ON","arcs":[[58,59,60,-55,61,62,63]]},{"type":"Polygon","properties":{"name":"Ekiti"},"id":"NG.EK","arcs":[[-63,64,-41,65]]},{"type":"Polygon","properties":{"name":"Osun"},"id":"NG.OS","arcs":[[-65,-62,-54,66,-42]]},{"type":"Polygon","properties":{"name":"Oyo"},"id":"NG.OY","arcs":[[-67,-58,67,-43]]},{"type":"Polygon","properties":{"name":"Anambra"},"id":"NG.AN","arcs":[[-10,-16,-22,68,69,70]]},{"type":"Polygon","properties":{"name":"Bauchi"},"id":"NG.BA","arcs":[[71,-39,72,73,74,75,76]]},{"type":"Polygon","properties":{"name":"Gombe"},"id":"NG.GO","arcs":[[-2,77,-34,-72,78]]},{"type":"Polygon","properties":{"name":"Delta"},"id":"NG.DE","arcs":[[-21,-24,79,-60,80,-69]]},{"type":"Polygon","properties":{"name":"Edo"},"id":"NG.ED","arcs":[[-81,-59,81]]},{"type":"Polygon","properties":{"name":"Enugu"},"id":"NG.EN","arcs":[[-29,82,-11,-71,83]]},{"type":"Polygon","properties":{"name":"Ebonyi"},"id":"NG.EB","arcs":[[-33,-5,-83,-28]]},{"type":"Polygon","properties":{"name":"Kaduna"},"id":"NG.KD","arcs":[[-74,84,85,86,-49,87,88,89]]},{"type":"Polygon","properties":{"name":"Kogi"},"id":"NG.KO","arcs":[[90,91,-30,-84,-70,-82,-64,-66,-40,-51]]},{"type":"Polygon","properties":{"name":"Plateau"},"id":"NG.PL","arcs":[[-38,92,-85,-73]]},{"type":"Polygon","properties":{"name":"Nassarawa"},"id":"NG.NA","arcs":[[-93,-37,-31,-92,93,-86]]},{"type":"Polygon","properties":{"name":"Jigawa"},"id":"NG.JI","arcs":[[-76,94,95,96,97]]},{"type":"Polygon","properties":{"name":"Kano"},"id":"NG.KN","arcs":[[-75,-90,98,-95]]},{"type":"Polygon","properties":{"name":"Katsina"},"id":"NG.KT","arcs":[[-96,-99,-89,99,100]]},{"type":"Polygon","properties":{"name":"Sokoto"},"id":"NG.SO","arcs":[[101,102,103]]},{"type":"Polygon","properties":{"name":"Zamfara"},"id":"NG.ZA","arcs":[[-100,-88,-48,104,-102,105]]},{"type":"Polygon","properties":{"name":"Yobe"},"id":"NG.YO","arcs":[[-3,-79,-77,-98,106]]},{"type":"Polygon","properties":{"name":"Kebbi"},"id":"NG.KE","arcs":[[-105,-53,107,-103]]},{"type":"Polygon","properties":{"name":"Adamawa"},"id":"NG.AD","arcs":[[-35,-78,-1,108]]},{"type":"Polygon","properties":{"name":"Federal Capital Territory"},"id":"NG.FC","arcs":[[-94,-91,-50,-87]]}]}},"arcs":[[[9232,6942],[-48,-4],[-121,-33],[-28,5],[-27,12],[-9,9],[-11,3],[-29,-5],[-7,-60],[0,-70],[-11,-73],[-46,-139],[-30,-139],[-42,-29],[-56,15],[-49,39],[-46,51],[-57,30],[-72,12],[-68,-19],[-45,-65],[-49,-55],[-31,-2],[-21,-19],[-15,-37],[-23,-32],[-60,-33],[-67,-9],[-61,-17],[-48,-49],[-86,-139],[-106,-92],[-134,9]],[[7729,6007],[-60,46],[-56,112],[-30,26],[-36,16],[-32,28],[-26,39],[-17,46],[2,46],[61,123],[-10,90]],[[7525,6579],[32,11],[26,26],[19,31],[9,36],[-5,87],[11,83],[47,64],[197,85],[52,49],[25,71],[-4,87],[5,88],[17,34],[23,30],[34,76],[85,129],[-4,38],[-15,36],[-25,35],[-34,13],[-27,-5],[-23,9],[5,40],[50,123],[4,45],[-19,104],[38,350],[-17,156],[92,106],[36,63],[21,63],[-7,64],[-45,41],[-37,51],[-15,65],[20,200],[0,2]],[[8096,9165],[23,-1],[19,-4],[16,-7],[14,-3],[12,7],[3,12],[8,55],[3,4],[19,4],[6,3],[7,9],[5,11],[5,23],[-13,6],[5,16],[11,19],[3,17],[30,35],[4,3],[3,-6],[6,3],[6,5],[5,7],[2,6],[1,17],[9,-8],[7,-10],[8,-7],[13,-3],[7,6],[6,24],[10,5],[19,5],[13,13],[22,32],[5,18],[2,0],[2,4],[5,-4],[5,-7],[1,-4],[12,1],[0,4],[-6,8],[-3,12],[3,4],[11,5],[3,2],[2,1],[8,-2],[2,1],[1,3],[-1,8],[0,3],[23,32],[11,11],[-5,8],[-5,7],[-6,4],[-7,2],[0,8],[13,-4],[11,-7],[7,1],[4,17],[23,-6],[23,5],[75,46],[21,10],[23,2],[0,-7],[-4,-10],[9,-4],[16,1],[13,6],[1,-4],[-1,-11],[7,7],[6,18],[4,4],[8,-2],[2,-8],[-2,-11],[-2,-8],[22,12],[22,5],[20,9],[16,24],[-12,2],[-2,5],[8,15],[4,1],[5,0],[6,1],[2,9],[-1,5],[-4,8],[0,4],[4,10],[6,10],[33,38],[13,11],[0,18],[7,7],[24,5],[1,0],[206,-10],[191,-326],[191,-326],[47,-277],[47,-277],[1,-80],[1,-5],[4,-18],[0,-19],[-5,-32],[1,-12],[7,-16],[11,-9],[13,-3],[171,-6],[54,-16],[22,-15],[3,-11],[-4,-15],[1,-10],[6,-7],[25,-23],[9,-5],[0,-7],[-3,-2],[-8,-5],[16,-15],[17,-11],[13,-13],[6,-22],[4,-5],[11,5],[12,8],[7,3],[10,-7],[4,-9],[1,-12],[-16,-20],[-2,-6],[-4,-6],[-5,-13],[-15,-74],[2,-11],[-15,-12],[2,-20],[16,-45],[1,-11],[0,-8],[-3,-35],[-9,-32],[-18,-106],[-6,-18],[-31,-50],[-4,-9],[1,-9],[8,-12],[3,-2],[15,0],[6,-4],[3,-7],[3,-8],[5,-6],[13,-17],[10,-18],[4,-21],[1,-26],[-3,-22],[-7,-26],[-8,-25],[-10,-19],[-15,-9],[-43,-20],[-17,-13],[-31,-33],[-17,-13],[-50,-19],[-15,-11],[-75,-84],[-6,-4],[-23,-3],[-10,-5],[-23,-30],[-15,-13],[-17,-11],[-19,-6],[-17,3],[-59,30],[-32,12],[-26,0],[-32,-32],[-31,-39],[-28,-43],[-20,-44],[-14,-41],[-10,-16],[-32,-23],[-13,-14],[-10,-18],[-3,-21],[5,-40],[-6,-16]],[[4052,1770],[1,-61],[-7,-67],[49,-31],[122,-1],[44,-26],[7,-36],[13,-33],[27,-25],[31,-14]],[[4339,1476],[14,-48],[-8,-58],[19,-109],[41,-96],[-10,-37],[-40,9]],[[4355,1137],[-43,43],[-47,32],[-29,55],[-41,36],[-32,6],[-22,-20],[6,-71],[-21,-57],[-1,-14],[21,-8],[8,-19],[-5,-20],[-24,-19],[-42,7],[-38,-13],[-2,-21],[9,-19],[2,-20],[-12,-65],[-3,-45],[5,-48],[-5,-47],[-27,-34],[-19,-38],[11,-50],[-5,-19],[-2,-17],[18,-41],[6,-44]],[[4021,567],[-56,47],[-44,1],[-32,16],[-32,-1],[-69,-17],[-33,13],[-11,81],[85,164],[5,51],[-17,38]],[[3817,960],[61,219],[31,44],[10,26],[8,28],[12,21],[6,25],[-1,28],[-3,29],[0,28],[-6,27],[-9,20],[7,15],[8,47],[-10,117],[-32,35],[-24,7],[-41,26],[-18,19]],[[3816,1721],[39,62],[56,37]],[[3911,1820],[5,-5],[2,-4],[39,8],[41,2],[54,-51]],[[4355,1137],[-23,-32],[13,-45],[10,-19],[16,-16],[49,10],[22,-7],[37,-28],[14,-20],[-6,-128],[11,-57],[23,-52],[29,-53],[98,-127],[32,-30],[10,-2]],[[4690,531],[5,-5],[12,-45],[11,-17],[-3,-7],[-7,-23],[-1,-10],[3,-15],[8,-5],[10,-4],[7,-8],[3,-24],[-13,-15],[-16,-12],[-8,-17],[-12,-31],[-8,-5],[-8,-2],[-36,0],[-47,7],[-72,0],[-35,6],[-16,-1],[-27,-18],[-16,-2],[-37,0],[-143,-21],[-7,6],[-11,1],[-10,-4],[-6,-11],[9,1],[8,-1],[6,-3],[5,-4],[-18,-6],[-27,-1],[-24,4],[-11,14],[-11,4],[-74,6],[3,5],[1,3],[2,3],[5,4],[-10,4],[-10,-2],[-7,1],[-2,12],[3,6],[6,4],[6,6],[3,11],[-3,5],[-15,24],[3,4],[3,11],[-12,18],[3,26],[15,49],[-6,0],[-9,-9]],[[4052,448],[1,25],[-7,39],[-15,29],[-10,26]],[[3817,960],[-25,-9],[-26,-4],[-44,16],[-105,-13],[-118,10],[-88,71],[-5,14],[-20,19],[-8,11],[-1,36],[12,34],[7,74],[-35,44],[-30,-9],[-30,3],[-5,23],[26,164],[9,36]],[[3331,1480],[56,56],[65,22],[36,-19],[33,11],[32,84],[12,44],[31,24],[37,11],[39,6],[75,-21],[34,15],[35,8]],[[3984,212],[15,-5],[15,2],[30,10],[14,2],[28,3],[8,-3],[-4,-14],[-8,-12],[-14,-4],[-32,1],[-13,-2],[-41,-19],[-15,-2],[-61,5],[-13,8],[-5,14],[8,18],[8,6],[41,15],[9,-4],[30,-19]],[[3823,235],[13,-6],[38,4],[11,-4],[-11,-12],[-5,-12],[-1,-14],[-1,-16],[-3,-16],[-8,-11],[-11,-9],[-12,-6],[-74,-19],[-28,4],[-9,12],[9,20],[26,35],[19,36],[16,23],[3,10],[4,17],[11,-8],[13,-28]],[[4052,448],[-5,-4],[-6,-9],[-2,-11],[2,-15],[2,-11],[0,-11],[-7,-12],[0,-7],[11,-17],[3,-9],[-3,-2],[-14,-20],[-7,-7],[-10,-7],[-9,-1],[-8,9],[-6,0],[-7,-22],[-18,3],[-29,19],[-21,1],[-22,6],[-18,11],[-11,17],[-5,-3],[-5,-3],[-15,-1],[-3,-3],[-1,-7],[-3,-8],[-8,-4],[0,-6],[6,-4],[6,-4],[-6,-6],[11,-5],[14,-14],[23,-6],[4,-7],[-1,-10],[-5,-9],[-37,-7],[-4,6],[-19,34],[-53,71],[-7,22],[0,28],[-3,10],[-5,0],[-12,-7],[-18,0],[-3,1],[-7,9],[-15,16],[-6,10],[-14,48],[-9,16],[-1,-10],[-4,-11],[-4,-7],[-3,-1],[3,-10],[4,-2],[6,-1],[5,-7],[8,-36],[8,-15],[15,-7],[26,-16],[19,-36],[3,-34],[-22,-13],[11,-10],[13,-15],[7,-18],[-5,-18],[-23,-32],[-14,-8],[-18,8],[0,-16],[0,-5],[-15,9],[-11,11],[-5,16],[3,20],[-11,-12],[-2,-18],[4,-18],[9,-16],[-23,-7],[-6,0],[-10,24],[-5,26],[-2,53],[-14,29],[-4,17],[10,8],[3,9],[5,19],[2,22],[-2,14],[4,-3],[8,-1],[5,-2],[-5,11],[-17,23],[-4,12],[-4,22],[-4,10],[-15,-27],[-5,0],[-4,17],[-10,23],[-4,-16],[2,-24],[-3,-9],[9,-17],[18,-62],[-8,0],[-6,2],[-4,4],[-4,9],[-3,-3],[-8,-4],[-7,20],[-9,17],[-24,34],[1,-17],[4,-14],[12,-26],[7,-10],[3,-7],[2,-8],[-4,-9],[-5,-5],[-3,-6],[6,-12],[8,16],[16,5],[15,-5],[6,-13],[-8,-72],[2,-24],[30,-73],[10,-17],[-1,-10],[-5,-10],[-8,-4],[-11,1],[-9,5],[-15,9],[0,-5],[1,-4],[3,-6],[-18,7],[-19,10],[-18,5],[-20,-8],[-9,12],[-7,16],[-1,19],[6,18],[-14,9],[-13,27],[-9,33],[-4,27],[2,18],[4,11],[6,7],[6,10],[4,11],[3,16],[-2,16],[-14,7],[-22,15],[-14,35],[-13,64],[-3,26],[3,13],[9,14],[6,13],[-2,9],[-8,1],[-10,-12],[-8,12],[-3,7],[-1,10],[-7,-4],[-7,-2],[-7,2],[-8,4],[4,-17],[2,-19],[4,-15],[10,-6],[8,-8],[6,-19],[7,-37],[3,-39],[4,-18],[7,-8],[11,-7],[10,-16],[16,-34],[-19,-20],[-4,-8],[-1,-15],[16,-102],[8,-31],[12,-16],[-2,-24],[17,-19],[11,-15],[-21,-14],[-26,-6],[-33,-3],[-31,4],[-19,13],[-2,15],[3,61],[4,8],[1,5],[-2,5],[-7,8],[-2,4],[0,37],[3,16],[18,63],[2,11],[0,30],[-12,-17]],[[3376,332],[-9,17],[-27,15],[-24,22],[-13,35],[-6,37],[-52,41],[-69,-32],[-26,-3],[-9,31],[5,20],[-7,12],[-13,2],[-11,7],[-19,31],[0,43],[9,35],[17,32],[3,15],[8,22],[14,20],[-6,10],[-5,10],[-3,11],[-3,12],[0,21],[4,26],[6,22],[5,10],[14,9],[7,22],[5,48],[11,33],[19,21],[20,19],[28,43],[5,11],[2,11],[4,7],[15,4],[4,3],[1,4],[8,8],[3,6],[0,7],[-2,5],[-3,5],[-24,36],[-77,8]],[[3185,1166],[-14,46],[-1,2],[5,4],[8,11],[5,5],[15,7],[4,4],[17,22],[6,12],[4,13],[4,29],[3,21],[16,48],[22,120]],[[3279,1510],[25,-28],[27,-2]],[[3376,332],[-4,-7],[-13,-44],[-6,-47],[6,-34],[-4,-9],[0,-21],[-2,-13],[-7,23],[-3,15],[-2,64],[-5,12],[-3,-7],[-4,-6],[-4,-5],[-6,-4],[5,-14],[0,-49],[4,-17],[10,-23],[6,-20],[9,-36],[0,-12],[-6,-11],[-8,-4],[-26,1],[-23,-3],[-5,6],[-9,34],[-3,32],[1,47],[-3,38],[-13,27],[-25,-3],[23,-23],[8,-36],[-3,-43],[-11,-40],[-1,-35],[-42,-12],[-48,6],[-23,19],[-11,-2],[-11,-4],[6,-20],[-13,-6],[-21,-2],[-16,-5],[-16,-9],[-38,-1],[-16,-8],[-20,29],[17,45],[54,76],[-11,1],[-6,2],[-6,1],[-6,-4],[-29,-42],[-4,56],[-13,50],[-5,0],[-1,-21],[2,-26],[4,-26],[6,-19],[-8,10],[-7,12],[-10,9],[-15,4],[9,-24],[9,-16],[6,-17],[-1,-28],[-6,-20],[-6,-16],[-5,-4],[-7,-3],[-5,-6],[0,-15],[7,4],[5,0],[12,-4],[-5,-10],[-24,-10],[-31,-2],[-21,7],[-2,-5],[-6,-5],[-3,-4],[-13,6],[-8,11],[-3,14],[1,19],[3,18],[12,24],[2,15],[-4,-2],[-9,-3],[-4,-2],[0,16],[3,29],[-9,1],[-9,3],[-10,5],[-10,-4],[-2,-11],[1,-15],[4,-15],[3,-9],[-3,-14],[4,-11],[7,-12],[4,-17],[-2,-22],[-7,1],[-10,11],[-12,7],[-19,1],[-6,5],[-2,37],[5,2],[2,3],[-11,20],[-1,3],[-1,18],[1,18],[-5,0],[-7,-36],[-4,5],[-13,10],[13,-36],[2,-17],[-9,-12],[-13,2],[-12,10],[-11,11],[-7,6],[-17,8],[-18,19],[-10,25],[8,26],[-9,1],[-6,-3],[-2,-8],[0,-11],[-5,0],[-14,17],[-33,24],[-10,16],[5,-4],[11,-6],[6,-5],[-6,14],[-10,6],[-12,3],[-11,6],[-18,24],[-7,11],[-22,29],[-5,4],[-77,90],[-24,40],[-8,45],[4,-2],[2,-1],[6,-4],[0,19],[-37,28],[-9,20],[-4,17],[-21,45],[-9,13],[28,-22],[-7,25],[-26,38],[-24,80],[-7,49],[-4,16],[-11,27],[-5,16],[-1,17],[-3,8],[-6,8],[-6,11],[-3,16],[4,13],[10,5],[13,-2],[13,-5],[9,-9],[15,-26],[11,-8],[-13,41]],[[2324,897],[22,-24],[33,-26],[38,-16],[42,-29],[16,-15],[21,-3],[14,2],[13,-1],[30,20],[29,25],[15,7],[15,8],[16,7],[16,-5],[25,6],[23,15],[28,49],[10,6],[29,-31],[17,-13],[18,-9],[22,-4],[14,9],[24,41],[7,5],[10,-3],[10,-4],[10,-1],[11,3],[6,5],[5,7],[6,7],[21,7],[9,7],[4,10],[-1,9],[-8,16],[-2,11],[7,25],[15,7],[36,0],[15,5],[1,6],[1,14],[1,13],[5,11],[6,9],[7,9],[16,14],[13,6],[108,20],[14,10],[-2,22]],[[5415,3790],[-46,-84],[10,-24],[27,8],[56,31],[33,8],[128,4],[127,-18],[95,-81],[74,-115],[86,-95],[37,-121],[-33,-124],[-6,-123],[-37,-42],[-42,-37],[-34,-53],[-25,-60],[-27,-181],[3,-66],[-10,-175],[-19,-99],[-1,-2]],[[5811,2341],[-10,-1],[-24,-6],[-13,-13],[-19,-46],[-13,-16],[-17,-10],[-34,-16]],[[5681,2233],[0,1],[-16,33],[-24,54],[-99,146],[-74,46],[-132,-31],[-47,-1],[-22,6],[-17,18],[8,62],[-20,53],[-100,73],[-60,27],[-57,6],[-54,-25],[-11,-34],[8,-39],[-15,-30],[-27,-18],[-36,-12],[-36,-1],[-34,7],[-33,1],[-24,-23],[-23,-31],[-25,-17],[-27,-3]],[[4684,2501],[-19,27],[-10,35],[-7,40],[-9,17],[-17,2],[-4,-11],[-9,-17],[-19,0],[-19,-5],[-31,-51],[-32,-10],[-33,0],[-35,-6],[-13,-34],[-9,-88],[-36,-62],[-58,44],[-27,72]],[[4297,2454],[29,97],[0,51],[-9,50],[-21,41],[-35,21],[-30,-10],[-24,-23],[-34,-5],[-32,19],[-31,28],[-28,33],[-23,36],[-32,82],[-8,42]],[[4019,2916],[32,-19],[36,-37],[26,-15],[23,9],[2,47],[13,41],[111,75],[35,72],[15,83],[2,33],[9,30],[17,37],[-21,18],[-32,-5],[-26,18],[-10,40],[-13,125],[2,120],[-4,38],[-16,37],[-25,31],[-24,45],[-11,52],[-2,55],[4,60]],[[4162,3906],[43,-13],[53,-7],[40,-17],[29,-8],[59,-9],[28,-10],[42,-30],[14,-7],[70,-15],[23,-10],[45,-29],[26,-10],[27,-3],[24,-9],[19,-25],[39,-27],[21,-20],[9,-6],[10,-4],[6,-2],[11,17],[-5,37],[-40,107],[-19,75],[14,73],[46,49],[110,15],[168,-70],[61,-16],[91,-4],[31,3],[0,6],[158,-147]],[[5681,2233],[-5,-2],[-24,-19],[-26,-61],[-23,-17],[-13,-1],[-10,1],[-10,-1],[-12,-8],[-11,-16],[-24,-63],[-21,-37],[-114,-115],[-77,-99],[-18,-32],[-11,-14],[-13,-9],[-5,-7],[-1,-30],[-3,-13],[-15,-3],[-18,9],[-18,3],[-14,-17],[-12,-18],[-29,-25],[-9,-17],[2,-21],[9,-16],[7,-18],[-4,-27],[-14,-22],[-15,-14],[-7,-14],[11,-27],[17,-20],[19,-18],[15,-21],[9,-27],[-4,-25],[-12,-21],[-16,-18],[-13,-21],[-5,-22],[2,-21],[2,-20],[1,-22],[-6,-23],[-18,-44],[-5,-25],[1,-14],[7,-25],[1,-11],[-22,-141],[-7,-14],[-8,-5],[-10,-2],[-9,-5],[-9,-11],[-16,-31],[-5,-14],[-12,-45],[-8,-21],[-13,-22],[-32,-64],[-5,-19],[-23,-21],[-7,-16],[2,-22],[3,-15],[3,-15],[-14,-17],[-1,0],[-2,5],[-5,5],[-8,2],[-6,-4],[-9,-9],[-8,-10],[-3,-9],[-1,-9],[-8,-20],[-2,-10],[1,-11],[5,-15],[0,-9],[-8,-17],[-9,-5],[-12,3],[-12,5],[-4,-2],[-8,0],[-5,2],[3,10],[4,7],[4,11],[1,10],[-3,5],[-8,-2],[-16,-11],[-11,-2],[-24,12],[-2,28],[8,37],[4,37],[-5,0],[-5,-36],[-19,-18],[-24,2],[-21,24],[2,4],[4,10],[-7,2],[-16,12],[4,14],[-7,11],[-23,22],[-20,13],[-1,1],[-5,18],[-9,22],[-6,9],[-10,4],[-9,5],[-10,11],[-9,12],[-4,8],[-5,0],[0,-7],[46,-54],[11,-18],[22,-49],[3,-24],[-14,-12],[6,-14],[8,-17],[10,-13],[8,-6],[3,-4]],[[4339,1476],[3,26],[7,24],[14,20],[11,20],[-3,24],[1,25],[11,14],[30,56],[10,47],[-13,32],[10,26],[33,14],[31,-11],[17,-47],[21,1],[16,18],[38,23],[13,20],[11,22],[22,0],[24,-13],[14,27],[15,78],[16,32],[19,30],[47,59],[7,71],[-16,31],[7,34],[51,37],[-2,32],[-18,28],[-8,29],[-4,32],[-15,20],[-2,12],[-7,10],[-11,9],[-11,11],[-32,45],[-12,57]],[[6998,5530],[88,-9],[293,15]],[[7379,5536],[77,-179],[20,-23],[29,-7],[27,-10],[48,-53],[29,-75],[15,-31],[8,-32],[-3,-36],[0,-37],[29,-60],[52,-32],[35,-53],[5,-72],[-83,-215],[-7,-72],[5,-38],[-8,-34],[-56,-57],[-215,-320],[-55,-61],[-46,-66],[-7,-33],[36,-111],[33,-74],[23,-29],[27,-4],[22,24],[19,28],[16,32],[26,15],[30,-17],[21,-31],[81,-95],[40,-119],[0,-70],[10,-69],[21,-56],[10,-52],[0,-1],[1,0]],[[7694,3311],[-49,-60],[-52,-95],[-17,-20],[-15,-14],[-6,-9],[4,-6],[20,-5],[12,-12],[41,-75],[33,-44],[10,-26],[-7,-24],[-8,-4],[-7,3],[-8,4],[-9,1],[-12,-4],[-9,-7],[-36,-40],[-12,-10],[-2,-10],[-2,-10],[-5,-8],[-5,-2],[-13,-1],[-10,-3],[-8,1],[-4,-1],[-4,-5],[-3,-13],[-3,-6],[-48,-38],[-51,-58],[-15,-27],[-5,-27],[6,-16],[18,-26],[4,-18],[-2,-29],[-6,-27],[-24,-71],[-19,-34],[-23,-15],[-33,-4],[-22,-23],[-12,-35],[-6,-43],[-5,-24],[-16,-19],[-21,-13],[-21,-6],[-9,1],[-18,5],[-9,1],[-3,-2],[-9,-10],[-5,-2],[-6,1],[-10,7],[-4,2],[-25,-3],[-51,-7],[-23,4],[-13,16],[-17,49],[-14,80],[-2,41],[1,41],[-3,50],[-16,42],[-28,28],[-78,17],[-26,33],[-17,46],[-8,47],[-13,42],[-28,23],[-68,32],[-58,38],[-22,9],[-15,15],[-5,51],[-15,25],[-12,-29],[-11,-38],[-7,-39],[-5,-80],[-3,-3],[-5,-2],[-5,-5],[-11,-17],[-6,-14],[-4,-16],[0,-24],[-215,-3],[-23,8],[-17,17],[-9,20],[-12,77],[-7,17],[-11,3],[-20,-14],[-204,-215],[-20,-10],[-16,6],[-16,9],[-20,2],[-15,-22],[-64,-249],[0,-3],[-11,-10],[-30,0]],[[5415,3790],[29,31],[121,100],[17,19],[-3,27],[-6,20],[1,18],[-2,53],[-45,69],[4,32],[9,27],[13,23],[21,11],[41,-17],[20,-13],[23,-5],[25,-9],[24,-4],[23,1],[34,27],[23,45]],[[5787,4245],[45,-4],[63,6],[60,21],[54,51],[49,61],[54,49],[60,40],[23,26],[44,65],[19,37],[40,60],[193,58],[132,80],[29,68],[-1,40],[-11,64],[6,32],[0,31],[-24,98],[-14,29],[-7,31],[-9,77],[6,67],[-6,55],[-18,50]],[[6574,5437],[45,35],[106,4],[103,60],[55,11],[57,-17],[58,0]],[[2954,4639],[-35,-56],[-34,-145],[-13,-107],[-9,-30],[-17,-26],[-27,-7],[-92,26],[-115,7],[-83,24],[-83,39],[-43,51],[-33,17],[-37,-43],[-95,-147],[-6,-34],[25,-59],[12,-19],[14,-15],[9,-19],[34,-39],[55,-43],[6,-62]],[[2387,3952],[-89,-4],[-30,-11],[-17,-27],[-5,-33],[-10,-24],[-8,-3],[-7,3],[-35,-8],[-20,6],[-33,3],[-56,43],[-52,-20],[-17,9],[-4,18],[-10,7]],[[1994,3911],[-12,4],[-48,-8],[-25,20],[-17,36],[-35,1],[-33,-17],[-47,-5],[-6,-8],[-1,7],[-23,-6],[-22,-11],[-46,-13],[-55,8],[-54,-4]],[[1570,3915],[-13,11],[-14,3],[-11,22],[-24,98],[-30,61],[-22,17],[-19,22],[-30,54],[-28,139],[-30,56],[-74,203],[-11,63],[10,63],[19,23],[13,26],[21,26],[28,20],[29,50],[-15,40],[-41,-30],[-23,-1],[-61,17],[-99,44],[-37,24],[-31,34],[-19,46],[-24,38],[-38,21],[-40,-5],[-38,-34],[-21,-50],[-8,-68],[-16,-22],[-19,-17],[-172,-107],[-36,-34],[-33,-20],[-38,-35],[-98,-55],[-11,-2],[-8,12],[-10,6],[-7,11],[-14,4],[-13,-2],[-19,-7],[-18,-14],[-34,-37],[-17,-12],[-13,-13],[-6,-11],[-19,-9],[-46,-46],[-15,-23],[-20,-17],[-66,-19],[-16,2],[-17,0],[-43,-47],[-6,-6]],[[59,4428],[-16,254],[0,1],[0,11],[5,8],[14,8],[5,6],[1,9],[-5,16],[-1,9],[3,16],[11,30],[0,16],[-3,7],[-4,2],[-4,2],[-1,9],[2,2],[9,17],[3,6],[5,29],[1,66],[-2,28],[64,-7],[11,2],[8,7],[7,10],[9,7],[9,2],[26,1],[9,-2],[9,-5],[8,-7],[8,-5],[10,0],[57,19],[20,17],[13,33],[28,106],[17,41],[5,22],[0,67],[-3,17],[-10,33],[-6,29],[4,29],[16,32],[6,6],[13,5],[6,7],[51,82],[1,6],[-4,13],[-1,7],[6,26],[13,5],[17,-4],[14,-1],[27,19],[6,27],[-6,32],[-11,32],[-3,20],[2,24],[8,21],[13,12],[60,30],[33,11],[50,-7],[14,17],[22,50],[27,40],[9,20],[5,89],[5,17],[13,15],[12,7],[11,10],[7,23],[1,6]],[[828,6095],[4,1],[74,16],[133,5],[57,-9],[23,-24],[280,-409],[13,-12],[13,-10],[29,-1],[13,-70],[-8,-83],[-1,-78],[27,-58],[62,9],[72,-13],[2,-7],[2,-39],[-1,-20],[1,0],[1,0],[1,1],[0,1],[0,-20],[3,-17],[7,-14],[13,-12],[13,-6],[42,-9],[23,-11],[10,-21],[1,-28],[-4,-30],[2,-32],[15,-20],[23,-9],[26,2],[33,12],[37,27],[54,21],[12,0],[11,-3],[20,-12],[1,-6],[15,-8],[28,-24],[44,-26],[12,-11],[14,-23],[14,-19],[4,-11],[1,-10],[-1,-11],[1,-12],[6,-14],[10,-9],[13,-5],[79,-16],[56,4],[12,-3],[10,-6],[9,-9],[15,-19],[10,-10],[10,-6],[11,-3],[26,-2],[12,-2],[11,-5],[11,-8],[5,-5],[11,-18],[18,-18],[7,-11],[7,-11],[8,-18],[3,-5],[10,-11],[13,-5],[49,-2],[6,-1],[18,-9],[7,-1],[11,-22],[12,-20],[9,-20],[5,-6],[10,-5],[45,1],[36,-7],[13,0],[10,3],[26,15],[21,5],[91,1],[13,-3],[12,-5],[26,-30],[6,-3],[46,11]],[[1392,2184],[-180,41],[-213,22],[-355,-22],[-19,4],[-10,9],[-8,12],[-12,11],[8,5],[5,1],[5,-1],[5,-5],[13,15],[5,-6],[2,-16],[3,-15],[29,33],[5,-1],[3,-8],[6,0],[11,5],[16,0],[14,3],[13,9],[12,16],[1,12],[-2,11],[1,9],[8,4],[34,0],[18,4],[36,15],[12,-4],[18,9],[17,12],[12,17],[4,22],[11,5],[69,13],[-6,6],[-6,3],[-5,0],[-6,-2],[-47,14],[-47,-22],[-45,-32],[-40,-17],[-15,0],[-9,-1],[-29,-20],[-10,-4],[-10,-3],[-10,0],[-2,2],[-11,5],[-10,-1],[-6,5],[-2,4],[-4,13],[0,13],[5,22],[1,15],[-14,-11],[-10,-10],[-19,-25],[-6,-4],[-9,0],[-8,-2],[-3,-9],[1,-7],[5,-16],[0,-9],[-3,-11],[-12,-23],[-2,-12],[-3,-7],[-6,-6],[-4,-7],[5,-9],[4,-5],[2,-6],[1,-6],[5,-5],[-4,-23],[-49,-7],[-93,6],[-110,-16],[-129,8],[-187,-22],[1,64],[6,46]],[[34,2291],[5,0],[28,-3],[28,3],[21,-8],[21,1],[23,18],[15,23],[0,15],[9,5],[182,-10],[49,9],[12,17],[9,51],[12,21],[13,18],[12,53],[6,15],[26,13],[19,-8],[38,-24],[20,-31],[29,-2],[17,4],[9,18],[3,14],[7,10],[487,3],[50,-16],[-9,-27],[-20,-20],[-8,-26],[9,-25],[1,-13],[23,-24],[26,15],[25,22],[27,7],[24,-11],[9,-22],[-8,-21],[-48,-33],[1,-26],[20,-15],[23,-8],[12,-13],[14,-11],[19,6],[48,-2],[23,-10],[1,-28],[-3,-29],[-1,-2]],[[2797,7117],[35,-57],[64,-132],[13,-69]],[[2909,6859],[-17,-10],[-16,-23],[-7,-26],[-5,-87],[1,-26],[14,-53],[1,-12],[-1,-13],[-4,-23],[-11,-35],[-2,-13],[-1,-28],[-1,-13],[-5,-13],[-3,-21],[5,-35],[27,-25],[21,-31],[14,-35],[29,5],[21,29],[18,35],[43,58],[100,94],[59,16],[22,-18],[10,-33],[27,-6],[60,35],[32,7],[32,-6],[19,16],[-4,41],[27,15],[30,-3],[26,-13],[7,-20],[5,-84],[14,-5],[29,11],[46,-48],[1,-83],[-11,-37],[18,-23],[60,-27],[25,-21],[-2,-36],[-20,-33],[-28,-22],[-27,-26],[-22,-34],[-28,-22],[-19,-29],[37,-60],[59,-31],[62,-9],[124,2],[40,-34],[16,-167],[-2,-38],[-21,-21],[-26,-3],[-19,-18],[17,-28],[31,-10],[17,-19],[-6,-29],[11,-26],[26,-16],[5,-32],[-19,-27],[-12,-13],[-9,-17],[-2,-22],[-5,-20],[-46,-40],[-7,-38],[17,-32],[11,-8],[14,-23],[-1,-15],[-10,-32],[6,-17],[21,8],[19,-5]],[[3866,5230],[-117,-207],[-5,-1],[-39,27],[-78,94],[-50,19],[-154,-7],[-21,-12],[-3,-30],[8,-742],[5,-19],[20,-44],[38,-5]],[[3470,4303],[-11,-41],[-25,-30],[-17,-7],[-13,-16],[1,-23],[-3,-18],[-12,9],[-11,-11],[-9,-25],[-5,-28],[-15,-18],[-2,7],[-12,13],[-1,6],[-10,6],[-32,42],[-32,65],[-10,13],[-82,78],[-7,4],[-19,48],[-11,50],[-2,31],[-2,9],[-3,9],[-4,1],[-2,8],[-13,33],[-2,8],[0,19],[-21,43],[-11,14],[-13,9],[-17,3],[-31,26],[-6,6],[-14,2],[-37,-9]],[[828,6095],[2,18],[-2,17],[-8,13],[-56,72],[-12,24],[-1,19],[17,47],[21,40],[4,13],[0,20],[3,7],[5,9],[17,20],[16,7],[17,-4],[54,-34],[13,2],[13,20],[5,19],[1,54],[7,27],[22,52],[6,28],[0,32],[0,25],[-4,31],[-8,20],[-11,7],[-12,3],[-10,4],[-8,12],[-8,34],[-4,11],[-6,9],[-8,7],[-6,9],[-5,12],[1,18],[19,55],[1,31],[-18,93],[-8,18],[-6,19],[-4,21],[0,22],[9,40],[-7,9],[-7,0]],[[862,7127],[6,8],[76,-11],[74,-57],[94,-53],[44,-6],[228,7],[86,16],[85,-28],[101,-81],[53,-20],[2,-26],[-28,-186],[0,-39],[-1,-18],[-7,-14],[-21,-26],[-1,-19],[-97,-68],[-31,-66],[-6,-77],[4,-40],[12,-36],[22,-20],[18,-24],[-5,-76],[-13,-77],[20,-22],[57,-4],[10,28],[1,42],[9,36],[29,12],[96,26],[29,11],[24,22],[21,68],[-26,71],[-39,63],[-5,35],[4,36],[-4,78],[14,69],[26,12],[58,-10],[56,33],[59,21],[22,22],[-18,68],[-34,53],[40,62],[-2,42],[-8,42],[-10,30],[-23,9],[-11,8],[-7,19],[-11,7],[-14,0],[-64,13],[-60,31],[-53,49],[14,66],[114,63],[247,61],[60,-2],[50,-37],[11,-77],[30,-67],[26,-20],[14,-35],[-5,-80],[1,-41],[11,-36],[22,-10],[83,0],[56,12],[144,76],[28,9],[29,3],[22,21],[9,16],[21,30],[12,12],[29,2],[26,-21]],[[1172,2956],[59,35],[17,-44],[7,-47],[34,5],[31,25],[39,2],[27,-29],[10,-26],[8,-26],[2,-17],[5,-15],[24,-2],[29,20],[17,-6],[18,-1],[14,7],[15,6],[34,3],[13,-19]],[[1575,2827],[-19,-137],[-16,-26],[-75,-68],[-41,-55],[-21,-69],[0,-31],[12,-27],[12,-10],[26,-11],[14,-3],[43,-1],[36,27],[13,24],[21,13],[16,-27],[0,-74],[7,-49],[-2,-14],[-9,-13],[-14,-5],[-42,-39],[-27,-4],[-13,-7],[14,-21],[25,0],[46,-24],[2,-28],[-14,-20],[-50,5],[-1,-1]],[[1518,2132],[-73,40],[-53,12]],[[34,2291],[3,22],[3,10],[15,56],[2,22],[-7,44],[0,21],[10,22],[15,17],[10,9],[5,11],[-3,48],[-2,11],[-5,5],[-10,1],[-9,3],[-7,6],[-6,11],[-4,20],[2,23],[9,44],[-4,43],[-12,40],[-2,38],[21,37],[10,6],[11,4],[8,6],[4,11],[-5,10],[-22,22],[-7,11],[-4,14],[1,7],[4,7],[8,20],[6,10],[3,10],[1,15],[-18,256],[2,11],[7,5],[9,0],[18,-5],[2,2],[1,6],[2,9],[2,44],[-18,38],[-25,37],[-17,38],[-4,41],[2,34],[8,140],[-3,15],[-7,15],[-20,28],[-9,30],[-7,13],[0,4]],[[1,3769],[5,4],[72,63],[81,-4],[21,-48],[4,-117],[14,-56],[24,-5],[8,54],[12,45],[32,1],[5,-91],[-31,-106],[1,-22],[16,-54],[35,-36],[27,-43],[38,-85],[59,-66],[45,-19],[47,2],[33,36],[34,103],[34,29],[31,-29],[14,-50],[25,-18],[24,17],[25,14],[83,-3],[29,-51],[-1,-58],[3,-18],[24,-22],[24,-16],[5,-18],[0,-20],[3,-16],[5,-15],[10,-63],[-31,-52],[-23,-48],[51,-3],[103,16],[51,17],[23,19],[27,11],[25,2],[25,6]],[[2798,3436],[-15,-32],[-20,-28],[-10,-6],[-22,-7],[-11,-12],[-8,-36],[24,-21],[5,-18],[-10,-22],[4,-32],[5,-15],[2,-23],[-7,-34],[-12,-15],[-13,-11],[-21,-22],[-18,-26],[-1,-13],[3,-11],[-39,-109],[-4,-25],[-12,-18],[-22,-29],[-11,-38],[-2,-36],[12,-31],[3,-13],[-3,-10],[-4,-2],[-3,-7],[0,-16],[-19,-6],[-8,-26],[-9,-66],[-5,-14],[-12,-25],[-9,-8],[-14,-6],[-26,8],[-11,12],[-24,2],[-41,-41],[-18,-4],[-22,69],[8,29],[14,26],[-38,38],[-234,0],[-13,-8],[-10,-14],[0,-26],[-14,-23],[-11,-28],[-29,-35],[-26,-40],[-10,-22],[-3,-34],[-3,-14],[0,-33],[4,-8],[7,-5],[15,-28],[14,-55],[-19,-54],[-14,-27],[-6,-30],[-12,-26],[-21,-14],[-18,-8],[-11,-22],[-5,-30],[-5,-13],[-5,-7],[-2,-8],[5,-10],[17,-12],[20,-22],[18,-25],[2,-14],[8,-4],[9,0],[11,-6],[9,-8],[15,-30],[0,-33]],[[2037,1930],[-93,-282],[-1,-1]],[[1943,1647],[-97,158],[-17,20],[-33,17],[-15,22],[-21,41],[-29,38],[-26,25],[-63,50],[-27,21],[-51,60],[-32,25],[-14,8]],[[1575,2827],[32,20],[13,23],[7,27],[22,48],[36,35],[33,11],[31,-16],[42,-34],[10,-6],[22,-2],[9,8],[2,22],[-2,24],[3,28],[-1,78],[7,50],[15,49],[36,23],[41,14],[1,42]],[[1934,3271],[58,23],[31,2],[92,-8],[59,4],[42,-16],[21,-51],[17,-72],[47,-23],[88,92],[46,133],[14,99],[11,30],[37,48],[22,16],[10,17],[8,19],[22,15],[22,-13],[21,10],[15,30]],[[2617,3626],[67,15],[25,-14],[-5,-41],[42,-80],[52,-70]],[[1934,3271],[-66,221],[-5,53],[9,46],[7,125],[39,63],[32,19],[25,29],[19,84]],[[2387,3952],[-16,-29],[1,-44],[16,-7],[23,16],[30,9],[30,4],[16,-3],[12,-11],[-1,-23],[-19,-14],[-24,-37],[-6,-44],[12,-45],[28,-31],[11,1],[14,-14],[65,-40],[38,-14]],[[1172,2956],[57,376],[-5,29],[-16,25],[-14,33],[-18,29],[-23,18],[-17,23],[1,31],[14,26],[7,29],[5,31],[3,68],[13,47],[57,-19],[42,39],[0,23],[7,9],[9,8],[15,28],[18,23],[26,-13],[23,-25],[31,-62],[34,-8],[17,22],[24,22],[5,6],[5,9],[6,8],[2,-4],[15,14],[15,12],[15,8],[19,4],[4,6],[7,13],[2,36],[-7,35]],[[1,3769],[-1,4],[2,8],[8,20],[3,9],[4,66],[10,66],[2,62],[2,19],[7,18],[8,17],[7,19],[0,23],[-5,22],[-17,43],[-6,23],[-3,25],[1,20],[6,43],[0,10],[-2,19],[0,9],[5,13],[16,24],[7,12],[6,35],[-2,30]],[[3279,1510],[3,44],[5,28],[9,27],[16,36],[33,55],[3,9],[1,10],[-1,18],[1,9],[11,53],[-3,55],[4,23],[16,17],[11,5],[8,5],[6,8],[3,14],[3,46],[-1,15],[-5,13],[-11,27],[-3,14],[-3,40],[-15,51],[-5,58],[-23,101],[-4,31],[0,33]],[[3338,2355],[7,2],[19,-1],[22,-6],[21,4],[27,34],[19,102],[19,49],[57,67]],[[3529,2606],[7,-29],[0,-34],[10,-6],[45,2],[48,-25],[26,-7],[26,-14],[-4,-70],[-46,-63],[-23,-78],[8,-25],[12,-8],[28,-6],[13,-9],[17,-29],[26,-76],[5,-9],[2,-11],[-5,-8],[-6,-3],[1,-20],[-2,-18],[-4,-14],[7,-12],[13,3],[12,12],[14,-11],[3,-25],[20,-18],[-4,-36],[10,-31],[13,-28],[9,-32],[18,-26],[24,-5],[22,8],[9,-2],[15,-10],[4,-11],[9,-2]],[[6953,7308],[-17,-15],[-14,-23],[-20,-27],[-78,-56],[-40,-67],[-27,-25],[-64,-24],[-24,-26],[-26,-78],[-28,-122],[-13,-39],[-43,-76],[-3,-29],[89,-47],[27,-72],[8,-81],[60,-35],[54,-41],[17,-63],[-2,-144],[3,-32],[-2,-30],[-95,-60],[-5,-34],[35,-60],[172,-158],[25,-68],[5,-67],[14,-65],[24,-60],[18,-29],[-5,-25]],[[6574,5437],[-26,13],[-139,107],[-408,234],[-26,-7],[-12,-10],[-11,-24],[32,-56],[11,-37],[-8,-34],[-54,-26],[-21,-23],[-25,-64],[-30,-15],[-32,-8],[-132,-8],[-118,26],[-52,21],[-28,62],[-38,54],[-30,12],[-20,25],[4,32],[11,30],[15,28],[6,31],[-3,85],[-18,72],[-54,23],[-96,-21],[-31,26],[1,166],[-4,51],[-17,57],[-29,45],[-49,16],[-48,-10]],[[5095,6310],[-18,26],[-19,22],[-25,17],[-12,27],[28,62],[10,68]],[[5059,6532],[38,52],[23,68],[-6,72],[-38,56],[-24,79],[-2,87],[5,78],[25,66],[50,4],[30,16],[23,30],[32,60],[86,110],[55,31],[13,-10],[14,-9],[15,4],[63,32]],[[5461,7358],[51,-1],[50,-17],[52,-27],[53,-4],[52,10],[33,-52],[42,-18],[107,10],[48,15],[37,-42],[18,-63],[1,-67],[-8,-67],[20,-58],[47,-24],[132,12],[29,-18],[32,-15],[23,18],[-10,38],[18,70],[92,44],[29,22],[20,29],[4,33],[-60,25],[-72,3],[-132,31],[-61,29],[-80,132],[-35,74],[-14,-5],[-27,0],[-17,28],[4,34],[27,63],[-1,36],[-12,75],[-13,34],[-29,8],[-30,-4],[-51,-18],[-35,30],[18,77],[44,49],[70,8],[28,16],[28,21],[254,119],[13,36],[-7,42],[5,34],[60,207],[8,47],[12,44],[19,23],[26,12],[63,13],[25,-20],[44,-13],[110,89]],[[6615,8565],[57,-48],[48,-56],[11,-40],[13,-82],[1,-42],[4,-36],[17,-33],[17,-40],[5,-45],[1,-73],[25,-166],[100,-304],[5,-88],[-29,-161],[22,-35],[41,-8]],[[7729,6007],[-9,-90],[4,-137],[-12,-44],[-31,-31],[-155,-115],[-70,-38],[-77,-16]],[[6953,7308],[115,38],[115,-69],[53,-51],[46,-60],[40,-68],[88,-108],[17,-28],[6,-35],[-11,-239],[6,-75],[7,-31],[59,-7],[31,4]],[[2324,897],[-5,16],[18,-3],[17,-4],[-6,12],[-23,31],[-9,6],[-3,-4],[1,-19],[-3,-4],[-8,-1],[-6,-1],[-12,-6],[-11,6],[-20,-4],[-9,6],[-1,8],[1,38],[-3,48],[-18,93],[5,14],[19,5],[56,2],[15,5],[2,-9],[3,-7],[7,-13],[6,7],[7,15],[4,7],[5,4],[29,15],[14,3],[13,-1],[8,-7],[5,0],[-6,13],[-20,22],[-8,15],[-3,15],[-1,17],[2,16],[5,13],[11,9],[13,3],[27,-1],[10,6],[10,13],[12,24],[-13,-7],[-11,-12],[-12,-8],[-16,5],[-2,-5],[-5,-4],[-4,-6],[-19,6],[-20,-13],[-12,-23],[5,-26],[-9,-26],[-11,-15],[-14,-4],[-17,9],[-5,7],[-2,7],[-3,5],[-10,2],[-5,-6],[3,-14],[5,-14],[5,-9],[-48,4],[-94,39],[-4,5],[-4,12],[-3,5],[-26,30],[-17,15],[-6,23],[-2,22],[2,10],[6,4],[13,18],[7,6],[7,2],[81,-5],[31,-6],[17,-12],[6,0],[8,15],[14,37],[7,12],[10,6],[14,-1],[12,-4],[9,-8],[2,-8],[5,-23],[2,-5],[9,1],[4,3],[1,6],[0,12],[-6,16],[-14,18],[-17,14],[-14,8],[-16,0],[-8,-10],[-10,-32],[-9,-10],[-14,-8],[-15,-5],[-14,1],[-16,11],[-6,15],[0,18],[16,57],[1,15],[-1,19],[-5,0],[-23,-77],[-9,-21],[-11,-13],[-14,-7],[-20,-2],[-9,-3],[-19,-14],[-21,-10],[-6,3],[-11,9],[-13,15],[-13,20],[-10,22],[-8,29],[-8,14],[-7,19],[-3,24],[2,21],[5,24],[7,19],[11,8],[9,-4],[17,-17],[6,-2],[4,7],[-1,9],[-4,11],[1,10],[26,29],[69,31],[19,40],[-18,-4],[-28,-32],[-33,-12],[-63,-42],[-12,-11],[-42,-49],[-9,1],[-31,85],[-4,6]],[[2037,1930],[58,-35],[39,-57],[-7,-68],[7,-54],[16,-16],[15,7],[48,52],[-5,34],[9,26],[54,-4],[25,5],[31,-3],[32,-28],[15,-7],[9,-2],[8,8],[5,14],[46,35],[52,3],[97,-66],[45,-62],[28,-19],[24,-21],[-4,-39],[-18,-36],[4,-12],[9,-10],[5,-12],[-4,-12],[1,-17],[14,-6],[15,1],[82,21],[43,39],[34,50],[46,44],[35,49],[10,40],[-1,40],[-11,12],[-15,5],[-50,57],[-26,52],[-10,42],[-2,35],[-27,58],[3,37],[12,29],[19,23],[29,-4],[21,-27],[16,-34],[24,0],[34,54],[22,17],[79,41],[102,76],[50,27],[30,0],[29,-6],[24,10],[26,39]],[[2798,3436],[14,-10],[17,4],[14,-11],[-3,-20],[27,-12],[6,-23],[-9,-46],[20,-35],[39,1],[38,20],[17,13],[16,4],[9,-18],[12,-13],[28,-24],[24,-33],[19,-2],[31,10],[18,-2],[21,-24],[19,-58],[11,-18],[3,-20],[11,-19],[42,9],[34,18],[22,2],[12,-12],[10,-14],[2,-18],[11,-9],[22,-8],[2,-9],[13,-35],[2,-10],[2,-20],[-4,-19],[-10,-39],[-4,-54],[-7,-24],[-1,-11],[1,-46],[-2,-9],[-22,-58],[-9,-40],[-1,-18],[5,-54],[-4,-134],[4,-44],[16,-59],[2,-15],[0,-15]],[[4297,2454],[-55,-7],[-28,3],[-27,-21],[33,-133],[-1,-74],[-36,-138],[15,-27],[1,-15],[10,-43],[1,-32],[6,-32],[2,-32],[-17,-31],[-20,-28],[-5,-52],[9,-54],[-22,-15],[-30,35],[-18,15],[-21,13],[-42,-16]],[[3529,2606],[22,55],[28,22],[2,-8],[0,-10],[4,-15],[6,-6],[13,-24],[21,-12],[37,36],[31,47],[70,60],[41,48],[48,77],[15,18],[26,11],[27,26],[30,20],[41,-3],[28,-32]],[[5095,6310],[-8,-30],[-4,-35],[-20,-32],[-31,-18],[-41,-58],[-15,-78],[21,-78],[-33,-137],[1,-80],[-5,-40],[7,-35],[-35,-59],[1,-17],[-3,-19],[-23,-21],[0,-149],[34,-61],[39,-51],[32,-56],[-4,-63],[-17,-60]],[[4991,5133],[-31,-44],[-22,-62],[-26,-58],[-36,-45],[-32,-5],[-21,25],[-11,24],[-16,19],[-34,54],[-75,25],[-27,14],[-22,-26],[-48,-84],[-66,-45],[-22,101],[-8,122],[-33,24],[-27,27],[0,26],[-7,24],[-27,31],[-51,-10],[-33,-73],[-28,-16],[-29,15],[-13,0],[-14,3],[-21,20],[-26,-2],[-20,13],[-13,27],[-23,-13]],[[4129,5244],[-26,-7],[-16,35],[-30,14],[-26,-45],[-18,-17],[-21,11],[-23,4],[-23,1],[-80,-10]],[[2909,6859],[38,16],[12,13],[4,14],[0,14],[1,13],[7,13],[8,8],[20,9],[9,6],[10,16],[15,39],[10,15],[17,8],[17,-2],[55,-25],[18,-5],[19,0],[55,20],[9,1],[14,-2],[7,2],[7,5],[70,33],[15,11],[13,14],[11,17],[8,22],[15,95],[10,31],[17,26],[59,45],[16,20],[14,32]],[[3509,7383],[38,-23],[20,-7],[45,-1],[17,-16],[10,-25],[-2,-19],[-14,-13],[-22,-30],[1,-29],[61,-20],[29,-22],[43,-55],[28,-5],[27,18],[21,28],[-1,29],[-15,27],[14,56],[64,-1],[30,-13],[23,15],[4,37],[14,34],[52,37],[61,-14],[32,-18],[29,-25],[16,-28],[24,-13],[67,34],[29,54]],[[4254,7375],[58,6],[98,90],[117,46],[29,-17],[-1,-40],[-16,-34],[-3,-37],[17,-33],[27,-23],[58,-25],[28,-27],[20,-34],[58,-27],[63,-21],[86,-112],[16,-145],[-16,-80],[13,-124],[-12,-39],[-35,-11],[-18,-29],[46,-47],[67,-10],[36,-54],[16,-10],[35,-10],[18,4]],[[3470,4303],[51,2],[31,-4],[30,6],[7,1]],[[3589,4308],[-7,-35],[-21,-68],[41,-88],[3,-68],[-13,-153],[-10,-33],[-15,-29],[-9,-42],[-2,-43],[7,-2],[20,10],[29,22],[16,18],[6,3],[1,6],[42,32],[169,71],[27,3],[147,-15],[118,14],[14,-1],[10,-4]],[[5787,4245],[-31,55],[-44,34],[-98,52],[-52,2],[-53,-20],[-77,-16],[-78,0],[-51,18],[-69,45],[-18,43],[4,50],[-6,43],[-20,35],[-16,51],[14,43],[21,32],[20,37],[31,12],[19,24],[35,58],[13,37],[4,29],[-15,24],[-23,19],[-26,-9],[-13,-8],[-14,-2],[-57,-1],[-55,13],[-39,51],[-13,71],[-41,37],[-48,29]],[[3589,4308],[120,23],[118,39],[107,66],[37,50],[29,59],[36,124],[39,210],[-3,102],[2,65],[19,111],[15,34],[10,4],[10,8],[3,20],[-2,21]],[[5461,7358],[3,13],[-1,28],[1,15],[8,31],[13,29],[74,82],[7,23],[-19,14],[-10,4],[-20,15],[-23,30],[-12,23],[-19,59],[-9,8],[-23,3],[-35,-4],[-14,15],[12,64],[30,54],[7,24],[4,26],[10,32],[2,36],[-13,62],[-9,30],[-38,5],[-30,-24],[-52,0],[-1,26],[-6,25],[-6,4],[-34,-6],[-20,-9],[-8,4],[-9,8],[-11,22],[7,16],[9,14],[4,18],[-1,96],[-35,53],[-52,8],[-47,19],[-7,32],[1,35],[-10,29],[-21,18],[-22,14],[-20,18],[-7,38],[1,39],[-4,27],[-20,11],[-54,18],[-50,8],[-49,-12],[-42,-26],[-25,-46],[-14,-51],[-9,-20],[-15,10],[-4,15],[0,15],[-6,18],[-42,92]],[[4676,8635],[-10,31],[-17,24],[-67,2],[-44,33],[-1,67],[6,70],[12,27],[89,17],[60,1],[55,-8],[128,7],[16,-19],[14,-53],[23,-47],[19,-16],[21,-10],[19,2],[26,18],[11,-16],[12,-13],[33,-4],[45,13],[40,26],[37,36],[9,18],[6,20],[8,14],[10,12],[14,7],[5,17],[1,9]],[[5256,8920],[243,-35],[30,0],[45,15],[15,2],[177,-26],[18,2],[5,3],[9,7],[10,10],[6,9]],[[5814,8907],[23,-8],[79,-32],[73,39],[12,26],[10,28],[15,13],[58,29],[40,14],[79,38],[37,12],[35,-13],[21,-40],[22,-104],[8,-26],[36,-7],[55,19],[28,-2],[30,-18],[30,-8],[29,1],[23,-21],[25,-67],[16,-147],[17,-68]],[[4254,7375],[-57,60],[-13,53],[6,50],[14,50],[26,39],[38,12],[47,29],[37,11],[-3,41],[-20,65],[-8,13],[-3,16],[4,19],[1,20],[-4,33],[-17,67],[5,217],[-8,102],[10,47],[64,54],[146,67],[30,36],[28,100],[20,44],[38,14],[41,1]],[[3509,7383],[13,46],[8,48],[-3,37],[5,35],[-28,64],[31,186],[49,28],[62,0],[5,-2],[7,-10],[5,-3],[13,9],[35,34],[20,23],[5,34],[15,18],[26,-8],[25,11],[-10,62],[-45,46],[-29,16],[-16,25],[13,33],[18,60],[6,27],[-5,32],[-8,30],[-5,54],[-12,52],[-23,55],[4,62],[-18,53],[-26,429],[14,109]],[[3660,9078],[5,1],[17,11],[40,42],[51,73],[18,4],[87,-19],[30,0],[26,10],[303,223],[28,16],[29,3],[211,-36],[23,-11],[10,-9],[19,-23],[23,-17],[29,-28],[12,-7],[24,-8],[1,0],[11,-7],[11,-11],[21,-31],[83,-93],[6,-4],[9,-4],[3,-1],[3,3],[10,6],[9,4],[21,3],[10,0],[22,-6],[20,-12],[37,-33],[16,-22],[24,-49],[14,-21],[31,-22],[219,-79],[30,-4]],[[3402,9265],[-42,-41],[-64,-45],[-81,0],[-82,24],[-14,16],[-12,19],[-15,7],[-16,5],[-18,2],[-39,0],[-12,-13],[-4,-26],[-1,-27],[-10,-43],[-20,-7],[-33,16],[-61,-10],[-52,-36],[-10,-29],[15,-178],[-25,-57],[-30,-16],[-31,-10],[-187,-23],[-42,-40],[-32,-62],[-43,-67],[-40,-33],[-5,-68],[17,-77],[3,-81],[-41,-54],[-255,-13],[-122,24],[-31,-124],[-7,-488]],[[1960,7710],[-16,-13],[-18,-2],[-9,16],[-13,10],[-9,-4],[-10,-4],[-13,9],[-18,5],[-17,-5],[-159,-88],[-29,-44],[-36,-28],[-38,15],[-26,38],[6,99],[37,97],[28,163],[-5,400],[30,65],[59,18],[57,-23],[38,24],[3,78],[-25,168],[4,39],[8,38],[7,76],[-20,65],[-27,58],[5,42],[9,40],[5,14],[4,16],[-1,20],[3,19],[12,30],[3,33],[-14,22],[-22,-9],[-15,-24],[-13,-28],[-26,-19],[-32,4],[-30,17],[-27,24],[-29,13],[-30,8],[-57,26],[-52,38],[-25,30],[-26,24],[-30,-7],[-29,-18],[-54,11],[-63,-2],[-7,-2]],[[1208,9302],[3,24],[1,249],[54,2],[25,6],[23,14],[132,153],[39,34],[45,22],[99,29],[166,50],[27,3],[19,-10],[18,-22],[19,-10],[49,-4],[84,19],[119,-7],[29,7],[10,5],[25,22],[12,17],[14,38],[9,16],[23,14],[124,26],[27,-7],[236,-114],[235,-114],[8,-6],[5,-5],[6,-3],[8,3],[49,33],[16,4],[45,-12],[15,-4],[56,-39],[117,-136],[136,-182],[67,-152]],[[2797,7117],[-8,159],[-64,125],[-32,16],[-16,32],[21,78],[4,71],[-39,47],[-32,13],[-62,13],[-14,-4],[-12,-9],[-127,-11],[-50,13],[-72,39],[-12,30],[-20,20],[-47,-9],[-20,2],[-18,10],[-18,-1],[-15,-18],[-6,-25],[-15,-10],[-20,-2],[-44,-13],[-17,4],[-13,14],[-34,16],[-35,-7]],[[3402,9265],[21,-47],[49,-69],[31,-34],[27,-25],[25,-12],[28,-4],[62,1],[15,3]],[[5814,8907],[143,206],[28,33],[16,12],[9,4],[4,-1],[3,1],[7,9],[4,10],[3,26],[3,10],[15,18],[158,108],[35,18],[405,106],[23,6],[80,8],[152,-21],[405,2],[252,-78],[92,-46],[116,-86],[39,-38],[16,-10],[49,-14],[28,3],[12,2],[17,15],[14,3],[42,-18],[9,-6],[4,-7],[0,-6],[1,-4],[7,-1],[3,2],[4,6],[5,5],[8,1],[8,-6],[6,-9],[7,-5],[7,6],[14,-5],[29,-1]],[[862,7127],[-1,0],[-8,-1],[-7,1],[-20,24],[-149,259],[-13,28],[-1,24],[17,56],[5,16],[10,47],[58,121],[18,24],[43,31],[10,13],[6,22],[-4,21],[-10,19],[-20,26],[-4,2],[-2,4],[-5,11],[-3,10],[-5,59],[4,17],[9,15],[15,18],[14,34],[-4,36],[-21,76],[1,45],[22,137],[-8,259],[3,11],[182,168],[54,63],[133,256],[27,223]],[[9232,6942],[-4,-13],[-149,-262],[-23,-59],[-31,-131],[-28,-196],[-19,-65],[0,-13],[6,-21],[1,-12],[-2,-14],[-13,-35],[-10,-16],[-18,-17],[-7,-5],[-12,-9],[-16,-9],[-65,-8],[-28,-13],[-15,-36],[0,-21],[10,-34],[4,-20],[-4,-24],[-19,-39],[-7,-21],[2,-23],[8,-17],[24,-31],[10,-23],[-3,-17],[-7,-17],[-8,-25],[-11,-70],[-4,-68],[-24,-74],[-54,-26],[-66,-13],[-57,-31],[-11,-11],[-25,-38],[-9,-12],[-7,-6],[-49,-28],[-5,-5],[-6,-19],[4,-4],[24,-4],[8,-21],[7,-32],[-1,-41],[-3,-19],[-6,-18],[-38,-86],[-17,-49],[-1,-42],[6,-38],[-19,-196],[-9,-45],[-18,-31],[-11,-5],[-10,0],[-11,2],[-12,1],[-9,-6],[-6,-12],[-8,-30],[-12,-33],[-15,-20],[-85,-56],[-13,-4],[-12,3],[-27,15],[-11,4],[-15,-2],[-10,-7],[-10,-8],[-13,-7],[-12,-2],[-12,3],[-23,9],[7,-15],[20,-59],[2,-15],[1,-29],[-8,-9],[-25,-22],[-6,-11],[-5,-12],[-7,-12],[-10,-9],[-17,-3],[-32,7],[-19,-10],[-19,-33],[-6,-45],[2,-48],[13,-84],[-1,-20],[-2,-9],[-4,-14],[-34,-60],[-5,-25],[0,-41],[5,-40],[6,-25],[2,-17],[-5,-15],[-31,-41],[-83,-143],[-30,-68],[-6,-21],[-2,-23],[1,-22],[12,-61],[-3,-22],[-11,-11],[-13,-12],[-22,-41],[-52,-63]]],"transform":{"scale":[0.0012000054172417204,0.0009609089563956453],"translate":[2.671081990000118,4.272162177000013]}};
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
