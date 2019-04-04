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
  Datamap.prototype.surTopo = '__SUR__';
  Datamap.prototype.svkTopo = '__SVK__';
  Datamap.prototype.svnTopo = '__SVN__';
  Datamap.prototype.sweTopo = '__SWE__';
  Datamap.prototype.swzTopo = '__SWZ__';
  Datamap.prototype.sxmTopo = '__SXM__';
  Datamap.prototype.sycTopo = '__SYC__';
  Datamap.prototype.syrTopo = {"type":"Topology","objects":{"syr":{"type":"GeometryCollection","geometries":[{"type":"Polygon","properties":{"name":"Lattakia"},"id":"SY.LA","arcs":[[0,1,2,3]]},{"type":"Polygon","properties":{"name":"Tartus"},"id":"SY.TA","arcs":[[4,5,6,-3]]},{"type":"Polygon","properties":{"name":"Ar Raqqah"},"id":"SY.RA","arcs":[[7,8,9,10,11,12]]},{"type":"Polygon","properties":{"name":"Aleppo"},"id":"SY.HL","arcs":[[-12,13,14,15]]},{"type":"Polygon","properties":{"name":"Hamah"},"id":"SY.HM","arcs":[[-14,-11,16,-5,-2,17]]},{"type":"Polygon","properties":{"name":"Homs (Hims)"},"id":"SY.HI","arcs":[[18,19,20,21,-6,-17,-10]]},{"type":"Polygon","properties":{"name":"Idlib"},"id":"SY.ID","arcs":[[-18,-1,22,-15]]},{"type":"Polygon","properties":{"name":"Hasaka (Al Haksa)"},"id":"SY.HA","arcs":[[23,-8,24]]},{"type":"Polygon","properties":{"name":"Dayr Az Zawr"},"id":"SY.DY","arcs":[[25,-19,-9,-24]]},{"type":"Polygon","properties":{"name":"As Suwayda'"},"id":"SY.SU","arcs":[[26,27,28]]},{"type":"Polygon","properties":{"name":"Rif Dimashq"},"id":"SY.RD","arcs":[[29,-29,30,31,32,33,-21],[34]]},{"type":"Polygon","properties":{"name":"Quneitra"},"id":"SY.QU","arcs":[[35,36,-32]]},{"type":"Polygon","properties":{"name":"Dar`a"},"id":"SY.DR","arcs":[[-28,37,38,-36,-31]]},{"type":"Polygon","properties":{"name":"Damascus"},"id":"SY.DI","arcs":[[-35]]},{"type":"Polygon","properties":{"name":"UNDOF"},"id":"SY","arcs":[[-37,-39,39,-33]]}]}},"arcs":[[[649,7001],[1,-8],[-1,-2],[-3,-11],[-2,-5],[-3,-8],[-1,-7],[1,-7],[1,-7],[7,-5],[10,-5],[22,-2],[11,1],[9,1],[13,6],[12,3],[102,6],[8,-3],[6,-4],[5,-8],[2,-7],[0,-9],[-1,-7],[-12,-17],[-37,-27]],[[799,6869],[-25,-23],[-6,-18],[-3,-50],[-3,-13],[-4,-9],[-22,-17],[-16,-17],[-4,-10],[-1,-9],[3,-6],[18,-26],[5,-11],[4,-13],[4,-23],[4,-62],[-6,-133],[-29,-220],[1,-8],[9,-38],[25,-77],[39,-202],[4,-78]],[[796,5806],[-58,32],[-20,2],[-21,-14],[-11,-6],[-6,-2],[-226,-19],[-10,2],[-44,41],[-23,17],[-64,23],[-1,0]],[[312,5882],[-24,53],[21,67],[-7,34],[-12,129],[4,29],[-15,16],[-73,106],[-31,17],[-15,12],[-6,20],[-11,11],[-24,-4],[-24,-9],[-8,-6],[-16,10],[2,22],[8,27],[1,24],[-9,11],[-52,30],[2,10],[3,20],[4,11],[-9,0],[-21,-12],[0,12],[30,12],[30,20],[23,29],[9,36],[-4,22],[-13,27],[-3,25],[8,15],[35,12],[58,121],[3,11],[-1,46],[-6,39],[-16,47],[-20,43],[-20,29],[73,-5],[36,9],[15,30],[6,38],[39,64],[15,-6],[29,7],[31,12],[29,5],[19,-23],[0,-26],[-4,-26],[3,-24],[18,-16],[23,-6],[47,-2],[44,-22],[88,-69],[25,5]],[[796,5806],[1,-38],[17,-235],[0,-30],[-12,-47],[-5,-11],[-5,-8],[-10,-7],[-6,-5],[-10,-14],[-6,-3],[-21,-2],[-6,-2],[-9,-8],[-6,-3],[-14,-2],[-6,-2],[-5,-3],[-10,-8],[-5,-3],[-5,-2],[-7,0],[-14,4],[-15,-1],[-16,-11],[11,-54],[70,-15],[25,-1],[57,6],[14,-3],[9,-5],[9,-24],[6,-28],[4,-13],[3,-5],[6,-7],[38,-29],[8,-11],[5,-13]],[[886,5163],[-27,-9],[-12,-6],[-5,-3],[-2,-3],[-4,-5],[-2,-5],[-3,-8],[-3,-18],[-1,-9],[0,-7],[3,-19],[0,-13],[-1,-4],[-2,-6],[-5,-7],[-39,-37],[-24,-33],[-6,-7],[-5,-4],[-10,-3],[-3,-2],[-2,-2],[-2,-2],[-35,-52],[-103,-203],[-3,-14],[-2,-39],[-4,-21]],[[584,4622],[-37,3],[-40,-7],[-34,1],[-33,11],[-26,23],[-11,6],[-13,4],[-20,-1],[-6,37],[-27,62],[-10,53],[-15,30],[-3,18],[0,81],[-4,13],[-27,49],[-6,20],[-8,42],[-48,142],[9,6],[1,9],[9,13],[2,14],[-2,14],[-9,13],[0,13],[7,9],[1,1],[-4,3],[-4,14],[12,28],[8,15],[12,13],[8,30],[-5,30],[-8,26],[-6,23],[0,96],[10,23],[70,119],[32,35],[-14,53],[-33,73]],[[5588,8737],[35,-112],[13,-33],[76,-106],[21,-19],[13,-6],[15,-4],[16,-2],[27,4],[13,3],[23,10],[7,2],[6,1],[8,-1],[7,-1],[138,-62],[94,-56],[16,-18],[10,-17],[2,-6],[2,-8],[3,-25]],[[6133,8281],[-98,-471],[-147,-725],[-16,-123],[0,-21],[10,-4],[44,-32],[12,-6],[-12,-27],[-638,-1014]],[[5288,5858],[-839,245],[-441,38],[-133,-18]],[[3875,6123],[-24,39],[-17,20],[-60,48]],[[3774,6230],[-289,334],[-22,31],[-3,7],[-4,8],[-3,14],[-1,10],[0,9],[9,71],[38,181],[42,111],[14,24],[7,11],[4,5],[58,89],[30,33],[7,10],[3,6],[11,28],[7,24],[2,6],[3,8],[3,10],[2,21],[-2,11],[-6,10],[-60,54],[-1,1],[-19,36],[-20,27],[-21,24],[-14,20],[-14,29],[-18,59],[-6,32],[-2,25],[2,14],[3,14],[6,13],[33,55],[19,47],[14,29],[16,24],[16,19],[9,7],[25,15],[62,34],[41,12],[56,2],[249,44],[123,73],[98,75],[18,18],[14,16],[57,92],[18,40],[10,34],[11,68],[0,1],[11,58],[7,56],[3,134],[-1,8],[-2,6],[-2,7],[-4,5],[-5,4],[-6,2],[-6,1],[-7,-2],[-10,-6],[-37,-35],[-15,-11],[-12,-4],[-6,-1],[-7,0],[-5,3],[-5,4],[-5,11],[-5,16],[-8,35],[-1,17],[2,12],[5,3],[6,2],[75,11],[8,5],[7,7],[8,18],[3,12],[1,10],[-1,8],[-19,89]],[[4376,8840],[43,-49],[92,-51],[105,-14],[245,12],[33,11],[78,6],[231,-83],[81,3],[304,62]],[[3774,6230],[-641,-2],[-127,21],[-67,21],[-26,13],[-99,75],[-1,1],[-29,22],[-247,-20],[-87,2],[-11,3],[-13,7],[-54,39],[-128,49]],[[2244,6461],[-63,28],[-8,6],[-22,24],[-10,7],[-8,6],[-13,4],[-7,5],[-48,61],[-8,14],[-6,35],[-4,14],[-10,15],[-13,29],[-22,76],[8,13],[9,9],[17,8],[5,3],[10,8],[7,9],[5,7],[6,12],[1,7],[1,8],[0,8],[-1,8],[-4,8],[-8,9],[-43,33],[-31,31],[-18,13],[-23,4],[-7,2],[-7,3],[-9,12],[-12,19],[-76,148],[-81,127],[-2,8],[-1,7],[0,17],[-3,63],[-2,15],[-4,13],[-9,9],[-14,12],[-126,63],[-13,9],[-14,13],[-14,17],[-11,24],[-31,44],[19,34],[50,44],[8,10],[7,11],[7,9],[4,4],[3,2],[14,9],[5,5],[11,16],[30,32],[7,11],[7,12],[2,7],[2,8],[0,11],[-6,14],[-40,54],[-46,47],[-8,17],[-3,31],[-2,7],[-3,6],[-3,5],[-5,4],[-8,1],[-10,-2],[-31,-26],[-8,-3],[-49,1],[-52,-12],[-18,-11]],[[1391,7966],[-1,0],[-17,22],[-25,10],[-49,6],[-15,16],[7,0],[8,18],[10,30],[0,18],[-2,15],[-4,14],[-7,13],[-7,6],[-24,11],[-11,10],[-8,15],[-28,108],[-4,33],[6,30],[45,77],[7,86],[-1,89],[20,84],[18,47],[5,39],[2,39],[6,44],[19,39],[24,35],[17,39],[-5,49],[14,1],[14,-2],[2,-1],[277,-102],[94,-7],[29,-7],[30,-13],[28,-17],[24,-23],[45,-46],[12,-25],[2,-42],[-13,-64],[5,-23],[29,-27],[29,-17],[14,4],[12,19],[23,25],[28,14],[25,-3],[25,-8],[28,-4],[96,27],[33,3],[244,-48],[63,-1],[114,79],[107,73],[91,43],[249,57],[241,118],[42,12],[27,19],[146,99],[101,41],[51,6],[99,-13],[285,-92],[75,-44],[159,-179]],[[3875,6123],[2,-34],[-5,-222],[-7,-33],[-16,-42],[-15,-29],[-36,-59],[-6,-13],[-7,-22],[-4,-16],[-2,-18],[0,-16],[8,-67],[-6,-9],[-10,-11],[-198,-96],[-25,-20],[-41,-42],[-6,-9],[-1,-4],[-2,-17],[-1,-3],[-1,-4],[-2,-2],[-9,-13],[-1,-3],[-8,-21],[-7,-14],[-1,-4],[-1,-4],[0,-4],[1,-16],[-1,-9],[-1,-8],[-1,-4],[-1,-3],[-1,-3],[-2,-3],[-3,-6],[-1,-3],[-2,-8],[-2,-6],[-2,-3],[-27,-34],[-4,-2],[-11,-5],[-5,-1],[-4,0],[-8,10],[-58,81],[-14,22],[-10,12],[-85,76],[-2,2],[-1,0],[-5,4],[-13,13],[-5,8],[-2,3],[-1,3],[-4,27],[-2,20],[-2,12],[-7,28],[-1,3],[-2,3],[-8,9],[-2,3],[-1,3],[-3,6],[0,4],[-3,6],[-5,8],[-7,11],[-2,2],[-5,4],[-3,1],[-6,3],[-30,0],[-8,1],[-7,2],[-5,3],[-5,4],[-2,2],[-17,23],[-10,8],[-10,7],[-3,2],[-4,0],[-6,0],[-125,-32],[-70,-27],[-20,-5],[-7,0],[-13,1],[-8,-3],[-11,-6],[-46,-36],[-30,-17],[-10,-8],[-6,-7],[-2,-3],[-2,-2],[-5,-13],[-2,-7],[-3,-28],[0,-52],[1,-8],[7,-23],[1,-8],[1,-4],[-1,-4],[0,-4],[-1,-3],[-3,-5],[-1,-2],[-2,-1],[-2,-2],[-5,-1],[-6,0],[-12,2],[-6,3],[-4,2],[-5,8],[-13,26],[-2,2],[-3,2],[-6,3],[-8,1],[-17,-1],[-11,2],[-9,0],[-20,-3],[-8,0],[-6,-2],[-7,-3],[-13,-10],[-10,-5],[-10,-3],[-14,1],[-11,4],[-15,11],[-3,2],[-3,1],[-5,-1],[-5,-4],[-8,-11],[-2,-7],[-1,-6],[0,-4],[0,-4],[-3,-2],[-5,-1],[-23,6],[-17,0],[-3,-1],[-4,-2],[-5,-3],[-4,-8],[-2,-5],[-4,-16],[-1,-3],[-2,-2],[-11,-12],[-2,-2],[-1,-3],[-2,-3],[-5,-26],[-3,-7],[-1,-3],[-2,-2],[-8,-10],[-9,-8],[-5,-1],[-6,0],[-18,5],[-13,7],[-5,3],[-2,2],[-4,6],[-5,12],[-6,16],[-2,3],[-2,3],[-4,4],[-5,4],[-5,3],[-6,3],[-4,0],[-8,0],[-8,-4],[-35,-25],[-10,-10],[-5,-6],[-2,-12],[-2,-3],[-3,0],[-12,7],[-13,5],[-2,2],[-5,4],[-8,5],[-3,2],[-3,1],[-4,0],[-7,0],[-5,-2],[-5,-5],[-16,-24],[-5,-2],[-7,-3],[-26,-2],[-13,-4],[-10,-8],[-74,-66],[-9,-5],[-32,-12],[-37,91],[-46,100],[-1,4],[-7,10],[-23,21],[-19,6],[-15,2],[-10,-2],[-9,-3],[-23,-16],[-6,-3],[-7,-1],[-14,0],[-9,-3],[-9,-4],[-20,-21],[-6,-2],[-47,-4],[-5,1],[-3,1],[-12,-1],[-13,-3],[-6,0],[-4,0],[-2,2],[-14,-6],[-119,-66],[-73,3],[-34,-8],[-18,-12],[-6,-3],[-3,-1],[-7,0],[-9,3],[-14,6],[-5,5],[-3,5],[0,9],[0,4],[-1,4],[-2,3],[-2,2],[-2,2],[-3,1],[-4,0],[-11,1],[-3,1],[-1,3],[-1,3],[0,4],[1,4],[1,3],[5,8],[4,6],[1,3],[0,4],[0,4],[-1,3],[-1,3],[-2,2],[-2,3],[-5,3],[-6,3],[-5,0],[-5,0],[-14,-4],[-3,-2],[-2,-1],[-2,-2],[-12,-17],[-12,-22],[-37,-45],[0,-15],[1,-13],[-1,-6],[-3,-6],[-8,-11],[-3,-7],[-1,-5],[0,-18],[-1,-3],[-2,-5],[-12,-14],[-3,-6],[-8,-2],[-5,-1],[-46,11],[-11,19],[-4,4],[-6,3],[-11,0],[-5,-1],[-4,-2],[-4,-4],[-17,-27],[-5,-4],[-2,-2],[-4,-1],[-6,4],[-7,9],[-13,22],[-7,8],[-4,4],[-3,1],[-3,1],[-3,1],[-1,4],[1,5],[9,13],[3,3],[4,3],[-1,6],[-10,18]],[[799,6869],[7,-14],[3,-5],[6,-5],[6,-4],[12,-4],[11,-2],[20,2],[18,7],[5,3],[6,3],[6,1],[6,0],[6,-2],[6,-5],[8,-12],[4,-8],[3,-9],[2,-6],[2,-7],[2,-6],[21,-7],[66,-2],[10,-7],[3,-26],[-10,-88],[-21,-107],[-3,-36],[12,-134],[-2,-11],[-3,-8],[-4,-4],[-1,-7],[0,-1],[33,-80],[7,-34],[10,-12],[32,-10],[53,27],[7,1],[10,-3],[26,-15],[5,-4],[4,-5],[5,-12],[4,-12],[3,-6],[3,-6],[4,-5],[4,-4],[7,-3],[7,-2],[15,-1],[29,2],[15,-2],[100,-30],[78,-3],[181,54],[7,0],[6,0],[7,-3],[5,-3],[45,-44],[6,-11],[3,-7],[6,-11],[4,-5],[5,-4],[16,-11],[4,-5],[2,-5],[4,-5],[6,-3],[10,0],[15,3],[11,1],[10,4],[9,7],[26,44],[33,35],[5,8],[13,24],[4,6],[5,2],[7,-1],[5,-4],[4,-6],[3,-5],[3,-6],[2,-7],[1,-7],[1,-15],[0,-9],[-1,-8],[-2,-8],[-15,-33],[-1,-8],[0,-7],[0,-8],[5,-28],[1,-8],[0,-24],[2,-7],[3,-6],[4,-4],[6,-4],[6,-3],[7,-1],[15,0],[33,4],[32,-1],[8,1],[8,4],[6,3],[5,6],[13,22],[8,12],[5,4],[5,4],[5,3],[6,1],[7,-1],[7,-2],[6,-2],[5,0],[2,6],[1,83],[-2,15],[-2,6],[-3,6],[-4,5],[-5,3],[-6,1],[-6,-1],[-5,-4],[-4,-4],[-3,-6],[-9,-19],[-4,-6],[-4,-5],[-5,-3],[-6,-2],[-7,0],[-7,1],[-7,2],[-5,4],[-4,5],[-1,7],[-1,8],[1,8],[4,14],[29,68],[8,15],[8,9],[20,13],[31,15],[10,7],[9,13],[37,72],[17,41],[4,10],[4,6],[29,17]],[[5288,5858],[151,-134],[48,-66],[95,-221],[5,-18],[0,-19],[-9,-115],[1,-21],[7,-18],[6,-12],[248,-386],[846,-1338],[1,0]],[[6687,3510],[-108,-72],[-166,-110],[-166,-111],[-166,-110],[-166,-111],[-167,-110],[-166,-111],[-166,-110],[-166,-111],[-166,-110],[-167,-111],[-166,-110],[-166,-111],[-368,-254],[-321,-226]],[[3896,1632],[-1,1],[-612,545],[-45,31],[-38,34],[-10,7],[-14,7],[-3,1],[-2,1],[-25,5],[-15,7],[-57,15],[-23,12],[-15,11],[-42,27],[-102,88],[-101,152],[-8,27],[-6,12],[-8,27],[-2,3],[-1,5],[-2,12],[-15,39],[-9,17],[-145,149],[-15,13],[-26,17],[-120,134],[-23,17],[-11,10],[-78,142],[-1,2],[-5,9],[-9,26],[-1,3],[-1,4],[-1,3],[-2,3],[-8,7],[-30,11],[-30,-4],[-16,0],[-7,2],[-15,6],[-146,93],[-1,1],[-1,0],[-9,5],[-17,14],[-52,52],[-6,13],[-4,7],[-3,2],[-7,6],[-2,2],[-4,9],[-3,6],[-1,4],[-15,28],[-2,7],[-12,19],[-2,3],[-8,18],[-23,38],[-10,22],[-8,13],[-27,31],[-23,37],[-20,23],[-34,45],[-5,9],[-1,3],[-18,30],[-9,8],[-7,1],[-11,-2],[-46,-15],[-52,-34],[-4,-1],[-13,1],[-107,15],[-26,17],[-8,1],[-35,0],[-24,-5],[-37,-23],[-30,-10]],[[1323,3765],[-8,19],[-37,40],[-9,29],[-8,37],[12,26],[14,22],[3,26],[-8,15],[-9,3],[-11,-1],[-11,5],[-16,19],[-33,51],[-7,15],[-4,16],[1,17],[5,10],[5,9],[5,14],[5,33],[1,22],[-8,17],[-24,19],[-11,-4],[-11,8],[-22,30],[-25,12],[-20,18],[-15,26],[-10,34],[-21,8],[-41,3],[-44,-2],[-29,-9],[-4,-2],[-4,0],[-4,0],[-4,2],[-5,8],[-15,31],[26,30],[41,24],[29,25],[7,32],[-2,29],[3,24],[22,15],[23,-7],[16,-14],[10,9],[6,63],[-36,-13],[-37,0],[-36,13],[-30,30],[-36,70],[-22,16],[-31,-24],[-5,-15],[-1,-39],[-5,-18],[-14,-17],[-15,-7],[-91,-6],[-9,4],[-18,14],[-7,4],[-10,-2],[-18,-12],[-6,-3],[-66,6]],[[649,7001],[4,1],[16,59],[9,140],[34,58],[48,19],[36,-11],[24,6],[13,71],[30,13],[59,-25],[32,12],[-4,56],[5,289],[2,29],[9,15],[12,14],[2,17],[-21,27],[17,19],[19,-24],[19,-15],[21,-7],[41,-6],[9,-3],[8,0],[13,6],[7,11],[2,15],[5,12],[17,7],[28,4],[114,-19],[28,0],[107,22],[9,16],[-2,45],[-5,28],[-11,33],[-14,31]],[[8393,6462],[-1,1],[-168,25],[-295,8],[-115,26],[-54,22],[-93,22],[-28,13],[-48,31],[-1126,1187],[-187,206],[-113,199],[-32,79]],[[5588,8737],[486,99],[322,130],[150,95],[54,20],[56,11],[56,28],[108,77],[198,142],[31,20],[32,13],[32,7],[35,2],[69,21],[201,119],[74,30],[282,45],[358,-77],[68,-29],[32,-10],[418,22],[626,157],[170,42],[66,42],[113,113],[75,106],[22,14],[28,23],[17,-22],[2,-23],[-3,-20],[2,-8],[20,-4],[46,-24],[8,5],[10,11],[10,9],[9,-3],[7,-11],[7,-20],[7,-10],[51,-44],[10,-6],[10,-25],[-27,-112],[17,-25],[12,-12],[3,-28],[1,-57],[10,-23],[11,-21],[9,-22],[0,-29],[-1,-1],[-46,-38],[-96,-97],[-1,0],[-155,-177],[-300,-343],[-203,-231],[-39,-36],[-41,-21],[-467,-106],[-97,-17],[-44,-22],[-31,-44],[0,-1],[-132,-277],[-13,-54],[-48,-501],[0,-33],[6,-34],[39,-98],[116,-272],[16,-64],[7,-66],[7,-274],[-9,-63],[-23,-60],[-51,-83]],[[8393,6462],[-71,-115],[-14,-60],[-13,-195],[-63,-246],[-15,-122],[1,-46],[9,-329],[13,-349],[-4,-52],[-13,-49],[-258,-547],[-54,-131],[-34,-54],[-44,-31],[-369,-109],[-220,-147],[-166,-110],[-166,-111],[-167,-110],[-58,-39]],[[2662,752],[-120,-85],[-257,-185],[-166,-120],[-230,-168],[-242,-187],[-19,-7],[-21,1],[-96,28],[-33,2],[-26,-18],[-54,46],[-206,29]],[[1192,88],[-1,12],[7,57],[1,5],[-5,96],[1,9],[10,39],[2,8],[1,16],[-2,8],[-3,9],[-15,26],[-21,27],[-7,12],[-1,5],[1,7],[8,20],[10,15],[1,3],[-2,12],[-17,31],[-25,-3],[-4,0],[-3,1],[-5,3],[-6,5],[-3,6],[-6,7],[-4,2],[-4,0],[-3,0],[-29,-5],[-23,0],[-25,5],[-2,4],[-1,5],[1,13],[2,7],[5,15],[1,7],[-1,6],[-9,23],[-1,9],[2,11],[3,4],[3,2],[19,7],[6,3],[2,1],[2,2],[8,11],[2,2],[5,4],[11,6],[4,4],[5,5],[1,2],[1,3],[4,15],[0,9],[-4,7],[-7,8],[-19,15],[-10,6],[-7,3],[-30,3],[-7,2],[-23,11],[-3,1],[-4,0],[-7,1],[-7,1],[-4,2],[-2,3],[-3,4],[-4,8],[-2,6],[-1,5],[-1,12],[0,9],[1,12],[4,10],[16,17],[-12,133],[0,32],[3,5],[1,2],[1,6],[-5,21],[-27,72],[-4,20],[-4,14],[-1,12],[0,5],[1,4],[2,6],[12,28],[1,4],[0,3],[0,5],[0,3],[-1,4],[-1,3],[-4,9],[-2,7],[-1,4],[0,5],[3,5],[6,7],[24,20],[18,12],[21,22],[46,40],[11,6],[16,4],[61,5],[88,-7],[8,1],[3,1],[1,3],[1,5],[-3,11],[-7,16],[-3,6],[0,4],[-1,4],[-2,47],[-2,7],[-1,3],[-2,3],[-2,2],[-3,2],[-3,1],[-4,0],[-7,-1],[-3,0],[-23,-10],[-2,0],[-3,0],[-3,1],[-3,1],[-2,2],[-2,2],[-4,5],[-1,3],[-1,4],[0,31],[-1,8],[-1,8],[-2,7],[-11,25],[-4,13],[-3,15],[0,5],[0,6],[2,11],[1,12],[0,5],[-1,7],[-3,11],[-1,3],[-1,5],[1,6],[1,9],[3,9],[5,9],[7,10],[9,9],[25,22],[7,1],[9,1],[42,-6],[12,3],[30,17]],[[1274,1758],[380,61],[2,-2],[14,-17],[7,-6],[12,-14],[13,-11],[44,-26],[5,-4],[16,-22],[7,-12],[1,-7],[3,-24],[3,-6],[3,-6],[53,-60],[3,-4],[2,-4],[3,-7],[4,-17],[1,-17],[1,-8],[2,-8],[1,-3],[1,-3],[4,-5],[31,-25],[5,-3],[26,-4],[9,0],[98,-24],[7,-5],[3,-2],[4,-5],[7,-6],[18,-12],[5,-4],[2,-2],[1,-3],[2,-3],[1,-3],[0,-3],[1,-4],[-1,-5],[-1,-7],[1,-12],[0,-2],[1,-3],[2,-5],[3,-6],[3,-5],[2,-2],[1,0],[2,-2],[4,-5],[2,-3],[2,-5],[1,-3],[2,-3],[1,-3],[1,-2],[4,-5],[3,-3],[3,-4],[3,-13],[76,-49],[20,-10],[2,0],[6,3],[2,1],[3,2],[4,5],[7,2],[43,-2],[24,-9],[10,-12],[7,-11],[3,-6],[2,-7],[4,-20],[7,-91],[1,-8],[1,-2],[1,-2],[4,-8],[204,-230],[74,-60],[13,-16],[25,-37],[1,-1]],[[3896,1632],[-128,-89],[-262,-184],[-191,-137],[-257,-186],[-258,-185],[-138,-99]],[[1274,1758],[-4,21],[-1,32],[-1,4],[-1,3],[0,4],[-3,6],[-2,3],[-51,66],[-3,6],[-3,6],[-6,25],[-3,6],[-2,6],[-3,4],[-2,3],[-6,6],[-6,0],[-5,-1],[-25,-19],[-8,-12],[-5,-6],[-74,-51],[-1,0],[0,-1],[-6,-4],[-45,-46],[-5,-8],[-1,-4],[-1,-3],[-1,-22],[-1,-4],[-1,-3],[-1,-3],[-2,-2],[-3,-3],[-3,-1],[-8,0],[-12,3],[-39,12],[-6,4],[-4,5],[-4,5],[-15,10],[-2,3],[-2,3],[-6,16],[-2,2],[-2,3],[-4,4],[-3,1],[-6,2],[-28,5],[-4,1],[-3,2],[-2,2],[-3,2],[-1,3],[-2,3],[0,3],[-2,21],[-1,3],[-1,3],[-2,3],[-2,2],[-3,2],[-16,10],[-2,2],[-5,4],[-7,10],[-12,23],[-2,3],[-2,2],[-3,2],[-2,1],[-5,-3],[-4,-7],[-8,-19],[-2,-8],[0,-7],[5,-22],[1,-8],[-1,-4],[0,-3],[-2,-8],[-2,-7],[-9,-17],[-6,-16],[-14,-8],[-63,-24],[-22,-13],[-7,-2],[-119,-11],[-3,-2],[-22,-22],[-9,-7],[-5,-3],[-10,-4],[-8,-1],[-29,0],[-10,3],[-5,8],[-9,19],[-6,6],[-4,3],[-33,15]],[[358,1779],[2,13],[1,10],[-1,30],[2,16],[0,9],[-1,4],[0,4],[-4,4],[-6,3],[-19,4],[-18,1],[-34,7],[-4,-1],[-3,-1],[-6,-2],[-2,-3],[-2,-2],[-1,-2],[-1,-3],[-2,-9],[-2,-6],[-2,-3],[-2,-3],[-3,1],[-4,5],[-9,24],[-2,7],[0,4],[-1,8],[1,9],[2,12],[3,11],[2,5],[1,4],[6,11],[8,10],[1,3],[0,3],[-16,12],[-62,36],[0,1]],[[180,2015],[-12,32],[-8,25],[0,26],[8,27],[15,22],[25,20],[12,15],[5,19],[-5,30]],[[220,2231],[28,18],[47,44],[24,64],[-21,40],[17,27],[36,12],[35,0],[29,14],[30,23],[24,30],[4,37],[-13,23],[-25,21],[-28,15],[-21,6],[-35,22],[-33,7],[-20,14],[6,43],[6,6],[19,9],[7,7],[4,20],[-4,36],[2,16],[11,18],[28,28],[9,23],[21,34],[49,47],[21,43],[14,21],[25,11],[27,9],[27,12],[53,37],[10,-7],[20,-26],[12,-9],[31,1],[24,16],[21,19],[23,9],[26,-5],[77,-42],[57,-15],[29,5],[18,26],[-3,41],[-26,18],[-59,11],[-44,38],[-10,13],[-9,19],[-3,7],[32,72],[21,36],[24,32],[59,58],[50,70],[32,18],[17,-2],[33,-13],[20,1],[25,13],[8,19],[3,23],[9,28],[29,41],[67,64],[35,64],[42,52],[0,2]],[[702,2394],[24,4],[36,-20],[-32,-37],[8,-20],[34,25],[91,-51],[28,-5],[6,24],[34,39],[14,44],[-3,37],[1,22],[-24,36],[-42,4],[-83,-28],[-45,-1],[-58,-36],[11,-37]],[[358,1779],[-12,-76],[-1,-21],[2,-3],[21,-17],[4,-4],[4,-7],[7,-16],[2,-8],[1,-5],[-19,-34],[-10,-25],[-2,-3],[-18,-125],[-1,-15],[8,-19],[17,-29],[0,-1],[8,-19],[7,-11],[6,-8],[3,-7],[9,-35],[2,-11],[1,-8],[-2,-3],[-2,-2],[-2,0],[-3,1],[-3,1],[-2,2],[-3,2],[-1,3],[-2,3],[-1,3],[-2,7],[-1,3],[-1,3],[-3,2],[-3,1],[-7,2],[-27,-2],[-4,-1],[-5,-3],[-6,-6],[-2,-5],[-1,-5],[1,-3],[2,-3],[4,-5],[2,-7],[2,-12],[5,-39],[-1,-9],[-1,-3],[-7,-13],[-45,-41],[-80,-82],[-11,-18]],[[185,1043],[0,1],[21,87],[45,97],[33,37],[17,41],[-38,36],[-32,14],[-19,177],[6,52],[33,4],[19,0],[0,14],[-9,0],[-5,8],[-3,8],[5,7],[8,5],[8,5],[7,5],[1,7],[0,21],[0,32],[-5,11],[-3,11],[-8,6],[-6,2],[-9,-8],[-4,0],[-4,5],[-4,11],[0,9],[10,11],[0,8],[-5,11],[-17,23],[-12,20],[-7,23],[-11,63],[-1,8],[-4,6],[-8,6],[-15,0],[-14,2],[-10,1],[-1,8],[4,3],[7,5],[10,4],[11,10],[7,17],[1,19],[-4,17],[0,2]],[[1192,88],[-55,7],[-24,17],[-85,10],[-29,10],[-23,14],[-132,141],[-97,75],[-49,55],[-16,11],[-8,-3],[-17,-18],[-7,-4],[-9,2],[-16,7],[-9,1],[-56,-8],[-21,0],[-18,1],[-6,2],[0,8],[-8,23],[-68,116],[-14,33],[-1,38],[4,34],[-7,22],[-35,3],[-22,-4],[-15,6],[-14,14],[-13,19],[5,-1],[5,8],[2,13],[-2,14],[-6,3],[-19,0],[-8,3],[-26,29],[-14,9],[-162,43],[-13,19],[0,1],[-7,5],[-7,2]],[[70,868],[32,52],[25,17],[11,8],[10,18],[31,52],[9,17],[-3,11]],[[70,868],[-9,-2],[-10,-6],[40,68],[76,99],[11,51],[-6,25],[18,60],[26,49],[10,4],[21,45],[-35,65],[-8,25],[-20,190],[5,26],[-57,27],[0,29],[17,30],[16,39],[-5,58],[-33,23],[-6,93],[-43,33],[-10,16],[50,79],[-57,44],[33,17],[11,14],[25,20],[4,26],[4,11],[3,33],[8,12],[-2,11],[36,24],[37,25]]],"transform":{"scale":[0.0006654451666166578,0.0005012365860586113],"translate":[35.723399285000085,32.313041687000066]}};
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
