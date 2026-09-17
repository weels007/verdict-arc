import { Uint128 } from './types.js';

function zero128(): Uint128 {
  return '0';
}

export interface StablecoinAdapter {
  release: (to: string, amount: Uint128) => void;
  refund: (to: string, amount: Uint128) => void;
}

export function reduce(a: Uint128, b: Uint128): Uint128 {
  const numA = BigInt(a);
  const numB = BigInt(b);
  if (numA < numB) {
    throw new Error('escrow underflow');
  }
  return String(numA - numB);
}

export function hold(
  adapter: StablecoinAdapter,
  recipient: string,
  amount: Uint128
): boolean {
  adapter.release(recipient, amount);
  return true;
}

export function releaseFunds(
  adapter: StablecoinAdapter,
  to: string,
  amount: Uint128
): boolean {
  if (amount === zero128()) {
    return true;
  }
  adapter.release(to, amount);
  return true;
}

export function refundFunds(
  adapter: StablecoinAdapter,
  to: string,
  amount: Uint128
): boolean {
  if (amount === zero128()) {
    return true;
  }
  adapter.refund(to, amount);
  return true;
}

export function applyPenaltyShare(
  adapter: StablecoinAdapter,
  provider: string,
  consumer: string,
  providerShare: Uint128,
  consumerShare: Uint128
): boolean {
  if (providerShare !== zero128()) {
    adapter.release(provider, providerShare);
  }
  if (consumerShare !== zero128()) {
    adapter.refund(consumer, consumerShare);
  }
  return true;
}
