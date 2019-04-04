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
  Datamap.prototype.tunTopo = '__TUN__';
  Datamap.prototype.turTopo = '__TUR__';
  Datamap.prototype.tuvTopo = '__TUV__';
  Datamap.prototype.twnTopo = '__TWN__';
  Datamap.prototype.tzaTopo = '__TZA__';
  Datamap.prototype.ugaTopo = {"type":"Topology","objects":{"UGA":{"type":"GeometryCollection","geometries":[{"type":"Polygon","properties":{"name":"Kalangala"},"id":"UG.KN","arcs":[[0,1,2,3,4,5,6,7,8]]},{"type":"Polygon","properties":{"name":"Jinja"},"id":"UG.JI","arcs":[[9,10,11,12,13,14,15]]},{"type":"Polygon","properties":{"name":"Kumi"},"id":"UG.KU","arcs":[[16,17,18,19,20]]},{"type":"Polygon","properties":{"name":"Kaberamaido"},"id":"UG.KD","arcs":[[21,22,23,24,25,26,27]]},{"type":"Polygon","properties":{"name":"Kayunga"},"id":"UG.KY","arcs":[[28,-15,29,30,31,32,33,34]]},{"type":"Polygon","properties":{"name":"Iganga"},"id":"UG.IN","arcs":[[35,36,-11,37,38,39]]},{"type":"Polygon","properties":{"name":"Kamuli"},"id":"UG.KX","arcs":[[40,-16,-29,41]]},{"type":"Polygon","properties":{"name":"Amolatar"},"id":"UG.LI.KO","arcs":[[-26,42,-34,43,44]]},{"type":"Polygon","properties":{"name":"Kaliro"},"id":"UG.RO.BL","arcs":[[45,-39,46,47,48]]},{"type":"Polygon","properties":{"name":"Namutumba"},"id":"UG.BK.BS","arcs":[[49,50,-40,-46,51]]},{"type":"Polygon","properties":{"name":"Soroti"},"id":"UG.SR","arcs":[[52,53,54,-23,55]]},{"type":"Polygon","properties":{"name":"Mukono"},"id":"UG.MN","arcs":[[56,-2,57,58,59,60,-31]]},{"type":"Polygon","properties":{"name":"Pallisa"},"id":"UG.PL","arcs":[[-19,61,62,63,64,-49,65,66,67]]},{"type":"Polygon","properties":{"name":"Sembabule"},"id":"UG.SE","arcs":[[68,69,70,71,72,73,74]]},{"type":"Polygon","properties":{"name":"Mpigi"},"id":"UG.MI","arcs":[[-9,75,76,77,78]]},{"type":"Polygon","properties":{"name":"Adjumani"},"id":"UG.AD","arcs":[[79,80,81,82,83]]},{"type":"Polygon","properties":{"name":"Arua"},"id":"UG.AW.AU","arcs":[[-81,84,85,86,87,88,89]]},{"type":"Polygon","properties":{"name":"Koboko"},"id":"UG.OK.KB","arcs":[[90,91,92]]},{"type":"Polygon","properties":{"name":"Buliisa"},"id":"UG.BL","arcs":[[93,94,95,96,97]]},{"type":"Polygon","properties":{"name":"Nebbi"},"id":"UG.NE","arcs":[[98,-96,99,100,-86,101]]},{"type":"Polygon","properties":{"name":"Moyo"},"id":"UG.MY","arcs":[[-83,102,103]]},{"type":"Polygon","properties":{"name":"Yumbe"},"id":"UG.YU","arcs":[[-103,-82,-90,-93,104]]},{"type":"Polygon","properties":{"name":"Maracha"},"id":"UG.MH","arcs":[[-89,105,-91]]},{"type":"Polygon","properties":{"name":"Kampala"},"id":"UG.KM","arcs":[[106,-59]]},{"type":"Polygon","properties":{"name":"Kiboga"},"id":"UG.KG","arcs":[[107,108,109,110]]},{"type":"Polygon","properties":{"name":"Nakasongola"},"id":"UG.NA","arcs":[[-44,-33,111,112,113,114]]},{"type":"Polygon","properties":{"name":"Wakiso"},"id":"UG.WA","arcs":[[115,-60,-107,-58,-1,-79,116,117]]},{"type":"Polygon","properties":{"name":"Luweero"},"id":"UG.LW.BM","arcs":[[-32,-61,-116,118,-112]]},{"type":"Polygon","properties":{"name":"Mubende"},"id":"UG.MD","arcs":[[119,120,-75,121,122,123,-109]]},{"type":"Polygon","properties":{"name":"Mityana"},"id":"UG.TY.BS","arcs":[[-117,-78,124,125,-120,-108,126]]},{"type":"Polygon","properties":{"name":"Nakaseke"},"id":"UG.NK","arcs":[[-119,-118,-127,-111,127,128,-113]]},{"type":"Polygon","properties":{"name":"Kitgum"},"id":"UG.TG","arcs":[[129,130,131,132,133,134]]},{"type":"Polygon","properties":{"name":"Gulu"},"id":"UG.GL.AW","arcs":[[135,136,137,138,139]]},{"type":"Polygon","properties":{"name":"Lira"},"id":"UG.LA","arcs":[[140,141,142,143,144,145,146]]},{"type":"Polygon","properties":{"name":"Dokolo"},"id":"UG.DO.DK","arcs":[[-27,147,-143,148]]},{"type":"Polygon","properties":{"name":"Pader"},"id":"UG.PD","arcs":[[149,150,-147,151,-136,152,-132]]},{"type":"Polygon","properties":{"name":"Masindi"},"id":"UG.MC","arcs":[[153,-114,-129,154,155,-98,156,157]]},{"type":"Polygon","properties":{"name":"Oyam"},"id":"UG.OY.OA","arcs":[[-152,-146,158,159,160,161,-137]]},{"type":"Polygon","properties":{"name":"Bundibugyo"},"id":"UG.BN","arcs":[[162,163,164]]},{"type":"Polygon","properties":{"name":"Hoima"},"id":"UG.HO","arcs":[[-156,165,166,167,168,-94]]},{"type":"Polygon","properties":{"name":"Kabarole"},"id":"UG.BR","arcs":[[169,170,171,172,-163,173,174]]},{"type":"Polygon","properties":{"name":"Kyenjojo"},"id":"UG.KJ","arcs":[[175,176,-170,177]]},{"type":"Polygon","properties":{"name":"Kibale"},"id":"UG.KI","arcs":[[178,-123,179,-178,-175,180,-167]]},{"type":"Polygon","properties":{"name":"Kapchorwa"},"id":"UG.KP","arcs":[[181,182,183,184,185]]},{"type":"Polygon","properties":{"name":"Bukwa"},"id":"UG.BW.KO","arcs":[[186,-182,187,188]]},{"type":"Polygon","properties":{"name":"Sironko"},"id":"UG.SI.BD","arcs":[[-184,189,190,191,192]]},{"type":"Polygon","properties":{"name":"Mbale"},"id":"UG.ME.BN","arcs":[[-191,193,194,195,196,197,-63,198]]},{"type":"Polygon","properties":{"name":"Manafwa"},"id":"UG.MF","arcs":[[199,200,-195,201]]},{"type":"Polygon","properties":{"name":"Bugiri"},"id":"UG.BG","arcs":[[202,203,204,205,206,-36,-51]]},{"type":"Polygon","properties":{"name":"Busia"},"id":"UG.BU","arcs":[[207,208,-205,209]]},{"type":"Polygon","properties":{"name":"Butaleja"},"id":"UG.BJ.BN","arcs":[[210,-203,-50,211,212,-197]]},{"type":"Polygon","properties":{"name":"Mayuge"},"id":"UG.MG","arcs":[[-207,213,214,215,-12,-37]]},{"type":"Polygon","properties":{"name":"Tororo"},"id":"UG.TR","arcs":[[-201,216,-210,-204,-211,-196]]},{"type":"Polygon","properties":{"name":"Katakwi"},"id":"UG.KK.UU","arcs":[[217,-21,218,-53,219,220]]},{"type":"Polygon","properties":{"name":"Kotido"},"id":"UG.KF.JE","arcs":[[221,222,223,224,-130,225]]},{"type":"Polygon","properties":{"name":"Amuria"},"id":"UG.AM","arcs":[[-220,-56,-22,226,227,228]]},{"type":"Polygon","properties":{"name":"Kaabong"},"id":"UG.AB","arcs":[[229,-226,-135,230]]},{"type":"Polygon","properties":{"name":"Abim"},"id":"UG.AI.LB","arcs":[[231,232,233,-224]]},{"type":"Polygon","properties":{"name":"Moroto"},"id":"UG.MT","arcs":[[234,235,236,-222,-230,237]]},{"type":"Polygon","properties":{"name":"Nakapiripirit"},"id":"UG.NP","arcs":[[238,239,240,-17,-218,241,-236]]},{"type":"Polygon","properties":{"name":"Rakai"},"id":"UG.RA","arcs":[[242,-6,243,244,245,246,247]]},{"type":"Polygon","properties":{"name":"Masaka"},"id":"UG.MA","arcs":[[-243,248,249,-7]]},{"type":"Polygon","properties":{"name":"Bushenyi"},"id":"UG.BS","arcs":[[250,251,252,253,254]]},{"type":"Polygon","properties":{"name":"Kasese"},"id":"UG.KS","arcs":[[255,256,257,-172]]},{"type":"Polygon","properties":{"name":"Kamwenge"},"id":"UG.KE","arcs":[[258,259,260,261,-256,-171,-177]]},{"type":"Polygon","properties":{"name":"Ibanda"},"id":"UG.IB.IA","arcs":[[262,263,264,-261,265]]},{"type":"Polygon","properties":{"name":"Isingiro"},"id":"UG.NG.BK","arcs":[[266,-245,267,268,269]]},{"type":"Polygon","properties":{"name":"Mbarara"},"id":"UG.RR","arcs":[[270,-246,-267,271,-266,-260,272,-73]]},{"type":"Polygon","properties":{"name":"Ntungamo"},"id":"UG.NT","arcs":[[273,274,-269,275,276,277,278]]},{"type":"Polygon","properties":{"name":"Rukungiri"},"id":"UG.RK","arcs":[[-254,279,-278,280,281,282,283]]},{"type":"Polygon","properties":{"name":"Mbarara"},"id":"UG.RR.KS","arcs":[[-270,-275,284,285,-263,-272]]},{"type":"Polygon","properties":{"name":"Kabale"},"id":"UG.KA","arcs":[[-281,-277,286,287,288]]},{"type":"Polygon","properties":{"name":"Kisoro"},"id":"UG.KR","arcs":[[-288,289,290]]},{"type":"Polygon","properties":{"name":"Kanungu"},"id":"UG.UU","arcs":[[-289,-291,291,-282]]},{"type":"Polygon","properties":{"name":"Zombo"},"id":"UG.ZO","arcs":[[-101,292,-87]]},{"type":"Polygon","properties":{"name":"Ngora"},"id":"UG.NR","arcs":[[-20,-68,293,-54,-219]]},{"type":"Polygon","properties":{"name":"Bukedea"},"id":"UG.BE","arcs":[[-192,-199,-62,-18,294]]},{"type":"Polygon","properties":{"name":"Luuka"},"id":"UG.LK","arcs":[[-38,-10,-41,295,-47]]},{"type":"Polygon","properties":{"name":"Buyende"},"id":"UG.BY","arcs":[[-25,296,-66,-48,-296,-42,-35,-43]]},{"type":"Polygon","properties":{"name":"Budaka"},"id":"UG.BD","arcs":[[-198,-213,297,-64]]},{"type":"Polygon","properties":{"name":"Kibuku"},"id":"UG.QB","arcs":[[-212,-52,-65,-298]]},{"type":"Polygon","properties":{"name":"Serere"},"id":"UG.SX","arcs":[[-294,-67,-297,-24,-55]]},{"type":"Polygon","properties":{"name":"Buikwe"},"id":"UG.BZ","arcs":[[-14,298,-3,-57,-30]]},{"type":"Polygon","properties":{"name":"Buvuma"},"id":"UG.BV","arcs":[[-216,299,-4,-299,-13]]},{"type":"Polygon","properties":{"name":"Butambala"},"id":"UG.BT","arcs":[[300,301,-125,-77]]},{"type":"Polygon","properties":{"name":"Gomba"},"id":"UG.GM","arcs":[[-126,-302,302,303,-69,-121]]},{"type":"Polygon","properties":{"name":"Amuru"},"id":"UG.AY","arcs":[[304,-139,305,-102,-85,-80,306]]},{"type":"Polygon","properties":{"name":"Kyankwanzi"},"id":"UG.QZ","arcs":[[-128,-110,-124,-179,-166,-155]]},{"type":"Polygon","properties":{"name":"Lamwo"},"id":"UG.LM","arcs":[[-133,-153,-140,-305,307]]},{"type":"Polygon","properties":{"name":"Apac"},"id":"UG.AC","arcs":[[-144,-148,-45,-115,-154,308,-160,309]]},{"type":"Polygon","properties":{"name":"Kole"},"id":"UG.QL","arcs":[[-310,-159,-145]]},{"type":"Polygon","properties":{"name":"Alebtong"},"id":"UG.AL","arcs":[[-227,-28,-149,-142,310]]},{"type":"Polygon","properties":{"name":"Otuke"},"id":"UG.OT","arcs":[[-233,311,-228,-311,-141,-151,312]]},{"type":"Polygon","properties":{"name":"Agago"},"id":"UG.AG","arcs":[[-225,-234,-313,-150,-131]]},{"type":"Polygon","properties":{"name":"Kiryandongo"},"id":"UG.QD","arcs":[[-161,-309,-158,313]]},{"type":"Polygon","properties":{"name":"Ntoroko"},"id":"UG.NO","arcs":[[-181,-174,-165,314,-168]]},{"type":"Polygon","properties":{"name":"Kyegegwa"},"id":"UG.QG","arcs":[[-122,-74,-273,-259,-176,-180]]},{"type":"Polygon","properties":{"name":"Kween"},"id":"UG.QW","arcs":[[315,-188,-186,316,-240]]},{"type":"Polygon","properties":{"name":"Bulambuli"},"id":"UG.BB","arcs":[[-317,-185,-193,-295,-241]]},{"type":"Polygon","properties":{"name":"Namayingo"},"id":"UG.NY","arcs":[[317,-214,-206,-209]]},{"type":"Polygon","properties":{"name":"Napak"},"id":"UG.NQ","arcs":[[-242,-221,-229,-312,-232,-223,-237]]},{"type":"Polygon","properties":{"name":"Amudat"},"id":"UG.AZ","arcs":[[-189,-316,-239,-235,318]]},{"type":"Polygon","properties":{"name":"Lwengo"},"id":"UG.LE","arcs":[[319,-249,-248,320,-71]]},{"type":"Polygon","properties":{"name":"Lyantonde"},"id":"UG.LY","arcs":[[-321,-247,-271,-72]]},{"type":"Polygon","properties":{"name":"Bukomansimbi"},"id":"UG.BM","arcs":[[321,-320,-70,-304]]},{"type":"Polygon","properties":{"name":"Kalungu"},"id":"UG.QA","arcs":[[-301,-76,-8,-250,-322,-303]]},{"type":"Polygon","properties":{"name":"Rubirizi"},"id":"UG.RZ","arcs":[[-262,-265,322,-255,-284,323,-257]]},{"type":"Polygon","properties":{"name":"Mitooma"},"id":"UG.MM","arcs":[[324,-279,-280,-253]]},{"type":"Polygon","properties":{"name":"Sheema"},"id":"UG.SH","arcs":[[-274,-325,-252,325,-285]]},{"type":"Polygon","properties":{"name":"Buhweju"},"id":"UG.BH","arcs":[[-286,-326,-251,-323,-264]]},{"type":"Polygon","properties":{"name":"Nwoya"},"id":"UG.NW","arcs":[[-138,-162,-314,-157,-97,-99,-306]]},{"type":"Polygon","properties":{"name":"Bududa"},"id":"UG.BA","arcs":[[326,-202,-194,-190]]}]}},"arcs":[[[4946,2312],[255,-2],[194,-6]],[[5395,2304],[205,0]],[[5600,2304],[443,0],[0,-525]],[[6043,1779],[0,-949]],[[6043,830],[-226,0],[-3,0],[-332,0],[-336,0],[-335,0],[-336,0],[-9,0]],[[4466,830],[0,401]],[[4466,1231],[0,634],[39,27],[38,23],[44,24],[28,37],[-4,46],[-54,21],[-12,30],[-16,28],[-15,19],[-5,12],[-2,14],[-4,11],[-14,5],[-16,-1],[-11,0],[-8,7],[-9,18]],[[4445,2186],[10,44],[0,28],[-16,11],[-19,-1],[-63,-21],[16,71],[9,26],[-11,2],[-27,9],[29,13]],[[4373,2368],[50,-40],[64,-15],[459,-1]],[[6729,3770],[94,12],[64,-53],[49,-18],[44,-28],[16,-12],[14,-14],[41,-23],[12,-31],[9,-31],[52,-21],[60,-4],[53,-34],[33,38]],[[7270,3551],[47,-41],[-4,-38],[9,-36],[28,-24],[10,-31]],[[7360,3381],[-33,-52],[-47,-43],[-17,-50],[-16,-37],[-25,-15],[-24,-3],[-26,-6],[-83,-44],[-57,-10]],[[7032,3121],[-168,72],[-41,12]],[[6823,3205],[-107,33],[-56,41],[6,63],[-12,65],[-42,52],[-108,87]],[[6504,3546],[-25,30],[-63,141],[-3,38]],[[6413,3755],[48,-20],[40,25],[56,-10],[10,37],[45,-4],[44,10],[31,-13],[42,-10]],[[8543,5454],[24,-1],[18,-7],[-9,-124]],[[8576,5322],[-152,-41],[-111,-20],[-80,-46],[11,-112],[-53,-35],[-37,-31],[0,-71],[5,-102],[-74,-40],[-64,-46]],[[8021,4778],[-35,26],[-51,8],[-48,13],[-35,31],[-32,36],[-51,4]],[[7769,4896],[-13,131],[43,51],[69,25],[10,112],[-16,168],[37,61],[65,23]],[[7964,5467],[90,-27],[91,22],[87,12],[311,-20]],[[7003,6136],[9,-37],[15,-32],[35,-17],[24,-23],[2,-70],[48,-53]],[[7136,5904],[19,-36],[5,-40],[-33,-56],[0,-33],[-2,-34],[-67,-39],[-86,-62]],[[6972,5604],[-75,-30],[-107,0],[-11,-77],[-4,-70],[-58,-77],[-14,-191],[1,-165]],[[6704,4994],[-137,17],[-53,50],[-65,44],[-100,49],[-31,10],[-33,-6],[-27,19]],[[6258,5177],[2,156],[-41,146],[66,33],[19,90]],[[6304,5602],[69,-27],[66,4],[30,11],[27,15],[8,20],[6,25],[38,101],[12,58],[16,17],[23,9],[165,98],[28,30],[22,36],[17,13],[10,18],[16,141]],[[6857,6171],[76,-1],[70,-34]],[[6252,4665],[8,-31],[0,-40],[-8,-35],[-40,-30],[-6,-38],[34,-233],[22,-68],[87,-130],[36,-68],[23,-75],[8,-84],[-3,-78]],[[6504,3546],[-99,48],[-24,27]],[[6381,3621],[-91,103],[-56,43],[-98,39],[-72,54],[-66,104],[-55,110]],[[5943,4074],[-30,206],[8,209]],[[5921,4489],[24,178],[-28,177],[-3,38],[1,21],[-2,24],[-6,19],[-12,8],[-18,5],[-14,26],[-19,6],[-34,18],[-53,18],[-5,145]],[[5752,5172],[226,8]],[[5978,5180],[36,-129],[37,-76],[76,-82],[11,-36],[42,-49],[17,-57],[55,-86]],[[7478,3877],[15,-46],[50,-47],[5,-70],[-13,-70],[-35,-53],[-46,-49],[-16,-69],[2,-67],[0,-20],[-1,-19]],[[7439,3367],[-79,14]],[[7270,3551],[-7,119],[0,92],[-106,55],[-64,51],[6,71],[26,82],[-19,99]],[[7106,4120],[60,-4],[31,-10],[29,-4],[71,35]],[[7297,4137],[19,-116],[25,-31],[40,-11],[83,-32],[14,-70]],[[6868,4247],[-1,-64],[-5,-30],[-12,-29],[-4,-26],[11,-26],[-7,-21],[-13,-17],[-7,-40],[-23,-33],[-25,-14],[-24,-16],[-14,-29],[-20,-80],[5,-52]],[[6252,4665],[141,-14],[138,-61],[27,-71],[10,-76],[43,-31],[48,-15],[84,-66],[53,-51],[72,-33]],[[6258,5177],[-280,3]],[[5752,5172],[-160,-14],[-47,45],[-36,57],[-53,-8],[-38,9],[-56,53],[-40,28],[-44,12],[-84,51],[-121,36],[-27,44]],[[5046,5485],[83,11],[323,-4],[129,-1],[63,34],[121,107],[143,121],[210,12],[186,-163]],[[7483,4500],[-30,-43],[-21,-47],[-22,-40],[-31,-35],[-82,-198]],[[7106,4120],[-53,23],[-11,56],[31,121],[-29,58],[-20,27],[-16,28],[-27,32],[-37,20]],[[6944,4485],[48,38],[4,24],[-4,26],[28,46],[33,44],[25,50],[36,45],[15,44],[5,49]],[[7134,4851],[55,-40],[48,-46],[46,-63],[20,-3],[26,-7],[48,-37],[39,-42],[27,-61],[40,-52]],[[7684,4234],[43,-42],[16,-57],[-3,-64],[6,-62],[26,-59],[14,-56],[18,-16],[26,-17],[27,-60]],[[7857,3801],[-57,-17],[-57,-2],[-56,77],[-35,-43],[-54,7],[-61,24],[-59,30]],[[7483,4500],[86,-61],[29,-28],[-1,-85],[21,-33],[66,-59]],[[7805,5590],[-6,-40],[9,-31]],[[7808,5519],[-45,-21],[-57,10],[-39,-28],[-21,-51],[-12,-44]],[[7634,5385],[-132,-32],[-118,-10],[-128,30],[-80,52],[-54,108],[-123,30],[-27,41]],[[7136,5904],[14,76],[21,71],[10,57],[44,31],[71,-15],[34,-63],[46,-48],[60,-33],[40,-8],[37,-14],[12,-30],[7,-31],[33,-27],[40,-19],[18,-18],[16,-21],[63,-49],[53,-58],[10,-36],[5,-38],[16,-21],[19,-20]],[[6381,3621],[-79,-50],[-6,-85],[29,-99],[51,-68],[-15,-97],[-80,-82],[-107,-99],[-50,-88],[-53,-57],[-3,-59],[-160,-182],[-308,-351]],[[5395,2304],[53,68],[82,104],[100,118],[-3,231],[21,143],[21,75],[39,52]],[[5708,3095],[40,83],[-34,103],[-8,58],[7,58],[9,39],[-23,39]],[[5699,3475],[21,44],[-1,48]],[[5719,3567],[152,55],[36,117],[29,172],[7,163]],[[8021,4778],[29,-35],[159,-31],[37,-13],[37,-19],[86,-22]],[[8369,4658],[1,-36],[20,-32],[3,-43]],[[8393,4547],[-80,33],[-69,30],[-122,36],[-143,-5]],[[7979,4641],[-90,-36],[-138,-61],[-127,-46],[-141,2]],[[7134,4851],[-51,20],[-18,64]],[[7065,4935],[43,6],[18,-34],[30,-7],[36,15],[43,-9],[113,20]],[[7348,4926],[270,17],[43,1],[18,-30],[35,-27],[55,9]],[[3272,2942],[83,-6],[31,-19],[41,-61],[37,-16],[144,-75],[135,-88]],[[3743,2677],[-76,-55],[26,-127],[42,-205],[37,-160]],[[3772,2130],[-6,-60],[-35,-12],[-125,-19],[-103,-2],[-40,9],[-40,5],[-152,24],[-102,57]],[[3169,2132],[20,43],[14,49],[19,42],[7,48],[-3,26],[-8,25],[7,49],[-39,43],[-51,32],[-24,-61],[-97,44],[-6,31],[-98,31],[-43,8],[-25,-16],[-41,-14]],[[2801,2512],[-61,17],[-52,7],[12,29],[23,23],[16,38],[-1,113],[-8,70],[-38,66],[-31,70]],[[2661,2945],[14,8]],[[2675,2953],[68,-2],[65,11],[70,34],[70,-6],[51,-57],[59,-44],[76,-2],[55,52],[83,3]],[[4373,2368],[-102,161],[-44,48]],[[4227,2577],[129,63],[114,85],[68,69],[94,35],[94,-15],[78,45],[89,55],[52,40],[36,35],[-5,70]],[[4976,3059],[7,96],[-4,69],[3,35],[-9,94]],[[4973,3353],[194,0],[129,-131],[-29,-167],[-25,-67],[-24,-33],[-44,-19],[-27,-23],[-15,-36],[-23,-39],[-35,-29],[-40,-11],[-33,-19],[-18,-49],[-40,-31],[-36,-22],[-13,-36],[8,-83],[45,-71],[6,-83],[-7,-92]],[[4591,8840],[-1,-1],[-8,-251],[-12,-22],[-23,-11],[-4,-36],[4,-37],[16,-31],[4,-30],[-36,-63],[-4,-36],[9,-38],[-10,-33],[-19,-31],[-22,-28],[-28,-24],[-11,-34],[-2,-37],[-68,-105],[-4,-36],[-7,-35],[-367,-109],[-194,-29],[-57,-77],[-45,-63],[-26,-15],[-34,-1],[-24,12],[-16,24],[-48,13],[-38,48],[-44,36],[-76,19]],[[3396,7779],[24,68],[27,37],[84,84],[67,98]],[[3598,8066],[22,45]],[[3620,8111],[49,101],[22,74],[7,48],[6,13],[10,12],[12,12],[11,13],[16,61],[27,33],[63,60],[12,33],[9,44],[12,39],[32,24],[9,17],[12,16],[20,8],[40,3],[42,9],[17,11],[45,38],[39,14],[21,3],[-4,-23],[18,-3],[33,2],[17,-14],[21,-13],[22,-10],[22,-5],[41,3],[37,19],[25,31],[9,38],[21,25],[92,26],[25,14]],[[4532,8887],[14,-1],[21,-10],[24,-36]],[[3396,7779],[-47,-91],[-16,-71],[6,-74],[40,-62]],[[3379,7481],[-82,-41],[-34,-15],[-8,-23],[-16,-28],[-27,-19],[-9,-27],[3,-36],[-19,-25],[-66,-49],[-178,-23],[-73,-40],[-122,-19]],[[2748,7136],[-109,45],[0,80],[-24,65],[-18,70],[-76,-10],[-103,-34],[-63,-39],[-116,-25]],[[2239,7288],[50,128],[2,9],[0,17],[5,10],[8,5],[22,4],[7,3],[12,18],[46,118],[2,70],[-20,69],[-42,71],[-32,28],[-85,57],[-22,26],[-2,34],[7,37],[29,82]],[[2226,8074],[81,-2],[198,-9],[64,69],[77,49],[52,53],[12,91],[48,82]],[[2758,8407],[38,-36],[52,9],[36,27],[15,41],[37,21],[47,-8],[53,-16],[36,-36],[75,-52],[93,-26],[34,-28],[22,-42],[43,-12],[50,-6],[38,-76],[9,-80],[162,-21]],[[2758,8407],[-76,48],[-23,-14],[-23,-21],[-57,26],[-48,43],[-46,46]],[[2485,8535],[9,13],[12,38],[-3,20],[-19,37],[-3,20],[13,50],[-1,16],[-24,41],[-29,-9],[-35,-29],[-40,-14],[8,28],[40,75],[121,169],[8,21],[6,20],[9,19],[21,17],[19,7],[36,-1],[19,2],[25,11],[56,43],[17,7],[35,6]],[[2785,9142],[-31,-118],[-27,-231],[22,-190],[9,-196]],[[3321,5642],[-1,91],[-62,54],[-460,35]],[[2798,5822],[37,45],[42,51],[118,142],[109,132],[53,91],[15,85]],[[3172,6368],[53,7],[67,42]],[[3292,6417],[37,23],[11,6],[50,16],[91,64],[89,22],[62,34],[27,7]],[[3659,6589],[6,-120],[-17,-118],[0,-135],[61,-76],[53,-84],[53,-42],[26,-51],[-17,-42],[-53,-8],[-53,-43],[0,-118],[-53,-75],[-123,-59],[-114,8],[-107,16]],[[3435,7186],[24,-33],[26,-28],[22,-36],[28,-76],[32,-26],[15,2],[21,6],[17,1],[8,-15],[-2,-19],[-8,-18],[-14,-13],[-20,-5],[-27,-12],[-18,-31],[-10,-39],[0,-26],[-7,-47],[-7,-45],[-29,-26],[-43,-25],[-94,-43],[-68,-69],[-14,-47],[25,-99]],[[3172,6368],[1,3],[-3,5],[-21,30],[-103,56],[-39,29],[-14,30],[-6,37],[-3,76],[-88,-32],[-31,-5],[-24,1],[-81,13],[-26,14],[-10,16],[6,7],[11,5],[2,10],[-4,13],[-4,7],[-104,112],[-30,19]],[[2601,6814],[15,36],[77,10],[11,64],[56,33],[26,66],[-38,113]],[[3379,7481],[35,-24],[28,-13],[18,-21],[10,-62],[8,-20],[4,-21],[-3,-21],[-10,-10],[-31,-15],[-10,-10],[-6,-41],[13,-37]],[[3620,8111],[-117,131],[-8,235],[14,185],[131,184],[94,121],[50,114]],[[3784,9081],[100,14],[33,14],[18,15],[145,157],[4,10],[6,-1],[37,-17],[11,-4],[43,-35],[130,-140],[27,-42],[7,-33],[5,-81],[13,-30],[25,-12],[144,-9]],[[2785,9142],[16,7],[49,36],[68,51],[48,13],[87,0],[75,-10],[72,-22],[151,-79],[234,-122],[34,-7],[19,17],[2,2],[22,25],[32,16],[90,12]],[[2226,8074],[74,215],[33,63],[7,4],[22,4],[9,4],[5,10],[3,18],[3,8],[36,60],[53,56],[14,19]],[[5708,3095],[-104,2],[-110,-26],[-44,52],[40,70],[25,31],[11,49],[-3,13],[-12,10],[-2,15],[7,13],[-27,21],[-16,22],[24,72],[32,-13],[23,-19],[33,2],[28,20],[11,31],[36,10],[39,5]],[[4828,3823],[-81,-34],[-89,-58],[-35,-25],[-74,-2],[-97,14],[-46,11]],[[4406,3729],[-21,14],[-25,12],[-17,19],[-3,24],[-150,203],[-72,27],[-101,0],[-122,83]],[[3895,4111],[79,96],[72,62],[79,41],[58,49],[21,82],[58,55],[143,32]],[[4405,4528],[85,-145],[4,-32],[-2,-37],[78,-127],[118,-77],[108,-19],[97,-82],[5,-85],[-21,-50],[-49,-51]],[[5921,4489],[-99,-11],[-44,74],[-50,48],[-65,-16],[-22,-94],[-14,-111],[7,-89],[-117,14],[-167,71],[-115,130]],[[5235,4505],[-18,109],[-89,83],[-184,82],[-303,292],[-224,111]],[[4417,5182],[65,92],[43,15],[40,24],[53,65],[32,74],[32,31]],[[4682,5483],[68,34],[67,19],[63,-3],[42,-14],[124,-34]],[[5096,3549],[28,18],[27,12],[174,-19],[90,1],[68,-17],[70,49],[82,-26],[84,0]],[[4973,3353],[-80,121],[6,124]],[[4899,3598],[54,-12],[48,-29],[44,-20],[51,12]],[[5096,3549],[9,69],[34,63],[28,27],[34,23],[43,8],[44,2],[36,-4],[21,19],[20,33],[24,27],[-8,29],[-24,20],[-16,29],[-1,217],[-94,138],[-21,110],[10,146]],[[4406,3729],[-22,-31],[-47,-15],[-25,-46],[18,-47],[25,-6],[22,-9],[3,-19],[-12,-15],[-14,-14],[-4,-17],[29,-36],[8,-39],[31,-47],[16,-51],[-18,-32],[-7,-40],[21,-82],[-33,-74],[-233,-22]],[[4164,3087],[-89,-44],[-90,76],[-125,40],[-67,20],[-80,4],[-139,-69],[-115,-35],[-115,-20],[-68,-25],[-4,-92]],[[2675,2953],[33,56],[52,40],[47,49],[39,54],[25,21],[20,23],[-12,30],[-17,30],[-2,68],[35,60],[17,58],[40,34],[129,21],[25,13],[-1,22],[13,26],[6,27],[-25,55],[-47,43]],[[3052,3683],[111,150],[80,17],[84,-33],[50,69],[19,94],[18,26],[23,20],[-1,33],[26,44]],[[3462,4103],[265,-29],[104,37],[64,0]],[[4976,3059],[-62,-25],[-129,8],[-35,-3]],[[4750,3039],[-227,-16],[-39,-3],[-19,-18],[-33,-11],[-41,9],[-27,-19],[-35,-3],[-42,12],[-33,18],[-43,65],[-47,14]],[[4828,3823],[33,-74],[27,-104],[11,-47]],[[4405,4528],[-37,207],[-67,112],[-135,126]],[[4166,4973],[113,112],[74,43],[64,54]],[[7685,8478],[-16,-22],[-11,-24],[11,-49],[-43,-47],[-55,-37],[-54,-2],[-53,23],[-66,12],[-67,-3]],[[7331,8329],[-42,-5],[-41,3],[-30,23],[-33,19],[-149,14],[51,-69],[-120,4],[16,-116],[-87,-7],[-73,-25],[-107,18],[-44,-135],[-64,-165]],[[6608,7888],[-51,83],[-58,47],[-58,72],[-138,72],[-105,11],[-6,-125],[-67,37],[-99,60],[-68,10],[-33,18]],[[5925,8173],[-8,100],[0,72],[-37,72],[0,82],[21,46],[177,11],[69,15],[43,31],[0,36],[22,41],[310,0],[27,26],[21,71],[38,21],[48,0],[80,-87],[0,-93],[102,-5],[6,231],[-22,98],[-43,56],[-10,57],[16,51],[21,76]],[[6806,9181],[42,-2],[295,-15],[79,10],[68,38]],[[7290,9212],[3,-8],[65,-196],[119,-162],[47,-89],[35,-96],[75,-84],[51,-99]],[[5435,8096],[-21,-21],[-36,0],[-18,-14],[117,-150],[184,-330],[28,-35],[23,-12],[23,-19],[17,-44],[23,-41],[34,-17],[24,-26],[-29,-38],[-48,-13],[-16,-23],[12,-30],[9,-39],[-24,-30],[-27,-20],[-3,-32]],[[5707,7162],[-168,32],[-157,-25],[-85,-227],[-77,-17],[-65,1]],[[5155,6926],[-34,32],[-59,17],[-48,30],[-28,46],[-9,35],[-4,35],[8,21],[-115,8],[-52,29],[-25,53],[12,50],[35,45],[24,55]],[[4860,7382],[23,60],[4,41],[-41,291],[-32,74],[5,103],[38,111],[34,53],[116,95],[69,90],[70,61]],[[5146,8361],[53,-37],[226,-189],[10,-39]],[[6350,7038],[-5,-48],[-26,-56],[-59,-36]],[[6260,6898],[0,-51],[-48,-52],[-81,-31],[-10,-41],[80,0],[64,-20],[27,-62],[70,-51],[69,-36],[38,-62],[11,-274]],[[6480,6218],[-40,-57],[-56,-15],[-63,32],[-61,38],[-68,12],[-74,5]],[[6118,6233],[-37,13],[-41,-2],[-32,19],[-28,26]],[[5980,6289],[16,179],[12,32],[-34,52],[-46,94],[-43,57],[27,67],[37,66],[28,99]],[[5977,6935],[22,73],[-87,110]],[[5912,7118],[56,40],[29,63],[24,1],[21,-27],[35,-16],[44,-4],[34,-21],[48,-16],[25,-87],[37,-4],[26,-25],[59,16]],[[6304,5602],[64,179],[-149,87],[7,107],[-63,27],[-81,12],[-7,62],[28,76],[15,81]],[[6480,6218],[60,22],[33,51],[35,-6],[33,12],[72,-35],[90,-17],[29,-34],[25,-40]],[[6608,7888],[0,-71],[-38,-41],[-53,-41],[11,-62],[96,-15],[118,-6],[37,-61],[-10,-118],[-59,-62],[-236,-10],[-48,-51],[43,-62],[90,-112]],[[6559,7176],[-82,-32],[-74,-44],[-53,-62]],[[5912,7118],[-205,44]],[[5435,8096],[302,1],[102,59],[86,17]],[[4677,5515],[5,-32]],[[4166,4973],[-37,-6],[-35,-11],[-41,-42],[-82,8],[-83,23],[-288,35]],[[3600,4980],[-49,19],[-42,31],[-32,33],[-8,90],[-23,243],[-13,36],[-41,-7],[-43,-12],[-24,65],[21,95],[-15,21],[-3,25],[-7,23]],[[3659,6589],[126,0],[16,-3],[20,-17],[15,-3],[34,4],[173,55]],[[4043,6625],[-17,-215],[9,-203],[35,-42],[70,-8],[53,-17],[35,-51],[35,-50],[0,-76],[-17,-109],[0,-85],[44,-76],[26,-67],[0,-67],[53,-26],[70,-17],[35,-50],[62,8],[0,68],[79,8],[62,-35]],[[5977,6935],[-64,-48],[-80,25],[-77,3],[-127,-155],[-72,-20],[39,-207],[-43,-32],[-33,-40],[-22,-43]],[[5498,6418],[-32,-63],[-112,-164],[-88,-17],[-139,55]],[[5127,6229],[-15,38],[-21,28],[-13,28],[-18,123],[-34,60],[-28,33],[-30,14]],[[4968,6553],[-35,140],[-8,145],[10,72],[69,16],[75,-8],[76,8]],[[1139,3845],[-28,-45],[-23,-48],[-17,-54],[-39,-40],[-45,-76],[-35,-83],[-19,-21],[-18,-25],[-21,-13],[-24,-9],[-27,-37],[-19,-43],[-37,-18],[-11,-11],[-23,-12],[-23,-7],[-15,1],[-12,7],[-20,17],[-16,16],[-16,16]],[[651,3360],[35,38],[6,12],[26,55],[-4,68],[-34,142],[1,37],[22,148],[-10,91],[3,17],[35,70],[23,13],[41,30],[26,19],[76,33],[196,43],[18,10],[20,22],[32,58]],[[1163,4266],[42,-104],[84,-74],[-46,-21],[-32,-40],[-13,-85],[-15,-15],[-17,-21],[-27,-61]],[[3600,4980],[-139,-133],[-53,-20],[-105,-50],[-62,-18],[-50,-38]],[[3191,4721],[-78,11],[-69,-1],[-29,-32],[-37,-16],[-50,5],[-49,-3],[-41,-56],[-48,4],[-35,6],[-71,-37],[-85,-10],[-175,-61],[-122,33],[-65,-23],[-48,-51],[-124,-49],[-151,-20],[-83,55]],[[1831,4476],[4,153],[7,306]],[[1842,4935],[79,99],[155,190],[248,192],[252,195],[131,101],[91,110]],[[1826,4222],[-43,-39],[-37,-45],[-29,-50],[8,-13],[9,-10],[-23,-60],[-36,-50],[-41,-27],[-10,-99],[-11,-53],[-29,-26],[-30,-36],[3,-44],[28,-27],[78,-55],[-26,-9],[-25,-39]],[[1612,3540],[-23,-22],[-46,-32],[-26,-44],[6,-27],[1,-27],[-27,-54],[38,-47],[5,-46],[-18,-105],[-32,-146],[-126,32],[-45,31]],[[1319,3053],[-45,31],[-51,34],[-93,-7],[-50,83],[-144,41],[-194,-41],[-221,-12]],[[521,3182],[12,38],[21,32],[97,108]],[[1139,3845],[128,66],[86,55],[43,131],[86,-69],[137,131],[72,89],[102,73]],[[1793,4321],[33,-99]],[[2544,3815],[-47,-24],[-38,-9],[22,-36],[60,-30],[31,-15],[0,-106],[-41,-6],[-19,-24],[0,-160],[-63,-3],[-3,-84]],[[2446,3318],[-38,-3],[-53,-19],[-44,16],[-54,15],[-50,-19],[-63,-24],[-72,-69],[-89,-54],[-100,-43],[-47,-6],[-22,46],[-5,67],[-22,62],[0,60],[-58,25],[-29,42],[-22,76],[-66,50]],[[1826,4222],[160,-69],[174,-41],[81,-38],[86,-17],[72,-59],[91,-117],[23,-39],[31,-27]],[[3191,4721],[53,-38],[57,-30],[54,-14],[51,-20],[75,-106],[100,-84],[33,-35],[-4,-47],[-19,-26],[-29,-13],[-30,-6],[-15,-23],[-46,-29],[-29,-34],[20,-56],[0,-57]],[[3052,3683],[-30,19],[-34,-3],[-42,21],[-50,7],[-82,37],[-88,21],[-82,12],[-100,18]],[[1793,4321],[27,111],[11,44]],[[9160,4698],[-5,-89],[21,-89],[5,-10],[0,-1]],[[9181,4509],[-36,-6],[-30,16],[-30,7]],[[9085,4526],[31,105]],[[9116,4631],[0,60],[-48,44],[-123,65],[-188,73],[-36,37],[9,53],[29,46],[46,47],[57,35],[87,37]],[[8949,5128],[64,-55],[116,-31],[64,-40],[5,-72],[-42,-101],[4,-131]],[[9585,4999],[4,-33],[32,-72],[19,-70],[-23,-71],[-58,-25],[-151,-15],[-38,-22],[-63,-58],[-88,-19],[-13,-32],[-3,-40],[-9,-15],[-11,-17],[-2,-1]],[[9160,4698],[40,84],[61,71],[45,28],[49,18],[38,6],[36,17],[58,72],[28,88]],[[9515,5082],[70,-82],[0,-1]],[[9085,4526],[-67,-8],[-151,13],[-58,-33]],[[8809,4498],[-59,22],[-60,14],[-28,-6],[-25,1],[-27,17],[-29,8],[-28,34],[-22,36],[-47,-9],[-41,17]],[[8443,4632],[64,53],[41,85]],[[8548,4770],[163,-23],[137,-35],[48,-46],[90,-10],[75,-15],[55,-10]],[[8809,4498],[-74,-21],[-44,-55],[-23,-41],[-30,-37]],[[8638,4344],[-7,-36],[1,-33],[-65,-30],[-23,-35],[-15,-39],[-18,-77],[-56,-50]],[[8455,4044],[-21,49],[-34,37],[-42,25],[-47,19]],[[8311,4174],[30,69],[5,76],[13,32],[9,33],[-39,17],[-47,5]],[[8282,4406],[15,29],[38,4],[28,27],[30,81]],[[8369,4658],[35,-19],[39,-7]],[[9004,4346],[-1,-39],[-10,-35],[-48,-113],[-53,-66],[-26,-70],[-31,-28],[-118,-56],[-15,-16],[-4,-22]],[[8698,3901],[-1,1],[-121,49],[-121,93]],[[8638,4344],[121,2],[0,-24],[32,0],[4,38],[168,0],[41,-14]],[[7857,3801],[26,-2],[25,-7]],[[7908,3792],[32,-64],[24,-69],[113,-78]],[[8077,3581],[-16,-29],[-34,-7],[-65,-84],[-4,-39]],[[7958,3422],[-62,-35],[-36,-48],[-18,-76],[-58,3],[-61,-24],[-64,-45],[-81,-42]],[[7578,3155],[15,82],[-97,21],[-37,46],[-42,26],[22,37]],[[8396,3590],[-44,-173],[-6,-15],[-12,-19],[-32,-36],[-8,-15],[2,-33],[20,-64],[-5,-36],[-15,-23],[-66,-49],[-148,-188]],[[8082,2939],[-16,13],[-28,33],[-58,76],[-42,81],[-8,53],[22,44],[31,28],[22,32],[-6,45],[-41,78]],[[8077,3581],[35,-5],[35,0],[30,16],[33,11],[177,-11],[8,-2],[1,0]],[[8311,4174],[-37,-2],[-31,-16],[-26,-22],[-32,-12],[-35,0],[-33,-4],[-59,-38],[-43,-56],[-91,-196],[-2,-20],[-14,-16]],[[7684,4234],[88,22],[97,-17]],[[7869,4239],[104,-21],[99,37],[100,82],[110,69]],[[7578,3155],[10,-27],[0,-12],[0,-35],[-55,-56],[-11,-306],[72,-131],[86,-69],[-6,-48],[-193,-63],[0,-1578]],[[7481,830],[-322,0],[-55,0]],[[7104,830],[0,2135],[-72,156]],[[8698,3901],[-7,-40],[-30,-75],[-44,-46],[-59,-29],[-75,-25],[-54,-36],[-31,-54],[-2,-6]],[[8543,6022],[0,-568]],[[7964,5467],[-72,45],[-84,7]],[[7805,5590],[69,47],[43,63],[-3,69],[-30,61],[22,45],[60,45],[2,35],[-10,37],[8,79],[-14,27],[1,29],[10,18],[12,17],[-4,18],[-13,18],[-3,34],[11,30],[19,38],[-3,40],[-18,77],[-20,23],[-11,30],[14,84],[35,82]],[[7982,6636],[476,-284],[69,-55],[16,-86],[0,-189]],[[8863,8001],[-92,-150],[-113,-138],[-30,-71],[-12,-78]],[[8616,7564],[-47,-190],[-149,48],[-80,-7],[-164,14],[-88,-59],[-23,-185]],[[8065,7185],[-145,75],[-44,16],[-13,287],[3,177],[-231,108],[-21,60],[-62,44],[14,59],[1,160],[-75,-5],[-54,25],[-98,10]],[[7340,8201],[-9,128]],[[7685,8478],[95,-67],[93,-44],[53,22],[52,-11],[18,-40],[-13,-53],[238,-7],[223,-75],[219,-152],[94,-48],[106,-2]],[[7003,6136],[-12,58],[10,69],[73,59],[28,-6],[21,-29],[37,11],[26,29],[-8,16],[-5,21],[8,14],[6,15],[9,39],[-11,34],[-29,23],[-19,27],[73,1],[65,44],[53,50],[-6,70],[2,46]],[[7324,6727],[54,-33],[63,-9],[51,49]],[[7492,6734],[64,3],[93,90],[46,-19],[287,-172]],[[9155,8029],[-1,-1],[-1,0],[-33,-21],[-34,-11],[-42,14],[-40,-3],[-69,-16],[-72,10]],[[7290,9212],[9,5],[135,130],[175,168],[205,197],[151,144],[148,143],[53,-25],[41,-31],[23,-40],[-2,-54],[2,-24],[16,-20],[21,-17],[15,-20],[6,-21],[0,-20],[-5,-41],[-7,-25],[-8,-16],[-1,-18],[14,-28],[22,-19],[27,-18],[21,-20],[5,-28],[-20,-45],[-23,-41],[-3,-30],[43,-15],[29,6],[73,24],[35,0],[41,-20],[4,-24],[-19,-24],[-88,-43],[3,-10],[29,-10],[23,-27],[-36,-22],[-13,-14],[24,-8],[15,1],[32,8],[36,2],[36,10],[20,1],[1,-8],[40,-51],[28,-70],[21,-12],[9,7],[8,17],[19,17],[50,14],[33,-12],[59,-61],[35,-17],[34,-11],[27,-16],[12,-37],[-5,-141],[-17,-71],[-35,-51],[-17,-8],[-18,-5],[-17,-7],[-10,-15],[1,-19],[23,-38],[7,-19],[-3,-17],[-18,-43],[-5,-20],[4,-21],[15,-18],[17,-18],[13,-19],[24,-70],[18,-216],[20,-40],[38,-23],[87,-24],[38,-25],[22,-36]],[[8065,7185],[18,-39],[41,-45],[21,-49],[42,-33],[5,-21],[-26,-14],[-56,-1],[-135,-16],[-118,13],[-120,2],[-111,-60],[-53,-15],[-57,-4]],[[7516,6903],[-39,51],[-55,39],[-120,156]],[[7302,7149],[-18,127],[52,117],[93,84],[0,61],[-13,53],[-27,45],[-7,53],[-12,47],[3,52],[-26,317],[-7,96]],[[9845,6472],[-69,-104],[-79,-68]],[[9697,6300],[-30,96],[-14,250],[-62,168],[-53,138]],[[9538,6952],[-26,64],[-70,68],[-106,34],[0,109],[-61,17],[-88,25],[-97,84],[-132,110],[-105,42],[-132,17],[-105,42]],[[9155,8029],[0,-1],[53,-265],[18,-31],[58,-62],[28,-42],[17,-16],[25,-6],[11,3],[20,16],[8,4],[4,3],[9,14],[4,2],[7,-3],[4,-6],[3,-6],[4,-3],[3,-5],[52,-24],[10,-2],[12,-15],[8,-15],[37,-111],[28,-152],[77,-154],[17,-17],[25,-1],[15,13],[12,14],[17,3],[18,-24],[11,-88],[10,-33],[50,-49],[17,-30],[-5,-40],[-27,-31],[-37,-20],[-33,-25],[-16,-43],[12,-69],[71,-164],[33,-76]],[[9697,6300],[35,-202],[-97,-9],[-8,-151],[0,-228],[-27,-168],[-70,-118],[-97,-59],[-110,-69]],[[9323,5296],[-86,50],[-33,-2],[-33,1],[-20,15],[-25,12],[-50,13],[-127,-64],[-102,3]],[[8847,5324],[-163,-17],[-26,11],[-25,16],[-28,-4],[-29,-8]],[[8543,6022],[73,0],[105,17],[70,25],[18,59],[61,34],[106,67],[281,17],[53,76],[9,624],[219,11]],[[3798,1765],[71,-12],[54,-76],[-16,-46],[14,-46],[-7,-13],[-13,-12],[-3,-45],[26,-44],[32,-35],[38,-81],[43,-50],[38,-18],[68,-23],[34,-14],[58,-14],[67,-5],[164,0]],[[4466,830],[-326,0],[-335,0],[-336,0],[-296,0]],[[3173,830],[-19,19],[-35,36],[-7,44],[-14,45],[-38,36],[-41,27],[-25,37],[33,40],[-27,78],[7,45],[-16,50],[-34,41],[-74,66],[-87,50]],[[2796,1444],[79,137],[31,81]],[[2906,1662],[94,-7],[78,15],[15,105]],[[3093,1775],[79,-90],[120,-80],[123,-45],[85,-30],[68,30],[16,90],[40,37],[69,3],[63,30],[42,45]],[[3798,1765],[15,60],[-31,60],[11,40],[78,40],[62,35],[0,85],[47,45]],[[3980,2130],[313,-5],[78,40],[74,21]],[[1080,1857],[136,-34],[130,-69],[79,-28]],[[1425,1726],[0,-117],[-22,-103],[-122,-14],[-151,-14]],[[1130,1478],[-72,21],[-21,48],[-15,55],[-43,42],[-57,0],[-58,-14],[-65,20],[-77,53]],[[722,1703],[6,27],[4,45],[-9,37],[-53,73]],[[670,1885],[57,14],[72,41],[72,34],[58,-13],[64,-76],[87,-28]],[[1319,3053],[-60,-231],[-53,-371]],[[1206,2451],[-41,6],[-95,1],[-235,-174],[-112,-1],[-197,29],[-137,7],[-146,29]],[[243,2348],[24,131],[27,65],[10,33],[-2,34],[-21,76],[2,30],[16,48],[81,108],[10,19],[21,-8],[14,-11],[12,-5],[19,11],[6,14],[59,289]],[[2446,3318],[44,-3],[22,-25],[-3,-69],[-28,-36],[22,-45],[9,-52],[-19,-33],[-66,-12],[-22,-27],[-15,-100]],[[2390,2916],[-85,0],[-148,0],[-70,-3],[-80,-36]],[[2007,2877],[-93,-33],[-63,-30],[-99,-24],[-55,-24],[-85,-142],[-51,-84],[28,-62],[22,-100],[34,-22],[32,-40],[-44,-12],[-43,-17],[-50,14],[-151,65],[-52,10],[-52,4]],[[1285,2380],[-95,39],[7,16],[9,16]],[[1966,2191],[-111,-14],[-105,-36]],[[1750,2141],[-35,13],[-40,-8],[-19,-14],[-6,-23],[-15,-23],[-28,-5],[-19,16],[-13,23],[-155,99]],[[1420,2219],[-49,30],[-27,3],[-19,68],[-40,60]],[[2007,2877],[43,-76],[123,0],[-84,-151],[-89,-83],[-65,-103],[-36,-118],[156,-48],[-46,-23],[-33,-34],[-10,-50]],[[2229,1528],[83,-37],[65,-57],[15,-37],[20,-27],[41,8],[40,2],[80,-7],[81,2],[78,18],[64,51]],[[3173,830],[-39,0],[-335,0],[-336,0],[-118,0],[-29,14],[-65,15],[-69,-34],[-70,-21],[-26,-14],[-66,-66],[-23,-18],[-44,13],[-40,4],[-92,-8],[-34,-8],[-22,-1],[-11,4],[-9,10],[-14,9],[-23,2],[-14,-12],[-2,-2],[-21,6]],[[1671,723],[4,13],[38,58],[27,62],[5,28],[13,28],[23,20],[37,51],[29,10],[35,42],[24,45],[2,96]],[[1908,1176],[92,-15],[-1,154],[-8,75],[10,33],[-2,33],[14,60],[75,-10],[35,6],[39,17],[67,-1]],[[2801,2512],[13,-146],[-37,-146],[2,-115],[18,-61],[32,-58],[52,-140],[34,-57],[15,-64],[-24,-63]],[[2229,1528],[17,54],[10,54],[55,80],[-202,150],[-45,45],[8,63],[-25,38],[-51,11],[-60,62],[30,106]],[[2390,2916],[141,6],[130,23]],[[1170,1318],[40,-44],[53,-11],[64,2]],[[1327,1265],[-26,-46],[7,-35],[63,-19],[123,-11],[54,13],[37,23],[38,-16],[40,-29],[49,-10],[28,13],[30,6],[26,-13],[19,3],[18,7],[13,13],[14,10],[48,2]],[[1671,723],[-27,8],[-25,-3],[-24,-10],[-29,-7],[-31,4],[-31,8],[-31,5],[-28,-10],[-15,-25],[-12,-73],[-9,-26],[-11,-9],[-31,-13],[-7,-6]],[[1360,566],[-1,0],[-47,2],[-55,-16],[-46,-42],[-59,-15],[4,51],[-37,18],[-67,5],[-62,19],[-23,43],[-15,51]],[[952,682],[-35,36],[-11,40],[2,32],[8,28],[36,30],[15,31],[-3,37],[6,39],[-33,29],[-40,24],[5,49],[30,63],[9,68],[-7,68]],[[934,1256],[46,7],[48,-3],[42,38],[45,34],[55,-14]],[[722,1703],[-4,-48],[-22,-41],[-4,-26],[-28,-10],[-25,-13],[29,-66],[70,-34],[53,-58],[34,-75],[109,-76]],[[952,682],[-250,65],[-58,10]],[[644,757],[-128,211],[6,37],[24,32],[-7,40],[-35,37],[29,144],[-105,155],[-17,47],[5,53],[-45,-2],[-44,9],[-33,47],[-8,58],[12,103],[-2,103],[-148,-18]],[[148,1813],[27,149]],[[175,1962],[370,-22],[125,-55]],[[1327,1265],[120,71],[159,147],[28,67],[12,56],[40,128],[2,73]],[[1688,1807],[-5,59],[54,50],[-7,120],[20,105]],[[1360,566],[-6,-5],[-5,-10],[-4,-25],[-4,-12],[-20,-32],[-24,-29],[-81,-74],[-28,-16],[-14,-4],[-14,-1],[-15,-3],[-14,-8],[-14,-24],[-11,-68],[-9,-27],[-20,-17],[-75,-28],[-54,-28],[-9,-5],[-24,-24],[-17,-38],[-19,-4],[-124,-66],[-41,-14],[-38,-4],[-36,10],[-31,28],[-18,37],[-4,72],[-9,37],[-51,72],[-20,10]],[[507,266],[-6,15],[-95,196],[49,36],[-56,42],[-66,71],[-5,19],[28,26],[22,31]],[[378,702],[2,22],[20,15],[9,51],[99,-5],[39,-39],[42,-24],[23,30],[32,5]],[[507,266],[-17,2],[-16,-5],[-16,-10],[-17,-19],[-11,-34],[-15,-9],[-13,5],[-39,22],[-22,5],[-44,-8],[-31,-15],[-28,-19],[-38,-21],[-34,-9],[-38,-2],[-74,3],[17,104],[0,33],[-7,20],[-22,35],[-1,19],[18,44],[1,15],[-10,38],[-19,27],[-15,28],[0,42],[22,109],[2,32],[-8,33],[-27,68],[-5,31],[5,21],[1,0]],[[6,851],[52,-22],[19,-11],[8,-21],[17,-8],[22,-2],[76,-29],[21,-12],[27,-10],[44,1],[86,-35]],[[6,851],[9,15],[7,17],[-2,26],[-7,33],[-2,18],[3,16],[20,31],[54,17],[21,24],[5,25],[5,106],[-4,37],[-17,68],[2,37],[23,138],[6,9],[10,7],[9,9],[2,14],[-4,11],[-14,18],[-3,11],[7,19],[17,5],[20,1],[15,10],[4,24],[-6,108],[-9,27],[-19,38],[-5,10],[-5,33]],[[2601,6814],[-68,0],[-30,-48],[-26,-57],[-53,-24],[-31,13],[-34,29],[-30,35],[-18,29],[-5,25],[0,27],[-4,21],[-18,10],[-129,2],[-26,7],[-5,30],[16,37],[23,36],[14,28],[2,31],[-7,65],[2,33],[8,18],[36,54],[4,13],[1,8],[4,22],[12,30]],[[7348,4926],[20,43],[35,39],[21,13],[23,1],[22,13],[76,36],[89,314]],[[8576,5322],[-3,-117],[3,-42],[24,-29],[46,-86],[-20,-94],[-16,-46],[-10,-49],[-22,-46],[-30,-43]],[[6868,4247],[6,63],[28,43],[22,44],[-10,25],[-3,24],[33,39]],[[6704,4994],[146,-24],[83,23],[83,4],[27,-28],[22,-34]],[[7869,4239],[9,158],[32,40],[64,31],[26,36],[-37,20],[-16,35],[21,31],[11,51]],[[6823,3205],[-88,-46],[-59,-44],[-13,-63],[-21,-73],[-74,-70],[-101,-159],[-119,-418],[-305,-553]],[[7104,830],[-281,0],[-335,0],[-335,0],[-110,0]],[[4227,2577],[-79,86],[-35,15]],[[4113,2678],[91,52],[136,55],[89,39],[67,85],[120,65],[105,25],[29,40]],[[4113,2678],[-68,29],[-109,16],[-46,-23],[-42,-27]],[[3848,2673],[-52,-7],[-53,11]],[[4813,8783],[37,-45],[9,-33],[19,-29],[11,-35],[72,-70],[22,-57],[95,-106],[68,-47]],[[4860,7382],[-39,19],[-78,19],[-65,43],[-85,0],[-65,7],[-65,37],[-435,-6],[-51,-44],[-26,-68],[-215,0],[-78,-38],[-84,-87],[-58,-56],[-81,-22]],[[4591,8840],[12,-19],[28,-27],[31,-16],[115,-22],[22,1],[12,15],[2,11]],[[4813,8783],[6,25],[0,27],[-7,63],[2,23],[21,24],[337,196],[81,18],[336,26],[288,23],[154,44],[144,70],[111,79],[32,11],[37,-14],[231,-181],[38,-20],[57,-10],[125,-6]],[[4677,5515],[19,55],[-14,32],[21,24],[56,51],[12,16],[18,19],[85,17],[23,19],[21,-8],[15,5],[14,9],[19,5],[21,8],[7,20],[2,22],[7,18],[31,11],[48,12],[35,20],[-7,35],[9,11],[3,16],[0,38],[4,16],[9,12],[26,26],[-24,8],[-20,4],[-14,9],[-5,21],[6,23],[25,47],[7,21],[-1,33],[-8,39]],[[5498,6418],[92,-3],[134,0],[32,-36],[38,-30],[69,-5],[38,-31],[79,-24]],[[6260,6898],[96,-21],[86,0],[43,31],[69,0],[81,-31],[26,-66],[38,-36],[86,-21],[139,-5],[91,-31],[27,-20],[176,0],[49,30],[57,-1]],[[7516,6903],[10,-88],[-34,-81]],[[6559,7176],[36,7],[27,-19],[31,-15],[42,14],[29,-2],[30,-9],[77,7],[75,-24],[35,18],[30,30],[39,-5],[43,-15],[33,14],[29,30],[82,-63],[105,5]],[[4043,6625],[59,64],[29,20],[34,12],[74,12],[30,13],[19,-9],[17,-1],[19,0],[20,-3],[20,-10],[45,-30],[38,-17],[74,-63],[18,-5],[57,-7],[19,-7],[44,-24],[58,-16],[61,-46],[43,-1],[20,9],[30,28],[12,9],[18,4],[65,-4],[2,0]],[[1163,4266],[1,1],[6,7],[8,28],[41,41],[13,33],[-10,71],[0,34],[23,21],[6,16],[5,18],[4,37],[5,12],[56,55],[15,7],[16,5],[17,-3],[20,-15],[31,-14],[23,22],[22,36],[31,23],[21,1],[42,-4],[24,3],[35,8],[25,11],[24,15],[36,30],[139,170]],[[9323,5296],[80,-48],[112,-166]],[[8949,5128],[36,73],[-58,73],[-80,50]],[[8082,2939],[-15,-20],[-107,-136],[-5,-35],[56,-181],[57,-180],[2,-68],[-34,-279],[-43,-362],[-31,-251],[7,-240],[11,-357],[-150,0],[-336,0],[-13,0]],[[9845,6472],[83,-191],[0,-34],[-17,-79],[-3,-34],[2,-36],[8,-35],[13,-31],[16,-18],[43,-39],[9,-19],[-7,-19],[-34,-42],[-8,-21],[-2,-341],[-11,-38],[-58,-118],[-13,-20],[-19,-17],[-18,-8],[-39,-8],[-18,-8],[-42,-61],[-39,-141],[-109,-86],[3,-29]],[[3772,2130],[208,0]],[[3093,1775],[-25,75],[21,80],[31,80],[17,89],[12,20],[20,13]],[[3848,2673],[44,-63],[26,-60],[41,-95],[32,-75],[15,-80],[37,-70],[-11,-40],[-52,-60]],[[1420,2219],[-74,-59],[-123,-27],[-86,-48],[-43,-35],[-14,-193]],[[175,1962],[13,73],[5,30],[31,172],[11,63],[8,48]],[[1130,1478],[58,-96],[-18,-64]],[[1425,1726],[21,62],[242,19]],[[9085,4526],[-38,-35],[-18,-32],[-15,-35],[-9,-38],[-1,-40]]],"transform":{"scale":[0.0005458558957895784,0.000569546741574152],"translate":[29.54845951300007,-1.475205993999836]}};
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
