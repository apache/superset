import { __metadata } from 'tslib';

const TEMPLATES = {
    "Line Chart": {
        title:{
          text: "Title",
          subtext: "And subtitle..."
        },
        Axis: {
            type: 'category',
            data: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
        },
        yAxis: {
            type: 'value'
        },
        series: [{
            data: [820, 932, 901, 934, 1290, 1330, 1320],
            type: 'line'
        }]
    }
};

export default TEMPLATES;