// EIP-1193 wallet connection (MetaMask, Rabby, and any compatible injected
// wallet). No private keys touch the app: every transaction is signed by the
// user in their own wallet through the provider's request() surface.

import type { Eip1193Provider } from "../../src/real/adapter.js";

declare global {
  interface Window {
    ethereum?: Eip1193Provider & { isMetaMask?: boolean; isRabby?: boolean };
  }
}

export interface WalletInfo {
  provider: Eip1193Provider;
  address: string;
  walletName: string;
}

export function detectWallets(): { name: string; provider: Eip1193Provider }[] {
  const eth = window.ethereum;
  const found: { name: string; provider: Eip1193Provider }[] = [];

  if (!eth) return found;

  // Some wallets expose multiple providers under providers array (MetaMask
  // >=8, Rabby, etc). Prefer explicit providers when available.
  const multi = (eth as unknown as { providers?: (Eip1193Provider & { isMetaMask?: boolean; isRabby?: boolean })[] }).providers;
  if (Array.isArray(multi) && multi.length > 0) {
    for (const p of multi) {
      if (p.isRabby) found.push({ name: "Rabby", provider: p });
      else if (p.isMetaMask) found.push({ name: "MetaMask", provider: p });
      else found.push({ name: "Injected Wallet", provider: p });
    }
    return found;
  }

  if (eth.isRabby) found.push({ name: "Rabby", provider: eth });
  else if (eth.isMetaMask) found.push({ name: "MetaMask", provider: eth });
  else found.push({ name: "Injected Wallet", provider: eth });

  return found;
}

export function hasWallet(): boolean {
  return detectWallets().length > 0;
}

function isValidAddress(value: string): boolean {
  return typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value);
}

export async function connectWallet(provider: Eip1193Provider): Promise<WalletInfo> {
  const accounts = (await provider.request({
    method: "eth_requestAccounts",
  })) as string[];

  if (!Array.isArray(accounts) || accounts.length === 0) {
    throw new Error("Wallet returned no accounts");
  }
  const address = accounts[0];
  if (!isValidAddress(address)) {
    throw new Error("Wallet returned an invalid address");
  }

  return {
    provider,
    address: address as `0x${string}`,
    walletName: detectWalletName(provider),
  };
}

function detectWalletName(provider: Eip1193Provider): string {
  const p = provider as Eip1193Provider & { isMetaMask?: boolean; isRabby?: boolean };
  if (p.isRabby) return "Rabby";
  if (p.isMetaMask) return "MetaMask";
  return "Injected Wallet";
}

export async function getConnectedAddress(provider: Eip1193Provider): Promise<string | null> {
  try {
    const accounts = (await provider.request({ method: "eth_accounts" })) as string[];
    if (Array.isArray(accounts) && accounts.length > 0 && isValidAddress(accounts[0])) {
      return accounts[0] as `0x${string}`;
    }
    return null;
  } catch {
    return null;
  }
}

export function shortenAddress(address: string): string {
  return address.length > 12 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address;
}
