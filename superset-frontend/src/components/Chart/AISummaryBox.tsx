/**
 * AISummaryBox
 *
 * Renders a compact, three-line AI-generated summary under a chart.
 *
 * Behavior
 * - Prefers summarizing lightweight structured data extracted from queries.
 * - Falls back to a low-resolution PNG snapshot of the chart if data sample is unavailable.
 * - Calls generateSummary(), which prefers a backend endpoint and gracefully degrades to
 *   a generic 3-line placeholder when the endpoint is missing or returns an error.
 *
 * Styling
 * - Shows an animated gradient border ("running color") around a lightly translucent container.
 *
 * Integration
 * - Place directly beneath SuperChart; pass `chartDomId` of the rendered chart container
 *   (e.g., `chart-id-<chartId>`) so snapshots can be captured when needed.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import styled from '@emotion/styled';
import { keyframes } from '@emotion/react';
import { rgba } from 'polished';
import Icons from 'src/components/Icons';
import { generateSummary, extractRawDataSample } from '../../utils/aiSummary';

type Props = {
  chartDomId: string; // DOM id of the chart container (e.g., `chart-id-<id>`)
  vizType: string;
  title?: string;
  description?: string;
  queriesData?: unknown;
  timeRange?: string | null;
  filters?: Record<string, unknown>;
  onHeightChange?: (height: number) => void;
};

const shimmer = keyframes`
  0% { background-position: 0% 50%; }
  100% { background-position: 200% 50%; }
`;

const Border = styled('div')`
  position: relative;
  border-radius: 10px;
  padding: 1px;
  background: ${({ theme }) =>
    `linear-gradient(90deg, ${rgba(theme.colors.primary.base, 0.25)}, ${rgba(
      theme.colors.success.base,
      0.25,
    )}, ${rgba(theme.colors.primary.base, 0.25)})`};
  background-size: 200% 200%;
  animation: ${shimmer} 6s linear infinite;
  box-shadow: none;
`;

// background: ${({ theme }) => rgba(theme.colors.grayscale.light5, 0.25)};
const Container = styled('div')<{ hasActionButton: boolean }>`
  border-radius: 9px;
  color: inherit;
  padding: 8px 12px
    ${({ hasActionButton }) => (hasActionButton ? '22px' : '8px')};
  font-size: 12px;
  line-height: 1.45;
  backdrop-filter: none;
  box-shadow: none;
  overflow: visible;
  margin-bottom: 4px;
  display: grid;
  grid-template-columns: 18px 1fr;
  grid-auto-rows: auto;
  column-gap: 8px;
  user-select: none;
`;
const SkeletonLine = styled('div')`
  height: 12px;
  width: 100%;
  margin: 6px 0;
  border-radius: 6px;
  background: ${({ theme }) =>
    `linear-gradient(90deg, ${theme.colors.grayscale.light3}, ${theme.colors.grayscale.light2}, ${theme.colors.grayscale.light3})`};
  background-size: 200% 200%;
  animation: ${shimmer} 1.5s ease-in-out infinite;
`;

const TextWrapper = styled('div')`
  grid-column: 2;
`;

const FullText = styled('div')`
  white-space: normal;
  word-break: break-word;
`;

const CollapsedLine = styled('div')`
  white-space: normal;
  word-break: break-word;
  display: block;
`;

const HiddenMeasure = styled('div')`
  position: absolute;
  left: 0;
  top: 0;
  visibility: hidden;
  pointer-events: none;
  white-space: normal;
  width: 100%;
  height: auto;
  overflow: visible;
`;

const ActionButton = styled('button')`
  position: absolute;
  right: 10px;
  bottom: 8px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: none;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: ${({ theme }) => theme.colors.grayscale.light3};
  color: inherit;
  cursor: pointer;
  box-shadow: none;
  &:hover {
    background: ${({ theme }) => theme.colors.grayscale.light2};
  }
`;

export default function AISummaryBox({
  chartDomId,
  vizType,
  title,
  description,
  queriesData,
  timeRange,
  filters,
  onHeightChange,
}: Props) {
  // Summary state lifecycle: loading -> text OR error
  const [summary, setSummary] = useState<string>('');
  const [expanded, setExpanded] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const borderRef = useRef<HTMLDivElement | null>(null);
  const textWrapperRef = useRef<HTMLDivElement | null>(null);
  const measureRef = useRef<HTMLDivElement | null>(null);

  // Extract a compact data sample for the model; avoids sending full results
  // Use raw sample rows for the custom API contract
  const dataSample = useMemo(
    () => extractRawDataSample(queriesData),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(queriesData)],
  );

  // Kick off AI summary generation, with abort support and graceful error fallback
  async function run() {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      const imageBase64 = undefined;
      const text = await generateSummary(
        {
          vizType,
          title,
          description,
          dataSample,
          imageBase64,
          timeRange: timeRange ?? null,
          filters: filters ?? {},
        },
        {
          mode: dataSample ? 'data' : 'image',
          signal: controller.signal,
        },
      );
      setSummary(text);
    } catch (e: any) {
      setError(e?.message || 'Failed to summarize');
    } finally {
      setLoading(false);
    }
  }

  // Memoize filters string to avoid re-renders
  const filtersString = useMemo(() => JSON.stringify(filters), [filters]);

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    vizType,
    chartDomId,
    title,
    description,
    dataSample,
    timeRange,
    filtersString,
  ]);

  const shouldShow =
    !loading && !error && Boolean(summary && summary.trim().length > 0);

  const fullText = useMemo(() => summary || '', [summary]);

  // Inline truncation with trailing "…"
  const [collapsedText, setCollapsedText] = useState<string>('');
  const [needsMore, setNeedsMore] = useState<boolean>(false);

  useEffect(() => {
    if (!shouldShow || expanded) return;
    const node = measureRef.current;
    if (!node) return;

    // Measure full text height first to decide if truncation is needed
    node.innerHTML = fullText;
    const lineHeight = parseFloat(
      window.getComputedStyle(node).lineHeight || '0',
    );
    const maxHeight = Math.ceil(lineHeight * 3);
    const fullHeight = Math.ceil(node.getBoundingClientRect().height);

    if (fullHeight <= maxHeight) {
      setCollapsedText(fullText);
      setNeedsMore(false);
      return;
    }

    setNeedsMore(true);
    const suffix = ' …';

    // Binary search best cut index
    let low = 0;
    let high = fullText.length;
    let best = 0;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      node.innerHTML = `${fullText.slice(0, mid)}${suffix}`;
      const h = Math.ceil(node.getBoundingClientRect().height);
      if (h <= maxHeight) {
        best = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    // Prefer word boundary near best
    let cut = best;
    const lookback = 20;
    const spaceIdx = fullText
      .slice(Math.max(0, best - lookback), best)
      .lastIndexOf(' ');
    if (spaceIdx > -1) {
      cut = Math.max(0, best - (lookback - spaceIdx));
    }

    setCollapsedText(`${fullText.slice(0, cut).trimEnd()}${suffix}`);
  }, [shouldShow, expanded, fullText]);

  // Recompute on resize when collapsed
  useEffect(() => {
    if (!shouldShow || expanded) return undefined;
    const handler = () => {
      // force recompute by updating dependency-like state
      setCollapsedText(prev => prev);
    };
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, [shouldShow, expanded]);

  // Report height to parent during loading and when shown/hidden or expand/collapse/content changes
  useEffect(() => {
    if (!onHeightChange) return undefined;
    const node = borderRef.current;
    const id = window.setTimeout(() => {
      if (node) {
        const rect = node.getBoundingClientRect();
        onHeightChange(Math.ceil(rect.height));
      } else {
        onHeightChange(0);
      }
    }, 0);
    return () => window.clearTimeout(id);
  }, [onHeightChange, loading, shouldShow, expanded, fullText, collapsedText]);

  if (loading) {
    return (
      <Border ref={borderRef}>
        <Container hasActionButton={false}>
          <div style={{ gridColumn: 1, alignSelf: 'start' }}>
            <Icons.Ai width={14} height={14} aria-label="AI" />
          </div>
          <div style={{ gridColumn: 2 }}>
            <SkeletonLine />
            <SkeletonLine style={{ width: '92%' }} />
            <SkeletonLine style={{ width: '80%' }} />
            <div style={{ height: 8 }} />
          </div>
        </Container>
      </Border>
    );
  }

  if (!shouldShow) return null;

  const showActionButton = needsMore || expanded;
  const buttonTitle = expanded ? 'view less' : 'view more';
  const buttonIcon = expanded
    ? 'https://cdn.pixelbin.io/v2/fynd-console/original/fds/icons/ic_chevron_up.svg'
    : 'https://cdn.pixelbin.io/v2/fynd-console/original/fds/icons/ic_chevron_down.svg';

  return (
    <Border ref={borderRef}>
      <Container hasActionButton={showActionButton}>
        <div style={{ gridColumn: 1, alignSelf: 'start' }}>
          <Icons.Ai width={14} height={14} aria-label="AI" />
        </div>
        <TextWrapper ref={textWrapperRef}>
          {expanded ? (
            <FullText>{fullText}</FullText>
          ) : (
            <>
              <CollapsedLine>{collapsedText}</CollapsedLine>
              <HiddenMeasure ref={measureRef} />
            </>
          )}
          {showActionButton ? (
            <ActionButton
              type="button"
              onClick={() => setExpanded(v => !v)}
              title={buttonTitle}
              aria-label={buttonTitle}
            >
              <img src={buttonIcon} alt="" width={12} height={12} />
            </ActionButton>
          ) : null}
        </TextWrapper>
      </Container>
    </Border>
  );
}
