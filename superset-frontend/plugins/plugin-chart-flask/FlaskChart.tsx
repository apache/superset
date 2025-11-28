import React, { useEffect, useState } from 'react';
import { ChartProps } from '@superset-ui/core';

export default function FlaskChart(props: ChartProps) {
    const { formData, queriesData, height, width } = props;
    const { chartType, theme, themePalette, groupby, propsList } = formData;
    const data = queriesData[0]?.data ?? [];
    const dims = groupby.length

    const [html, setHtml] = useState('');
    const [chartId, setChartId] = useState<string | null>(null);
    const hostname = window.location.hostname; // ex: "superset.mydomain.com.br"

    const FLASK_URL = (() => {
        if (hostname.includes('sosportal')) return 'http://dev-charts.app.sosportal.com.br/';
        if (hostname.includes('ptmdev')) return 'http://dev-charts.app.sosportal.com.br/';
        return 'http://localhost:7100';
    })();

    // Para gráficos que NÃO são scatter_map
    useEffect(() => {
        if (chartType === "scatter_map") return;

        fetch(`${FLASK_URL}/${chartType}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                data,
                theme,
                dims,
                theme_palette: themePalette ? themePalette.split(',') : [],
                props: propsList ? propsList.split(',') : [],
            }),
        })
            .then(res => res.text())
            .then(setHtml)
            .catch(err => console.error('Erro ao buscar gráfico Flask:', err));
    }, [chartType, data, theme, themePalette, propsList]);

    // Para scatter_map
    useEffect(() => {
        if (chartType !== "scatter_map") return;

        fetch(`${FLASK_URL}/scatter_map`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                data,
                theme,
                dims,
                theme_palette: themePalette ? themePalette.split(',') : [],
                props: propsList ? propsList.split(',') : [],
            }),
        })
            .then(res => res.json())
            .then(json => setChartId(json.id))
            .catch(console.error);
    }, [chartType, data, theme, themePalette, propsList]);

    if (chartType === "scatter_map") {
        return chartId ? (
            <iframe
                src={`${FLASK_URL}/scatter_map/${chartId}`}
                style={{ width, height, border: "none" }}
                sandbox="allow-scripts allow-same-origin"
            />
        ) : null;
    }

    return html ? (
        <iframe
            title="Flask Chart"
            srcDoc={html}
            style={{ width, height, border: "none" }}
            sandbox="allow-scripts allow-same-origin"
        />
    ) : null;
}
