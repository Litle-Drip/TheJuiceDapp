import { Card } from '@/components/ui/card';
import { Link } from 'wouter';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Terms() {
  return (
    <div className="space-y-4 max-w-xl mx-auto" data-testid="terms-page">
      <div className="mb-4">
        <Link href="/">
          <Button variant="ghost" size="sm" data-testid="button-back">
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Back
          </Button>
        </Link>
      </div>
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Terms of Use</h1>
        <p className="text-xs text-muted-foreground mt-1">Last updated: 12/4/2025</p>
      </div>
      <Card className="p-6">
        <div className="space-y-5 text-sm leading-relaxed text-muted-foreground">
          <p>These Terms of Use ("Terms") govern your access to and use of the websites, applications, and smart contracts operated by Edison Labs LLC, including thejuiceapp.io and any related interfaces (collectively, the "Service").</p>
          <p>By accessing or using the Service, you agree to be bound by these Terms. If you do not agree, do not use the Service.</p>

          <Section title="1. Who We Are">
            The Service is operated by Edison Labs LLC ("Edison Labs", "we", "us", or "our"), a software development and innovation studio that develops software and digital tools, including blockchain-based applications, digital asset operations, and experimental technology projects.
          </Section>

          <Section title="2. Eligibility">
            <p>You may use the Service only if:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>you are at least 18 years old (or the age of majority in your jurisdiction), and</li>
              <li>you are legally permitted to use the Service under the laws of your jurisdiction.</li>
            </ul>
            <p className="mt-2">You are solely responsible for determining whether your use of the Service is legal in your location, including any rules relating to contests, wagers, or games of skill/chance.</p>
          </Section>

          <Section title="3. No Financial, Legal, or Gambling Advice">
            <p>Nothing on the Service constitutes:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>financial, investment, or trading advice,</li>
              <li>legal or tax advice, or</li>
              <li>a recommendation to engage in any transaction.</li>
            </ul>
            <p className="mt-2">Edison Labs does not operate as a sportsbook, casino, or traditional betting operator. The Service provides experimental tools that allow users to interact with blockchain-based smart contracts they control at their own risk.</p>
          </Section>

          <Section title="4. User Responsibilities">
            <p>You understand and agree that:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>You are solely responsible for all actions taken using your wallet and devices.</li>
              <li>You will not use the Service in any manner that violates applicable law or regulation.</li>
              <li>You will not attempt to circumvent technical or security measures, or interfere with the proper operation of the Service.</li>
            </ul>
          </Section>

          <Section title="5. Blockchain Interactions">
            <p>The Service allows you to interact directly with smart contracts deployed on public blockchain networks. By using the Service, you acknowledge that:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Transactions are generally irreversible.</li>
              <li>Digital assets may be volatile and can lose value.</li>
              <li>Smart contracts may contain bugs or vulnerabilities.</li>
              <li>Network congestion, forks, or other issues may impact your experience.</li>
            </ul>
            <p className="mt-2">Edison Labs does not custody your assets and does not control the underlying blockchain networks.</p>
          </Section>

          <Section title="6. Fees">
            Certain smart contracts may charge protocol fees that are transferred to a designated treasury address. Any applicable fees will be displayed in the interface or encoded in the contract logic. By interacting with these smart contracts, you consent to the deduction and transfer of such fees.
          </Section>

          <Section title="7. Experimental Nature; No Guarantees">
            <p>The Service and its smart contracts are experimental and provided "AS IS" and "AS AVAILABLE" without warranties of any kind, whether express or implied. We do not guarantee:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>error-free operation,</li>
              <li>uninterrupted access,</li>
              <li>security or durability of smart contracts or networks, or</li>
              <li>any particular outcome from your use of the Service.</li>
            </ul>
          </Section>

          <Section title="8. Limitation of Liability">
            <p>To the fullest extent permitted by law, Edison Labs and its members, officers, employees, and contractors shall not be liable for any indirect, incidental, consequential, special, or punitive damages, or any loss of profits, digital assets, data, or goodwill arising out of or related to your use of the Service.</p>
            <p className="mt-2">Where liability cannot be excluded, it is limited to the amount you have directly paid to Edison Labs (if any) in connection with your use of the Service in the twelve (12) months preceding the event giving rise to the claim.</p>
          </Section>

          <Section title="9. Indemnification">
            <p>You agree to indemnify, defend, and hold harmless Edison Labs from and against any claims, liabilities, damages, losses, and expenses, including reasonable attorneys' fees, arising out of or related to:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>your use of the Service,</li>
              <li>your violation of these Terms, or</li>
              <li>your violation of any applicable law or third-party rights.</li>
            </ul>
          </Section>

          <Section title="10. Changes to the Service and Terms">
            We may update the Service or these Terms from time to time. If we make material changes, we will update the "Last updated" date above and may provide additional notice. Your continued use of the Service after any changes become effective constitutes your acceptance of the updated Terms.
          </Section>

          <Section title="11. Third-Party Services">
            The Service may integrate or rely on third-party services (e.g., wallets, RPC providers, oracles, analytics). We do not control and are not responsible for those services. Your use of them is governed by their own terms and policies.
          </Section>

          <Section title="12. Governing Law">
            These Terms are governed by the laws of the State of Illinois, without regard to conflict of law principles. Any dispute arising out of or relating to these Terms or the Service shall be subject to the exclusive jurisdiction of the state or federal courts located in Illinois.
          </Section>

          <Section title="13. Contact">
            If you have questions about these Terms, you may contact us at: <a href="mailto:arrakeensubstack@gmail.com" className="text-[hsl(var(--primary))] underline">arrakeensubstack@gmail.com</a>
          </Section>
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
