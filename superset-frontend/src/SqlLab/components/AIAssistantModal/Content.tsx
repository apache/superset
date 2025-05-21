import {
  styled,
  SuperChart,
  SupersetClient,
  useTheme,
} from '@superset-ui/core';
import {
  FC,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import IconButton from 'src/dashboard/components/IconButton';
import Icons from 'src/components/Icons';
import { Input } from 'src/components/Input';

import StyledModal from 'src/components/Modal';
import { Button, Skeleton } from 'src/components';
import { JsonEditor } from 'src/components/AsyncAceEditor';
import ChartRenderer from 'src/components/Chart/ChartRenderer';
import Popover from 'src/components/Popover';
import { TimeseriesChartTransformedProps } from '@superset-ui/plugin-chart-echarts';
import LiveText from './LiveText';
import PromptInput from './PromptInput';
import ResultCard from './ResultCard';

const StyledInputBar = styled.div`
  position: relative;
  transition: height 0.25s ease-in;
  height: 55px;

  &.expanded {
    height: 550px;
  }
`;

const StyledIconButtonWrapper = styled.div`
  position: absolute;
  right: 8px;
  top: 4px;
`;

const Flex = styled.div`
  display: flex;
  flex-direction: column;
  row-gap: 8px;
`;

const FlexContent = styled.div`
  flex: 1 1 auto;
`;

const ChartContainer = styled.div`
  border: 1px ${({ theme }) => theme.colors.grayscale.light2} solid;
  border-radius: 8px;
  position: relative;
`;

const StyledLoading = styled.div`
  padding: 20px;
  position: absolute;
  top: 0px;
  left: 0px;
  width: 100%;
  height: 100%;
`;

type Action =
  | {
      type: 'request';
      payload: {
        prompt: string;
      };
    }
  | {
      type: 'success';
      payload: {
        optionResult: string;
      };
    };

type State = {
  id: number;
  prompt: string;
  loading: boolean;
  optionResult: string;
}[];

const reducer = (state: State = [], action: Action) => {
  switch (action.type) {
    case 'request': {
      return [
        ...state,
        {
          ...action.payload,
          id: Date.now(),
          loading: true,
          optionResult: '',
        },
      ];
    }
    case 'success': {
      const index = state.length - 1;
      return [
        ...state.slice(0, index),
        {
          ...state[index],
          loading: false,
          ...action.payload,
        },
      ];
    }
    default: {
      return state;
    }
  }
};

const Content = ({ formData, queriesResponse }) => {
  const [prompts, dispatch] = useReducer(reducer, []);
  const chartOptionRef = useRef();
  const onSubmit = useCallback((prompt: string) => {
    dispatch({ type: 'request', payload: { prompt } });
    //     setTimeout(() => {
    //       const result =
    //         demoRef.current === 0
    //           ? `{
    //   "series": [
    //     {
    //       "itemStyle": {
    //         "color": "red"
    //       },
    //       "id": "Michael"
    //     },
    //     {
    //       "itemStyle": {
    //         "color": "red"
    //       },
    //       "id": "David"
    //     }
    //   ]
    // }`
    //           : `{
    //   "grid": { "containLabel": true, "left": 50, "right": 20, "top": 40, "bottom": 20 },
    //   "xAxis": { "type": "time", "nameGap": 15, "nameLocation": "middle", "axisLabel": { "hideOverlap": true }, "minorTick": {}, "minInterval": 86400000 },
    //   "yAxis": { "scale": true, "yAxisLabelRotation": 0, "type": "value", "minorTick": {}, "minorSplitLine": {}, "axisLabel": {}, "nameGap": 30, "nameLocation": "middle" },
    //   "legend": { "orient": "horizontal", "show": true, "type": "scroll", "selector": [ "all", "inverse" ], "selectorLabel": { "fontFamily": "'Inter', Helvetica, Arial", "fontSize": 12, "color": "#666666", "borderColor": "#666666" }, "top": 0, "right": 0, "data": [ "Michael", "David", "Christopher", "Daniel", "Jennifer", "Matthew", "Robert", "Jose", "Anthony", "Jessica" ] },
    //   "series": [
    //     { "id": "Michael", "name": "Michael", "itemStyle": { "color": "red", "opacity": 1, "borderWidth": 0 }, "type": "line", "showSymbol": false, "symbolSize": 6, "label": { "show": false, "position": "top" },
    //       "markLine": {
    //         "data": [
    //           {
    //             "xAxis": "2000-01-01",
    //             "name": "Airbnb launched",
    //             "label": { "formatter": "Airbnb launched" }
    //           }
    //         ]
    //       }
    //     },
    //     { "id": "David", "name": "David", "itemStyle": { "color": "red", "opacity": 1, "borderWidth": 0 }, "type": "line", "showSymbol": false, "symbolSize": 6, "label": { "show": false, "position": "top" } },
    //     { "id": "Christopher", "name": "Christopher", "itemStyle": { "color": "#5AC189", "opacity": 1, "borderWidth": 0 }, "type": "line", "showSymbol": false, "symbolSize": 6, "label": { "show": false, "position": "top" } },
    //     { "id": "Daniel", "name": "Daniel", "itemStyle": { "color": "#FF7F44", "opacity": 1, "borderWidth": 0 }, "type": "line", "showSymbol": false, "symbolSize": 6, "label": { "show": false, "position": "top" } },
    //     { "id": "Jennifer", "name": "Jennifer", "itemStyle": { "color": "#666666", "opacity": 1, "borderWidth": 0 }, "type": "line", "showSymbol": false, "symbolSize": 6, "label": { "show": false, "position": "top" } },
    //     { "id": "Matthew", "name": "Matthew", "itemStyle": { "color": "#E04355", "opacity": 1, "borderWidth": 0 }, "type": "line", "showSymbol": false, "symbolSize": 6, "label": { "show": false, "position": "top" } },
    //     { "id": "Robert", "name": "Robert", "itemStyle": { "color": "#FCC700", "opacity": 1, "borderWidth": 0 }, "type": "line", "showSymbol": false, "symbolSize": 6, "label": { "show": false, "position": "top" } },
    //     { "id": "Jose", "name": "Jose", "itemStyle": { "color": "#A868B7", "opacity": 1, "borderWidth": 0 }, "type": "line", "showSymbol": false, "symbolSize": 6, "label": { "show": false, "position": "top" } },
    //     { "id": "Anthony", "name": "Anthony", "itemStyle": { "color": "#3CCCCB", "opacity": 1, "borderWidth": 0 }, "type": "line", "showSymbol": false, "symbolSize": 6, "label": { "show": false, "position": "top" } },
    //     { "id": "Jessica", "name": "Jessica", "itemStyle": { "color": "#A38F79", "opacity": 1, "borderWidth": 0 }, "type": "line", "showSymbol": false, "symbolSize": 6, "label": { "show": false, "position": "top" } }
    //   ],
    //   "toolbox": { "show": false, "top": 0, "right": 5, "feature": { "dataZoom": { "title": { "zoom": "zoom area", "back": "restore zoom" } } } },
    //   "dataZoom": []
    // }`;
    //       demoRef.current += 1;
    //       dispatch({ type: 'success', payload: { optionResult: result } });
    //     }, 4000);
    // SupersetClient.get({
    //   url: `https://supersetai.sandcastle.musta.ch/echarts?prompt=${prompt}`,
    //   mode: 'cors',
    //   credentials: 'include',
    //   // jsonPayload: {
    //   //   prompt,
    //   // },
    // }).then(({ json }) => {
    //   console.log('result', json);
    // });
    SupersetClient.post({
      url: '/chat/',
      jsonPayload: {
        echartOptions: JSON.stringify(chartOptionRef.current),
        userInput: prompt,
      },
    }).then(({ json }) => {
      const optionResult = json.result.startsWith('```json\n')
        ? json.result.slice(8, -3)
        : json.result;
      dispatch({ type: 'success', payload: { optionResult } });
    });
  }, []);

  const [step, setStep] = useState(0);

  useEffect(() => {
    if (prompts[prompts.length - 1]?.loading === true) {
      document?.getElementById('prompt')?.scrollIntoView({
        behavior: 'smooth',
      });
    } else {
      document?.getElementById('prompt')?.focus();
    }
  }, [prompts, step]);

  const postProcess = useCallback(
    ({ echartOptions, ...options }: TimeseriesChartTransformedProps) => {
      chartOptionRef.current = echartOptions;
      return { echartOptions, ...options };
    },
    [],
  );

  return (
    <Flex>
      <ChartContainer>
        <ChartRenderer
          formData={formData}
          queriesResponse={queriesResponse}
          actions={{
            chartRenderingSucceeded: () => {},
          }}
          chartStatus="rendered"
          postTransformProps={postProcess}
        />
      </ChartContainer>
      {prompts.map(({ id, ...props }, i) => (
        <ResultCard
          key={`${id}`}
          {...props}
          formData={formData}
          queriesResponse={queriesResponse}
        ></ResultCard>
      ))}
      {prompts.length === 0 && (
        <LiveText
          as="h4"
          text="How would you like to change?"
          onCompleted={() => setStep(1)}
        />
      )}
      <PromptInput
        onSubmit={onSubmit}
        disabled={prompts[prompts.length - 1]?.loading === true}
      />
    </Flex>
  );
};

export default Content;
