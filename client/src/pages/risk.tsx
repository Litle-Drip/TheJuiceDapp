import { Card } from '@/components/ui/card';
import { Link } from 'wouter';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function RiskDisclosure() {
  return (
    <div className="space-y-4 max-w-xl mx-auto" data-testid="risk-page">
      <div className="mb-4">
        <Link href="/">
          <Button variant="ghost" size="sm" data-testid="button-back">
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Back
          </Button>
        </Link>
      </div>
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Risk Disclosure</h1>
        <p className="text-xs text-muted-foreground mt-1">Last updated: 12/4/2025</p>
      </div>
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4 p-3 rounded-md border border-amber-500/30 bg-amber-500/5" data-testid="risk-warning-banner">
          <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
          <p className="text-sm text-amber-400 font-medium" data-testid="text-risk-warning">Using The Juice and related tools from Edison Labs LLC involves significant risks.</p>
        </div>

        <div className="space-y-5 text-sm leading-relaxed text-muted-foreground">
          <p>By interacting with our website, smart contracts, or any associated services, you acknowledge and accept the following:</p>

          <Section title="1. Digital Asset Risk">
            Digital assets are highly volatile and may lose some or all of their value. You should not use funds you cannot afford to lose.
          </Section>

          <Section title="2. Smart Contract & Technical Risk">
            Smart contracts are experimental software. They may contain bugs, vulnerabilities, or behave in unexpected ways. Interacting with them can lead to permanent loss of funds.
          </Section>

          <Section title="3. Irreversible Transactions">
            Blockchain transactions are generally irreversible. Once a transaction is broadcast and confirmed, it cannot be undone, reversed, or forcibly refunded.
          </Section>

          <Section title="4. Network & Infrastructure Risk">
            Congestion, forks, failed transactions, RPC outages, or chain-level issues can impact your experience and may lead to stuck, delayed, or more expensive transactions.
          </Section>

          <Section title="5. Legal & Regulatory Risk">
            Rules related to digital assets, contests, and wagering differ by jurisdiction and may change over time. You are solely responsible for understanding and complying with laws that apply to you.
          </Section>

          <Section title="6. No Guarantees or Insurance">
            There is no guarantee of uptime, availability, performance, or security. There is no insurance or guaranteed recovery if funds are lost.
          </Section>

          <p className="font-medium text-foreground pt-2">By using The Juice or any tool operated by Edison Labs LLC, you agree that you understand these risks and are using the Service entirely at your own risk and discretion.</p>
        </div>
      </Card>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-foreground font-semibold mb-2">{title}</h2>
      <div className="text-muted-foreground">{children}</div>
    </div>
  );
}
