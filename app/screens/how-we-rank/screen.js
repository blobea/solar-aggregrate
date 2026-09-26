// @ts-check
import template from './screen.html?raw';
import { RANKING_WEIGHTS, SPONSOR_RULES } from '../../../engine/ranking.js';
import { RATING_CONFIG } from '../../../engine/reviews.js';

export { template };

export default function howWeRank() {
  const labels = { price: 'Price', rating: 'Rating', accuracy: 'Quote accuracy', freshness: 'Freshness' };
  return {
    weights: Object.entries(RANKING_WEIGHTS).map(([key, value]) => ({ key, value, label: labels[/** @type {keyof labels} */ (key)] })),
    sponsorMin: SPONSOR_RULES.minRating.toFixed(1),
    ratingC: RATING_CONFIG.C,
  };
}
