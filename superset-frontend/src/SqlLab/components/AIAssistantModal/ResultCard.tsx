import { styled } from '@superset-ui/core';
import {
  FC,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';
import { Button, Skeleton } from 'src/components';
import { TextAreaEditor } from 'src/components/AsyncAceEditor';
import ChartRenderer from 'src/components/Chart/ChartRenderer';
import { TimeseriesChartTransformedProps } from '@superset-ui/plugin-chart-echarts';
import LiveText from './LiveText';

const ChartContainer = styled.div`
  border: 1px ${({ theme }) => theme.colors.grayscale.light2} solid;
  border-radius: 8px;
  position: relative;
  height: 300px;
`;

const StyledLoading = styled.div`
  padding: 20px;
`;

const Flex = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
`;

const ResultCard = ({
  formData,
  queriesResponse,
  loading,
  prompt,
  optionResult,
}) => {
  const editorRef = useRef(null);
  const [overrideEchartOpt, setOverrideEchartOpt] = useState(optionResult);
  const [showEditor, setShowEditor] = useState(false);
  const postProcess = useCallback(
    ({ echartOptions, ...options }: TimeseriesChartTransformedProps) => {
      let compiled;
      try {
        compiled = new Function('return ' + overrideEchartOpt)();
      } catch (e) {
        // skip
        console.log(e);
      }
      try {
        if (!compiled) {
          compiled = new Function('return ' + optionResult)();
        }
      } catch (e) {
        // skip
        console.log(e);
      }
      return {
        ...options,
        echartOptions,
        customEchartOptions: compiled,
      };
    },
    [optionResult, overrideEchartOpt],
  );

  const onEditorLoad = useCallback(editor => {
    // editorRef.current = editor;
    editorRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'end',
    });
  }, []);

  const handleEditClick = useCallback(() => {
    if (!showEditor) {
      setShowEditor(true);
    } else {
      editorRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'end',
      });
    }
  }, [showEditor]);

  return (
    <>
      {loading ? <LiveText as="h4" text={prompt} /> : <h4>{prompt}</h4>}
      <ChartContainer>
        {loading ? (
          <StyledLoading>
            <Skeleton active paragraph />
          </StyledLoading>
        ) : (
          <ChartRenderer
            formData={formData}
            postTransformProps={postProcess}
            queriesResponse={queriesResponse}
            actions={{
              chartRenderingSucceeded: () => {},
            }}
            chartStatus="rendered"
            width={329}
            height={300}
          />
        )}
      </ChartContainer>

      {showEditor && (
        <AutoSizer disableHeight>
          {({ width }) => (
            <TextAreaEditor
              value={overrideEchartOpt || optionResult}
              width={width}
              height={300}
              onChange={(val: string) => {
                setOverrideEchartOpt(val);
              }}
              onLoad={onEditorLoad}
            />
          )}
        </AutoSizer>
      )}
      {!loading && (
        <Flex ref={editorRef}>
          <Button onClick={handleEditClick}>Edit Chart Config</Button>
          <Button buttonStyle="primary">Apply change</Button>
        </Flex>
      )}
    </>
  );
};

export default ResultCard;
