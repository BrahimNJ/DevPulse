import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { DeliveryReportResponse } from './api.ts';
import { buildDeliveryInsights, signedPercentage, sizeRatio } from './delivery-insights.ts';
import { DEMO_DELIVERY_REPORT } from './demo.ts';
import { messagesFor } from './i18n.ts';

const en = messagesFor('en');

describe('delivery insights', () => {
  it('reads the example report as healthy but slowing down', () => {
    const insights = buildDeliveryInsights(DEMO_DELIVERY_REPORT, en, 'en');
    assert.deepEqual(
      insights.map((insight) => [insight.title, insight.tone]),
      [
        [en.delivery.kpis.leadTime, 'ok'],
        [en.delivery.reviews.title, 'ok'],
        [en.delivery.throughput.title, 'info'],
        [en.delivery.kpis.changeFailure, 'ok'],
      ],
    );
  });

  it('warns about large pull requests and concentrated reviews first', () => {
    const report: DeliveryReportResponse = {
      ...DEMO_DELIVERY_REPORT,
      sizes: [
        { bucket: 'S', count: 40, medianHours: 17 },
        { bucket: 'M', count: 30, medianHours: 60 },
        { bucket: 'L', count: 20, medianHours: 200 },
        { bucket: 'XL', count: 9, medianHours: 460 },
      ],
      reviewers: { count: 6, topTwoShare: 0.86, top: [] },
    };
    const insights = buildDeliveryInsights(report, en, 'en');
    assert.equal(insights.length, 4);
    assert.deepEqual(
      insights.slice(1, 3).map((insight) => insight.tone),
      ['warn', 'warn'],
    );
    assert.match(insights[1]?.text ?? '', /27/);
    assert.match(insights[2]?.text ?? '', /86%/);
  });

  it('compares sizes only when both have enough pull requests', () => {
    const sizes = (smallCount: number, largeHours: number): typeof DEMO_DELIVERY_REPORT => ({
      ...DEMO_DELIVERY_REPORT,
      sizes: [
        { bucket: 'S', count: smallCount, medianHours: 10 },
        { bucket: 'XL', count: 5, medianHours: largeHours },
      ],
    });
    assert.equal(sizeRatio(sizes(5, 100)), 10);
    assert.equal(sizeRatio(sizes(2, 100)), null);
    assert.equal(sizeRatio(sizes(5, 15)), null);
  });

  it('says nothing it cannot measure', () => {
    const report: DeliveryReportResponse = {
      ...DEMO_DELIVERY_REPORT,
      leadTime: null,
      reviewers: null,
      throughput: null,
      revertRate: null,
      bands: { leadTime: null, releaseFrequency: 'low', changeFailure: null },
    };
    assert.deepEqual(buildDeliveryInsights(report, en, 'en'), []);
  });

  it('signs a change with a true minus sign', () => {
    assert.equal(signedPercentage(0.46, 'en'), '+46%');
    assert.equal(signedPercentage(-0.18, 'en'), '−18%');
  });
});
