import { test } from 'node:test';
import assert from 'node:assert/strict';
import { quantile, stats, frameCounts, pairedBootstrap, eligibleFrameP95 } from './metrics.mjs';

test('sparse frame samples do not become a tail-percentile claim', () => {
  assert.equal(eligibleFrameP95({ n: 7, p95: 2000 }), null);
  assert.equal(eligibleFrameP95({ n: 20, p95: 34 }), 34);
});

test('percentiles use observed values and exclude missing observations', () => {
  assert.equal(quantile([5, 1, 3, 2, 4], .95), 5);
  assert.equal(quantile([1, 2, 3, 4], .75), 3);
  assert.equal(quantile([], .95), null);
  assert.equal(stats([null, NaN, undefined, 7]).n, 1);
});
test('trace classification excludes other renderers and avoids double-counting partial frames', () => {
  const mark = (name, ts) => ({ name, ts, pid: 9 });
  const frame = (name, id, partial = false, pid = 9) => ({ name, ts: 15, pid, args: { layerTreeId: 2, frameSeqId: id, hasPartialUpdate: partial } });
  const result = frameCounts([
    mark('muc-start-drag', 10), mark('muc-end-drag', 20),
    frame('DrawFrame', 1), frame('DrawFrame', 1),
    frame('DroppedFrame', 2),
    frame('DrawFrame', 3), frame('DroppedFrame', 3, true),
    frame('DroppedFrame', 4, false, 10),
  ], 'drag');
  assert.equal(result.total, 3);
  assert.equal(result.dropped, 1);
  assert.equal(result.partial, 1);
});
test('paired bootstrap preserves pairing and direction', () => {
  const result = pairedBootstrap([100, 200, 300, 400], [90, 190, 290, 390]);
  assert.equal(result.medianImprovement, 10);
  assert.equal(result.low95, 10);
  assert.equal(result.high95, 10);
  assert.equal(pairedBootstrap([1], [0]), null);
});
