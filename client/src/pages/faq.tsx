import { Card } from '@/components/ui/card';
import { Link } from 'wouter';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

const faqs = [
  {
    q: "What is The Juice?",
    a: "The Juice is an experimental, on-chain challenge and market offer tool built by Edison Labs LLC. It lets two participants lock funds into a smart contract and then submit outcomes to release or refund funds based on the result."
  },
  {
    q: "Is this a sportsbook or casino?",
    a: "No. The Juice does not set odds, take positions against users, or act as a traditional sportsbook or casino. It is a peer-to-peer smart contract coordination and outcome-voting tool. You are responsible for how and where you use it, and for complying with your local laws."
  },
  {
    q: "What are Market Offers?",
    a: "Market Offers allow a participant to create a binary (YES/NO) outcome agreement using a user-defined implied probability. The creator selects a side and stake amount, and the opposing stake is calculated by the smart contract. Another participant may accept the offer by taking the opposite side."
  },
  {
    q: "Does The Juice set odds or act as the counterparty?",
    a: "No. All implied probabilities and stake amounts are defined by users. Edison Labs does not set odds, take positions, or participate in outcome agreements."
  },
  {
    q: "How do Market Offers resolve?",
    a: "Market Offers resolve according to the smart contract logic. In general: participants submit outcome votes; if required voting conditions are met, the contract distributes funds automatically; if conditions are not met, refunds or other outcomes may follow the contract rules. Deadlines may apply. Always review the contract mechanics before interacting."
  },
  {
    q: "Are payout projections guaranteed?",
    a: "No. The interface displays estimated payout amounts based on contract logic and your inputs. Final outcomes depend entirely on on-chain execution and smart contract rules."
  },
  {
    q: "Can a Market Offer expire or remain unfilled?",
    a: "Yes. If no counterparty accepts the offer before the join deadline, it may expire according to contract logic."
  },
  {
    q: "What network does it run on?",
    a: "The current version of The Juice runs on the Base network and uses self-custodial wallets like MetaMask to sign transactions."
  },
  {
    q: "Who controls my funds?",
    a: "You do. The Juice is non-custodial. Funds are held in smart contracts you interact with directly from your wallet. Edison Labs LLC does not have access to your private keys."
  },
  {
    q: "Are there protocol fees?",
    a: "Yes. Some interactions may charge a protocol fee that is sent to a designated treasury address. The fee logic is encoded in the smart contract and may be displayed in the interface. Always review transaction details before approving."
  },
  {
    q: "What happens if there's a bug or exploit?",
    a: "Because The Juice is experimental software deployed on a public blockchain, bugs or vulnerabilities can cause permanent loss of funds. There is no guarantee of recovery. Only use funds you can afford to lose."
  },
  {
    q: "Is using The Juice legal in my country/state?",
    a: "We cannot provide legal advice. Laws around digital assets, contests, and wagering vary widely by jurisdiction. You are solely responsible for understanding and complying with the laws that apply to you."
  },
  {
    q: "Do you store my personal information?",
    a: "We aim to collect as little information as possible. We may see wallet addresses and on-chain activity, plus basic web analytics. See our Privacy Policy for details."
  },
  {
    q: "Who is behind Edison Labs?",
    a: "Edison Labs LLC is a small software development and innovation studio focused on blockchain-based applications, digital asset operations, and experimental technology projects."
  },
  {
    q: "How do challenges get resolved?",
    a: "A challenge resolves when both players submit their vote. If both votes match, the contract automatically pays the winner. If both vote differently, full refunds are available after the deadline. If only one votes, the challenge cannot finish."
  },
  {
    q: "Can I change my vote after submitting it?",
    a: "No. Votes are permanent once submitted, and cannot be edited or undone. This prevents cheating or manipulation. Make sure to vote carefully."
  },
  {
    q: "Can stuck funds be fixed?",
    a: "Not in this version. Once a challenge becomes stuck due to missing votes, no payout or refund path exists. The on-chain rules prevent the contract from sending funds back. This is why it's important to challenge reliable players."
  },
];

export default function FAQ() {
  return (
    <div className="space-y-4 max-w-xl mx-auto" data-testid="faq-page">
      <div className="mb-4">
        <Link href="/">
          <Button variant="ghost" size="sm" data-testid="button-back">
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Back
          </Button>
        </Link>
      </div>
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">FAQ</h1>
        <p className="text-sm text-muted-foreground mt-1">Frequently asked questions about The Juice</p>
      </div>

      <div className="space-y-3">
        {faqs.map((faq, i) => (
          <Card key={i} className="p-4" data-testid={`faq-item-${i}`}>
            <h3 className="text-sm font-semibold mb-2 text-foreground">{faq.q}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{faq.a}</p>
          </Card>
        ))}
      </div>

      <Card className="p-4 mt-4">
        <div className="space-y-2 text-xs text-muted-foreground">
          <p className="font-semibold text-foreground text-sm">Key Rules to Remember</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Both players must vote</li>
            <li>Votes cannot be changed</li>
            <li>No vote = no payout or refund</li>
            <li>Only matching votes trigger payout</li>
            <li>Only mismatched votes (both players voted) trigger refunds</li>
            <li>Funds cannot be recovered if someone refuses to vote</li>
          </ul>
        </div>
      </Card>
    </div>
  );
}
