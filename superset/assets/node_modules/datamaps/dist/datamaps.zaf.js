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
  Datamap.prototype.zafTopo = {"type":"Topology","objects":{"zaf":{"type":"GeometryCollection","geometries":[{"type":"Polygon","properties":{"name":"Northern Cape"},"id":"ZA.NC","arcs":[[0,1,2,3,4]]},{"type":"MultiPolygon","properties":{"name":"Western Cape"},"id":"ZA.WC","arcs":[[[5]],[[6]],[[7,8,-4]]]},{"type":"Polygon","properties":{"name":"North West"},"id":"ZA.NW","arcs":[[9,10,11,-1,12]]},{"type":"Polygon","properties":{"name":"Orange Free State"},"id":"ZA.FS","arcs":[[13,14,15,16,-2,-12,17]]},{"type":"Polygon","properties":{"name":"Gauteng"},"id":"ZA.GT","arcs":[[-18,-11,18,19]]},{"type":"Polygon","properties":{"name":"Mpumalanga"},"id":"ZA.MP","arcs":[[20,-14,-20,21,22]]},{"type":"Polygon","properties":{"name":"Limpopo"},"id":"ZA.NP","arcs":[[-22,-19,-10,23]]},{"type":"Polygon","properties":{"name":"KwaZulu-Natal"},"id":"ZA.NL","arcs":[[24,25,-15,-21,26],[27]]},{"type":"MultiPolygon","properties":{"name":"Eastern Cape"},"id":"ZA.EC","arcs":[[[-28]],[[28,-8,-3,-17,29,-25]]]}]}},"arcs":[[[2860,8395],[1,0],[33,-2],[3,-120],[-6,-6],[-2,-7],[-1,-11],[2,-10],[1,-1],[4,-20],[3,-6],[5,-3],[12,0],[6,0],[6,1],[13,0],[7,-1],[8,-1],[7,-3],[6,-5],[6,-1],[15,-2],[9,-2],[5,-4],[3,-4],[2,-3],[3,1],[8,1],[31,-17],[2,-6],[-4,-14],[0,-8],[2,-15],[-2,-8],[-7,-8],[-3,-8],[0,-5],[16,-41],[13,-16],[3,-3],[-1,-1],[-1,-2],[-6,-3],[-21,-6],[-6,-7],[-4,-10],[-1,-13],[1,-8],[1,-11],[6,-11],[5,-6],[8,-5],[23,-2],[19,-13],[41,-36],[10,-5],[9,-2],[23,-1],[13,-3],[9,-3],[26,-17],[6,-2],[3,1],[11,-1],[10,-7],[4,-5],[2,-3],[0,-5],[41,-4],[14,-3],[19,-10],[19,-7],[20,-5],[12,1],[10,9],[5,6],[2,1],[6,2],[10,1],[16,-2],[10,1],[6,2],[3,4],[-2,5],[-7,4],[-2,5],[2,5],[7,5],[8,2],[15,-2],[16,-1],[2,4],[-3,9],[-1,6],[1,10],[4,5],[2,4],[1,4],[11,-9],[12,-15],[-1,-41],[-2,-7],[0,-7],[2,-7],[3,-23],[12,-19],[0,-24],[13,-23],[144,26],[3,-7],[4,-8],[3,-28],[-2,-9],[-4,-7],[-15,-11],[-5,-8],[-5,-9],[3,-8],[5,-4],[12,-2],[7,-4],[13,-13],[1,-8],[-3,-5],[-3,-6],[1,-5],[37,-25],[13,9],[4,6],[1,3],[3,5],[3,4],[19,13],[3,8],[1,4],[1,3],[-2,10],[0,3],[2,10],[7,8],[5,8],[3,2],[4,1],[5,1],[3,3],[2,3],[3,5],[1,4],[0,7],[0,4],[4,9],[0,5],[-1,10],[-1,2],[-2,1],[-4,2],[-2,1],[-2,2],[-2,8],[-1,4],[1,4],[4,7],[1,3],[-1,2],[-1,3],[-1,4],[0,7],[2,4],[2,4],[2,2],[4,0],[6,0],[13,-1],[2,-1],[7,-5],[4,-12],[5,-9],[1,-7],[5,-5],[12,-2],[73,0],[9,0],[5,-2],[5,-2],[6,-5],[-86,-80],[-8,-1],[50,-75],[4,-1],[4,0],[6,3],[11,7],[4,1],[5,0],[4,1]],[[3972,7607],[0,-6],[0,-7],[-2,-6],[-13,-29],[-5,-8],[-9,-11],[-13,-10],[-11,-5],[-2,-6],[2,-4],[3,-5],[5,-3],[0,-5],[-1,-8],[-11,-29],[-5,-8],[-8,-10],[-8,-21],[-2,-26],[3,-11],[6,-7],[5,-2],[2,-3],[-1,-4],[-52,-87],[-50,-82],[-110,-177],[-32,-51],[-4,-5],[3,-5],[4,-15],[4,-6],[21,-21],[9,-6],[6,-2],[15,0],[2,-2],[2,-7],[3,-2],[10,0],[5,0],[4,-2],[21,-20],[14,-6],[19,-2],[5,-3],[3,-8],[1,-8],[2,-6],[4,-5],[6,-3],[7,-2],[9,-1],[7,-1],[6,-1],[14,-3],[11,-13],[46,-72],[4,-3],[3,-1],[2,-1],[4,-1],[5,0],[8,-10],[1,-3],[1,-1],[6,-3],[1,-2],[2,-2],[20,-6],[2,-3],[1,-9],[2,-4],[2,-3],[41,-28],[25,-23],[15,-9],[19,-7],[7,-6],[3,-7],[5,-6],[11,-1],[22,0],[16,-7],[16,-12],[17,-8]],[[4183,6583],[7,-58],[9,-7],[9,-11],[-3,-9],[-11,-11],[-1,-8],[4,-10],[4,-16],[-3,-9],[-13,-15],[3,-14],[-6,-9],[-7,-8],[-2,-9],[-11,-12],[-16,-15],[-4,-20],[-14,-7],[-62,11],[-71,-25],[-37,-6],[-7,-2],[-26,-15],[-19,-6],[-11,-10],[-18,-4],[-21,-8],[-32,-3],[-64,-2],[0,-8],[-6,-20],[-10,-10],[-5,-23],[-6,-61],[-77,-6],[-43,-12],[-28,1],[-13,-4],[-3,-13]],[[3569,6109],[-37,7],[-21,21],[-13,2],[-14,-5],[-14,-14],[-16,-8],[-17,-7],[-22,13],[2,9],[-5,7],[-12,8],[-39,16],[-33,4],[-17,-2],[-19,-6],[-12,-2],[-58,1],[-20,-16],[-30,-12],[-32,-34],[-11,-14],[-9,-8],[-52,-35],[-15,18],[0,4],[-5,14],[-17,6],[-22,6],[-33,2],[-21,6],[-32,1],[-28,13],[-43,10],[-20,23],[-21,17],[-18,10],[-87,33],[-13,-13],[-55,-101],[-18,-2],[-4,-9],[-4,-5],[-1,-6],[-1,-7],[1,-12],[-4,-17],[0,-1],[0,-3],[3,-4],[8,-16],[-10,-15],[-11,-2],[-27,-24],[-12,-14],[-27,-14],[-29,-5],[-30,4],[-15,5],[-18,3],[-19,-4],[-19,3],[-15,-2],[-23,-9],[-13,-19],[-26,-12],[-21,-12],[-19,-3],[-36,-8],[-15,-16],[-9,-6],[-7,-5],[-22,-6],[-9,-22],[-25,-38],[-36,-12],[-21,-4],[-27,-3],[-34,-9],[-19,-16],[-6,-16],[-3,-22],[-9,-20],[-37,-23],[-45,-1],[-18,6],[-11,1],[-27,-9],[-31,-5],[-20,15],[-11,3],[-9,12],[-13,9],[-13,14],[-11,6],[-10,4],[-12,7],[-11,11],[-6,20],[-23,36],[-13,30],[-7,26],[1,19],[12,6],[15,11],[34,34],[0,17],[-7,8],[-6,10],[-8,5],[-13,-2],[-29,-22],[-13,-5],[-15,-15],[-43,-25],[-26,-6],[-31,-1],[-11,-6],[-22,-7],[-13,-13],[-14,-5],[-9,-1],[-11,4],[-9,-6],[-6,-13],[-9,-17],[-3,-12],[7,-12],[1,-2],[2,-1],[2,-2],[-3,-4],[-27,-9],[-28,22],[7,37],[0,10],[-19,26],[-4,6],[-3,10],[-3,21],[9,12],[20,15],[2,4],[-4,21],[-4,10],[0,2],[1,6],[0,3],[-1,4],[0,4],[2,8],[-2,3],[-2,1],[-6,0],[-3,0],[-3,0],[-2,2],[-2,2],[-5,6],[-2,2],[-1,1],[-3,1],[-2,1],[-2,1],[-3,0],[-2,-1],[-3,-1],[-2,-1],[-3,0],[-2,-1],[-3,1],[-4,4],[-3,1],[-3,0],[-5,0],[-3,1],[-3,3],[-8,14],[-5,4],[-5,3],[-13,4],[-2,4],[0,5],[7,20],[-2,2],[-6,-2],[-17,-10],[-7,-2],[-5,-1],[-2,1],[-2,1],[-3,1],[-3,0],[-2,-1],[-5,-2],[-2,-1],[-3,0],[-3,1],[-2,1],[-3,3],[-5,2],[-7,3],[-6,1],[-24,1],[7,27],[10,14],[3,18],[-9,34],[3,11],[1,15],[2,9],[-3,9],[-5,6],[-3,10],[-12,8],[-4,9],[0,17],[-9,38],[4,12],[0,6],[-5,6],[-12,11],[-11,21],[-15,75],[11,27],[-10,24],[14,16],[1,48],[-45,12],[-21,16],[-12,15],[-17,16],[-20,12],[-28,12],[-33,19],[-25,-2],[-13,-8],[-7,-12],[-25,10],[-8,-12],[-14,-19],[-12,-31],[-20,-27],[-22,-25],[-22,-9],[-20,-6],[-17,5],[-12,5],[-9,6],[-8,2],[-7,1],[-9,0],[-9,-7],[-13,-10],[-11,-28],[-28,-20],[-7,-29],[-22,-22],[-4,-43],[-25,5]],[[603,6364],[-8,10],[-2,1],[-5,10],[-2,3],[-6,7],[-10,18],[-4,6],[-33,35],[-25,38],[-3,6],[-4,15],[-5,14],[-28,28],[-12,17],[2,15],[-12,10],[-26,36],[-4,10],[-9,8],[-29,39],[-3,4],[-1,10],[-4,13],[-2,3],[-1,11],[-24,32],[-7,13],[-1,16],[-11,32],[-29,52],[-3,14],[-1,2],[-3,2],[-2,2],[-1,5],[0,4],[-12,33],[2,0],[-2,5],[0,11],[0,6],[-12,23],[0,4],[-6,4],[-3,9],[-2,15],[-14,29],[-3,4],[-17,40],[-2,3],[-9,7],[-2,4],[-2,2],[-8,8],[-10,24],[-3,4],[-4,4],[-2,3],[0,9],[-2,4],[-4,6],[-4,9],[-2,10],[3,6],[-7,10],[-30,20],[-4,5],[-8,15],[-3,6],[-21,22],[-31,20],[-5,9],[-5,14],[-3,15],[2,8],[-2,3],[-4,7],[-1,3],[-2,2],[-4,0],[-4,1],[-3,1],[-10,17],[-7,4],[-12,10],[-1,2],[5,3],[3,6],[1,6],[-1,4],[8,3],[13,6],[12,5],[18,5],[35,27],[5,1],[4,-2],[2,-5],[2,-5],[2,-3],[7,-1],[10,6],[8,9],[5,6],[1,7],[1,9],[2,8],[7,4],[5,3],[-3,8],[-10,11],[-3,6],[-2,9],[2,7],[8,3],[4,-2],[5,-2],[5,-1],[4,2],[1,5],[-3,5],[-3,4],[-2,3],[2,4],[3,1],[10,0],[7,1],[-1,3],[-8,8],[-1,3],[1,2],[3,2],[2,-1],[2,-1],[7,0],[3,-1],[2,-1],[3,4],[4,32],[1,1],[8,7],[3,2],[4,-1],[4,-4],[5,-1],[6,2],[6,5],[6,2],[12,-3],[16,9],[5,2],[9,2],[5,0],[5,-2],[6,-6],[6,-8],[6,-7],[9,-4],[12,-2],[4,-7],[0,-9],[-2,-10],[3,-18],[10,-10],[14,-2],[30,5],[12,1],[5,-2],[2,-4],[1,-6],[1,-3],[5,-5],[1,-5],[1,-4],[1,-5],[4,-4],[7,-7],[2,-5],[1,-8],[-1,-11],[-4,-10],[-7,-4],[-8,-2],[-8,-4],[-6,-5],[-2,-6],[4,-7],[13,-13],[2,-9],[4,-7],[17,-4],[5,-9],[-3,-16],[-6,-17],[1,-12],[17,-2],[21,4],[19,2],[10,1],[9,3],[7,2],[7,-4],[3,-9],[0,-9],[2,-9],[10,-3],[15,-3],[6,0],[4,2],[9,4],[5,2],[15,1],[78,-13],[17,-5],[16,-8],[28,-18],[18,-7],[39,-10],[8,-1],[17,5],[41,4],[10,0],[20,-6],[11,-1],[9,3],[4,1],[5,2],[9,1],[2,0],[5,2],[2,1],[2,-1],[6,-4],[2,-1],[10,2],[17,8],[89,10],[97,-11],[8,-6],[12,-14],[4,-4],[4,-1],[16,-2],[5,-1],[2,-2],[8,-8],[18,1],[19,5],[27,11],[4,3],[5,6],[3,2],[15,1],[5,2],[1,5],[-18,23],[-3,9],[2,8],[8,12],[5,5],[6,4],[7,0],[11,-7],[5,0],[7,2],[37,7],[10,4],[8,5],[5,6],[13,32],[3,3],[4,2],[3,1],[4,8],[3,3],[4,4],[3,3],[3,3],[4,2],[5,1],[46,3],[8,3],[9,6],[11,3],[22,1],[14,3],[21,14],[12,5],[5,1],[15,-2],[5,1],[15,3],[0,12],[0,15],[0,23],[0,23],[0,22],[0,23],[0,22],[0,23],[0,22],[0,23],[0,23],[0,22],[0,23],[0,22],[0,23],[0,22],[0,23],[0,23],[0,22],[0,23],[0,22],[0,23],[0,22],[0,23],[0,23],[0,22],[0,23],[0,22],[0,23],[0,22],[0,23],[0,23],[0,22],[0,23],[0,22],[0,23],[0,22],[0,23],[0,22],[0,23],[0,23],[0,22],[0,23],[0,22],[0,23],[0,22],[0,23],[0,23],[0,22],[0,23],[0,17],[0,5],[0,23],[0,22],[0,23],[0,23],[0,22],[0,23],[0,22],[0,23],[0,22],[0,23],[0,23],[0,22],[0,23],[0,22],[0,23],[-1,5],[3,-7],[3,-3],[8,-4],[9,-11],[24,-15],[12,-12],[5,-2],[5,-1],[9,-1],[5,-1],[36,-17],[60,-39],[5,-5],[14,-25],[13,-16],[5,-9],[-1,-5],[-4,-7],[4,-6],[9,-4],[9,-3],[1,-10],[1,-3],[3,-2],[8,-3],[3,-3],[1,-4],[-2,-2],[-2,-2],[0,-3],[2,-3],[5,-5],[2,-4],[3,-12],[3,-5],[8,-4],[13,-4],[3,-4],[2,-8],[7,1],[-1,-4],[-2,-5],[0,-4],[5,-1],[4,1],[4,2],[4,0],[6,-4],[-13,-7],[-3,-6],[-1,-11],[21,-15],[3,-11],[-3,-4],[-10,-5],[-2,-2],[1,-5],[5,-1],[5,-1],[4,-2],[0,-5],[-4,-8],[0,-5],[4,-4],[12,-4],[5,-3],[4,-8],[10,-26],[-5,-8],[0,-4],[6,2],[5,2],[2,0],[6,-5],[0,-2],[12,-24],[4,-34],[-1,-29],[2,-8],[17,-24],[-1,-6],[-20,-23],[-9,-15],[-11,-14],[-27,-27],[-13,-20],[-7,-6],[-13,-8],[-2,-5],[-6,-22],[-2,-11],[2,-11],[2,-5],[8,-8],[2,-6],[-1,-9],[-10,-27],[0,-13],[3,-14],[5,-15],[6,-11],[3,-3],[3,-2],[7,-4],[4,-4],[5,-13],[2,-4],[2,1],[9,5],[30,11],[22,12],[12,5],[26,3],[20,-7],[19,-9],[61,-11],[14,1],[41,9],[6,0],[14,-1],[6,0],[39,8],[21,1],[11,-2],[23,-8],[39,-1],[28,-6],[10,0],[10,3],[27,14],[8,7],[6,7],[1,7],[0,8],[-4,18],[0,6],[6,5],[12,3],[15,2],[45,0],[29,6],[28,13],[23,18],[18,22],[15,32],[9,14],[18,15],[5,8],[5,2],[21,3],[7,2],[11,5],[25,18],[15,19],[11,6],[14,2],[21,-3],[8,2],[9,11],[8,14],[5,5],[9,5],[5,4]],[[9946,10],[-13,-7],[-14,-3],[-4,0],[-7,3],[-52,1],[-7,-1],[-17,2],[-8,2],[-6,4],[-3,3],[-2,6],[-1,5],[8,5],[11,9],[4,2],[3,2],[10,9],[4,3],[15,3],[16,-1],[43,-8],[22,-15],[13,-3],[-5,-11],[-10,-10]],[[9998,129],[-17,-4],[-22,2],[-14,6],[2,9],[16,5],[21,1],[15,-7],[-1,-12]],[[3569,6109],[5,-11],[-4,-3],[-3,-8],[-6,-5],[-2,-13],[13,-5],[10,-10],[3,-10],[-12,-13],[-7,-5],[-8,-3],[-4,-5],[0,-5],[-2,-8],[-6,-5],[0,-9],[1,-7],[-4,-10],[-19,-7],[-10,-13],[-67,-21],[-18,2],[-41,11],[-17,-6],[-22,-12],[-17,-27],[-17,-7],[-71,-7],[-23,-8],[-34,3],[-17,-15],[-21,-13],[-3,-16],[0,-17],[12,-15],[6,-18],[3,-13],[-2,-19],[16,-14],[8,-13],[19,-14],[-20,-16],[-30,2],[-32,-2],[-23,-8],[-9,-2],[-5,0],[-6,5],[-3,4],[-4,6],[-1,1],[-2,2],[-2,1],[-2,2],[-1,0],[-1,-2],[3,-10],[0,-14],[-7,-9],[-17,-4],[-10,-5],[-22,-21],[-3,-13],[-14,-16],[7,-16],[-7,-17],[-80,-93],[-4,-14],[6,-16],[73,-1],[58,6],[107,-4],[82,-13],[35,-12],[24,-14],[9,-27],[23,-23],[-7,-9],[-84,-28],[-10,-8],[-5,-6],[-18,-13],[42,-3],[12,3],[11,-2],[18,-5],[9,-10],[57,-20],[-22,-25],[0,-6],[0,-13]],[[3333,5227],[-2,1],[-22,-1],[-74,-13],[-10,-3],[-9,-4],[-8,-6],[-4,-8],[3,-9],[8,-5],[11,-1],[0,-3],[-161,11],[-2,3],[-3,11],[-1,3],[-14,1],[-6,1],[-4,3],[2,-6],[3,-2],[5,-1],[4,-3],[5,-6],[0,-3],[-3,-2],[-3,2],[-7,1],[-12,1],[-6,-1],[-5,-1],[-5,-1],[-7,0],[-37,8],[-15,7],[-6,2],[-5,2],[-4,6],[-1,4],[0,3],[4,1],[7,0],[-8,5],[-10,2],[-20,2],[4,-7],[6,-6],[7,-4],[8,-3],[-9,-2],[-11,2],[-52,13],[-10,1],[-12,0],[-9,-2],[-7,-2],[-25,-14],[-18,-8],[-21,-3],[-44,3],[-19,0],[-40,-7],[-9,-3],[-8,-4],[-14,-11],[-5,-9],[2,-6],[6,-5],[9,-3],[-7,-4],[-9,-3],[-60,-6],[-18,-6],[-11,-9],[-2,-7],[3,-13],[-5,-4],[-9,-12],[-3,-1],[-27,-12],[-19,-5],[-20,-3],[-20,-1],[-49,7],[-18,8],[-10,2],[-10,-1],[-20,-6],[-16,-3],[-3,-2],[-2,-2],[-3,-3],[-3,-2],[-31,-9],[-20,-3],[-20,2],[-76,20],[-19,3],[-45,3],[-22,-2],[-19,-6],[4,0],[-27,-6],[-9,-3],[13,-1],[11,-6],[6,-9],[-4,-8],[-9,-3],[-82,11],[-65,-7],[-19,-6],[-17,-9],[-25,-25],[-9,-6],[-9,-3],[-6,-1],[-3,-2],[-3,-4],[-5,-4],[-4,-1],[-15,-4],[-7,-4],[-9,-6],[-7,-6],[-2,-7],[-5,1],[-12,-2],[-19,-6],[-34,-18],[-13,-13],[6,-11],[0,-2],[-7,-2],[-13,-5],[-7,-2],[-8,1],[-7,2],[-7,3],[-29,15],[-7,5],[-8,4],[-74,-2],[-7,-1],[-8,-6],[-6,-1],[-5,1],[-3,2],[-2,3],[-3,2],[-23,10],[-35,26],[-24,10],[-8,4],[-7,6],[-8,5],[-12,1],[-11,-2],[-9,-5],[-4,2],[-4,0],[-4,0],[-4,-2],[2,4],[28,27],[2,5],[-2,11],[-8,13],[-9,12],[-9,8],[-7,4],[-6,1],[-32,-5],[-29,1],[-6,2],[-6,4],[-9,11],[-7,4],[0,3],[12,1],[5,6],[3,9],[5,9],[-8,-4],[-11,-13],[-5,-3],[-35,2],[-6,0],[-14,-4],[-45,-5],[-10,-5],[-1,-3],[-5,-1],[-5,1],[-5,2],[-4,5],[1,3],[3,5],[-3,14],[0,3],[2,4],[2,2],[2,2],[4,3],[4,8],[-1,6],[-7,14],[0,8],[4,4],[6,3],[6,7],[-19,21],[-8,3],[-27,5],[-44,3],[-43,-1],[-7,-2],[-3,-2],[-17,-5],[-8,-5],[-4,-3],[-4,-4],[-7,-5],[-2,-3],[-1,-5],[1,-4],[2,-3],[4,-1],[3,-3],[6,-17],[1,-4],[0,-3],[-4,-27],[2,-8],[8,-5],[-9,-2],[-12,5],[-11,7],[-7,7],[-11,16],[-2,5],[1,2],[2,6],[1,3],[-1,1],[-2,1],[-2,1],[-2,1],[-4,10],[-4,5],[-13,3],[-5,4],[-1,5],[2,6],[3,3],[4,1],[4,2],[2,6],[0,6],[1,4],[2,4],[3,4],[-7,0],[-3,-1],[-3,-2],[-7,8],[0,6],[4,5],[6,6],[7,8],[5,14],[4,9],[15,8],[18,0],[15,2],[7,14],[-2,8],[-9,11],[-2,5],[-2,8],[-12,35],[-12,18],[-3,8],[-4,1],[-21,19],[-8,4],[-4,2],[-1,4],[0,17],[-2,8],[-3,7],[-11,14],[-14,10],[-50,26],[5,6],[-3,8],[-12,16],[-6,11],[-11,11],[-1,4],[-5,5],[-21,15],[-8,4],[-10,2],[-6,7],[-5,7],[-6,6],[12,4],[7,1],[5,-1],[4,-5],[2,-4],[3,-4],[6,-2],[-2,-5],[3,-3],[13,-8],[8,-8],[6,-5],[6,-2],[8,3],[-2,5],[-10,7],[-3,4],[-1,7],[-1,2],[-2,1],[-5,1],[-3,1],[-10,7],[-4,4],[-1,4],[1,17],[-1,6],[-7,8],[-11,4],[-13,1],[-14,-2],[4,-6],[2,-2],[-5,-1],[-5,-2],[-9,-5],[-5,4],[-3,4],[-1,4],[-1,3],[-1,3],[-4,4],[-1,4],[3,7],[-2,3],[-6,11],[-3,9],[0,4],[2,3],[4,4],[3,5],[-3,5],[-10,10],[-3,1],[-2,2],[1,4],[2,0],[3,-1],[3,0],[2,2],[1,1],[7,5],[3,1],[4,0],[0,2],[1,2],[1,3],[0,3],[0,12],[2,5],[6,4],[11,3],[11,2],[7,0],[-3,-3],[5,-6],[24,-16],[20,-6],[18,3],[15,9],[56,42],[11,15],[7,15],[11,33],[1,16],[-2,28],[-2,6],[-6,9],[3,7],[11,10],[2,17],[-18,52],[-5,43],[-9,18],[-2,9],[1,17],[-1,9],[-5,8],[-6,5],[-5,7],[-3,6],[0,3],[0,3],[0,5],[-10,28],[-8,13],[-11,14],[-22,21],[-3,5],[-1,3],[-22,23],[-22,18],[-3,6],[-3,7],[-7,6],[-16,10],[-18,21],[-13,8],[-5,10],[-5,19],[-6,5],[-19,12],[-4,4],[-3,5],[-17,21]],[[4618,8990],[0,-33],[3,-11],[13,-18],[3,-9],[5,-1],[80,-6],[11,-3],[15,-7],[12,-4],[9,-2],[12,-1],[7,1],[28,13],[54,18],[19,11],[5,10],[5,4],[7,1],[6,-2],[3,-8],[6,-40],[11,-15],[17,-8],[15,-13],[7,-12],[3,-5],[6,-4],[50,-6],[36,-22],[35,-1],[21,3],[5,-3],[3,-11],[1,-2],[1,-1],[2,-2],[3,0],[3,-1],[4,1],[5,4],[17,21],[2,8],[1,6],[-1,2],[0,1],[0,1],[2,2],[5,3],[10,3],[10,0],[11,2],[19,-15],[5,4],[3,1],[6,2],[8,2],[70,-7],[5,0],[2,1],[1,0],[0,1],[3,2],[6,2],[10,1],[23,-5],[23,-1],[16,-4],[37,-12],[14,-7],[7,-8],[-2,-11],[-3,-8],[-6,-4],[-10,0],[-7,2],[-8,4],[-10,4],[-7,1],[-10,-3],[-3,-6],[1,-8],[11,-5],[5,-6],[5,-9],[5,-4],[10,-2],[16,2],[9,-3],[8,-4],[29,-36]],[[5497,8715],[-5,-34],[-19,-10],[-12,-3],[-25,-1],[-6,-2],[-5,-2],[-7,0],[-3,3],[-1,5],[5,4],[1,5],[-5,1],[-9,-1],[-12,-4],[-4,-6],[0,-7],[6,-22],[1,-1],[1,-4],[0,-6],[-2,-11],[-13,-14],[-11,-8],[-11,-6],[-36,-7],[15,-27],[2,-5],[2,-5],[-1,-3],[-4,-3],[-3,-1],[-1,0],[-1,-2],[1,-5],[1,-7],[-2,-9],[-9,-9],[-15,-4],[-7,-5],[-33,-5],[-36,-5],[-9,5],[-17,0],[-10,7],[-12,5],[-8,8],[-38,-11],[-31,-17],[-12,-46],[-11,-40],[-12,-12],[-15,-4],[-8,-9],[-29,-2],[16,-55],[-40,-23],[-24,-17],[17,-26],[2,-5],[2,-7],[0,-1],[0,-1],[2,-1],[4,-2],[15,3],[6,1],[6,3],[23,8],[8,7],[57,14],[8,-5],[1,-2],[3,-3],[5,-2],[5,-3],[41,-1],[-2,-13],[-5,-2],[-2,-1],[-2,-1],[-1,-1],[-2,-5],[-2,-23],[-7,-6],[-6,-10],[1,-10],[-4,-52]],[[5147,8131],[-4,-1],[-6,-5],[-2,-8],[-1,-8],[-1,-4],[-14,-17],[-5,-2],[-29,-6],[-6,-1],[-6,2],[-15,11],[-6,2],[-14,-1],[-11,-8],[-19,-18],[-18,-10],[-11,-4],[-4,4],[1,3],[2,4],[0,4],[-5,1],[-4,-1],[-7,-1],[-46,-1],[-21,2],[-15,6],[-10,13],[-6,5],[-7,-4],[-1,-7],[1,-26],[-11,6],[-14,10],[-3,1],[-10,-4],[-5,-4],[-3,-4],[-5,2],[-6,4],[-3,-1],[-5,-4],[-11,-2],[-8,-4],[-13,-9],[-2,-3],[-2,-3],[-1,-3],[0,-3],[-2,-4],[-3,0],[-4,2],[0,1],[-4,1],[-5,2],[-7,1],[-7,-1],[-6,-4],[-13,-12],[-3,-4],[-1,-6],[2,-6],[-1,-5],[-6,-5],[-12,4],[-5,0],[-12,-12],[-8,-5],[-27,-6],[-9,-9],[10,-11],[16,-11],[8,-9],[0,-23],[-1,-1],[-2,1],[-4,-2],[-6,-7],[-3,-8],[3,-6],[12,-2],[5,-1],[4,-1],[4,-2],[1,-3],[-2,-1],[-46,0],[-9,2],[-13,0],[-6,-1],[-5,-3],[-4,-8],[-1,0],[-1,-1],[-4,1],[-5,3],[-3,1],[-12,-2],[-11,-5],[-8,-9],[-3,-10],[0,-4],[1,-3],[-1,-2],[-4,-3],[-2,-1],[-8,-2],[-3,0],[-41,-31],[-6,-6],[-4,-4],[-1,-1],[-11,-16],[-1,-2],[0,-2],[1,-2],[0,-2],[6,-7],[1,-2],[0,-2],[-1,-2],[-1,-2],[-2,-1],[-2,-1],[-3,-1],[-4,0],[-4,0],[-4,1],[-3,2],[-2,3],[-1,3],[-1,6],[-2,6],[-2,9],[-1,2],[-2,1],[-5,1],[-32,5],[-5,1],[-11,-1],[-3,0],[-4,2],[-4,2],[-7,5],[-5,6],[-5,2],[-10,-1],[-49,-21],[-12,-8],[-2,-2],[-4,-4],[-3,-1],[-4,-1],[-2,1],[-6,1],[-9,4],[-5,2],[-5,0],[-4,-2],[-5,-5],[-2,-2],[-3,-1],[-8,-3],[-5,-1],[-3,0],[-4,2],[-3,1],[-3,-1],[-2,-2],[-3,-3],[-29,-6],[-8,-4],[-33,-23],[-3,-1],[-6,-2],[-6,0],[-5,0],[-5,-1],[-5,-3],[-8,-8],[-2,-2],[-4,-1],[1,-3],[2,-7],[-3,-5],[-7,-7],[-7,-7],[-7,-3],[-2,-1],[-5,-6],[-3,-1],[-11,0],[-5,-1],[-4,-2],[-3,-2],[-12,-17],[0,-3],[2,-3],[0,-2],[-10,-14],[-6,-6],[-7,-5],[-4,0],[-5,1],[-4,0],[-4,-5],[-1,0]],[[2860,8395],[1,1],[19,23],[0,5],[-1,4],[-1,3],[5,4],[14,3],[4,3],[4,5],[3,7],[1,9],[0,9],[-3,5],[-6,8],[5,6],[10,7],[7,6],[5,7],[-1,2],[-3,6],[-3,4],[-3,1],[-2,1],[0,5],[3,9],[6,8],[21,20],[3,4],[1,4],[1,5],[-1,5],[-2,3],[1,4],[6,3],[4,4],[-2,5],[-4,4],[-3,4],[0,3],[2,3],[3,7],[10,25],[3,4],[12,3],[5,5],[7,16],[4,5],[4,3],[5,3],[6,2],[5,2],[2,4],[1,3],[3,4],[18,14],[11,5],[11,-2],[3,-3],[2,-4],[3,-2],[6,3],[4,2],[35,14],[22,5],[23,1],[26,-4],[21,-6],[7,-2],[8,1],[16,4],[6,1],[6,-1],[4,-4],[8,-8],[6,-5],[4,-3],[14,-5],[12,-6],[49,-30],[3,-4],[6,-5],[26,-6],[4,-3],[5,-8],[3,-4],[5,-2],[9,-2],[4,-3],[18,-18],[21,-12],[7,-8],[9,-4],[24,5],[5,-1],[5,-2],[5,-4],[0,-3],[-2,-3],[0,-2],[10,1],[49,10],[24,0],[21,-9],[32,-30],[19,-11],[24,-3],[12,2],[10,3],[9,1],[21,-6],[35,-10],[24,-13],[17,-3],[34,3],[15,-3],[13,-3],[14,2],[28,6],[9,3],[28,16],[21,8],[18,2],[18,-2],[21,-5],[19,-3],[97,8],[34,13],[60,37],[10,24],[20,39],[5,9],[15,52],[41,72],[10,27],[14,20],[1,15],[13,24],[5,13],[0,16],[-4,30],[0,10],[3,2],[4,0],[15,4],[24,0],[7,2],[15,9],[71,18],[52,13],[22,2],[9,0],[9,-2],[8,-1],[10,-1]],[[5495,8072],[16,-7],[8,-1],[10,1],[11,-1],[4,-1],[3,-2],[2,-7],[1,-2],[2,-2],[2,-3],[5,-3],[3,-1],[3,1],[2,1],[5,4],[2,2],[4,1],[6,0],[3,-1],[2,-2],[5,-5],[5,-4],[3,-4],[12,-4],[2,-4],[-4,-5],[-3,-9],[6,1],[21,15],[6,3],[7,0],[9,0],[8,2],[-1,3],[-8,6],[-4,2],[-3,-1],[-1,0],[1,4],[13,6],[21,-6],[36,-19],[6,-2],[3,0],[4,-1],[5,-4],[5,-2],[5,1],[5,2],[4,1],[4,-1],[3,-3],[3,-2],[4,0],[4,2],[6,6],[3,3],[5,2],[4,1],[4,1],[5,3],[4,2],[6,0],[9,0],[21,-11],[4,-1],[4,-1],[2,-1],[-1,-6],[2,-3],[0,-1],[0,-5],[0,-2],[2,-1],[3,-3],[2,-1],[2,-2],[2,-4],[4,-8],[4,-7],[2,-2],[4,-4],[3,-1],[3,0],[2,1],[3,3],[3,1],[5,1],[11,1],[10,-1],[5,-1],[4,-1],[2,-2],[3,-4],[4,-2],[7,-4],[9,-2],[4,-2],[3,-2],[2,-1],[3,-2],[11,-2],[3,-1],[3,-1],[1,-2],[-1,-1],[-1,-2],[0,-2],[0,-2],[1,-3],[3,-1],[3,-1],[3,1],[3,0],[8,3],[4,0],[6,0],[4,-1],[16,-8],[7,-7],[2,-6],[2,-8],[2,-2],[3,-2],[3,-2],[1,-2],[0,-2],[-1,-3],[1,-2],[14,-12],[3,-2],[5,-2],[4,-3],[1,-2],[-1,-1],[-2,-2],[0,-3],[0,-2],[2,-2],[1,-1],[2,-2],[31,-30],[5,-3],[3,0],[3,0],[3,1],[2,1],[3,2],[1,1],[2,1],[3,0],[3,1],[5,-1],[3,1],[1,1],[1,2],[-1,4],[0,2],[1,2],[1,2],[2,1],[2,2],[3,0],[5,2],[4,0],[7,0],[11,-2]],[[6184,7855],[-22,-8],[-2,-4],[1,-2],[-1,-4],[-2,-5],[0,-3],[1,-2],[3,-1],[15,-4],[3,-1],[2,-4],[2,-4],[1,-11],[0,-4],[-1,-3],[-2,-1],[-27,-11],[-2,-2],[-4,-2],[-2,-2],[-3,-3],[-1,-3],[0,-3],[0,-2],[1,-2],[1,-2],[6,-7],[2,-1],[0,-3],[1,-2],[0,-3],[-2,-16],[0,-5],[2,-5],[5,-4],[1,-2],[1,-3],[-1,-3],[-1,-1],[-2,-2],[-3,-3],[-7,-17],[-3,-5],[-6,-6],[-2,-3],[-1,-3],[-1,-3],[1,-15],[0,-3],[-2,-2],[-1,-2],[-2,-1],[-6,-7],[-6,-10],[-2,-6],[-1,-4],[1,-2],[1,-2],[1,-2],[2,-2],[1,-1],[10,-6],[2,-2],[2,-1],[2,-4],[2,-7],[-2,-13],[-3,-5],[-13,-7],[-6,-5],[-4,-6],[-6,-9],[-3,-4],[-2,-3],[-1,0],[-6,-1],[-27,-1],[-6,-1],[-5,-2],[-3,-2],[-30,-31],[-7,-5],[-9,-3],[-12,-4],[-6,-2],[-3,-2],[-2,-1],[-16,-16],[-24,-3],[-9,-2],[-2,-2],[-10,-8],[-4,-5],[-3,-4],[0,-2],[1,-2],[0,-1],[2,-3],[0,-2],[0,-3],[-2,-5],[-3,-2],[-4,-1],[-5,-1],[-9,-3],[-5,-1],[-4,0],[-3,0],[-11,3],[-3,0],[-24,-4],[-32,-9],[-7,-7],[-9,-6],[-2,-3],[-2,-3],[1,-8],[-1,-4],[-1,-2],[-1,-2],[-12,-8],[-2,-3],[-2,-2],[-2,-8],[-10,-19],[-3,-5]],[[5760,7323],[0,1],[-7,3],[-8,2],[-15,2],[-3,2],[-14,20],[-7,4],[-20,0],[-5,6],[-4,17],[-3,8],[-4,6],[-6,6],[-9,5],[-7,-1],[-26,-14],[-9,-1],[-65,-4],[-10,-3],[-9,-6],[-12,-17],[-9,-6],[-10,-3],[-10,-1],[-11,1],[-9,3],[-6,0],[-25,-2],[-5,1],[-4,-5],[-6,-6],[-13,-14],[-2,-3],[-20,-16],[-18,-18],[-2,-4],[0,-3],[0,-2],[-5,-1],[-12,0],[-5,2],[-5,4],[-5,4],[-9,1],[-7,-3],[-3,-5],[-3,-7],[-5,-6],[-12,-4],[-53,3],[3,-7],[-5,-3],[-7,-2],[-4,-3],[0,-6],[0,-3],[-1,-2],[-1,-1],[-1,-2],[0,-3],[-1,-1],[-2,0],[-2,0],[-2,0],[-9,-10],[-5,-5],[-6,-2],[-7,-1],[2,-4],[6,-4],[4,-4],[-3,-1],[-5,-1],[-2,-1],[-3,3],[-3,-3],[1,-8],[1,-2],[-11,-15],[-26,-25],[-4,-1],[-4,-1],[-5,-3],[-3,-3],[0,-4],[3,-9],[0,-5],[-4,-3],[-4,-1],[-19,-5],[-8,-3],[-1,-4],[-1,-9],[-1,-4],[-5,-4],[-4,-2],[-4,-1],[-5,-3],[-1,-2],[2,-3],[3,-2],[1,-3],[0,-6],[-2,-2],[-3,-2],[-20,-16],[-5,-6],[-2,-7],[-2,-2],[-11,0],[-3,-1],[-1,-5],[-2,-4],[-3,-3],[-1,-1],[-2,-2],[-15,-7],[-10,-3],[-13,-2],[-9,-3],[-4,-2],[-14,-1],[-13,-4],[-3,-1],[-15,-12],[-2,-1],[-3,1],[-2,2],[-1,3],[-5,-1],[-2,-1],[-4,-7],[-3,-3],[-4,5],[-5,0],[-4,-4],[0,-6],[-6,-10],[4,-2],[7,-4],[6,-2],[6,-4],[14,-16],[4,-6],[38,-69],[13,-23],[9,-8],[22,-14],[7,-8],[6,-19],[3,-6],[6,-6],[4,-2],[6,1],[10,0],[7,-1],[5,-3],[-1,-4],[-7,-5],[-10,-19],[1,-12],[10,-21],[0,-7],[5,0]],[[5071,6704],[0,-1],[-4,0],[-3,0],[-6,-2],[6,-9],[4,-8],[4,3],[5,0],[3,-2],[3,-4],[-7,-7],[-9,-1],[-11,2],[-9,-3],[-1,-7],[9,-5],[6,-4],[-10,-5],[-3,1],[-12,4],[-4,0],[-3,-4],[1,-3],[5,-3],[5,-1],[3,-1],[-3,-5],[-6,-6],[-4,-1],[-6,-1],[-11,1],[-2,2],[-2,2],[-2,1],[-3,0],[-1,-2],[-2,-1],[-8,0],[-4,-2],[-6,-4],[-19,1],[-7,-1],[0,-3],[2,-4],[0,-3],[-9,-5],[-9,0],[-9,3],[-10,2],[-22,-3],[-5,-2],[3,-5],[10,-7],[3,-7],[-4,-2],[-18,1],[-10,-2],[-8,-6],[-4,-6],[3,-8],[-5,-4],[-6,-1],[-13,0],[-7,-2],[-7,-6],[-5,-1],[-8,3],[-6,5],[-7,5],[-12,1],[-4,-2],[-10,-5],[-4,-1],[-4,0],[-2,0],[-1,0],[-4,0],[-3,-2],[-5,-3],[-3,-1],[-6,1],[-3,1],[-3,1],[-6,0],[-10,-4],[-4,0],[4,4],[0,3],[-8,2],[-10,1],[-21,0],[-8,1],[-20,9],[-5,3],[-2,3],[-2,11],[-7,7],[-4,3],[-3,1],[-61,-9],[-14,1],[-7,7],[-3,8],[-7,3],[-9,1],[-9,3],[-6,5],[-3,5],[-7,4],[-11,2],[-4,-3],[1,-7],[-2,-6],[-13,0],[-17,5],[-6,0],[-26,-6],[-8,-3],[-7,-4],[-5,-3],[-2,-2],[-8,-3],[-15,8],[-3,1],[-4,0],[-6,-2],[-2,-2],[-1,-2],[-1,-2],[0,-2],[2,-4],[0,-3],[-5,-5],[-11,-8],[-30,-16],[-14,-6],[-9,-3],[-13,1],[-6,1],[-9,5],[-3,0],[-11,2],[-3,1],[-2,2],[-1,1],[-1,3],[-1,9],[-1,3],[-2,1],[-15,2],[-27,-2],[-7,0],[-18,-2]],[[5147,8131],[5,1],[11,0],[-3,8],[6,3],[9,0],[4,2],[3,2],[6,-5],[5,-7],[2,-3],[7,0],[33,3],[2,-1],[3,-4],[4,-3],[5,0],[4,2],[1,2],[-1,4],[2,3],[8,3],[11,3],[21,2],[11,2],[7,6],[6,6],[7,6],[10,4],[5,1],[5,-2],[9,-6],[3,-4],[-2,-2],[-4,-4],[4,-10],[19,-27],[6,-6],[13,-4],[9,-4],[9,-6],[6,-5],[3,-3],[3,-1],[10,6],[5,0],[3,-8],[1,-2],[2,-3],[2,-1],[6,-3],[12,1],[9,3],[5,0],[3,-1],[3,-1],[1,-2],[9,-4]],[[5497,8715],[32,2],[6,-4],[27,0],[24,9],[8,8],[11,4],[25,1],[14,-2],[16,3],[5,3],[3,2],[1,2],[-1,1],[-1,7],[-8,4],[-9,10],[-4,3],[-4,11]],[[5642,8779],[9,2],[40,5],[19,10],[36,2],[11,-13],[3,-4],[4,0],[12,5],[7,2],[4,-1],[2,-2],[-1,-4],[-2,-3],[-6,-5],[-2,-2],[0,-4],[1,-7],[0,-6],[-2,-3],[-3,-2],[-2,-1],[-2,2],[-5,7],[-5,2],[-5,-3],[2,-13],[3,-8],[1,-5],[-2,-5],[-3,-4],[-3,-4],[-19,-12],[1,-8],[27,-9],[20,5],[10,7],[18,1],[12,3],[22,-5],[12,5],[35,7],[8,-1],[16,-4],[16,1],[8,-3],[1,-7],[-4,-7],[-10,-18],[-27,1],[-9,-8],[-3,-6],[-6,-8],[-11,-3],[-3,-5],[-2,-1],[2,-2],[-2,-3],[-3,-9],[-13,-11],[-9,-27],[-26,-19],[-6,-11],[2,-10],[-4,-16],[-8,-14],[0,-9],[-2,-9],[-3,-5],[-7,-7],[-16,-8],[-17,-37],[-3,-15],[-34,1],[-8,5],[-14,2],[-4,2],[-50,0],[-2,-2],[-12,-13],[-5,-8],[-5,-8],[-6,-2],[-17,1],[-6,-2],[-5,-1],[-12,-7],[10,-19],[6,-3],[8,-14],[6,-15],[5,-7],[24,-13],[3,-3],[2,-4],[1,-12],[31,-5],[20,-5],[55,7],[20,-33],[-48,-30],[-5,-5],[-3,-2],[-6,-5],[-46,-8],[-7,-5],[-18,-1],[-15,-4],[-10,-8],[-7,-11],[-3,-2],[-3,0],[-8,-2],[-5,-4],[-6,-7],[-11,-5],[-24,-15],[-10,-17],[0,-3],[1,0],[1,-2],[2,-4],[-1,-7],[-12,-6],[-7,-7],[-8,-6],[-3,-10],[2,-6],[-6,-18]],[[6869,7944],[-27,-27],[-17,-10],[-21,0],[-14,-3],[-7,-2],[-37,-8],[-13,2],[-11,7],[-5,6],[-8,3],[-17,-3],[-6,-3],[-4,-2],[-4,-1],[-7,2],[-11,5],[-17,7],[-4,1],[-6,3],[-5,2],[-17,4],[-5,0],[-8,-1],[-14,-3],[-6,-2],[-4,-2],[-6,-6],[-11,-1],[-33,4],[-28,-3],[-6,3],[-2,1],[-1,3],[0,4],[0,2],[-2,2],[-2,1],[-9,1],[-3,0],[-4,-1],[-5,-3],[-4,-4],[-3,-1],[-11,1],[-3,-1],[-4,-1],[-5,-2],[-4,-1],[-7,-1],[-9,-4],[-14,-9],[-4,-2],[-25,-7],[-2,-2],[-2,-1],[-1,-2],[-2,-4],[-10,0],[-36,7],[-7,-3],[-8,-5],[-3,-1],[-3,0],[-25,5],[-4,1],[-3,1],[-3,0],[-3,0],[-19,-4],[-8,-1],[-3,0],[-3,-2],[-4,-2],[-3,-4],[-1,-2],[-3,-7],[-5,-7],[-4,-5],[-3,-3],[-5,-2],[-12,4]],[[5642,8779],[-41,-11],[-5,-2],[-9,-5],[-9,-4],[-16,-3],[-19,-2],[-11,3],[-5,7],[-2,4],[3,5],[6,4],[17,5],[17,8],[6,7],[8,4],[12,3],[12,2],[19,5],[8,7],[3,12],[0,7],[2,6],[39,14],[14,7],[9,3],[12,3],[10,0],[25,-2],[37,2],[12,-4],[0,24],[21,2],[14,-2],[8,-9],[3,-2],[18,-27],[40,15],[4,4],[9,18],[2,9],[7,7],[12,8],[36,8],[20,10],[34,11],[1,-12],[2,-12],[0,-5],[0,-4],[-4,-3],[-2,-1],[-2,-1],[-2,-1],[-2,0],[-3,0],[-3,3],[-2,1],[-2,-1],[-2,-2],[-3,-2],[-5,-6],[-2,-3],[0,-3],[9,-16],[1,-2],[1,-4],[0,-7],[-1,-3],[-1,-3],[-2,-1],[-3,-1],[-1,-1],[-5,-4],[-2,-2],[0,-1],[1,-3],[2,-2],[1,0],[2,-1],[2,1],[8,5],[1,0],[4,1],[4,0],[24,-20],[4,-9],[7,-9],[4,-3],[4,0],[5,-2],[7,-5],[16,-15],[12,-9],[22,-5],[31,-2],[38,9],[6,10],[9,4],[3,10],[-11,11],[-6,4],[-3,5],[2,7],[14,5],[9,10],[0,2],[49,34],[62,37],[23,10],[7,13],[2,13],[-11,16],[1,34],[18,6],[9,2],[8,-3],[11,-6],[5,0],[5,2],[8,10],[18,0],[21,3],[19,4],[55,-10],[23,-8],[19,5],[8,7],[5,10],[3,8],[10,5],[8,-3],[31,7],[3,17],[3,6],[9,14],[36,-28],[15,-6],[46,-8],[8,-12],[32,-4],[13,-24],[8,-7],[8,-4],[9,-1],[10,0],[5,0],[4,-1],[2,-5],[-3,-6],[-8,-9],[-25,-6],[-7,-6],[3,-8],[18,-5],[9,-6],[6,-6],[6,-20],[9,-16],[10,-7],[-4,-8],[-25,-4],[-15,-7],[-6,-9],[-1,-22],[52,4],[14,2],[1,2],[1,2],[0,2],[0,1],[2,1],[2,2],[3,1],[3,0],[9,0],[3,1],[3,1],[3,2],[3,0],[31,0],[15,-2],[4,-1],[18,20],[-1,8],[0,10],[-5,6],[-25,5],[-9,2],[-7,1],[-5,3],[-1,9],[5,23],[17,9],[21,4],[20,3],[12,4],[6,11],[4,5],[6,3],[8,0],[8,1],[5,4],[2,4],[-4,6],[-8,9],[-52,28],[-4,6],[0,7],[0,3],[1,2],[-2,2],[0,3],[-36,1],[13,18],[-8,12],[31,61],[2,24],[11,18],[-13,15],[-28,3],[-66,3],[12,10],[7,1],[18,-3],[3,1],[2,1],[5,3],[3,2],[6,3],[3,1],[4,0],[3,-1],[4,-1],[3,1],[3,1],[4,3],[7,7],[4,3],[3,0],[3,0],[5,-1],[2,-1],[14,-3],[6,-3],[4,-1],[6,-1],[3,1],[7,4],[3,1],[3,-1],[3,-4],[2,-1],[3,-1],[3,0],[2,1],[2,1],[5,7],[2,2],[2,1],[5,2],[3,1],[3,0],[2,-1],[2,-2],[2,-1],[0,-3],[1,-2],[2,-3],[3,-2],[9,-2],[5,0],[4,1],[3,1],[2,1],[1,1],[1,1],[2,13],[1,1],[1,1],[21,15],[3,1],[2,-1],[5,-1],[2,-1],[6,0],[7,0],[4,1],[4,1],[2,1]],[[7153,9260],[3,-64],[3,-17],[27,-46],[16,-28],[12,-31],[2,-31],[-4,-27],[1,-56],[0,-68],[1,-48],[0,-64],[1,-88],[-8,-19],[-2,-11],[-1,-13],[2,-12],[5,-9],[3,-8],[4,-25],[0,-9],[-2,-5],[-3,-3],[-5,-2],[-6,-5],[-3,-4],[-20,-41],[-3,-11],[2,-12],[18,-46],[-26,-11],[-14,-2],[-13,3],[-41,21],[-7,3],[-43,22],[-49,25],[-50,25],[-11,3],[-14,0],[-16,-4],[-13,-5],[-47,-32],[-41,-29],[-6,-8],[-7,-22],[-25,-47],[-32,-43],[-34,-34],[-43,-42],[-10,-30],[1,-43],[0,-56],[5,-28],[3,-9],[8,0],[8,2],[8,3],[7,5],[5,5],[3,-6],[8,-18],[6,-7],[13,-11],[5,-6],[3,-8],[-1,-10],[-4,-16],[1,-10],[11,-14],[48,-33],[22,-26],[7,-6],[7,-4],[41,-10]],[[4618,8990],[1,0],[30,25],[3,4],[14,29],[11,12],[13,8],[30,16],[29,23],[4,6],[9,5],[41,10],[10,5],[8,5],[5,7],[8,35],[1,18],[33,107],[2,11],[-3,8],[13,19],[-1,4],[-1,4],[2,7],[9,13],[8,16],[5,3],[5,-1],[2,-5],[4,-5],[8,0],[7,4],[0,6],[-3,7],[-1,8],[3,-1],[3,-2],[2,4],[3,2],[8,5],[-3,0],[4,5],[4,3],[5,1],[6,-3],[2,5],[-2,2],[-4,3],[-2,5],[2,3],[4,1],[6,-2],[3,-4],[3,3],[3,3],[1,3],[3,-3],[4,-2],[4,0],[5,2],[-7,8],[6,4],[17,5],[18,7],[8,5],[7,5],[11,14],[7,5],[5,-13],[5,2],[4,5],[2,3],[5,2],[7,2],[4,-1],[-3,-6],[6,-3],[5,3],[3,4],[5,4],[6,2],[19,1],[10,2],[10,5],[6,7],[3,9],[-1,3],[-1,3],[-1,3],[2,1],[1,1],[2,1],[1,3],[0,2],[2,6],[9,8],[4,11],[5,0],[7,-3],[6,-1],[6,1],[18,12],[13,-11],[6,-2],[7,2],[2,4],[7,16],[1,0],[4,2],[0,1],[2,0],[-1,2],[-2,2],[0,1],[-1,2],[-2,3],[-2,3],[1,3],[5,-1],[10,0],[8,2],[-3,7],[17,4],[20,6],[16,9],[7,12],[-4,17],[0,9],[6,4],[9,1],[9,3],[9,4],[6,3],[8,6],[5,8],[2,9],[-4,9],[1,4],[9,3],[11,3],[7,2],[1,3],[3,6],[2,2],[4,2],[4,1],[5,1],[4,3],[4,5],[0,4],[-1,3],[-1,5],[1,5],[2,4],[15,15],[4,2],[5,1],[11,1],[5,2],[17,16],[7,5],[17,8],[18,3],[38,3],[29,-7],[8,2],[10,7],[8,1],[9,-1],[12,0],[17,5],[33,15],[21,5],[10,1],[9,2],[7,5],[2,7],[5,6],[10,0],[21,-2],[8,5],[11,17],[4,3],[2,5],[-3,28],[11,11],[9,8],[7,3],[0,2],[9,11],[4,1],[57,3],[8,2],[8,6],[8,5],[13,1],[25,-5],[13,-1],[9,3],[3,-2],[3,0],[7,-1],[10,5],[17,7],[10,2],[23,-5],[11,-1],[5,4],[4,7],[9,2],[16,-1],[17,6],[10,1],[8,-5],[6,2],[31,1],[9,-2],[27,-15],[16,-2],[12,-5],[17,-1],[6,-2],[13,-6],[5,-2],[10,-2],[4,-1],[9,-8],[1,-2],[1,-1],[14,-2],[7,-2],[13,-8],[11,-4],[8,-1],[21,3],[11,-1],[9,-2],[7,-4],[6,-4],[15,-9],[16,-3],[17,1],[19,2],[9,3],[17,6],[9,2],[9,0],[30,-3],[14,1],[4,-1],[7,-4],[3,-1],[7,2],[13,7],[9,2],[51,3],[16,5],[13,-3],[28,-2],[51,-10],[16,-5],[8,-2],[4,1],[4,1],[15,6],[7,1],[5,-3],[9,-9],[4,-2],[3,-1],[7,-4],[4,-1],[4,0],[7,3],[5,0],[5,-3],[10,-13],[-4,-7],[20,-52],[24,-59],[24,-60],[19,-48],[32,-80],[3,-12],[-10,-92],[3,-17],[9,-14],[45,-38],[9,-15],[18,-50],[19,-35],[6,-9],[9,-7],[30,-17],[5,-5],[3,-7],[0,-6]],[[6381,6396],[-1,2],[-6,2],[-2,1],[-2,2],[0,2],[-1,6],[-1,2],[0,2],[-2,1],[-3,2],[-5,2],[-2,1],[-2,2],[-1,3],[0,8],[-1,3],[-3,3],[-1,5],[0,3],[0,3],[1,2],[-1,3],[-2,4],[-5,5],[-11,6],[-6,1],[-2,3],[-1,2],[0,2],[0,3],[-1,2],[-2,2],[-1,1],[-3,1],[-12,0],[-3,1],[-3,2],[-3,2],[-2,2],[-2,-1],[-2,0],[-3,-1],[-3,1],[-3,1],[-2,2],[-1,3],[-2,2],[-2,2],[-5,2],[-1,3],[-1,3],[0,2],[-1,2],[-1,1],[-4,-1],[-3,-1],[-2,-1],[-4,0],[-5,1],[-9,4],[-11,7],[-16,8],[-7,4],[-1,2],[-2,3],[-4,1],[-9,0],[-3,-1],[-3,-2],[-1,-1],[-2,0],[-7,3],[-6,2],[-11,3],[-7,2],[-5,2],[-4,1],[-4,1],[-15,-3],[-4,0],[-3,0],[-5,1],[-11,6],[-15,5],[-32,17],[-3,1],[-3,0],[-3,0],[-2,-1],[-3,-1],[-8,-4],[-3,-1],[-3,-1],[-3,0],[-21,0],[-3,0],[-2,-2],[-3,-3],[-2,-1],[-2,-1],[-3,-1],[-3,0],[-3,1],[-11,3],[-17,7],[-73,15],[-4,2],[-4,2],[0,4],[0,6],[-1,3],[-1,4],[-2,2],[-3,2],[-30,11],[-2,1],[-2,0],[-2,-1],[-2,-1],[-2,-1],[-1,-2],[0,-3],[-1,-13],[0,-2],[-1,-2],[-1,-2],[-2,-2],[-2,-1],[-3,0],[-44,6],[-3,1],[-2,2],[-4,4],[-11,14],[-3,1],[-3,1],[-6,0],[-4,0],[-3,1],[-2,1],[-2,2],[-2,2],[-4,6],[0,2],[0,4],[5,14],[1,5],[-1,3],[-8,10],[-1,2],[1,4],[2,5],[12,21],[2,1],[2,0],[31,-10],[3,-1],[4,3],[4,4],[9,11],[5,4],[4,1],[6,-1],[3,0],[3,2],[6,7],[3,3],[3,3],[7,2],[2,2],[2,1],[1,1],[0,1],[-2,3],[-3,4],[-1,1],[1,2],[2,2],[2,1],[7,1],[4,2],[6,4],[2,1],[3,0],[9,-1],[3,0],[3,1],[6,9],[1,1],[10,7],[2,2],[1,2],[1,3],[0,3],[-1,4],[-2,3],[-20,13],[-23,23],[-3,4]],[[5833,6838],[36,17],[6,2],[12,3],[5,2],[3,3],[-1,4],[-5,8],[-1,6],[0,3],[-1,3],[-6,4],[-7,7],[1,9],[2,11],[1,9],[0,1],[9,12],[6,12],[7,10],[14,8],[36,8],[5,5],[0,7],[0,6],[8,4],[-7,6],[-3,10],[0,1],[0,9],[4,9],[9,7],[14,5],[13,3],[13,4],[5,3],[4,3],[2,5],[0,6],[1,6],[8,9],[2,6],[-2,3],[-6,4],[-2,3],[0,3],[0,6],[0,2],[-5,9],[-13,13],[-5,14],[-4,7],[-6,6],[-7,4],[-5,5],[-3,23],[-14,4],[-19,1],[-15,3],[-38,31],[-16,6],[-11,2],[-6,3],[-3,5],[0,8],[-4,4],[-10,4],[-11,2],[-7,0],[-25,20],[-19,25],[-6,5],[-6,4]],[[6869,7944],[16,-5],[36,-9],[48,-13],[31,-5],[51,-1],[68,0],[44,-1],[42,0],[0,5],[-1,5],[-3,4],[-3,4],[-3,6],[-1,30],[0,8],[-1,25],[8,37],[7,33],[8,35],[-1,12],[31,0],[8,-1],[11,-9],[8,-2],[13,-3],[24,2],[14,0],[33,-4],[27,-4],[54,2],[60,1],[65,1],[72,2],[-6,-16],[-7,-53],[-8,-25],[-1,-9],[-3,-9],[-16,-18],[-2,-3],[-2,-12],[-1,-3],[-4,-6],[-2,-11],[-49,-106],[-32,-118],[0,-9],[-1,-5],[-5,-9],[-1,-4],[0,-5],[2,-8],[1,-4],[-22,-100],[-3,-8],[-39,-47],[-3,-6],[-2,-10],[-5,-8],[-8,-6],[-10,-3],[1,-3],[2,-2],[3,1],[3,2],[4,-14],[-5,-15],[-8,-15],[-4,-13],[-6,-7],[-40,-31],[-6,-4],[-15,-6],[-6,-3],[-4,-4],[-9,-12],[-6,-6],[-51,-33],[-13,8],[-18,-2],[-11,-9],[10,-11],[4,4],[6,4],[8,3],[8,0],[-9,-13],[-18,-11],[-58,-24],[-17,-2],[-18,0],[-20,3],[0,-3],[1,-2],[2,-2],[3,-1],[0,-3],[-14,-6],[-91,-79],[-22,-15],[-7,-3],[-3,-1],[-1,-3],[-2,-7],[-2,-1],[-6,-4],[-17,-19],[-7,-4],[-16,-7],[-6,-5],[-3,-4],[-2,-8],[-6,-3],[-4,-2],[-3,-4],[-4,-7],[-61,-63],[-61,-93],[-5,-16],[5,-15],[-19,0],[-4,-4],[-2,-10],[7,3],[15,4],[6,4],[0,-3],[0,-3],[-2,-3],[-4,-5],[-12,-11],[-48,-33],[-14,-13],[-22,-29],[-26,-46],[-68,-89],[-9,-17],[-2,-6],[-3,-6],[-22,-17],[-79,-110],[-14,-15],[-7,-5],[-7,-3],[-6,-4],[-15,-23],[-43,-43]],[[6153,6623],[21,5],[13,2],[17,-3],[12,-5],[14,-8],[9,-3],[14,-2],[16,-8],[6,-1],[4,1],[8,4],[4,4],[5,7],[2,11],[2,6],[1,5],[8,1],[1,4],[0,2],[0,3],[-2,4],[0,3],[1,2],[2,0],[5,-1],[3,0],[2,0],[2,2],[1,1],[1,2],[2,2],[2,1],[2,0],[2,0],[4,-2],[2,-1],[2,1],[1,2],[-1,2],[-1,4],[-3,3],[-3,3],[-8,5],[-4,2],[-4,1],[-3,2],[-2,2],[-1,5],[0,2],[1,2],[2,2],[2,2],[0,1],[-1,2],[-3,1],[-4,0],[-3,0],[-2,-1],[-3,-3],[-2,-1],[-2,0],[-5,2],[-2,2],[-1,1],[-1,4],[1,2],[-2,2],[-2,3],[-6,3],[-4,2],[-3,0],[-2,0],[-2,0],[-2,1],[-13,10],[-1,2],[1,2],[2,1],[2,1],[3,1],[2,-1],[1,0],[2,0],[1,-1],[2,0],[1,2],[-2,2],[-10,8],[-4,3],[-7,9],[-4,3],[-8,3],[-2,0],[-3,2],[-3,3],[-2,3],[-6,15],[-3,4],[-7,5],[-15,-4],[-8,0],[-34,3],[-22,5],[-35,14],[-11,2],[-7,1],[-19,11],[-4,-2],[-9,-9],[3,-6],[4,-5],[-1,-8],[-18,-17],[-1,-12],[0,-14],[19,-12],[9,-8],[7,-11],[0,-9],[12,-30],[20,-17],[21,-44],[23,-4],[11,0]],[[6381,6396],[-34,-34],[-13,-7],[-15,-24],[-24,-22],[-68,-48],[-8,-3],[-29,-6],[-11,-4],[-9,-5],[-4,-7],[-28,-26],[-10,-4],[-5,-2],[-3,-7],[-3,-4],[-4,-2],[-2,-1],[-11,-2],[-8,-5],[-15,-12],[-7,-3],[-19,-5],[-12,-7],[-4,0],[-4,-1],[-5,-1],[-2,0],[-5,1],[-2,-1],[-3,-2],[0,-3],[2,-1],[1,-2],[-10,-15],[-13,-6],[-3,-2],[-2,-10],[-5,-5],[-15,-9],[-15,-12],[-7,-8],[-3,-6],[-2,-4],[-8,-11],[-5,-2],[-1,-1],[-1,-2],[-2,-4],[0,-2],[-31,-10],[-5,-5],[-2,-7],[-4,-7],[-13,-15],[-57,-46],[-48,-48],[-25,-11],[-4,-4],[-62,-43],[-11,-11],[-4,-3],[-8,-3],[-4,-2],[-17,-13],[-8,-9],[-4,-7],[-3,-5],[-51,-30],[-12,-4],[-15,-10],[-8,-3],[-1,-6],[-11,-6],[-23,-9],[-22,-12],[-14,-5],[-25,-6],[-12,-8],[-9,-11],[-4,-12],[-4,-9],[-10,-8],[-48,-29],[-14,-4],[-4,-3],[-6,-7],[-6,-2],[-1,-2],[0,-2],[-1,-2],[-1,-2],[-23,-8],[-9,-7],[-5,-2],[-9,-1],[-23,-6],[-8,-4],[-42,-32],[-15,-9],[-33,-10],[-5,-3],[-2,0],[-11,-12],[-4,-2],[-3,0],[-4,0],[-5,2],[-3,-10],[-12,-9],[-25,-15],[-11,-5],[-2,0],[-2,1],[-2,1],[0,1],[-2,-2],[-2,-4],[-49,-25],[-5,-4],[-35,-12],[-7,-4],[-4,-3],[-1,-3],[-1,-3],[-3,-3],[-4,-3],[-4,-1],[-9,-1],[-41,-16],[-9,-1],[-11,-1],[-10,-2],[-26,-17],[-10,-2],[-22,-2],[-16,-6],[-44,-14],[-6,-1],[-3,-2],[-3,-7],[-3,-2],[-10,-1],[-45,-16],[-18,-4],[-19,0],[-40,4],[-12,-1],[-9,-3],[-8,-1],[-11,4],[-18,7],[-61,9],[-64,3],[-41,-5],[-38,-8],[-35,-13],[-15,-8],[-12,-11],[-9,-13],[-7,-23],[-2,-9],[3,-5],[9,-3],[2,-4],[2,-2],[13,-7],[9,-10],[4,-4],[-1,-3],[0,-1],[-2,-2],[-15,4],[-10,-3],[-9,-4],[-12,-2],[-15,1],[-24,6],[-14,1],[-23,-2],[-12,0],[-12,5],[-17,3],[-15,8],[-17,5],[-40,8],[-42,0],[-42,-4],[-27,-6],[-11,-4],[-8,-6],[7,-17],[-5,-8],[-8,-7],[-5,-2],[-22,-15],[-3,-6],[1,-5],[5,-3],[4,-2],[2,-2],[-1,-4],[-8,-4],[-3,-3],[-4,0],[-6,6],[-9,2],[-32,1],[-26,5],[-10,1],[-30,-4],[-9,0],[-40,8],[-20,7],[-16,11],[-9,3],[-57,4],[-8,4],[-6,3],[-30,9],[-84,6],[-10,1],[-20,6],[-49,4],[-81,13]],[[5071,6704],[9,-2],[5,-1],[3,1],[10,3],[8,0],[3,-3],[3,-10],[5,-6],[8,-4],[17,-6],[1,-5],[2,-4],[12,-9],[11,-12],[2,-3],[0,-4],[1,-3],[3,-4],[28,-16],[25,-21],[14,-7],[16,-4],[20,-2],[4,1],[9,3],[4,1],[6,-2],[4,-2],[3,-3],[5,-3],[9,-3],[10,-2],[55,-4],[11,-4],[0,8],[-1,7],[0,6],[2,8],[3,4],[4,2],[4,2],[4,2],[4,4],[1,2],[8,19],[1,3],[-2,4],[-5,7],[-1,3],[3,5],[40,24],[6,5],[3,9],[-1,9],[-5,4],[-7,2],[-5,5],[1,8],[7,6],[10,4],[8,3],[14,1],[4,2],[3,2],[6,7],[4,2],[8,6],[8,11],[4,5],[9,6],[11,2],[22,-3],[12,3],[20,10],[8,1],[7,-1],[23,-6],[16,0],[41,12],[31,5],[30,9],[54,27],[19,8]]],"transform":{"scale":[0.0021509963496349695,0.0024841785116511703],"translate":[16.46998131600006,-46.96575286299996]}};
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
