import { Fragment } from "react";
import { parseAnswerEmphasis } from "../lib/answer-format";
import { answerParagraphs } from "../lib/answer-citations";
import type { AnswerCitation, Source } from "../lib/types";

interface FormattedAnswerProps {
  content: string;
  citations?: AnswerCitation[];
  sources?: Source[];
  onCitationClick?: (sourceId: string) => void;
}

export function FormattedAnswer({ content, citations = [], sources = [], onCitationClick }: FormattedAnswerProps) {
  const sourceNumbers = new Map(sources.map((source, index) => [source.id, index + 1]));
  return (
    <div className="message-content">
      {answerParagraphs(content).map((paragraph, paragraphIndex) => {
        const sourceIds = [...new Set(citations
          .filter((citation) => citation.paragraphIndex === paragraphIndex)
          .flatMap((citation) => citation.sourceIds))]
          .filter((sourceId) => sourceNumbers.has(sourceId));
        return (
          <p key={`${paragraphIndex}-${paragraph.slice(0, 16)}`}>
            {parseAnswerEmphasis(paragraph).map((segment, segmentIndex) => (
              segment.emphasized
                ? <strong key={segmentIndex}>{segment.text}</strong>
                : <Fragment key={segmentIndex}>{segment.text}</Fragment>
            ))}
            {sourceIds.length > 0 && (
              <span className="inline-citations" aria-label="本段公开来源">
                {sourceIds.map((sourceId) => (
                  <button
                    key={sourceId}
                    type="button"
                    aria-label={`查看来源 ${sourceNumbers.get(sourceId)}`}
                    onClick={() => onCitationClick?.(sourceId)}
                  >
                    {sourceNumbers.get(sourceId)}
                  </button>
                ))}
              </span>
            )}
          </p>
        );
      })}
    </div>
  );
}
