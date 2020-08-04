import * as React from 'react';

declare namespace Image {
    export interface ImageProps extends React.HTMLProps<Image> {
        circle?: boolean;
        responsive?: boolean;
        rounded?: boolean;
        thumbnail?: boolean;
    }
}
declare class Image extends React.Component<Image.ImageProps> { }
export = Image;
