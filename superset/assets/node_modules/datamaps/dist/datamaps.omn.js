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
  Datamap.prototype.ngaTopo = '__NGA__';
  Datamap.prototype.nicTopo = '__NIC__';
  Datamap.prototype.niuTopo = '__NIU__';
  Datamap.prototype.nldTopo = '__NLD__';
  Datamap.prototype.nplTopo = '__NPL__';
  Datamap.prototype.nruTopo = '__NRU__';
  Datamap.prototype.nulTopo = '__NUL__';
  Datamap.prototype.nzlTopo = '__NZL__';
  Datamap.prototype.omnTopo = {"type":"Topology","objects":{"omn":{"type":"GeometryCollection","geometries":[{"type":"Polygon","properties":{"name":"Ad Dakhliyah"},"id":"OM.DA","arcs":[[0,1,2,3,4,5,6]]},{"type":"Polygon","properties":{"name":"Al Wusta"},"id":"OM.WU","arcs":[[7,8,9,10,11,-4]]},{"type":"MultiPolygon","properties":{"name":"Ash Sharqiyah South"},"id":"OM.SS","arcs":[[[12]],[[-8,-3,13,14]]]},{"type":"MultiPolygon","properties":{"name":"Dhofar"},"id":"OM.JA","arcs":[[[15]],[[16]],[[-10,17]]]},{"type":"Polygon","properties":{"name":"Al Dhahira"},"id":"OM.ZA","arcs":[[-5,-12,18,19,20]]},{"type":"Polygon","properties":{"name":"Al Batnah North"},"id":"OM.BS","arcs":[[21,-6,-21,22,23]]},{"type":"MultiPolygon","properties":{"name":"Musandam"},"id":"OM.MU","arcs":[[[24],[25]],[[26]]]},{"type":"Polygon","properties":{"name":"Muscat"},"id":"OM.MA","arcs":[[27,-1,28,29]]},{"type":"Polygon","properties":{"name":"Al Buraymi"},"id":"OM.BU","arcs":[[-23,-20,30]]},{"type":"Polygon","properties":{"name":"Ash Sharqiyah North"},"id":"OM.SN","arcs":[[31,-14,-2,-28]]},{"type":"Polygon","properties":{"name":"Al Batnah South"},"id":"OM.BS","arcs":[[-29,-7,-22,32]]}]}},"arcs":[[[7805,6999],[0,-1],[275,28],[321,-246],[-59,-233]],[[8342,6547],[-192,-36],[-212,-101],[-78,-7],[-291,-172],[-125,-196],[315,-834]],[[7759,5201],[121,-321],[143,-310]],[[8023,4570],[-404,156],[-2093,788]],[[5526,5514],[252,244],[202,456],[244,814]],[[6224,7028],[367,13]],[[6591,7041],[377,-286],[147,-12],[48,-18],[326,40],[39,63],[277,171]],[[8023,4570],[136,-53],[-180,-446]],[[7979,4071],[-26,6],[-37,-2],[-38,-9],[-40,-20],[-52,-10],[-16,-9],[-8,-9],[-22,-48],[-1,-11],[8,-11],[4,-10],[-11,-8],[-15,-5],[-32,-5],[-23,-9],[-23,-11],[-30,-22],[-11,-11],[-8,-11],[-3,-14],[4,-10],[18,-15],[4,-10],[-9,-22],[-23,-13],[-55,-18],[-22,-10],[-22,-14],[-19,-17],[-7,-19],[-7,-11],[-14,-13],[-13,-18],[-1,-25],[24,-42],[8,-25],[-21,-37],[-19,-56],[-1,-15],[-3,-30],[-29,-54],[-21,-58],[-15,-26],[-81,-90],[-12,-27],[5,-32],[9,-12],[12,-9],[9,-10],[4,-14],[1,-32],[-2,-15],[-6,-13],[-10,-27],[-2,-20],[9,-20],[61,-78],[10,-17],[8,-28],[0,-28],[-6,-26],[-22,-47],[-5,-21],[3,-24],[26,-52],[12,-16],[32,-29],[8,-17],[-11,-42],[-1,-21],[48,-67],[0,-15],[-31,-24],[-19,-11],[-5,-2],[-57,-6],[-6,-6],[-6,-6],[-14,-8],[-15,-7],[-13,-3],[-264,10],[-72,-9]],[[6949,2363],[-1103,226],[-1550,1963],[-17,19]],[[4279,4571],[16,40],[67,163],[63,152],[56,137],[48,116],[36,89],[24,57],[8,20],[7,16]],[[4604,5361],[30,4],[892,149]],[[8483,3621],[-6,9],[-6,8],[-6,32],[-2,32],[3,17],[0,1],[-3,10],[8,81],[7,13],[14,14],[7,6],[23,13],[9,2],[3,2],[2,2],[6,19],[3,6],[21,6],[22,1],[21,2],[23,12],[10,11],[5,5],[4,13],[1,2],[6,39],[8,19],[11,16],[61,61],[24,37],[14,34],[11,12],[19,4],[16,-17],[-2,-18],[-9,-19],[-5,-20],[3,-22],[7,-17],[40,-54],[11,-16],[-5,-11],[-11,-8],[-49,-28],[-52,-22],[-23,-16],[-30,-35],[-15,-24],[-15,-49],[-12,-18],[0,-11],[1,-1],[2,-9],[0,-7],[-6,-8],[-43,-32],[-22,-24],[-12,-10],[-11,-3],[-17,-1],[-14,-3],[-6,-7],[-4,-10],[-11,-12],[-14,-9],[-15,0]],[[7759,5201],[328,90],[322,88],[298,81],[284,78],[275,112],[157,63],[62,123],[12,138],[-24,54],[-2,50],[70,55]],[[9541,6133],[29,-19],[29,-13],[7,-5],[1,-10],[-7,-3],[-11,2],[-8,4],[0,-15],[9,-6],[16,-2],[18,2],[98,25],[34,-10],[51,-29],[8,-1],[20,2],[7,-1],[4,-5],[2,-11],[3,-5],[0,-3],[-1,-5],[1,-6],[8,-7],[7,-3],[8,-2],[8,-2],[8,0],[5,5],[-9,11],[-18,16],[5,13],[14,1],[25,3],[34,-7],[28,-27],[18,-34],[7,-31],[-25,-168],[-17,-45],[-25,-41],[-73,-77],[-38,-24],[-21,-17],[-9,-18],[-4,-24],[-23,-49],[-6,-50],[-12,-20],[-51,-16],[-15,-18],[-21,-37],[-101,-103],[-38,-92],[-24,-43],[-119,-143],[-10,-33],[-4,-9],[-10,-7],[-179,-60],[-37,-17],[-142,-88],[-172,-137],[-53,-61],[-12,-9],[-18,-10],[-20,-21],[-39,-56],[-4,-9],[-3,-36],[-4,-11],[-8,-9],[-74,-45],[6,-22],[-22,-14],[-53,-20],[2,-2],[-10,-19],[-2,0],[-8,-7],[-6,-5],[-3,-6],[3,-9],[8,-10],[11,-8],[13,-5],[19,7],[21,15],[14,6],[-1,-20],[-13,-14],[-23,-13],[-23,-5],[-12,11],[-8,0],[-7,-15],[-9,-28],[-10,-14],[-10,-7],[-28,-12],[-14,-10],[-16,-20],[-14,-26],[-10,-28],[-4,-27],[-32,-49],[-17,-36],[1,-17],[-7,-8],[-7,-34],[-4,-8],[-10,-1],[-17,-5],[-17,-7],[-12,-8],[-9,-27],[-27,-11],[-36,1],[-33,9],[-24,9],[-17,4],[-42,1],[-16,-2],[-30,-9],[-18,-3],[3,9],[8,5],[-6,3],[-45,9],[-26,2],[-27,9],[-3,20],[16,42],[0,-13],[5,-11],[10,-10],[12,-9],[5,21],[-13,46],[13,21],[17,21],[13,29],[3,31],[-11,22]],[[4973,885],[-19,-9],[-38,0],[-12,-5],[-5,9],[-1,2],[7,8],[15,6],[18,3],[25,-12],[10,-2]],[[5171,873],[-20,-2],[-56,2],[-18,5],[-11,23],[34,15],[49,13],[33,12],[4,-14],[0,-1],[12,-13],[17,-9],[18,-5],[-40,-19],[-22,-7]],[[6949,2363],[-302,-36],[-157,-34],[-215,-68],[-82,-46],[-54,-21],[-30,-17],[-12,-22],[-11,-11],[-136,-104],[-23,-37],[-6,-48],[9,-34],[1,-12],[-4,-13],[-19,-20],[-6,-16],[-12,-21],[-3,-11],[0,-42],[-12,-43],[-65,-119],[18,-20],[-3,-22],[-18,-20],[-24,-15],[-56,-19],[-27,-12],[-39,-54],[-8,-5],[-18,-4],[-9,-4],[-59,-51],[-4,-7],[2,-23],[-15,-3],[-199,20],[-25,-3],[-38,-14],[-28,-4],[-109,7],[-25,-3],[-83,-26],[-46,-9],[-326,-11],[-127,-26],[-29,-2],[-10,-2],[-7,-4],[-5,-5],[-8,-4],[-24,0],[-1,0],[-42,-8],[-11,-5],[-18,-17],[-18,-40],[-12,-17],[-19,-17],[-5,-8],[-20,-42],[-5,-7],[-17,-16],[-118,-75],[-36,-51],[-8,-20],[-4,-24],[5,-28],[14,-13],[43,-19],[24,-20],[10,-21],[0,-47],[-8,-20],[-52,-54],[-3,-9],[-2,-15],[1,-12],[8,-6],[10,-4],[1,-7],[-6,-14],[-7,-5],[-34,-13],[-12,-6],[-7,-9],[-5,-8],[-6,-18],[-12,-16],[4,-5],[-12,-11],[-38,-10],[-20,-8],[-6,-9],[-7,-14],[-11,-13],[-15,-6],[-52,-46],[-57,-32],[-8,0],[-12,16],[-15,-7],[-16,-15],[-15,-8],[-20,-2],[-18,-5],[-18,-3],[-18,3],[-20,-16],[-23,-6],[-52,-5],[-43,-13],[-21,0],[-14,13],[-15,-6],[-23,2],[-15,-4],[-43,22],[-9,-8],[-11,20],[-5,18],[-15,13],[-52,8],[-36,9],[-16,2],[-15,-1],[-26,-4],[-15,-2],[-45,7],[-17,0],[-13,-3],[-27,-9],[-8,-2],[-59,14],[-32,1],[-26,-15],[-12,5],[-12,2],[-237,-21],[-100,0],[-23,-4],[-56,-22],[-13,-8],[-5,-9],[0,-8],[3,-8],[2,-7],[-4,-9],[-18,-13],[-4,-6],[-14,-11],[-33,-5],[-58,-2],[-76,-13],[-25,-1],[-23,-6],[-26,-12],[-26,-8],[-23,5],[-24,-12],[-32,-20],[-28,-23],[-12,-19],[-11,-12],[-24,-11],[-44,-15],[-42,-9],[-203,-3],[-107,-12],[-208,-52],[-108,-43],[-79,139],[-80,139],[-79,139],[-80,138],[-49,86],[-13,15],[-22,6],[-48,2],[-19,9],[2,0],[7,1],[2,1],[-40,73],[-54,99],[-55,99],[-54,99],[-54,99],[-55,100],[-54,99],[-55,99],[-54,99],[-55,99],[-54,99],[-54,99],[-55,99],[-54,99],[-54,99],[-55,99],[-54,99],[-36,66],[-9,16],[142,38],[217,58],[217,59],[218,59],[218,58],[217,59],[218,58],[217,59],[218,58],[217,59],[218,58],[217,59],[218,58],[218,59],[217,58],[217,59],[218,58],[191,52],[41,99],[8,20],[24,58],[37,89],[47,115],[57,137],[62,152],[67,163],[70,169],[53,128]],[[4604,5361],[47,115],[0,24],[-14,22],[-67,85],[-103,128],[-103,128],[-102,128],[-103,128],[-81,101],[14,150],[-8,150],[4,30],[40,99],[121,158],[28,62],[27,103],[14,34],[24,26],[0,1],[47,38],[18,20]],[[4407,7091],[174,-13],[133,57],[168,36],[89,43],[-45,150],[53,50],[80,28],[0,86],[71,36],[186,28],[150,0],[43,102]],[[5509,7694],[198,-64],[377,-247],[117,-333],[23,-22]],[[7060,7376],[-147,-192],[-165,-105],[-157,-38]],[[5509,7694],[-8,89],[-125,314],[-168,161],[1,42]],[[5209,8300],[2,-1],[27,1],[24,5],[12,11],[7,17],[28,25],[20,38],[1,0],[19,6],[47,5],[23,8],[42,30],[7,5],[36,19],[7,10],[0,7],[3,19],[4,33],[6,6],[6,5],[69,5],[28,-83],[82,-125],[13,-10],[9,-24],[8,-43],[150,-209],[31,-26],[72,-47],[139,-126],[27,-32],[12,-19],[11,-30],[125,-111],[151,-95],[119,-71],[41,-20],[181,-52],[233,-46],[29,-9]],[[5556,8878],[-6,-28],[-36,-13],[-29,-8],[-15,-9],[-38,-20],[-20,-7],[-21,5],[-15,5],[-1,6],[-1,4],[3,26],[34,12],[12,11],[-7,8],[-5,11],[-2,16],[34,19],[38,-3],[24,-27],[51,-8]],[[5442,8860],[4,-28],[26,7],[6,17],[-18,9],[-11,0],[-7,-5]],[[5582,9999],[18,-28],[19,9],[7,5],[9,-8],[-6,-7],[0,-3],[2,-2],[4,-8],[12,7],[8,-2],[6,-7],[9,-6],[29,-6],[16,-1],[16,1],[-2,5],[-5,11],[-2,5],[27,7],[13,-26],[-3,-10],[-18,-1],[-32,1],[-22,-5],[-38,-25],[-21,-10],[2,0],[0,-6],[-11,-10],[28,-22],[14,-8],[18,-5],[11,5],[13,8],[14,2],[14,-15],[-23,-30],[-12,-4],[-8,20],[-13,-1],[-14,1],[5,-10],[1,-6],[-2,-6],[-4,-6],[16,-12],[19,-8],[17,-11],[9,-18],[-15,0],[-14,2],[-12,5],[-11,7],[-18,-6],[-16,5],[-9,12],[-1,17],[-8,-4],[-19,-6],[-7,-4],[-1,11],[3,8],[6,6],[9,3],[-29,4],[-31,-14],[-19,-19],[9,-13],[-6,-11],[-2,-12],[3,-14],[5,-13],[11,21],[11,11],[13,4],[8,-7],[2,-12],[-4,-13],[-6,-10],[25,-8],[114,1],[-11,-13],[-19,-13],[-39,-17],[-37,-10],[-12,-9],[5,-16],[32,12],[17,-11],[1,-19],[-29,-15],[6,-10],[17,-17],[4,-8],[12,-4],[28,-5],[-10,-5],[-3,-3],[-5,-14],[-19,7],[-21,5],[-18,-2],[-12,-10],[20,-24],[-9,-23],[-21,-21],[-16,-22],[-1,-8],[1,-24],[-25,-18],[-21,-28],[-14,-13],[-19,-8],[0,22],[-17,-22],[-18,-34],[-9,-37],[9,-34],[7,-12],[-53,-12],[-21,-2],[-20,4],[-8,7],[-13,21],[-11,7],[-30,4],[-5,2],[-2,1],[-8,12],[-6,46],[1,18],[14,10],[16,10],[10,13],[-6,13],[-30,29],[-6,17],[7,16],[24,25],[9,15],[5,92],[8,30],[3,19],[-6,21],[-20,39],[-15,2],[-64,-13],[-30,-1],[6,9],[12,37],[84,97],[31,46],[13,10],[21,8],[1,-6],[-1,-14],[14,-16],[-4,-6],[-5,-15],[9,0],[13,9],[33,2],[6,6],[8,3],[17,-4],[15,-12],[4,-18],[9,12],[8,-1],[11,-4],[15,0],[35,19],[13,2],[39,-8],[9,1],[3,9],[-6,9],[-10,7],[-9,3],[-25,2],[-15,0],[-11,-5],[-7,-7],[-13,-9],[-15,-5],[-14,3],[0,12],[9,43],[0,16],[38,-22],[16,-4],[7,15],[-6,8],[-14,10],[-18,9],[-14,4],[5,9],[7,2],[8,0],[7,3],[16,14],[7,13],[-2,22],[4,15],[8,0]],[[9255,6412],[-30,-30],[-84,-69],[-418,41],[-381,193]],[[7805,6999],[-33,101],[41,146],[-3,1],[1,2],[5,8]],[[7816,7257],[6,-1],[78,-24],[22,-4],[21,-7],[47,-35],[23,-14],[44,-11],[59,-5],[62,1],[52,8],[28,7],[11,7],[9,19],[11,0],[24,-5],[55,-1],[29,-4],[26,-9],[11,-13],[25,-41],[11,-9],[7,-2],[5,-4],[6,-5],[4,-4],[3,1],[7,1],[9,0],[8,-2],[18,-11],[10,-9],[6,-8],[9,0],[8,14],[3,-5],[3,-3],[2,-5],[2,-7],[8,0],[2,4],[6,10],[7,-5],[4,-1],[16,6],[31,-31],[8,-17],[-4,-16],[10,-14],[13,-47],[16,-19],[75,-52],[46,-16],[18,-18],[21,-44],[13,-17],[38,-27],[20,-21],[10,-60],[81,-62],[5,-8],[8,-31],[5,-7],[6,-5],[36,-21],[67,-30],[43,-24],[32,-28],[22,-32],[12,-22]],[[4407,7091],[42,127],[11,18],[60,65],[5,14],[-4,77],[-6,30],[-20,22],[-46,21],[-22,14],[-11,19],[5,15],[55,7],[54,16],[25,10],[37,15],[35,10],[36,5],[42,-1],[42,-5],[19,1],[21,5],[23,3],[33,-19],[24,-2],[148,45],[80,15],[14,16],[-47,63],[-15,43],[-20,37],[-38,12],[-71,-22],[-22,1],[-79,13],[-16,6],[-2,15],[10,18],[50,65],[8,15],[4,50],[-2,9],[-10,9],[-25,12],[-9,8],[-4,15],[3,56],[-16,43],[-1,22],[12,14],[18,14],[8,35],[36,24],[-4,20],[-19,31],[-7,11],[-3,19],[6,38],[0,19],[-11,79],[14,32],[38,36],[36,24],[6,4],[44,20],[49,10],[51,-6],[3,0],[35,-16],[14,-31],[11,-45],[5,-22],[-30,16],[-17,7],[-18,3],[-22,-5],[-4,-13],[9,-15],[48,-32],[37,-71],[39,-23],[18,-1]],[[9255,6412],[34,-66],[5,-15],[10,-19],[23,-14],[46,-19],[50,-60],[7,-17],[17,-16],[54,-37],[40,-16]],[[7060,7376],[69,-23],[74,-18],[53,-7],[29,-1],[86,4],[24,-4],[36,-36],[13,-7],[31,-6],[36,-14],[32,-3],[166,7],[56,-3],[51,-8]]],"transform":{"scale":[0.0007866746139613907,0.0009744540821801049],"translate":[51.97861495000021,16.64240603028115]}};
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
