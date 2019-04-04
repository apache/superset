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
  Datamap.prototype.ugaTopo = '__UGA__';
  Datamap.prototype.ukrTopo = '__UKR__';
  Datamap.prototype.umiTopo = '__UMI__';
  Datamap.prototype.uryTopo = '__URY__';
  Datamap.prototype.usaTopo = '__USA__';
  Datamap.prototype.usgTopo = '__USG__';
  Datamap.prototype.uzbTopo = {"type":"Topology","objects":{"uzb":{"type":"GeometryCollection","geometries":[{"type":"Polygon","properties":{"name":"Bukhoro"},"id":"UZ.BU","arcs":[[0,1,2,3,4]]},{"type":"Polygon","properties":{"name":"Khorezm"},"id":"UZ.KH","arcs":[[-3,5,6]]},{"type":"Polygon","properties":{"name":"Karakalpakstan"},"id":"UZ.QR","arcs":[[7,-4,-7,8]]},{"type":"Polygon","properties":{"name":"Navoi"},"id":"UZ.NW","arcs":[[9,10,11,-5,-8,12]]},{"type":"Polygon","properties":{"name":"Samarkand"},"id":"UZ.SA","arcs":[[13,14,15,-11]]},{"type":"Polygon","properties":{"name":"Kashkadarya"},"id":"UZ.QA","arcs":[[16,17,18,-1,-12,-16]]},{"type":"Polygon","properties":{"name":"Surkhandarya"},"id":"UZ.SU","arcs":[[-18,19]]},{"type":"Polygon","properties":{"name":"Andijon"},"id":"UZ.AN","arcs":[[20,21,22]]},{"type":"MultiPolygon","properties":{"name":"Ferghana"},"id":"UZ.FA","arcs":[[[23]],[[24]],[[-21,25,26]]]},{"type":"Polygon","properties":{"name":"Namangan"},"id":"UZ.NG","arcs":[[-22,-27,27,28,29],[30]]},{"type":"Polygon","properties":{"name":"Jizzakh"},"id":"UZ.JI","arcs":[[31,32,33,34,-14,-10,35]]},{"type":"MultiPolygon","properties":{"name":"Sirdaryo"},"id":"UZ.SI","arcs":[[[-34,36]],[[37,-32,38,39]]]},{"type":"Polygon","properties":{"name":"Tashkent"},"id":"UZ.TA","arcs":[[-29,40,-40,41],[42]]},{"type":"Polygon","properties":{"name":"Tashkent"},"id":"UZ.TK","arcs":[[-43]]}]}},"arcs":[[[5335,2722],[-28,-33],[-58,-93],[-8,-9],[-6,-4],[-6,0],[-7,-1],[-4,-3],[-4,-4],[-44,-77],[-6,-13],[-3,-10],[-1,-6],[0,-6],[1,-6],[1,-6],[3,-10],[4,-9],[18,-37],[2,-5],[2,-5],[0,-7],[-1,-10],[-3,-5],[-3,-3],[-97,-56],[-31,-19],[-80,-51],[-28,-30],[-53,-93],[-9,-15]],[[4886,2096],[-17,36],[-14,14],[-18,-3],[-45,-36],[-15,-5],[-17,5],[-18,14],[-93,107],[-82,93],[-64,74],[-36,58],[-62,139],[-37,56],[-81,92],[-192,217],[-95,106],[-79,90],[-68,77],[-34,54],[-6,5],[-42,83],[-6,32],[-10,67],[-2,28],[3,25],[4,22],[4,22],[-3,25],[-18,61],[-2,24],[0,32],[-2,24],[-5,21],[-15,48],[-4,22],[-2,50],[-5,11],[-48,43],[-28,13],[-13,15],[-2,8]],[[3617,3965],[121,235],[30,103],[-7,40],[-19,45],[-95,166]],[[3647,4554],[132,98],[-1,16],[-165,356]],[[3613,5024],[206,120],[49,-1],[19,-66],[14,-39],[98,-179],[78,-215],[14,-12],[52,-18],[76,-46],[90,-79],[175,-167],[13,-36],[22,-34],[-1,-24],[69,38],[42,97],[34,112],[11,24],[11,14],[12,6],[11,-4],[11,-15],[12,-28],[3,-40],[1,-79],[8,-26],[25,-13],[158,-30],[13,19],[18,107],[11,9],[19,12],[77,5],[26,8],[18,13],[19,41],[7,-1],[5,-29],[12,-120],[6,-32],[8,-35],[20,-26],[20,-18],[58,-22],[176,-19],[28,13],[-14,-74],[-2,-31],[-2,-31],[1,-30],[1,-24],[2,-14],[0,-14],[-8,1],[-31,10],[-5,0],[-6,-2],[-4,-6],[-7,-16],[-1,-15],[-16,-76],[-12,-23],[-11,-16],[-13,-65],[-7,-20],[-68,1],[-13,7],[-13,13],[-12,16],[-11,5],[-13,0],[-20,-6],[-10,-8],[-5,-10],[-2,-12],[-1,-11],[0,-10],[3,-23],[15,-23],[-10,-46],[-5,-7],[-3,-2],[0,-3],[0,-4],[7,-17],[17,-28],[9,-17],[3,-8],[-1,-4],[-18,-4],[-3,-1],[-4,-4],[-4,-5],[-6,-1],[-9,-11],[-27,-89],[-8,-17],[-11,-16],[-10,-12],[-36,-25],[-4,-16],[-5,-8],[-2,-5],[-19,-37],[-9,-33],[-8,-31],[9,-29],[42,-93],[16,-17],[28,-24],[0,-7],[3,-11],[2,-10],[9,-6],[11,-1],[25,18],[9,-3],[5,-14],[70,-51],[10,-28],[5,-27],[0,-19],[2,-26],[5,-25],[11,-11],[14,-8],[9,-7],[10,-17],[9,-20],[3,-7],[3,-13],[6,-32],[1,-8],[2,-33]],[[3617,3965],[-1,3],[-5,27],[-4,11],[-21,45],[-8,25],[-12,74],[-7,17],[-19,32],[-6,16],[-5,26],[-7,54],[-18,100],[-6,24],[4,9],[-3,17],[-1,85],[-2,24],[-5,20],[-43,111],[-11,20],[-131,148],[-50,34],[-57,23],[-21,4],[-13,-10],[-8,-25],[-6,-42],[-14,-13],[-11,-37],[-17,-28],[-20,-16],[-22,-1],[-24,15],[-60,66],[-10,0],[-34,-9],[-4,11],[-1,11],[-3,3],[-3,-10],[-8,-20],[-4,-6],[-3,-5],[-28,44],[-41,15],[-117,-11],[-71,-36],[-35,-1],[-20,9],[-17,18],[-31,49],[-35,40],[-56,45],[-64,51],[-16,25],[-4,28],[7,96],[4,20],[8,17],[10,13],[24,19],[8,15],[-5,22],[-39,84],[-18,53],[-5,42],[15,33],[16,17],[18,2],[22,-10],[20,-20],[11,-8],[9,2],[7,16],[-1,17],[-6,16],[-7,14],[-8,11],[-27,25],[-9,14],[-7,15]],[[2425,5599],[7,12],[7,27],[-1,13],[-7,20],[-1,6],[-1,5],[2,5],[4,5],[9,3],[16,1],[12,8],[29,32],[12,15],[3,3],[9,2],[13,-15],[6,-5],[29,-11],[29,-5],[8,-10],[2,-25],[0,-54],[5,-19],[15,-37],[7,-30],[16,-45],[8,-16],[10,-11],[13,-4],[28,-2],[9,-8],[6,-19],[10,-47],[15,-41],[19,-33],[138,-192],[15,-5],[7,-4],[7,-7],[21,-37],[18,-25],[13,-8],[34,-10],[11,-10],[31,-53],[7,-17],[7,-35],[9,-7],[3,-3],[14,-9],[15,2],[10,12],[23,69],[10,17],[9,11],[10,9],[12,4],[31,0],[112,-42],[28,-18],[26,-25],[34,-41],[99,-169],[70,-172],[2,-4],[9,-7],[8,-4],[31,15]],[[3524,7518],[62,-159],[30,-41],[157,-65],[9,-8],[0,-12],[-3,-13],[-159,-449],[-149,-434],[-32,-114],[-13,-247],[0,-15],[1,-12],[67,-186],[11,-37],[-2,-7],[-7,-11],[-125,-108],[-13,-16],[0,-16],[5,-17],[250,-527]],[[2425,5599],[-13,32],[-17,22],[-61,36],[-31,-2],[-8,6],[-6,17],[1,15],[6,12],[10,5],[1,0],[34,20],[-1,47],[-12,59],[6,55],[9,11],[12,7],[10,11],[2,20],[-7,16],[-14,12],[-26,15],[-20,29],[-16,38],[-19,31],[-26,4],[-26,-5],[-51,7],[-123,-28],[-30,1],[-14,8],[-24,39],[-13,7],[-30,5],[-17,13],[-7,22],[-7,91],[-6,23],[-8,20],[-37,58],[-14,14],[-15,-2],[-17,-13],[-17,-7],[-17,-1],[-26,7],[-41,28],[-39,55],[-125,223],[-14,12],[-11,-27],[-8,-101],[-12,-35],[-24,-11],[-30,3],[-30,11],[-63,38],[-14,1],[-11,-5],[-31,-29],[-22,-15],[-10,-12],[-6,-17],[4,-23],[10,-15],[73,-52],[21,-24],[18,-42],[15,-56],[44,-106],[23,-43],[7,-9],[2,-10],[-2,-10],[-7,-7],[-37,-8],[-10,3],[-7,16],[0,19],[4,20],[2,22],[-6,43],[-15,30],[-20,22],[-58,42],[-13,3],[-10,-3],[-21,-13],[-10,-2],[-9,9],[-13,30],[-9,12],[-11,6],[-13,1],[-13,-4],[-11,-7],[-6,-12],[-5,-14],[-15,-26],[-16,-11],[-10,-13],[4,-31],[12,-41],[1,-19],[-5,-27],[-24,-83],[-8,-14],[-22,-11],[-5,-16],[4,-19],[8,-13],[2,-11],[-13,-14],[-11,-4],[-40,3],[-12,-4],[-32,-24],[-27,-9],[-82,22],[-56,-3],[-55,-41],[-47,-70],[-32,-92],[-21,-50],[-24,-28],[-56,-40],[-17,-34],[0,-46],[13,-95],[-1,-45],[-5,-38],[-1,-38],[11,-42],[13,-33],[6,-32],[3,-34],[-1,-42],[3,-33],[8,-33],[11,-30],[13,-22],[8,-9],[9,-7],[29,-11],[4,-5],[-1,-8],[-7,-12],[-12,-14],[-27,-21],[-12,-21],[-17,-50],[-12,-10],[-71,23],[-55,18],[-130,11],[-21,1],[-121,11],[-108,9],[-94,8],[-1,274],[0,274],[0,274],[0,274],[0,274],[0,274],[0,274],[0,274],[0,274],[0,274],[-1,274],[0,274],[0,274],[0,274],[0,274],[0,274],[0,1],[0,1],[1,0],[0,1],[1,0],[54,26],[55,25],[54,26],[55,25],[54,25],[55,26],[55,25],[42,20],[12,6],[55,25],[54,26],[55,25],[54,25],[55,26],[55,25],[54,26],[55,25],[73,32],[72,33],[73,32],[73,32],[34,15],[33,14],[34,14],[34,15],[35,15],[35,14],[35,15],[35,15],[47,19],[14,-2],[16,-10],[44,-43],[13,-13],[36,-35],[57,-55],[74,-73],[51,-49],[38,-37],[100,-98],[109,-106],[114,-111],[117,-114],[117,-114],[113,-110],[106,-104],[98,-95],[85,-82],[69,-68],[51,-50],[37,-35],[15,-25],[10,-32],[4,-29],[4,-62],[5,-27],[34,-82],[67,-106],[32,-51],[32,-51],[41,-70],[33,-57],[34,-57],[33,-57],[34,-58],[32,-56],[33,-56],[33,-56],[33,-56],[43,-74],[12,-8],[12,-7],[1,0]],[[6278,4738],[0,-4],[-72,-45],[-4,-18],[-8,-15],[10,-167],[1,-6],[2,-6],[3,-10],[5,-9],[3,-4],[8,-7],[53,-22],[3,-4],[2,-5],[1,-5],[1,-9],[0,-12],[-2,-21],[0,-20],[1,-6],[5,-21],[13,-35],[-16,-64],[-89,-271]],[[6198,3952],[-12,18],[-6,14],[-2,5],[-2,5],[0,5],[0,5],[3,19],[1,11],[-1,5],[-2,5],[-19,36],[-17,23],[-6,5],[-6,2],[-5,-4],[-42,-45],[-14,-9],[-11,-3],[-10,2],[-10,7],[-11,9],[-12,14],[-8,7],[-9,1],[-7,-4],[-7,-8],[-7,-12],[-5,-14],[-5,-15],[-8,-32],[-1,-19],[-1,-20],[5,-21],[5,-10],[2,-10],[0,-9],[-5,-14],[-4,-6],[-11,-8],[-3,-7],[0,-9],[6,-29],[2,-42],[-4,-26],[-8,-27],[-1,-8],[2,-9],[2,-6],[9,-12],[-1,-11],[-3,-8],[-14,-33],[-5,-15],[-4,-16],[-5,-27],[-15,-56],[-1,-9],[1,-6],[3,-2],[4,-1],[11,3],[5,0],[6,-1],[4,-3],[3,-7],[2,-8],[0,-9],[-3,-10],[-5,-10],[-38,-55],[-6,-6],[-126,-42],[-25,8],[-25,25],[-12,-6],[-11,9],[-12,14],[-23,13],[-9,16],[-15,33],[-6,1],[-2,2],[-12,3],[-53,38],[-8,1],[-4,-3],[-3,-6],[-4,-11],[-2,-8],[0,-6],[0,-15],[-1,-24],[-1,-6],[-1,-6],[-1,-4],[-2,-6],[-15,-35],[0,-7],[2,-5],[4,-1],[4,-1],[3,-3],[2,-5],[1,-6],[0,-6],[-3,-10],[-9,-31],[-1,-7],[-10,-62],[-4,-14],[-5,-6],[-8,-4],[-16,0],[-17,4],[-17,12],[-20,18],[-4,0],[-4,-2],[-3,-9],[-1,-7],[-2,-21],[-5,-7],[-5,-5],[-35,-14],[-28,-7],[-6,-2],[-3,-3],[-3,-4],[-1,-6],[5,-15],[17,-31],[11,-17],[5,-7],[5,-11],[17,-101],[1,-9],[0,-18],[-2,-11],[-1,-9],[-17,-62],[-1,-7],[7,-35],[31,-99]],[[5403,2754],[-11,-11],[-57,-21]],[[3524,7518],[48,13],[21,6],[20,5],[21,6],[20,6],[33,9],[33,9],[33,9],[33,9],[53,13],[53,13],[53,12],[53,13],[54,13],[53,13],[53,13],[53,13],[89,-12],[88,-12],[89,-12],[89,-12],[80,-11],[81,-11],[81,-11],[81,-11],[32,-4],[10,4],[10,5],[58,48],[56,46],[58,48],[57,47],[10,6],[11,6],[9,-2],[10,-3],[9,-13],[10,-13],[63,-121],[62,-122],[30,-46],[28,-45],[60,-57],[60,-56],[12,-15],[11,-15],[50,-154],[31,-97],[44,-135],[37,-116],[6,-1],[5,-1],[84,69],[84,68],[-13,-297],[-12,-296],[-2,-32],[-1,-31],[-3,-10],[-3,-11],[-7,-4],[-7,-4],[-2,-8],[-1,-8],[-1,-36],[-1,-197],[-3,-232],[1,-7],[1,-6],[2,-3],[3,-3],[70,-1],[64,0],[63,-1],[71,0],[2,0],[2,1],[2,0],[2,0],[2,-1],[2,-1],[2,-1],[1,-1],[10,-151],[10,-151],[19,-147],[19,-148],[25,-176],[24,-176],[13,-24],[13,-25],[15,-6]],[[6198,3952],[4,-5],[74,-4],[24,-11],[9,-4],[10,-2],[13,1],[15,5],[4,0],[3,-3],[3,-8],[4,-15],[3,-11],[1,-12],[-1,-16],[-3,-18],[-5,-18],[-1,-7],[-1,-7],[0,-8],[1,-57],[1,-20],[9,-62],[1,-6],[2,-6],[4,-5],[12,-9],[3,-4],[2,-5],[0,-9],[-2,-7],[0,-8],[2,-10],[16,-31],[0,-27],[-3,-11],[-2,-4],[-3,-4],[-11,-6],[-3,-2],[-1,-6],[-1,-6],[3,-54],[2,-6],[3,-5],[6,-3],[5,0],[5,1],[3,2],[12,9],[2,1],[4,0],[5,-1],[4,-5],[3,-7],[0,-16],[-2,-8],[0,-10],[1,-6],[21,-36],[7,5],[3,1],[3,1],[7,-18],[46,-20],[6,-2],[10,1],[4,2],[4,1],[9,-10],[4,-3],[5,-1],[6,3],[14,-3],[101,-30],[9,-24],[16,-112],[-2,-9],[-9,-4],[-5,0],[-15,-6],[-13,-7],[-18,-15],[-9,-11],[-5,-7],[-1,-5],[-1,-9],[-1,-17],[1,-11],[0,-8],[1,-6],[2,-12],[0,-7],[0,-14],[-2,-8],[-2,-5],[-5,-3],[-5,-2],[-18,0],[-8,-3],[-3,-12],[-2,-9],[-1,-83],[6,-19],[8,-16],[24,-34],[44,-62]],[[6673,2747],[-5,-11],[-8,-46],[-3,-48],[-1,-44],[-7,-40],[-5,-40],[-4,-2],[-5,3],[-6,-3],[-1,-2]],[[6628,2514],[-139,56],[-31,2],[-1,-6],[1,-12],[0,-6],[0,-6],[-1,-6],[-2,-5],[-3,-4],[-3,-3],[-7,-2],[-65,-4],[-8,3],[-4,2],[-4,4],[-3,4],[-3,7],[0,9],[0,19],[4,33],[-2,17],[-12,35],[-12,3],[-50,15],[-45,12],[-8,0],[-11,-5],[-9,-8],[-4,-6],[-4,-6],[-19,-46],[-6,-9],[-43,-28],[-5,0],[-7,3],[-10,7],[-34,44],[-15,15],[-11,-1],[-84,-31],[-3,0],[-55,-44],[-13,-12],[-9,-5],[-21,0],[-39,16],[-3,5],[-3,7],[-1,14],[-1,9],[0,8],[1,19],[0,18],[-2,7],[-2,6],[-14,18],[-18,19],[-30,47],[-6,14],[-4,9],[-1,7],[-6,38],[-1,6],[-2,4],[-3,4],[-3,3],[-4,3],[-5,1],[-19,1],[-6,-2],[-5,-5],[-1,-6],[0,-6],[0,-19],[0,-6],[-1,-6],[-2,-5],[-3,-4],[-12,-15],[-12,-10],[-7,-4],[-249,10]],[[6628,2514],[-5,-6],[-2,-6],[-2,-8],[-1,-17],[5,-47],[16,-25],[70,-40],[48,-2],[23,-15],[2,-5],[5,-13],[3,-6],[4,-1],[10,3],[4,-2],[5,-14],[1,-16],[-7,-93],[3,-29],[1,-1]],[[6811,2171],[-9,-11],[-10,-7],[-42,-3],[-8,-3],[-7,-4],[-3,-3],[-4,-5],[-4,-7],[-3,-9],[-2,-9],[0,-10],[5,-27],[3,-43],[14,-41],[1,-5],[1,-7],[0,-6],[-1,-8],[-1,-7],[-1,-7],[0,-6],[0,-7],[0,-6],[1,-6],[1,-5],[2,-13],[1,-6],[0,-7],[-2,-9],[-3,-10],[-6,-14],[-3,-10],[-1,-9],[0,-21],[-1,-6],[-2,-4],[-4,1],[-3,3],[-11,18],[-2,4],[-4,3],[-3,2],[-9,4],[-9,2],[-9,-1],[-7,-3],[-8,-6],[-6,-7],[-3,-5],[-4,-6],[-34,-109],[-6,-13],[-11,-17],[-5,-7],[-9,-8],[-23,-9],[-5,-17],[-6,-17],[-11,-18],[-21,-29],[-4,-8],[-3,-15],[-4,-21],[-6,-61],[-4,-28],[-2,-7],[-7,-13],[-65,-83],[-33,-30],[-7,-3],[-21,-6],[-5,-6],[-5,-10],[-9,-24],[-6,-24],[-3,-14],[-3,-14],[-3,-15],[-5,-12],[-71,-108],[-5,-10],[-3,-20],[-3,-46],[-3,-17],[-9,-29],[-18,-18]],[[6207,933],[-7,33],[-20,23],[-21,16],[-22,10],[-44,0],[-19,9],[-59,45],[-27,55],[-17,27],[-19,14],[-38,17],[-36,47],[-16,14],[-38,10],[-59,46],[-20,3],[-16,-11],[-29,-37],[-15,-13],[-40,-6],[-39,22],[-96,104],[-58,63],[-78,86],[-55,81],[-78,113],[-39,40],[-85,48],[-75,70],[-123,165],[-33,69]],[[6811,2171],[10,-16],[74,-20],[16,1],[44,24],[8,6],[8,4],[9,-1],[10,-5],[4,-4],[9,-14],[10,-3],[9,6],[10,11],[5,2],[4,0],[5,0],[5,-2],[9,-18],[20,-69],[10,-26],[6,-14],[6,-24],[0,-27],[-6,-19],[-7,-17],[-9,-12],[-10,-10],[-13,-4],[-10,0],[-7,-6],[-2,-26],[2,-12],[3,-11],[3,-11],[-1,-13],[-3,-7],[-14,-17],[-5,-18],[2,-22],[7,-45],[2,-24],[-2,-68],[1,-27],[5,-15],[14,-35],[3,-18],[1,-38],[2,-18],[6,-16],[23,-36],[21,-63],[10,-17],[30,-27],[46,-67],[15,-36],[2,-46],[-9,-70],[-15,-66],[-22,-56],[-7,-23],[-1,0],[-4,-21],[-3,-18],[-4,-15],[-6,-7],[-3,-4],[-9,-4],[-27,-6],[-18,-10],[-11,-17],[-24,-122],[-18,-55],[-42,-96],[-31,-49],[-30,-62],[-25,-71],[-17,-73],[-2,-50],[12,-95],[2,-50],[-3,-43],[-7,-40],[-11,-36],[-3,-18],[-2,23],[-7,16],[-10,10],[-12,5],[-21,-2],[-8,2],[-6,5],[-13,16],[-6,3],[-7,-1],[-11,-6],[-6,-1],[-4,-5],[-3,-12],[-5,-12],[-6,-3],[-10,13],[-11,50],[-13,11],[-12,-6],[-11,-13],[-19,-32],[-12,-14],[-11,-10],[-13,-6],[-14,-2],[-15,-5],[-22,-24],[-13,-4],[-13,9],[-7,18],[-4,22],[-6,21],[-12,17],[-26,17],[-11,12],[-6,18],[-9,52],[-8,10],[-12,6],[-23,28],[-11,8],[-28,1],[-53,-21],[-76,-5],[-7,-4],[-11,-16],[-6,-4],[-16,1],[-7,2],[-39,27],[-14,3],[-15,-2],[-11,-6],[-14,18],[1,22],[9,20],[11,19],[9,24],[-2,19],[-10,17],[-11,16],[-8,33],[2,43],[13,81],[2,47],[-4,94],[2,47],[20,58],[32,69],[22,67],[-6,25]],[[9463,3910],[0,1],[-1,5],[-5,27],[-1,17],[2,21],[2,23],[0,14],[0,6],[-1,6],[-8,12],[-30,14],[-7,1],[-4,6],[-11,25],[-9,10],[-5,-8],[-7,-13],[-10,-1],[-35,11],[-27,15],[-16,-2],[-12,-3],[-14,3],[-5,3],[-5,4],[-23,50],[-6,14],[-5,9],[-6,5],[-30,17],[-10,1],[-6,-2],[-3,-3],[-6,1],[-8,4],[-15,13],[-6,0],[-4,-3],[-1,-21],[-2,2],[-6,13],[-13,38],[-17,41]],[[9087,4286],[16,26],[-9,30],[-7,14],[0,8],[2,7],[19,27],[8,8],[7,18],[60,25],[20,-15],[24,18],[7,3],[12,0],[14,-2],[16,3],[77,-29],[10,-2],[9,3],[35,2],[9,3],[4,2],[2,3],[5,6],[14,100],[3,19]],[[9444,4563],[34,16],[21,4],[4,6],[7,31],[3,9],[11,13],[7,-8],[17,-40],[12,-12],[17,-8],[31,-5],[3,-3],[1,-5],[1,-6],[-1,-7],[0,-28],[10,-8],[15,-2],[11,-7],[25,-60],[18,-31],[22,-15],[25,-5],[76,11],[22,-10],[3,-35],[-2,-20],[7,2],[27,29],[43,31],[10,-10],[8,-17],[12,-13],[34,3],[13,-4],[5,-2],[3,-24],[-18,-37],[-27,-24],[-55,-32],[-50,-49],[-42,-16],[-20,-14],[-14,-33],[-7,-80],[-17,-12],[-21,15],[-11,0],[-5,-20],[0,-17],[-3,-17],[-6,-15],[-9,-11],[-23,-2],[-41,44],[-22,5],[-17,13],[-19,35],[-20,26],[-17,-12],[-2,-20],[13,-33],[0,-21],[-4,-20],[0,-13],[5,-11],[25,-28],[3,-10],[3,-14],[0,-28],[-6,-30],[-12,-26],[-14,-4],[-16,9],[-34,32],[-9,5],[-26,-2],[-8,3],[1,1],[2,11],[7,3],[10,1],[8,5],[3,12],[-6,7],[-10,1],[-5,0]],[[9189,3246],[-9,-3],[-15,7],[-11,8],[-13,15],[-6,17],[10,18],[15,1],[10,8],[21,25],[14,7],[3,-12],[-13,-77],[-6,-14]],[[8847,3412],[4,-1],[3,2],[6,8],[3,3],[15,6],[8,-2],[4,-11],[-4,-19],[-27,-29],[-9,-15],[1,-31],[26,-43],[-1,-37],[-7,-15],[-8,-4],[-19,-1],[-28,-12],[-8,2],[-7,10],[-2,13],[-2,10],[-12,1],[-6,-8],[-8,-12],[-8,-8],[-8,6],[-1,30],[25,62],[-2,35],[-7,8],[-16,5],[-7,7],[-7,15],[-14,50],[-3,19],[0,20],[4,21],[10,37],[18,16],[13,-13],[10,-29],[8,-33],[10,-20],[16,-16],[32,-22],[2,-2],[3,-3]],[[9463,3910],[-26,-2],[-10,-4],[-39,-34],[-5,-12],[-4,-22],[-8,-34],[-16,-24],[-50,-40],[-3,-17],[4,-18],[11,-12],[17,-12],[4,-5],[4,-4],[3,-9],[-4,-13],[-8,-3],[-9,2],[-7,5],[-5,1],[-3,-1],[-7,-3],[-23,3],[-23,9],[-21,-2],[-18,-29],[-11,-38],[-6,-16],[-10,-14],[-30,-28],[-8,-4],[-12,8],[-4,18],[0,49],[-4,24],[-8,27],[-10,14],[-11,-15],[-3,-22],[-2,-21],[-5,-14],[-14,-2],[-28,9],[-13,8],[-12,12],[-11,16],[-4,17],[-6,15],[-26,13],[-18,26],[-12,2],[-18,-3],[-10,1],[-8,6],[-6,11],[-5,12],[-6,8],[-9,-4],[-9,-22],[-5,-26],[-8,-21],[-18,-3],[-68,16],[-34,-9],[-21,-34],[-12,2],[-52,-8],[-83,-40],[-25,-3],[-24,3],[-24,26],[-10,51],[-8,55],[-15,40],[-13,8],[-11,-2],[-11,-5],[-13,-2],[-12,6],[-29,20],[8,42],[-2,5],[-5,9],[-1,2],[0,-1],[-7,18],[-1,3],[-1,6],[-1,25],[9,23],[17,18],[40,14],[6,4],[6,12],[14,37],[8,13],[8,5],[8,4],[9,6],[8,10],[20,40],[35,45],[9,13],[8,10],[5,4],[10,3],[2,5],[1,6],[2,4],[9,9],[0,1]],[[8606,4192],[15,15],[6,10],[6,13],[6,11],[10,7],[8,1],[16,-3],[8,2],[27,38],[12,0],[9,-6],[5,-5],[3,-5],[19,-4],[66,6],[-37,-79],[3,-5],[23,-4],[4,-4],[17,-26],[4,-4],[6,-3],[11,-4],[6,-3],[12,-15],[26,-23],[9,-4],[13,4],[38,56],[18,44],[12,15],[52,44],[48,25]],[[8606,4192],[1,10],[5,40],[-22,20],[-53,19],[-9,19],[-2,20],[6,15],[11,2],[21,-27],[11,-7],[1,22],[-5,11],[-106,187],[-18,25],[-2,3],[-1,4],[-12,19]],[[8432,4574],[5,28],[-2,88],[-2,27],[-12,31],[-12,24],[-3,10],[-2,8],[0,8],[1,7],[11,36],[2,8],[3,16],[-2,10],[-16,4],[-2,4],[-2,6],[-1,19],[-1,13],[1,9],[1,7],[29,58],[5,16],[7,28]],[[8440,5039],[4,0],[19,11],[72,64],[20,4],[11,-10],[9,-21],[33,-87],[6,-24],[1,-25],[-9,-74],[1,-21],[7,-16],[10,2],[11,9],[13,2],[11,-7],[11,-12],[9,-15],[8,-17],[11,-16],[12,-2],[25,6],[27,-8],[13,-9],[12,-15],[11,-9],[22,-5],[9,-11],[15,-39],[9,-9],[6,23],[-2,25],[-2,21],[1,17],[12,10],[14,-2],[7,-14],[7,-45],[5,-17],[8,-13],[7,1],[7,23],[14,29],[40,-53],[13,17],[3,42],[-5,206],[4,15],[8,-3],[28,-41],[25,-16],[20,6],[16,26],[19,64],[9,41],[2,23],[-2,22],[-16,33],[-6,20],[11,46],[7,13],[13,8],[13,-3],[7,-16],[3,-23],[0,-25],[-10,-67],[0,-15],[6,-3],[3,10],[3,13],[2,7],[7,-4],[3,-20],[5,-3],[5,6],[0,25],[4,5],[5,-3],[4,-7],[55,-125],[9,-36],[4,-39],[-2,-51],[3,-50],[16,-12],[46,12],[14,-18],[9,-19],[10,-9],[17,17],[13,17],[13,14],[15,3],[14,-13],[7,-23],[3,-33],[1,-34],[5,-62],[0,-24],[-4,-21],[-8,-28],[18,8]],[[8541,4478],[-1,20],[-7,29],[-8,21],[-14,19],[-16,10],[-9,-3],[7,-25],[0,-1],[10,-15],[17,-36],[10,-15],[11,-4]],[[7156,4153],[-1,-49],[-8,-12],[-32,-9],[-7,-3],[-4,-2],[-2,-3],[-2,-7],[0,-28],[-4,-44],[1,-7],[3,-4],[10,2],[10,5],[6,1],[1,-15],[-68,-247],[-3,-17],[-1,-19],[2,-32],[2,-10],[4,-9],[2,-5],[16,-4],[132,-4],[175,68],[2,-1],[1,-2],[-3,-9],[-3,-5],[-2,-7],[-3,-8],[-8,-46],[-2,-8],[-2,-11],[7,-21]],[[7375,3581],[-23,-10],[-12,-14],[15,-26],[26,-26],[20,-12],[6,2]],[[7407,3495],[-25,-52],[-9,-26],[-3,-13],[0,-9],[0,-8],[1,-7],[2,-11],[2,-6],[0,-2],[2,-4],[4,-21],[2,-12],[1,-6],[0,-11],[-1,-40],[-2,-6],[-2,-1],[-2,5],[-3,5],[-3,3],[-3,0],[-5,-4],[-1,-5],[2,-5],[2,-4],[11,-10],[3,-4],[1,-5],[0,-6],[-2,-9],[-3,-10],[-1,-19],[-1,-12]],[[7374,3180],[-1,1],[-7,1],[-6,-26],[-6,-193],[-3,-28],[-8,-24],[-14,-23],[-25,-25],[-8,-18],[2,-7],[4,-16],[-11,-8],[-36,-15],[-29,-5],[-28,4],[-48,27],[-87,4],[-199,82],[-27,1],[-22,-12],[-54,-61],[-47,-12],[-11,-17],[4,-53],[-2,-5],[-3,-3],[-2,-2],[-3,-1],[-15,3],[-9,-2]],[[6278,4738],[9,-4],[24,-9],[68,6],[57,5],[85,8],[62,6],[74,7],[48,4],[75,7],[75,7],[6,-3],[7,-3],[12,-9],[12,-10],[7,-4],[6,-3],[6,1],[5,1],[17,18],[17,17],[7,7],[8,8],[3,-17],[4,-17],[1,-1],[0,-1],[2,-7],[2,-6],[13,-26],[13,-27],[3,-10],[3,-11],[2,-23],[2,-23],[4,-10],[4,-10],[4,5],[3,4],[4,3],[4,3],[3,-1],[4,-1],[3,-6],[3,-7],[4,14],[4,13],[6,1],[7,1],[1,-13],[1,-12],[0,-2],[0,-1],[-1,-5],[-1,-6],[3,-1],[3,-2],[1,-1],[1,-1],[-7,-8],[-7,-8],[-2,-1],[-3,-2],[3,-2],[2,-2],[1,-3],[2,-3],[2,-7],[3,-7],[-1,-17],[0,-17],[-2,-20],[-3,-20],[-5,-20],[-4,-19],[-4,-16],[-5,-15],[-3,-8],[-3,-8],[-5,-8],[-4,-7],[-5,-6],[-5,-6],[-10,-7],[-10,-7],[-3,-4],[-2,-4],[-1,-5],[-1,-4],[2,-2],[2,-2],[11,-4],[12,-4],[9,-8],[8,-8],[27,-41],[27,-41],[19,-24],[20,-24],[23,-19]],[[7407,3495],[136,42],[27,-31],[4,-17],[2,-18],[-1,-18],[-5,-14],[-13,-4],[-42,11],[-12,-6],[-21,-29],[-7,-3],[-14,37],[-9,12],[-7,-22],[1,-11],[10,-13],[2,-9],[-1,-25],[1,-11],[3,-12],[51,-111],[2,-27],[-25,-16],[-13,32],[-9,52],[-12,41],[-12,13],[-4,-9],[2,-23],[6,-25],[13,-44],[0,-17],[-7,-23],[-3,-2],[-6,-2],[-2,-2],[-4,-18],[0,-2],[0,-5],[-1,-12],[-4,-8],[-8,6],[-15,40],[-10,12],[-20,-28],[-6,4]],[[7626,3620],[-18,15],[-13,3],[-95,-23],[-12,-7],[-20,-18],[-14,-3],[-33,9],[-13,-2],[-33,-13]],[[7156,4153],[45,-37],[69,-57],[1,3],[1,3],[3,6],[4,6],[5,-1],[4,0],[2,4],[2,4],[2,6],[1,5],[3,3],[3,3],[3,-1],[4,-1],[11,-9],[12,-9],[8,-2],[7,-2],[7,6],[6,6],[2,7],[1,8],[-5,5],[-6,5],[7,18],[7,18],[1,4],[0,4],[-2,7],[-3,6],[-1,8],[-2,7],[-1,7],[-2,8],[1,8],[0,7],[-7,3],[-8,2],[-2,3],[-3,2],[-3,5],[-2,5],[-2,11],[-2,11],[-3,50],[-3,50],[1,10],[1,9],[2,3],[2,3],[1,2],[2,2],[2,7],[2,7],[1,5],[0,6],[-1,14],[-1,13],[0,7],[1,6],[1,-1],[1,-1],[3,-2],[3,-2],[1,-1],[1,-1],[3,14],[4,14],[8,8],[8,9],[12,9]],[[7379,4498],[30,-43],[4,-10],[2,-12],[1,-28],[2,-9],[3,-3],[5,6],[2,0],[2,-8],[2,-21],[9,6],[13,-3],[13,-9],[9,-10],[5,-11],[7,-20],[4,-9],[4,-5],[16,-12],[6,-8],[3,-6],[6,-19],[1,-6],[-1,-14],[0,-5],[4,-6],[4,0],[4,1],[4,-2],[8,-12],[7,-14],[1,-16],[-8,-16],[9,-8],[8,4],[9,8],[8,5],[6,-5],[-2,-12],[-10,-25],[25,8],[11,-2],[7,-29],[10,-14],[3,-12],[-2,-10],[-10,-14],[0,-9],[5,-4],[5,6],[7,10],[5,5],[5,-4],[4,-8],[0,-9],[-14,-10],[-6,-16],[-6,-43],[6,1],[6,-1],[6,-3],[5,-6],[-11,-10],[2,-9],[6,-10],[3,-7],[2,-10],[2,-10],[1,-11],[-3,-10],[-8,-17],[-3,-9],[-4,-12],[-1,-8],[-12,-110],[8,-33],[4,-10],[1,-17],[-9,-48],[-3,-15],[0,-1]],[[8432,4574],[-7,12],[-26,17],[-22,-9],[-16,-126],[-32,-59],[-42,-39],[-61,-38],[-55,-66],[-107,-52],[-13,-10],[-11,-15],[-25,-49],[-14,-19],[-15,-7],[-18,10],[-8,10],[-6,13],[-10,28],[-7,12],[-14,15],[-7,10],[-23,55],[-13,19],[-19,3],[-9,9],[-7,12],[-8,10],[-10,2],[-19,-10],[-10,-8],[-8,-11],[-15,-30],[-9,-31],[-4,-36],[0,-44],[4,-63],[-2,-16],[-9,-8],[-35,-5],[-21,-22],[0,-25],[23,-62],[13,-67],[5,-21],[15,-43],[7,-23],[3,-26],[-4,-59],[-19,-5],[-22,14],[-15,-4],[2,-35],[43,-60],[0,-28],[-22,-16],[-29,2],[-53,24],[-20,16]],[[7379,4498],[6,3],[18,13],[5,11],[6,11],[11,48],[11,48],[8,14],[8,14],[20,13],[20,14],[7,19],[7,20],[4,7],[4,8],[6,3],[6,3],[12,3],[13,2],[10,8],[11,8],[10,11],[10,10],[5,8],[5,8],[2,6],[2,7],[5,57],[4,57],[0,10],[0,10],[-1,7],[-1,7],[-1,2],[0,2],[-2,2],[-1,1],[-3,5],[-3,6],[0,5],[-1,5],[1,4],[1,4],[3,3],[2,3],[14,10],[13,11],[6,2],[5,3],[6,-3],[5,-4],[3,13],[3,12],[7,11],[7,11],[16,15],[16,16],[5,1],[4,2],[9,-5],[9,-5],[4,1],[4,1],[11,11],[12,11],[4,2],[4,2],[18,-5],[17,-5],[3,3],[4,3],[-1,7],[0,6],[-5,14],[-5,13],[-1,7],[-1,6],[4,16],[4,15],[7,9],[8,9],[17,8],[16,8],[30,36],[30,36],[8,15],[8,14],[5,6],[5,6],[39,17],[40,17],[32,2],[32,2],[13,8],[12,8],[9,16],[8,16],[4,9],[4,9],[5,6],[4,5],[17,10],[16,9],[24,27],[24,28],[8,13],[7,13],[20,53],[20,52],[4,7],[4,6],[5,5],[5,4],[5,3],[6,3],[4,3],[5,4],[4,7],[3,6],[3,11],[2,10],[7,24],[7,25],[13,16],[12,17],[29,19],[28,18],[4,-1],[4,-1],[6,-6],[5,-6],[5,-8],[4,-8],[3,-7],[2,-8],[2,-12],[2,-11],[4,-7],[5,-7],[6,-3],[6,-4],[7,-2],[7,-1],[9,7],[9,6],[6,18],[6,17],[6,22],[5,22],[7,19],[7,20],[8,15],[8,15],[3,8],[3,8],[3,11],[2,11],[4,9],[4,8],[7,1],[7,0],[14,-6],[13,-6],[11,3],[11,2],[11,9],[11,9],[20,24],[20,25],[12,18],[26,29],[19,4],[18,-12],[82,-89],[18,-10],[2,-1],[-8,-44],[-22,-23],[-48,-22],[-82,-94],[-24,-8],[-29,1],[-24,-9],[-10,-44],[-2,-69],[-6,-20],[-21,-11],[-58,-11],[-17,-16],[-58,-76],[-25,-46],[-17,-56],[-14,-31],[-18,-18],[-19,-15],[-34,-42],[-95,-85],[-12,-31],[11,-38],[21,-18],[82,-14],[1,0],[21,-21],[10,-13],[9,-17],[14,-42],[9,-12],[10,-1]],[[7664,4891],[10,9],[1,-15],[4,-14],[15,-25],[9,15],[1,-5],[-4,-12],[8,-20],[17,-7],[19,36],[29,42],[22,17],[-6,9],[4,12],[-6,13],[-8,8],[9,24],[-2,19],[-21,22],[-18,3],[-14,15],[-20,0],[-31,-48],[-4,-38],[-15,-58],[1,-2]]],"transform":{"scale":[0.0017174519372937325,0.0008374409014901444],"translate":[55.975838663000104,37.18514740000006]}};
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
