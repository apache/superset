// config for a ResizableContainer
const adjustableWidthAndHeight = {
  top: false,
  right: false,
  bottom: false,
  left: false,
  topRight: false,
  bottomRight: true,
  bottomLeft: false,
  topLeft: false,
};

const adjustableWidth = {
  ...adjustableWidthAndHeight,
  right: true,
  bottomRight: false,
};

const adjustableHeight = {
  ...adjustableWidthAndHeight,
  bottom: true,
  bottomRight: false,
};

const notAdjustable = {
  ...adjustableWidthAndHeight,
  bottomRight: false,
};

export default {
  widthAndHeight: adjustableWidthAndHeight,
  widthOnly: adjustableWidth,
  heightOnly: adjustableHeight,
  notAdjustable,
};
