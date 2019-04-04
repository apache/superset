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
  Datamap.prototype.pngTopo = '__PNG__';
  Datamap.prototype.polTopo = '__POL__';
  Datamap.prototype.priTopo = '__PRI__';
  Datamap.prototype.prkTopo = '__PRK__';
  Datamap.prototype.prtTopo = {"type":"Topology","objects":{"prt":{"type":"GeometryCollection","geometries":[{"type":"MultiPolygon","properties":{"name":"Setúbal"},"id":"PT.SE","arcs":[[[0]],[[1,2,3,4,5]]]},{"type":"MultiPolygon","properties":{"name":"Azores"},"id":"PT.AC","arcs":[[[6]],[[7]],[[8]],[[9]],[[10]],[[11]],[[12]],[[13]],[[14]]]},{"type":"MultiPolygon","properties":{"name":"Madeira"},"id":"PT.MA","arcs":[[[15]],[[16]],[[17]],[[18]],[[19]]]},{"type":"Polygon","properties":{"name":"Aveiro"},"id":"PT.AV","arcs":[[20,21,22,23]]},{"type":"MultiPolygon","properties":{"name":"Leiria"},"id":"PT.LE","arcs":[[[24]],[[25,26,27,28,29]]]},{"type":"Polygon","properties":{"name":"Viana do Castelo"},"id":"PT.VC","arcs":[[30,31]]},{"type":"Polygon","properties":{"name":"Beja"},"id":"PT.BE","arcs":[[32,33,34,-3,35]]},{"type":"Polygon","properties":{"name":"Évora"},"id":"PT.EV","arcs":[[36,-36,-2,37,38]]},{"type":"MultiPolygon","properties":{"name":"Faro"},"id":"PT.FA","arcs":[[[39]],[[40]],[[41]],[[-34,42]]]},{"type":"MultiPolygon","properties":{"name":"Lisboa"},"id":"PT.LI","arcs":[[[43]],[[44]],[[45]],[[-5,46,47]],[[48,49,-28]]]},{"type":"Polygon","properties":{"name":"Portalegre"},"id":"PT.PA","arcs":[[50,-39,51,52]]},{"type":"Polygon","properties":{"name":"Santarém"},"id":"PT.SA","arcs":[[53,-52,-38,-6,-48,54,-49,-27]]},{"type":"Polygon","properties":{"name":"Braga"},"id":"PT.BR","arcs":[[55,56,-31,57,58]]},{"type":"Polygon","properties":{"name":"Bragança"},"id":"PT.BA","arcs":[[59,60,61,62]]},{"type":"Polygon","properties":{"name":"Castelo Branco"},"id":"PT.CB","arcs":[[63,-53,-54,-26,64,65]]},{"type":"MultiPolygon","properties":{"name":"Coimbra"},"id":"PT.CO","arcs":[[[66]],[[67,68,-65,-30,69,-21]]]},{"type":"Polygon","properties":{"name":"Guarda"},"id":"PT.GU","arcs":[[70,-66,-69,71,-60]]},{"type":"Polygon","properties":{"name":"Porto"},"id":"PT.PO","arcs":[[72,73,-23,74,-56]]},{"type":"Polygon","properties":{"name":"Viseu"},"id":"PT.VI","arcs":[[-72,-68,-24,-74,75,-61]]},{"type":"Polygon","properties":{"name":"Vila Real"},"id":"PT.VR","arcs":[[-62,-76,-73,-59,76]]}]}},"arcs":[[[8951,6971],[-2,-7],[-4,5],[0,3],[1,3],[3,1],[2,-5]],[[9066,7206],[16,-5],[3,-2],[1,-9],[-4,-13],[0,-5],[-1,-11],[-3,-7],[-6,-13],[-34,-38],[-14,-30],[0,-6],[0,-8],[2,-5],[1,-7],[2,-20],[12,-2],[15,-15],[12,-3],[10,-5],[2,2],[1,4],[-1,6],[-1,4],[2,3],[4,-1],[2,-3],[2,-4],[2,-4],[4,-4],[5,-3],[11,0],[6,4],[9,9],[7,3],[4,-3],[7,-15],[6,-9],[2,-4],[0,-1],[0,-1],[0,-2],[1,-5],[5,-23],[0,-5],[-2,-3],[0,-4],[2,-5],[6,-4],[3,-4],[2,-6],[-2,-15],[-6,-18],[0,-7],[2,-2],[9,-5],[5,-7],[9,-8],[3,-2],[4,-1],[4,0],[7,-5],[15,-19]],[[9219,6835],[10,-34],[3,-21],[0,-7],[0,-6],[-2,-9],[-14,-7],[-7,-5],[-14,-6],[-3,-3],[-2,-9],[-3,-7],[-14,1],[-3,-3],[-1,-5],[-1,-7],[-2,-14],[-3,-3],[-3,2],[-3,4],[-4,2],[-3,-1],[-2,-4],[-3,-1],[-1,-4],[0,-4],[0,-4],[-1,-4],[-2,-8],[-1,-2],[-1,-4],[-2,0],[-2,1],[-2,2],[-3,0],[-2,-8],[-1,-6],[-1,-5],[-1,-4],[-1,-6],[0,-4],[1,-5],[2,-8],[7,-10],[6,-12],[5,-4],[5,-1],[5,-1],[5,-7],[3,-8],[4,-18],[0,-23],[-3,-37],[-4,-22],[-2,-6],[-5,-23],[-12,11],[-2,0],[-10,0],[-18,5],[-35,-11],[-7,-5],[-4,-6],[-1,-6],[-2,-6],[-7,-11],[-2,-6],[-3,-19],[-1,-6],[-1,-7],[-2,-5],[-7,-4],[-4,1],[-7,4],[-3,4],[-3,3],[-3,1],[-3,-2],[-1,-4],[-2,-4],[-2,0],[-2,4],[-4,11],[-10,20],[-1,5],[-3,6],[-7,4],[-3,-2],[-3,-3],[-3,-2],[-3,0],[-2,2],[-2,5],[-4,7]],[[8964,6431],[2,15],[-1,27],[-2,20],[-6,21],[-14,4],[-16,16],[2,7],[3,3],[3,3],[3,5],[21,73],[7,58],[9,45],[-1,44],[-3,52],[-4,46],[-11,32],[-10,18],[-12,24],[-15,19],[-11,8],[6,10],[9,-6],[15,-21],[18,-11],[9,-7],[0,-11],[17,1],[40,-18],[20,11],[-12,1],[-11,4],[-29,22],[-3,7],[-3,11],[0,12],[0,10],[2,8],[4,4],[0,6],[-6,4],[-4,9],[-1,12],[3,9],[-7,2],[-7,-26],[-8,-5],[0,-5],[8,-2],[5,-12],[0,-13],[-4,-6],[-9,1],[-8,3],[-14,12],[-15,9],[-20,-6],[-18,-34],[3,-4],[-22,-15],[-39,-8],[-8,-5],[-7,-8],[-7,-2],[-10,5],[-2,0],[-1,4],[0,6],[1,5],[1,3],[3,7],[12,19],[3,26],[0,39],[-10,38],[-12,32],[-6,24],[8,7],[18,4],[17,2],[9,-8],[4,-10],[2,0],[-2,17],[6,5],[12,5],[6,2],[0,5],[6,11],[7,11],[11,14],[14,20],[2,2],[2,3],[2,1]],[[8908,7213],[4,2],[4,0]],[[8916,7215],[-1,-10],[2,-13],[3,-6],[4,-2],[5,1],[8,5],[4,4],[7,3],[4,-1],[4,-2],[3,-8],[12,-7],[2,0],[7,3],[6,13],[1,7],[5,22],[11,38],[3,1],[3,-2],[2,-4],[5,-5],[11,-6],[8,7],[6,5],[2,-2],[1,-4],[-1,-6],[0,-6],[-1,-6],[0,-7],[1,-7],[4,-9],[5,-2],[3,0],[11,-3]],[[2499,5724],[2,-17],[-6,-12],[-13,2],[-24,13],[-13,-6],[-7,0],[-3,9],[-2,10],[-5,9],[-3,9],[5,8],[8,13],[15,6],[15,1],[11,-2],[8,-9],[7,-15],[5,-19]],[[2234,6444],[51,-11],[6,3],[10,12],[6,2],[3,-2],[9,-11],[4,-4],[7,6],[40,21],[57,2],[15,-11],[10,-24],[1,-30],[-10,-26],[-15,-11],[-53,-11],[-18,-9],[-19,-3],[-18,2],[-9,-2],[-7,-5],[-11,11],[-10,7],[-23,10],[-35,2],[-48,59],[-14,32],[7,43],[31,5],[10,-5],[14,-19],[2,-7],[1,-10],[1,-8],[2,-6],[3,-2]],[[1291,6930],[3,-19],[-6,-9],[-12,0],[-31,7],[-9,-1],[-8,-4],[-15,-19],[-4,4],[-4,10],[-5,9],[-9,5],[-57,2],[-8,-7],[-26,40],[-9,25],[0,36],[12,18],[13,7],[28,-2],[16,-5],[40,-40],[14,-10],[1,-1],[5,-3],[7,-11],[5,-3],[8,-2],[26,-15],[18,-3],[7,-9]],[[1061,7004],[-5,-5],[-5,0],[-9,5],[-5,0],[-12,-6],[-5,0],[-9,7],[-10,26],[-8,12],[-19,18],[0,7],[13,4],[12,0],[5,2],[5,4],[4,6],[6,16],[4,6],[34,-26],[10,-14],[5,-37],[-3,-1],[-12,-9],[-4,-4],[2,-5],[1,-3],[2,-2],[3,-1]],[[1217,7172],[79,-49],[57,-51],[30,-18],[15,-13],[7,-15],[-7,-4],[-7,-2],[-16,1],[-6,4],[-13,11],[-12,4],[-7,4],[-7,6],[-5,7],[-6,6],[-11,-3],[-7,6],[-5,-6],[-4,3],[-7,15],[-5,5],[-41,23],[-7,8],[-8,22],[-3,3],[-3,-1],[-2,-1],[-1,0],[-4,2],[-1,3],[1,4],[-1,3],[-3,2],[-3,2],[-19,27],[-1,6],[0,10],[7,-5],[13,-14],[6,-3],[7,-2]],[[1688,7113],[-1,-7],[-3,-4],[-11,-8],[-10,6],[-27,1],[-9,11],[-5,-10],[-5,0],[-9,10],[-11,4],[-10,1],[-9,6],[-10,15],[-8,19],[-4,17],[-4,25],[9,20],[15,13],[14,4],[61,-6],[11,-8],[16,-16],[13,-19],[2,-16],[-1,-8],[3,-5],[4,-5],[1,-7],[-2,-3],[-9,-6],[-2,-3],[-1,-7],[2,-14]],[[1300,7483],[4,-4],[3,5],[6,-13],[13,-18],[7,-11],[2,-14],[-4,-10],[-8,-6],[-7,-1],[-8,0],[-8,3],[-8,5],[-7,9],[-4,14],[0,12],[7,25],[4,4],[4,2],[4,-2]],[[39,7808],[6,-1],[5,5],[7,-16],[4,-14],[0,-35],[-3,-19],[-7,-22],[-8,-15],[-7,8],[-7,-6],[-9,-1],[-8,2],[-6,5],[-3,11],[-3,16],[0,15],[4,9],[-2,14],[2,11],[3,13],[2,16],[3,13],[6,8],[8,4],[8,0],[-3,-11],[3,-6],[5,-4]],[[74,7946],[-13,-4],[0,5],[-7,25],[-1,4],[1,9],[3,8],[5,5],[5,1],[14,-5],[1,-24],[-8,-24]],[[6085,3],[0,-3],[-2,0],[0,4],[2,-1]],[[6152,91],[-2,-5],[-1,1],[-3,1],[-2,2],[0,1],[0,2],[1,1],[3,8],[4,-5],[0,-6]],[[5898,2052],[2,-21],[-14,39],[-3,8],[-3,7],[-1,9],[-1,10],[7,-11],[7,-19],[6,-22]],[[5668,2297],[11,-2],[11,4],[7,9],[6,4],[9,4],[15,3],[7,-4],[12,-16],[5,-3],[21,-27],[4,-5],[5,-2],[15,-1],[7,-3],[7,-7],[4,5],[4,2],[4,-2],[4,-5],[-7,-3],[-14,-11],[-5,-3],[-5,-6],[-13,-29],[-2,-7],[-7,-25],[-17,-11],[-19,-2],[-32,5],[-67,48],[-15,17],[-13,20],[-11,24],[-3,14],[-1,15],[2,12],[6,4],[3,4],[10,25],[3,3],[3,1],[3,-1],[4,-3],[4,-6],[10,-19],[4,-4],[2,0],[9,-5],[10,-11]],[[5968,2541],[8,-7],[3,6],[0,-25],[1,-9],[4,-6],[-14,4],[-6,0],[-5,-7],[-6,-11],[-4,-8],[-6,-2],[-8,7],[0,5],[4,1],[4,3],[2,6],[5,26],[8,13],[10,4]],[[9144,8530],[-3,-6],[0,-7],[-5,-10],[-9,1],[-2,-2],[-4,-6],[-2,-6],[-9,-19],[-2,-7],[-4,-6],[-3,-4],[-23,4],[-3,6],[0,5],[0,7],[1,9],[3,12],[2,6],[3,3],[1,1],[2,3],[0,2],[2,12],[1,5],[-1,6],[-4,14],[-3,16],[-4,0],[-6,-5],[-7,-7],[-3,-2],[-4,1],[-3,6],[-1,15],[0,8],[2,20],[-15,17],[-9,-21],[-1,-13],[-3,-9],[-14,2],[-44,71],[0,2]],[[8970,8654],[1,12],[7,37],[5,48],[2,3],[2,2],[0,-17],[0,-6],[8,21],[6,8],[5,-6],[3,0],[0,6],[-1,2],[-2,4],[-1,6],[1,4],[4,4],[2,-2],[2,-5],[2,-2],[4,2],[3,6],[5,14],[-6,6],[-4,10],[1,9],[8,4],[9,1],[7,5],[6,7],[6,9],[-6,-1],[-10,-8],[-9,-2],[-1,-2],[-3,0],[-9,6],[-3,7],[-3,23],[15,33],[-4,18],[0,-14],[-3,-11],[-3,-3],[-2,11],[-5,-17],[-5,-21],[-2,-23],[-1,-21],[-2,-13],[-4,-19],[-6,-18],[-5,-9],[39,280],[-1,19]],[[9022,9061],[1,0],[3,2],[18,4],[6,-7],[13,7],[6,7],[5,0],[4,-3],[3,-5],[6,-5],[4,1],[3,3],[2,11],[2,5],[7,12],[8,-13],[2,-5],[3,-9],[7,-9],[3,0],[2,4],[-1,5],[-2,5],[0,5],[0,4],[11,8],[8,-4],[19,21],[1,2],[2,9]],[[9168,9116],[24,-24],[2,-5],[1,-8],[-1,-6],[0,-18],[30,-22],[5,0],[5,1],[3,10],[1,3],[1,2],[6,7],[2,0],[2,-3],[0,-3],[0,-2],[0,-2],[-1,-4],[-12,-29],[-2,-9],[-2,-9],[1,-6],[2,-11],[2,-21],[3,-15],[0,-10],[-2,-5],[-4,-2],[-3,1],[-4,2],[-3,4],[-3,2],[-5,0],[-7,-6],[-5,-1],[-4,1],[-4,2],[-12,-2],[5,-25],[-1,-5],[-3,-9],[-9,-28],[-9,-16],[-9,-12],[-4,-10],[0,-4],[0,-4],[1,-5],[1,-5],[6,-9],[2,-7],[2,-6],[0,-23],[3,-11],[2,-2],[7,-5],[7,-9],[-17,-10],[-2,-4],[-3,-6],[1,-6],[4,-18],[3,-15],[2,-5],[2,-4],[3,-5],[5,-13],[-22,-14],[-9,-11],[-1,-4],[1,-6],[4,-11],[-1,-11],[-1,-7],[-12,-28],[2,-25]],[[8685,7745],[-4,-8],[1,9],[3,-1]],[[9233,8158],[-7,-25],[-4,-5],[-4,-4],[-3,-2],[-4,-2],[-4,-7],[-3,-7],[-2,-3],[-4,1],[-18,-9],[-2,-4],[-2,-4],[0,-5],[0,-5],[-3,-3],[-3,-7],[0,-4],[2,-9]],[[9172,8054],[-16,2],[-3,2],[-1,-4],[1,-6],[1,-16],[-1,-2],[-8,2],[-9,-6],[-5,-2],[-17,-10],[-7,-4],[0,4],[-1,5],[-1,7],[-3,19],[0,9],[-6,35],[-6,-3],[-5,-7],[-4,0],[-6,-3],[-19,-23],[-7,-6],[-5,-1],[-7,3],[-19,-13],[-2,-5],[-2,-8],[0,-6],[1,-15],[0,-9],[1,-7],[3,-4],[3,-4],[3,-7],[2,-13],[-2,-7],[-3,-5],[-3,-4],[-4,-4],[-8,-11],[3,-25],[1,-16],[5,-22],[-3,-6],[-10,-21],[-3,-2],[-4,0],[-3,2],[-3,1],[-2,-4],[-1,-6],[1,-6],[3,-9],[0,-2],[0,-2],[0,-3],[-1,-6],[-6,-6],[-19,3],[-26,-3],[-12,-8],[-5,-9],[-13,-42],[-4,-8],[-3,-4],[-8,-3],[-8,-24],[-2,-10],[2,-14],[1,-27]],[[8887,7645],[-11,4],[-7,6],[-6,1],[-5,-1],[-2,-2],[-4,-4],[-9,-16],[-9,-26],[-8,-15],[-9,-11],[-6,9],[-9,50],[-3,10],[-3,6],[-3,3],[-2,-1],[-5,2],[-4,-4],[-16,-16],[-16,0],[-4,-1]],[[8746,7639],[-2,20],[-5,16],[-14,24],[-3,9],[4,2],[18,-8],[30,31],[7,10],[8,2],[5,-10],[4,-2],[5,8],[-3,11],[-7,10],[7,16],[9,17],[3,9],[7,8],[12,12],[6,16],[4,13],[8,23],[1,14],[-1,16],[5,22],[2,31],[32,135],[36,168]],[[8924,8262],[2,-2],[11,-7],[3,-4],[6,-4],[13,-5],[4,1],[4,6],[10,7],[21,-4],[7,0],[9,-4],[5,-5],[6,-9],[4,-9],[1,-2],[3,-1],[4,0],[2,2],[1,2],[7,16],[2,4],[3,2],[3,0],[3,0],[2,-2],[3,-5],[3,-18],[0,-8],[0,-13],[1,-6],[1,-4],[2,-3],[3,3],[7,15],[11,10],[13,18],[8,-1],[1,4],[3,-1],[3,-4],[6,-17],[3,-16],[2,-11],[-1,-7],[-2,-5],[-3,-4],[-2,-2],[3,-2],[3,0],[17,10],[14,25],[4,1],[6,-4],[3,0],[3,4],[1,7],[-2,5],[-5,7],[-1,3],[-1,6],[0,5],[6,15],[17,25],[12,-8],[12,26],[5,-5],[3,-3],[2,-6],[2,-6],[-3,-23],[1,-14],[17,-43],[-5,-5],[-2,-4],[-1,-8],[1,-4],[0,-4],[1,-1],[-2,-10]],[[9212,9718],[-1,-1],[-5,0],[-38,-32],[-10,-6],[-35,-2],[-6,-2],[-5,-4],[-3,-3],[-7,-9],[-7,-4],[-3,0],[-4,1],[-3,-1],[-2,-2],[-3,-6],[-1,-6],[-1,-6],[-1,-13],[-1,-6],[-1,-6],[-3,-5],[-2,-6],[-1,-4],[2,-9],[-7,-20],[-3,1],[-4,1],[-4,4],[-8,2],[-12,7],[-3,3],[-2,-2],[-1,-3],[-4,-4],[-3,-2],[-20,-1],[-30,-16],[-3,-1],[-8,2],[-2,0]],[[8957,9557],[0,10],[-4,15],[0,19],[1,10],[9,5],[24,6],[7,5],[7,8],[5,8],[-44,-21],[-9,-2],[-5,1],[-8,7],[-7,27],[0,24],[3,37],[-3,24],[2,8],[3,8],[28,37],[14,23],[4,31],[5,5],[9,7],[10,5],[8,8],[3,8],[5,18],[3,9],[7,7],[7,3],[14,0],[8,5],[13,14],[8,5],[61,15],[7,6],[10,14],[4,4],[3,1],[7,0],[7,5],[12,13],[4,-8],[3,-12],[-1,-36],[1,-13],[5,-6],[6,2],[8,5],[8,1],[7,-5],[7,-9],[3,-12],[-1,-14],[-4,-11],[-7,-8],[-11,-12],[-12,-17],[-15,-35],[-4,-15],[-1,-16],[5,-14],[14,-9],[3,-7],[1,-10],[-2,-20]],[[9636,6725],[5,-8],[6,-1],[10,4],[10,7],[5,11],[2,-1],[1,0],[11,5],[11,2],[5,-7],[1,-1],[-4,-24],[-3,-12],[-5,-28],[-8,-25],[-3,-25],[-4,-10],[-3,-20],[-10,-2],[-23,15],[-7,1],[-3,-6],[-4,-17],[-4,-9],[-3,-3],[-6,-3],[-4,-4],[-5,1],[-5,3],[-6,0],[-4,-4],[-13,-5],[-2,-4],[0,-7],[1,-8],[0,-8],[-2,-15],[-9,-38],[-4,-29],[-11,-32],[-37,-50],[-7,-17],[-5,-25],[-4,-40],[-2,-12],[-2,-7],[-11,-18],[-4,-4],[1,-5],[0,-4],[-1,-4],[0,-4],[-4,-8],[-2,-3],[0,-9],[1,-1],[2,0],[2,-11],[0,-6],[1,-5]],[[9477,6185],[0,-1],[-10,-3],[-11,0],[-8,-7],[-8,-12],[-5,-5],[-3,-2],[-3,2],[-5,2],[-3,2],[-21,0],[-31,-21],[-7,-8],[-3,-3],[-2,-3],[-2,0],[-8,-6],[-3,-2],[-2,-2],[-1,-6],[-6,-1],[-7,-7],[-1,-5],[-2,-5],[-5,-6],[-11,-3],[-5,0],[-13,-3],[-6,-6],[-1,-6],[-1,-5],[1,-4],[3,-6],[0,-4],[-2,-2],[-14,-12],[-9,-12],[-6,-5],[-5,0],[-15,3],[-8,0],[-12,6],[-28,34],[-6,5],[-5,10],[-1,5],[-1,11],[-3,10],[-10,5],[-7,-2],[-4,-4],[-4,2],[-4,-1],[-9,-3],[-15,-9],[-2,-2],[-2,-6],[-1,-6],[-2,-8],[-7,-5],[-7,-5],[-17,5],[-6,4],[-15,15],[-5,1],[-16,-4],[-3,-2],[-2,-5],[-2,-4],[-2,-3],[-4,1],[-2,4],[-11,8],[-16,1],[-3,3],[-4,6],[-3,6],[-7,9],[-6,3],[-8,8],[-4,5]],[[8962,6119],[1,11],[3,23],[1,37],[-3,20],[-4,13],[-5,10],[-1,11],[6,36],[1,23],[4,21],[5,4],[12,4],[2,19],[0,4],[-4,-6],[-9,-4],[-10,0],[-3,14],[3,42],[3,30]],[[9219,6835],[2,8],[29,-1],[9,2],[6,-2],[2,-1],[5,-9],[4,-5],[3,-2],[4,0],[9,8],[4,-1],[3,-1],[12,-8],[9,-18],[34,-24],[20,-4],[10,-6],[26,-24],[6,-2],[26,-1],[7,-3],[9,-5],[18,-1],[5,2],[0,6],[6,14],[6,11],[12,9],[0,3],[7,6],[1,3],[4,5],[3,8],[2,8],[0,5],[1,6],[12,6],[13,11],[4,2],[2,0],[10,7],[4,0],[2,-1],[1,-3],[1,-2],[0,-4],[1,-3],[2,-4],[2,-4],[1,-6],[1,-6],[1,-7],[2,-5],[8,-13],[10,-8],[3,-5],[1,-5],[0,-6],[5,-17],[1,-6],[3,-12],[4,-5],[5,-6],[6,-1],[4,2],[2,4],[2,1]],[[9592,7205],[-17,-23],[-1,-3],[-4,-11],[-1,-6],[-3,-28],[0,-19],[0,-9],[0,-6],[2,-5],[3,-3],[2,-3],[2,-6],[-3,-12],[-16,-39],[-7,-41],[-4,-10],[4,-11],[0,-9],[-4,-10],[-6,-9],[6,-5],[11,-13],[42,-89],[2,-4],[2,-11],[2,-6],[3,-4],[7,-8],[2,-4],[16,-67],[4,-6]],[[9066,7206],[19,26],[18,6],[4,5],[8,13],[4,2],[5,-1],[3,2],[2,2],[2,3],[1,4],[1,5],[1,4],[3,0],[7,-4],[5,-1],[5,3],[3,0],[3,-1],[2,2],[1,4],[1,4],[3,0],[3,-3],[11,-19],[3,-4],[13,-4],[4,-3],[2,-4],[2,-5],[0,-5],[2,-3],[2,-1],[2,1],[2,-2],[2,-10],[2,-4],[6,-6],[7,11],[2,11],[0,8],[-3,4],[-3,2],[-3,1],[-7,11],[-2,8],[0,6],[2,14],[-2,7],[-2,2],[-5,1],[-20,15],[-3,3],[-3,5],[-1,6],[1,6],[3,4],[2,5],[2,7],[1,9],[0,14],[1,7],[2,5],[2,1],[5,0],[3,4],[3,10]],[[9205,7399],[8,11],[7,5],[3,3],[3,1],[11,1],[6,-4],[0,-4],[-1,-5],[-2,-11],[2,-11],[3,-5],[2,1],[1,5],[0,5],[1,5],[0,2],[1,1],[4,3],[6,1],[4,-2],[2,-1],[0,-1],[9,-16],[1,-7],[1,-12],[-1,-9],[2,-2],[9,-2],[4,1],[3,3],[3,4],[2,5],[7,7],[8,3],[5,-6],[18,-40],[11,-12],[4,-1],[5,0],[3,0],[9,0],[12,8],[4,6],[7,13],[3,-1],[6,-6],[3,-1],[4,3],[4,0],[4,-1],[9,-6],[3,2],[2,1],[2,3],[2,6],[2,6],[6,8],[6,3],[8,3],[6,4],[4,4],[2,6],[0,5],[-2,5],[-3,6],[6,6],[2,0],[1,1],[0,-1],[2,-7],[16,-11],[7,-10],[2,-8],[1,-15],[1,-5],[0,-8],[9,-13],[3,-16],[1,-11],[6,-14],[-2,-12],[3,-7],[5,-15],[3,-6],[6,-6],[7,1],[2,-2],[6,3],[8,14],[9,12],[11,6],[8,1],[5,-4],[4,-5],[2,-5],[0,-12],[-1,-5],[-6,-15],[0,-4],[-1,-8],[3,-5],[0,-1]],[[9322,5734],[0,-4],[-2,1],[0,9],[2,-3],[0,-3]],[[9339,5733],[-7,-8],[-10,-4],[-11,0],[-10,6],[0,6],[21,-5],[8,5],[9,16],[1,-2],[1,-3],[1,-6],[-2,-3],[-1,-2]],[[9332,5743],[-6,-3],[-3,5],[-2,1],[1,2],[2,0],[1,0],[4,2],[2,-1],[0,-2],[-2,0],[-1,-2],[2,-1],[2,-1]],[[9477,6185],[4,-9],[3,-5],[6,-10],[3,-5],[2,-15],[3,-20],[1,-18],[-1,-10],[7,-25],[3,-66],[4,-27],[-3,-12],[2,-19],[6,-36],[1,-4],[1,-4],[1,-2],[3,-2],[0,-5],[-3,-6],[-7,8],[-8,4],[-9,1],[-9,-2],[-9,-6],[-16,-18],[-6,-4],[-24,-25],[-3,-7],[-60,-68],[-13,-20],[-6,0],[-6,4],[-9,3],[-24,1],[-7,4],[-4,-9],[-4,1],[-5,5],[-4,3],[4,-10],[1,-5],[1,-7],[-9,22],[-14,20],[-29,26],[-16,6],[-13,9],[-13,-1],[-32,-7],[-14,8],[-15,9],[-12,-9],[-17,-4],[-18,11],[0,-2],[-22,20],[-17,5],[-18,-2],[-6,-3],[-5,-6],[-13,-23],[-24,0],[-5,-2],[-10,-11],[-6,-4],[-6,0],[-9,-5],[-9,-13],[-8,6],[-7,-12],[-3,-4],[-4,-3],[-8,-11],[-4,-3],[-7,4],[-4,7],[-4,5],[-6,-4],[3,23],[2,11],[2,5],[15,41],[6,22],[5,20],[-3,24],[7,12],[9,16],[6,36],[-3,14],[-3,13],[6,21],[11,21],[2,20],[7,27],[4,26]],[[8863,7260],[-7,-12],[-3,2],[4,14],[4,12],[4,8],[2,4],[2,1],[2,2],[0,-5],[-2,-12],[-6,-14]],[[8884,7284],[-6,-4],[-3,7],[2,11],[3,3],[2,-3],[3,-7],[-1,-7]],[[8877,7311],[-3,-4],[1,13],[3,12],[2,-5],[-3,-16]],[[8908,7213],[0,5],[-4,11],[-5,17],[-2,16],[3,13],[-10,-1],[-4,13],[-2,20],[-4,20],[17,58],[11,26],[14,17],[8,3],[17,3],[7,5],[15,17]],[[8969,7456],[0,-4],[-1,-3],[-2,-2],[-8,-16],[-15,-7],[1,-7],[5,-6],[-8,-18],[-2,-9],[-4,-8],[-4,-14],[-14,-60],[-6,-19],[-3,-6],[-5,-10],[0,-10],[7,-14],[1,-4],[2,-5],[3,-19]],[[8887,7645],[5,-20],[-1,-12],[28,-13],[16,8],[3,-12],[20,-32],[-5,-8],[-7,-3],[-12,1],[-4,-3],[-6,-6],[0,-5],[2,-5],[3,-2],[3,-4],[3,-10],[2,-5],[11,-17],[3,-4],[8,-5],[2,-3],[2,-3],[2,-5],[3,-11]],[[8968,7466],[-18,-21],[-34,-6],[-5,-7],[-8,-24],[-19,-45],[-22,-71],[-13,-23],[-4,-11],[-2,-13],[0,-16],[1,-27],[2,-20],[-6,-20],[-20,-10],[-23,-6],[-26,4],[-7,-9],[-7,-15],[-16,16],[-17,12],[-10,3],[-17,-4],[-8,4],[0,17],[3,14],[-5,36],[0,17],[2,8],[5,10],[9,16],[13,67],[-1,49],[-4,32],[4,18],[2,22],[15,46],[5,22],[8,30],[2,31],[2,26],[-3,21]],[[9461,7957],[3,-12],[13,-57],[7,-11],[12,-25],[6,-10],[14,-11],[3,-8],[4,-18],[6,-8],[9,-6],[16,-7],[3,-9],[0,-17],[-2,-19],[-3,-12],[-2,-12],[0,-18],[2,-17],[3,-10],[8,-10],[19,-39],[-5,-15],[-1,-17],[4,-17],[5,-12],[10,-9],[11,-5],[9,-7],[5,-16],[-1,-8],[-4,-16],[1,-7],[4,-7],[6,-5],[6,-1],[4,3],[10,9],[11,2],[10,-5],[9,-10],[7,-10],[5,-15],[3,-16],[-3,-14],[4,-6],[1,-7],[-2,-9],[-4,-8],[-13,-42],[-9,-20],[-9,-11],[6,-17],[-2,-12],[0,-12],[-3,-4],[-5,-6],[-5,-8],[-6,-5],[-19,-7],[-4,-5],[-2,-8],[-5,-10],[-7,-9],[-6,-4],[-6,-8]],[[9205,7399],[-18,9],[-5,8],[-1,6],[-1,6],[-3,9],[-4,6],[-3,6],[-1,7],[-1,8],[-4,6],[-4,4],[-9,7],[0,14],[11,29],[6,9],[22,26],[23,35],[10,12],[4,18],[5,8],[4,2],[8,-3],[6,2],[3,4],[1,4],[2,4],[9,19],[6,14],[2,6],[1,11],[3,4],[19,21],[8,20],[-1,5],[-1,6],[-7,8],[-15,26],[8,36],[8,20],[8,10],[5,4],[8,-4],[16,-14],[5,-8],[1,-2],[2,2],[2,2],[7,15],[3,4],[9,8]],[[9362,7858],[5,10],[6,13],[7,11],[7,5],[3,5],[4,13],[5,14],[6,7],[9,-1],[7,-5],[7,-2],[9,11],[5,8],[7,8],[8,4],[4,-2]],[[9172,8054],[3,-13],[4,-4],[5,-2],[5,-4],[2,-4],[2,-5],[0,-4],[0,-4],[0,-4],[0,-15],[-2,-8],[0,-16],[1,-29],[4,-11],[22,-14],[10,-11],[9,0],[14,2],[8,5],[0,4],[0,6],[-3,13],[-1,8],[2,11],[3,8],[5,43],[2,6],[8,2],[13,-7],[10,0],[2,-4],[1,-5],[1,-6],[0,-6],[1,-6],[0,-13],[0,-13],[1,-6],[2,-3],[5,-2],[4,-1],[9,-4],[5,-8],[8,-7],[8,-16],[8,-21],[2,-6],[3,-14],[4,-8]],[[8969,7456],[6,11],[4,12],[-11,-13]],[[9293,9353],[-1,-9],[-1,-3],[-1,-4],[-2,-3],[-2,-2],[-3,-4],[-1,-3],[-3,-3],[-3,-4],[-3,-2],[-4,0],[-4,5],[-9,8],[-4,-2],[-13,9],[-14,17],[1,7],[-2,5],[-8,13],[-20,12],[-6,-15],[-8,-9],[-12,-9],[-3,-1],[-9,-6],[-3,0],[-5,6],[-3,2],[-17,-4],[-12,-5],[-10,3],[-3,3],[-3,3],[-5,0],[-7,-3],[-7,-7],[-3,-4],[-3,-4],[-3,-1],[-3,-2],[-23,0],[-4,-1],[-1,0],[-3,2],[-2,6],[-2,11],[0,7],[2,6],[4,2],[3,2],[1,4],[-2,5],[-3,6],[-5,1],[-6,5],[-6,12],[-3,4],[-3,5],[-4,2],[-10,1],[-10,7],[-10,9],[-9,0]],[[8975,9433],[0,1],[-5,19],[-1,17],[-1,11],[-1,14],[-6,25],[-1,19],[-3,13],[0,5]],[[9212,9718],[0,-2],[34,-3],[18,8]],[[9264,9721],[1,-2],[0,-4],[-1,-5],[-2,-5],[-2,-6],[-3,-24],[-4,-10],[-3,-17],[-2,-8],[-2,-5],[-9,-16],[5,-1],[5,2],[3,1],[3,1],[3,0],[3,-1],[3,0],[8,6],[2,0],[3,-2],[10,-11],[2,-2],[1,-5],[-1,-11],[-1,-7],[-2,-37],[8,-6],[5,-1],[4,-3],[4,-3],[15,-5],[5,0],[12,5],[8,15],[4,-4],[2,-3],[7,-19],[-1,-10],[-16,-37],[-5,-8],[-7,-6],[-1,-2],[-3,-10],[-4,-6],[-3,1],[-2,0],[-2,-2],[-3,-8],[-4,-20],[2,-6],[-1,-4],[-1,-6],[-6,-15],[-1,-6],[-2,-2],[-1,-1],[-1,-3],[1,-5],[0,-5],[-4,-14]],[[9711,9087],[-6,3],[-17,1],[-36,28],[-4,9],[-3,11],[-2,11],[0,7],[2,8],[0,6],[-3,2],[-3,1],[-3,2],[-2,4],[-2,3],[2,6],[4,17],[-5,-3],[-15,-17],[-3,-8],[-8,-1],[-13,6],[-31,-4]],[[9563,9179],[-11,-1],[-13,7],[-5,7],[-12,27],[-6,7],[-6,0]],[[9510,9226],[2,11],[1,4],[2,4],[4,3],[5,1],[2,2],[-1,4],[0,6],[0,6],[2,11],[3,8],[4,7],[1,3],[-1,5],[1,9],[7,11],[14,7],[-10,9],[-3,6],[-3,12],[-2,16],[0,41],[13,15],[4,3],[3,3],[4,7],[3,13],[4,14],[4,7],[4,2],[3,1],[4,1],[3,3],[1,4],[0,5],[-2,6],[-2,5],[-2,6],[-1,6],[-1,11],[2,22],[13,69],[10,32],[3,6],[2,2],[3,4],[1,5],[-1,11],[0,7],[-7,16],[-4,15],[-1,8],[-1,14],[1,17],[1,9],[-2,16],[-1,4]],[[9599,9781],[5,10],[0,13],[-2,27],[1,11],[3,5],[6,7],[7,7],[5,1],[13,-12],[12,-17],[13,-9],[14,10],[9,11],[4,-3],[6,-5],[9,-11],[11,-4],[25,3],[10,9],[2,25],[12,-3],[15,-35],[12,-6],[28,2],[14,7],[5,17],[10,-6],[5,-10],[2,-14],[-3,-35],[3,-6],[7,-2],[10,-5],[-4,-16],[-10,-67],[-2,-8],[-3,-7],[-2,-7],[1,-8],[3,-7],[2,-7],[1,-16],[2,-16],[5,-13],[11,-7],[5,2],[6,5],[5,6],[3,5],[2,4],[6,-1],[32,-10],[20,-11],[18,-18],[16,-28],[6,-12],[4,-8],[-19,-44],[-10,-17],[-3,-8],[0,-6],[1,-6],[0,-5],[-15,-38],[0,-7],[-12,-2],[-6,-3],[-5,-7],[1,0],[0,-5],[0,-7],[-1,-4],[-2,-1],[-5,2],[-1,-1],[-13,-32],[-13,-20],[-7,-10],[-6,-6],[-23,-16],[-4,-4],[-26,-1],[-7,-2],[-4,-8],[-14,-33],[-3,-12],[-3,-7],[-14,-19],[-5,-10],[-1,-6],[0,-21],[-3,-15],[-16,-36],[-5,-9],[-11,-2],[-24,4],[-9,-7]],[[9705,8433],[-5,-1],[-17,-18],[-7,-5],[-3,-8],[-4,-19],[-4,-10],[4,-12],[2,-28],[5,-11],[5,-2],[11,-3],[4,-2],[4,-6],[5,-14],[9,-18],[16,-46],[-6,-18],[-2,-8],[0,-9],[-1,-8],[-3,-20],[-1,-3],[-4,-5],[-1,-4],[0,-4],[2,-9],[0,-4],[-1,-7],[0,-14],[-2,-8],[-10,-24],[-4,-4],[-9,-6],[-3,-4],[-3,-11],[1,-9],[2,-7],[0,-7],[-1,-8],[-5,-14],[-2,-7],[0,-8],[1,-6],[1,-6],[-5,-17],[-6,-4],[-59,-12],[-12,1],[-9,8],[-6,-3],[-16,1],[-8,-3],[-6,-4],[-6,-3],[-86,7],[1,-2]],[[9233,8158],[7,10],[1,5],[3,3],[1,2],[6,1],[4,8],[9,4],[7,0],[1,3],[1,4],[0,5],[3,1],[5,1],[2,3],[2,2],[4,1],[3,0],[2,-2],[2,-1],[2,2],[5,12],[3,3],[3,1],[8,1],[4,4],[0,4],[-2,11],[2,7],[5,9],[9,7],[6,2],[5,0],[3,-2],[4,-2],[8,-11],[1,17],[-1,14],[2,5],[2,2],[2,-1],[1,-3],[1,-3],[3,-1],[4,1],[8,8],[3,6],[2,4],[0,5],[0,5],[0,5],[-2,9],[-11,12],[-7,13],[-4,6],[-2,5],[-2,11],[1,6],[9,32]],[[9371,8414],[7,6],[7,1],[5,3],[15,18],[11,7],[10,10],[9,15],[7,18],[10,-6],[14,5],[4,5],[2,5],[3,12],[1,5],[6,15],[20,31],[15,-21],[10,-4],[4,0],[13,6],[8,16],[4,1],[4,1],[7,2],[3,-1],[4,-3],[-3,-49],[-5,-22],[-3,-6],[-4,-6],[-4,-9],[-1,-6],[1,-5],[1,-2],[3,-3],[2,-1],[5,-2],[8,-3],[10,-4],[18,11],[19,0],[5,3],[3,4],[1,6],[2,7],[2,6],[4,6],[3,-1],[2,-4],[2,-6],[4,-11],[3,-5],[9,-3],[10,1],[6,3],[4,-1],[2,-1],[10,-8],[7,-6],[4,-8],[1,-3]],[[8949,8344],[5,-3],[12,-10],[-8,-7],[-4,1],[-6,9],[-1,4],[-1,6],[1,-2],[2,2]],[[9144,8530],[5,-3],[4,-5],[12,-6],[9,-10],[6,-9],[7,-5],[3,-5],[2,0],[1,3],[1,3],[1,4],[1,4],[1,2],[17,5],[23,-6],[31,36],[21,14],[18,20],[7,6],[9,23],[14,16],[4,9],[4,4],[9,3]],[[9354,8633],[4,-18],[2,-3],[3,-6],[0,-6],[-2,-8],[-2,-5],[-3,-3],[-4,-2],[-2,-4],[-2,-6],[3,-8],[4,-3],[7,-3],[2,-3],[-1,-8],[4,-30],[2,-6],[6,-8],[1,-5],[-1,-5],[-9,-10],[-3,-7],[-3,-8],[-2,-13],[-4,-16],[10,-10],[7,-15]],[[8924,8262],[14,64],[6,12],[4,-11],[7,-5],[16,-1],[0,6],[-7,10],[-6,7],[-7,4],[-18,4],[-7,7],[-4,12],[0,17],[5,24],[12,38],[26,164],[5,40]],[[9711,9087],[-1,-15],[-5,-11],[1,-11],[4,-9],[13,-21],[5,-15],[9,-33],[3,-17],[3,-7],[6,-3],[5,-5],[2,-10],[-2,-11],[-6,-3],[-1,-21],[0,-5],[2,-9],[-1,-5],[-1,-4],[0,-8],[0,-16],[0,-12],[5,-27],[4,-28],[0,-14],[0,-10],[-2,-14],[-10,-27],[-2,-13],[1,-14],[3,-9],[5,-7],[4,-11],[2,-15],[-1,-10],[-9,-21],[-8,-28],[3,-27],[9,-24],[13,-20],[-7,-20],[-3,-6],[-17,-20],[-3,-4],[-1,-7],[-1,-7],[0,-6],[-1,-5],[-7,-8],[-8,-1],[-8,1],[-3,-1]],[[9354,8633],[4,7],[12,3],[4,2],[10,12],[12,6],[13,15],[16,10],[27,7],[-2,17],[10,45],[5,11],[2,20],[-7,15],[-9,9],[-4,12],[5,9],[1,4],[0,6],[-1,6],[-2,5],[-10,12],[-4,7],[0,6],[1,5],[5,10],[4,13],[5,23],[1,3],[3,5],[5,4],[10,-2],[4,-2],[6,-7],[13,-23],[2,-3],[3,-6],[7,0],[4,9],[9,33],[0,9],[-1,8],[-2,5],[-1,16],[5,5],[15,-6],[12,18],[4,15],[0,8],[-1,7],[-2,5],[-3,2],[-4,4],[-3,4],[-3,10],[-1,4],[2,4],[9,-1],[5,6],[-2,22],[2,15],[3,25],[11,53]],[[9293,9353],[7,-13],[0,-8],[0,-7],[3,-7],[6,-5],[11,-12],[-2,-11],[2,-12],[6,-20],[6,-6],[1,-1],[-5,-33],[-1,-20],[-2,-19]],[[9325,9179],[-17,-18],[-49,-26],[-11,-2],[-40,5],[-13,-5],[-27,-17]],[[9022,9061],[0,12],[-4,55],[0,29],[7,12],[0,5],[-15,5],[-7,23],[-6,28],[-7,24],[2,10],[-1,10],[-2,9],[-2,10],[0,25],[-2,8],[-3,2],[-1,9],[-2,9],[-6,14],[-2,12],[0,11],[0,23],[4,27]],[[9325,9179],[21,21],[8,1],[6,-3],[9,-15],[5,-6],[7,-3],[7,-1],[8,2],[7,4],[11,12],[6,5],[7,1],[1,0],[16,-3],[19,4],[47,28]],[[9264,9721],[13,21],[4,10],[5,8],[6,4],[6,-2],[8,1],[3,10],[2,14],[2,10],[8,4],[1,-22],[3,-24],[13,0],[2,5],[2,5],[2,5],[4,2],[11,-1],[24,9],[12,9],[6,-2],[11,-13],[7,-5],[21,-1],[-6,-26],[0,-8],[7,-6],[7,-1],[8,2],[8,5],[6,6],[3,6],[0,6],[1,5],[3,4],[3,0],[6,-7],[4,0],[5,-3],[5,-11],[4,-15],[2,-13],[5,7],[10,17],[5,6],[6,2],[15,-1],[7,2],[28,15],[13,13],[4,8]]],"transform":{"scale":[0.0025081462417241712,0.0012125599964890141],"translate":[-31.284901495999918,30.029242255000057]}};
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
