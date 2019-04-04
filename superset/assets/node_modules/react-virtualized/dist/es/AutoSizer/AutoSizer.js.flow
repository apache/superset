/** @flow */

import * as React from 'react';
import createDetectElementResize from '../vendor/detectElementResize';

type Size = {
  height: number,
  width: number,
};

type Props = {
  /** Function responsible for rendering children.*/
  children: Size => React.Element<*>,

  /** Optional custom CSS class name to attach to root AutoSizer element.  */
  className?: string,

  /** Default height to use for initial render; useful for SSR */
  defaultHeight?: number,

  /** Default width to use for initial render; useful for SSR */
  defaultWidth?: number,

  /** Disable dynamic :height property */
  disableHeight: boolean,

  /** Disable dynamic :width property */
  disableWidth: boolean,

  /** Nonce of the inlined stylesheet for Content Security Policy */
  nonce?: string,

  /** Callback to be invoked on-resize */
  onResize: Size => void,

  /** Optional inline style */
  style: ?Object,
};

type State = {
  height: number,
  width: number,
};

type ResizeHandler = (element: HTMLElement, onResize: () => void) => void;

type DetectElementResize = {
  addResizeListener: ResizeHandler,
  removeResizeListener: ResizeHandler,
};

export default class AutoSizer extends React.PureComponent<Props, State> {
  static defaultProps = {
    onResize: () => {},
    disableHeight: false,
    disableWidth: false,
    style: {},
  };

  state = {
    height: this.props.defaultHeight || 0,
    width: this.props.defaultWidth || 0,
  };

  _parentNode: ?HTMLElement;
  _autoSizer: ?HTMLElement;
  _detectElementResize: DetectElementResize;

  componentDidMount() {
    const {nonce} = this.props;
    if (
      this._autoSizer &&
      this._autoSizer.parentNode &&
      this._autoSizer.parentNode.ownerDocument &&
      this._autoSizer.parentNode.ownerDocument.defaultView &&
      this._autoSizer.parentNode instanceof
        this._autoSizer.parentNode.ownerDocument.defaultView.HTMLElement
    ) {
      // Delay access of parentNode until mount.
      // This handles edge-cases where the component has already been unmounted before its ref has been set,
      // As well as libraries like react-lite which have a slightly different lifecycle.
      this._parentNode = this._autoSizer.parentNode;

      // Defer requiring resize handler in order to support server-side rendering.
      // See issue #41
      this._detectElementResize = createDetectElementResize(nonce);
      this._detectElementResize.addResizeListener(
        this._parentNode,
        this._onResize,
      );

      this._onResize();
    }
  }

  componentWillUnmount() {
    if (this._detectElementResize && this._parentNode) {
      this._detectElementResize.removeResizeListener(
        this._parentNode,
        this._onResize,
      );
    }
  }

  render() {
    const {
      children,
      className,
      disableHeight,
      disableWidth,
      style,
    } = this.props;
    const {height, width} = this.state;

    // Outer div should not force width/height since that may prevent containers from shrinking.
    // Inner component should overflow and use calculated width/height.
    // See issue #68 for more information.
    const outerStyle: Object = {overflow: 'visible'};
    const childParams: Object = {};

    if (!disableHeight) {
      outerStyle.height = 0;
      childParams.height = height;
    }

    if (!disableWidth) {
      outerStyle.width = 0;
      childParams.width = width;
    }

    /**
     * TODO: Avoid rendering children before the initial measurements have been collected.
     * At best this would just be wasting cycles.
     * Add this check into version 10 though as it could break too many ref callbacks in version 9.
     * Note that if default width/height props were provided this would still work with SSR.
    if (
      height !== 0 &&
      width !== 0
    ) {
      child = children({ height, width })
    }
    */

    return (
      <div
        className={className}
        ref={this._setRef}
        style={{
          ...outerStyle,
          ...style,
        }}>
        {children(childParams)}
      </div>
    );
  }

  _onResize = () => {
    const {disableHeight, disableWidth, onResize} = this.props;

    if (this._parentNode) {
      // Guard against AutoSizer component being removed from the DOM immediately after being added.
      // This can result in invalid style values which can result in NaN values if we don't handle them.
      // See issue #150 for more context.

      const height = this._parentNode.offsetHeight || 0;
      const width = this._parentNode.offsetWidth || 0;

      const style = window.getComputedStyle(this._parentNode) || {};
      const paddingLeft = parseInt(style.paddingLeft, 10) || 0;
      const paddingRight = parseInt(style.paddingRight, 10) || 0;
      const paddingTop = parseInt(style.paddingTop, 10) || 0;
      const paddingBottom = parseInt(style.paddingBottom, 10) || 0;

      const newHeight = height - paddingTop - paddingBottom;
      const newWidth = width - paddingLeft - paddingRight;

      if (
        (!disableHeight && this.state.height !== newHeight) ||
        (!disableWidth && this.state.width !== newWidth)
      ) {
        this.setState({
          height: height - paddingTop - paddingBottom,
          width: width - paddingLeft - paddingRight,
        });

        onResize({height, width});
      }
    }
  };

  _setRef = (autoSizer: ?HTMLElement) => {
    this._autoSizer = autoSizer;
  };
}
