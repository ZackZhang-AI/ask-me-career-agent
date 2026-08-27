export interface StreamUnit {
  text: string;
  sentenceComplete: boolean;
}

const STRONG_BOUNDARY = /[。！？!?!；;\n]/;
const SOFT_BOUNDARY = /[，,、：:]/;

/**
 * Keep the model stream private until a readable, checkable fragment is ready.
 * Strong punctuation is preferred; long clauses may use a soft boundary so the
 * first visible text does not wait for the entire answer.
 */
export function takeStreamUnits(input: string, flush = false): { units: StreamUnit[]; rest: string } {
  const units: StreamUnit[] = [];
  let start = 0;
  let lastSoftBoundary = -1;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (SOFT_BOUNDARY.test(character)) lastSoftBoundary = index;
    const length = index - start + 1;
    const strong = STRONG_BOUNDARY.test(character);
    const soft = length >= 72 && lastSoftBoundary >= start && index - lastSoftBoundary <= 12;
    const forced = length >= 140;
    if (!strong && !soft && !forced) continue;

    const end = strong || forced ? index + 1 : lastSoftBoundary + 1;
    const text = input.slice(start, end);
    if (text.trim()) units.push({ text, sentenceComplete: strong || forced });
    start = end;
    lastSoftBoundary = -1;
    index = end - 1;
  }

  const rest = input.slice(start);
  if (flush && rest.trim()) {
    units.push({ text: rest, sentenceComplete: true });
    return { units, rest: "" };
  }
  return { units, rest };
}

