import ReactDOM from 'react-dom';

/**
 * Helper method for testing components that may use Portal and thus require cleanup.
 * This helper method renders components to a transient node that is destroyed after the test completes.
 * Note that rendering twice within the same test method will update the same element (rather than recreate it).
 */
export function render(markup) {
  if (!render._mountNode) {
    render._mountNode = document.createElement('div');

    // Unless we attach the mount-node to body, getBoundingClientRect() won't work
    document.body.appendChild(render._mountNode);

    afterEach(render.unmount);
  }

  return ReactDOM.render(markup, render._mountNode);
}

/**
 * The render() method auto-unmounts components after each test has completed.
 * Use this method manually to test the componentWillUnmount() lifecycle method.
 */
render.unmount = function () {
  if (render._mountNode) {
    ReactDOM.unmountComponentAtNode(render._mountNode);

    document.body.removeChild(render._mountNode);

    render._mountNode = null;
  }
};