// @ts-check
import template from './screen.html?raw';
import { MILESTONES, DIMENSIONS, REASON_CODES, EXTERNAL_CODES, DISPUTE_GROUNDS } from '../../../engine/reviews.js';

export { template };

export default function reviewPolicy() {
  return { milestones: MILESTONES, dims: DIMENSIONS, reasons: REASON_CODES, external: EXTERNAL_CODES, grounds: DISPUTE_GROUNDS };
}
