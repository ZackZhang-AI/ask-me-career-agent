export interface RevealScheduler {
  now: () => number;
  requestFrame: (callback: FrameRequestCallback) => number;
  cancelFrame: (handle: number) => void;
  isHidden: () => boolean;
}

interface StreamRevealOptions {
  scheduler: RevealScheduler;
  reduceMotion: boolean;
  onUpdate: (visibleText: string) => void;
}

const BASE_RATE = 36;
const BUSY_RATE = 60;
const BACKLOG_RATE = 90;
const MAX_FINISHING_TAIL_MS = 1_500;
const SOFT_PUNCTUATION = /[，,、：:；;]/;
const STRONG_PUNCTUATION = /[。！？!?\n]/;
const graphemeSegmenter = typeof Intl !== "undefined" && "Segmenter" in Intl
  ? new Intl.Segmenter("zh", { granularity: "grapheme" })
  : undefined;

export function splitRevealGraphemes(value: string) {
  if (graphemeSegmenter) return [...graphemeSegmenter.segment(value)].map((part) => part.segment);
  return Array.from(value);
}

export function revealRateFor(backlog: number) {
  if (backlog > 180) return BACKLOG_RATE;
  if (backlog > 80) return BUSY_RATE;
  return BASE_RATE;
}

export class StreamRevealController {
  private queue: string[] = [];
  private visible = "";
  private frame: number | null = null;
  private lastFrameAt = 0;
  private credits = 0;
  private pauseUntil = 0;
  private finishingAt: number | null = null;
  private completion?: { resolve: (value: string) => void; reject: (reason: unknown) => void };

  constructor(private readonly options: StreamRevealOptions) {}

  enqueue(value: string) {
    const graphemes = splitRevealGraphemes(value);
    if (!graphemes.length) return;
    if (this.options.reduceMotion || this.options.scheduler.isHidden()) {
      this.visible += graphemes.join("");
      this.options.onUpdate(this.visible);
      return;
    }
    if (!this.visible && !this.queue.length) {
      this.visible = graphemes.shift() ?? "";
      this.options.onUpdate(this.visible);
    }
    this.queue.push(...graphemes);
    this.ensureFrame();
  }

  finish() {
    this.finishingAt = this.options.scheduler.now();
    if (!this.queue.length) return Promise.resolve(this.visible);
    this.ensureFrame();
    return new Promise<string>((resolve, reject) => {
      this.completion = { resolve, reject };
    });
  }

  flush() {
    if (!this.queue.length) {
      this.completeIfReady();
      return;
    }
    this.visible += this.queue.join("");
    this.queue = [];
    this.options.onUpdate(this.visible);
    this.completeIfReady();
  }

  cancel() {
    if (this.frame !== null) this.options.scheduler.cancelFrame(this.frame);
    this.frame = null;
    this.queue = [];
    this.completion?.reject(new DOMException("Aborted", "AbortError"));
    this.completion = undefined;
  }

  private ensureFrame() {
    if (this.frame !== null || !this.queue.length) return;
    this.frame = this.options.scheduler.requestFrame(this.tick);
  }

  private tick = (timestamp: number) => {
    this.frame = null;
    if (!this.queue.length) {
      this.completeIfReady();
      return;
    }
    if (this.options.reduceMotion || this.options.scheduler.isHidden()) {
      this.flush();
      return;
    }
    if (timestamp < this.pauseUntil) {
      this.ensureFrame();
      return;
    }

    const elapsed = this.lastFrameAt ? Math.min(50, timestamp - this.lastFrameAt) : 16.7;
    this.lastFrameAt = timestamp;
    const backlog = this.queue.length;
    let rate = revealRateFor(backlog);
    let finishingBatch = 0;
    if (this.finishingAt !== null) {
      const remainingMs = Math.max(16.7, MAX_FINISHING_TAIL_MS - (timestamp - this.finishingAt));
      rate = Math.max(rate, backlog * 1_000 / remainingMs);
      finishingBatch = Math.ceil(backlog / Math.max(1, Math.floor(remainingMs / 16.7)));
    }
    this.credits += elapsed * rate / 1_000;
    const normalBatch = backlog > 180 ? 4 : backlog > 80 ? 2 : 1;
    const count = Math.min(backlog, Math.max(0, Math.min(Math.max(normalBatch, finishingBatch), Math.floor(this.credits))));
    if (!count) {
      this.ensureFrame();
      return;
    }

    this.credits -= count;
    const chunk = this.queue.splice(0, count).join("");
    this.visible += chunk;
    this.options.onUpdate(this.visible);
    if (this.queue.length <= 80 && this.finishingAt === null) {
      const last = chunk.at(-1) ?? "";
      if (STRONG_PUNCTUATION.test(last)) this.pauseUntil = timestamp + 55;
      else if (SOFT_PUNCTUATION.test(last)) this.pauseUntil = timestamp + 20;
    }
    if (this.queue.length) this.ensureFrame();
    else this.completeIfReady();
  };

  private completeIfReady() {
    if (this.queue.length || this.finishingAt === null || !this.completion) return;
    const completion = this.completion;
    this.completion = undefined;
    completion.resolve(this.visible);
  }
}
