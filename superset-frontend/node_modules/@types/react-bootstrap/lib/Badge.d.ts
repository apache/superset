import * as React from 'react';

declare namespace Badge {
    export interface BadgeProps extends React.HTMLProps<Badge> {
        bsClass?: string;
        pullRight?: boolean;
    }
}
declare class Badge extends React.Component<Badge.BadgeProps> { }
export = Badge;
