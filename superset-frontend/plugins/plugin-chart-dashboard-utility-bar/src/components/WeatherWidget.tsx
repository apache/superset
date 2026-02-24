/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import React, { useState, useEffect, useRef } from 'react';

interface WeatherData {
    temperature: number;
    weatherCode: number;
}

/** Map WMO weather codes to emoji + description */
const getWeatherIcon = (code: number): string => {
    if (code === 0) return '☀️';
    if (code <= 3) return '⛅';
    if (code <= 49) return '🌫️';
    if (code <= 59) return '🌧️';
    if (code <= 69) return '🌨️';
    if (code <= 79) return '🌨️';
    if (code <= 84) return '🌧️';
    if (code <= 94) return '⛈️';
    return '🌩️';
};

interface WeatherWidgetProps {
    iconSize?: number;
    showTemperature?: boolean;
    temperatureFontSize?: number;
}

/**
 * Self-contained weather widget using the Open-Meteo API (no API key required).
 *
 * - Fetches user location via browser Geolocation API on mount.
 * - Calls Open-Meteo for current weather (temperature + WMO weather code).
 * - Refreshes every 10 minutes.
 * - Properly cleans up interval on unmount.
 * - Shows a loading state while fetching; degrades gracefully on error.
 * - Icon size, temperature visibility, and temperature font size are configurable.
 */
const WeatherWidget: React.FC<WeatherWidgetProps> = ({
    iconSize = 18,
    showTemperature = true,
    temperatureFontSize = 13,
}) => {
    const [weather, setWeather] = useState<WeatherData | null>(null);
    const [error, setError] = useState(false);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const fetchWeather = (lat: number, lon: number) => {
        fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`,
        )
            .then((res) => {
                if (!res.ok) throw new Error('Weather API error');
                return res.json();
            })
            .then((data) => {
                if (data?.current_weather) {
                    setWeather({
                        temperature: Math.round(data.current_weather.temperature),
                        weatherCode: data.current_weather.weathercode,
                    });
                    setError(false);
                }
            })
            .catch(() => {
                setError(true);
            });
    };

    useEffect(() => {
        let lat = 40.7128; // Default: New York
        let lon = -74.006;

        const startFetching = (latitude: number, longitude: number) => {
            fetchWeather(latitude, longitude);
            intervalRef.current = setInterval(() => {
                fetchWeather(latitude, longitude);
            }, 600000); // Refresh every 10 minutes
        };

        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    lat = position.coords.latitude;
                    lon = position.coords.longitude;
                    startFetching(lat, lon);
                },
                () => {
                    // Geolocation denied — use default coordinates
                    startFetching(lat, lon);
                },
                { timeout: 5000 },
            );
        } else {
            startFetching(lat, lon);
        }

        return () => {
            if (intervalRef.current !== null) {
                clearInterval(intervalRef.current);
            }
        };
    }, []);

    if (error) {
        return <span style={{ fontSize: iconSize, opacity: 0.6 }}>🌤️</span>;
    }

    if (!weather) {
        return <span style={{ fontSize: iconSize, opacity: 0.5 }}>⏳</span>;
    }

    return (
        <span
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                flexShrink: 0,
            }}
        >
            <span style={{ fontSize: iconSize }}>{getWeatherIcon(weather.weatherCode)}</span>
            {showTemperature && (
                <span style={{ fontSize: temperatureFontSize, fontWeight: 500 }}>
                    {weather.temperature}°C
                </span>
            )}
        </span>
    );
};

export default WeatherWidget;
