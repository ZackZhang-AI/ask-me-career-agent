import { Fragment } from "react";
import { parseAnswerEmphasis } from "../lib/answer-format";
import { answerParagraphs } from "../lib/answer-citations";
import type { AnswerCitation, Source } from "../lib/types";

interface FormattedAnswerProps {
  content: string;
  citations?: AnswerCitation[];
  sources?: Source[];
  onCitationClick?: (sourceId: string) => void;
  streaming?: boolean;
}

const BULLET_LINE = /^(?:[-•*])\s+(.+)$/;
const NUMBERED_LINE = /^(\d+)[.、]\s+(.+)$/;

function renderEmphasizedText(text: string, streaming: boolean) {
  return parseAnswerEmphasis(text, { hideUnclosedMarkers: streaming }).map((segment, segmentIndex) => (
    segment.emphasized
      ? <strong key={segmentIndex}>{segment.text}</strong>
      : <Fragment key={segmentIndex}>{segment.text}</Fragment>
  ));
}

export function FormattedAnswer({
  content,
  citations = [],
  sources = [],
  onCitationClick,
  streaming = false,
}: FormattedAnswerProps) {
  const sourceNumbers = new Map(sources.map((source, index) => [source.id, index + 1]));

  const renderCitations = (sourceIds: string[]) => {
    if (sourceIds.length === 0) return null;
    return (
      <>
        {"\u2060"}
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
      </>
    );
  };

  return (
    <div className="message-content">
      {answerParagraphs(content).map((paragraph, paragraphIndex) => {
        const sourceIds = [...new Set(
          citations
            .filter((citation) => citation.paragraphIndex === paragraphIndex)
            .flatMap((citation) => citation.sourceIds),
        )]
          .filter((sourceId) => sourceNumbers.has(sourceId))
          .sort((left, right) => (sourceNumbers.get(left) ?? 0) - (sourceNumbers.get(right) ?? 0));

        const lines = paragraph.split("\n").map((line) => line.trim()).filter(Boolean);
        const isBulletList = lines.length >= 2 && lines.every((line) => BULLET_LINE.test(line));
        const isNumberedList = lines.length >= 2 && lines.every((line) => NUMBERED_LINE.test(line));

        if (isBulletList) {
          return (
            <ul className="answer-list" key={paragraphIndex}>
              {lines.map((line, lineIndex) => {
                const body = line.replace(BULLET_LINE, "$1");
                return (
                  <li key={lineIndex}>
                    {renderEmphasizedText(body, streaming)}
                    {lineIndex === lines.length - 1 && renderCitations(sourceIds)}
                  </li>
                );
              })}
            </ul>
          );
        }

        if (isNumberedList) {
          return (
            <ol className="answer-list is-numbered" key={paragraphIndex}>
              {lines.map((line, lineIndex) => {
                const body = line.replace(NUMBERED_LINE, "$2");
                return (
                  <li key={lineIndex}>
                    {renderEmphasizedText(body, streaming)}
                    {lineIndex === lines.length - 1 && renderCitations(sourceIds)}
                  </li>
                );
              })}
            </ol>
          );
        }

        return (
          <p key={paragraphIndex}>
            {renderEmphasizedText(paragraph, streaming)}
            {renderCitations(sourceIds)}
          </p>
        );
      })}
    </div>
  );
}
