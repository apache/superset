"use strict";

exports.__esModule = true;
exports.default = createRenderLegend;

var _react = _interopRequireDefault(require("react"));

var _DefaultLegend = _interopRequireDefault(require("./DefaultLegend"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function createRenderLegend(encoder, data, props) {
  if (encoder.hasLegend()) {
    const {
      LegendRenderer = _DefaultLegend.default,
      LegendGroupRenderer,
      LegendItemRenderer,
      LegendItemLabelRenderer,
      LegendItemMarkRenderer
    } = props;
    return () => /*#__PURE__*/_react.default.createElement(LegendRenderer, {
      groups: encoder.getLegendInformation(data),
      LegendGroupRenderer: LegendGroupRenderer,
      LegendItemRenderer: LegendItemRenderer,
      LegendItemMarkRenderer: LegendItemMarkRenderer,
      LegendItemLabelRenderer: LegendItemLabelRenderer
    });
  }

  return undefined;
}