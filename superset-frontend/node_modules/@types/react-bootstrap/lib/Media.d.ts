import * as React from 'react';
import MediaBody = require('./MediaBody');
import MediaHeading = require('./MediaHeading');
import MediaLeft = require('./MediaLeft');
import MediaList = require('./MediaList');
import MediaListItem = require('./MediaListItem');
import MediaRight = require('./MediaRight');

declare namespace Media {
    export interface MediaProps extends React.HTMLProps<Media> {
        componentClass?: React.ReactType;
    }
}
declare class Media extends React.Component<Media.MediaProps> {
    static Body: typeof MediaBody;
    static Heading: typeof MediaHeading;
    static Left: typeof MediaLeft;
    static Right: typeof MediaRight;
    static List: typeof MediaList;
    static ListItem: typeof MediaListItem;
}
export = Media;
