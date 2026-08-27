import assert from "node:assert/strict";
import test from "node:test";
import { parseAnswerEmphasis } from "../lib/answer-format.ts";
import { splitRevealGraphemes, StreamRevealController, type RevealScheduler } from "../lib/stream-reveal.ts";

class FakeScheduler implements RevealScheduler {
  time = 0;
  hidden = false;
  private nextHandle = 1;
  private frames = new Map<number, FrameRequestCallback>();

  now = () => this.time;
  isHidden = () => this.hidden;
  requestFrame = (callback: FrameRequestCallback) => {
    const handle = this.nextHandle++;
    this.frames.set(handle, callback);
    return handle;
  };
  cancelFrame = (handle: number) => {
    this.frames.delete(handle);
  };

  step(milliseconds = 16.7) {
    this.time += milliseconds;
    const callbacks = [...this.frames.values()];
    this.frames.clear();
    callbacks.forEach((callback) => callback(this.time));
  }

  get pendingFrames() {
    return this.frames.size;
  }
}

test("单个大安全片段会跨多个动画帧连续显示", async () => {
  const scheduler = new FakeScheduler();
  const updates: string[] = [];
  const content = "这是一段用于验证安全片段不会整块跳出的中文回答。".repeat(5);
  const controller = new StreamRevealController({ scheduler, reduceMotion: false, onUpdate: (value) => updates.push(value) });

  controller.enqueue(content);
  assert.equal(updates[0], "这");
  const finished = controller.finish();
  while (scheduler.pendingFrames && scheduler.time < 2_000) scheduler.step();

  assert.equal(await finished, content);
  assert.equal(updates.at(-1), content);
  assert.ok(updates.length > 10);
  assert.ok(updates.slice(1).every((value, index) => splitRevealGraphemes(value).length > splitRevealGraphemes(updates[index]).length));
  assert.ok(scheduler.time <= 1_550);
});

test("中文、英文、数字、Emoji 与换行按完整字素保留", () => {
  const content = "中文 AI 2026 👨‍💻\n继续";
  assert.equal(splitRevealGraphemes(content).join(""), content);
  assert.ok(splitRevealGraphemes(content).includes("👨‍💻"));
});

test("减少动画与后台页面会立即显示完整安全片段", async () => {
  const reducedScheduler = new FakeScheduler();
  let reduced = "";
  const reducedController = new StreamRevealController({ scheduler: reducedScheduler, reduceMotion: true, onUpdate: (value) => { reduced = value; } });
  reducedController.enqueue("减少动画时直接展示");
  assert.equal(await reducedController.finish(), reduced);
  assert.equal(reducedScheduler.pendingFrames, 0);

  const hiddenScheduler = new FakeScheduler();
  hiddenScheduler.hidden = true;
  let hidden = "";
  const hiddenController = new StreamRevealController({ scheduler: hiddenScheduler, reduceMotion: false, onUpdate: (value) => { hidden = value; } });
  hiddenController.enqueue("后台页面直接排空队列");
  assert.equal(await hiddenController.finish(), hidden);
  assert.equal(hiddenScheduler.pendingFrames, 0);
});

test("流式加粗标记未闭合时不显示裸露星号", () => {
  assert.deepEqual(parseAnswerEmphasis("我的优势是**数据判断", { hideUnclosedMarkers: true }), [
    { text: "我的优势是数据判断", emphasized: false },
  ]);
  assert.deepEqual(parseAnswerEmphasis("我的优势是**数据判断**和产品落地", { hideUnclosedMarkers: true }), [
    { text: "我的优势是", emphasized: false },
    { text: "数据判断", emphasized: true },
    { text: "和产品落地", emphasized: false },
  ]);
});

test("取消后不再释放旧回答字符", () => {
  const scheduler = new FakeScheduler();
  const updates: string[] = [];
  const controller = new StreamRevealController({ scheduler, reduceMotion: false, onUpdate: (value) => updates.push(value) });
  controller.enqueue("这段回答会被用户停止生成");
  const visibleAtCancel = updates.at(-1);
  controller.cancel();
  for (let index = 0; index < 10; index += 1) scheduler.step();
  assert.equal(updates.at(-1), visibleAtCancel);
  assert.equal(scheduler.pendingFrames, 0);
});
