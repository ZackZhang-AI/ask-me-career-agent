import { Fragment } from "react";
import { parseAnswerEmphasis } from "../lib/answer-format";

export function FormattedAnswer({ content }: { content: string }) {
  return (
    <div className="message-content">
      {parseAnswerEmphasis(content).map((segment, index) => (
        segment.emphasized
          ? <strong key={index}>{segment.text}</strong>
          : <Fragment key={index}>{segment.text}</Fragment>
      ))}
    </div>
  );
}
