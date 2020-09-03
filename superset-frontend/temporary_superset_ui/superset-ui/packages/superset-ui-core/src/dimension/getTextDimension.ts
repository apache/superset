import { TextStyle, Dimension } from './types';
import updateTextNode from './svg/updateTextNode';
import getBBoxCeil from './svg/getBBoxCeil';
import { hiddenSvgFactory, textFactory } from './svg/factories';

export interface GetTextDimensionInput {
  className?: string;
  container?: HTMLElement;
  style?: TextStyle;
  text: string;
}

export default function getTextDimension(
  input: GetTextDimensionInput,
  defaultDimension?: Dimension,
): Dimension {
  const { text, className, style, container } = input;

  // Empty string
  if (text.length === 0) {
    return { height: 0, width: 0 };
  }

  const svgNode = hiddenSvgFactory.createInContainer(container);
  const textNode = textFactory.createInContainer(svgNode);
  updateTextNode(textNode, { className, style, text });
  const dimension = getBBoxCeil(textNode, defaultDimension);

  // The nodes are added to the DOM briefly only to make getBBox works.
  // (If not added to DOM getBBox will always return 0x0.)
  // After that the svg nodes are not needed.
  // We delay its removal in case there are subsequent calls to this function
  // that can reuse the svg nodes.
  // Experiments have shown that reusing existing nodes
  // instead of deleting and adding new ones can save lot of time.
  setTimeout(() => {
    textFactory.removeFromContainer(svgNode);
    hiddenSvgFactory.removeFromContainer(container);
  }, 500);

  return dimension;
}
