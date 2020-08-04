<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Jasmine Spec Runner</title>
<% css.forEach(function(style){ %>
  <link rel="stylesheet" type="text/css" href="<%= style %>">
<% }) %>
	<style type="text/css">
		#low-high-slider-styled .slider-track-low
		{
			background: rgb(0, 255, 0);
		}

		#low-high-slider-styled .slider-track-high
		{
			background: rgb(255, 0, 0);
		}
		#scrollable-div {
			overflow-y: scroll;
			width: 300px;
			height: 150px;
			position: relative;
		}
		#low-div {
			padding: 2000px 0 500px 0;
		}

	</style>
</head>
<body>
    <div style="
        margin-left: 2000px;
    ">
        <input id="offRightEdgeSliderInput" type="text"/>
    </div>

	<input id="testSliderGeneric" type="text"/>

	<!-- Slider used for PublicMethodsSpec and EventsSpec -->
	<input id="testSlider1" type="text"/>
	<input id="testSlider2" type="text"/>
	<input id="testSlider3" type="text"/>
	<input id="testSlider4" type="text"/>

	<!-- Note: Two input elements with class 'makeSlider' are required for tests to run properly -->
  <input class="makeSlider" type="text"/>
	<input class="makeSlider" type="text"/>

	<!-- Sliders used for ElementDataSttributesSpec -->
	<input id="minSlider" type="text" data-slider-min="5"/>

	<input id="maxSlider" type="text" data-slider-max="5"/>

	<input id="orientationSlider" type="text" data-slider-orientation="vertical"/>

	<input id="stepSlider" type="text" data-slider-step="5"/>

	<input id="precisionSlider" type="text" data-slider-precision="2"/>

	<input id="valueSlider" type="text" data-slider-value="5"/>

	<input id="sliderWithTickMarksAndLabels" type="text" data-slider-ticks="[0, 100, 200, 300, 400]" data-slider-ticks-labels='["$0", "$100", "$200", "$300", "$400"]'/>

	<input id="selectionSlider" type="text" data-slider-selection="after"/>

	<input id="tooltipSlider" type="text" data-slider-tooltip="hide"/>

	<input id="handleSlider" type="text" data-slider-handle="triangle"/>

  <input id="customHandleSlider" type="text" data-slider-handle="custom"/>

	<input id="reversedSlider" type="text" data-slider-reversed="true"/>

	<input id="disabledSlider" type="text" data-slider-enabled="false"/>

	<input id="changeOrientationSlider" type="text"/>

	<input id="makeRangeSlider" type="text"/>

	<div id="autoregisterSliderContainer">
		<input id="autoregisterSlider" data-provide="slider" data-slider-value="1"/>
	</div>

	<div id="relayoutSliderContainer" style="display: none">
		<input id="relayoutSliderInput" type="text"/>
	</div>

	<div id="relayoutSliderContainerTickLabels" style="display: none">
		<input id="relayoutSliderInputTickLabels" type="text"/>
	</div>

	<div id="scrollable-div">
		<p>just a row</p>
		<p>just a row</p>
		<input id="ex1" data-slider-id='ex1Slider' type="text"/>
	</div>

	<div id="low-div">
		<input id="veryLowPositionedSlider" type="text"/>
	</div>

  <!-- Sliders used by resize -->
  <input id="resizeSlider" type="text"/>
  <input id="resizeSliderVertical" data-slider-orientation="vertical" type="text"/>

  <!-- Sliders used for AccessibilitySpec -->
	<div>
		<span id="accessibilitySliderLabelA">Label A</span>
		<span id="accessibilitySliderLabelB">Label B</span>
		<input id="accessibilitySliderA" type="text" data-slider-labelledby="accessibilitySliderLabelA" />
		<input id="accessibilitySliderB" type="text" data-slider-labelledby='["accessibilitySliderLabelA", "accessibilitySliderLabelB"]' />

		<input id="accessibilitySliderC" type="text" />
	</div>
  <!-- Sliders used for rtl -->
	<div dir="rtl">
		<input id="rtlSlider" type="text" />
	</div>

	<% with (scripts) { %>
		<% [].concat(polyfills, jasmine, boot, vendor, helpers, src, specs,reporters).forEach(function(script){ %>
		  <script src="<%= script %>"></script>
		<% }) %>
	<% }; %>
</body>
</html>
