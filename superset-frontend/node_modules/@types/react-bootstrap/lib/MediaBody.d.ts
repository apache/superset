import * as React from 'react';

declare namespace MediaBody {
    export interface MediaBodyProps extends React.ClassAttributes<MediaBody> {
        componentClass?: React.ReactType;
    }
}
declare class MediaBody extends React.Component<MediaBody.MediaBodyProps> { }
export = MediaBody;
