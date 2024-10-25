import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import { DEFAULT_FORM_DATA } from './types';

interface SpeedoChartProps {
  min: number;
  max: number;
  progress: number;
  segmentAmt: number;
  s1Color: string;
  s1S: number;
  s1E: number;
}

const calculatePercentage = (minVal: number, maxVal: number, progressVal: number): number => {
  progressVal = parseFloat(progressVal.toFixed(2));

  // Ensure percentage does notfall below 0%
  if (progressVal < 0) {
    progressVal = 0;
  }


  return progressVal;
}

const SpeedoChart: React.FC<SpeedoChartProps> = ({ min, max, progress, segmentAmt, s1Color, s1S, s1E }) => {
  const chartRef = useRef<HTMLDivElement>(null);

  var calculatedData = calculatePercentage(min, max, progress);
  //var calculatedData = 90


  // Hardcoded values for 2nd chart
  var outerRadiusSecondChart = 114;
  var innerRadiusSecondChart = 122;
  const segments = [
    {start: s1S, end: s1E, color: s1Color},
    {start: 70, end: 85, color: "#dba307"},
    {start: 85, end: 100, color: "#db0707"},
  ]

  useEffect(() => {
    const chart = echarts.init(chartRef.current!);

    const options = {
      title: {
        text: `Progress: ${calculatedData}%\n\nNumber Being Given: ${progress} `,
        left: 100,
        top: 270,
        textStyle: {
          fontSize: 16,
          fontWeight: 'bold',
        },
      },
      xAxis: {
        type: 'value',
        min: 0,
        max: 100,
        show: false,
      },
      yAxis: {
        type: 'category',
        data: [''],
        show: false,
      },
      graphic: [
        {
          type: 'text',
          left: 400,
          top: 150,
          style: {
            text: `Min: ${min}`,
            fontSize: 16,
            fontWeight: 'bold',
          }
        },
        {
          type: 'text',
          left: 400,
          top: 170,
          style: {
            text: `Max: ${max}`,
            fontSize: 16,
            fontWeight: 'bold',
          }
        },
        {
          type: 'text',
          left: 400,
          top: 190,
          style: {
            text: `Segment Amt: ${segmentAmt}`,
            fontSize: 16,
            fontWeight: 'bold'
          }
        },
        {
          type: 'text',
          left: 400,
          top: 210,
          style: {
            text: `S1 Color: ${s1Color}`,
            fontSize: 16,
            fontWeight: 'bold',
          }
        },
        {
          type: 'text',
          left: 400,
          top: 230,
          style: {
            text: `S1 Start: ${s1S}`,
            fontSize: 16,
            fontWeight: 'bold'
          }
        },
        {
          type: 'text',
          left: 400,
          top: 250,
          style: {
            text: `S1 Start: ${s1E}`,
            fontSize: 16,
            fontWeight: 'bold'
          }
        }
      ],
      series: [{
        type: 'custom',
        renderItem: (params: any, api: any) => {
          const startAngle = -Math.PI; // Starting angle for the arc (180 degrees)
          const hardCap = Math.min(calculatedData, 100);
          const endAngle = startAngle + (Math.PI * (hardCap / 100)); // Ending angle based on progress

          const outerRadius = 110;
          const innerRadius = 80;
          
          const cx = api.coord([0, 0])[1]; // Center x
          const cy = api.coord([0, 0])[1]; // Center y
      
          return {
            type: 'path',
            shape: {
              pathData: `
                M ${cx + innerRadius * Math.cos(startAngle)} ${cy + innerRadius * Math.sin(startAngle)}
                A ${innerRadius} ${innerRadius} 0 0 1
                  ${cx + innerRadius * Math.cos(endAngle)} ${cy + innerRadius * Math.sin(endAngle)}
                L ${cx + outerRadius * Math.cos(endAngle)} ${cy + outerRadius * Math.sin(endAngle)}
                A ${outerRadius} ${outerRadius} 0 0 0
                  ${cx + outerRadius * Math.cos(startAngle)} ${cy + outerRadius * Math.sin(startAngle)}
                Z
              `,
            },
            style: {
              fill: '#4caf50', // Progress color (green)
              stroke: '#000', // Outline color
              lineWidth: 2,
            },
          };
        },
        data: [{}], // Single data item to trigger renderItem
      },
      {
        type: 'custom',
        renderItem: (params: any, api:any) => {

          const cx = api.coord([0,0])[1];  // Center x
          const cy = api.coord([0,0])[1];  // Center y

          const segmentArcs = segments.map((segment) => {
            const startAngle = -Math.PI + (Math.PI * (segment.start / 100)); // Convert start percentage to radians
            const endAngle = -Math.PI + (Math.PI * (segment.end / 100)); // Convert end percentage to radians


            return {
              type: 'path',
              shape: {
                pathData:`
                  M ${cx + innerRadiusSecondChart * Math.cos(startAngle)} ${cy + innerRadiusSecondChart * Math.sin(startAngle)}
                  A ${innerRadiusSecondChart} ${innerRadiusSecondChart} 0 0 1
                    ${cx + innerRadiusSecondChart * Math.cos(endAngle)} ${cy + innerRadiusSecondChart * Math.sin(endAngle)}
                  L ${cx + outerRadiusSecondChart * Math.cos(endAngle)} ${cy + outerRadiusSecondChart * Math.sin(endAngle)}
                  A ${outerRadiusSecondChart} ${outerRadiusSecondChart} 0 0 0
                    ${cx + outerRadiusSecondChart * Math.cos(startAngle)} ${cy + outerRadiusSecondChart * Math.sin(startAngle)}
                  Z
                  `,
                },
                style: {
                  fill: segment.color,
                  stroke: '#000',
                  lineWidth: 2,
                },
            };
          });
          return {
            type: 'group',
            children: segmentArcs, // Add all arcs as children of the group
          };
        },
        data: [{}]
      }],      
    };

    chart.setOption(options);


    return () => {
      chart.dispose();
    };
  }, [calculatedData]);

  return <div ref={chartRef} style={{ width: '100%', height: '520px' }} />;
};

export default SpeedoChart;
