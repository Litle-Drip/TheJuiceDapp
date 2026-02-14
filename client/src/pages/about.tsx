import { Card } from '@/components/ui/card';
import { Link } from 'wouter';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function About() {
  return (
    <div className="space-y-4 max-w-xl mx-auto" data-testid="about-page">
      <div className="mb-4">
        <Link href="/">
          <Button variant="ghost" size="sm" data-testid="button-back">
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Back
          </Button>
        </Link>
      </div>
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">About Edison Labs</h1>
      </div>
      <Card className="p-6">
        <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
          <p>
            Edison Labs LLC develops software and digital tools, including blockchain-based applications, digital asset operations, and experimental technology projects. The studio focuses on building secure, user-friendly interfaces that make on-chain experiences more approachable, transparent, and fun.
          </p>
          <p>
            <span className="text-foreground font-medium">The Juice</span> is one of our flagship experiments: a simple, non-custodial challenge and escrow tool that lets participants lock funds into a smart contract and submit outcomes on-chain. Our goal is to explore how peer-to-peer coordination, transparent rules, and smart contracts can be used to create new types of digital experiences.
          </p>
          <p>
            Edison Labs operates as a lean, experiment-first software studio. We iterate in public, ship small, and treat everything we build as a live, evolving prototype. Nothing we ship is financial, legal, or gambling advice — it's software for people who want to explore what's possible with digital assets and modern blockchain networks.
          </p>
        </div>
      </Card>
    </div>
  );
}
