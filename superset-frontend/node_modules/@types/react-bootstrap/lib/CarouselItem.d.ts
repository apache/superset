import * as React from 'react';

declare namespace CarouselItem {
    interface CarouselItemProps extends React.HTMLProps<CarouselItem> {
        active?: boolean;
        animtateIn?: boolean;
        animateOut?: boolean;
        direction?: string;
        index?: number;
        // TODO: Add more specific type
        onAnimateOutEnd?: Function;
    }
}
declare class CarouselItem extends React.Component<CarouselItem.CarouselItemProps> { }
export = CarouselItem;
