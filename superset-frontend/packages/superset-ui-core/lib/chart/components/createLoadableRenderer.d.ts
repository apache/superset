/// <reference types="react" />
import Loadable from 'react-loadable';
export declare type LoadableRendererProps = {
    onRenderFailure?: Function;
    onRenderSuccess?: Function;
};
export interface LoadableRenderer<Props> extends React.ComponentClass<Props & LoadableRendererProps>, Loadable.LoadableComponent {
}
export default function createLoadableRenderer<Props, Exports>(options: Loadable.OptionsWithMap<Props, Exports>): LoadableRenderer<Props>;
//# sourceMappingURL=createLoadableRenderer.d.ts.map