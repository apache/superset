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
  Datamap.prototype.tunTopo = {"type":"Topology","objects":{"tun":{"type":"GeometryCollection","geometries":[{"type":"MultiPolygon","properties":{"name":null},"id":"-99","arcs":[[[0]],[[1]]]},{"type":"Polygon","properties":{"name":"Tozeur"},"id":"TN.TO","arcs":[[2,3,4]]},{"type":"Polygon","properties":{"name":"Manubah"},"id":"TN.MN","arcs":[[5,6,7,8,9,10]]},{"type":"Polygon","properties":{"name":"Béja"},"id":"TN.BJ","arcs":[[-9,11,12,13,14,15]]},{"type":"Polygon","properties":{"name":"Ben Arous (Tunis Sud)"},"id":"TN.BA","arcs":[[16,17,-7,18,19]]},{"type":"Polygon","properties":{"name":"Bizerte"},"id":"TN.BZ","arcs":[[-10,-16,20]]},{"type":"Polygon","properties":{"name":"Jendouba"},"id":"TN.JE","arcs":[[21,22,23,-14]]},{"type":"Polygon","properties":{"name":"Nabeul"},"id":"TN.NB","arcs":[[24,25,-17,26]]},{"type":"Polygon","properties":{"name":"Tunis"},"id":"TN.TU","arcs":[[-19,-6,27]]},{"type":"Polygon","properties":{"name":"Le Kef"},"id":"TN.KF","arcs":[[28,29,-23,30]]},{"type":"Polygon","properties":{"name":"Kassérine"},"id":"TN.KS","arcs":[[31,32,33,34,-29]]},{"type":"Polygon","properties":{"name":"Gabès"},"id":"TN.GB","arcs":[[35,36,37,38,39,40]]},{"type":"Polygon","properties":{"name":"Gafsa"},"id":"TN.GF","arcs":[[-40,41,-5,42,-34,43]]},{"type":"Polygon","properties":{"name":"Sidi Bou Zid"},"id":"TN.SZ","arcs":[[44,45,-41,-44,-33,46]]},{"type":"MultiPolygon","properties":{"name":"Sfax"},"id":"TN.SF","arcs":[[[47]],[[48]],[[49,-36,-46,50,51]]]},{"type":"Polygon","properties":{"name":"Siliana"},"id":"TN.SL","arcs":[[-13,52,53,-47,-32,-31,-22]]},{"type":"Polygon","properties":{"name":"Mahdia"},"id":"TN.MH","arcs":[[54,55,-52,56,57]]},{"type":"Polygon","properties":{"name":"Monastir"},"id":"TN.MS","arcs":[[-55,58,59]]},{"type":"Polygon","properties":{"name":"Kairouan"},"id":"TN.KR","arcs":[[-57,-51,-45,-54,60,61]]},{"type":"Polygon","properties":{"name":"Sousse"},"id":"TN.SS","arcs":[[62,-59,-58,-62,63,-25]]},{"type":"Polygon","properties":{"name":"Zaghouan"},"id":"TN.ZA","arcs":[[-18,-26,-64,-61,-53,-12,-8]]},{"type":"MultiPolygon","properties":{"name":"Médenine"},"id":"TN.ME","arcs":[[[64,65,-38,66]],[[67]]]},{"type":"Polygon","properties":{"name":"Kebili"},"id":"TN.KB","arcs":[[-66,68,69,-3,-42,-39]]},{"type":"Polygon","properties":{"name":"Tataouine"},"id":"TN.TA","arcs":[[70,-69,-65]]}]}},"arcs":[[[8161,9436],[23,-17],[-16,-1],[-24,2],[-8,-1],[-1,1],[-17,-1],[-13,12],[8,6],[13,5],[3,4],[13,3],[7,-6],[12,-7]],[[3617,9983],[3,-16],[-21,-2],[-31,5],[-27,-5],[-26,-7],[-37,8],[26,10],[31,8],[39,6],[16,9],[10,-1],[7,-4],[0,-6],[10,-5]],[[2912,5280],[-197,-165],[-134,-77],[-1508,-567],[-473,-109],[-41,-12]],[[559,4350],[0,6],[-37,53],[-187,153],[-156,127],[-21,35],[-25,71],[-70,64],[-17,23],[-34,75],[-12,54],[51,137],[7,100],[34,37],[53,26],[99,48],[60,36],[67,33],[95,22],[156,11],[46,12],[31,17],[22,22],[92,162],[48,48],[96,32],[212,43],[102,34],[233,49],[20,9]],[[1524,5889],[11,-5],[19,-25],[1,-14],[-40,-71],[0,-10],[5,-8],[86,-39],[10,-6],[11,-11],[-1,-6],[-7,-4],[-12,-3],[-118,-7],[-11,-1],[-11,-2],[-11,-5],[-87,-49],[-13,-10],[-15,-14],[1,-8],[7,-5],[180,-56],[45,-19],[21,-11],[37,-24],[29,-25],[20,-13],[11,-5],[11,-3],[11,-2],[91,-4],[184,-30],[15,-3],[42,-15],[32,-16],[10,-7],[6,-6],[10,-20],[22,-32],[12,-9],[11,-5],[537,15],[93,-3],[133,-13]],[[6995,9109],[-11,-3],[-344,-50],[-304,-74],[-103,-19],[-46,-11],[-22,-7],[-2,-5],[4,-4],[5,-3],[8,-3],[19,-6],[8,-3],[4,-3],[2,-6],[2,-5],[3,-5],[6,-5],[9,-5],[44,-14],[21,-9],[7,-5],[5,-5],[2,-7],[-1,-5],[-7,-14]],[[6304,8833],[-122,-56],[-45,-15],[-37,-4]],[[6100,8758],[-10,10],[-7,4],[-9,5],[-9,2],[-10,1],[-10,0],[-21,-2],[-13,-5],[-15,-7],[-40,-33],[-40,-43],[-24,-10],[-74,-10]],[[5818,8670],[-26,25],[-96,64],[-80,75],[-18,22],[-5,11],[-5,5],[-8,4],[-14,3],[-65,3],[-139,21],[-286,121]],[[5076,9024],[97,37],[213,43],[128,14],[24,5],[16,5],[29,24],[33,17],[43,17],[23,7],[17,4],[90,3],[49,-3],[47,-7],[130,-27],[17,-2],[36,-1],[32,0],[21,4],[14,4],[8,4],[7,5],[4,4],[19,23],[39,34],[20,13],[85,79],[16,20],[6,5],[8,6],[21,12],[16,11],[24,14],[18,6],[17,4],[128,6],[117,18],[16,1]],[[6704,9433],[22,-15],[8,-13],[-15,-17],[-17,20],[-105,-47],[19,-67],[93,-69],[112,-52],[91,-19],[26,-9],[57,-36]],[[5818,8670],[-145,-55],[-45,-22],[-10,-10],[-5,-8],[-72,-47],[-30,-33]],[[5511,8495],[-148,-7],[-54,-6],[-40,-7],[-106,-26],[-22,-4],[-20,-2],[-13,1],[-16,2],[-22,5],[-15,6],[-55,25],[-22,7],[-33,8],[-23,4],[-30,0],[-141,-4],[-73,-6],[-22,-5],[-20,-7],[-9,-4],[-29,-19],[-98,-79],[-20,-2],[-30,3],[-127,31],[-44,14],[-16,3],[-19,2],[-33,0],[-35,-3],[-142,-23],[-25,-2],[-59,18],[-200,86]],[[3750,8504],[46,12],[12,4],[9,4],[5,5],[1,5],[3,40],[4,12],[4,5],[5,5],[16,10],[39,20],[8,5],[-3,16],[-14,25],[-82,99],[-19,11],[-10,8],[-7,9],[-5,25],[16,69],[-1,6],[-4,6],[-14,7],[-23,9],[-26,7],[-11,2],[-140,11],[-13,2],[-13,4],[-12,4],[-9,5],[-4,6],[5,8],[6,6],[7,6],[4,6],[4,8],[1,12],[3,8],[5,6],[6,5],[10,5],[90,33],[10,5],[6,5],[-2,9],[-9,12],[-47,34],[-92,47],[-7,6],[-4,7],[7,10],[8,4],[10,2],[6,1],[45,8],[9,3],[-16,14],[-105,50],[-1,1]],[[3467,9283],[19,4],[54,23],[76,42],[75,65],[33,9],[24,6],[68,33],[26,7],[74,13]],[[3916,9485],[4,-6],[5,-47],[-4,-21],[-14,-29],[-3,-19],[2,-8],[5,-8],[10,-12],[11,-6],[12,-4],[11,-1],[152,2],[16,-3],[17,-5],[31,-12],[14,-7],[11,-7],[9,-11],[23,-34],[59,-58],[32,-39],[13,-10],[12,-8],[81,-34],[23,-7],[23,-5],[88,-13],[29,-9],[25,-9],[8,-7],[6,-6],[0,-6],[-2,-11],[-3,-9],[-5,-8],[-9,-12],[-5,-6],[-5,-6],[-5,-5],[-14,-18],[1,-8],[6,-13],[19,-25],[15,-13],[14,-8],[32,-10],[12,-2],[22,-2],[10,0],[11,1],[12,1],[11,3],[23,8],[236,111],[22,9],[24,6],[27,5]],[[7190,8887],[-3,-7],[-54,-86],[-93,-84],[-5,-13],[5,-10],[10,-33],[-45,-121]],[[7005,8533],[-57,-3],[-22,-2],[-23,-4],[-91,-24],[-10,-4],[-14,0],[-13,2],[-20,14],[-6,8],[-2,7],[3,5],[2,5],[-21,13],[-222,92],[-7,6],[-67,22],[-98,21],[-43,7],[-29,2],[-25,-5],[-21,-2],[-14,1],[-15,4],[-26,11],[-15,8],[-49,41]],[[6304,8833],[28,-4],[25,-2],[33,0],[55,4],[13,4],[15,6],[37,21],[14,6],[19,1],[39,-3],[22,0],[29,2],[16,1],[17,2],[21,6],[32,15],[33,12],[15,13],[30,48],[-6,7]],[[6791,8972],[8,3],[37,30],[53,-52],[64,-40],[87,-24],[116,-6],[34,4]],[[3916,9485],[195,36],[30,8],[52,37],[44,11],[323,2],[94,16],[59,29],[35,10],[33,-6],[25,-7],[27,3],[26,5],[72,8],[57,12],[52,15],[35,16],[50,-13],[45,4],[90,28],[51,12],[42,5],[108,1],[54,9],[30,3],[25,-7],[20,-9],[25,-4],[209,-3],[1,-4],[5,-13],[1,-61],[-76,-28],[-93,-18],[-51,-33],[8,-11],[38,-37],[13,-8],[14,-5],[15,-19],[20,-4],[107,-7],[50,4],[54,20],[30,19],[27,25],[-1,22],[-156,29],[-24,-2],[-50,-7],[-28,0],[0,9],[60,18],[23,3],[15,6],[11,7],[8,4],[37,2],[238,-24],[44,2],[131,26],[21,-2],[39,-27],[173,-12],[79,-32],[182,-29],[47,-18],[-78,-9],[-37,-7],[-34,-11],[-13,22],[-68,4],[-79,-9],[-44,-17],[18,-22],[64,-11],[75,-2],[47,6],[17,-12]],[[3750,8504],[-39,5],[-41,2],[-47,-4],[-104,-18]],[[3519,8489],[-213,-33],[-585,-13],[-22,-2],[-93,-16],[-220,-51],[-50,-1],[-153,6],[-39,-2]],[[2144,8377],[6,19],[4,56],[-5,26],[-21,25],[-37,11],[-47,6],[-47,11],[-212,12],[-101,19],[5,47],[58,31],[71,21],[158,26],[296,81],[55,28],[56,48],[21,48],[-49,28],[-86,20],[16,22],[75,16],[95,5],[92,-2],[84,7],[170,31],[44,14],[2,17],[-84,58],[-9,14],[2,16],[-8,36],[1,0],[45,9],[174,32],[60,5],[209,0],[55,9],[101,38],[74,16]],[[7466,8369],[-13,12],[-13,13],[-5,3],[-5,2],[-8,3],[-14,0],[-19,-2],[-32,-7],[-18,-5],[-17,-3],[-16,0],[-25,6],[-16,5],[-49,5],[-71,-6],[-80,-6]],[[7065,8389],[-15,1],[-8,1],[-11,3],[-10,4],[-8,5],[-6,6],[-7,28],[5,96]],[[7190,8887],[50,-1],[124,29],[76,8],[47,22],[20,38],[16,32],[35,55],[44,18],[52,4],[113,-3],[103,9],[95,17],[122,39],[76,35],[22,5],[9,13],[8,7],[141,51],[20,11],[6,15],[-9,10],[-4,9],[22,14],[53,11],[124,6],[94,32],[51,4],[43,-10],[23,-25],[-4,-11],[-25,-17],[-6,-14],[5,-15],[24,-20],[6,-12],[9,-10],[42,-28],[16,-14],[5,-13],[5,-29],[6,-14],[12,-10],[16,-13],[18,-10],[13,-4],[14,-7],[29,-21],[-13,-23],[-34,-21],[-98,-18],[-134,-51],[-72,-60],[-105,-69],[-172,-144],[-132,-148],[-63,-38],[-203,-24],[-236,-61],[-86,11],[-84,-28],[-53,-37]],[[6995,9109],[25,-16],[-13,-16],[-56,-25],[-24,-28],[-26,-11],[-33,-2],[-32,12],[18,21],[-23,6],[-42,-3],[-79,-12],[-24,-8],[-42,-27],[-13,-20],[35,-7],[77,-1],[32,-7],[16,7]],[[3727,7484],[-121,4],[-421,81],[-200,26],[-23,1],[-21,-4],[-26,-7],[-56,-20],[-23,-10],[-15,-8],[-6,-5],[-10,-11],[-8,-13],[-5,-12],[-11,-56],[-6,-18],[-7,-9],[-12,-9],[-8,-4],[-52,-3],[-113,3],[-28,4],[-107,26],[-12,2],[-12,1],[-21,0],[-22,-3],[-28,-8],[-87,-30],[-43,-18],[-31,-6],[-73,-3],[-44,-3]],[[2075,7372],[-9,42],[-42,45],[-120,89],[-29,48],[-10,58],[14,109],[52,86],[9,16],[8,75],[52,101],[27,22],[23,26],[-7,25],[-18,25],[-11,27],[11,57],[116,147],[3,7]],[[3519,8489],[114,-78],[30,-29],[3,-6],[1,-10],[-3,-11],[-4,-5],[-12,-10],[-8,-5],[-8,-8],[-5,-9],[-2,-18],[3,-10],[5,-8],[25,-19],[63,-35],[48,-36],[10,-10],[7,-9],[3,-11],[0,-20],[-5,-28],[1,-10],[4,-18],[8,-10],[10,-7],[33,-10],[150,-35],[18,-8],[21,-12],[39,-27],[14,-14],[7,-11],[-2,-25],[-14,-37],[-17,-30],[-13,-15],[-14,-10],[-58,-30],[-35,-24],[-10,-10],[-8,-20],[-6,-12],[-9,-11],[-7,-6],[-8,-5],[-87,-34],[-9,-4],[-8,-7],[-3,-4],[-3,-5],[-3,-11],[0,-54],[-10,-51],[-4,-10],[-34,-53]],[[3727,7484],[151,-98],[47,-24],[10,-2],[10,0],[12,0],[11,1],[33,7],[11,1],[11,1],[10,-1],[96,-20],[24,-7],[15,-7],[29,-31],[18,-14],[14,-5],[14,-4],[61,-5],[51,-11],[88,-25],[20,-7],[19,-10],[14,-9],[17,-15],[6,-10],[3,-9]],[[4522,7180],[-6,-24],[-9,-19],[-10,-9],[-13,-9],[-28,-14],[-33,-14],[-84,-23],[-25,-8],[-21,-10],[-10,-7],[-9,-9],[-28,-38],[-8,-6],[-13,-8],[-38,-15],[-24,-7],[-13,-7],[-14,-9],[-38,-44],[-12,-20],[-2,-6],[0,-5],[0,-5],[2,-5],[3,-4],[4,-3],[7,-4],[21,-6],[8,-3],[184,-26],[26,-6],[11,-4],[8,-5],[7,-5],[4,-6],[2,-6],[-1,-15],[-21,-57],[-1,-17],[3,-24],[5,-14],[10,-13],[21,-22],[2,-4],[2,-3],[0,-4],[-1,-5],[-2,-4],[-3,-5],[-10,-6],[-19,-8],[-63,-17],[-123,-17],[-96,-23],[-5,-1],[-8,0],[-21,1],[-41,5],[-14,-2],[-15,-6],[-23,-16],[-18,-16],[-4,-5],[-20,-19],[-15,-11],[-80,-42],[-15,-10],[-8,-9],[3,-5],[5,-6],[8,-5],[9,-5],[10,-4],[34,-9],[9,-4],[3,-4],[-22,-9],[-600,-159]],[[3246,6182],[-72,-18],[-46,-8],[-111,-7],[-21,-3],[-250,-58],[-25,-8],[-21,-9],[-6,-4],[-4,-5],[-14,-25],[-8,-10],[-21,0],[-34,6],[-170,45],[-34,12],[-268,40],[-49,13],[-30,12],[-35,8],[-90,5],[-30,1]],[[1907,6169],[19,12],[7,19],[-46,138],[-4,51],[25,53],[58,73],[43,100],[32,49],[116,58],[148,104],[24,27],[-84,30],[-102,15],[-92,20],[-57,49],[-16,56],[5,50],[27,48],[88,97],[1,40],[-24,114]],[[5469,5496],[29,-22],[21,-9],[23,-6],[42,-7],[29,-3],[11,0],[54,2],[43,4],[22,2],[41,-1],[22,-3],[18,-5],[19,-11],[30,-22],[38,-17],[46,-16],[43,-10],[55,-4],[20,0],[13,2],[10,4],[4,4],[1,5],[-1,16],[2,7],[4,5],[10,6],[9,0],[7,0],[8,-3],[52,-22]],[[6194,5392],[-11,-3],[23,-24],[9,-27],[-1,-57],[8,-25],[36,-53],[8,-25],[23,-45],[55,-51],[225,-150],[24,-11],[34,-9],[351,-163],[92,-25],[192,-40],[34,-3]],[[7296,4681],[-7,-3],[-52,-18],[-153,-88],[-17,-12],[-10,-11],[-136,-101],[-52,-49],[-17,-9],[-14,-4],[-163,-23],[-78,-16],[-282,-109],[-27,-5],[-181,-19],[-73,-15],[-20,-2],[-43,-1],[-134,6],[-45,-4],[-103,-15],[-23,-2],[-22,1],[-65,4],[-44,1]],[[5535,4187],[-99,49],[-33,21],[-98,86],[-33,22],[-193,83],[-8,8],[-5,8],[0,12],[4,8],[6,7],[58,43],[5,5],[16,20],[6,10],[1,6],[-3,7],[-9,8],[-21,15],[-117,57],[-12,3],[-11,2],[-11,-1],[-33,-3],[-12,0],[-11,2],[-11,2],[-11,4],[-9,5],[-8,5],[-34,29],[-15,11],[-9,5],[-22,8],[-25,6],[-108,21],[-10,3],[-10,5],[-8,4],[-129,105],[-65,65],[-39,49],[-30,51],[-20,61],[-3,59],[15,55],[6,9],[11,10],[8,4],[10,5],[44,18],[93,32],[43,20],[7,4],[4,5],[-3,6],[-10,6],[-112,31],[-13,6],[-42,21],[-24,17],[-16,24]],[[4377,5436],[151,30],[51,6],[276,-16],[25,0],[19,2],[101,25],[45,7],[44,11]],[[5089,5501],[73,28],[32,9],[98,16],[26,1],[19,1],[23,-5],[49,-14],[23,-9],[9,-5],[8,-5],[11,-11],[9,-11]],[[4377,5436],[-326,-25],[-38,2],[-43,6],[-22,-2],[-96,-17],[-54,-12],[-11,-5],[-8,-5],[-6,-5],[-5,-5],[-3,-5],[-3,-10],[-1,-30],[-2,-5],[-5,-6],[-7,-5],[-9,-4],[-8,-3],[-8,-1],[-16,-1],[-153,8],[-95,11],[-17,0],[-22,-1],[-86,-18],[-421,-18]],[[1524,5889],[101,41],[58,17],[19,9],[11,9],[17,24],[16,11],[88,26],[18,15],[-63,46],[7,21],[29,21],[79,38],[3,2]],[[3246,6182],[396,-73],[236,-1],[252,-21],[151,-37],[19,-4],[15,-1],[11,1],[21,3],[34,8],[17,3],[23,2],[11,-2],[7,-5],[1,-5],[-3,-6],[-58,-69],[-5,-10],[-1,-5],[-1,-6],[2,-7],[4,-11],[15,-18],[9,-8],[28,-17],[51,-26],[66,-26],[23,-7],[17,-5],[155,-26],[19,-6],[21,-11],[36,-26],[15,-8],[20,-9],[63,-23],[17,-5],[116,-26],[28,-9],[17,-8],[3,-5],[3,-5],[-11,-161]],[[4834,7190],[66,-40],[19,-17],[0,-5],[0,-4],[-12,-43],[-11,-16],[-15,-42],[0,-4],[2,-4],[3,-5],[7,-5],[11,-7],[184,-79],[17,-4],[43,-4],[26,-1],[24,0],[11,2],[14,-1],[15,-3],[151,-72],[7,-5],[21,-20],[6,-4],[9,-6],[23,-11],[19,-6],[23,-6],[69,-12],[180,-16],[219,-32],[12,-2],[12,0],[11,1],[121,20],[15,-4],[15,-11],[86,-139],[13,-11],[46,-30]],[[6296,6542],[-191,-197],[-281,-214],[-55,-54],[-17,-20],[-7,-12],[-6,-19],[0,-14],[14,-28],[4,-4],[5,-5],[6,-3],[9,-2],[265,-14],[52,-7],[199,-46],[10,-4],[12,-7],[3,-6],[0,-6],[-8,-24],[-13,-24],[-7,-8],[-7,-7],[-8,-4],[-9,-5],[-10,-4],[-117,-28],[-22,-8],[-37,-20],[-11,-4],[-12,-2],[-11,-1],[-55,0],[-23,-1],[-11,-1],[-20,-5],[-16,-5],[-91,-37],[-23,-7],[-48,-12],[-147,-23],[-68,-17],[-31,-14],[-23,-12],[-9,-8],[-3,-7],[5,-4],[9,-5],[41,-16],[16,-11],[13,-10],[17,-19],[5,-8],[3,-8],[3,-15],[-5,-8],[-8,-5],[-10,-2],[-10,-1],[-10,0],[-10,1],[-20,3],[-48,12]],[[4522,7180],[130,17],[46,0],[136,-7]],[[8853,6040],[-99,-36],[-47,5],[-48,11],[-81,19],[-48,14],[24,9],[32,12],[280,-1],[23,-16],[-36,-17]],[[9305,6199],[59,-29],[-19,-18],[-238,-47],[-124,-34],[-45,-9],[-21,24],[34,18],[41,18],[44,30],[6,19],[-2,8],[2,13],[19,5],[5,-13],[37,-11],[59,5],[5,30],[-17,16],[19,19],[29,12],[20,15],[22,15],[41,-11],[70,-5],[12,-13],[-64,-10],[-9,-8],[-15,-9],[-6,-16],[22,-4],[14,-10]],[[8657,6650],[16,-39],[-11,-42],[-82,-47],[-95,-22],[-69,-36],[18,-31],[-20,-29],[-1,-54],[-100,-34],[-21,-10],[-16,-6],[-10,-9],[27,-27],[10,-18],[-89,-19],[-58,-20],[-79,-40],[-38,-36],[-48,-20],[-23,-25],[-42,-22],[-40,-12],[-163,-24],[-23,-7],[-9,-9],[-4,-14],[-12,-17],[-18,-14],[-4,-27],[-17,-15],[-5,-25],[-37,-16],[-55,-13],[-228,-16],[-84,-21],[-130,-100],[-118,-14],[-25,1],[-22,4],[-28,2],[-29,-5],[-15,-7],[-10,-9],[-52,-32],[-23,-10],[-32,-4],[-116,-23],[-49,-18],[-98,-18],[-60,-30],[-30,-42],[-88,-82],[-52,-39],[-34,-6],[-21,-10],[-1,0]],[[6296,6542],[19,17],[47,33],[128,68],[96,39],[52,16],[31,5],[61,3]],[[6730,6723],[282,-22],[20,-3],[12,-3],[69,-23],[20,-4],[14,-1],[19,0],[34,4],[272,59],[48,16],[41,18],[9,6],[5,4],[2,3],[1,3],[-2,9],[1,5],[2,6],[5,4],[7,4],[45,13],[11,4],[7,4],[5,5],[6,10],[5,4],[7,3],[9,2],[11,1],[218,-29],[31,-1],[24,7],[12,4],[11,5],[9,5],[16,11],[38,38],[11,1],[16,-4],[29,-16],[15,-12],[9,-9],[19,-48],[9,-15],[33,-42],[13,-11],[14,-6],[18,-4],[35,-1],[19,2],[14,4],[31,20],[10,4],[13,1],[17,-4],[28,-15],[26,-16],[68,-54],[35,-9],[115,-10],[4,0]],[[5511,8495],[35,-30],[11,-26],[-1,-9],[-2,-8],[-26,-35],[-19,-16],[-33,-21],[-50,-26],[-48,-21],[-160,-45],[-60,-11],[-13,-3],[-19,-8],[-4,-7],[3,-6],[9,-5],[89,-39],[25,-9],[27,-7],[110,-13],[121,-20],[23,-7],[10,-4],[11,-9],[9,-14],[13,-30],[4,-14],[0,-10],[-6,-12],[-8,-10],[-13,-11],[-45,-28]],[[5504,7981],[-534,-200],[-33,-17],[-18,-12],[0,-6],[1,-5],[18,-33],[3,-11],[1,-12],[-2,-11],[-3,-6],[-36,-42],[-3,-11],[2,-10],[2,-4],[3,-4],[4,-4],[14,-11],[19,-10],[16,-8],[8,-5],[5,-7],[-1,-12],[-8,-6],[-9,-3],[-62,-6],[-46,-9],[-103,-30],[-26,-4],[-26,-1],[-26,0],[-31,3],[-170,26],[-16,0],[-18,-2],[-27,-6],[-10,-6],[-4,-6],[3,-6],[5,-5],[5,-5],[329,-183],[97,-85],[3,-4],[4,-12]],[[7641,7209],[285,-43],[167,-15],[92,-2],[25,1],[17,2],[7,4],[20,22],[27,20],[21,11],[38,16],[54,18],[55,15],[203,34]],[[8652,7292],[2,-10],[23,-30],[37,-20],[112,-16],[-67,-28],[-17,-37],[-13,-34],[10,-59],[-30,-28],[12,-50],[58,-43],[87,-50],[51,-18],[61,-13],[34,-8],[-4,-26],[-69,-1],[-48,-17],[-47,-44],[-72,-27],[-35,-31],[-33,-33],[-47,-19]],[[6730,6723],[4,52],[-3,18],[-4,5],[-10,11],[-58,39],[-11,9],[-6,9],[-2,5],[0,3],[0,13],[7,37],[-1,14],[-6,22],[-5,10],[-8,9],[-19,19],[-9,11],[-3,5],[5,10],[10,16],[75,86],[28,20],[51,29],[11,10],[2,10],[-2,11],[-37,45],[-1,5],[3,7],[7,6],[15,11],[48,14],[107,16]],[[6918,7310],[-18,-32],[-3,-11],[1,-7],[3,-7],[6,-7],[9,-5],[10,-5],[58,-20],[29,-16],[13,-3],[17,-2],[78,9],[22,-1],[87,-11],[14,-3],[11,-4],[9,-5],[7,-6],[5,-8],[4,-25],[4,-7],[8,-6],[12,-4],[142,-29],[15,-1],[14,0],[14,3],[12,6],[12,9],[12,15],[8,7],[10,7],[60,15],[11,8],[5,4],[22,41]],[[7641,7209],[-22,10],[-58,10],[-15,1],[-13,-2],[-9,-3],[-7,-5],[-3,-3],[-9,-13],[-5,-5],[-14,-10],[-16,-5],[-19,-1],[-50,2],[-10,1],[-11,3],[-11,3],[-10,4],[-7,5],[-7,6],[-1,2],[0,9],[4,15],[6,7],[10,4],[78,15],[22,7],[9,6],[6,6],[-1,10],[-6,6],[-23,15],[0,6],[7,5],[21,8],[14,3],[14,2],[54,6],[88,14],[39,11],[20,8],[12,10],[10,14],[16,45],[0,10],[-8,42],[-1,26],[1,6],[23,20],[97,54],[6,3]],[[7862,7602],[6,-2],[47,-12],[75,-13],[147,24],[25,-3],[23,-6],[45,-19],[-27,-19],[-15,-27],[13,-27],[28,-20],[99,-22],[221,-39],[98,5],[71,-27],[35,-32],[-93,-17],[-13,-32],[5,-22]],[[5504,7981],[52,-9],[23,-2],[50,-1],[217,14],[87,1],[77,-22],[22,-4],[97,-8],[13,-3],[22,-5],[17,-7],[66,-30],[12,-3],[15,1],[15,4],[19,14],[8,10],[5,7],[16,49],[7,13],[5,4],[8,2],[9,-5],[18,-10],[15,-1],[19,4],[35,16],[15,9],[21,18],[41,13],[145,22]],[[6675,8072],[-80,-67],[1,-21],[135,-32],[13,-6],[14,-9],[22,-19],[8,-10],[3,-10],[-23,-62],[-28,-51],[-17,-21],[-4,-4],[-27,-19],[-115,-67],[-13,-10],[-4,-5],[1,-6],[6,-10],[278,-255],[24,-16],[19,-17],[30,-45]],[[7466,8369],[-25,-18],[-35,-52],[-34,-56],[-29,-57],[-6,-70],[-5,-72],[12,-46],[31,-46],[18,-25],[12,-9],[11,-13],[14,-30],[9,-13],[54,-37],[39,-20],[34,-9],[29,-13],[65,-90],[33,-18],[169,-73]],[[6675,8072],[65,12],[23,6],[22,8],[8,4],[11,8],[10,12],[12,22],[4,12],[0,9],[-12,17],[1,5],[6,6],[17,4],[13,3],[176,16],[9,5],[5,8],[-8,14],[-11,9],[-12,7],[-6,5],[1,5],[14,7],[34,12],[9,22],[-1,79]],[[9064,2780],[1,1],[159,140],[41,23],[42,18],[45,16],[48,13],[116,21],[38,9],[89,30],[21,11],[16,10],[6,6],[3,5],[-4,6],[-11,3],[-21,1],[-70,-6],[-18,0],[-17,4],[-23,6],[-644,251],[-8,6],[-4,5],[0,5],[2,6],[23,42],[3,17],[-10,118],[3,11],[4,10],[32,40],[13,22],[8,24],[0,9],[-1,5],[-6,9],[-5,5],[-7,5],[-13,5],[-16,5],[-30,8],[-31,10],[-104,45],[-19,10],[-15,11],[-7,7],[-32,64],[-3,3],[-5,4],[-7,4],[-11,5],[-13,5],[-678,149],[-53,6],[-113,6],[-43,7],[-23,6],[-24,9],[-10,5],[-7,4],[-5,5],[0,5],[3,5],[7,4],[49,8],[7,4],[3,5],[1,5],[3,5],[19,14],[5,5],[1,4],[-1,5],[-7,5],[-24,1],[-189,-11],[-86,6],[-22,-1],[-20,-3],[-429,-89],[-33,-10],[-167,-34],[-23,-7],[-16,-11],[-12,-4],[-16,-2],[-30,0],[-125,11],[-45,2],[-15,-2],[-18,-4],[-30,-10],[-17,-7],[-13,-6],[-50,-34],[-9,-5],[-10,-3],[-83,-17],[-61,-7],[-53,-4],[-212,-2]],[[5948,3891],[35,38],[6,9],[4,10],[-1,104],[-1,5],[-3,4],[-12,6],[-21,7],[-48,7],[-25,3],[-19,0],[-22,0],[-23,0],[-43,5],[-52,9],[-46,18],[-142,71]],[[7296,4681],[72,-8],[169,12],[185,24],[156,40],[46,6],[57,-48],[-7,-94],[-72,-29],[-40,-8],[-30,-18],[-12,-24],[14,-21],[58,-46],[33,-17],[52,-8],[104,11],[185,52],[88,12],[42,9],[39,21],[18,26],[-16,24],[-41,22],[-7,12],[73,27],[28,-9],[32,-2],[26,5],[16,16],[16,0],[40,-13],[103,-22],[43,-13],[32,-19],[85,-61],[8,-13],[12,-69],[-65,-49],[51,-83],[-21,-40],[71,10],[48,-24],[49,-30],[57,-15],[58,-6],[126,-30],[60,-10],[-16,-7],[-7,-2],[-10,-1],[-241,37],[-118,6],[-29,-43],[24,-16],[40,-15],[38,-20],[17,-29],[22,-14],[54,0],[108,9],[104,-10],[206,-36],[109,0],[40,13],[-13,18],[-42,17],[-44,7],[-27,9],[-35,20],[-38,18],[222,-74],[136,-30],[16,-2],[2,0],[2,-61],[-70,-130],[-6,-21],[-2,-77],[-43,-92],[17,-142],[-35,-144],[1,-76],[51,-52],[163,-77],[57,-49],[9,-57],[-44,-43],[-49,-22],[-30,-14],[-171,-54],[-641,-145]],[[8446,5014],[73,-41],[78,-34],[48,-14],[49,-10],[43,-13],[29,-19],[-163,-70],[-41,-9],[-15,-6],[-11,-11],[-24,-45],[-15,0],[7,36],[8,12],[-38,-6],[-31,-43],[-44,-31],[-41,-22],[-15,-24],[-41,19],[-1,24],[16,22],[-44,32],[-42,9],[-39,16],[-42,6],[-45,-21],[-21,-21],[-45,-4],[-57,21],[-16,20],[-14,38],[1,36],[47,39],[-30,56],[2,42],[90,16],[199,-20],[107,-3],[78,23]],[[5948,3891],[-12,-20],[0,-6],[3,-8],[9,-8],[10,-6],[13,-5],[100,-36],[59,-30],[10,-10],[-1,-7],[-10,-3],[-22,-4],[-30,-4],[-10,-3],[-10,-3],[-7,-4],[-6,-5],[-3,-5],[-2,-5],[2,-25],[11,-44],[6,-10],[18,-14],[13,-12],[4,-7],[-2,-7],[-4,-5],[-29,-22],[-60,-34],[-7,-5],[-6,-6],[-7,-28],[-4,-56],[2,-12],[4,-5],[98,-82],[6,-6],[7,-9],[-6,-6],[-10,-2],[-11,-1],[-11,0],[-13,2],[-27,5],[-61,16],[-264,101],[-78,46],[-10,4],[-21,8],[-21,6],[-44,8],[-38,4],[-30,1],[-79,-4],[-65,-6],[-59,-10],[-51,-15],[-100,-40],[-26,-7],[-61,-13],[-2872,-279],[-45,-7]],[[2088,3141],[-4,2],[-28,45],[-24,141],[-33,192],[-33,44],[-248,182],[-232,170],[-55,16],[-51,-5],[-51,1],[-50,8],[-48,11],[-271,92],[-89,14],[-118,6],[-90,12],[-63,33],[-37,64],[-4,181]],[[9064,2780],[-756,-172],[-67,-34],[-99,-108],[-80,-39],[-89,-26],[-82,-31],[-48,-7],[-45,8],[-44,12],[-46,3],[-55,-28],[-20,-110],[-32,-45],[-103,-46],[-42,-47],[-29,-21],[-36,-17],[-40,-16],[-134,-25],[-275,2],[-126,-48],[-165,-140],[-157,-83],[-38,-32],[-26,-89],[4,-24],[183,-234],[75,-144],[77,-78],[3,-25],[-13,-53],[11,-48],[61,-96],[-1,-46],[-39,-55],[-151,-151],[-223,-123],[-258,-201],[-304,-190],[-63,-18],[-178,-6],[-72,-9],[-548,-140],[-69,150],[-70,151],[-69,150],[-70,151],[-69,150],[-70,151],[-69,150],[-69,151],[-70,150],[-69,151],[-70,150],[-69,150],[-69,151],[-70,150],[-69,151],[-70,150],[-6,15],[-45,98],[-28,25],[-34,20],[-412,141],[-512,176],[-391,134],[-300,90],[-67,35]]],"transform":{"scale":[0.00040847069726973216,0.0007314618185818553],"translate":[7.47983239800007,30.228905335000093]}};
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
