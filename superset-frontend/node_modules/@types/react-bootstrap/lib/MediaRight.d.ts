import * as React from 'react';

declare namespace MediaRight {
    export interface MediaRightProps extends React.HTMLProps<MediaRight> {
        align?: string;
    }
}
declare class MediaRight extends React.Component<MediaRight.MediaRightProps> { }
export = MediaRight;
