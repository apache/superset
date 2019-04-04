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
  Datamap.prototype.slbTopo = '__SLB__';
  Datamap.prototype.sleTopo = '__SLE__';
  Datamap.prototype.slvTopo = '__SLV__';
  Datamap.prototype.smrTopo = '__SMR__';
  Datamap.prototype.solTopo = '__SOL__';
  Datamap.prototype.somTopo = '__SOM__';
  Datamap.prototype.spmTopo = '__SPM__';
  Datamap.prototype.srbTopo = '__SRB__';
  Datamap.prototype.stpTopo = '__STP__';
  Datamap.prototype.surTopo = {"type":"Topology","objects":{"sur":{"type":"GeometryCollection","geometries":[{"type":"MultiPolygon","properties":{"name":"Nickerie"},"id":"SR.NI","arcs":[[[0]],[[1,2,3]]]},{"type":"Polygon","properties":{"name":"Brokopondo"},"id":"SR.BR","arcs":[[4,5]]},{"type":"Polygon","properties":{"name":"Marowijne"},"id":"SR.MA","arcs":[[6,7,8,9]]},{"type":"Polygon","properties":{"name":"Para"},"id":"SR.PR","arcs":[[10,-8,11,-6,12,13,14]]},{"type":"Polygon","properties":{"name":"Sipaliwini"},"id":"SR.SI","arcs":[[-5,-12,-7,15,-2,16,-13]]},{"type":"Polygon","properties":{"name":"Commewijne"},"id":"SR.CM","arcs":[[-9,-11,17,18,19]]},{"type":"Polygon","properties":{"name":"Coronie"},"id":"SR.CR","arcs":[[20,-17,-4,21]]},{"type":"Polygon","properties":{"name":"Paramaribo"},"id":"SR.PM","arcs":[[-19,22,23]]},{"type":"Polygon","properties":{"name":"Saramacca"},"id":"SR.SA","arcs":[[24,-14,-21,25]]},{"type":"Polygon","properties":{"name":"Wanica"},"id":"SR.WA","arcs":[[-23,-18,-15,-25,26]]}]}},"arcs":[[[2255,9250],[-5,-11],[-11,7],[-13,31],[-17,36],[-19,44],[11,33],[23,40],[5,21],[10,28],[19,36],[3,-16],[0,-42],[-7,-44],[-12,-31],[-9,-32],[11,-46],[0,-27],[11,-27]],[[3880,8336],[-588,40],[-983,-149],[-143,-8],[-120,-17]],[[2046,8202],[-2,4],[-10,15],[-25,8],[-28,-2],[-20,-12],[-5,-23],[13,-23],[25,-29],[-6,-16],[-17,-10],[-21,-3],[-21,6],[-13,13],[-4,19],[-4,167],[-8,7],[-15,-1],[-25,6],[-35,-14],[-22,0],[-10,22],[9,27],[20,25],[119,117],[25,38],[10,56],[3,52],[7,38],[23,50],[33,33],[22,21],[79,29],[33,26],[23,29],[16,34],[59,259],[11,227],[17,79],[6,60],[29,97],[28,66],[65,105],[10,27],[14,21],[20,14],[56,9],[17,11],[13,11],[13,5],[11,7],[32,34],[13,11],[24,8],[25,5],[26,26],[18,6],[68,-17],[152,-35],[89,-10],[122,0],[191,-8],[106,-6],[42,-16],[76,-47],[19,-8]],[[3587,9852],[0,-23],[5,-399],[7,-60],[37,-82],[27,-41],[10,-21],[5,-55],[6,-25],[62,-122],[89,-106],[6,-16],[5,-24],[-6,-30],[-7,-11],[-13,-2],[-29,17],[-16,5],[-15,-3],[-15,-12],[-12,-13],[-14,-10],[-16,-2],[-16,3],[-14,-2],[-4,-15],[10,-24],[81,-81],[12,-19],[7,-23],[-3,-34],[-11,-23],[-13,-17],[-12,-12],[-11,-15],[-2,-26],[-9,-15],[-6,-15],[3,-10],[17,-7],[39,-8],[22,-9],[15,5],[6,12],[8,36],[9,16],[11,8],[14,1],[16,-8],[19,-25],[15,-26],[16,-41],[13,-23],[1,-23],[-12,-22],[-18,-11],[-26,-28]],[[7880,7532],[165,-62],[66,-58],[29,-51],[8,-19],[4,-26],[-2,-25],[-10,-25],[-32,-50],[-12,-25],[-6,-27],[-4,-59],[-6,-29],[-12,-28],[-28,-53],[-11,-26],[-5,-25],[-7,-55],[-8,-26],[-38,-73],[-8,-25],[-3,-27],[5,-211],[-10,-55],[-11,-27],[-16,-26],[-46,-51],[-83,-73],[-20,-26],[-12,-30],[-4,-27],[0,-30],[4,-28],[11,-53],[43,-126],[4,-25],[1,-52],[-4,-21],[-55,-143],[-64,-106],[-13,-28],[-16,-52],[-12,-25],[-18,-20],[-23,-10],[-24,14],[-41,64],[-29,23],[-17,6],[-22,-3],[-19,-16],[-15,-21],[-30,-49],[-20,-24],[-23,-17],[-24,-8],[-80,-9],[-28,-7],[-28,-11],[-27,-16],[-105,-98],[-25,-19],[-159,-80],[-25,-7],[-26,-2],[-26,6],[-23,11],[-21,19],[-13,23],[-17,80],[-49,843],[-8,33],[-15,38],[-32,55],[-29,35],[-2,1],[-2,2],[-1,16],[18,461],[-41,392],[-29,90],[-32,72],[-249,381]],[[6283,7771],[85,94],[118,85],[82,81],[87,140],[9,22],[1,15],[-3,16],[-10,14],[-13,15],[-11,21],[5,23],[24,35],[64,12],[731,6],[50,-7],[17,-19],[11,-22],[8,-145],[7,-26],[15,-24],[22,-20],[130,-87],[23,-21],[19,-24],[14,-24],[8,-25],[3,-26],[-11,-50],[0,-22],[13,-22],[19,-17],[19,-21],[8,-23],[4,-25],[0,-95],[-8,-38],[-2,-19],[7,-18],[16,-11],[16,0],[20,13]],[[9180,8087],[-1,1],[-58,57],[-22,13],[-34,16],[-88,30],[-137,90],[-33,18],[-446,163]],[[8361,8475],[81,111],[13,25],[10,25],[6,30],[4,32],[1,51],[-12,82],[-37,86]],[[8427,8917],[-61,86],[-50,99],[-76,110],[-19,40],[-21,72],[-19,38],[-21,51],[-3,18],[-8,62],[3,30],[10,27],[48,55],[17,34],[-18,191],[17,52],[13,29]],[[8239,9911],[76,-13],[495,-68],[301,-65],[235,-45],[205,-65],[176,-49],[56,-6],[31,-10],[62,4],[14,-20],[25,-9],[15,-24],[-4,-25],[59,-111],[14,-42],[-23,-27],[-59,-109],[-28,-47],[-13,-95],[-34,-186],[-26,-93],[-31,-56],[-44,-52],[-43,-36],[-23,-24],[-10,-23],[-14,-45],[-104,-158],[-48,-54],[-193,-136],[-103,-104],[-23,-31]],[[7420,9174],[-88,-41],[-29,-52],[-5,-6],[-1,-23],[1,-2],[9,4],[25,-3],[7,3],[12,8],[16,6],[15,-1],[3,-7],[-3,-11],[-1,-10],[9,-4],[8,-11],[2,-24],[-5,-134],[46,-15],[49,-1],[937,67]],[[8361,8475],[-35,11],[-24,-35],[-144,-270],[-30,-77],[-15,-22],[-87,-74],[-18,-23],[-10,-18],[-52,-183],[-25,-138],[-41,-114]],[[6283,7771],[-18,-12],[-28,-5],[-13,-8],[-19,-28],[-12,-14],[-11,-11],[-5,-13],[-8,-30],[-10,-13],[-14,-9],[-27,-8],[-10,-6],[-26,-12],[-44,-24],[-74,-30],[-106,-22],[-28,8],[-25,21],[-18,54],[-7,35],[-2,31],[-7,26],[-14,25],[-31,29],[-28,19],[-28,13],[-156,49],[-49,7],[-52,-3],[-57,-11],[-119,-34],[-27,-2],[-26,2],[-115,29],[-5,43],[2,80],[74,542],[129,381]],[[5269,8870],[32,-36],[10,-30],[25,-26],[-2,-24],[-14,-24],[-24,-24],[-18,-39],[-1,-33],[10,-30],[6,-39],[18,-12],[21,-5],[110,28],[31,-2],[96,-25],[744,57],[30,8],[15,10],[20,7],[15,-7],[14,-13],[17,-12],[13,4],[8,13],[5,14],[13,14],[21,0],[37,16],[18,11],[7,13],[4,30],[6,14],[11,15],[12,17],[4,17],[-1,16],[-12,15],[-36,28],[-11,16],[-1,16],[17,32],[6,34],[7,17],[21,17],[14,16],[8,18],[-3,17],[-9,16],[-13,12],[-9,14],[6,16],[28,20],[42,9],[24,11],[11,14],[0,16],[-6,16],[-13,25]],[[6653,9188],[237,-27],[83,2],[261,50],[63,-3],[123,-36]],[[9180,8087],[-28,-39],[-28,-96],[-16,-16],[-38,-26],[-11,-15],[-6,-27],[-8,-15],[-133,-147],[-46,-70],[-15,-37],[-6,-42],[21,-95],[-5,-35],[-11,-13],[-66,-45],[-11,-23],[4,-25],[16,-33],[0,-296],[8,-32],[20,-13],[25,-7],[24,-13],[29,-44],[0,-41],[-8,-46],[2,-59],[31,-78],[4,-28],[0,-98],[-11,-41],[-49,-88],[-7,-60],[43,-258],[74,-152],[22,-103],[2,-61],[-15,-41],[-27,-45],[10,-41],[28,-32],[31,-20],[82,-22],[25,-20],[10,-49],[-7,-36],[-33,-83],[-11,-37],[4,-59],[23,-40],[84,-74],[15,-23],[26,-83],[17,-22],[34,-27],[16,-17],[61,-110],[46,-24],[10,-21],[9,2],[18,-29],[24,-46],[25,-30],[14,-8],[28,-13],[83,-24],[26,-17],[51,-73],[25,-26],[50,-170],[57,-85],[2,-15],[26,5],[27,8],[26,4],[22,-9],[34,-34],[15,-30],[-4,-37],[-19,-54],[-20,-100],[8,-181],[-40,-96],[-89,-90],[-11,-33],[-6,-42],[-17,-47],[-26,-41],[-1,-1],[-82,-57],[-63,-97],[-90,-106],[-34,-54],[-51,-121],[57,8],[27,-34],[6,-55],[-6,-50],[-6,-6],[-11,-6],[-11,-8],[-6,-13],[6,-2],[23,-16],[5,-6],[15,-58],[4,-34],[-11,-15],[-28,-16],[13,-33],[27,-30],[13,-4],[1,-33],[-17,-73],[-8,-14],[-34,-48],[-9,-28],[-1,-25],[4,-16],[15,-16],[33,-26],[-30,-16],[-16,-19],[-39,-112],[-19,-36],[-178,-236],[-86,-171],[-96,-236],[-40,-58],[-117,-114],[-29,-12],[-37,-5],[-54,-1],[-26,-14],[-25,-13],[-66,-164],[-28,-20],[-48,-5],[-82,24],[-35,-6],[-40,-47],[-46,-14],[-47,-9],[-48,-1],[-48,7],[-28,14],[-6,19],[2,23],[-3,26],[-22,54],[14,45],[7,3],[13,0],[11,3],[4,15],[-3,14],[-10,25],[-4,14],[-1,48],[-11,11],[-33,19],[-54,20],[-41,-2],[-38,-20],[-42,-22],[-121,-35],[-94,33],[-241,229],[-10,22],[8,33],[47,47],[16,32],[-13,24],[-44,-5],[-100,-39],[-49,-30],[-94,-79],[-89,-41],[-21,-8],[-19,3],[-19,19],[9,46],[-12,22],[-84,-7],[-196,-147],[-57,3],[-28,35],[-39,14],[-44,-3],[-42,-17],[-41,-39],[-14,-45],[-6,-44],[-20,-36],[-70,-30],[-88,2],[-95,11],[-91,2],[-139,-12],[-47,6],[-52,0],[-91,-41],[-193,-48],[-48,10],[-26,20],[-28,53],[-19,21],[-23,12],[-173,42],[-41,19],[-134,108],[-54,29],[-58,6],[-30,-10],[-15,-13],[-19,-42],[-26,-102],[-1,-106],[-13,-42],[-72,-105],[-18,-19],[-30,-13],[-27,2],[-22,13],[-22,10],[-31,-7],[-31,-38],[-38,-69],[-29,-71],[-7,-44],[28,-19],[108,-6],[45,-11],[46,-41],[23,-94],[33,-51],[66,-45],[21,-18],[88,-111],[83,-70],[19,-27],[8,-30],[-4,-22],[-9,-22],[-8,-31],[3,-106],[14,-96],[-13,-86],[-78,-79],[-161,-47],[-155,31],[-153,61],[-158,40],[-118,-7],[-39,4],[-46,19],[-88,55],[-48,20],[-47,5],[-72,-17],[-45,-5],[-36,7],[-128,46],[-8,27],[-15,24],[-21,17],[-52,16],[-20,12],[-18,16],[-13,21],[-93,47],[-240,4],[-67,26],[-236,327],[-18,71],[-18,52],[-24,106],[-31,46],[-22,12],[-57,10],[-23,11],[-10,21],[1,87],[-27,53],[-88,75],[-18,43],[15,34],[5,25],[-12,24],[-41,36],[-11,21],[-8,33],[5,23],[12,27],[3,26],[-20,22],[-50,-36],[-35,-11],[-16,22],[13,81],[-4,17],[-62,70],[-12,22],[-2,41],[12,31],[7,28],[-17,31],[-51,-28],[-19,14],[-15,94],[-24,44],[-64,65],[-12,32],[9,23],[17,31],[6,26],[-24,11],[-84,-13],[-8,-5],[-16,45],[42,86],[-17,16],[-29,-5],[-49,-23],[-23,-5],[-29,11],[-11,22],[-8,23],[-20,10],[-10,24],[-32,124],[22,24],[39,30],[26,33],[-11,36],[-82,8],[-31,18],[20,31],[13,22],[-2,19],[-7,21],[-4,29],[8,8],[34,-2],[8,10],[-2,18],[-12,30],[-3,19],[-23,53],[-42,38],[-22,44],[37,70],[-8,4],[-2,1],[0,2],[-5,8],[-16,-15],[-22,-14],[-24,-8],[-25,4],[-27,19],[5,16],[15,19],[7,29],[-26,55],[-6,27],[2,29],[14,49],[3,29],[-9,28],[-15,20],[-6,20],[20,30],[4,15],[6,83],[-8,33],[-61,123],[-77,-59],[-66,-11],[-65,19],[-78,33],[3,-43],[-17,-21],[-69,-18],[-6,-8],[-18,-16],[-18,-10],[-8,10],[-6,13],[-15,7],[-19,3],[-20,1],[-14,11],[-31,18],[-32,6],[-24,-47],[-22,-3],[-27,7],[-76,41],[0,1],[-42,22],[-69,14],[-21,8],[-12,10],[-8,13],[-10,28],[-5,25],[1,20],[12,43],[2,16],[-5,30],[-1,15],[37,71],[4,42],[-40,44],[-51,29],[-10,5],[-5,7],[-26,4],[-12,5],[-11,11],[-3,9],[-3,8],[-19,36],[-12,42],[-9,17],[-94,58],[-119,49],[-41,25],[-28,44],[-14,51],[-7,109],[-10,45],[-52,109],[-124,178],[-40,46],[-162,124],[-59,72],[-24,85],[-32,204],[-31,103],[4,49],[34,51],[214,213],[27,40],[16,48],[5,60],[-7,40],[-13,36],[-8,38],[10,43],[24,37],[28,31],[23,31],[18,79],[45,107],[42,67],[39,122],[44,62],[19,42],[4,45],[-21,42],[-66,82],[-32,99],[-41,26],[-41,20],[-18,33],[17,81],[39,55],[45,46],[33,40],[50,81],[18,17],[31,8],[23,-7],[24,-11],[31,-6],[60,8],[28,22],[37,68],[66,62],[82,39],[92,5],[96,-41],[108,38],[56,10],[63,3],[13,-8],[37,-35],[17,-8],[31,3],[42,12],[193,20],[62,16],[26,10],[19,10],[21,8],[34,5],[22,-4],[19,-8],[20,-2],[25,14],[-90,78],[-11,27],[3,32],[8,27],[36,81],[17,68],[16,33],[27,15],[44,-2],[31,-9],[21,-25],[13,-48],[38,16],[39,21],[30,28],[12,33],[-19,48],[-81,97],[-17,41]],[[3880,8336],[230,9],[41,19],[31,21],[51,41],[43,44],[38,22],[49,14],[142,11],[241,-12],[150,10],[23,8],[43,82],[45,13],[11,7],[20,37],[16,16],[59,34],[33,10],[8,9],[3,25],[-23,41],[-1,12],[4,10],[32,20],[100,31]],[[7420,9174],[13,6],[16,18],[-22,32],[-48,21],[-98,30],[-44,32],[-37,39],[-29,44],[-8,16]],[[7163,9412],[-15,32],[-17,52],[30,14],[40,34]],[[7201,9544],[67,22],[23,53],[2,53],[13,19],[54,0],[81,-55],[50,-10],[32,7],[20,12],[19,4],[55,-32],[20,-4],[21,4],[24,9],[19,11],[14,16],[16,14],[29,6],[23,-5],[25,-12],[43,-30],[-11,19],[-16,19],[-20,16],[-20,11],[-32,6],[-22,-3],[-23,-18],[-28,-17],[-56,-5],[-38,24],[-34,7],[-39,-22],[-37,2],[-37,30],[-38,19],[-142,39],[-50,24],[-43,27],[-18,26],[-9,25],[-14,16],[16,25],[22,14],[67,26],[78,13],[99,6],[76,0],[588,-19],[45,-10],[105,-12],[19,-3]],[[5317,9198],[-5,-12],[-33,-34],[-38,-9],[-67,-7],[-20,-8],[-14,-9],[-7,-13],[-5,-17],[2,-15],[5,-16],[9,-18],[19,-29],[65,-69],[9,-7],[18,-20],[14,-45]],[[3587,9852],[26,-11],[47,-11],[115,-11],[266,-60],[155,-40],[125,-5],[116,-29],[83,-23],[76,-19],[165,-35],[101,-33],[60,-16],[51,-9],[95,-32],[154,-14],[45,-48],[35,-20],[14,-32],[0,-206],[1,0]],[[7163,9412],[-105,33],[-42,27],[-17,19],[-15,22],[-11,25],[-18,67],[-6,87],[2,36],[2,10]],[[6953,9738],[20,-6],[21,0],[26,-3],[34,-3],[28,9],[32,13],[39,4],[42,-30],[49,-35],[19,-35],[-29,-70],[-37,-40],[4,2]],[[6895,9775],[-1,-5],[-158,-324],[-69,-72],[-21,-15],[-6,-27],[-2,-57],[15,-87]],[[5317,9198],[18,0],[12,37],[5,38],[-2,81],[-8,42],[-42,90],[-27,59],[38,48],[-25,22],[-30,-2],[-28,-1],[-35,28],[-8,48],[11,36],[40,50],[17,25],[32,33],[24,24],[36,27],[44,16],[58,15],[59,3],[223,9],[124,10],[101,2],[594,-29],[145,-27],[68,-46],[39,-16],[52,-16],[17,-9],[26,-20]],[[6895,9775],[26,-21],[24,-14],[8,-2]]],"transform":{"scale":[0.0004081741923192357,0.000417848483948404],"translate":[-58.067691202999924,1.833506775000075]}};
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
