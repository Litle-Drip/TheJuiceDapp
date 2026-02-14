import { Card } from '@/components/ui/card';
import { Link } from 'wouter';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Privacy() {
  return (
    <div className="space-y-4 max-w-xl mx-auto" data-testid="privacy-page">
      <div className="mb-4">
        <Link href="/">
          <Button variant="ghost" size="sm" data-testid="button-back">
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Back
          </Button>
        </Link>
      </div>
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Privacy Policy</h1>
        <p className="text-xs text-muted-foreground mt-1">Last updated: 12/4/2025</p>
      </div>
      <Card className="p-6">
        <div className="space-y-5 text-sm leading-relaxed text-muted-foreground">
          <p>This Privacy Policy explains how Edison Labs LLC ("Edison Labs", "we", "us") collects, uses, and protects information in connection with thejuiceapp.io and related services (the "Service").</p>

          <Section title="1. Information We Collect">
            <p className="mb-2">We aim to collect as little personal information as reasonably possible.</p>
            <p className="font-medium text-foreground/80 mt-3 mb-1">a) Information you provide directly</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Contact information if you email us or fill out a form (e.g., name, email, message content).</li>
            </ul>
            <p className="font-medium text-foreground/80 mt-3 mb-1">b) Information collected automatically</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Standard web logs (IP address, browser type, pages viewed, timestamps).</li>
              <li>Device and usage information (e.g., referring URLs, approximate location based on IP).</li>
              <li>If enabled, aggregated analytics data from third-party tools (e.g., page views, session duration).</li>
            </ul>
            <p className="font-medium text-foreground/80 mt-3 mb-1">c) Blockchain and wallet data</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>We may see your public wallet address and transaction details on-chain.</li>
              <li>We do not control or store your private keys.</li>
            </ul>
          </Section>

          <Section title="2. How We Use Information">
            <p>We use collected information to:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>operate, maintain, and improve the Service,</li>
              <li>understand usage patterns and performance,</li>
              <li>communicate with you if you contact us,</li>
              <li>detect, prevent, or investigate potential abuse or security issues,</li>
              <li>comply with legal obligations when required.</li>
            </ul>
            <p className="mt-2 font-medium text-foreground">We do not sell your personal data.</p>
          </Section>

          <Section title="3. Cookies and Similar Technologies">
            <p>We may use cookies or similar technologies to remember basic preferences, perform analytics, or improve the user experience. You can usually control cookies through your browser settings.</p>
          </Section>

          <Section title="4. Third-Party Services">
            We may use third-party providers for analytics, error tracking, and infrastructure (e.g., hosting, RPC providers). These providers may collect information in accordance with their own privacy policies.
          </Section>

          <Section title="5. Data Security">
            <p>We take reasonable measures to protect information we control. However:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>no system is perfectly secure,</li>
              <li>blockchain transactions are public and irrevocable,</li>
              <li>transmission of data over the internet carries inherent risks.</li>
            </ul>
          </Section>

          <Section title="6. Your Choices">
            <p>You may:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>choose not to provide certain information (though this may limit some features),</li>
              <li>configure cookie or tracking preferences in your browser,</li>
              <li>disconnect your wallet at any time.</li>
            </ul>
          </Section>

          <Section title="7. Children's Privacy">
            The Service is not directed to individuals under 18. We do not knowingly collect personal data from children.
          </Section>

          <Section title="8. Changes to This Policy">
            We may update this Privacy Policy from time to time. If we make material changes, we will update the "Last updated" date and may provide additional notice.
          </Section>

          <Section title="9. Contact">
            For privacy-related questions, you can reach us at: <a href="mailto:arrakeensubstack@gmail.com" className="text-[hsl(var(--primary))] underline">arrakeensubstack@gmail.com</a>
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
