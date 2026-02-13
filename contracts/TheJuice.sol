// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract TheJuice is Ownable, ReentrancyGuard {

    // ─── Protocol Settings ───────────────────────────────────────────

    uint16 public protocolFeeBps = 250;       // 2.5% default
    uint16 public refundPenaltyBps = 0;       // optional penalty on refund
    bool   public paused;
    uint256 public accumulatedFees;

    // ─── V1: Symmetric Challenges ────────────────────────────────────

    enum ChallengeState { Open, Active, Resolved, Refunded }

    struct Challenge {
        address challenger;
        address participant;
        uint256 stakeWei;
        uint16  feeBps;
        uint64  joinDeadline;
        uint64  resolveDeadline;
        uint64  createdAt;
        ChallengeState state;
        int8    challengerVote;   // 0 = pending, 1 = challenger won, -1 = participant won
        int8    participantVote;
    }

    uint256 public nextChallengeId = 1;
    mapping(uint256 => Challenge) private challenges;

    // ─── V2: Asymmetric Market Offers ────────────────────────────────

    enum OfferState { Open, Filled, Resolved, Refunded }

    struct Offer {
        address creator;
        address taker;
        bool    creatorSideYes;
        uint16  pBps;              // implied YES probability in basis points (500–9500)
        uint256 creatorStakeWei;
        uint256 takerStakeWei;
        uint64  joinDeadline;
        uint64  resolveDeadline;
        uint64  createdAt;
        OfferState state;
        int8    creatorVote;       // 0 = pending, 1 = YES, -1 = NO
        int8    takerVote;
        bool    paid;
    }

    uint256 public nextOfferId = 1;
    mapping(uint256 => Offer) private offers;

    // ─── Events ──────────────────────────────────────────────────────

    event ChallengeOpened(uint256 indexed challengeId, address indexed challenger, uint256 stakeWei, uint64 joinDeadline, uint64 resolveDeadline);
    event ChallengeJoined(uint256 indexed challengeId, address indexed participant);
    event ChallengeVoted(uint256 indexed challengeId, address indexed voter, bool challengerWon);
    event ChallengeResolved(uint256 indexed challengeId, address indexed winner, uint256 payout);
    event ChallengeRefunded(uint256 indexed challengeId);

    event OfferOpened(uint256 indexed offerId, address indexed creator, bool creatorSideYes, uint16 pBps, uint256 creatorStakeWei, uint256 takerStakeWei, uint64 joinDeadline, uint64 resolveDeadline);
    event OfferTaken(uint256 indexed offerId, address indexed taker);
    event OfferVoted(uint256 indexed offerId, address indexed voter, bool outcomeYes);
    event OfferResolved(uint256 indexed offerId, address indexed winner, uint256 payout);
    event OfferRefunded(uint256 indexed offerId);

    // ─── Modifiers ───────────────────────────────────────────────────

    modifier whenNotPaused() {
        require(!paused, "Contract is paused");
        _;
    }

    // ─── Constructor ─────────────────────────────────────────────────

    constructor() Ownable(msg.sender) {}

    // ═════════════════════════════════════════════════════════════════
    //  V1: SYMMETRIC CHALLENGES
    // ═════════════════════════════════════════════════════════════════

    function openChallenge(
        uint256 stakeWei,
        uint16  feeBps_,
        uint64  joinWindowSeconds,
        uint64  resolveWindowSeconds
    ) external payable whenNotPaused nonReentrant returns (uint256) {
        require(msg.value == stakeWei && stakeWei > 0, "Stake mismatch");
        require(joinWindowSeconds >= 60, "Join window too short");
        require(resolveWindowSeconds > joinWindowSeconds, "Resolve must exceed join");

        uint256 id = nextChallengeId++;
        uint64 now64 = uint64(block.timestamp);

        challenges[id] = Challenge({
            challenger:       msg.sender,
            participant:      address(0),
            stakeWei:         stakeWei,
            feeBps:           feeBps_ > 0 ? feeBps_ : protocolFeeBps,
            joinDeadline:     now64 + joinWindowSeconds,
            resolveDeadline:  now64 + resolveWindowSeconds,
            createdAt:        now64,
            state:            ChallengeState.Open,
            challengerVote:   0,
            participantVote:  0
        });

        emit ChallengeOpened(id, msg.sender, stakeWei, now64 + joinWindowSeconds, now64 + resolveWindowSeconds);
        return id;
    }

    function joinChallenge(uint256 challengeId) external payable whenNotPaused nonReentrant {
        Challenge storage c = challenges[challengeId];
        require(c.challenger != address(0), "Challenge not found");
        require(c.state == ChallengeState.Open, "Not open");
        require(block.timestamp <= c.joinDeadline, "Join window expired");
        require(msg.sender != c.challenger, "Cannot join own challenge");
        require(msg.value == c.stakeWei, "Wrong stake amount");

        c.participant = msg.sender;
        c.state = ChallengeState.Active;

        emit ChallengeJoined(challengeId, msg.sender);
    }

    function submitOutcomeVote(uint256 challengeId, bool challengerWon) external whenNotPaused {
        Challenge storage c = challenges[challengeId];
        require(c.state == ChallengeState.Active, "Not active");
        require(block.timestamp <= c.resolveDeadline, "Resolve window expired");

        int8 vote = challengerWon ? int8(1) : int8(-1);

        if (msg.sender == c.challenger) {
            require(c.challengerVote == 0, "Already voted");
            c.challengerVote = vote;
        } else if (msg.sender == c.participant) {
            require(c.participantVote == 0, "Already voted");
            c.participantVote = vote;
        } else {
            revert("Not a participant");
        }

        emit ChallengeVoted(challengeId, msg.sender, challengerWon);
    }

    function resolveChallenge(uint256 challengeId) external nonReentrant {
        Challenge storage c = challenges[challengeId];
        require(c.state == ChallengeState.Active, "Not active");
        require(c.challengerVote != 0 && c.participantVote != 0, "Votes incomplete");
        require(c.challengerVote == c.participantVote, "Votes disagree");

        c.state = ChallengeState.Resolved;

        uint256 pot = c.stakeWei * 2;
        uint256 fee = (pot * c.feeBps) / 10000;
        uint256 payout = pot - fee;
        accumulatedFees += fee;

        address winner = c.challengerVote == 1 ? c.challenger : c.participant;

        (bool ok, ) = winner.call{value: payout}("");
        require(ok, "Transfer failed");

        emit ChallengeResolved(challengeId, winner, payout);
    }

    function issueRefund(uint256 challengeId) external nonReentrant {
        Challenge storage c = challenges[challengeId];
        require(c.challenger != address(0), "Not found");

        if (c.state == ChallengeState.Open) {
            require(block.timestamp > c.joinDeadline, "Join window still open");
            c.state = ChallengeState.Refunded;

            uint256 refund = c.stakeWei;
            if (refundPenaltyBps > 0) {
                uint256 penalty = (refund * refundPenaltyBps) / 10000;
                accumulatedFees += penalty;
                refund -= penalty;
            }

            (bool ok, ) = c.challenger.call{value: refund}("");
            require(ok, "Transfer failed");
        } else if (c.state == ChallengeState.Active) {
            require(
                block.timestamp > c.resolveDeadline ||
                (c.challengerVote != 0 && c.participantVote != 0 && c.challengerVote != c.participantVote),
                "Cannot refund yet"
            );
            c.state = ChallengeState.Refunded;

            uint256 each = c.stakeWei;
            if (refundPenaltyBps > 0) {
                uint256 penalty = (each * refundPenaltyBps) / 10000;
                accumulatedFees += penalty * 2;
                each -= penalty;
            }

            (bool ok1, ) = c.challenger.call{value: each}("");
            require(ok1, "Transfer failed");
            (bool ok2, ) = c.participant.call{value: each}("");
            require(ok2, "Transfer failed");
        } else {
            revert("Already resolved or refunded");
        }

        emit ChallengeRefunded(challengeId);
    }

    function getChallengeCore(uint256 challengeId) external view returns (
        address challenger,
        address participant,
        uint256 stakeWei,
        uint16  feeBps_,
        uint64  joinDeadline,
        uint64  resolveDeadline
    ) {
        Challenge storage c = challenges[challengeId];
        return (c.challenger, c.participant, c.stakeWei, c.feeBps, c.joinDeadline, c.resolveDeadline);
    }

    function getChallengeStatus(uint256 challengeId) external view returns (
        uint64  createdAt,
        uint8   state,
        int8    challengerVote,
        int8    participantVote
    ) {
        Challenge storage c = challenges[challengeId];
        return (c.createdAt, uint8(c.state), c.challengerVote, c.participantVote);
    }

    function getChallenge(uint256 challengeId) external view returns (
        address challenger,
        address participant,
        uint256 stakeWei,
        uint16  feeBps_,
        uint64  joinDeadline,
        uint64  resolveDeadline,
        uint64  createdAt,
        uint8   state,
        int8    challengerVote,
        int8    participantVote
    ) {
        Challenge storage c = challenges[challengeId];
        challenger = c.challenger;
        participant = c.participant;
        stakeWei = c.stakeWei;
        feeBps_ = c.feeBps;
        joinDeadline = c.joinDeadline;
        resolveDeadline = c.resolveDeadline;
        createdAt = c.createdAt;
        state = uint8(c.state);
        challengerVote = c.challengerVote;
        participantVote = c.participantVote;
    }

    // ═════════════════════════════════════════════════════════════════
    //  V2: ASYMMETRIC MARKET OFFERS
    // ═════════════════════════════════════════════════════════════════

    function _computeTakerStake(uint256 creatorWei, bool creatorSideYes, uint16 pBps) internal pure returns (uint256) {
        require(pBps >= 500 && pBps <= 9500, "Odds out of range");
        require(creatorWei > 0, "Zero stake");

        if (creatorSideYes) {
            // Creator is YES side: takerStake = creatorStake * p / (1 - p)
            return _ceilDiv(creatorWei * uint256(pBps), uint256(10000 - pBps));
        } else {
            // Creator is NO side: takerStake = creatorStake * (1 - p) / p
            return _ceilDiv(creatorWei * uint256(10000 - pBps), uint256(pBps));
        }
    }

    function _ceilDiv(uint256 a, uint256 b) internal pure returns (uint256) {
        return (a + b - 1) / b;
    }

    function openOffer(
        bool   creatorSideYes,
        uint16 pBps,
        uint64 joinWindowSeconds,
        uint64 resolveWindowSeconds
    ) external payable whenNotPaused nonReentrant returns (uint256) {
        require(msg.value > 0, "No stake");
        require(pBps >= 500 && pBps <= 9500, "Odds out of range");
        require(joinWindowSeconds >= 60, "Join window too short");
        require(resolveWindowSeconds > joinWindowSeconds, "Resolve must exceed join");

        uint256 takerStake = _computeTakerStake(msg.value, creatorSideYes, pBps);
        uint256 id = nextOfferId++;
        uint64 now64 = uint64(block.timestamp);

        offers[id] = Offer({
            creator:         msg.sender,
            taker:           address(0),
            creatorSideYes:  creatorSideYes,
            pBps:            pBps,
            creatorStakeWei: msg.value,
            takerStakeWei:   takerStake,
            joinDeadline:    now64 + joinWindowSeconds,
            resolveDeadline: now64 + resolveWindowSeconds,
            createdAt:       now64,
            state:           OfferState.Open,
            creatorVote:     0,
            takerVote:       0,
            paid:            false
        });

        emit OfferOpened(id, msg.sender, creatorSideYes, pBps, msg.value, takerStake, now64 + joinWindowSeconds, now64 + resolveWindowSeconds);
        return id;
    }

    function takeOffer(uint256 offerId) external payable whenNotPaused nonReentrant {
        Offer storage o = offers[offerId];
        require(o.creator != address(0), "Offer not found");
        require(o.state == OfferState.Open, "Not open");
        require(block.timestamp <= o.joinDeadline, "Join window expired");
        require(msg.sender != o.creator, "Cannot take own offer");
        require(msg.value == o.takerStakeWei, "Wrong taker stake");

        o.taker = msg.sender;
        o.state = OfferState.Filled;

        emit OfferTaken(offerId, msg.sender);
    }

    function submitOfferVote(uint256 offerId, bool outcomeYes) external whenNotPaused {
        Offer storage o = offers[offerId];
        require(o.state == OfferState.Filled, "Not filled");
        require(block.timestamp <= o.resolveDeadline, "Resolve window expired");

        int8 vote = outcomeYes ? int8(1) : int8(-1);

        if (msg.sender == o.creator) {
            require(o.creatorVote == 0, "Already voted");
            o.creatorVote = vote;
        } else if (msg.sender == o.taker) {
            require(o.takerVote == 0, "Already voted");
            o.takerVote = vote;
        } else {
            revert("Not a participant");
        }

        emit OfferVoted(offerId, msg.sender, outcomeYes);
    }

    function resolveOffer(uint256 offerId) external nonReentrant {
        Offer storage o = offers[offerId];
        require(o.state == OfferState.Filled, "Not filled");
        require(o.creatorVote != 0 && o.takerVote != 0, "Votes incomplete");
        require(o.creatorVote == o.takerVote, "Votes disagree");
        require(!o.paid, "Already paid");

        o.state = OfferState.Resolved;
        o.paid = true;

        uint256 pot = o.creatorStakeWei + o.takerStakeWei;
        uint256 fee = (pot * protocolFeeBps) / 10000;
        uint256 payout = pot - fee;
        accumulatedFees += fee;

        // Determine winner: if outcome is YES (vote == 1), YES-side wins
        bool outcomeYes = o.creatorVote == 1;
        address winner;
        if (outcomeYes) {
            winner = o.creatorSideYes ? o.creator : o.taker;
        } else {
            winner = o.creatorSideYes ? o.taker : o.creator;
        }

        (bool ok, ) = winner.call{value: payout}("");
        require(ok, "Transfer failed");

        emit OfferResolved(offerId, winner, payout);
    }

    function refundOffer(uint256 offerId) external nonReentrant {
        Offer storage o = offers[offerId];
        require(o.creator != address(0), "Not found");
        require(!o.paid, "Already paid");

        if (o.state == OfferState.Open) {
            require(block.timestamp > o.joinDeadline, "Join window still open");
            o.state = OfferState.Refunded;
            o.paid = true;

            (bool ok, ) = o.creator.call{value: o.creatorStakeWei}("");
            require(ok, "Transfer failed");
        } else if (o.state == OfferState.Filled) {
            require(
                block.timestamp > o.resolveDeadline ||
                (o.creatorVote != 0 && o.takerVote != 0 && o.creatorVote != o.takerVote),
                "Cannot refund yet"
            );
            o.state = OfferState.Refunded;
            o.paid = true;

            (bool ok1, ) = o.creator.call{value: o.creatorStakeWei}("");
            require(ok1, "Transfer failed");
            (bool ok2, ) = o.taker.call{value: o.takerStakeWei}("");
            require(ok2, "Transfer failed");
        } else {
            revert("Already resolved or refunded");
        }

        emit OfferRefunded(offerId);
    }

    function getOfferCore(uint256 offerId) external view returns (
        address creator,
        address taker,
        bool    creatorSideYes,
        uint16  pBps,
        uint256 creatorStakeWei,
        uint256 takerStakeWei
    ) {
        Offer storage o = offers[offerId];
        return (o.creator, o.taker, o.creatorSideYes, o.pBps, o.creatorStakeWei, o.takerStakeWei);
    }

    function getOfferStatus(uint256 offerId) external view returns (
        uint64  joinDeadline,
        uint64  resolveDeadline,
        uint64  createdAt,
        uint8   state,
        int8    creatorVote,
        int8    takerVote,
        bool    paid
    ) {
        Offer storage o = offers[offerId];
        return (o.joinDeadline, o.resolveDeadline, o.createdAt, uint8(o.state), o.creatorVote, o.takerVote, o.paid);
    }

    function getOffer(uint256 offerId) external view returns (
        address creator,
        address taker,
        bool    creatorSideYes,
        uint16  pBps,
        uint256 creatorStakeWei,
        uint256 takerStakeWei,
        uint64  joinDeadline,
        uint64  resolveDeadline,
        uint64  createdAt,
        uint8   state,
        int8    creatorVote,
        int8    takerVote,
        bool    paid
    ) {
        Offer storage o = offers[offerId];
        creator = o.creator;
        taker = o.taker;
        creatorSideYes = o.creatorSideYes;
        pBps = o.pBps;
        creatorStakeWei = o.creatorStakeWei;
        takerStakeWei = o.takerStakeWei;
        joinDeadline = o.joinDeadline;
        resolveDeadline = o.resolveDeadline;
        createdAt = o.createdAt;
        state = uint8(o.state);
        creatorVote = o.creatorVote;
        takerVote = o.takerVote;
        paid = o.paid;
    }

    // ═════════════════════════════════════════════════════════════════
    //  ADMIN FUNCTIONS
    // ═════════════════════════════════════════════════════════════════

    function setProtocolFeeBps(uint16 newFeeBps) external onlyOwner {
        require(newFeeBps <= 1000, "Fee too high");  // max 10%
        protocolFeeBps = newFeeBps;
    }

    function setRefundPenaltyBps(uint16 newPenaltyBps) external onlyOwner {
        require(newPenaltyBps <= 500, "Penalty too high");  // max 5%
        refundPenaltyBps = newPenaltyBps;
    }

    function setPaused(bool paused_) external onlyOwner {
        paused = paused_;
    }

    function withdrawProtocolFees(address to) external onlyOwner nonReentrant {
        require(to != address(0), "Zero address");
        uint256 amount = accumulatedFees;
        require(amount > 0, "No fees");
        accumulatedFees = 0;

        (bool ok, ) = to.call{value: amount}("");
        require(ok, "Transfer failed");
    }

    receive() external payable {}
}
