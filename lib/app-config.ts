/**
 * No-code Rise/Fall app config.
 *
 * Drives the EDITABLE parts of the real Rise/Fall app: the style variant of the
 * Rise/Fall, Duration and Stake controls, and the order of the control rows.
 * The symbol dropdown, chart, header and login/sign-up stay fixed. The theme
 * colour is handled by the existing branding pipeline (globals.css --primary).
 *
 * When no config is present the app renders exactly as today (default below).
 */

import { isStyleVariant, normalizeBlockOrder } from '@/lib/no-code-config';
import type { StyleVariant } from '@/lib/no-code-config';

export type { StyleVariant };

/** Styleable control rows (each has 3 style variants). */
export type ControlKey = 'riseFall' | 'allowEquals' | 'stake' | 'duration' | 'buy';

/**
 * Reorderable layout blocks. Same as the control keys plus `chart` — the chart +
 * symbol-dropdown move together as a single block. The header stays fixed.
 */
export type BlockKey = ControlKey | 'chart';

export interface RiseFallAppConfig {
  styles: {
    riseFall: StyleVariant;
    allowEquals: StyleVariant;
    duration: StyleVariant;
    stake: StyleVariant;
    buy: StyleVariant;
  };
  /** Top-to-bottom order of layout blocks (includes `chart`). */
  order: BlockKey[];
  /**
   * Chart options. `hidden` removes the price chart while keeping the symbol
   * dropdown (rendered standalone). The series colour itself isn't configurable
   * (SmartCharts is a Flutter canvas — theme dark/light only).
   */
  chart: {
    hidden: boolean;
  };
  /**
   * Buy button options. `pinned` lifts the Buy button out of the scrolling
   * column into a bar at the bottom of the mobile layout, directly above the
   * footer. Desktop is unaffected — its controls card grows to fit, so the Buy
   * button is never scrolled out of reach there.
   */
  buy: {
    pinned: boolean;
  };
}

export const ALL_CONTROL_KEYS: ControlKey[] = [
  'riseFall',
  'allowEquals',
  'stake',
  'duration',
  'buy',
];

/** All reorderable blocks, in default order (chart first). */
export const ALL_BLOCK_KEYS: BlockKey[] = [
  'chart',
  'riseFall',
  'allowEquals',
  'stake',
  'duration',
  'buy',
];

export const DEFAULT_APP_CONFIG: RiseFallAppConfig = {
  styles: { riseFall: 'a', allowEquals: 'a', duration: 'a', stake: 'a', buy: 'a' },
  order: ['chart', 'riseFall', 'allowEquals', 'stake', 'duration', 'buy'],
  chart: { hidden: false },
  buy: { pinned: true },
};

/** Validate + normalise an arbitrary value into a safe RiseFallAppConfig. */
export function normalizeAppConfig(value: unknown): RiseFallAppConfig {
  if (!value || typeof value !== 'object') return DEFAULT_APP_CONFIG;
  const raw = value as Partial<RiseFallAppConfig>;
  const styles = {
    riseFall: isStyleVariant(raw.styles?.riseFall) ? raw.styles!.riseFall : 'a',
    allowEquals: isStyleVariant(raw.styles?.allowEquals) ? raw.styles!.allowEquals : 'a',
    duration: isStyleVariant(raw.styles?.duration) ? raw.styles!.duration : 'a',
    stake: isStyleVariant(raw.styles?.stake) ? raw.styles!.stake : 'a',
    buy: isStyleVariant(raw.styles?.buy) ? raw.styles!.buy : 'a',
  };
  const order = normalizeBlockOrder(raw.order, ALL_BLOCK_KEYS);
  // A stored config with no `buy` key predates the pin option: keep that app
  // unpinned rather than adopting the new default on its owner's behalf.
  return {
    styles,
    order,
    chart: { hidden: raw.chart?.hidden === true },
    buy: { pinned: !!raw.buy?.pinned },
  };
}
