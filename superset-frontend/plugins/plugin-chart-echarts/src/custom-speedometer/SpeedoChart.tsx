import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts';

interface SpeedoChartProps {
  min: number;
  max: number;
  progress: number;
}

const calculatePercentage = (minVal: number, maxVal: number, progressVal: number): number => {
  progressVal = parseFloat(progressVal.toFixed(2));

  // Ensure percentage does notfall below 0%
  if (progressVal < 0) {
    progressVal = 0;
  }


  return progressVal;
}

const SpeedoChart: React.FC<SpeedoChartProps> = ({ min, max, progress }) => {
  const chartRef = useRef<HTMLDivElement>(null);

  //var calculatedData = calculatePercentage(min, max, progress);
  var calculatedData = 90

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
      series: [{
        type: 'custom',
        renderItem: (params: any, api: any) => {
          const startAngle = -Math.PI; // Starting angle for the arc (180 degrees)
          const hardCap = Math.min(calculatedData, 100);
          const endAngle = startAngle + (Math.PI * (hardCap / 100)); // Ending angle based on progress

          // Create the Rainbow Arch radiuses
          const outerRadius = 120;
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
