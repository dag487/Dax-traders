'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Localize } from '@deriv-com/translations';
import { useRiseFallTrading } from '../../hooks/use-rise-fall-trading';
import { useDerivWSContext } from '@/components/custom/deriv-ws-provider';
import { useLogoSrc } from '@/components/custom/logo-src-provider';
import { useAppTranslations } from '@/components/custom/i18n-provider';
import { Header } from '@/components/custom/header';
import { ThemeToggle } from '@/components/custom/theme-toggle';
import { Footer } from '@/components/custom/footer';
import Link from 'next/link';
import { PositionsTable } from '@/components/custom/positions-table';

function getRiseFallContractLabels(
  localize: (text: string, values?: Record<string, unknown>) => string
): Record<string, string> {
  return {
    CALL: localize('Rise'),
    PUT: localize('Fall'),
    CALLE: localize('Rise (Equal)'),
    PUTE: localize('Fall (Equal)'),
  };
}

export default function ReportsPage() {
  const logoSrc = useLogoSrc();
  const router = useRouter();
  const { localize } = useAppTranslations();
  const contractTypeLabels = getRiseFallContractLabels(localize);
  const { ws, isConnected, isExhausted, auth } = useDerivWSContext();
  const { authState, accounts, activeAccount, login, signUp, logout, switchAccount } = auth;
  const trading = useRiseFallTrading({ ws, isConnected, isExhausted, isAuthenticated: !!auth.wsUrl, onAuthWSFailed: logout });

  useEffect(() => {
    if (authState === 'unauthenticated' || authState === 'error') {
      router.replace('/');
    }
  }, [authState, router]);

  if (authState !== 'authenticated') {
    return (
      <main className="flex flex-col bg-background items-center justify-center min-h-dvh">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }


  return (
    <main className="flex flex-col bg-background max-lg:h-dvh max-lg:overflow-y-auto lg:min-h-dvh">
      <Header
        authState={authState}
        accounts={accounts}
        activeAccount={activeAccount}
        onLogin={login}
        onSignUp={signUp}
        onLogout={logout}
        onSwitchAccount={switchAccount}
        logoSrc={logoSrc}
        actions={<ThemeToggle />}
      />

      <div className="flex-1 w-full max-w-7xl mx-auto px-3 py-4 sm:px-4 sm:py-6 pb-14">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4">
          <span className="text-base leading-none">←</span>
          <span><Localize i18n_default_text="Back" /></span>
        </Link>
        <PositionsTable
          openPositions={trading.openPositions.filter(p => Object.keys(contractTypeLabels).includes(p.contract_type))}
          closedPositions={trading.closedPositions.filter(p => Object.keys(contractTypeLabels).includes(p.contract_type))}
          onSell={trading.sellContract}
          sellingId={trading.sellingId}
          sellError={trading.sellError}
          onClearSellError={trading.clearSellError}
          contractTypeLabels={contractTypeLabels}
          className="mt-0"
        />
      </div>

      {/* Fixed footer */}
      <div className="fixed bottom-0 left-0 right-0 py-2 text-center bg-background/80 backdrop-blur-sm">
        <Footer />
      </div>
    </main>
  );
}
