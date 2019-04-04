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
  Datamap.prototype.sdnTopo = '__SDN__';
  Datamap.prototype.sdsTopo = '__SDS__';
  Datamap.prototype.senTopo = '__SEN__';
  Datamap.prototype.serTopo = '__SER__';
  Datamap.prototype.sgpTopo = '__SGP__';
  Datamap.prototype.sgsTopo = '__SGS__';
  Datamap.prototype.shnTopo = '__SHN__';
  Datamap.prototype.slbTopo = {"type":"Topology","objects":{"slb":{"type":"GeometryCollection","geometries":[{"type":"MultiPolygon","properties":{"name":null},"id":"-99","arcs":[[[0]],[[1]],[[2]],[[3]],[[4]],[[5]],[[6]],[[7]],[[8]],[[9]],[[10]],[[11]]]},{"type":"MultiPolygon","properties":{"name":"Malaita"},"id":"SB.ML","arcs":[[[12]],[[13]],[[14]],[[15]],[[16]]]},{"type":"MultiPolygon","properties":{"name":"Rennell and Bellona"},"id":"SB.RB","arcs":[[[17]],[[18]]]},{"type":"MultiPolygon","properties":{"name":"Central"},"id":"SB.GC","arcs":[[[19]],[[20]],[[21]],[[22]],[[23]],[[24]]]},{"type":"Polygon","properties":{"name":"Guadalcanal"},"id":"SB.GC","arcs":[[25,26]]},{"type":"MultiPolygon","properties":{"name":"Isabel"},"id":"SB.IS","arcs":[[[27]],[[28]],[[29]],[[30]],[[31]]]},{"type":"MultiPolygon","properties":{"name":"Temotu"},"id":"SB.TE","arcs":[[[32]],[[33]],[[34]],[[35]],[[36]],[[37]],[[38]],[[39]],[[40]]]},{"type":"MultiPolygon","properties":{"name":"Western"},"id":"SB.WE","arcs":[[[41]],[[42]],[[43]],[[44]],[[45]],[[46]],[[47]],[[48]],[[49]],[[50]],[[51]],[[52]],[[53]],[[54]],[[55]]]},{"type":"MultiPolygon","properties":{"name":"Choiseul"},"id":"SB.CH","arcs":[[[56]],[[57]],[[58]]]},{"type":"MultiPolygon","properties":{"name":"Makira"},"id":"SB.MK","arcs":[[[59]],[[60]]]},{"type":"Polygon","properties":{"name":"Capital Territory (Honiara)"},"id":"SB.CT","arcs":[[61,-26]]}]}},"arcs":[[[5208,1931],[5,-24],[-14,2],[-6,8],[2,7],[13,7]],[[5231,1974],[-9,-4],[-9,5],[-2,17],[2,3],[3,8],[-1,22],[11,10],[10,-15],[6,-24],[-11,-22]],[[7723,2184],[-11,-5],[2,8],[7,14],[3,14],[0,11],[3,19],[5,4],[12,-16],[4,-17],[-8,-25],[-6,-6],[-11,-1]],[[4851,2827],[11,-26],[-5,-30],[2,21],[-5,9],[-1,-5],[-2,-2],[-2,4],[1,5],[2,1],[0,5],[0,1],[-7,7],[-4,16],[4,10],[6,-16]],[[3394,4688],[6,-13],[4,-31],[-5,-5],[-4,-1],[-3,8],[-8,17],[-5,1],[-2,3],[-1,4],[0,1],[-1,0],[-2,-1],[-2,-3],[1,0],[4,-2],[1,-14],[-3,-2],[-1,7],[-2,5],[-3,-18],[-3,-14],[0,4],[-6,11],[4,21],[4,6],[2,7],[2,1],[5,6],[5,-5],[4,3],[9,4]],[[386,7566],[4,-3],[4,0],[5,-2],[2,-12],[-14,-29],[-12,-8],[-4,-6],[-5,1],[-2,12],[-1,11],[0,15],[4,9],[19,12]],[[3033,9307],[3,-11],[-6,4],[3,7]],[[2984,9352],[10,-12],[-8,4],[-2,8]],[[3156,9322],[-3,-5],[0,32],[1,6],[3,-12],[-1,-21]],[[2903,9395],[-5,-4],[-7,7],[-5,15],[3,4],[10,-11],[4,-11]],[[2935,9853],[-4,-10],[-1,24],[5,-14]],[[2944,9996],[-2,-8],[-5,11],[7,-3]],[[4858,3572],[0,-11],[-1,-7],[-5,-10],[-1,-10],[-1,-5],[-3,-4],[4,-19],[10,-114],[0,-23],[-3,-23],[-11,16],[-10,31],[-8,37],[-9,96],[2,18],[7,20],[9,3],[10,-2],[10,7]],[[4443,3949],[23,-58],[19,-70],[9,-19],[4,-12],[6,-30],[6,-15],[7,-14],[6,-15],[10,-32],[5,-25],[1,-24],[-1,-49],[3,-23],[11,-46],[2,-30],[-4,-31],[-7,-25],[-7,-4],[-3,27],[-31,62],[-7,33],[-5,15],[-8,8],[-8,-5],[-6,-38],[-8,-23],[-12,23],[-13,32],[-11,34],[-4,28],[0,84],[0,80],[-2,30],[0,18],[13,39],[-3,22],[-6,23],[-2,28],[-4,-2],[-8,-4],[-3,-3],[0,29],[-5,26],[-16,49],[5,7],[4,-1],[6,-16],[10,-19],[26,-29],[5,-13],[3,-22]],[[5433,5355],[-4,-2],[-6,14],[3,6],[8,-1],[9,-6],[-3,-5],[-3,-4],[-4,-2]],[[3974,5393],[7,-11],[7,-25],[3,-16],[2,-12],[0,-14],[2,-7],[10,-12],[4,-4],[25,-71],[39,-75],[30,-47],[18,-42],[7,-26],[3,-26],[-6,-28],[-14,-16],[-17,-11],[-14,-14],[5,-18],[3,-18],[0,-18],[-12,-38],[0,-17],[2,-18],[2,-20],[3,-20],[14,-24],[4,-13],[4,-13],[11,3],[18,15],[7,-5],[20,-28],[7,-13],[0,-10],[-3,-8],[-2,-8],[5,-13],[6,-6],[5,1],[3,3],[1,2],[18,-15],[19,-24],[17,-30],[13,-34],[-10,7],[-7,-11],[-2,-16],[6,-8],[9,-7],[9,-16],[4,-22],[-4,-21],[7,-7],[3,-9],[1,-11],[0,-14],[1,-15],[4,-3],[5,-1],[5,-5],[4,-6],[6,-4],[4,-9],[2,-14],[-3,-7],[-19,-26],[14,-12],[5,-7],[3,-9],[10,7],[8,-5],[5,-12],[-3,-18],[6,-2],[14,-8],[0,-9],[-20,-9],[-8,-1],[-2,-7],[0,-16],[4,-16],[4,-7],[4,-11],[5,-50],[9,-15],[-10,-10],[-5,8],[-4,14],[-7,7],[-7,-8],[2,-15],[6,-16],[30,-56],[8,-22],[24,-107],[7,-12],[7,-12],[11,-26],[15,-47],[9,-107],[-1,-30],[-5,-17],[-8,-5],[-11,11],[-39,49],[-7,1],[-2,23],[-5,21],[-30,71],[-4,12],[-2,14],[-1,27],[-3,15],[-8,23],[-35,67],[-52,47],[-17,38],[-36,9],[4,24],[-21,43],[-10,13],[-5,2],[-13,-2],[-5,5],[-2,10],[1,22],[-1,10],[-18,28],[-42,35],[-17,31],[-54,182],[-14,67],[-10,33],[4,10],[2,8],[-2,8],[-4,10],[0,20],[-12,69],[-10,30],[-31,113],[-3,19],[0,74],[-2,12],[-24,97],[13,16],[22,34],[14,7],[0,12],[-18,72],[-30,71],[-3,13],[-10,9],[-26,46],[-8,20],[-9,61],[15,21],[28,-6],[28,-19],[15,-25],[5,-4],[8,3],[8,8],[5,11],[-3,12],[-23,27],[2,10],[5,9],[7,6],[7,-1],[0,-9],[17,0],[9,-10],[15,-37],[9,-13],[8,-8]],[[3859,5986],[-5,-2],[-7,1],[-14,36],[-4,17],[3,16],[9,4],[5,-8],[4,-15],[9,-49]],[[3412,1091],[8,-1],[18,2],[7,-6],[15,-24],[16,-19],[42,-36],[22,-30],[27,-23],[21,-31],[16,-12],[33,-18],[31,-25],[83,-107],[45,-51],[14,-30],[-18,-22],[-9,-1],[-6,5],[-7,2],[-9,-6],[-4,-10],[-6,-28],[-5,-10],[-11,1],[-9,18],[-8,23],[-8,15],[-11,-9],[-5,0],[-4,3],[-28,34],[-4,9],[-8,59],[-7,24],[-15,21],[-8,4],[-16,2],[-8,4],[-9,10],[-2,8],[2,9],[0,10],[-1,14],[0,10],[-2,11],[-8,12],[-6,5],[-8,4],[-9,2],[-7,-2],[-4,-6],[-7,-24],[-5,-7],[-6,-2],[-9,-1],[-16,3],[-13,9],[-29,29],[-15,9],[4,14],[2,5],[-13,18],[-13,-2],[-10,-10],[-8,-6],[-14,6],[-9,16],[-22,48],[-3,19],[-4,10],[-5,10],[-2,7],[5,24],[5,16],[15,25],[5,17],[3,-6],[2,-2],[3,-1],[3,-1],[11,-21],[7,-9],[8,-7]],[[3261,1348],[1,-23],[-17,13],[-15,6],[-13,11],[-12,26],[6,1],[5,-1],[5,-4],[5,-5],[13,-3],[13,-7],[9,-14]],[[3247,4371],[6,-26],[3,-31],[-2,-26],[-10,-11],[-11,9],[-6,21],[-1,28],[5,26],[5,2],[3,0],[4,2],[4,6]],[[3674,4316],[-11,-37],[-10,-11],[-5,-10],[-16,10],[-16,16],[-14,10],[-15,-8],[3,-16],[-11,-12],[-18,-7],[-15,-2],[3,11],[0,8],[-5,6],[-9,3],[4,13],[7,6],[17,0],[9,4],[8,11],[7,12],[5,10],[9,67],[8,29],[13,-2],[20,-65],[8,-10],[12,-1],[9,-2],[7,-6],[6,-10],[-10,-17]],[[2785,4411],[4,-7],[10,5],[-2,-34],[-11,-22],[-34,-29],[1,37],[3,26],[12,49],[8,2],[15,33],[8,11],[0,-6],[-1,-4],[-2,-3],[-2,-5],[0,-14],[-1,-3],[1,-11],[-7,-13],[-2,-12]],[[3489,4521],[13,-10],[14,2],[13,-3],[11,-28],[6,0],[7,23],[13,-4],[15,-19],[13,-22],[5,-31],[-5,-39],[-11,-35],[-12,-22],[-2,11],[-3,4],[-4,-1],[-6,-4],[-1,16],[-4,13],[-7,7],[-9,1],[2,-8],[3,-20],[-5,0],[-12,36],[-10,13],[-11,-7],[-12,-9],[-14,-1],[-13,5],[-11,10],[-1,8],[0,12],[-2,12],[-4,5],[-5,2],[-5,4],[-2,8],[-1,10],[6,3],[14,3],[14,7],[7,19],[6,-10],[3,11],[1,9],[-1,8],[-3,11],[2,6],[2,1],[6,-7]],[[2722,4530],[5,-19],[1,-14],[2,-12],[8,-11],[3,0],[6,15],[6,2],[15,-9],[-25,-92],[-11,-19],[-35,-19],[-7,8],[-5,14],[-6,8],[-9,-11],[-19,49],[2,15],[23,1],[-5,18],[3,13],[7,5],[10,-8],[0,18],[4,-2],[11,-6],[-1,14],[-3,13],[-4,11],[-7,9],[11,0],[7,-6],[6,-1],[4,5],[3,11]],[[3458,4549],[0,-28],[-11,8],[-6,-10],[-9,-37],[-9,13],[1,14],[5,16],[3,19],[-4,36],[3,12],[11,3],[12,-28],[4,-18]],[[3327,3920],[11,-24],[21,-15],[23,5],[7,-14],[11,9],[0,15],[4,26],[-10,13]],[[3394,3935],[5,8],[6,3],[10,-5],[17,-12],[15,-8],[8,-2],[8,0],[7,6],[14,18],[7,4],[16,-3],[24,-12],[15,-3],[5,2],[6,12],[4,4],[4,0],[7,-8],[4,-1],[56,0],[3,2],[8,6],[5,1],[1,-3],[3,-6],[5,-6],[15,-12],[15,-39],[30,-19],[13,-25],[21,-59],[28,7],[34,-28],[31,-42],[20,-39],[5,-23],[3,-28],[2,-58],[4,-11],[8,0],[12,6],[10,-2],[7,-7],[16,-19],[25,-12],[6,-6],[2,-14],[-1,-19],[2,-17],[10,-7],[2,-7],[1,-15],[0,-29],[1,-14],[4,-8],[5,-8],[5,-13],[-1,-41],[-20,-23],[-56,-21],[-30,-17],[-16,-15],[-13,-20],[-55,25],[-48,41],[-16,5],[-31,-10],[-9,5],[-7,12],[-6,16],[-6,14],[-3,1],[-9,-2],[-3,1],[-2,5],[-5,18],[-4,6],[-22,16],[-6,8],[-12,7],[-84,6],[-63,-17],[-34,-1],[-21,4],[-8,0],[-7,-4],[-5,5],[-16,4],[-17,8],[-16,3],[-17,5],[-25,24],[-12,7],[-15,-4],[-12,-10],[-12,-1],[-15,20],[-35,64],[-14,16],[-20,19],[-1,6],[1,16],[0,6],[-3,6],[-6,3],[-4,5],[-3,12],[-1,14],[-1,11],[-6,5],[-12,3],[-3,9],[2,12],[1,15],[-7,30],[-9,28],[-11,25],[-12,23],[-11,15],[-5,10],[-2,13],[9,9],[8,10],[4,14],[-2,15],[-10,28],[-4,13],[0,16],[5,36],[0,15],[-4,18],[-1,14],[-8,15],[-3,4],[4,9],[7,15],[2,47],[5,20],[11,8],[12,6],[47,51],[26,-16],[27,-31],[40,-66],[30,-40],[5,-12],[4,-20],[8,-23],[10,-22],[10,-15],[13,-9]],[[3116,5223],[23,-34],[9,-15],[-1,-9],[-8,-14],[-7,-7],[-7,-1],[-8,2],[-9,6],[-9,8],[-6,9],[-11,21],[-9,26],[-6,5],[-10,-13],[-11,21],[-11,12],[-9,16],[0,36],[5,36],[10,23],[15,13],[21,3],[22,-9],[6,-22],[-2,-64],[5,-29],[8,-20]],[[2188,6462],[9,-21],[13,-11],[14,-8],[12,-2],[11,-9],[12,-19],[7,-23],[-2,-15],[-12,-2],[-11,12],[-9,19],[-4,18],[-8,-18],[-14,6],[-29,31],[1,-13],[9,-33],[-7,0],[-19,8],[-18,0],[1,9],[-3,20],[-9,19],[-15,8],[-3,5],[-3,9],[-2,10],[3,5],[7,-2],[12,-6],[4,-1],[2,-3],[6,-2],[4,3],[-4,15],[0,8],[5,6],[7,0],[6,-9],[9,-7],[18,-7]],[[2318,6453],[8,0],[6,16],[8,14],[11,-7],[3,5],[2,3],[2,2],[4,1],[6,-27],[10,-18],[30,-22],[3,8],[5,10],[5,8],[5,3],[9,-6],[4,-14],[3,-17],[5,-16],[14,-25],[9,-12],[8,-5],[4,-9],[12,-40],[14,-14],[12,-28],[6,-13],[9,-10],[27,-18],[14,-14],[22,-36],[16,-15],[-8,-27],[6,-25],[12,-12],[11,7],[30,-23],[8,-10],[5,-17],[3,-21],[5,-11],[11,7],[20,-29],[17,14],[14,6],[14,-2],[16,-8],[-9,-8],[2,-12],[8,-12],[7,-5],[13,-3],[7,-6],[4,-12],[4,-17],[13,17],[7,-11],[6,-22],[8,-12],[24,-4],[10,5],[5,18],[14,-12],[5,-6],[6,-10],[12,16],[8,-16],[6,-28],[8,-24],[12,-17],[21,-21],[10,-14],[2,-2],[9,-7],[2,-4],[1,-11],[2,-3],[35,-51],[69,-75],[145,-198],[3,-14],[-16,-30],[-15,-39],[-6,-8],[-7,7],[-8,4],[-9,-2],[-6,-9],[1,-8],[11,-15],[7,-23],[7,0],[7,6],[6,12],[7,-11],[22,-57],[6,-20],[3,-20],[0,-28],[22,-31],[9,-23],[-10,-16],[-7,2],[-24,26],[-3,1],[-9,-2],[-4,1],[-3,7],[-2,9],[-3,9],[-13,9],[-8,25],[-16,9],[-5,9],[-11,25],[-23,34],[-7,14],[-2,13],[1,12],[-1,9],[-12,3],[-8,9],[-35,57],[-63,24],[-27,29],[-18,14],[-17,26],[-12,12],[-13,5],[-10,-6],[-25,27],[-14,8],[-13,-7],[-7,31],[-7,18],[-9,7],[-10,1],[-10,7],[-7,11],[-1,18],[-16,-10],[-17,6],[-15,15],[-70,93],[-5,2],[-11,-3],[-5,1],[-3,9],[-1,12],[0,12],[-1,6],[-6,1],[-3,-5],[-2,-6],[-5,-1],[-20,19],[-5,1],[-11,-2],[-5,1],[0,4],[-3,19],[-2,5],[-8,7],[-7,4],[-4,7],[-1,20],[-5,-6],[-16,-13],[-2,27],[-6,21],[-11,14],[-14,4],[-44,38],[-4,52],[-6,24],[-13,-6],[-23,10],[-11,12],[6,20],[-9,17],[-7,11],[-5,0],[-8,-18],[-8,17],[-10,49],[-9,18],[-11,16],[-13,9],[-13,-7],[-7,25],[-33,33],[-12,18],[-3,19],[0,14],[2,14],[1,14],[0,57],[-58,89],[-39,38],[-7,21],[-1,23],[5,16],[13,-3],[16,-17],[73,-46],[6,-8]],[[2100,6595],[5,-15],[10,5],[8,-6],[18,-27],[9,13],[16,-2],[18,-12],[13,-18],[-7,-7],[-5,-9],[-1,-13],[3,-17],[-33,12],[-9,6],[-6,12],[-6,15],[-8,14],[-23,10],[-16,20],[-10,4],[-5,7],[-1,16],[3,13],[6,1],[7,-9],[8,-5],[6,-8]],[[2073,6721],[0,-37],[3,2],[5,3],[3,3],[-3,-12],[-2,-14],[-1,-14],[0,-15],[-11,12],[-4,7],[-5,-48],[-10,14],[-7,18],[-8,15],[-16,1],[0,8],[10,20],[5,0],[7,-3],[20,34],[14,6]],[[9994,8],[-13,-8],[-3,12],[6,11],[5,10],[8,-1],[2,-19],[-5,-5]],[[8601,878],[-14,-4],[-5,16],[4,22],[10,18],[14,2],[7,-4],[0,-13],[-4,-21],[-12,-16]],[[8530,962],[18,-6],[32,-21],[-9,-44],[1,-19],[-1,-27],[41,6],[4,-54],[-56,-7],[-16,-4],[-12,1],[-22,5],[-11,27],[-9,15],[-10,7],[-4,11],[-13,29],[-10,20],[0,23],[6,14],[8,8],[15,13],[14,0],[17,-2],[17,5]],[[8301,1414],[-5,-33],[-18,-33],[-5,-1],[-8,-4],[-6,3],[-6,7],[0,9],[0,12],[5,10],[3,10],[-1,18],[-11,-11],[-9,-13],[-4,12],[2,31],[10,25],[14,22],[10,6],[11,-8],[12,-17],[6,-19],[0,-26]],[[7923,2245],[13,-12],[2,-7],[3,-6],[22,6],[22,-2],[3,-34],[-8,-15],[-3,-27],[-28,-20],[-9,-15],[-14,-11],[-8,-12],[-14,2],[-5,-2],[-20,13],[-9,-13],[-7,-9],[-8,5],[-27,-8],[-32,-66],[-22,-61],[-10,17],[3,37],[-9,20],[-9,3],[-22,-35],[-22,3],[-10,32],[-3,54],[0,29],[14,18],[7,19],[9,21],[7,1],[-4,-47],[11,-23],[8,-3],[4,17],[0,21],[3,36],[12,32],[23,38],[34,5],[53,-11],[24,19],[26,-9]],[[7686,2564],[-7,-4],[-6,3],[-4,13],[1,15],[2,10],[4,6],[11,-5],[6,-18],[-1,-14],[-6,-6]],[[8059,2839],[0,-66],[5,3],[3,3],[11,1],[10,-13],[-8,-25],[-14,-24],[-10,-3],[-1,20],[1,18],[-5,1],[-2,9],[5,29],[3,29],[-1,26],[3,-8]],[[8773,3288],[-6,-1],[-9,11],[-5,25],[3,12],[8,-1],[8,-18],[3,-18],[-2,-10]],[[8709,3410],[-3,-3],[-9,5],[10,2],[2,-4]],[[1564,4910],[7,-13],[6,-13],[5,-6],[15,-13],[11,-29],[-1,-29],[-20,-13],[-6,4],[-27,25],[-36,17],[-40,31],[-18,24],[2,21],[28,-7],[12,-1],[11,8],[5,-10],[6,18],[4,8],[5,4],[7,-2],[4,-7],[3,-7],[4,-4],[13,-6]],[[2024,4745],[-12,-8],[-15,41],[-3,7],[-8,8],[0,17],[5,35],[4,13],[22,30],[4,12],[3,16],[3,18],[0,20],[5,0],[0,-29],[7,-20],[5,-32],[2,-31],[-3,-19],[21,-15],[-1,-13],[-3,-11],[-4,-7],[-17,-8],[-15,-24]],[[1881,5137],[10,-7],[8,7],[7,13],[8,11],[15,6],[19,0],[16,-9],[6,-21],[2,-29],[-1,-10],[-6,-12],[-7,-4],[-8,1],[-7,-1],[-3,-11],[-4,-5],[-14,-10],[-2,-9],[4,-8],[15,-4],[6,-6],[4,4],[3,3],[8,2],[-9,-23],[-5,-8],[-6,-7],[17,-31],[-7,-32],[-30,-49],[-10,-26],[-3,-7],[-7,-8],[-13,-5],[-6,-6],[-11,-3],[-16,6],[-15,9],[-7,7],[-2,9],[-4,6],[-9,8],[-4,7],[-4,14],[-3,7],[-22,35],[-4,8],[0,70],[5,48],[4,8],[4,8],[3,12],[0,19],[20,-23],[8,0],[3,23],[5,-1],[3,-4],[2,-15],[6,18],[-2,13],[-4,15],[0,21],[5,9],[26,19],[6,2],[2,2],[2,5],[6,-9],[0,-10],[-7,-8],[-2,-11],[1,-11],[5,-12]],[[1404,5104],[-2,-5],[-4,-6],[-4,-1],[-2,2],[-3,0],[-3,0],[-3,4],[-4,2],[-5,-6],[-1,-7],[1,-30],[-6,-40],[-1,-22],[4,-18],[28,-53],[15,-19],[17,-8],[0,-9],[-12,-5],[-14,1],[-13,7],[-10,10],[-9,16],[-5,6],[-7,2],[-6,5],[-2,14],[1,15],[0,13],[-5,15],[-20,50],[-9,10],[-12,7],[-16,17],[-15,21],[-6,17],[2,20],[5,17],[7,13],[7,11],[20,19],[11,15],[14,52],[21,37],[23,26],[14,0],[14,-17],[11,-26],[8,-34],[3,-40],[-3,-8],[-11,-24],[-7,-45],[-2,-7],[-2,-4],[-2,-10]],[[1235,5433],[0,-10],[-22,23],[-11,51],[-14,47],[-30,11],[2,4],[5,10],[3,5],[-12,10],[-13,18],[-6,19],[11,10],[10,-15],[19,-3],[19,-7],[8,-28],[2,-17],[8,-53],[4,-46],[6,-19],[11,-10]],[[1194,5667],[18,-11],[18,2],[16,-2],[15,-25],[7,-29],[5,-36],[4,-39],[-1,-38],[-5,0],[-1,20],[-6,3],[-7,-1],[-7,6],[-3,10],[-7,38],[-7,24],[-8,21],[-11,17],[-15,13],[5,9],[-7,1],[-4,3],[0,6],[1,8]],[[978,5809],[3,-22],[8,3],[12,-60],[-19,2],[-23,35],[3,42],[16,0]],[[1598,5626],[6,-22],[-2,-17],[-4,-16],[2,-16],[6,10],[4,-2],[5,-6],[6,-2],[5,3],[9,11],[7,5],[14,5],[12,0],[12,-7],[22,-29],[3,-5],[4,-11],[1,-9],[3,-29],[10,-23],[19,-24],[8,-19],[-2,-35],[2,-12],[4,-12],[12,-17],[4,-8],[6,-24],[5,-47],[4,-24],[4,-4],[5,-1],[4,-3],[3,-11],[0,-13],[-3,-11],[-14,-45],[-2,-8],[-2,-16],[0,-12],[1,-12],[2,-12],[2,-10],[-46,33],[-20,3],[0,-8],[10,-12],[7,-17],[3,-22],[-5,-25],[-5,0],[-2,23],[-5,14],[-6,9],[-3,6],[-2,20],[-7,19],[-16,32],[-20,19],[-41,7],[-19,15],[-33,42],[-18,39],[-3,4],[-1,20],[-6,31],[-3,19],[0,85],[6,-16],[3,-16],[1,-38],[4,-17],[18,-9],[4,-12],[2,-14],[5,2],[6,13],[2,18],[-4,14],[-18,30],[-7,45],[-8,33],[-12,31],[-13,21],[-9,4],[-7,-4],[-8,-6],[-11,-4],[-5,5],[-6,10],[-5,2],[-5,-17],[-8,9],[-6,0],[-12,-9],[0,-2],[-6,-5],[-4,-2],[-25,-1],[-28,5],[-9,-4],[-6,-20],[-5,-25],[-8,-25],[-17,-15],[-13,5],[-26,27],[-7,-4],[-5,0],[-5,127],[2,9],[11,27],[4,6],[11,1],[9,1],[7,6],[7,12],[4,-18],[5,-5],[6,4],[5,10],[2,12],[1,30],[3,14],[-3,16],[4,19],[17,36],[7,20],[11,46],[8,18],[32,57],[11,14],[12,9],[23,11],[12,8],[-1,-7],[1,-1],[2,-1],[3,-1],[52,-53],[20,-3],[-5,-25],[2,-17],[5,-17],[3,-21],[-1,-53],[1,-25],[5,-21],[-7,-25],[3,-18],[17,-27]],[[823,5623],[-13,-11],[-6,17],[-19,100],[-11,31],[-2,30],[5,66],[-8,70],[0,29],[13,14],[11,-18],[10,-20],[3,-14],[5,-33],[10,-31],[4,-23],[2,-25],[1,-19],[4,-36],[0,-19],[-4,-17],[6,-29],[-2,-34],[-9,-28]],[[1259,5739],[-13,-40],[-16,-18],[-16,33],[-6,-4],[-3,-1],[-6,5],[-38,-6],[-39,58],[-30,82],[-12,65],[2,18],[2,16],[7,31],[18,50],[3,11],[10,18],[23,16],[26,12],[18,5],[34,-33],[25,-48],[16,-59],[7,-66],[1,-65],[-2,-23],[-11,-57]],[[786,6136],[-15,-14],[-14,13],[1,12],[6,13],[8,12],[7,-1],[3,-4],[7,-11],[-3,-20]],[[828,6476],[2,-12],[4,-10],[10,-16],[2,-6],[-1,-7],[0,-4],[12,-2],[2,-4],[1,-8],[0,-11],[3,-5],[7,-6],[7,-9],[7,-32],[7,-9],[15,-9],[-5,-10],[10,-20],[17,12],[17,-11],[16,-18],[14,-10],[6,-20],[-11,-43],[-28,-69],[-14,-21],[-18,-35],[-12,-38],[5,-33],[7,-16],[1,-15],[-6,-12],[-10,-7],[-2,5],[-6,9],[-9,4],[-8,-9],[-5,0],[-2,27],[3,28],[-2,21],[-35,17],[-3,23],[8,57],[-3,11],[-7,9],[-7,8],[-4,5],[-10,37],[-5,10],[-13,8],[0,2],[-6,1],[-1,4],[1,6],[-8,31],[-5,5],[-9,-10],[-14,62],[5,62],[20,51],[30,32],[10,-4],[7,-6],[6,-1],[7,11]],[[47,6814],[12,-11],[8,-15],[7,-16],[9,-14],[-16,-26],[-16,-7],[-38,5],[-13,12],[5,25],[21,47],[5,-3],[4,0],[12,3]],[[232,7229],[22,-10],[6,-5],[10,-24],[0,-18],[-4,-19],[-3,-23],[-6,-9],[-12,-7],[-14,-2],[-9,3],[-13,-20],[-12,1],[-13,3],[-14,-12],[-7,6],[-8,15],[-6,7],[-21,12],[-4,7],[1,19],[20,76],[6,-7],[2,20],[5,25],[12,9],[-2,10],[0,9],[2,9],[10,-7],[26,-41],[26,-27]],[[446,7424],[-3,-17],[11,-30],[4,-8],[6,-6],[14,-7],[6,-5],[-7,-8],[-8,-2],[-8,3],[-8,7],[-2,-21],[-3,-21],[-6,-19],[-10,-14],[-1,10],[-1,6],[-2,4],[-1,8],[-5,-11],[-6,-7],[-7,-3],[-8,1],[12,15],[12,19],[2,11],[-4,9],[-4,10],[-2,12],[3,19],[3,6],[7,3],[5,4],[-4,8],[-7,7],[-2,0],[-10,26],[-7,27],[2,28],[20,23],[16,0],[0,-10],[-10,-5],[-8,-10],[-6,-16],[-2,-20],[7,-12],[13,-6],[9,-8]],[[1502,6721],[20,-7],[21,5],[19,-1],[13,-26],[4,11],[6,-11],[-5,-10],[-1,-15],[1,-15],[5,-15],[-21,27],[0,-20],[-8,-8],[-23,1],[0,8],[4,5],[7,9],[4,5],[-29,16],[-9,8],[-6,2],[-19,-2],[-8,4],[13,16],[12,13]],[[1713,6627],[6,-19],[-20,-2],[-11,1],[-13,10],[-5,-3],[-5,-4],[-6,-2],[-5,3],[-5,13],[-5,3],[-14,15],[7,35],[25,53],[36,-23],[5,-10],[1,-20],[9,-50]],[[806,7738],[7,-1],[8,5],[3,3],[28,-15],[20,-27],[39,-80],[10,-17],[34,-41],[32,-16],[47,-58],[32,-27],[27,-10],[13,-11],[9,-6],[8,-9],[4,-16],[2,-10],[7,-2],[9,1],[7,-3],[8,-11],[16,-41],[28,-42],[7,-21],[2,-24],[1,-58],[8,-62],[13,-52],[7,-18],[8,-14],[7,-18],[4,-25],[11,12],[4,7],[6,-24],[10,-18],[13,-11],[15,-4],[10,-8],[7,-20],[5,-24],[1,-19],[5,-11],[9,-9],[22,-13],[9,-9],[9,-13],[8,-17],[5,-17],[5,0],[2,23],[5,1],[8,-9],[9,-6],[16,0],[7,3],[27,18],[15,1],[10,-13],[4,-32],[0,-33],[-3,-19],[-9,-8],[-21,-1],[-9,-10],[-19,-65],[-2,16],[-3,9],[-5,1],[-6,-6],[-10,14],[-18,8],[-34,5],[-14,9],[-11,17],[-3,26],[7,32],[-6,-4],[-5,-6],[-9,-18],[-6,5],[-3,-4],[-1,-20],[-14,15],[-27,17],[-16,15],[-40,6],[-6,-1],[-5,-13],[-11,0],[-11,14],[-8,42],[-8,20],[-10,18],[-9,8],[-7,-7],[-14,-10],[-11,-3],[6,20],[-7,23],[-11,18],[-14,12],[-17,4],[-10,7],[-12,18],[-70,149],[-3,13],[-2,17],[-3,15],[-7,7],[-10,4],[-6,12],[-8,30],[-29,75],[-9,11],[-8,13],[-26,81],[-12,16],[-36,34],[-11,6],[-9,8],[-84,133],[-2,4],[-15,24],[-5,19],[-6,75],[0,27],[6,19],[25,39],[12,4],[18,-5],[15,-10],[9,-18],[5,-4],[5,-7],[3,-12],[3,-12]],[[4702,2760],[-17,-16],[-5,2],[-3,6],[-1,7],[4,9],[3,13],[-3,6],[-5,2],[-3,2],[-10,34],[0,18],[10,15],[16,-24],[13,-38],[1,-36]],[[4375,2856],[4,-8],[42,14],[79,-64],[81,-91],[44,-66],[14,10],[10,-10],[15,-42],[11,-13],[12,-2],[11,1],[10,-1],[9,-7],[22,-25],[5,-10],[7,-13],[16,-1],[17,7],[11,12],[28,-17],[13,-1],[11,9],[6,-11],[11,-26],[8,-10],[9,-5],[25,5],[12,-5],[4,3],[4,29],[5,7],[6,3],[8,0],[14,-12],[21,-51],[8,-12],[9,-9],[6,-21],[15,-74],[4,-9],[5,-8],[5,-3],[4,-6],[4,-45],[6,-20],[10,-16],[27,-32],[7,-17],[3,-22],[0,-78],[-2,-7],[-5,-3],[-5,-7],[-5,-9],[-3,-8],[5,-34],[24,-7],[30,2],[24,-8],[8,7],[5,-11],[-1,-17],[-10,-8],[-10,3],[-9,5],[-9,1],[-10,-9],[-6,6],[-8,3],[-12,1],[-11,3],[-53,38],[-18,-4],[-16,-28],[-9,8],[-9,3],[-21,-1],[-7,3],[-5,8],[-5,9],[-6,7],[-33,24],[-12,18],[-6,5],[-10,-2],[-22,-14],[-7,3],[-7,7],[-31,17],[1,-3],[-4,-4],[-10,-4],[-5,3],[-8,14],[-2,3],[-8,4],[-5,9],[-6,24],[-4,-20],[-1,-9],[-16,22],[-9,5],[-11,-7],[-2,8],[-5,12],[-3,7],[-7,-5],[-6,9],[-4,14],[2,10],[-7,16],[-9,2],[-10,-3],[-10,5],[-6,13],[-2,16],[-4,12],[-11,6],[-4,8],[-10,17],[-10,12],[-5,-5],[-4,-12],[-8,9],[-14,26],[0,12],[-3,8],[-5,5],[-7,4],[1,10],[-1,10],[-4,10],[-6,8],[-7,-13],[-9,-5],[-10,2],[-11,6],[16,85],[-9,10],[0,13],[0,14],[-4,15],[-5,2],[-15,-6],[-8,-1],[7,16],[5,22],[0,20],[-12,8],[7,34],[5,16],[6,7],[4,3],[-2,6],[-5,9],[-4,2],[-12,-2],[-4,0],[-6,8],[-3,9],[-5,8],[-10,3],[-20,0],[-9,4],[-3,11],[-5,5],[-11,1],[-16,-2],[-4,-4],[-4,-6],[-4,-6],[-5,-3],[-6,2],[-5,6],[-19,5],[-9,6],[-6,10],[-3,20],[7,30],[-4,15],[4,7],[2,4],[1,4],[4,3],[-5,22],[-1,29],[7,26],[14,9],[4,-4],[4,-3],[4,-4]],[[3327,3920],[16,-3],[29,2],[8,2],[7,6],[7,8]]],"transform":{"scale":[0.0013319203014301542,0.0007290361197119726],"translate":[155.50798587300008,-12.290622653999918]}};
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
