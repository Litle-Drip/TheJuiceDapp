import { ethers } from 'ethers';

export interface ChallengeData {
  type: 'challenge';
  challenger: string;
  participant: string;
  stakeWei: bigint;
  feeBps: number;
  joinDeadline: number;
  resolveDeadline: number;
  createdAt: number;
  state: number;
  challengerVote: number;
  participantVote: number;
}

export interface OfferData {
  type: 'offer';
  creator: string;
  taker: string;
  creatorSideYes: boolean;
  pBps: number;
  creatorStake: bigint;
  takerStake: bigint;
  joinDeadline: number;
  resolveDeadline: number;
  createdAt: number;
  state: number;
  creatorVote: number;
  takerVote: number;
  paid: boolean;
}

export type BetData = ChallengeData | OfferData;

export interface ViewProps {
  betId: string;
  now: number;
  address: string;
  connected: boolean;
  actionLoading: string;
  doAction: (action: string, fn: (s: ethers.Signer) => Promise<any>) => void;
  networkKey: string;
  payoutTxHash: string;
  explorerUrl: string;
  ethUsd: number;
  marketQuestion: string;
}
