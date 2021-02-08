import Loadable from 'react-loadable';

export type LoadableRendererProps = {
  onRenderFailure?: Function;
  onRenderSuccess?: Function;
};

const defaultProps = {
  onRenderFailure() {},
  onRenderSuccess() {},
};

export interface LoadableRenderer<Props>
  extends React.ComponentClass<Props & LoadableRendererProps>,
    Loadable.LoadableComponent {}

export default function createLoadableRenderer<Props, Exports>(
  options: Loadable.OptionsWithMap<Props, Exports>,
): LoadableRenderer<Props> {
  const LoadableRenderer = Loadable.Map(options) as LoadableRenderer<Props>;

  // Extends the behavior of LoadableComponent to provide post-render listeners
  class CustomLoadableRenderer extends LoadableRenderer {
    static defaultProps: object;

    componentDidMount() {
      this.afterRender();
    }

    componentDidUpdate() {
      this.afterRender();
    }

    afterRender() {
      const { loaded, loading, error } = this.state;
      const { onRenderFailure, onRenderSuccess } = this.props;
      if (!loading) {
        if (error) {
          (onRenderFailure as Function)(error);
        } else if (loaded && Object.keys(loaded).length > 0) {
          (onRenderSuccess as Function)();
        }
      }
    }
  }

  CustomLoadableRenderer.defaultProps = defaultProps;
  CustomLoadableRenderer.preload = LoadableRenderer.preload;

  return CustomLoadableRenderer;
}
