'use client';

import dynamic from 'next/dynamic';
import { Localize } from '@deriv-com/translations';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Footer, FooterBar } from '@/components/custom/footer';
import { Header } from '@/components/custom/header';
import { LoginPromptDialog } from '@/components/custom/login-prompt-dialog';
import { PinnedBuyBar } from '@/components/custom/pinned-buy-bar';
import { useAppTranslations } from '@/components/custom/i18n-provider';
import { SymbolSelector } from '@/components/custom/symbol-selector';
import { ThemeToggle } from '@/components/custom/theme-toggle';
import { Skeleton } from '@/components/ui/skeleton';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { useContractMarkers } from '@/hooks/use-contract-markers';
import { useCallback, useMemo, useState, type CSSProperties } from 'react';
import { Ban } from 'lucide-react';
import { TradeControls } from './trade-controls';
import { ConfigurableTradeControls, ConfigurableBuyButton } from './configurable-trade-controls';
import type { RiseFallAppConfig } from '../lib/app-config';

/**
 * A zone overlaid on the chart region. Two modes:
 *  - not-editable (no onClick): ⛔ "… · not editable" hint on hover.
 *  - selectable (onClick): clickable to select; ring highlights when selected.
 * Either way it blocks direct chart interaction in edit mode.
 */
function FixedZone({
  label,
  style,
  onClick,
  selected,
}: {
  label: string;
  style: CSSProperties;
  onClick?: () => void;
  selected?: boolean;
}) {
  const { localize } = useAppTranslations();
  const selectable = !!onClick;
  return (
    <div
      className={`group/zone absolute left-0 right-0 z-[60] ${selectable ? 'cursor-pointer' : ''}`}
      style={style}
      onClick={onClick}
    >
      <div
        className={[
          'pointer-events-none absolute inset-0 rounded-md ring-2 ring-inset transition-opacity',
          selected
            ? 'opacity-100 ring-primary'
            : 'opacity-0 ring-muted-foreground/30 group-hover/zone:opacity-100',
        ].join(' ')}
      >
        <span className="absolute left-3 top-2 flex items-center gap-1.5 rounded-md bg-background/90 px-2 py-1 text-[11px] font-medium text-muted-foreground shadow-sm ring-1 ring-border">
          {!selectable && <Ban className="h-3.5 w-3.5" />}
          {selectable ? label : localize('{{label}} · not editable', { label })}
        </span>
      </div>
    </div>
  );
}
import type {
  AuthState,
  DerivAccount,
  ActiveSymbol,
  ProposalInfo,
  BuyResult,
  DerivWS,
} from '@deriv/core';
import type { Direction, DurationSelectUnit, DurationOption } from '../lib/types';
import type { UseSmartChartsApiReturn } from '@/hooks/use-smartcharts-api';
import type { SmartChartChartData } from '@/hooks/use-smartchart-chart-data';
import type { OpenPosition } from '../lib/types';

const RiseFallChart = dynamic(() => import('./rise-fall-chart').then(module => module.RiseFallChart), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full animate-pulse rounded-md border border-border/50 dark:border-white/[0.08] bg-muted/30" />
  ),
});

// Edit-mode stand-in for the login prompt's auth handlers — same rule as the
// header: no OAuth navigation out of the editor.
const noopAsyncAuth = async () => {};

export interface RiseFallViewProps {
  // Auth
  authState: AuthState;
  accounts: DerivAccount[];
  activeAccount: DerivAccount | null;
  onLogin: () => Promise<void>;
  onSignUp: () => Promise<void>;
  onLogout: () => void;
  onSwitchAccount: (accountId: string) => Promise<void>;

  // Connection / loading
  ws: DerivWS | null;
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;

  // Market data
  symbols: ActiveSymbol[];
  activeSymbol: ActiveSymbol | null;
  selectSymbol: (symbol: string) => void;
  /** Recent price window + pip size for the active symbol — powers the
   *  Symbol Selector's movement indicator when the chart is hidden. */
  prices?: number[];
  pipSize?: number;

  // Trade controls
  direction: Direction;
  setDirection: (direction: Direction) => void;
  allowEquals: boolean;
  setAllowEquals: (value: boolean) => void;
  stake: string;
  setStake: (value: string) => void;
  duration: number;
  setDuration: (value: number) => void;
  durationOptions: DurationOption[];
  durationUnit: DurationSelectUnit;
  setDurationUnit: (unit: DurationSelectUnit) => void;
  endDate: Date | undefined;
  setEndDate: (date: Date | undefined) => void;
  endTime: string;
  setEndTime: (time: string) => void;
  proposal: ProposalInfo | null;
  buyContract: () => Promise<void>;
  isBuying: boolean;
  buyResult: BuyResult | null;
  buyError: string | null;
  clearBuyResult: () => void;

  // Positions
  openPositions: OpenPosition[];
  sellContract: (contractId: number, bidPrice: string) => Promise<void>;
  sellingId: number | null;

  // Chart data (elevated to page so preview can inject frozen mocks)
  chartData: SmartChartChartData | undefined;
  getQuotes: UseSmartChartsApiReturn['getQuotes'];
  subscribeQuotes: UseSmartChartsApiReturn['subscribeQuotes'];
  unsubscribeQuotes: UseSmartChartsApiReturn['unsubscribeQuotes'];
  /** Passed to SmartChart. Set to false for a frozen preview. Defaults to true. */
  isLive?: boolean;
  /**
   * Unix epoch (seconds) to freeze the chart at. When set, SmartCharts renders
   * a static historical snapshot and never sets up a live subscription.
   */
  endEpoch?: number;

  // Branding (used by preview route; no-op in the real app)
  logoSrc?: string;
  appName?: string;
  showAppName?: boolean;

  /**
   * No-code config. When provided, the trade controls render in configurable
   * styles/order (ConfigurableTradeControls). When omitted, the standard
   * TradeControls render unchanged.
   */
  appConfig?: RiseFallAppConfig;
  /** Edit mode — components become selectable (click opens their accordion). */
  editMode?: boolean;
  /** Called when an editable component is clicked (e.g. "chart", "stake"). */
  onSelect?: (key: string) => void;
  /** Currently selected component (highlighted). */
  selectedKey?: string | null;
  /** Rearrange mode — drag blocks in the phone to reorder the layout. */
  rearrangeMode?: boolean;
  /** Called with the new block order after a drag-drop reorder. */
  onReorder?: (order: RiseFallAppConfig['order']) => void;
}

export function RiseFallView({
  authState,
  accounts,
  activeAccount,
  onLogin,
  onSignUp,
  onLogout,
  onSwitchAccount,
  ws,
  isConnected,
  isLoading,
  error,
  symbols,
  activeSymbol,
  selectSymbol,
  prices,
  pipSize,
  direction,
  setDirection,
  allowEquals,
  setAllowEquals,
  stake,
  setStake,
  duration,
  setDuration,
  durationOptions,
  durationUnit,
  setDurationUnit,
  endDate,
  setEndDate,
  endTime,
  setEndTime,
  proposal,
  buyContract,
  isBuying,
  buyResult,
  buyError,
  clearBuyResult,
  openPositions,
  chartData,
  getQuotes,
  subscribeQuotes,
  unsubscribeQuotes,
  isLive,
  endEpoch,
  logoSrc,
  appName,
  showAppName,
  appConfig,
  editMode,
  onSelect,
  selectedKey,
  rearrangeMode,
  onReorder,
}: RiseFallViewProps) {
  const { localize } = useAppTranslations();
  const isMobile = useIsMobile();
  const chartHidden = appConfig?.chart?.hidden ?? false;
  // Pinning is a mobile affordance: on desktop the controls card grows to fit,
  // so the Buy button is never scroll-clipped and a viewport-wide bar under a
  // 400px column would look detached.
  const pinBuy = !!appConfig?.buy?.pinned && isMobile;
  // With Buy unpinned the footer still has to sit at the end of the mobile
  // column — and a `fixed` footer makes that column reserve clearance for it.
  // That reservation was a guess (`pb-28`, 112px) for a footer that measures
  // 40px, leaving 72px of dead space under the Buy button at the bottom of the
  // scroll. Rendering it in flow, exactly as PinnedBuyBar does, ends the column
  // where the footer begins and removes the number to guess.
  //
  // Note what this does NOT depend on: `buy.pinned`. Every no-code mobile
  // render gets the in-flow band, so an existing unpinned project also moves
  // off the translucent `fixed` footer on its next redeploy. That is deliberate
  // — it is the dead-space fix — but it means the backward-compatibility rule
  // covers Buy's PLACEMENT, not the footer treatment: a pre-existing project
  // keeps Buy scrolling in the column, while its footer becomes the opaque
  // bordered band. A footer that moved after a redeploy is expected here, not a
  // regression.
  const inFlowFooter = !!appConfig && isMobile;
  const contractMarkers = useContractMarkers(openPositions, activeSymbol?.underlying_symbol, isMobile);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);

  // Logged-out Buy opens the login/sign-up prompt instead of sending a buy that
  // would fail with a "Purchase Failed" toast. One gate covers every Buy
  // surface (standard, configurable, pinned). Edit mode stays inert — the
  // editor owns Buy clicks there, and its auth actions are already no-ops.
  const handleBuy = useCallback(async () => {
    if (editMode) return;
    // Mid-OAuth (the ?code= callback) the header already shows a login in
    // progress — don't stack a "please log in" prompt on top of it.
    if (authState === 'authenticating') return;
    if (authState !== 'authenticated') {
      setShowLoginPrompt(true);
      return;
    }
    await buyContract();
  }, [editMode, authState, buyContract]);

  // In edit mode, login/sign-up/account actions are inert (no OAuth navigation
  // out of the editor) — only the theme toggle stays interactive.
  const headerEl = useMemo(() => {
    const noop = () => {};
    const noopAsync = async () => {};
    return (
      <Header
        authState={authState}
        accounts={accounts}
        activeAccount={activeAccount}
        onLogin={editMode ? noopAsync : onLogin}
        onSignUp={editMode ? noopAsync : onSignUp}
        onLogout={editMode ? noop : onLogout}
        onSwitchAccount={editMode ? noopAsync : onSwitchAccount}
        logoSrc={logoSrc}
        appName={appName}
        showAppName={showAppName}
        actions={<ThemeToggle />}
      />
    );
  }, [
    authState,
    accounts,
    activeAccount,
    editMode,
    onLogin,
    onSignUp,
    onLogout,
    onSwitchAccount,
    logoSrc,
    appName,
    showAppName,
  ]);

  // The chart + symbol block. Used in the standard 2-column layout (left column)
  // and as a reorderable block in the no-code layout. When the chart is hidden,
  // the SmartChart is NOT mounted at all (so nothing bleeds through) and a
  // standalone Symbol Selector takes its place so users can still switch markets.
  const chartBlock = useMemo(
    () =>
      chartHidden ? (
        <div className="rf-chart-hidden relative">
          <div className={editMode ? 'pointer-events-none select-none' : ''}>
            <SymbolSelector
              symbols={symbols}
              activeSymbol={activeSymbol}
              onSymbolChange={selectSymbol}
              prices={prices}
              pipSize={pipSize}
            />
          </div>
          {editMode && !rearrangeMode && (
            <FixedZone label={localize('Symbol picker')} style={{ top: 0, bottom: 0 }} />
          )}
        </div>
      ) : (
        <div className="relative max-lg:h-[45dvh] lg:h-[min(33.6rem,66vh)] lg:min-h-[384px]">
          <div className={`h-full ${editMode ? 'pointer-events-none select-none' : ''}`}>
            {chartData ? (
              <RiseFallChart
                symbolKey="rise-fall-chart"
                symbol={activeSymbol?.underlying_symbol}
                isConnectionOpened={isConnected}
                isMobile={isMobile}
                chartData={chartData}
                getQuotes={getQuotes}
                subscribeQuotes={subscribeQuotes}
                unsubscribeQuotes={unsubscribeQuotes}
                onSymbolChange={selectSymbol}
                isLive={isLive}
                endEpoch={endEpoch}
                contractsArray={contractMarkers}
              />
            ) : (
              <Skeleton className="h-full w-full rounded-md" />
            )}
          </div>

          {editMode && !rearrangeMode && (
            <>
              <FixedZone label={localize('Symbol picker')} style={{ top: 0, height: 54 }} />
              <FixedZone label={localize('Chart')} style={{ top: 54, bottom: 0 }} />
            </>
          )}
        </div>
      ),
    [
      chartHidden,
      symbols,
      prices,
      pipSize,
      editMode,
      chartData,
      activeSymbol,
      isConnected,
      isMobile,
      getQuotes,
      subscribeQuotes,
      unsubscribeQuotes,
      selectSymbol,
      isLive,
      endEpoch,
      contractMarkers,
      rearrangeMode,
      localize,
    ]
  );

  if (error) {
    return (
      <main className="flex flex-col bg-background items-center justify-center px-4 min-h-dvh">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-destructive">
              <Localize i18n_default_text="Connection Error" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </main>
    );
  }

  // The configurable controls. `withChart` includes the chart as a reorderable
  // block in the single column (mobile); on desktop the chart is its own column,
  // so it's omitted here.
  const renderConfigurable = (withChart: boolean) =>
    appConfig ? (
      <ConfigurableTradeControls
        config={appConfig}
        chartSlot={withChart ? chartBlock : undefined}
        direction={direction}
        onDirectionChange={setDirection}
        allowEquals={allowEquals}
        onAllowEqualsChange={setAllowEquals}
        isConnected={isConnected}
        stake={stake}
        onStakeChange={setStake}
        duration={duration}
        onDurationChange={setDuration}
        durationOptions={durationOptions}
        durationUnit={durationUnit}
        onDurationUnitChange={setDurationUnit}
        endDate={endDate}
        onEndDateChange={setEndDate}
        endTime={endTime}
        onEndTimeChange={setEndTime}
        ws={ws}
        activeSymbol={activeSymbol}
        proposal={proposal}
        onBuy={handleBuy}
        isBuying={isBuying}
        buyResult={buyResult}
        buyError={buyError}
        onClearBuyResult={clearBuyResult}
        isAuthenticated={authState === 'authenticated'}
        editMode={editMode}
        onSelect={onSelect}
        selectedKey={selectedKey}
        rearrangeMode={rearrangeMode}
        onReorder={onReorder}
        pinBuy={pinBuy}
      />
    ) : null;

  return (
    <main
      className={`flex flex-col max-lg:h-dvh lg:overflow-visible ${
        editMode ? 'bg-muted/50' : 'bg-background'
      }`}
    >
      {editMode ? (
        <div className="group/hdr sticky top-0 z-50">
          {headerEl}
          {/* Hover hint: a ring + a LEFT-aligned chip so it never covers the
              right-side theme toggle (which stays usable). pointer-events-none
              so nothing here blocks clicks. */}
          <div className="pointer-events-none absolute inset-0 z-[60] opacity-0 ring-2 ring-inset ring-muted-foreground/25 transition-opacity group-hover/hdr:opacity-100">
            <span className="absolute left-3 top-1/2 flex -translate-y-1/2 items-center gap-1.5 rounded-md bg-background/90 px-2 py-1 text-[11px] font-medium text-muted-foreground shadow-sm ring-1 ring-border">
              <Ban className="h-3.5 w-3.5" />
              <Localize i18n_default_text="Not editable" />
            </span>
          </div>
        </div>
      ) : (
        headerEl
      )}

      {appConfig ? (
        isMobile ? (
          /* No-code mobile layout: a single, reorderable column of blocks. The
             chart + symbol dropdown is one block (chartSlot); controls follow
             the configured order. */
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
            <div className="mx-auto flex w-full max-w-md flex-col gap-3 px-3 py-3">
              {isLoading ? <Skeleton className="h-48 w-full rounded-xl" /> : renderConfigurable(true)}
            </div>
          </div>
        ) : chartHidden ? (
          /* No-code desktop, chart OFF: a single centered column (symbol picker
             + controls stacked) at the controls' width — no wide empty chart
             column, and the height grows to fit its content (no inner scroll). */
          <div className="mx-auto flex w-full max-w-md flex-col gap-3 px-4 py-4">
            {isLoading ? (
              <Skeleton className="h-96 w-full rounded-xl" />
            ) : (
              renderConfigurable(true)
            )}
          </div>
        ) : (
          /* No-code desktop, chart ON: 2-column (chart left, controls card
             right). The card grows to its content height (no fixed height /
             inner scrollbar) — desktop has the vertical space. */
          <div className="flex w-full max-w-7xl mx-auto flex-col px-4 py-4 gap-3">
            <div className="grid grid-cols-[1fr_400px] gap-4 items-start">
              <div>{chartBlock}</div>
              {isLoading ? (
                <Skeleton className="h-[min(33.6rem,66vh)] min-h-[384px] w-full rounded-xl" />
              ) : (
                <Card>
                  <CardContent className="pt-4">{renderConfigurable(false)}</CardContent>
                </Card>
              )}
            </div>
          </div>
        )
      ) : (
        /* Standard layout (unchanged): 2-column chart + controls card. */
        <div className="flex w-full max-w-7xl mx-auto flex-col max-lg:px-0 max-lg:py-0 px-3 py-2 sm:px-4 sm:py-4 gap-2 sm:gap-3 max-lg:flex-1 max-lg:min-h-0 max-lg:overflow-hidden lg:flex-none lg:overflow-visible">
          <div className="max-lg:flex max-lg:flex-col max-lg:flex-1 max-lg:min-h-0 lg:grid lg:grid-cols-[1fr_400px] lg:gap-4">
            <div className="max-lg:shrink-0 flex flex-col gap-2 max-lg:px-3 max-lg:pb-2 pt-2 lg:py-0">
              {chartBlock}
            </div>
            <div className="max-lg:flex-1 max-lg:min-h-0 max-lg:overflow-y-auto max-lg:overscroll-contain max-lg:px-3 max-lg:border-t max-lg:border-border max-lg:pt-3 max-lg:pb-28 lg:pt-0 flex flex-col gap-3">
              {isLoading ? (
                <Skeleton className="lg:h-[min(33.6rem,66vh)] lg:min-h-[384px] max-lg:h-48 w-full rounded-xl" />
              ) : (
                <Card className="lg:h-[min(33.6rem,66vh)] lg:min-h-[384px] lg:overflow-y-auto">
                  <CardContent className="pt-4">
                    <TradeControls
                      direction={direction}
                      onDirectionChange={setDirection}
                      allowEquals={allowEquals}
                      onAllowEqualsChange={setAllowEquals}
                      isConnected={isConnected}
                      stake={stake}
                      onStakeChange={setStake}
                      duration={duration}
                      onDurationChange={setDuration}
                      durationOptions={durationOptions}
                      durationUnit={durationUnit}
                      onDurationUnitChange={setDurationUnit}
                      endDate={endDate}
                      onEndDateChange={setEndDate}
                      endTime={endTime}
                      onEndTimeChange={setEndTime}
                      ws={ws}
                      activeSymbol={activeSymbol}
                      proposal={proposal}
                      onBuy={handleBuy}
                      isBuying={isBuying}
                      buyResult={buyResult}
                      buyError={buyError}
                      onClearBuyResult={clearBuyResult}
                      isAuthenticated={authState === 'authenticated'}
                    />
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      )}

      {pinBuy ? (
        <PinnedBuyBar
          editMode={editMode}
          rearrangeMode={rearrangeMode}
          selected={selectedKey === 'buy'}
          onSelect={() => onSelect?.('buy')}
          label={localize('Buy button')}
        >
          <ConfigurableBuyButton
            variant={appConfig!.styles.buy}
            isConnected={isConnected}
            proposal={proposal}
            onBuy={handleBuy}
            isBuying={isBuying}
          />
        </PinnedBuyBar>
      ) : inFlowFooter ? (
        /* Unpinned mobile: the same band the pinned bar ends in, minus the Buy
           button — in flow at the end of the h-dvh column, so the scroll area
           ends where it begins and nothing reserves clearance for it. Sharing
           the band is what keeps the footer from moving when the pin toggles. */
        <FooterBar />
      ) : (
        /* Fixed footer — desktop and the standard layout, which scroll the
           document rather than an inner column. */
        <div className="fixed bottom-0 left-0 right-0 py-2 text-center bg-background/80 backdrop-blur-sm">
          <Footer />
        </div>
      )}

      <LoginPromptDialog
        open={showLoginPrompt}
        onOpenChange={setShowLoginPrompt}
        onLogin={editMode ? noopAsyncAuth : onLogin}
        onSignUp={editMode ? noopAsyncAuth : onSignUp}
      />
    </main>
  );
}
