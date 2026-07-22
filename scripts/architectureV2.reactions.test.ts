// Video Center — Architecture V2 reactions tests
// Schema: qvc-v2

import {
  buildReactionEnvelope,
  reduceReactionRecords,
  resolveReactionDisplay,
  isReactionEnvelope as isV2ReactionEnvelope,
} from '../src/services/architectureV2/reactions.js';
import type { IdentityValidator } from '../src/services/architectureV2/validation.js';
import type { ReactionRecord } from '../src/services/architectureV2/reactions.js';

const assert = {
  equal: (a: unknown, b: unknown) => {
    if (a !== b) throw new Error(`expected ${String(b)}, got ${String(a)}`);
  },
  ok: (cond: boolean, msg: string) => {
    if (!cond) throw new Error(msg);
  },
};

const wallets: Record<string, string> = { alice: 'A', bob: 'B' };
const identity: IdentityValidator = {
  validatePublisher: (metadata, claimed) =>
    metadata.publisherName === claimed
      ? { ok: true }
      : { ok: false, code: 'UNAUTHORIZED_PUBLISHER', detail: 'publisher mismatch' },
  validateWalletBinding: (name, wallet) =>
    wallets[name] === wallet
      ? { ok: true }
      : { ok: false, code: 'WALLET_BINDING_MISMATCH', detail: 'wallet mismatch' },
};

const reaction = (
  publisherName: string,
  walletAddress: string,
  state: 'active' | 'inactive',
  updated: number | null,
  signature: string,
  targetId = 'qvc-v2-video-abc12345',
  targetType: 'video' | 'comment' = 'video',
): ReactionRecord => {
  const identifier = `qvc-v2-react-${targetId.replace('qvc-v2-', '')}-${publisherName}`;
  return {
    metadata: {
      service: 'DOCUMENT',
      publisherName,
      identifier,
      created: 1,
      updated,
      latestSignature: signature,
    },
    envelope: buildReactionEnvelope(targetId, targetType, publisherName, walletAddress, state),
  };
};

// ── 1. Single reaction ────────────────────────────────────
const aliceLike = reaction('alice', 'A', 'active', 2, 'a');
const singleState = reduceReactionRecords([aliceLike], identity);
assert.equal(singleState.count, 1);
assert.ok('alice' in singleState.actors, 'alice actor present');
console.log('  ✓ single reaction: count = 1');

// ── 2. Unlike removes reaction ────────────────────────────
const aliceUnlike = reaction('alice', 'A', 'inactive', 3, 'b');
const unlikeState = reduceReactionRecords([aliceLike, aliceUnlike], identity);
assert.equal(unlikeState.count, 0);
assert.ok(!('alice' in unlikeState.actors), 'alice removed after unlike');
console.log('  ✓ unlike removes reaction: count = 0');

// ── 3. Two actors ─────────────────────────────────────────
const bobLike = reaction('bob', 'B', 'active', 2, 'c');
const twoState = reduceReactionRecords([aliceLike, bobLike], identity);
assert.equal(twoState.count, 2);
assert.ok('alice' in twoState.actors && 'bob' in twoState.actors, 'both actors present');
console.log('  ✓ two actors: count = 2');

// ── 4. Display resolution ─────────────────────────────────
const display = resolveReactionDisplay(twoState, 'alice');
assert.equal(display.count, 2);
assert.equal(display.hasReacted, true);

const displayBob = resolveReactionDisplay(twoState, 'bob');
assert.equal(displayBob.hasReacted, true);

const displayOther = resolveReactionDisplay(twoState, 'charlie');
assert.equal(displayOther.hasReacted, false);
console.log('  ✓ display resolution: correct reacted status');

// ── 5. Reaction envelope validation ───────────────────────
const envelope = buildReactionEnvelope('qvc-v2-video-abc12345', 'video', 'alice', 'A');
assert.ok(isV2ReactionEnvelope(envelope), 'valid reaction envelope detected');
assert.equal(envelope.schema, 'qvc-v2');
assert.equal(envelope.recordType, 'reaction');
assert.equal(envelope.kind, 'operation');
assert.equal(envelope.body.reaction, 'like');
assert.equal(envelope.body.state, 'active');
console.log('  ✓ envelope validation: valid envelope passes checks');

// ── 6. Comment reactions ──────────────────────────────────
const commentReaction = reaction('alice', 'A', 'active', 2, 'd', 'qvc-v2-comment-xyz', 'comment');
const commentState = reduceReactionRecords([commentReaction], identity);
assert.equal(commentState.count, 1);
assert.equal(commentReaction.envelope.body.targetType, 'comment');
console.log('  ✓ comment reactions: supported');

// ── 7. Wallet mismatch detected ───────────────────────────
const badReaction = reaction('alice', 'WRONG_WALLET', 'active', 2, 'e');
const badState = reduceReactionRecords([badReaction], identity);
assert.ok(badState.diagnostics.length > 0, 'wallet mismatch diagnosed');
console.log('  ✓ wallet mismatch: quarantined');

// ── 8. Deterministic ordering ─────────────────────────────
const forwardState = reduceReactionRecords([aliceLike, bobLike], identity);
const reverseState = reduceReactionRecords([bobLike, aliceLike], identity);
assert.equal(forwardState.count, reverseState.count);
assert.equal(JSON.stringify(forwardState.actors), JSON.stringify(reverseState.actors));
console.log('  ✓ deterministic ordering: same result regardless of input order');

// ── 9. Toggle reaction (like → unlike → like) ─────────────
const reLike = reaction('alice', 'A', 'active', 4, 'f');
const toggleState = reduceReactionRecords([aliceLike, aliceUnlike, reLike], identity);
assert.equal(toggleState.count, 1);
console.log('  ✓ toggle: like → unlike → like = active');

console.log('\n✅ Architecture V2 reactions tests PASSED\n');
