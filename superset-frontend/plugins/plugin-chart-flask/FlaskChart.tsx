import React from 'react';
import { ChartProps } from '@superset-ui/core';

export default function FlaskChart(props: ChartProps) {
    const { formData, queriesData, height, width } = props;
    const { chartType, theme, themePalette, propsList } = formData;

    const data = queriesData[0]?.data ?? [];

    const baseUrl = 'http://localhost:7100';
    const url = new URL(`${baseUrl}/${chartType}`);
    url.searchParams.append('data', JSON.stringify(data));
    url.searchParams.append('theme', JSON.stringify(theme));
    url.searchParams.append('theme_palette', JSON.stringify(themePalette || []));
    url.searchParams.append('props', JSON.stringify(propsList || []));

    return (
        <iframe
            title="Flask Chart"
            src={url.toString()}
            style={{
                width,
                height,
                border: 'none',
            }}
            sandbox="allow-scripts allow-same-origin"
        />
    );
}
