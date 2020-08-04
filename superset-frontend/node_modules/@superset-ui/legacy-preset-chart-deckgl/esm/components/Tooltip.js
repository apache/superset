import _pt from "prop-types";
import React, { useMemo } from 'react';
import { filterXSS } from 'xss';
export default function Tooltip(props) {
  const {
    tooltip
  } = props;

  if (typeof tooltip === 'undefined' || tooltip === null) {
    return null;
  }

  const {
    x,
    y,
    content
  } = tooltip; // eslint-disable-next-line react-hooks/rules-of-hooks

  const style = useMemo(() => ({
    position: 'absolute',
    top: y + "px",
    left: x + "px",
    padding: '8px',
    margin: '8px',
    background: 'rgba(0, 0, 0, 0.8)',
    color: '#fff',
    maxWidth: '300px',
    fontSize: '12px',
    zIndex: 9,
    pointerEvents: 'none'
  }), [x, y]);

  if (typeof content === 'string') {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const contentHtml = useMemo(() => ({
      __html: filterXSS(content, {
        stripIgnoreTag: true
      })
    }), [content]);
    return React.createElement("div", {
      style: style
    }, React.createElement("div", {
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML: contentHtml
    }));
  }

  return React.createElement("div", {
    style: style
  }, content);
}