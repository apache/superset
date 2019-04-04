export default function JSXElementMock(tagName, attributes, children = []) {
  return {
    type: 'JSXElement',
    openingElement: {
      type: 'JSXOpeningElement',
      name: {
        type: 'JSXIdentifier',
        name: tagName,
      },
      attributes,
    },
    children,
  };
}
