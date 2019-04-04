// Built on https://github.com/Erkaman/regl-stats-widget (MIT license)

// widget styling constants.
const TEXT_SIZE = 10;
const TEXT_START = [7, 37];
const TEXT_SPACING = 6;
const HEADER_SIZE = 20;
const BOTTOM_SPACING = 20
const HEADER_POS = [3, 3];
const BG = '#000';
const FG = '#ccc';

const WIDTH = 160;
const HEIGHT = items =>
  items.length * TEXT_SIZE +
  (items.length - 1) * TEXT_SPACING +
  TEXT_START[1] +
  BOTTOM_SPACING;


class StatsWidget {

  constructor(items) {
    // the widget keeps track of the previous values of gpuTime,
    // in order to compute the frame time.
    const prevGpuTimes = []
    for (let i = 0; i < items.length; i++) {
      prevGpuTimes[i] = 0
    }

    // we update the widget every second, we need to keep track of the time:
    const totalTime = 1.1

    // we show the average frametime to the user.
    const N = 50
    const totalFrameTime = []
    const frameTimeCount = 0
    const avgFrameTime = []
    for (i = 0; i < items.length; ++i) {
      totalFrameTime[i] = 0.0
      avgFrameTime[i] = 0.0
    }
  }

  update(deltaTime) {
    totalTime += deltaTime
    if (totalTime > 1.0) {
      totalTime = 0


      // make sure that we clear the old text before drawing new text.
      _clearTextArea();

      // const frameTime;
      // for (let i = 0; i < drawCalls.length; i++) {
      //   const drawCall = drawCalls[i];

      //   this._drawTextItem(context, i, drawCalls[i], avgFrameTime[i]);
    }

    frameTimeCount++
    // make sure to update the previous gpuTime, and to compute the average.
    for (i = 0; i < drawCalls.length; i++) {
      drawCall = drawCalls[i];

      frameTime = drawCall[0].stats.gpuTime - prevGpuTimes[i];
      totalFrameTime[i] += frameTime;

      if (frameTimeCount === N) {
        avgFrameTime[i] = totalFrameTime[i] / N;
        totalFrameTime[i] = 0.0;
      }

      prevGpuTimes[i] = drawCall[0].stats.gpuTime;
    }

    // reset avg calculation.
    if (frameTimeCount === N) {
      frameTimeCount = 0;
    }
  }

  _createDOM() {
    const pr = Math.round(window.devicePixelRatio || 1);

    // the widget is contained in a <div>
    const container = document.createElement('div');
    container.style.cssText = 'position:fixed;top:20px;left:20px;opacity:0.8;z-index:10000;';

    // we draw the widget on a canvas.
    const canvas = document.createElement('canvas');

    const context = canvas.getContext('2d');

    // set canvas size
    canvas.width = WIDTH * pr;
    canvas.height = HEIGHT * pr;
    canvas.style.cssText = `width: ${WIDTH}px;height: ${HEIGHT}px`;

    // draw background.
    context.fillStyle = BG;
    context.fillRect(0, 0, WIDTH * pr, HEIGHT * pr);

    container.appendChild(canvas);
    document.body.appendChild(container);

    this.context = context;
  }

  _drawHeader(context) {
    const pr = Math.round(window.devicePixelRatio || 1);
    context.font = `bold ${HEADER_SIZE * pr}px Helvetica,Arial,sans-serif`;
    context.textBaseline = 'top';
    context.fillStyle = FG;
    context.fillText('Stats', HEADER_POS[0] * pr, HEADER_POS[1] * pr);
  }

  _clearTextArea(context) {
    const pr = Math.round(window.devicePixelRatio || 1);
    context.fillStyle = BG;
    context.fillRect(
      TEXT_START[0] * pr,
      TEXT_START[1] * pr,
      (WIDTH - TEXT_START[0]) * pr,
      (HEIGHT - TEXT_START[1]) * pr
    );
    context.font = `bold ${TEXT_SIZE * pr}px Helvetica,Arial,sans-serif`;
    context.fillStyle = FG;
  }

  _drawTextItem(context, i, title, value) {
    const pr = Math.round(window.devicePixelRatio || 1);
    // context, i, drawCalls[i], avgFrameTime[i]);
    const textCursor = [TEXT_START[0], TEXT_START[1]];
    const str = `${drawCall[1]} : ${Math.round(100.0 * avgFrameTime[i]) / 100.0}ms`
    context.fillText(str, textCursor[0] * pr, textCursor[1] * pr)

    // next line
    textCursor[1] += TEXT_SIZE + TEXT_SPACING
  }
}
