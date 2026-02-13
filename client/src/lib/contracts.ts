export const NETWORKS = {
  mainnet: {
    key: 'mainnet',
    chainId: 8453,
    idHex: '0x2105',
    chainName: 'Base Mainnet',
    rpc: 'https://mainnet.base.org',
    explorer: 'https://basescan.org',
    contract: '',
    v2contract: '',
  },
  testnet: {
    key: 'testnet',
    chainId: 84532,
    idHex: '0x14a34',
    chainName: 'Base Sepolia',
    rpc: 'https://sepolia.base.org',
    explorer: 'https://sepolia.basescan.org',
    contract: '0x474b39dF73745CFC9D84A961b2544b4b236757Dc',
    v2contract: '0x474b39dF73745CFC9D84A961b2544b4b236757Dc',
  },
} as const;

export type NetworkKey = keyof typeof NETWORKS;

export const ABI_V1 = [
  'function openChallenge(uint256 stakeWei, uint16 feeBps, uint64 joinWindowSeconds, uint64 resolveWindowSeconds) payable returns (uint256)',
  'function joinChallenge(uint256 challengeId) payable',
  'function submitOutcomeVote(uint256 challengeId, bool challengerWon)',
  'function resolveChallenge(uint256 challengeId)',
  'function issueRefund(uint256 challengeId)',
  'function getChallengeCore(uint256 challengeId) view returns (address challenger, address participant, uint256 stakeWei, uint16 feeBps, uint64 joinDeadline, uint64 resolveDeadline)',
  'function getChallengeStatus(uint256 challengeId) view returns (uint64 createdAt, uint8 state, int8 challengerVote, int8 participantVote)',
  'function nextChallengeId() view returns (uint256)',
  'function protocolFeeBps() view returns (uint16)',
  'function setProtocolFeeBps(uint16 newFeeBps)',
  'function setRefundPenaltyBps(uint16 newPenaltyBps)',
  'function setPaused(bool paused_)',
  'function withdrawProtocolFees(address to)',
  'event ChallengeOpened(uint256 indexed challengeId, address indexed challenger, uint256 stakeWei, uint64 joinDeadline, uint64 resolveDeadline)',
];

export const ABI_V2 = [
  'function protocolFeeBps() view returns (uint16)',
  'function openOffer(bool creatorSideYes, uint16 pBps, uint64 joinWindowSeconds, uint64 resolveWindowSeconds) payable returns (uint256)',
  'function takeOffer(uint256 offerId) payable',
  'function submitOfferVote(uint256 offerId, bool outcomeYes)',
  'function resolveOffer(uint256 offerId)',
  'function refundOffer(uint256 offerId)',
  'function getOfferCore(uint256 offerId) view returns (address creator, address taker, bool creatorSideYes, uint16 pBps, uint256 creatorStakeWei, uint256 takerStakeWei)',
  'function getOfferStatus(uint256 offerId) view returns (uint64 joinDeadline, uint64 resolveDeadline, uint64 createdAt, uint8 state, int8 creatorVote, int8 takerVote, bool paid)',
  'event OfferOpened(uint256 indexed offerId, address indexed creator, bool creatorSideYes, uint16 pBps, uint256 creatorStakeWei, uint256 takerStakeWei, uint64 joinDeadline, uint64 resolveDeadline)',
];

export function computeTakerStake(creatorWei: bigint, creatorSideYes: boolean, pBps: number): bigint {
  const p = BigInt(pBps);
  if (p < 500n || p > 9500n) throw new Error('Odds out of range');
  if (creatorWei <= 0n) throw new Error('Invalid stake');
  const ceilDiv = (n: bigint, d: bigint) => (n + d - 1n) / d;
  if (creatorSideYes) {
    return ceilDiv(creatorWei * p, 10000n - p);
  } else {
    return ceilDiv(creatorWei * (10000n - p), p);
  }
}

export const RANDOM_IDEAS = [
  "BTC hits $150K by end of Q1",
  "ETH flips SOL in daily volume this week",
  "Lakers win the NBA Finals",
  "Taylor Swift announces retirement",
  "Trump tweets about crypto today",
  "Apple stock closes above $250 Friday",
  "It rains in Miami tomorrow",
  "Elon posts on X before midnight",
  "Gold hits a new all-time high this month",
  "FIFA announces new World Cup host",
  "Next iPhone has no port",
  "Fed cuts rates at next meeting",
  "Dogecoin hits $1 this year",
  "Base TVL exceeds $10B",
  "OpenAI releases GPT-5",
];
