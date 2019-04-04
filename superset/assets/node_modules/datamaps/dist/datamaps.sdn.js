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
  Datamap.prototype.sdnTopo = {"type":"Topology","objects":{"sdn":{"type":"GeometryCollection","geometries":[{"type":"Polygon","properties":{"name":"Blue Nile"},"id":"SD.BN","arcs":[[0,1]]},{"type":"MultiPolygon","properties":{"name":"Red Sea"},"id":"SD.RS","arcs":[[[2]],[[3,4,5]]]},{"type":"Polygon","properties":{"name":"Southern Darfur"},"id":"SD.SD","arcs":[[6,7,8,9]]},{"type":"Polygon","properties":{"name":"Eastern Darfur"},"id":"SD.SD","arcs":[[10,11,12,-7,13]]},{"type":"Polygon","properties":{"name":"Western Darfur"},"id":"SD.WD","arcs":[[14,15,16]]},{"type":"Polygon","properties":{"name":"Central Darfur"},"id":"SD.WD","arcs":[[-9,17,-16,18]]},{"type":"Polygon","properties":{"name":"Khartoum"},"id":"SD.KH","arcs":[[19,20,21,22,23,24,25]]},{"type":"Polygon","properties":{"name":"Gezira"},"id":"SD.GZ","arcs":[[26,27,-22,28]]},{"type":"Polygon","properties":{"name":"Gedarif"},"id":"SD.GD","arcs":[[29,30,31,-29,-21]]},{"type":"Polygon","properties":{"name":"River Nile"},"id":"SD.RN","arcs":[[32,-26,33,34,-5]]},{"type":"Polygon","properties":{"name":"Northern"},"id":"SD.NO","arcs":[[-34,-25,35,36,37]]},{"type":"Polygon","properties":{"name":"White Nile"},"id":"SD.WN","arcs":[[-28,38,39,40,41,-23]]},{"type":"Polygon","properties":{"name":"Sennar"},"id":"SD.SI","arcs":[[-32,42,-2,-39,-27]]},{"type":"Polygon","properties":{"name":"North Darfur"},"id":"SD.ND","arcs":[[43,-14,-10,-19,-15,44,-37]]},{"type":"Polygon","properties":{"name":"South Kordufan"},"id":"SD.KS","arcs":[[-41,45,-12,46]]},{"type":"Polygon","properties":{"name":"North Kordufan"},"id":"SD.KN","arcs":[[-24,-42,-47,-11,-44,-36]]},{"type":"Polygon","properties":{"name":"Kassala"},"id":"SD.KA","arcs":[[47,-30,-20,-33,-4]]}]}},"arcs":[[[7942,2355],[-13,-7],[-23,-18],[-9,-14],[-8,-17],[-7,-18],[-4,-18],[0,-15],[4,-28],[-1,-30],[4,-15],[13,-30],[1,-14],[-2,-14],[-75,-203],[-2,-16],[6,-20],[10,-14],[8,-15],[-2,-23],[-40,-141],[0,-8],[6,-10],[17,-16],[4,-11],[-5,-25],[-10,-18],[-32,-30],[-11,-12],[-3,-9],[0,-9],[-3,-13],[-8,-13],[-6,-1],[-8,3],[-10,-1],[-7,-8],[-8,-23],[-5,-6],[-6,3],[-1,11],[3,22],[-4,11],[-8,9],[-17,14],[-72,77],[-8,4],[-10,-5],[-72,-60],[-10,-11],[-9,-16],[-23,-55],[-52,-88],[-4,-26],[2,-31],[29,-162],[1,-34],[-5,-31],[-2,-4],[-6,-8],[-1,-3],[0,-9],[2,-18],[-1,-8],[-14,-25],[-35,-40],[-74,-255],[-18,-110],[2,-56],[-101,0],[-2,1],[-2,2],[-1,4],[-2,5],[-5,21],[-2,32],[4,57],[12,67],[39,94],[2,8],[0,4],[0,5],[-4,17],[-4,14],[-2,22],[6,49],[1,16],[-1,19],[-3,12],[-26,82],[-9,13],[-129,130],[-129,130],[-47,70],[-5,5],[-7,4],[-131,59],[-6,6],[1,8],[4,12],[16,34],[2,9],[2,14],[-30,273],[-29,274],[0,11],[3,7],[2,4],[8,12],[7,12],[7,21],[2,8],[9,98],[-1,85],[34,143],[4,61]],[[6787,2605],[18,16],[10,7],[12,6],[13,4],[13,3],[17,-2],[67,-21],[18,-1],[10,5],[432,325],[77,42],[21,2],[20,-6],[23,-15],[21,-22],[29,-36],[131,-251],[73,-108],[67,-80],[56,-52],[5,-7],[12,-25],[10,-34]],[[9202,8909],[-6,0],[-7,16],[0,24],[4,22],[9,15],[6,-5],[2,-2],[3,-9],[-7,-49],[-4,-12]],[[9028,6186],[-544,-53],[-11,0],[-17,7],[-212,131]],[[8244,6271],[-294,235],[-21,26],[-11,15],[-58,108],[-77,180],[-11,19],[-22,30],[-71,79],[-138,97],[-110,56],[-88,30],[-8,6],[-6,10],[-281,799],[-2,10],[1,7],[1,4],[20,52],[7,33],[2,19],[0,34],[-10,121],[-28,112],[-5,40],[2,58],[10,76],[13,42],[9,20],[1,3],[0,3],[-5,11],[-1,3],[-1,8],[1,44],[3,31],[0,6],[0,7],[-4,17],[-7,24],[-11,27],[-7,12],[-11,27],[-3,6],[-4,6],[-4,5],[-2,3],[-12,25],[-12,40],[-1,3],[-4,6],[-3,2],[-2,2],[-4,2],[-27,6],[-6,2],[-7,3],[-5,4],[-10,9],[-5,6],[-36,58],[-7,7],[-32,23],[-5,5],[-2,3],[-8,15],[-1,3],[-1,5],[0,6],[1,15],[1,8],[10,37],[4,17],[0,24],[-4,53],[1,5],[2,6],[20,29],[3,6],[4,8],[2,7],[4,26],[1,10],[-1,9],[-2,12],[-3,16],[-1,4],[0,33],[-1,8],[-5,15],[-1,3],[-2,3],[-4,5],[-8,7],[-10,13],[-9,14],[168,158],[-235,210]],[[6758,9828],[12,0],[126,0],[139,0],[138,0],[135,0],[4,0],[138,0],[139,0],[138,0],[139,0],[138,0],[139,0],[139,0],[138,0],[139,0],[138,0],[139,0],[139,0],[-2,-11],[-2,-3],[-2,-2],[-10,-1],[-10,-5],[14,-12],[6,-10],[0,-89],[14,-101],[-6,-21],[9,-7],[2,-8],[0,-9],[4,-8],[6,-8],[5,-7],[32,-89],[77,-138],[51,-57],[63,-94],[4,-12],[-1,-15],[-4,-12],[-7,-6],[-12,5],[-12,-10],[-11,10],[-16,33],[-4,7],[-4,9],[-2,8],[4,4],[8,-3],[4,-6],[3,-7],[3,-7],[14,-12],[8,-4],[5,3],[-1,6],[-15,20],[-9,29],[-7,10],[-9,-4],[-17,15],[-4,-8],[-5,2],[-4,7],[-2,9],[1,9],[4,9],[1,9],[-6,9],[-17,4],[-9,-13],[-4,-19],[1,-18],[3,-4],[7,-1],[2,-5],[-2,-8],[-2,-7],[2,-18],[0,-9],[-2,-9],[-6,-6],[-6,-3],[-4,-4],[0,-12],[3,-6],[17,-24],[16,-43],[7,-47],[6,-97],[8,-46],[27,-88],[1,-48],[-1,-12],[-3,-11],[-6,-7],[-18,3],[-2,-10],[2,-22],[-5,-52],[5,-30],[0,-11],[14,-43],[5,-26],[3,-24],[3,-36],[-9,-28],[0,-5],[-2,-8],[-7,-10],[-3,-7],[0,-20],[4,-25],[38,-117],[3,-25],[0,-48],[-1,-14],[-3,-8],[-10,-16],[-2,-11],[4,-45],[-1,-14],[1,-6],[3,-7],[9,-19],[12,-42],[24,-157],[5,-76],[2,-9],[5,-5],[5,-4],[4,-5],[0,-5],[-3,-10],[0,-5],[14,-24],[7,-37],[13,-47],[8,-31],[5,-38],[8,-14],[12,-28],[14,-28],[20,-21],[3,-9],[5,-8],[7,-4],[7,3],[7,4],[4,-1],[36,6],[20,11],[3,-14],[13,-8],[11,-3],[12,1],[4,-8],[1,-12],[10,-11],[-5,-28],[10,6],[7,2],[6,-6],[10,-12],[67,-22],[25,-29],[16,-33],[26,-30],[17,-13],[26,-12],[7,-10],[-7,-13],[-16,-10],[-4,-25],[16,-42],[29,-31],[32,-9],[24,5],[3,27],[12,4],[21,15],[3,-8],[-5,-6],[-8,-5],[-6,-6],[-1,-6],[0,-8],[-1,-9],[-7,-8],[-9,-3],[-8,1],[-7,-1],[-4,-7],[8,1],[20,4],[8,-2],[6,-4],[5,-4],[6,-5],[8,-2],[16,-2],[8,-4],[9,-2],[7,4],[1,6],[-8,5],[10,10],[11,-14],[19,-36],[-5,-10],[10,-8],[15,-1],[9,8],[7,-11],[2,-30],[3,-9],[12,-2],[6,11],[-1,17],[-8,14],[10,-7],[24,-30],[4,-12],[0,-11],[2,-8],[6,-16],[-1,-7],[-85,-84],[-17,-29],[-35,-113],[-17,-31],[-12,-11],[-29,-17],[-11,-12],[-3,-14],[1,-16],[-2,-15],[-10,-11],[-14,-3],[-10,8],[-9,11],[-10,7],[-21,-8],[-3,-1],[-3,-6],[1,-5],[1,-5],[0,-8],[-6,-14],[-10,-10],[-9,0],[-3,16],[0,14],[0,13],[-6,7],[-13,0],[-14,-6],[-1,0],[-40,-33],[-19,-28],[-11,-11],[-15,-4],[-13,5],[-18,21],[-12,4],[-21,-14],[-26,-55],[-24,-15],[-24,-4],[-79,-29],[-7,-5],[-1,-8],[7,-34],[0,-14],[-3,-30],[-3,-16],[-13,-27],[-3,-17],[-5,-15],[-34,-47],[-55,18],[-18,-1],[-28,-21],[-18,-2],[-9,2],[-32,-6],[-6,1],[-23,17],[-6,2],[-16,4],[-10,5],[-9,7],[-10,5],[-12,-2],[-4,-5],[0,-1]],[[2045,3235],[34,-284],[-11,-203],[-60,-102],[5,-502],[148,-197],[99,-102],[87,-278],[55,-203],[-3,-80]],[[2399,1284],[-6,-1],[-27,-9],[-12,-7],[-6,-2],[-4,-1],[-24,1],[-4,0],[-9,-3],[-14,-3],[-19,0],[-3,-1],[-26,-8],[-44,-19],[-2,0],[-7,-3],[-7,-1],[-24,1],[-7,-1],[-7,-1],[-9,-4],[-5,-3],[-6,-3],[-8,-1],[-3,0],[-7,-1],[-3,-1],[-11,-6],[-4,-1],[-3,0],[-7,1],[-3,0],[-6,-3],[-3,-1],[-3,1],[-4,0],[-3,2],[-6,3],[-4,1],[-7,2],[-4,-1],[-4,-1],[-5,-3],[-4,0],[-7,1],[-4,0],[-14,-7],[-7,-2],[-15,2],[-7,-2],[-8,-4],[-10,-3],[-3,-2],[-5,-5],[-6,-9],[-29,-79],[-2,-8],[0,-6],[1,-8],[1,-4],[5,-14],[2,-7],[0,-4],[0,-5],[-1,-4],[-6,-22],[-16,-40],[-3,-12],[-6,-14],[-5,-8],[-8,-10],[-16,-28],[-8,-10],[-20,-16],[-21,-21],[-5,-3],[-5,-3],[-7,-2],[-5,0],[-2,-1],[-3,-3],[-2,-5],[-2,-15],[1,-196],[-1,-9],[-4,-17],[-37,-50],[-17,-20],[-5,-8],[-4,-13],[-11,-141],[-1,-4],[-2,-7],[-54,-113],[-4,-11],[0,-5],[0,-79],[-4,-5],[-6,-4],[-29,-12],[-54,-7],[-13,-3],[-66,-51],[-18,-10],[-34,-32],[-3,-6],[-2,-11],[-2,-4],[-34,-6],[-62,13],[-17,-4],[-11,2],[-24,12],[-33,-4],[-38,11],[-20,-1],[-19,-10],[-10,-4],[-19,6],[-19,0],[-8,4],[-9,7],[-9,5],[-10,2],[-11,-3],[-8,-6],[-14,-13],[-9,-2],[-12,6],[-9,17],[-5,19],[0,18],[8,19],[24,34],[10,21],[8,42],[1,25],[-5,16],[-10,1],[-22,-27],[-17,-1],[-15,11],[-8,15],[-2,18],[13,94],[3,5],[7,13],[9,4],[19,-1],[10,3],[7,5],[13,16],[23,36],[8,7],[5,9],[-1,11],[-6,22],[1,13],[15,58],[0,5],[-4,6],[-3,1],[-5,0],[-4,10],[-2,6],[1,23],[-1,10],[-6,18],[0,9],[7,21],[22,42],[8,21],[3,29],[-17,127],[-13,33],[-99,196],[-99,197],[-108,129],[-62,53]],[[712,1480],[174,311],[153,122],[126,102],[120,489],[26,272],[1,23],[11,29],[35,55],[313,378]],[[1671,3261],[182,-32],[99,-5],[93,11]],[[3204,2322],[20,-120],[0,-179]],[[3224,2023],[10,-84],[0,-31],[0,-3],[39,-194],[209,-633],[11,-60],[89,-234],[41,-109]],[[3623,675],[-6,-3],[-10,-3],[-58,-3],[-77,13],[-3,0],[-12,-4],[-4,-1],[-48,8],[-85,-1],[-28,6],[-154,-4],[-230,-96],[-6,-1],[-34,4],[-15,8],[-26,21],[-113,162],[-112,162],[-46,21],[-9,11],[-7,11],[-35,72],[-4,6],[-2,2],[-4,4],[-1,1],[-16,6],[-9,5],[-22,15],[-4,5],[-4,5],[-2,3],[-1,4],[-4,114],[0,5],[-2,3],[-3,6],[-25,40],[-3,2]],[[2045,3235],[27,-3],[26,-6],[20,-11],[16,-12],[112,-125],[80,-57],[30,-17],[129,-129],[11,-13],[6,-14],[1,-15],[-6,-12],[-12,-9],[-54,-18],[-12,-6],[-6,-6],[-3,-6],[-2,-14],[6,-14],[17,-26],[38,-37],[49,-63],[59,-112],[31,-34],[22,-13],[22,-2],[18,4],[20,2],[25,-4],[34,-14],[20,-15],[12,-11],[26,-35],[30,-28],[28,-14],[22,-8],[233,4],[84,-20]],[[1295,5197],[9,-17],[-37,-246],[4,-36],[-2,-111],[3,-44],[9,-41],[14,-23],[31,-40],[22,-35],[18,-40],[15,-47],[13,-66],[2,-32],[-2,-29],[-5,-25],[-9,-28],[-126,-255],[-191,-254],[-42,-92],[-19,-73],[-2,-35],[8,-23],[12,-6]],[[1020,3599],[-68,-91],[-72,-7],[-43,-27],[-186,-333],[-165,-224],[33,-264],[-41,-150]],[[478,2503],[-3,4],[-5,-11],[-8,6],[-23,-5],[-39,-15],[-6,-6],[-4,-2],[-4,-2],[16,81],[0,9],[0,9],[-2,9],[-44,165],[-19,37],[-2,9],[14,25],[30,85],[-8,9],[-61,28],[-75,60],[-17,-31],[-19,-22],[-23,-15],[-28,-10],[-23,-4],[-25,0],[-25,6],[-21,12],[-12,15],[-23,53],[-16,25],[-3,8],[1,5],[10,23],[15,55],[49,113],[17,29],[20,24],[11,7],[64,31],[10,9],[55,70],[21,34],[5,31],[-7,16],[-21,31],[-8,18],[-3,14],[0,43],[-9,28],[-38,43],[-10,29],[0,16],[1,12],[-2,11],[-10,14],[-14,16],[1,7],[15,29],[48,74],[6,9],[14,18],[17,14],[95,54],[11,10],[23,25],[13,9],[16,4],[14,6],[9,13],[1,22],[-5,23],[-5,15],[-10,8],[-34,7],[-10,6],[-7,11],[-6,16],[-1,9],[0,6],[6,12],[2,4],[8,4],[3,4],[1,5],[-2,5],[-3,3],[-2,5],[-9,79],[-4,10],[-19,17],[-13,27],[11,26],[24,23],[26,14],[119,39],[6,6],[3,10],[-1,6],[-9,24],[-3,13],[-5,40],[0,19],[5,12],[22,18],[11,13],[4,12],[0,14],[3,18],[7,15],[54,68],[12,12],[13,9],[21,9],[4,7],[27,59],[4,16],[8,86],[-1,25],[-6,23],[-13,21],[-13,16],[-10,20],[-4,21],[4,23],[12,16],[47,35],[38,56],[15,13],[15,2],[28,4],[92,-23],[44,5],[79,35],[39,10],[68,0],[72,-13],[70,-29],[16,-1],[7,22],[0,1]],[[712,1480],[-85,152],[-1,20],[23,104],[4,7],[10,13],[1,8],[1,15],[2,14],[3,13],[10,26],[3,14],[-1,21],[-1,10],[-15,54],[-8,53],[-8,9],[-14,0],[-57,-7],[-6,3],[0,22],[-2,7],[-15,17],[-48,20],[-21,13],[-21,25],[-18,31],[-12,35],[-3,35],[33,227],[11,38],[2,13],[-1,11]],[[1020,3599],[17,-3],[33,0],[17,-4],[17,-9],[17,-14],[18,-20],[18,-14],[17,-10],[64,-25],[44,-25],[18,-3],[26,3],[26,11],[94,66],[98,45],[24,7],[22,2],[22,-1],[19,-6],[13,-10],[10,-18],[4,-17],[-1,-13],[-6,-15],[-9,-19],[-23,-36],[-82,-96],[-13,-21],[-8,-25],[0,-21],[8,-17],[16,-13],[22,-7],[109,-10]],[[7375,5415],[1,-41],[17,-66],[81,-218]],[[7474,5090],[-205,40],[-133,56],[-17,0],[-24,-15],[-28,-30],[-51,-87],[-29,-71]],[[6987,4983],[-143,-23],[-23,0],[-26,-4],[-15,-8],[-10,-7],[-26,-25],[-7,-8],[-3,-4],[-7,-4],[-4,-2],[-4,1],[-28,7],[-4,1],[-106,-19],[-128,-45],[-8,-4],[-3,-3],[-2,-4],[-5,-18],[-2,-7]],[[6433,4807],[-67,4],[-22,-4],[-10,-5],[-17,-6],[-7,0],[-6,0],[-43,16],[-11,7]],[[6250,4819],[-34,126],[-17,45],[-129,264],[-91,146],[-148,400]],[[5831,5800],[125,92],[23,6]],[[5979,5898],[10,-35],[10,-19],[79,-103],[27,-26],[30,-16],[313,-61],[29,-12],[188,-124],[294,-94],[74,-48],[51,-18],[23,-4],[40,1],[40,11],[79,36],[21,13],[88,16]],[[7247,3944],[-25,5],[-12,5],[-29,6],[-43,-3],[-17,3],[-7,3],[-39,30],[-8,3],[-9,2],[-8,1],[-8,-1],[-16,-8],[-20,-15],[-38,-36],[-48,-58],[-18,-15],[-15,-2],[-14,10],[-50,73],[-23,16],[-25,4],[-25,-8],[-21,-15],[-19,-21],[-15,-29],[-12,-27],[-29,-108],[-13,-18],[-18,-1],[-29,37],[-13,3],[-14,-10],[-11,-23],[-5,-21],[-6,-65]],[[6545,3661],[-54,-73],[-16,-11],[-14,-1],[-9,12],[-3,23],[1,125],[-2,26],[-5,30],[-30,73],[-52,104],[-23,59],[-16,58],[-3,21],[-1,14],[2,14],[4,18],[29,80],[38,80],[34,47],[19,21],[13,23],[8,23],[3,27],[-3,113],[-3,27],[-5,16],[-4,6],[-7,5],[-41,19],[-11,10],[-7,14],[0,15],[5,12],[11,6],[14,1],[13,-1],[11,2],[7,6],[5,17],[-1,18],[-4,20],[-15,47]],[[6987,4983],[52,-71],[19,-13],[116,-48],[97,-61],[2,-2],[2,-3],[41,-106],[86,-148],[5,-15],[1,-28],[-191,-404],[-14,-38],[3,-13],[3,-8],[4,-5],[4,-3],[3,-4],[1,-2],[-1,-2],[-5,-1],[-1,-2],[-1,-3],[2,-4],[10,-12],[3,-5],[19,-38]],[[7474,5090],[85,-24],[71,-31],[96,-61],[32,-25],[26,-27],[23,-29],[32,-50],[11,-22],[81,-240],[136,-182],[29,-25],[27,-4],[34,8],[278,122],[48,11],[206,6],[35,-5]],[[8724,4512],[7,-72],[9,-92],[9,-92],[13,-136],[-53,-201],[-3,-15],[0,-19],[4,-18],[10,-37],[2,-37],[-11,-32],[-25,-74],[-2,-15],[-2,-42],[-6,-21],[-88,-154],[-58,-243],[1,-14],[5,-12],[2,-6],[0,-7],[-5,-11],[-9,-10],[-7,-13],[0,-16],[14,-30],[3,-11],[0,-18],[-12,-82],[-5,-14],[-9,-5],[-16,6],[-6,3],[-3,3],[-4,3],[-7,1],[-5,0],[-180,-32],[-15,-6],[-1,0]],[[8271,2941],[-1,0],[-198,54],[-57,28],[-23,18],[-18,19],[-16,22],[-9,10],[-126,88],[-7,7],[-18,26],[-31,35],[-21,35],[-10,12],[-25,23],[-14,10],[-10,5],[-7,2],[-56,29],[-8,6],[-4,5],[-4,5],[-16,25],[-8,8],[-6,5],[-7,4],[-22,9],[-26,13],[-13,10],[-45,72],[-34,80],[-16,31],[-3,7],[-2,7],[0,8],[2,7],[3,6],[9,10],[5,4],[4,5],[4,5],[3,6],[2,8],[0,7],[-1,5],[-2,5],[-4,1],[-6,0],[-7,-1],[-6,-1],[-6,3],[-4,8],[-5,2],[-3,0],[-10,-7],[-7,0],[-8,2],[-10,10],[-7,5],[-3,1],[-4,-7],[-3,0],[-5,7],[-21,40],[-4,4],[-5,2],[-4,5],[-2,6],[-3,10],[-6,12],[0,4],[2,3],[3,2],[2,1],[1,2],[0,4],[-2,5],[-5,8],[-26,26],[-6,8],[-4,7],[-1,5],[0,15],[-1,4],[-1,2],[-7,10],[-4,9]],[[8244,6271],[10,-240],[-8,-87],[-24,-75],[-37,-49],[-38,-32],[-51,-34],[-46,-19],[-47,-8],[-405,0],[-33,-5],[-17,-10],[-148,-244],[-25,-53]],[[5979,5898],[431,736],[65,145],[-11,59],[0,35],[-60,196],[-1,4],[14,305],[-1,4],[-2,3],[-243,160],[-3,4],[-1,4],[0,4],[213,2271]],[[6380,9828],[12,0],[61,0],[61,0],[61,0],[61,0],[61,0],[61,0]],[[5831,5800],[-85,34],[-31,6],[-206,-23],[-2123,86]],[[3386,5903],[-9,2452],[-1477,0],[-12,6]],[[1888,8361],[0,83],[0,70],[0,70],[0,70],[0,70],[0,92],[0,92],[0,92],[0,92],[0,92],[0,92],[0,92],[0,92],[0,92],[0,92],[0,92],[0,92],[58,0],[58,0],[58,0],[58,0],[58,0],[58,0],[58,0],[58,0],[58,0],[58,0],[58,0],[58,0],[58,0],[58,0],[58,0],[58,0],[57,0],[58,0],[58,0],[58,0],[58,0],[58,0],[58,0],[58,0],[58,0],[58,0],[58,0],[58,0],[58,0],[58,0],[58,0],[58,0],[58,0],[58,0],[58,0],[57,0],[58,0],[58,0],[58,0],[58,0],[58,0],[58,0],[58,0],[58,0],[58,0],[58,-1],[58,0],[58,0],[58,0],[58,0],[58,0],[58,0],[57,0],[59,0],[57,0],[58,0],[58,0],[58,0],[58,0],[58,0],[58,0],[58,0],[58,0],[58,0],[23,0],[8,6],[29,69],[2,5],[27,63],[15,20],[11,7],[12,2],[11,-2],[11,-6],[13,-15],[6,-17],[-1,-18],[-14,-47],[-19,-66],[35,0],[17,0],[60,0],[61,0],[61,0],[61,0],[61,0],[61,0],[61,0],[61,0],[61,0],[49,0]],[[6545,3661],[22,-23],[7,-12],[8,-17],[6,-19],[3,-28],[2,-116],[6,-67],[11,-41],[43,-103],[62,-105],[7,-24],[0,-23],[-13,-60],[-5,-39],[3,-45],[80,-334]],[[6787,2605],[-284,4],[-2,-3],[0,-4],[1,-4],[0,-5],[0,-9],[-2,-18],[-1,-9],[0,-10],[5,-34],[7,-26],[1,-8],[1,-10],[-1,-17],[-198,-1],[-198,-2]],[[6116,2449],[-92,126],[-35,27],[-53,5],[-9,2],[-8,4],[-3,10],[-3,12],[-31,252]],[[5882,2887],[-26,245],[-1,30],[2,6],[14,19],[58,64],[94,78],[52,24],[4,3],[4,6],[7,12],[3,8],[3,7],[0,4],[1,5],[-1,4],[-3,17],[-8,25],[-1,9],[0,8],[1,13],[16,61],[2,11],[-1,5],[-1,3],[-2,3],[-3,2],[-9,8],[-3,2],[-34,11],[-13,7],[-5,5],[-15,17],[-6,8],[-16,19],[-16,22],[-39,78],[-35,99],[-6,12],[-2,3],[-3,2],[-13,10],[-25,24],[-22,15],[-12,11],[-2,2],[-2,3],[-3,6],[-2,8],[-4,15],[-10,28],[-9,40],[-9,65],[-1,101],[11,97],[1,6],[13,45],[22,39],[9,10],[5,4],[22,14],[18,9],[14,8],[5,4],[5,5],[5,8],[64,168],[1,4],[4,4],[67,56],[3,3],[0,5],[-2,10],[-1,12],[-1,15],[7,9],[8,6],[190,98]],[[8271,2941],[-8,-5],[-2,-2],[0,-4],[-4,-19],[-1,-8],[-2,-7],[-6,-8],[-5,-3],[-12,-1],[-5,-2],[-5,-8],[-112,-227],[-7,-21],[-1,-21],[-2,-9],[-6,-10],[-6,-6],[-13,-8],[-6,-6],[-4,-9],[-11,-32],[-6,-40],[-5,-18],[-11,-16],[-23,-16],[-5,-6],[-2,-7],[0,-4],[0,-13],[-1,-7],[-18,-25],[-40,-18]],[[3386,5903],[-16,-2],[-317,-2],[-7,-7],[-5,-12],[127,-1307],[3,-10],[6,-7],[23,-19],[26,-60],[64,-246],[88,-304],[-24,-169],[0,-9],[1,-6],[2,-4],[38,-75],[7,-28],[-2,-28],[-8,-35],[-2,-7],[-8,-13],[-60,-87],[-8,-10],[-2,-7],[-2,-11],[-3,-57],[-2,-9],[-17,-32],[-8,-22],[-13,-26],[-91,-139],[-16,-44],[-3,-11],[-6,-101],[4,-89],[0,-11],[-2,-9],[-1,-9],[-17,-54],[-32,-65],[-2,-10],[-2,-8],[2,-18],[22,-101],[1,-9],[-1,-9],[-3,-28],[0,-37],[1,-7],[2,-7],[30,-57],[7,-17],[4,-24],[2,-18],[38,-88]],[[1295,5197],[0,43],[0,171],[0,172],[0,171],[-1,172],[0,171],[0,172],[0,171],[0,171],[0,172],[0,171],[0,172],[0,171],[-1,172],[0,171],[0,172],[0,171],[0,92],[0,92],[0,93],[0,92],[96,0],[51,0],[67,0],[80,0],[74,-1],[73,0],[87,0],[60,0],[1,1],[1,0],[1,0],[2,0],[0,1],[1,1],[0,1],[1,2],[0,4]],[[6116,2449],[157,-214],[2,-5],[2,-11],[1,-9],[3,-75],[-8,-120],[2,-77],[9,-49],[42,-99],[-2,-18],[-10,-23],[-141,-146],[-140,-146],[-8,-14],[-39,-121],[-37,-71],[-16,-20],[-65,-100],[-128,-155],[-128,-156],[-42,-21],[-128,-9],[-67,-2],[-8,-2],[-11,-6],[-7,-8],[-9,-6],[-8,4],[-9,8],[-158,175],[-140,110],[-141,110],[-27,-20],[-159,-95],[-32,-24],[-18,-18],[-1,-106],[-28,-54],[-50,-59],[-138,-37],[-71,-32],[-73,-48],[-12,-12],[-45,-42],[-39,-47],[-12,-28],[-1,-32],[3,-26],[7,-18],[-1,0],[-237,2],[-237,3],[-29,39],[-61,156]],[[3224,2023],[34,-33],[53,-27],[63,0],[38,12],[31,11],[31,23],[22,28],[25,35],[41,50],[35,35],[25,31],[18,51],[25,58],[19,54],[7,28],[12,31],[22,15],[25,0],[31,-12],[44,-3],[28,-12],[22,-16],[25,0],[35,4],[69,16],[37,15],[19,16],[3,23],[-6,24],[6,38],[22,74],[13,62],[19,35],[18,16],[26,19],[21,39],[29,39],[15,12],[22,3],[19,-7],[41,-39],[40,-35],[38,-35],[41,-31],[58,-15],[16,10],[19,5],[14,-2],[11,-4],[12,-5],[11,-3],[11,1],[160,298],[21,21],[23,11],[23,5],[23,1],[17,-3],[9,-3],[6,-3],[4,-3],[6,-8],[11,-17],[4,-8],[2,-9],[1,-12],[-3,-73],[2,-11],[5,-9],[14,-12],[18,-4],[155,8],[44,-8],[16,-8],[14,-14],[50,-90],[18,-22],[23,-19],[20,-10],[15,-4],[16,-1],[16,3],[15,9],[14,14],[24,35],[7,8],[7,6],[11,6],[34,15],[20,12],[19,17],[15,21],[33,70],[13,20],[17,16],[18,8],[16,0],[31,-8],[13,-1],[14,3],[18,9],[68,50],[18,6],[14,-1],[15,-4],[116,-77]],[[9028,6186],[-1,-6],[1,-6],[12,-20],[2,-14],[-2,-14],[-15,-25],[2,-8],[6,-7],[6,-9],[1,-10],[-1,-29],[1,-3],[3,-7],[1,-4],[-1,-3],[-4,-6],[-2,-3],[-2,-44],[-14,-45],[-7,-10],[-20,-17],[-9,-10],[-5,-14],[-1,-13],[1,-24],[-2,-14],[-7,-29],[0,-11],[4,-17],[7,-13],[10,-12],[8,-13],[1,-2],[4,-13],[-1,-13],[-2,-13],[-1,-16],[3,-16],[11,-30],[2,-15],[-6,-19],[-25,-31],[-10,-19],[-20,-68],[-27,-91],[-28,-98],[-16,-31],[-29,-37],[-8,-16],[-32,-141],[-2,-32],[9,-32],[-20,-16],[-12,-22],[-30,-108],[-11,-20],[-43,-51],[-5,-13],[-1,-17],[7,-70],[12,-123],[4,-41]]],"transform":{"scale":[0.0016796082677315277,0.0013546677746774736],"translate":[21.809448689952603,8.68164174400006]}};
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
