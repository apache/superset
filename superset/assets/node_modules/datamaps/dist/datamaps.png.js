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
  Datamap.prototype.omnTopo = '__OMN__';
  Datamap.prototype.pakTopo = '__PAK__';
  Datamap.prototype.panTopo = '__PAN__';
  Datamap.prototype.pcnTopo = '__PCN__';
  Datamap.prototype.perTopo = '__PER__';
  Datamap.prototype.pgaTopo = '__PGA__';
  Datamap.prototype.phlTopo = '__PHL__';
  Datamap.prototype.plwTopo = '__PLW__';
  Datamap.prototype.pngTopo = {"type":"Topology","objects":{"png":{"type":"GeometryCollection","geometries":[{"type":"MultiPolygon","properties":{"name":null},"id":"-99","arcs":[[[0]],[[1]],[[2]],[[3]],[[4]],[[5]],[[6]],[[7]],[[8]],[[9]],[[10]],[[11]],[[12]],[[13]],[[14]],[[15]],[[16]],[[17]],[[18]],[[19]],[[20]],[[21]],[[22]],[[23]],[[24]],[[25]],[[26]],[[27]],[[28]],[[29]],[[30]],[[31]],[[32]],[[33]],[[34]],[[35]],[[36]],[[37]],[[38]],[[39]],[[40]],[[41]],[[42]],[[43]],[[44]]]},{"type":"Polygon","properties":{"name":"Enga"},"id":"PG.EG","arcs":[[45,46,47,48]]},{"type":"MultiPolygon","properties":{"name":"East Sepik"},"id":"PG.ES","arcs":[[[49]],[[50,-48,51,52,53]],[[54]],[[55]]]},{"type":"MultiPolygon","properties":{"name":"Madang"},"id":"PG.MD","arcs":[[[56]],[[57]],[[58]],[[59]],[[60,61,62,63,-49,-51,64]]]},{"type":"MultiPolygon","properties":{"name":"Sandaun"},"id":"PG.SA","arcs":[[[-53,65,66,67]],[[68]]]},{"type":"Polygon","properties":{"name":"Chimbu"},"id":"PG.CH","arcs":[[-63,69,70,71,72]]},{"type":"Polygon","properties":{"name":"Eastern Highlands"},"id":"PG.EH","arcs":[[73,74,-70,-62]]},{"type":"Polygon","properties":{"name":"Gulf"},"id":"PG.GU","arcs":[[-75,75,76,77,78,79,-71]]},{"type":"MultiPolygon","properties":{"name":"North Solomons"},"id":"PG.NS","arcs":[[[80]],[[81]],[[82]],[[83]],[[84]],[[85]]]},{"type":"Polygon","properties":{"name":"Southern Highlands"},"id":"PG.SH","arcs":[[-47,86,-72,-80,87,-66,-52]]},{"type":"Polygon","properties":{"name":"Western Highlands"},"id":"PG.WH","arcs":[[-73,-87,-46,-64]]},{"type":"MultiPolygon","properties":{"name":"Western"},"id":"PG.WE","arcs":[[[88]],[[89]],[[90]],[[91]],[[92]],[[93]],[[-79,94,-67,-88]]]},{"type":"Polygon","properties":{"name":"Central"},"id":"PG.CE","arcs":[[95,96,97,98,99,-77,100]]},{"type":"MultiPolygon","properties":{"name":"East New Britain"},"id":"PG.EN","arcs":[[[101,102]],[[103]],[[104]]]},{"type":"MultiPolygon","properties":{"name":"Manus"},"id":"PG.MN","arcs":[[[105]],[[106]]]},{"type":"MultiPolygon","properties":{"name":"Milne Bay"},"id":"PG.MB","arcs":[[[107]],[[108]],[[109]],[[110]],[[111]],[[112]],[[113]],[[114]],[[115]],[[116]],[[-97,117,118]],[[119]],[[120]],[[121]],[[122]],[[123]]]},{"type":"MultiPolygon","properties":{"name":"Morobe"},"id":"PG.MR","arcs":[[[124,-101,-76,-74,-61,125]],[[126]],[[127]],[[128]]]},{"type":"Polygon","properties":{"name":"National Capital District"},"id":"PG.CE","arcs":[[129,-99]]},{"type":"MultiPolygon","properties":{"name":"New Ireland"},"id":"PG.NI","arcs":[[[130]],[[131]],[[132]],[[133]],[[134]],[[135]],[[136]],[[137]],[[138]],[[139]],[[140]],[[141]],[[142]]]},{"type":"Polygon","properties":{"name":"Northern"},"id":"PG.NO","arcs":[[143,-118,-96,-125]]},{"type":"MultiPolygon","properties":{"name":"West New Britain"},"id":"PG.WN","arcs":[[[-102,144]],[[145]],[[146]],[[147]]]}]}},"arcs":[[[6654,334],[3,-8],[-3,-12],[-3,-2],[-3,-8],[-2,4],[-3,3],[1,3],[4,1],[3,6],[-4,11],[1,0],[4,0],[2,2]],[[6055,368],[-1,-8],[-1,8],[2,0]],[[6476,457],[0,-10],[2,-6],[-1,-2],[-1,-3],[-11,16],[0,6],[3,-5],[3,-1],[0,4],[3,4],[2,0],[0,-3]],[[6404,466],[-9,-9],[-2,6],[0,5],[6,-2],[5,0]],[[6539,468],[2,-3],[-1,-4],[-7,-32],[0,-9],[2,-2],[0,-2],[-6,-6],[-2,2],[-4,10],[-3,3],[-2,-2],[-2,-6],[-2,1],[-10,16],[1,6],[5,6],[2,12],[3,9],[4,2],[6,-2],[2,2],[5,1],[7,-2]],[[6555,450],[-6,0],[-4,6],[-1,9],[4,6],[7,2],[5,0],[5,-6],[-3,-11],[-7,-6]],[[6150,492],[9,-6],[3,2],[2,-1],[4,0],[-2,-7],[-5,-1],[-9,9],[-2,4]],[[6351,491],[-1,-3],[4,2],[5,-1],[0,6],[2,-13],[-4,-3],[-4,-3],[-5,5],[-2,-1],[-3,-8],[-5,8],[2,6],[2,3],[1,5],[5,3],[3,3],[1,-3],[-1,-6]],[[6281,547],[3,0],[2,0],[-1,-3],[2,-3],[6,1],[1,0],[1,0],[-1,-3],[1,-10],[3,-4],[0,-3],[-5,5],[-4,1],[-4,-7],[-3,-4],[-3,13],[-3,2],[-2,6],[0,5],[5,1],[1,4],[1,-1]],[[6076,799],[2,-1],[3,0],[2,-2],[-1,-2],[-4,0],[-2,5]],[[5942,806],[-3,-7],[-3,11],[6,-4]],[[5819,844],[3,-8],[-8,5],[-4,0],[0,3],[3,0],[6,0]],[[6202,829],[-6,-4],[-6,9],[-3,0],[-1,7],[7,14],[6,-6],[1,-5],[5,-6],[-3,-9]],[[5616,860],[-2,-9],[-2,5],[-2,3],[2,3],[4,-2]],[[5580,897],[-5,-9],[-4,9],[9,0]],[[6203,915],[-1,-9],[-2,-7],[0,-8],[-1,-2],[-7,13],[-4,5],[-7,0],[-15,-8],[-2,6],[0,11],[4,17],[5,9],[5,4],[5,0],[5,-4],[3,-5],[3,-8],[8,-11],[1,-3]],[[5594,989],[5,-3],[5,1],[4,-3],[-4,-7],[-4,5],[-6,-2],[0,9]],[[5582,994],[-5,-10],[-3,6],[-4,2],[-1,6],[-1,3],[-5,1],[-1,4],[2,1],[4,-2],[1,0],[1,-4],[3,-2],[5,-3],[4,-2]],[[5557,1006],[-2,0],[-4,4],[-6,7],[3,7],[8,-10],[1,-8]],[[5286,1027],[1,-4],[2,0],[2,1],[2,-1],[3,-5],[1,-6],[-3,-10],[0,-4],[3,0],[3,3],[4,5],[2,1],[4,-6],[-2,-5],[-4,-1],[0,-3],[8,-9],[2,-5],[-3,-4],[-3,3],[-5,-2],[-6,1],[-9,8],[-2,3],[1,3],[-1,4],[-1,2],[-7,-2],[-3,2],[0,7],[2,8],[7,14],[2,2]],[[5670,1209],[0,-11],[-6,12],[6,-1]],[[5465,1323],[-1,-10],[-1,-5],[-6,-2],[-4,-11],[0,-11],[-1,10],[-2,3],[0,6],[-2,7],[-3,-4],[-2,4],[2,4],[-3,7],[5,6],[2,0],[1,-8],[3,2],[2,2],[2,6],[1,3],[7,-9]],[[5380,1817],[-2,-2],[-3,2],[-4,-3],[-5,9],[1,8],[-2,5],[2,4],[3,0],[4,3],[3,-6],[1,-1],[1,-3],[1,-4],[1,-1],[1,-5],[-2,-6]],[[5335,2266],[-2,-2],[-8,1],[1,8],[0,10],[10,0],[2,-7],[-3,-10]],[[5923,2304],[12,-15],[7,-6],[5,0],[6,2],[3,-7],[-1,-1],[-1,3],[-4,1],[-5,-1],[-6,2],[-17,9],[-9,-2],[1,6],[5,4],[4,5]],[[5319,2272],[-4,-8],[-3,10],[-4,10],[-3,4],[0,5],[-2,7],[0,3],[6,3],[5,0],[1,-9],[1,-9],[5,-3],[2,-5],[-4,-8]],[[5396,2320],[3,-3],[3,2],[1,-6],[-7,1],[-2,-5],[-3,-2],[-2,-3],[-1,11],[2,4],[0,8],[-1,5],[6,3],[-1,-2],[1,-6],[0,-4],[1,-3]],[[5378,2344],[-5,-5],[-1,14],[-3,4],[0,3],[2,-2],[3,0],[4,-1],[0,-3],[2,0],[-2,-10]],[[1289,2418],[-6,-2],[-11,5],[-10,14],[1,11],[25,22],[6,-1],[5,-10],[0,-14],[-3,-15],[-2,-5],[-5,-5]],[[1268,2465],[-2,-4],[-7,3],[-6,13],[1,9],[5,7],[10,-1],[6,-5],[3,-7],[-4,-6],[-4,-5],[-2,-4]],[[1388,2544],[-4,-10],[-7,6],[-3,-1],[-4,-14],[-4,3],[-8,10],[0,16],[10,21],[15,14],[4,1],[5,-5],[0,-17],[-4,-24]],[[1395,2782],[-6,-1],[-7,63],[1,5],[4,1],[6,-6],[6,-30],[-4,-32]],[[1382,2861],[-3,0],[-6,7],[-29,32],[2,3],[20,-8],[5,-7],[10,-23],[1,-4]],[[5426,2989],[-25,-19],[0,7],[5,27],[-3,31],[3,11],[2,3],[0,3],[4,7],[7,6],[7,-5],[4,-10],[-2,-53],[-2,-8]],[[1502,3013],[-9,-4],[-11,8],[-6,12],[-1,9],[1,10],[8,17],[11,10],[14,-11],[4,-8],[3,-14],[-1,-13],[-13,-16]],[[1567,3040],[-3,-1],[-10,17],[-6,5],[-4,10],[-3,3],[-3,8],[0,7],[2,10],[3,10],[6,1],[11,-7],[12,-15],[4,-17],[-1,-19],[-4,-8],[-4,-4]],[[1410,3233],[5,-12],[-9,-12],[-70,14],[-9,-5],[-8,2],[3,8],[57,8],[31,-3]],[[8680,6666],[-3,-5],[1,9],[3,4],[2,-6],[-3,-2]],[[8630,6735],[-1,0],[0,2],[1,0],[0,-2]],[[9976,6833],[-2,-3],[-5,3],[2,2],[7,0],[-2,-2]],[[9996,6852],[-3,-4],[2,26],[-3,28],[-3,7],[0,2],[3,-5],[7,-47],[-1,-3],[-1,-1],[-1,-3]],[[1330,8160],[2,-3],[-3,-3],[-8,3],[-6,-2],[-4,4],[-6,10],[-4,3],[0,6],[17,-2],[8,-13],[4,-3]],[[3451,8802],[-6,-2],[-1,3],[0,3],[0,1],[-4,0],[-1,5],[2,3],[0,4],[0,7],[4,8],[6,3],[6,3],[2,-3],[2,0],[1,-11],[-3,-13],[-4,-8],[-4,-3]],[[3490,9001],[11,-2],[4,1],[3,-5],[-1,-9],[-9,-11],[-22,-14],[-10,-30],[-2,3],[-1,7],[-1,5],[0,4],[2,6],[3,14],[8,11],[1,5],[1,3],[3,15],[4,3],[3,-2],[3,-4]],[[3726,9310],[-20,-16],[-9,3],[-1,5],[3,1],[-1,4],[0,1],[-1,-3],[0,6],[6,13],[4,3],[3,1],[6,3],[8,-8],[2,-13]],[[1823,6193],[-12,-41],[-5,-28],[-8,-15],[-10,-7],[-12,-5],[-55,-54],[-5,-12],[0,-14],[33,-120],[4,-21],[0,-17],[-1,-22],[-5,-43],[-5,-22],[-7,-18],[-17,-25],[-40,-42],[-76,-48],[-28,-26],[-6,-7],[-1,-8],[1,-7],[12,-30],[3,-11],[2,-11]],[[1585,5539],[-33,11],[-23,3],[-28,-9],[-44,-23],[-24,-8],[-15,5],[-27,23],[-49,62],[-55,90],[-36,33],[-154,100],[-57,132],[-13,472]],[[1027,6430],[73,-40],[54,-13],[34,2],[63,27],[422,61]],[[1673,6467],[2,-18],[1,-8],[1,-5],[3,-9],[7,-12],[33,-48],[17,-19],[8,-5],[3,-1],[10,-1],[2,0],[2,-2],[11,-17],[2,-3],[1,-5],[1,-9],[0,-7],[0,-6],[2,-6],[4,-9],[3,-17],[2,-19],[1,-4],[2,-5],[2,-4],[5,-2],[9,-8],[16,-25]],[[2023,7890],[-4,-3],[-3,2],[-4,0],[-2,0],[-2,4],[0,8],[4,5],[5,-2],[5,-6],[1,-8]],[[2002,7425],[0,-3],[-10,-468],[-63,-184],[-214,-289],[-19,-10],[-23,-4]],[[1027,6430],[-30,33],[-7,2],[-9,0],[-23,-5],[-57,4],[-32,11],[-78,5]],[[791,6480],[-13,282],[-55,58],[-377,5],[-38,7],[-30,17],[-12,41],[-4,46],[-1,162],[4,43],[11,28],[189,230],[4,3],[9,3],[2,-2],[10,5],[1,-20],[7,-8],[10,-5],[7,-13],[-7,-16],[-3,-10],[3,-8],[15,14],[4,-4],[9,0],[327,9],[29,13],[11,36],[3,15],[0,15],[10,48],[18,19],[16,21],[7,37],[3,38],[-1,23],[-2,10],[-4,11],[-2,8],[-4,27],[-4,17],[-1,12],[-1,44],[2,39],[-2,72],[0,15],[2,10],[9,29],[8,33],[6,16],[7,10],[15,6],[7,6],[14,13],[7,4],[7,0],[7,-4],[8,-7],[16,-18],[98,-72],[15,-7],[8,-2],[8,1],[7,11],[6,21],[3,128],[0,4]],[[1199,8049],[10,1],[8,-3],[4,7],[9,-7],[37,-6],[5,-3],[10,-14],[7,-3],[7,-1],[114,-37],[24,-15],[10,-11],[30,-56],[6,-27],[2,-6],[4,-5],[8,-7],[4,-5],[5,-4],[16,-9],[2,-4],[5,4],[7,10],[3,0],[4,-2],[1,-6],[-4,-12],[5,-13],[6,-8],[7,-5],[19,-3],[10,-4],[8,-7],[20,-57],[7,-9],[22,-18],[8,-3],[13,-11],[26,-69],[14,-9],[17,-2],[35,4],[6,-1],[6,2],[14,-1],[-5,-8],[-5,-5],[-6,-1],[-6,1],[4,-11],[5,-6],[5,-5],[6,-8],[8,-6],[13,13],[8,-7],[4,-14],[3,-6],[4,-3],[6,1],[1,2],[0,5],[2,5],[5,10],[5,13],[3,14],[-2,10],[18,8],[25,1],[24,-6],[18,-10],[7,2],[28,-2],[7,-3],[8,-14],[6,-14],[4,-17],[3,-19],[0,-83],[3,-11],[8,-11],[5,-4]],[[1468,8024],[-9,0],[-15,11],[-4,2],[-6,4],[-8,13],[0,9],[4,7],[0,11],[4,6],[11,-3],[14,-13],[13,-18],[4,-18],[-8,-11]],[[1762,8169],[-10,-18],[-19,9],[-10,23],[6,17],[12,9],[14,-26],[7,-14]],[[3419,6036],[-4,-6],[-3,2],[-3,4],[-5,0],[-5,-4],[-13,-15],[-18,1],[-16,19],[-21,46],[-20,26],[-6,14],[-3,15],[0,17],[3,35],[4,22],[5,8],[20,10],[8,10],[8,12],[10,10],[11,1],[19,-36],[7,-11],[13,-10],[1,-6],[1,-14],[1,-23],[3,-23],[6,-19],[8,-12],[0,-6],[-8,-15],[-1,-19],[0,-18],[-2,-15]],[[2904,6623],[0,-14],[-3,3],[-4,4],[0,-4],[0,-2],[-1,-1],[-3,0],[3,-17],[-9,-1],[-10,11],[-5,17],[1,15],[4,13],[7,8],[9,0],[8,-21],[3,-11]],[[2744,6687],[-14,-6],[-7,6],[-18,29],[-3,7],[-4,15],[-2,15],[1,17],[2,19],[8,41],[6,17],[26,50],[11,9],[11,-5],[8,-11],[20,-38],[3,-15],[1,-24],[-1,-34],[-2,-7],[-2,-11],[-1,-22],[-3,-11],[-6,-9],[-20,-22],[-14,-10]],[[2278,7367],[5,-11],[2,-15],[-2,-19],[-3,-15],[-5,-8],[-8,-3],[-11,-1],[-9,6],[-5,14],[-2,19],[-1,18],[2,12],[4,2],[4,-2],[1,-3],[10,14],[4,3],[5,-3],[9,-8]],[[3188,5656],[-2,-3],[-165,-175],[-329,3]],[[2692,5481],[-15,16],[-11,18],[-8,0],[-2,0],[-70,5],[-5,3],[-4,6],[-8,18],[-6,6],[-11,4],[-10,1],[-13,-3],[-7,-7],[-5,-9],[-3,-11],[-5,-11],[-7,-5],[-11,0],[-19,6],[-11,7],[-9,16],[-23,64],[-7,8],[-8,2],[-45,-14],[-13,2],[-40,-4]],[[2316,5599],[-24,45],[-15,23],[-30,16]],[[2247,5683],[-11,22],[-29,80],[-10,19],[-17,19],[-11,18],[-8,18],[-10,41],[-2,5],[-4,8],[-6,9],[-7,8],[-30,18],[-11,11],[-12,19],[-10,21],[-7,21],[-8,16],[-9,11],[-31,18],[-15,16],[-9,16],[-13,34],[-7,14],[-9,12],[-79,52],[-9,4],[-7,-2],[-9,-10],[-6,-10],[-7,-7],[-3,-2],[-18,11]],[[2002,7425],[5,-5],[8,-6],[67,-19],[21,-14],[14,-23],[10,-11],[16,-8],[13,-15],[2,-5],[1,-3],[1,-2],[1,-3],[1,-6],[-2,-6],[-6,-6],[-3,-5],[0,-12],[3,-13],[7,-10],[24,-8],[9,-8],[16,-29],[12,-13],[2,-7],[0,-35],[2,-5],[8,-8],[20,-52],[14,-14],[56,-33],[21,1],[23,10],[23,4],[21,-15],[22,-50],[33,-49],[19,-41],[5,-15],[11,-28],[5,-5],[5,0],[3,2],[3,0],[9,-17],[11,-46],[59,-118],[8,-13],[10,-8],[9,-10],[1,-4],[19,-10],[4,-9],[8,-18],[6,-18],[-2,-8],[-6,-9],[-4,-21],[-3,-44],[1,-23],[5,-40],[2,-20],[1,-5],[5,-13],[1,-9],[-1,-8],[-4,-11],[-2,-11],[0,-2],[-1,-35],[-3,-22],[0,-10],[1,-41],[-1,-18],[-4,-18],[-19,-49],[-3,-21],[1,-8],[2,-15],[1,-10],[-1,-12],[-10,-32],[-1,-31],[6,-30],[11,-23],[15,-9],[33,10],[12,-6],[8,-30],[4,0],[1,6],[2,13],[1,7],[3,-2],[2,-2],[2,-2],[6,13],[8,3],[8,1],[8,10],[9,-18],[9,-6],[10,-5],[12,-12],[4,6],[3,1],[2,-2],[2,-5],[6,1],[18,-15],[9,-6],[13,1],[6,-2],[3,-9],[3,-11],[6,-4],[13,-1],[10,-9],[6,-3],[10,5],[5,-6],[5,-9],[5,-5],[5,-1],[11,6],[8,2],[6,0],[4,-2],[10,-11],[4,-5],[4,-7],[6,-3],[7,1],[-3,0],[12,0],[10,4],[10,-1],[10,-13],[3,-9],[2,-10],[3,-7],[13,-6],[7,-5],[67,-95],[36,-17],[18,-20],[12,-5],[5,-6],[2,-17]],[[791,6480],[1,-95],[4,-41],[8,-27],[5,-27],[-3,-31],[-4,-20],[-13,-46],[-1,-6],[-1,-12],[-8,-40],[0,-5],[-5,-23],[-9,-13],[-22,-19],[-14,-22]],[[729,6053],[-645,398],[-16,9]],[[68,6460],[0,209],[0,172],[-1,411],[0,166],[0,197],[0,212],[-1,322],[1,241],[0,189],[0,171],[0,30],[7,1],[11,-8],[19,18],[21,-5],[21,-12],[22,-8],[17,0],[6,-4],[5,-6],[3,-5],[4,-4],[6,-3],[14,-1],[6,-3],[2,-6],[6,-21],[3,-6],[7,5],[15,-30],[12,-9],[12,-3],[104,-78],[121,-103],[17,-5],[1,-8],[1,-9],[2,-10],[24,-30],[11,-3],[20,7],[30,4],[6,-4],[29,-48],[3,-9],[-1,-8],[-3,-11],[-1,-11],[1,-10],[4,-2],[13,-2],[5,-3],[18,11],[12,-10],[12,-14],[12,-7],[12,-2],[8,-5],[15,-13],[67,-35],[58,-50],[60,-34],[106,-59],[12,-2],[6,-3],[18,-17],[7,-2],[8,0],[7,-2],[15,-16],[43,-20],[13,-1],[17,3]],[[1062,9633],[-6,-10],[0,21],[8,14],[11,5],[7,-11],[-4,-2],[-8,-7],[-8,-10]],[[2316,5599],[-7,-53],[-2,-131],[2,-20],[4,-13],[19,-28],[5,-5],[12,-7],[4,-5],[5,-11],[3,-17],[7,-82],[0,-27],[-2,-15],[-3,-15],[-5,-12],[-5,-8],[-11,-13],[-7,-11],[-15,-37],[-6,-10],[-6,-6],[-8,-1],[-25,2],[-9,3],[-7,0],[-6,-3],[-23,-22],[-5,-8],[-6,-15],[0,-16],[4,-37],[4,-8],[4,-5],[7,-2],[8,-4],[8,-7],[12,-13],[69,-115],[3,-4],[52,-6],[3,-3],[3,-6],[11,-25],[3,-11],[0,-10],[-21,-131]],[[2389,4626],[-25,27],[-40,6],[-23,15],[-17,15],[-24,13],[-13,3],[-11,7],[-14,3],[-8,3],[-7,10],[-8,15],[-11,17],[-8,3],[-8,-6],[-6,-8],[-10,-5],[-9,3],[-14,-4],[-6,1],[-7,6],[-9,11],[-7,5],[-6,2],[-8,-2],[-15,-6],[-2,-1]],[[2073,4759],[-7,24],[-11,19],[-7,9],[-24,6],[-14,6],[-6,11],[-1,21],[-3,18],[-7,16],[-11,15],[-10,8],[-10,4],[-19,2],[-8,3],[-2,9],[1,11],[0,10],[-3,10],[-2,8],[0,4],[3,34],[3,10],[4,9],[9,8],[16,6],[8,4],[6,7],[3,12],[1,10],[-2,47]],[[1980,5120],[27,-33],[3,1],[5,6],[7,46],[4,14],[5,13],[6,14],[22,36],[5,15],[21,101],[2,15],[1,10],[-3,9],[-13,27],[-3,13],[-1,18],[4,28],[5,22],[1,3],[6,9],[6,6],[18,11],[9,11],[4,10],[2,8],[-6,137],[2,16],[4,3],[7,-2],[29,-18],[51,-5],[13,4],[9,4],[15,11]],[[2692,5481],[7,-12],[6,-35],[8,-14],[8,-14],[7,-16],[3,3],[9,7],[3,3],[2,-15],[1,-15],[8,-9],[70,-80],[5,-12],[3,-15],[0,-22],[-48,-414],[-4,-16],[-5,-14],[-13,-22],[-3,-9],[-1,-12],[2,-12],[4,-13],[2,-16],[1,-19],[6,-34],[1,-18],[-3,-18],[-4,-14],[-5,-10],[-22,-35],[-6,-13],[-5,-14],[-2,-12],[-15,-87],[-2,-11],[-4,-9],[-2,-9],[-24,-129]],[[2680,4275],[-291,351]],[[2680,4275],[101,-198],[11,-40],[14,-39],[8,-14],[14,-11],[155,-77],[115,-140]],[[3098,3756],[-47,-57],[-24,-47],[-10,-14],[-22,-24],[-13,-20],[-8,-52],[-2,-576]],[[2972,2966],[-1,1],[-13,21],[-46,123],[-7,29],[-1,39],[-1,8],[-5,12],[-1,4],[0,30],[-3,17],[-5,17],[-7,13],[-18,12],[-15,28],[-5,6],[-13,3],[-6,10],[-9,34],[7,10],[-1,16],[-6,16],[-7,11],[5,4],[4,6],[1,7],[-3,10],[-11,-5],[-15,11],[-29,27],[-31,13],[-17,2],[-14,-8],[-10,13],[-34,21],[-8,16],[-1,3],[-2,4],[-3,5],[-1,8],[2,3],[7,1],[2,6],[-1,5],[-2,4],[-3,3],[-1,4],[1,7],[6,23],[-4,0],[-6,-15],[-8,0],[-9,3],[-10,-8],[8,-20],[-10,-7],[-33,1],[-6,3],[-10,18],[-8,5],[-8,-1],[-8,-4],[-8,-1],[-9,6],[0,-6],[-9,6],[-37,-13],[-12,2],[-10,4],[-9,8],[-31,53],[-15,15],[-20,4],[-5,-2],[-5,-3],[-6,-3],[-6,1],[-5,6],[-11,18],[-4,11],[-8,10],[-4,12],[-5,-10],[-4,-14],[1,-5],[-10,-2],[-14,7],[-12,13],[-5,18],[-2,10],[-4,10],[-3,2],[-2,-9],[0,-20],[-2,-6],[-5,-4],[-34,0],[-5,6],[-16,34],[-7,-17],[-6,2],[-7,9],[-8,6],[-4,-2],[-6,-4],[-3,0],[-1,2],[-3,9],[-1,2],[-5,3],[-5,7],[-5,7],[0,6],[9,19],[4,18],[0,95],[-1,22],[-7,16],[-4,-19],[-2,-47],[-5,-20],[3,-16],[-6,-8],[-11,-3],[-10,0],[-8,4],[-8,12],[-11,25],[-20,26],[-5,22],[-6,11],[-13,21],[-3,-18],[1,-18],[4,-18],[2,-17],[-5,-15],[-12,-7],[-14,0],[-10,5],[-5,9],[-6,17],[-5,18],[-2,13],[0,11],[-1,9],[-2,7],[-3,7],[-2,9],[1,23],[-1,11],[-8,17],[-3,-12],[0,-69],[-4,-31],[0,-12],[3,-8],[12,-19],[-2,-10],[-5,-7],[-5,-3],[-3,4],[-2,12],[-14,20],[-5,11],[-2,7],[-2,17],[0,6],[-2,5],[-3,4],[-4,4],[-2,3],[-5,17],[-6,32],[-4,12],[-3,0],[2,-17],[1,-37],[2,-15],[7,-27],[2,-14],[1,-32],[3,-25],[3,-10],[5,-12],[5,-13],[2,-15],[6,-11],[10,-25],[4,-23],[-13,-4],[-2,6],[-10,26],[-3,4],[-3,10],[-6,14],[-7,12],[-6,7],[-6,-22],[-10,-8],[-9,8],[-4,26],[-2,29],[-6,26],[-18,48],[2,-25],[7,-28],[3,-23],[-5,-11],[-9,7],[-12,45],[-8,15],[-4,-11],[-5,-8],[-6,-5],[-7,-2],[0,-8],[14,-1],[3,-16],[-3,-22],[-7,-20],[6,-4],[6,-11],[6,-13],[0,-12],[-5,-7],[-20,-14],[-8,-6],[-10,18],[-5,5],[-7,4],[-6,-2],[-6,-4],[-6,-3],[-6,5],[-9,13],[-101,63],[-39,41],[-12,19],[-6,18],[-2,19],[-20,64],[-4,17],[-2,5],[-5,5],[-5,4],[-13,2],[-6,0],[-8,6],[-18,26],[-5,9],[-2,3],[-2,10],[-4,-13],[6,-15],[17,-33],[5,-6],[5,-2],[12,-9],[13,-5],[1,-5],[-2,-6],[-1,-7],[9,-39],[44,-134],[3,-19],[2,-21],[1,-23],[2,-22],[6,-18],[14,-30],[25,-71],[9,-41],[-8,-18]],[[1659,3542],[-504,926],[-2,196]],[[1153,4664],[368,1],[552,94]],[[7489,5979],[10,-29],[9,3],[10,-10],[9,-16],[6,-17],[3,9],[4,4],[5,-1],[6,8],[6,-5],[7,-2],[36,0],[6,-4],[-4,-9],[0,-7],[6,-6],[3,5],[2,9],[4,5],[8,0],[3,-4],[-1,-7],[1,-9],[-3,-10],[-1,-6],[2,-3],[11,-7],[2,0],[3,-12],[2,-23],[14,-28],[11,-45],[9,-22],[2,-4],[5,-2],[2,-4],[4,-12],[2,-4],[1,-10],[-3,-34],[4,-16],[5,-35],[5,-16],[8,5],[9,-5],[9,-9],[9,-4],[27,-52],[1,-5],[2,-4],[5,-5],[2,-1],[6,2],[3,-1],[3,-6],[6,-18],[8,-16],[4,-13],[6,-50],[2,-11],[18,-66],[27,-51],[3,-3],[7,3],[5,7],[5,10],[6,-7],[4,-15],[6,-16],[11,-9],[14,3],[3,11],[1,15],[8,12],[0,-8],[-1,-4],[-1,-3],[1,-5],[5,-7],[-2,-11],[13,-23],[5,-23],[4,-5],[6,-3],[5,-1],[5,-5],[5,-12],[7,-23],[6,-15],[6,-13],[8,-9],[11,-3],[11,-9],[8,-20],[12,-45],[11,-29],[13,-25],[11,-29],[5,-36],[0,-11],[-3,-19],[0,-10],[1,-12],[5,-22],[1,-10],[3,-21],[14,-38],[1,-25],[-3,-22],[-7,-22],[-10,-20],[-9,-15],[6,44],[0,25],[-4,10],[-5,-9],[-15,-63],[-14,27],[-20,-8],[-19,-25],[-13,-21],[-14,-32],[-6,-10],[-12,-4],[-6,2],[-9,9],[-7,2],[-24,0],[-23,9],[-24,15],[-41,36],[-23,34],[-5,5],[-8,5],[-10,10],[-16,26],[-5,11],[-7,21],[-65,128],[-8,26],[10,0],[4,-2],[5,-5],[9,33],[5,45],[2,48],[-2,41],[-10,45],[-18,25],[-54,28],[-19,20],[-12,18],[-12,8],[-5,6],[-5,9],[-2,6],[-2,21],[-8,40],[-9,19],[-2,5],[-4,8],[-25,21],[-15,32],[-14,16],[-7,11],[-6,13],[-3,12],[-4,14],[-20,27],[-5,19],[-1,11],[-2,19],[0,10],[3,9],[2,9],[1,12],[-2,21],[-6,16],[-13,23],[-5,12],[-2,8],[0,7],[1,8],[9,40],[7,83],[4,20],[1,18],[-8,17],[0,6],[2,2],[0,1],[1,2],[1,2],[10,-16],[4,-4],[4,7],[1,16],[-3,14],[-4,14],[-2,12],[-6,22],[-23,42],[1,20],[17,4],[22,-22],[20,-33]],[[7426,6343],[-3,-30],[0,-15],[3,-15],[5,-9],[5,-6],[5,-8],[3,-17],[0,-30],[-14,-90],[-2,-63],[-4,-27],[-13,-10],[4,20],[-9,-5],[-3,-12],[-3,-13],[-7,-10],[-10,67],[-21,96],[-2,27],[-4,23],[0,14],[6,6],[3,7],[2,17],[0,52],[-3,21],[-8,4],[-15,-22],[4,33],[12,36],[17,32],[15,20],[18,-6],[11,-27],[7,-33],[1,-27]],[[7842,6659],[-2,-3],[-2,3],[2,4],[3,1],[-1,-5]],[[7157,6969],[15,-12],[12,-21],[6,-27],[0,-28],[-11,-25],[-15,9],[-11,25],[0,25],[4,-9],[4,-22],[3,-9],[6,-6],[4,0],[7,16],[3,22],[-9,24],[-12,20],[-10,11],[0,-2],[-1,-1],[-1,-2],[-1,-2],[0,7],[2,3],[5,4]],[[7139,6995],[-4,0],[-2,20],[-5,21],[-2,18],[6,8],[3,-10],[3,-18],[1,-39]],[[7450,7963],[-3,-19],[-15,57],[-12,51],[-19,52],[-18,54],[-32,34],[23,-5],[17,-15],[7,-35],[13,-46],[27,-81],[12,-47]],[[1585,5539],[46,-34],[5,-17],[9,-17],[7,-9],[16,4],[15,0],[14,-6],[283,-340]],[[1153,4664],[-99,0],[-41,7],[-31,20],[-10,44],[-3,50],[-3,700],[-6,51],[-12,24],[-42,56],[-181,317],[-12,37],[0,21],[16,62]],[[1590,3018],[-9,-8],[-8,11],[-1,14],[7,9],[6,3],[3,4],[3,1],[4,-4],[0,-10],[-5,-20]],[[1498,2828],[-7,-4],[-6,8],[-3,18],[-3,14],[-9,9],[-62,53],[-12,17],[-6,5],[-8,3],[-7,4],[-3,8],[-3,13],[-34,51],[-30,15],[-14,11],[-6,9],[-13,31],[-6,9],[-11,14],[-5,10],[8,2],[7,3],[6,-1],[20,-41],[8,-11],[47,-19],[46,-29],[11,-3],[5,-4],[4,-9],[6,-17],[51,-77],[11,-7],[11,-6],[8,-16],[5,-22],[0,-22],[-6,-19]],[[1350,3176],[4,-3],[6,0],[17,6],[37,1],[47,-10],[6,-7],[1,-24],[1,-14],[9,-26],[4,-15],[-1,-12],[-5,-8],[-10,-3],[-28,1],[-11,4],[-26,22],[-9,19],[-11,6],[-24,7],[-11,11],[-15,20],[-7,21],[11,14],[7,0],[4,-4],[4,-6]],[[1518,3124],[-6,-6],[-11,2],[-12,13],[-19,39],[-26,21],[5,14],[26,3],[21,-7],[10,-14],[6,-18],[3,-17],[1,-9],[3,-13],[-1,-8]],[[1523,3384],[-12,-13],[-17,2],[-11,26],[-8,27],[8,15],[14,-4],[8,-5],[4,-5],[9,-11],[6,-15],[-1,-17]],[[1528,3445],[-4,-9],[-8,7],[-14,8],[-23,3],[-13,13],[-4,17],[-6,20],[8,12],[18,-2],[24,-19],[10,-14],[6,-12],[6,-24]],[[1659,3542],[0,-3],[-10,6],[-8,16],[-8,18],[-8,14],[-9,3],[-31,3],[3,-4],[4,-11],[4,-5],[5,-3],[9,-1],[4,-2],[10,-10],[20,-37],[-8,-20],[-10,-9],[-11,-4],[-50,1],[-10,6],[-4,5],[-9,15],[-5,6],[-19,11],[-5,6],[-10,9],[-13,-1],[-34,-16],[-31,4],[-9,5],[-6,13],[-9,36],[-7,19],[-7,10],[-10,3],[-14,0],[-2,3],[-6,4],[-6,2],[-3,-5],[1,-9],[4,-6],[4,-5],[6,-3],[21,-4],[6,-9],[2,-24],[4,-18],[10,-13],[44,-35],[6,-13],[5,-39],[31,-99],[4,-24],[-3,-18],[-9,-9],[-11,-3],[-136,-5],[-5,-4],[-15,-17],[-46,-6],[-126,-59],[-12,-1],[-10,4],[-52,43],[-68,20],[-3,1],[-5,5],[-9,-7],[-27,-11],[-10,-1],[-12,-5],[-30,-36],[-12,-8],[-10,-1],[-24,3],[-12,6],[-8,13],[-5,17],[-12,97],[-12,25],[-23,8],[-30,-11],[-19,-3],[-4,-2],[-3,-5],[-4,-9],[-6,-8],[-6,-3],[-6,-1],[-6,-4],[-7,-11],[-3,-9],[2,-7],[8,-7],[12,21],[7,9],[8,4],[4,2],[4,6],[3,4],[9,-6],[7,1],[22,11],[15,4],[13,-5],[6,-21],[1,-21],[16,-93],[12,-27],[18,-17],[22,-4],[19,11],[36,44],[19,11],[43,-13],[9,6],[22,-13],[18,-29],[6,-5],[11,-5],[35,-42],[21,-14],[67,-25],[20,-13],[16,-19],[70,-103],[30,-65],[16,-47],[21,-44],[5,-15],[2,-14],[0,-126],[3,-31],[0,-17],[-5,-16],[-12,-21],[-6,-7],[-9,-8],[-16,-8],[-31,0],[-16,-6],[4,-6],[-5,-3],[-12,-2],[-8,-3],[-6,2],[-2,-1],[-2,-3],[-1,-7],[-3,-7],[-3,-3],[-8,-2],[-48,-27],[-9,-8],[-13,-19],[-13,-14],[-5,-3],[-6,-5],[-5,-11],[-5,-14],[-4,-10],[-11,-10],[-25,-19],[-19,-26],[-58,-40],[-8,-10],[-4,-11],[-30,-30],[-21,-4],[-19,10],[-16,19],[-26,40],[-18,22],[-20,15],[-16,-3],[-14,13],[-8,5],[-12,2],[-9,4],[-23,23],[-28,18],[-7,2],[-5,-3],[-11,-13],[-6,-4],[-18,1],[-76,-10],[-11,-4],[-32,-21],[-11,-4],[-13,-1],[-12,3],[-22,13],[-12,4],[-46,-15],[-13,1],[-5,-6],[-7,-7],[-9,-5],[-7,-2],[-8,5],[-7,10],[-7,6],[-9,-7],[-7,2],[-11,0],[-11,3],[-8,20],[-22,28],[-17,15],[-20,8],[-21,0],[-19,-10],[-42,-59],[-17,-15],[-25,-4],[-20,14],[-58,91],[-16,18],[0,111],[0,188],[0,182],[0,171],[0,257],[-1,164],[0,38],[0,184],[0,180],[0,257],[0,39],[1,123],[0,148],[0,105],[-8,-2],[-11,10],[-1,31],[-13,-6],[-4,13],[-1,20],[-3,16],[-10,13],[-5,9],[-1,11],[1,4],[5,13],[1,6],[-3,12],[-11,18],[-4,10],[-1,10],[1,9],[3,11],[5,32],[-1,18],[-7,7],[4,15],[8,5],[9,3],[8,10],[-1,7],[-4,9],[-2,8],[5,3],[5,0],[2,3],[2,6],[0,24],[2,11],[3,7],[9,2],[3,8],[2,18],[-3,15],[-8,-1],[0,12],[-2,9],[-3,5],[-6,1],[5,4],[5,3],[6,0],[6,-1],[-2,13],[3,7],[4,7],[2,10],[-1,6],[-5,8],[-1,6],[0,3],[3,2],[2,20],[5,11],[2,1],[0,103],[0,221],[0,190],[0,180],[0,250],[0,40],[0,122],[0,189],[0,3],[0,11]],[[3295,3533],[166,-278],[50,-52],[38,-32],[24,-30],[25,-45],[20,-54],[13,-54],[-9,-54],[-49,-133],[-3,-29],[-1,-18],[2,-45],[3,-17],[4,-12],[17,-33],[9,-26],[9,-17],[7,-12],[10,-11],[8,-15],[20,-46],[6,-10],[5,-7],[3,-9],[19,-76],[5,-12],[5,-7],[6,-1],[5,2],[4,4],[6,9],[3,1],[4,-3],[6,-10],[29,-90],[6,-15],[5,-8],[4,-5],[4,-3],[11,-3],[5,-3],[9,-13],[43,-110],[5,-17],[1,-18],[-1,-14],[-5,-28],[-2,-18],[2,-19],[7,-29],[8,-13],[7,-9],[24,-10],[7,-5],[17,-24],[12,-22],[33,-42],[29,-47],[9,-11],[7,-4],[6,1],[6,3],[7,5],[7,2],[8,-4],[36,-49],[23,-22],[23,-29],[8,-8],[15,-10],[7,-6],[17,-22],[3,-2],[2,-2],[3,-1],[3,1],[4,4],[5,7],[3,4],[3,1],[4,-1],[2,-4],[1,-5],[-1,-7],[0,-8],[2,-10],[5,-5],[6,-1],[17,0],[8,-2],[7,-5],[12,-14],[7,-4],[6,1],[13,11],[18,10],[7,2],[30,-1],[7,1],[5,4],[3,4],[3,8],[1,10],[0,19],[-1,11],[-3,12],[-13,41],[-2,9],[-1,8],[0,8],[1,6],[5,6]],[[4349,1798],[9,7],[10,5],[10,2],[14,0],[17,-2],[35,-11],[41,-25],[30,-27],[9,-13],[8,-16],[11,-43],[2,-8],[4,-3],[29,-7],[9,-7],[9,-12],[24,-40],[3,-4],[28,-21],[14,-17],[15,-21],[31,-26],[12,-7],[8,-26],[3,-19],[2,-194]],[[4736,1263],[-15,-1],[-18,-7],[-10,-2],[-14,9],[-5,-7],[-7,-6],[-9,6],[-4,-7],[8,-6],[0,-7],[-17,0],[-4,4],[-2,17],[-3,6],[-6,-2],[-5,-8],[-6,-4],[-9,7],[6,7],[0,7],[-4,4],[-14,5],[-1,7],[-1,10],[-2,10],[-24,17],[-7,-6],[-10,-19],[-6,-8],[-6,7],[-11,7],[-11,4],[-10,1],[-7,4],[-39,35],[-8,6],[-14,3],[-10,5],[-4,1],[-11,-3],[-5,0],[-3,3],[-12,-9],[-7,-3],[-5,-1],[-7,-4],[-7,-8],[-5,-10],[-5,-5],[-10,-2],[-11,6],[-36,32],[-6,3],[-9,1],[-27,-7],[-7,0],[-10,6],[-7,1],[-6,4],[2,22],[-5,7],[1,3],[1,7],[1,4],[-5,-1],[-2,1],[3,11],[4,6],[6,2],[7,0],[3,8],[-5,15],[-7,7],[-4,-14],[-2,-6],[-6,1],[-6,4],[-4,5],[-2,8],[-6,32],[-3,0],[-3,-39],[-4,-19],[-10,-8],[-5,-11],[-2,-4],[-3,2],[-6,6],[-25,0],[-13,6],[-7,2],[-3,-4],[-3,-9],[-6,-5],[-8,-2],[-42,-1],[-11,-7],[-35,25],[-5,12],[-5,20],[-10,15],[-10,3],[-4,-15],[-8,9],[-6,12],[-8,11],[-12,8],[-4,0],[-10,-1],[-4,1],[-3,5],[-4,15],[-4,6],[-7,-34],[-21,-22],[-25,-7],[-20,11],[-8,-23],[-6,-10],[-8,-8],[-10,11],[-6,19],[-5,20],[-5,17],[-9,9],[-8,-2],[-10,-6],[-14,-1],[0,6],[11,6],[4,16],[-1,16],[-6,9],[-5,-2],[-3,-5],[-3,-7],[-2,-20],[-3,2],[-6,13],[-22,8],[-13,-5],[-21,-37],[-3,0],[-10,81],[-5,1],[-6,4],[-6,5],[-3,5],[-3,7],[-6,2],[-7,0],[-5,1],[-7,9],[-19,33],[-4,15],[-3,15],[-8,12],[-8,11],[-7,12],[-4,13],[-3,16],[0,41],[-2,20],[-5,18],[-49,112],[-14,26],[-5,13],[-5,16],[-6,15],[-10,9],[-3,-6],[-1,22],[-4,15],[-8,12],[-5,5]],[[3453,2055],[0,2],[0,36],[-4,33],[-6,24],[-5,14],[-6,3],[-11,-2],[-5,1],[-4,5],[-9,14],[-5,5],[-6,2],[-6,-4],[-20,-20],[-22,-12],[-5,-3],[-3,-4],[-2,-4],[-2,-5],[1,-7],[1,-8],[4,-10],[15,-21]],[[3353,2094],[-6,0],[-10,8],[-9,13],[-7,30],[-14,37],[-5,18],[-7,48],[-5,21],[-9,22],[-10,5],[-22,-8],[-6,13],[6,3],[5,5],[2,8],[-2,10],[-5,6],[-5,24],[-1,29],[7,21],[-3,5],[-3,6],[-2,8],[-3,8],[4,3],[11,4],[12,15],[2,1],[4,10],[15,21],[4,12],[-1,10],[-1,10],[-3,9],[-3,4],[-7,-2],[-3,-10],[-1,-10],[2,-4],[-1,-7],[-16,-31],[-7,-8],[-19,-3],[-16,13],[-16,20],[-19,16],[-6,2],[-10,-3],[-6,1],[-4,3],[-8,8],[-37,15],[-10,6],[-13,17],[-9,22],[-6,22],[-9,20],[3,13],[-2,15],[-3,13],[-3,6],[3,9],[1,18],[3,12],[10,-6],[8,11],[5,12],[3,14],[-2,17],[-7,-13],[-9,-6],[-6,4],[4,15],[-3,4],[-2,5],[-2,7],[-1,7],[-2,12],[-7,3],[-7,-2],[-4,0],[-2,8],[0,10],[1,10],[-1,9],[-2,12],[-3,9],[-26,52],[-6,17],[-3,13],[-4,10],[-24,26]],[[3098,3756],[45,-54],[4,-12],[5,-19],[-2,-32],[0,-17],[2,-17],[5,-24],[4,-7],[5,-1],[6,1],[5,-3],[11,-15],[6,-5],[7,-3],[16,4],[8,0],[9,-2],[19,-16],[6,-4],[6,-3],[11,-2],[5,0],[5,1],[3,2],[6,5]],[[5322,5351],[0,29],[-3,6],[-4,13],[-47,84],[-27,59],[-7,23],[-4,18],[-1,47],[1,26],[1,8],[1,4],[28,26],[17,12],[9,4],[58,5],[10,5],[9,8],[11,18],[4,3],[6,0],[7,-1],[40,17],[4,7],[2,7],[-1,10],[-2,10],[-1,14],[-1,15],[2,19],[2,9],[4,6],[3,2],[3,0],[3,-2],[18,-16],[8,-5],[7,0],[6,4],[6,9],[29,51],[8,11],[27,30],[11,20],[5,16],[3,15],[0,10],[-2,8],[-3,4],[-4,2],[-6,1],[-12,-3],[-7,1],[-5,2],[-3,5],[-1,11],[44,181],[53,152],[5,11],[51,47],[4,3],[115,7],[6,11],[3,6],[-22,42],[-1,0]],[[5792,6498],[7,16],[10,32],[4,17],[2,20],[1,22],[0,3],[2,2],[1,3],[0,6],[-1,6],[-2,3],[-3,2],[-1,2],[-2,11],[-7,22],[-2,11],[-1,38],[3,78],[-5,38],[-12,27],[-5,18],[-2,23],[0,42],[-2,20],[-5,21],[-7,16],[-17,24],[-6,14],[-2,9],[-1,9],[0,19],[-2,12],[-10,15],[-3,10],[-1,10],[1,8],[2,7],[1,4],[0,10],[-7,27],[-3,23],[1,15],[6,15],[11,21],[8,-6],[29,-10],[22,2],[7,-3],[9,-7],[6,-3],[7,1],[7,4],[4,-2],[0,-17],[9,11],[11,1],[22,-5],[7,-3],[19,-16],[6,-8],[3,-18],[2,-25],[5,-21],[10,-9],[12,-4],[22,-12],[12,2],[7,10],[17,41],[3,19],[-7,16],[-9,15],[-4,13],[5,19],[9,-2],[11,-10],[10,-7],[4,1],[6,2],[5,3],[2,4],[2,3],[14,-6],[6,0],[6,14],[3,21],[4,19],[13,6],[8,-17],[9,-14],[8,-16],[7,-43],[-1,-8],[-8,-3],[-3,1],[-9,3],[-4,3],[-2,8],[-1,11],[-3,9],[-5,-1],[-3,-9],[0,-14],[3,-23],[0,-37],[4,-11],[11,-6],[2,2],[4,4],[5,4],[7,-3],[4,-6],[4,-9],[4,-9],[8,-3],[33,-7],[9,0],[23,13],[7,-1],[3,-15],[-1,-15],[-27,-108],[-2,-34],[4,-33],[16,-60],[6,-38],[1,-41],[-10,-63],[-3,-41],[-35,-98],[-5,-5],[-3,-5],[-8,-33],[-4,-5],[-10,-11],[-11,-22],[-7,-8],[-23,-5],[-17,-11],[-11,1],[-27,11],[-8,1],[-12,6],[-6,1],[-6,-8],[-7,4],[-12,11],[-9,-12],[-3,-20],[1,-115],[3,-25],[6,-15],[27,-39],[3,-7],[2,-10],[2,-7],[6,-4],[10,-6],[22,-50],[3,-17],[10,-36],[2,-24],[-16,-53],[-3,-2],[-3,-6],[-3,-8],[-1,-7],[-2,-7],[-5,-2],[-6,0],[-5,-1],[-26,-24],[-4,-6],[-22,-43],[-4,-3],[-18,-4],[-17,-12],[-6,-1],[-9,-8],[-9,-15],[-11,-15],[-14,-2],[-12,10],[-15,35],[-9,15],[-11,5],[-13,2],[-13,-3],[-9,-8],[-13,-32],[-6,-4],[-7,3],[-1,7],[0,10],[-3,10],[-10,8],[-36,2],[-18,4],[-8,-4],[-7,-14],[-3,-21],[3,-16],[5,-14],[2,-12],[3,-3],[13,-1],[4,-3],[15,-26],[2,-17],[-10,-17],[-14,-8],[-13,5],[-8,-8],[-10,-14],[-8,-14],[-3,-13],[-1,-20],[-3,-19],[-4,-16],[-5,-12],[-16,-29],[-8,-7],[-16,-13],[-8,-3],[-5,2],[-8,-17],[-20,-26],[-9,-17],[-3,-10],[-1,-8],[-1,-6],[-14,-21],[-4,0],[-2,12],[-30,-20],[-15,-13],[-7,-17],[-7,-26],[-17,-2],[-31,11],[-38,-16],[-7,-7],[-4,-9],[-11,10],[-18,28],[-3,0],[-2,-10],[-4,-12],[-2,-11],[5,-22],[-2,-12],[-4,-12],[-5,-24],[-6,-7],[-7,-2]],[[6246,7215],[-4,0],[-3,3],[-12,5],[-3,2],[0,13],[-2,10],[-3,8],[-6,6],[13,17],[5,9],[4,14],[6,-10],[1,-4],[9,-17],[2,-18],[-3,-18],[-4,-20]],[[6027,7301],[-2,-9],[-2,0],[-9,3],[-3,8],[0,14],[-1,2],[1,4],[7,9],[5,0],[0,-5],[2,-3],[2,-3],[1,-2],[1,-6],[0,-9],[-2,-3]],[[3772,9086],[-12,-37],[-10,-16],[-13,-7],[-22,0],[-8,2],[-5,4],[-11,15],[1,6],[1,3],[2,3],[14,-7],[12,9],[7,20],[-4,25],[5,5],[4,7],[3,8],[-1,7],[8,0],[11,-26],[9,-14],[9,-7]],[[3242,9410],[12,-10],[13,8],[91,-8],[5,-5],[7,-12],[5,-13],[3,-11],[4,0],[3,16],[6,8],[7,1],[3,-8],[3,-11],[8,-2],[15,3],[22,-17],[4,0],[3,-4],[22,-13],[9,4],[14,0],[14,-6],[7,-11],[4,0],[0,27],[-2,8],[-5,15],[-1,7],[-4,9],[-7,9],[-3,7],[8,5],[5,-6],[9,-17],[5,-3],[5,-7],[2,-14],[-1,-30],[-6,-24],[-16,-6],[-19,2],[-18,-2],[3,5],[5,15],[-11,1],[-6,-6],[-3,-11],[-3,-17],[-3,0],[-4,15],[-5,-16],[-4,-26],[0,-13],[-6,-9],[-17,-39],[-9,-12],[-5,-3],[-5,-1],[-5,1],[-6,3],[-20,17],[-5,3],[-11,-5],[-21,-19],[-13,-3],[0,5],[0,3],[3,6],[-17,-11],[-17,-6],[-18,-1],[-61,18],[-3,2],[-4,9],[-3,2],[-3,-1],[-5,-5],[-3,-1],[-3,3],[-3,7],[-3,7],[-6,3],[-2,3],[-5,13],[-2,5],[-4,4],[-2,2],[-10,0],[-13,7],[-4,-1],[-2,-8],[0,-9],[3,-7],[5,-2],[8,-6],[4,-14],[-1,-14],[-8,-6],[-20,-6],[-9,3],[-6,16],[-10,-8],[-9,-4],[-7,-7],[-6,-34],[-9,-4],[-9,8],[-8,16],[-4,14],[-6,38],[0,11],[9,19],[4,5],[10,-7],[5,1],[17,8],[4,1],[3,4],[2,13],[-1,10],[-4,12],[-12,30],[-3,9],[-2,10],[0,12],[0,13],[3,2],[8,-5],[2,-4],[2,-7],[4,-5],[6,3],[2,7],[4,27],[4,6],[1,1],[1,2],[2,2],[3,2],[3,-3],[5,-9],[3,-2],[6,1],[8,5],[6,1],[7,-3],[13,-9],[8,-1],[7,3],[20,23],[15,8],[12,1],[13,-5]],[[6656,275],[11,-5],[10,5],[4,0],[4,-16],[5,-4],[6,-2],[6,-3],[13,-15],[5,-5],[13,-5],[5,-3],[15,-23],[33,-23],[26,-29],[6,-4],[11,-1],[62,-30],[5,-5],[2,-11],[4,-9],[5,-7],[12,-6],[3,-8],[4,-17],[3,-3],[3,-2],[3,-2],[2,-6],[-2,-9],[-3,-3],[-3,1],[-3,5],[-4,-5],[-3,-1],[-4,1],[-4,5],[-6,-8],[-6,-4],[-7,0],[-7,5],[-2,-12],[-3,-1],[-3,4],[-5,2],[-23,0],[-3,1],[-2,6],[-3,0],[-3,-3],[-4,-8],[-2,-2],[-6,-4],[-6,-6],[-4,1],[-4,15],[5,0],[4,1],[3,5],[-1,8],[-3,6],[-4,-1],[-4,-3],[-6,-2],[-4,3],[-3,7],[-2,6],[-2,3],[-5,-2],[-5,-2],[-4,-1],[-6,5],[2,4],[2,11],[-5,0],[-2,4],[-1,6],[0,9],[-5,-7],[-4,-9],[-5,-8],[-6,-3],[-20,21],[-8,-9],[-5,7],[-2,14],[0,14],[4,8],[5,8],[2,9],[-4,9],[-5,4],[-3,-3],[-1,-6],[-3,-3],[-4,2],[-3,5],[-2,7],[-8,-5],[-8,-9],[-14,-19],[-2,20],[21,18],[0,15],[-5,5],[-12,0],[-5,2],[-6,8],[-6,18],[-5,10],[-4,2],[-4,-3],[-4,-1],[-1,9],[3,21],[-1,7],[-7,2],[-4,3],[-4,7],[-4,8],[-1,6],[0,12],[2,10],[5,21],[28,-35]],[[7175,312],[2,-8],[3,-6],[7,5],[11,-8],[5,-7],[2,-8],[1,-9],[2,-12],[4,-11],[4,-5],[-3,-11],[-4,-10],[-5,-7],[-6,-5],[-4,14],[-10,8],[-12,1],[-11,-3],[-19,-18],[-8,2],[-2,23],[-4,0],[-3,-25],[-8,-11],[-11,0],[-15,9],[-7,-2],[-5,5],[-2,14],[-2,6],[-5,5],[-7,4],[-5,1],[3,7],[3,6],[4,4],[5,4],[-3,4],[-5,15],[4,1],[2,-2],[2,-5],[9,-9],[24,-3],[11,-8],[4,7],[7,-6],[3,2],[0,8],[-3,9],[-4,0],[0,-7],[-3,0],[-4,4],[-4,4],[-1,5],[1,7],[-4,4],[-4,5],[-2,8],[-1,9],[11,-6],[15,0],[22,6],[6,-5],[5,1],[4,2],[5,2],[5,-4]],[[6654,383],[-2,-9],[-4,-12],[-5,-7],[-6,4],[-1,-4],[-5,-5],[-7,-3],[-7,2],[5,6],[3,1],[0,7],[-15,20],[-4,-6],[-3,1],[-2,6],[-2,5],[-19,20],[-8,17],[2,12],[6,5],[7,-7],[7,-10],[27,-10],[23,-29],[10,-4]],[[6279,989],[35,-19],[7,2],[5,0],[16,-19],[7,-5],[16,9],[19,17],[17,11],[14,-10],[4,0],[19,-13],[6,-7],[5,-12],[0,-8],[-5,-7],[-7,-6],[-6,-3],[-23,-4],[-7,-2],[-10,-8],[-5,-3],[-12,1],[-15,8],[-32,24],[-33,13],[-23,27],[0,7],[4,-1],[2,2],[1,3],[1,3]],[[5465,1004],[5,-3],[4,3],[2,6],[1,3],[4,-4],[1,-4],[0,-3],[0,-1],[3,0],[-15,-21],[-1,-9],[12,-3],[-3,-4],[-5,-11],[-3,-5],[0,-9],[-8,-1],[-9,8],[-4,19],[-5,8],[-23,0],[-10,2],[-2,-14],[1,-13],[-1,-11],[-5,-8],[-5,27],[-1,14],[2,19],[4,10],[6,8],[7,6],[9,2],[30,0],[4,-2],[5,-9]],[[5347,1063],[2,-8],[8,2],[7,0],[7,3],[7,9],[7,-6],[6,-8],[1,-12],[-7,-14],[4,-7],[-2,-10],[0,-14],[-2,-9],[4,-10],[0,-10],[-2,-8],[-5,-6],[-11,9],[-13,8],[-13,3],[-11,-7],[-6,20],[-4,8],[-4,5],[3,8],[8,-10],[9,-8],[9,-6],[11,-3],[10,0],[3,2],[-3,6],[-36,57],[-3,9],[1,9],[5,6],[5,-2],[5,-6]],[[6039,1201],[-7,-2],[2,11],[6,0],[-1,-9]],[[5916,1265],[-5,-10],[0,7],[5,3]],[[5909,1343],[-5,-10],[-2,5],[5,9],[2,-4]],[[5471,1653],[7,-19],[-13,6],[-3,-15],[2,-20],[4,-10],[6,-6],[19,-26],[10,-8],[10,-6],[4,0],[5,6],[3,9],[0,11],[-1,9],[-4,4],[-1,7],[8,16],[13,23],[15,18],[22,14],[20,-6],[9,-39],[-2,-20],[-10,-42],[-5,-41],[-16,-57],[-4,-6],[3,-10],[-5,-32],[2,-18],[-10,14],[-20,29],[-10,10],[-55,27],[-25,6],[-12,0],[-8,2],[-7,5],[-2,15],[-2,29],[1,25],[7,5],[4,9],[7,14],[4,11],[-6,5],[-3,4],[-6,11],[-8,18],[-3,0],[1,-25],[-9,-16],[-12,0],[-6,18],[-1,8],[-2,4],[-3,2],[-1,3],[-1,8],[1,48],[-2,7],[-11,27],[-2,7],[-1,12],[-4,9],[-6,7],[-11,4],[-1,7],[-1,7],[-2,4],[-3,2],[-8,2],[-3,2],[-6,10],[-5,10],[-2,12],[-2,18],[1,16],[2,19],[3,13],[16,-14],[10,-15],[9,-18],[3,-21],[5,-21],[13,-14],[14,-10],[12,-11],[35,-71],[10,-10],[13,-9],[13,-12]],[[4349,1798],[-1,34],[1,8],[2,16],[3,8],[2,6],[3,7],[9,12],[6,3],[7,3],[13,-1],[9,-3],[19,-12],[5,-2],[160,81],[26,19],[6,7]],[[4619,1984],[1,0],[42,1],[11,-3],[32,-24],[8,2],[9,11],[6,4],[5,-1],[8,-6],[5,2],[13,9],[5,2],[12,-3],[21,-13],[26,-6],[26,-18],[12,-1],[34,8],[14,-2],[6,-8],[8,-30],[4,-6],[4,-1],[4,-4],[2,-16],[1,-14],[0,-3],[-4,1],[-8,-3],[-29,-27],[-11,-7],[-37,-14],[-21,-11],[-13,-2],[-10,7],[-7,-11],[-25,-14],[-9,-8],[-5,-20],[2,-17],[14,-30],[40,-57],[17,-37],[-2,-38],[14,-2],[9,-6],[16,-30],[7,-9],[10,-7],[10,-5],[10,-2],[31,3],[11,-3],[11,-6],[19,-21],[3,-1],[8,1],[5,3],[10,9],[5,1],[5,-3],[4,-9],[6,-17],[17,-10],[4,-4],[8,-20],[10,-15],[7,-7],[21,-7],[22,-15],[12,-4],[11,5],[3,-2],[6,0],[6,1],[3,5],[22,-10],[14,-9],[5,1],[9,11],[5,2],[22,-5],[-3,-7],[-7,-14],[-1,-6],[4,-10],[12,-14],[3,-13],[6,-5],[14,3],[35,16],[35,3],[8,5],[16,22],[10,6],[14,-3],[-1,-12],[-10,-13],[-22,-9],[-66,-64],[-19,-13],[-20,-6],[-9,0],[-3,3],[-3,4],[-11,-2],[-24,18],[-11,4],[-23,3],[-10,5],[-8,8],[-14,0],[-18,-26],[-10,-37],[7,-33],[3,-1],[1,1],[0,7],[8,-8],[25,-2],[10,-7],[4,-5],[6,-3],[18,-5],[5,-5],[9,-12],[65,-35],[12,-19],[4,-33],[6,-16],[2,-10],[-3,-10],[-8,-9],[-65,-43],[-6,5],[-2,3],[-14,-6],[-8,-1],[-4,-2],[-9,-11],[-1,-4],[-5,-11],[-6,-10],[-2,2],[-2,-4],[-3,-5],[-3,-8],[0,-13],[-8,5],[-9,1],[-9,-2],[-7,-4],[-6,22],[-9,7],[-11,-4],[-25,-23],[0,-2],[-4,2],[-5,4],[-3,4],[0,3],[-5,-4],[-6,-6],[-10,-16],[-4,8],[-13,15],[-1,6],[2,6],[3,7],[2,8],[-6,6],[-13,-4],[-13,-9],[-8,-10],[-9,21],[-3,5],[-5,4],[-2,-2],[-2,-3],[-5,1],[-7,16],[-4,5],[-4,0],[-4,-1],[-6,1],[-5,6],[10,12],[-1,11],[-6,10],[-3,11],[-2,3],[-3,-9],[-6,-18],[-4,0],[-5,3],[-9,11],[2,4],[1,16],[-5,-9],[-2,-5],[-4,0],[-3,9],[-7,8],[-15,10],[3,-13],[-1,-1],[-2,0],[0,-1],[0,-5],[-5,5],[-6,4],[-5,3],[-7,1],[7,11],[8,5],[7,7],[1,17],[-3,-2],[-8,-4],[2,7],[3,6],[4,4],[5,2],[4,-11],[6,0],[14,5],[24,-11],[25,13],[5,4],[1,6],[1,16],[1,5],[3,3],[12,4],[-7,5],[-7,1],[-7,0],[-8,1],[-6,4],[-11,13],[-11,4],[-7,5],[-4,1],[-2,-2],[-3,-10],[-3,-2],[-1,-7],[-1,-14],[-2,-16],[-5,-10],[-4,7],[-2,6],[-1,8],[0,9],[-1,8],[-2,3],[-3,2],[-1,4],[-5,24],[-3,9],[-5,10],[-14,16],[-30,16],[-11,15],[-11,9],[-18,4],[-20,-2]],[[5462,1920],[-8,-8],[-2,4],[-1,12],[-3,5],[-1,4],[-4,8],[-15,14],[-7,13],[2,14],[10,10],[10,2],[8,-5],[6,-6],[1,-9],[2,-1],[0,-6],[-2,-16],[-3,-2],[-1,-1],[0,-7],[1,-4],[3,0],[3,-4],[2,-7],[-1,-10]],[[5260,2143],[10,-7],[7,1],[10,10],[11,3],[10,5],[8,19],[21,-26],[16,-28],[3,-6],[1,-6],[-2,-15],[1,-5],[5,-9],[8,-9],[8,-7],[7,-2],[1,-6],[-3,-38],[-3,-7],[-4,-3],[-3,-3],[2,-10],[6,-7],[6,0],[5,-3],[4,-24],[4,-6],[5,-5],[4,-8],[0,-13],[-4,-12],[-5,-9],[-6,-6],[-6,11],[-9,-12],[-18,-32],[0,16],[6,23],[1,11],[-4,8],[-8,3],[-17,-1],[2,-17],[-10,2],[-23,15],[-34,-7],[-12,0],[-19,9],[-18,15],[-21,11],[-23,-2],[-21,-5],[-18,-1],[-2,7],[8,15],[18,24],[13,12],[5,11],[1,13],[0,21],[-4,10],[-26,27],[-17,67],[-1,29],[4,23],[12,16],[14,9],[14,2],[31,-30],[18,-9],[7,-11],[10,-23],[14,-18]],[[5105,2208],[1,-8],[1,1],[5,-10],[1,-5],[-2,-4],[-3,-3],[-2,-5],[-2,-15],[-9,-36],[-5,-12],[-2,-7],[5,-3],[9,0],[1,-9],[-1,-7],[-3,-11],[-9,-17],[-14,0],[-15,10],[-13,13],[-1,-2],[-1,-1],[0,-1],[-3,-2],[1,15],[-1,15],[-2,12],[-6,5],[-9,2],[-21,11],[-4,4],[-4,11],[-3,12],[-3,10],[-21,32],[-3,8],[0,32],[2,28],[5,26],[11,24],[12,20],[13,15],[14,6],[12,-8],[29,-27],[13,-17],[10,-23],[10,-42],[2,-24],[5,-13]],[[6234,2611],[25,-46],[44,8],[23,-5],[14,-7],[19,-5],[17,5],[10,0],[11,0],[10,-3],[8,-6],[5,-13],[7,-5],[9,-30],[10,-10],[17,-9],[11,9],[12,-14],[6,-10],[-2,-25],[13,-8],[12,-13],[9,-7],[-8,-12],[-4,-11],[3,-6],[-2,-5],[-3,-8],[-5,-3],[-6,5],[-4,8],[-7,7],[-3,-5],[-5,-12],[1,-7],[10,-14],[11,-15],[3,-16],[-5,-11],[-3,0],[-3,15],[-7,13],[-11,0],[-15,-21],[-21,-4],[-11,-6],[-4,7],[-8,-2],[-5,14],[-8,18],[-8,6],[-8,12],[-4,13],[-4,9],[-3,-13],[-6,-9],[2,-15],[12,-5],[0,-17],[-9,-18],[-8,27],[-11,8],[-15,10],[-9,9],[-6,21],[3,15],[12,-17],[12,-1],[-3,14],[3,9],[4,4],[4,1],[2,3],[-5,9],[-4,5],[-6,6],[-11,10],[-16,22],[-12,16],[-8,15],[-13,-9],[-5,5],[-7,11],[-8,10],[-16,12],[-19,-6],[-4,8],[19,13],[0,8],[-2,15],[-12,23],[-11,11],[-14,-17],[-1,-17],[1,-18],[1,-38],[-1,-12],[-3,-14],[-5,49],[-12,41],[8,20],[26,25],[10,-4]],[[5515,3122],[-1,-1],[-2,0],[-1,-1],[-1,-47],[-2,-20],[-5,-20],[16,-32],[0,-41],[-17,-136],[-2,-26],[5,-11],[8,-8],[6,-18],[3,-21],[0,-14],[-7,12],[-15,49],[-31,34],[-1,6],[3,8],[26,63],[12,51],[2,18],[-2,4],[-9,16],[-7,8],[-5,4],[-31,5],[-9,7],[-4,19],[10,24],[2,9],[1,12],[3,10],[8,18],[10,13],[11,7],[25,3],[1,-4]],[[3824,3530],[-529,3]],[[3188,5656],[3,-17],[8,-5],[10,4],[8,6],[12,3],[10,-3],[8,-5],[8,-2],[8,-6],[5,-15],[3,-18],[5,-15],[27,-33],[5,-1],[5,-2],[5,-3],[4,-7],[5,3],[7,10],[6,1],[3,-2],[6,-12],[7,-20],[6,-10],[2,6],[7,5],[49,-11],[5,0],[5,3],[6,9],[5,11],[6,9],[7,5],[5,-2],[14,-12],[3,1],[1,2],[1,3],[2,4],[4,4],[2,-1],[3,-6],[27,-17],[24,-6],[10,-7],[7,-11],[6,-12],[2,-2],[6,-3],[3,-2],[1,-5],[1,-10],[1,-5],[4,-7],[14,-13],[38,-64],[14,-46],[5,-10],[9,-9],[5,-22],[5,-27],[5,-15],[13,-32],[40,-36],[14,-25],[2,-13],[-1,-9],[-2,-8],[1,-11],[3,-13],[5,-9],[4,-11],[4,-27],[5,-23],[1,-13],[-2,-8],[-3,-7],[-2,-9],[3,-12],[-6,-13],[1,-14],[3,-17],[2,-20],[-2,-4],[-7,-9],[-2,-3],[1,-12],[3,-7],[3,-1],[4,6],[-4,-79],[-42,-26],[-94,-9],[-5,-5],[-9,-16],[-4,-5],[-6,1],[-6,4],[-6,3],[-6,-4],[-10,-5],[-36,21],[-12,0],[-22,-10],[-12,-3],[-83,8],[-7,-1],[-3,9],[-4,8],[-5,5],[-7,4],[-8,2],[-26,-2],[-8,-4],[-13,-18],[-9,-4],[-18,1],[-9,-2],[-8,-6],[-1,-23],[-8,-41],[-2,-22],[1,-47],[3,-46],[4,-23],[17,-39],[12,-19],[5,-13],[4,-4],[6,-3],[4,2],[7,12],[7,6],[-1,-13],[-2,-10],[-3,-8],[-1,-8],[1,-12],[4,-16],[2,-12],[-1,-13],[-3,-23],[0,-11],[2,-2],[28,-38],[6,-13],[5,-14],[2,-20],[-2,-46],[3,-13],[3,-11],[-2,-5],[-3,-3],[-1,-9],[3,-9],[4,-17],[3,-30],[1,-9],[9,-25],[2,-9],[3,-4],[3,-4],[1,-5],[0,-5],[-3,-3],[-3,-2],[-1,-3],[3,-10],[3,-1],[3,2],[6,-5],[2,-7],[0,-6],[1,-5],[8,-2],[2,3],[9,17],[3,0],[4,-5],[2,-5],[1,-5],[-3,-5],[32,-14],[16,-14],[7,-22],[2,-10],[5,-5],[6,-2],[4,0],[8,-2],[5,-6],[5,-9],[6,-9],[-4,-9],[3,-2],[6,0],[6,-3],[13,-19],[6,-12],[3,-11],[-1,-37],[5,-9],[30,-8],[7,-8],[3,-14],[0,-25],[4,-20],[7,-16],[4,-15],[-4,-19],[26,6],[0,8],[-5,4],[-4,6],[-2,10],[0,13],[14,-20],[12,-22],[8,-28],[4,-62],[4,-16],[7,-11],[10,-7],[8,-2],[17,7],[11,1],[4,-3],[3,-6],[4,-2],[6,8],[5,4],[6,-1],[6,-4],[26,-34],[11,-11],[12,-4],[4,-9],[2,-7]],[[3744,5974],[2,-4],[2,3],[2,1],[2,1],[2,1],[6,-10],[12,-25],[7,-11],[8,-7],[22,-7],[13,-10],[14,-13],[26,-33],[12,-25],[3,-26],[-5,-86],[-12,-48],[-3,-25],[-6,4],[-2,3],[0,-7],[0,-13],[0,-6],[-6,1],[-4,-1],[-4,-6],[-4,-8],[-3,12],[-1,33],[-3,15],[-5,8],[-6,5],[-15,7],[-18,3],[-8,7],[-7,16],[-2,7],[-2,21],[-3,8],[-20,31],[-7,14],[-11,32],[-8,18],[-2,9],[0,8],[3,25],[-2,46],[2,14],[6,11],[13,5],[7,11],[1,-5],[2,-2],[2,-2]],[[3915,6013],[-14,-16],[-16,8],[-8,27],[1,31],[12,20],[14,-15],[10,-27],[1,-28]],[[3647,6137],[-5,-17],[-5,-9],[-16,-15],[-11,27],[-1,1],[-5,-1],[-1,0],[-1,5],[0,4],[0,3],[-1,5],[0,10],[6,10],[10,8],[8,2],[10,-3],[4,-9],[3,-11],[5,-10]],[[3453,2055],[-5,6],[-8,6],[-7,1],[-2,-8],[6,-19],[-12,-2],[-17,9],[-16,15],[-12,14],[-3,12],[-3,32],[-3,13],[-6,9],[-7,3],[-7,-2],[-9,-3],[3,-8],[8,-5],[3,-7],[2,-11],[-1,-9],[-2,-6],[-2,-1]],[[6877,7333],[-7,-31],[-15,-8],[-14,28],[-2,2],[-2,-1],[-2,0],[-1,5],[0,7],[1,4],[2,4],[3,15],[7,15],[2,5],[4,10],[10,10],[9,1],[2,-18],[-4,-6],[7,-42]],[[6918,7406],[0,-15],[-7,-10],[-7,2],[-6,8],[-7,7],[-9,-3],[4,9],[12,10],[5,7],[11,-2],[4,-13]],[[6657,7923],[0,-16],[-4,4],[-1,0],[0,-2],[-2,-2],[-7,10],[-16,11],[-6,6],[16,23],[6,3],[9,-22],[5,-15]],[[6704,8008],[-2,-20],[-7,17],[-10,1],[-12,-4],[-12,-2],[3,11],[4,9],[11,14],[15,0],[8,-10],[2,-16]],[[6332,8183],[-5,-9],[-6,4],[-16,25],[-4,7],[-28,55],[-4,12],[-5,20],[2,22],[11,18],[13,16],[20,4],[20,-10],[-1,-54],[1,-12],[3,-6],[6,-2],[2,-6],[1,-9],[-1,-9],[-3,-15],[-8,-32],[2,-19]],[[5436,8438],[5,-5],[6,-2],[5,1],[4,-1],[3,-10],[-9,-5],[-9,-9],[-4,15],[-5,3],[-14,-4],[-23,0],[-27,10],[-12,0],[-7,-17],[-8,5],[-5,-3],[-4,-6],[-7,-3],[-4,5],[5,11],[12,17],[8,-3],[13,15],[23,34],[32,-19],[12,-13],[10,-16]],[[6009,8397],[-14,-1],[-11,28],[-7,22],[1,34],[-2,13],[-6,3],[-6,5],[-5,12],[4,0],[-1,14],[4,13],[6,5],[5,-12],[7,-21],[10,-20],[11,-12],[15,-7],[3,-12],[1,-27],[-9,-15],[-6,-22]],[[5978,8584],[3,-11],[5,5],[2,2],[-4,-13],[-10,-11],[-11,-7],[-21,-13],[-6,7],[0,30],[-1,24],[-3,35],[3,46],[12,0],[23,-15],[4,-4],[10,-16],[3,-3],[-1,-9],[1,-19],[-1,-18],[-9,-8],[1,-2]],[[5990,8720],[-18,0],[-12,11],[0,24],[8,23],[13,8],[9,-8],[7,-16],[4,-15],[0,-7],[-1,-3],[-2,-7],[-2,-7],[-6,-3]],[[5468,8673],[2,-4],[5,-21],[3,-8],[6,-4],[6,-2],[7,-3],[6,-5],[33,-25],[11,-21],[5,-37],[9,-24],[22,-8],[40,2],[6,-2],[3,-6],[3,-7],[3,-8],[5,-5],[5,2],[5,4],[4,2],[12,-4],[10,-8],[10,-12],[9,-15],[16,-37],[4,-1],[12,-1],[5,-1],[30,-41],[7,1],[41,-47],[10,-20],[6,-17],[9,-21],[11,-14],[15,5],[3,-24],[6,-17],[8,-9],[8,-3],[20,2],[6,-2],[11,-11],[7,-2],[8,6],[5,-5],[9,-15],[10,-13],[2,0],[17,0],[5,-3],[7,-10],[3,-1],[6,0],[4,-1],[1,-2],[-1,-4],[2,-6],[0,-4],[-1,-11],[1,-5],[1,-1],[4,-3],[2,-2],[3,-7],[20,-36],[26,-70],[14,-28],[17,-25],[19,-21],[38,-31],[8,-16],[11,-10],[2,-6],[3,-36],[3,-4],[4,-2],[3,-4],[2,-5],[3,-11],[6,-14],[5,-23],[4,-11],[11,-12],[11,1],[9,10],[6,14],[7,-14],[7,-18],[5,-20],[3,-17],[2,-10],[10,-19],[2,-11],[-1,-12],[-2,-9],[-1,-10],[2,-12],[5,-8],[5,-10],[0,-3],[5,-3],[6,-2],[13,-1],[13,-5],[10,-12],[8,-15],[11,-15],[10,-9],[10,-7],[10,-4],[12,-1],[11,8],[8,15],[6,2],[7,-25],[1,-10],[1,-19],[1,-10],[3,-10],[7,-17],[1,-10],[5,-15],[10,-7],[12,-1],[10,0],[0,2],[8,11],[5,-12],[1,-13],[-1,-14],[2,-14],[5,-14],[17,-26],[7,-13],[15,-53],[8,-22],[5,-17],[0,-8],[10,-7],[12,-19],[12,-23],[4,-20],[-5,-54],[0,-25],[5,-25],[-13,-27],[-31,-47],[-7,-33],[1,-18],[6,-12],[6,-10],[5,-13],[2,-13],[1,-15],[-1,-16],[-2,-15],[-4,-9],[-13,-14],[-5,-11],[1,-24],[-1,-9],[-3,-9],[-7,-11],[-4,-7],[-4,-13],[-6,-31],[-5,-16],[-5,-9],[-5,-6],[-5,-9],[-3,-15],[-12,6],[-5,-14],[-3,-21],[-6,-18],[-5,29],[-8,29],[-13,24],[-18,18],[1,23],[-14,25],[-20,24],[-12,21],[-2,16],[-1,53],[-2,7],[-12,10],[-4,6],[-2,7],[-4,49],[-5,31],[-1,13],[10,46],[1,7],[7,105],[-6,23],[3,12],[-1,12],[-2,12],[-4,10],[5,19],[0,17],[-4,17],[-14,33],[-26,96],[-4,27],[-4,17],[-8,28],[-12,20],[-4,12],[-2,17],[-2,5],[-8,10],[-2,5],[-1,11],[-1,11],[-2,9],[-3,6],[-4,3],[-10,1],[-5,3],[-3,8],[-6,20],[-9,13],[-46,102],[-2,9],[3,23],[-1,8],[-5,7],[-8,10],[-13,23],[-6,14],[-6,26],[-8,7],[-10,4],[-8,5],[-2,5],[-4,17],[-2,5],[-5,7],[-10,8],[-14,20],[-10,3],[-11,-1],[-79,28],[-21,14],[-73,81],[-106,190],[-8,9],[-34,14],[-32,24],[-5,6],[-1,5],[-2,5],[-3,6],[-2,20],[-2,7],[-8,13],[-36,36],[-10,14],[-4,4],[-24,17],[-12,22],[-6,7],[-9,5],[-10,4],[-7,6],[-3,15],[-13,23],[-11,0],[-4,1],[-1,4],[1,4],[-1,4],[-8,9],[-7,11],[-1,3],[-2,8],[-1,2],[-7,8],[-2,3],[-5,5],[-5,3],[-19,4],[-4,5],[-6,13],[-7,11],[-3,4],[-5,5],[-5,3],[-13,3],[-16,13],[-11,2],[-42,-14],[-22,0],[-19,10],[-11,23],[0,12],[4,14],[7,7],[9,-10],[10,-8],[11,8],[21,24],[11,-16],[9,15],[1,22],[-14,6],[8,14],[-1,11],[-6,6],[-6,2],[-10,1],[-7,4],[-18,14],[11,40],[-1,3],[-1,9],[1,6],[12,-11],[4,-9],[4,-11],[5,-10],[17,-18],[3,-2],[3,-11],[6,-8],[13,-11],[13,-31],[6,-9],[4,-2],[23,-7],[5,-4],[3,-5],[3,-2]],[[5032,8991],[29,-32],[12,0],[5,-5],[14,-11],[5,-3],[2,-1],[5,-10],[2,-3],[15,-6],[15,-10],[12,-17],[7,-23],[-5,-30],[6,4],[2,2],[3,-14],[-3,-13],[-5,-14],[-3,-15],[1,-17],[1,-13],[2,-11],[4,-9],[-4,-11],[-3,-5],[-12,-4],[-20,-13],[-6,-3],[-5,-3],[-4,0],[-2,9],[-3,11],[-8,-3],[-9,-9],[-5,-9],[-3,4],[-6,5],[-2,5],[-9,-5],[-40,-3],[-4,-2],[-4,0],[-5,3],[-5,6],[-17,34],[-12,11],[-5,7],[-9,48],[-22,49],[-8,11],[-12,-8],[-16,14],[-12,21],[0,14],[4,4],[3,-4],[4,-5],[4,-2],[5,4],[39,48],[8,3],[7,0],[7,1],[5,7],[22,14],[0,2],[7,2],[11,9],[8,3],[12,-9]],[[4898,9697],[5,-11],[8,-4],[8,1],[2,-3],[-3,-6],[-9,-5],[-14,2],[-8,5],[-2,3],[-4,3],[-5,-3],[-1,-3],[-1,-4],[-5,-2],[-5,8],[-3,12],[0,10],[5,3],[12,-7],[5,8],[2,16],[4,3],[6,-12],[3,-14]],[[4687,9993],[5,-2],[12,1],[5,-3],[12,-24],[32,-33],[8,-13],[1,-12],[-1,-11],[1,-10],[4,-11],[3,-6],[6,-30],[6,-19],[12,-29],[4,-19],[-8,-1],[-13,-12],[-8,-1],[-5,4],[-1,4],[-1,5],[-4,7],[-8,13],[-5,4],[-5,4],[0,-28],[-9,5],[-19,29],[-5,3],[-5,7],[-11,20],[-3,9],[-2,5],[-3,2],[-7,-1],[-2,2],[-8,15],[-3,17],[0,38],[17,65],[5,12],[3,-6]],[[3824,3530],[6,-37],[5,-13],[10,-3],[12,5],[9,2],[5,-11],[6,5],[6,1],[14,1],[3,3],[8,6],[6,0],[-4,-13],[-1,-16],[12,-88],[7,-22],[3,-29],[10,-35],[4,-22],[4,-28],[0,-28],[-5,-22],[15,-60],[3,-22],[-1,-17],[-5,-34],[-1,-19],[1,-20],[3,-19],[4,-15],[9,-11],[19,-16],[5,-13],[12,7],[11,-5],[9,-10],[7,-5],[4,-2],[4,-6],[3,-7],[2,-9],[3,-6],[19,-11],[5,-8],[6,-25],[5,-14],[8,-15],[3,-17],[-1,-67],[6,-65],[3,-8],[5,-2],[4,-4],[3,-5],[1,-6],[0,-6],[-3,-9],[-1,-5],[1,-6],[5,-11],[1,-7],[5,-39],[10,-37],[14,-30],[19,-20],[46,-15],[19,1],[8,-5],[5,4],[23,9],[9,1],[7,3],[6,4],[11,12],[6,8],[5,10],[2,11],[4,-3],[10,-1],[11,1],[8,7],[11,-15],[15,1],[34,15],[3,2],[3,3],[1,3],[1,10],[3,3],[3,2],[4,2],[8,18],[6,9],[7,7],[6,-29],[49,7],[11,-18],[6,5],[5,2],[3,-4],[1,-11],[4,0],[5,6],[5,-5],[3,-11],[1,-12],[-1,-14],[-3,-11],[-7,-18],[3,-2],[2,-3],[3,-2],[3,0],[-8,-5],[-5,-1],[-5,0],[8,-13],[9,-3],[7,-5],[-2,-19],[-5,-15],[-9,-12],[-10,-5],[-9,5],[-4,-9],[-9,-29],[-2,-12],[-1,-21],[-5,-32],[-1,-20],[-4,-16],[-18,-27],[-4,-24],[3,-22],[10,-37],[2,-21],[9,-35],[19,-16],[38,-12],[15,-14],[3,-4],[5,-12],[3,-4],[3,-1],[6,2],[2,-1],[7,-11],[0,-2],[19,-13],[-5,-13],[8,-4],[2,0]],[[5322,5351],[-2,-1],[-19,-13],[-19,-6],[-5,-4],[-6,-9],[-3,1],[-2,6],[-3,9],[-8,0],[-11,-10],[-11,-15],[-5,-13],[-2,2],[-1,0],[0,1],[-1,5],[-19,-35],[-12,-13],[-11,-6],[-5,-5],[-13,-26],[-6,-8],[-23,-12],[-14,-3],[-9,5],[-7,5],[-5,-4],[-5,-8],[-5,-3],[-2,2],[-1,4],[-2,5],[-3,2],[-1,-1],[-4,-4],[-22,-9],[-14,-2],[-10,6],[-5,15],[-3,6],[-12,4],[-3,4],[-4,3],[-8,-1],[-9,-12],[-11,-17],[-12,-13],[-10,4],[-1,5],[-1,5],[0,10],[-1,6],[-3,3],[-3,2],[-8,9],[-3,-5],[-4,-18],[-1,-1],[-6,-6],[6,-10],[-1,-9],[-5,-8],[-8,-5],[2,14],[-3,15],[-5,12],[-7,5],[-7,-3],[-9,-6],[-10,-11],[-9,-14],[-6,13],[-6,3],[-5,-1],[-5,-1],[-14,1],[-4,-1],[-13,4],[-52,2],[-3,-3],[-10,-13],[-6,-4],[-13,5],[-9,1],[-8,-6],[-3,9],[-21,28],[-5,10],[-4,11],[-7,22],[-8,30],[-31,73],[-13,17],[-51,26],[-11,12],[-6,6],[-9,3],[-9,-4],[-13,-19],[-6,-4],[-4,-2],[-13,-9],[-9,-2],[-16,1],[-7,4],[-4,8],[-4,0],[2,-14],[-3,-18],[-5,-18],[-5,-10],[-7,-5],[-22,-1],[-4,-5],[-8,-6],[-7,0],[1,17],[4,4],[7,-1],[3,2],[-3,15],[3,13],[-4,19],[-9,16],[-12,5],[5,16],[6,14],[3,13],[-3,18],[-5,-19],[-4,-2],[-6,3],[-7,-3],[-41,30],[-23,11],[-14,-7],[-4,6],[-3,7],[2,8],[4,8],[4,6],[5,5],[-4,9],[-3,1],[-4,-1],[-4,4],[-2,6],[-1,7],[-1,5],[-5,2],[-18,2],[-6,-3],[-7,-12],[-4,6],[4,15],[-1,12],[-2,12],[-1,11],[-4,10],[-9,1],[-9,-1],[-4,4],[-3,11],[-8,2],[-15,-3],[-9,8],[-12,23],[-8,9],[-13,-20],[-7,-10],[-7,-3],[-10,4],[-17,25],[-8,10],[-12,4],[-25,3],[-9,10],[-5,4],[-7,1],[-6,4],[-3,11],[-18,36],[-10,41],[-2,37],[9,109],[10,35],[14,28],[19,17],[3,1],[0,2],[1,4],[9,-6],[6,-6],[13,-19],[4,-4],[9,-3],[5,-6],[3,-8],[3,-18],[2,-7],[14,-16],[16,6],[15,18],[13,25],[7,8],[8,-1],[16,-10],[19,2],[7,-2],[5,-7],[5,-10],[7,-10],[9,-7],[21,-6],[8,-7],[1,12],[4,6],[10,9],[8,12],[4,1],[8,1],[7,3],[28,30],[42,-33],[6,-11],[10,-2],[40,-33],[7,-8],[4,0],[4,-2],[3,-3],[3,-6],[7,-17],[-1,1],[5,-12],[2,-5],[68,14],[13,10],[9,-12],[6,4],[7,12],[8,9],[4,-10],[5,-9],[6,-1],[3,13],[15,-17],[4,-2],[5,8],[5,26],[6,5],[10,4],[36,30],[1,-6],[2,-2],[2,-2],[3,-4],[3,8],[4,4],[5,0],[6,-5],[5,9],[2,10],[-1,11],[-2,10],[2,1],[1,-2],[0,-3],[0,-3],[5,-2],[3,-14],[1,-19],[-5,-29],[5,-9],[9,-6],[4,-1],[8,5],[5,7],[6,6],[9,2],[4,4],[5,9],[3,13],[0,14],[4,0],[18,-19],[21,-1],[21,12],[17,22],[6,12],[14,41],[3,17],[-2,11],[-5,5],[-6,2],[-6,5],[-5,9],[-8,26],[-5,11],[3,10],[5,21],[3,10],[3,6],[6,10],[4,7],[8,11],[10,10],[10,14],[7,22],[0,11],[-1,10],[-3,18],[-1,1],[-6,6],[0,7],[2,11],[2,17],[5,18],[2,10],[-2,6],[-5,8],[-1,6],[1,7],[1,3],[1,2],[9,44],[19,22],[23,4],[23,-12],[12,-11],[6,-7],[4,-9],[3,-14],[-2,-8],[-3,-6],[-1,-8],[-5,-17],[-11,-10],[-24,-10],[-10,-13],[-12,-22],[-7,-21],[9,-20],[2,-23],[1,-25],[-2,-15],[-4,-6],[-10,-4],[-4,-4],[-7,-10],[-1,-4],[9,-16],[3,-9],[2,-21],[13,-40],[16,-57],[2,-13],[0,-18],[3,-21],[4,-20],[7,-17],[10,-13],[11,-5],[37,-5],[11,-6],[10,-3],[9,5],[4,10],[4,16],[6,14],[6,7],[8,5],[16,23],[6,5],[6,16],[3,4],[4,2],[27,8],[10,1],[10,-4],[32,-22],[11,-13],[5,-15],[3,-19],[6,-20],[9,-13],[10,5],[8,8],[19,3],[8,6],[15,21],[6,14],[5,18],[-3,13],[1,9],[4,4],[5,-6],[16,15],[15,-9],[12,-21],[8,-18],[16,3],[6,3],[4,6],[9,21],[11,5],[11,12],[10,16],[7,14],[5,19],[1,21],[-2,43],[1,20],[6,44],[14,57],[12,35],[14,31],[15,23],[3,3],[8,6],[4,4],[10,23],[8,10],[15,40],[7,13],[2,1],[4,-1],[1,0],[1,3],[-1,8],[0,3],[5,3],[15,8],[5,5],[4,8],[7,7],[7,6],[7,2],[7,6],[3,12],[3,29],[3,0],[7,-10],[34,-17],[12,-8],[10,-3],[10,7],[12,19],[22,-21],[20,-27],[11,5],[8,11]],[[5550,6496],[-13,-5],[-10,3],[-4,6],[-8,9],[-6,12],[1,11],[8,13],[4,5],[9,7],[8,1],[7,-4],[9,-10],[10,-16],[0,-14],[-9,-14],[-6,-4]],[[4467,6552],[-11,-29],[-7,6],[-7,8],[-5,12],[0,13],[5,6],[21,14],[6,-16],[-2,-14]],[[4667,6779],[6,-12],[3,-15],[0,-16],[-1,-8],[-2,-5],[-5,-2],[-2,5],[-1,7],[-2,6],[-4,10],[-2,12],[-3,9],[-7,6],[-8,-3],[-3,-10],[3,-10],[8,-4],[-3,-8],[-5,-5],[-10,-7],[-13,19],[6,21],[15,18],[14,8],[7,-6],[9,-10]]],"transform":{"scale":[0.0018642816829682884,0.001029098678067803],"translate":[140.84921106000016,-11.636325778999847]}};
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
