// Real chain adapter for the GenLayer SLA-escrow intelligent contract.
//
// Real chain path only. There is no stub and no mock fallback: every call goes
// to a real GenLayer endpoint through genlayer-js.
//
// Two client modes share the same method mapping:
// - account mode (scripts/CLI): private key from env (GENLAYER_PRIVATE_KEY)
// - wallet mode  (browser):    an EIP-1193 provider (MetaMask, Rabby, ...) so
//   every write is signed by the user in their own wallet
//
// The authoritative onchain logic lives in contracts/verdict_arc.py.
// src/contract.ts is only the offline rule mirror used by tests.

import { createClient, createAccount } from "genlayer-js";
import { parseAccount } from "viem/accounts";
import type { Account } from "viem/accounts";
import { localnet, studionet, testnetBradbury } from "genlayer-js/chains";
import type { GenLayerClient, CalldataEncodable } from "genlayer-js/types";
import type { DecisionCode } from "../types.js";

type Calldata = CalldataEncodable[];

export type ChainCallAdapter = {
  getCaseSummary(caseId: string): Promise<Record<string, unknown>>;
  getStatus(caseId: string): Promise<string>;
  getEvidence(caseId: string): Promise<Record<string, unknown>>;
  getDispute(caseId: string): Promise<Record<string, unknown>>;
  getLastDecision(caseId: string): Promise<string>;
  createCase(params: {
    caseId: string;
    provider: string;
    consumer: string;
    serviceDescription: string;
    windowStart: number;
    windowEnd: number;
    taskCountRequired: number;
    availabilityThresholdPermille: number;
    evidenceMode: string;
  }): Promise<{ txHash: string }>;
  lockEscrow(caseId: string, params: {
    feeAmount: string;
    penaltyAmount: string;
    slaAmount: string;
  }): Promise<{ txHash: string }>;
  startExecution(caseId: string): Promise<{ txHash: string }>;
  submitEvidence(caseId: string, params: {
    evidenceUrl: string;
    submissionTime: number;
  }): Promise<{ txHash: string }>;
  evaluateEvidence(caseId: string): Promise<{ decision: DecisionCode; txHash: string }>;
  release(caseId: string): Promise<{ txHash: string }>;
  penalize(caseId: string): Promise<{ txHash: string }>;
  disputeSubmit(caseId: string, params: {
    reasonCode: string;
    counterEvidenceUrl: string;
  }): Promise<{ txHash: string }>;
  disputeEvaluate(caseId: string): Promise<{ decision: DecisionCode; txHash: string }>;
};

export interface RealClient {
  sendTransaction(request: {
    to: string;
    method: string;
    args: unknown;
    caller: string;
  }): Promise<{ txId: string; status: string; error?: string }>;
  call(method: string, args: unknown): Promise<unknown>;
  readState(contractAddress: string): Promise<unknown>;
}

export interface RealSigner {
  address: string;
  signMessage(message: string): Promise<string>;
}

export type RealChainContext = {
  contractAddress: string;
  client: GenLayerClient<any>;
};

/** Minimal structural type for EIP-1193 providers (MetaMask, Rabby, ...). */
export interface Eip1193Provider {
  request(args: { method: string; params?: unknown[] | object }): Promise<unknown>;
  on?(event: string, listener: (...args: unknown[]) => void): void;
  removeListener?(event: string, listener: (...args: unknown[]) => void): void;
}

function pickChain(endpoint: string) {
  if (endpoint.includes("studio.genlayer.com")) {
    return studionet;
  }
  if (endpoint.includes("localhost") || endpoint.includes("127.0.0.1")) {
    return localnet;
  }
  if (endpoint.includes("studio")) {
    return studionet;
  }
  return testnetBradbury;
}

function asDecision(value: unknown): DecisionCode {
  const decision = String(value);
  if (
    decision === "Release" ||
    decision === "Penalty" ||
    decision === "Refund" ||
    decision === "Failed"
  ) {
    return decision as DecisionCode;
  }
  throw new Error(`Unexpected decision from contract: ${decision}`);
}

// ---------------------------------------------------------------------------
// Shared adapter factory: every method maps 1:1 to a contract entrypoint.
// ---------------------------------------------------------------------------

function makeAdapter(params: {
  client: GenLayerClient<any>;
  contractAddress: string;
  beforeWrite?: () => Promise<Account | undefined>;
}): ChainCallAdapter {
  const { client, contractAddress } = params;
  const address = contractAddress as `0x${string}`;

  async function readContract<T>(
    functionName: string,
    args: Calldata = []
  ): Promise<T> {
    const result = await client.readContract({ address, functionName, args });
    return result as T;
  }

  async function writeContract(
    functionName: string,
    args: Calldata = [],
    value: bigint = BigInt(0)
  ): Promise<string> {
    const account = await params.beforeWrite?.();
    const txHash = await client.writeContract({
      address,
      functionName,
      args,
      value,
      ...(account ? { account } : {}),
    });
    return String(txHash);
  }

  async function waitAccepted(txHash: string): Promise<void> {
    await client.waitForTransactionReceipt({
      hash: txHash as any,
      status: "ACCEPTED" as any,
      retries: 60,
      interval: 2000,
    });
  }

  return {
    async getCaseSummary(caseId) {
      return readContract<Record<string, unknown>>("get_case_summary", [caseId]);
    },
    async getStatus(caseId) {
      return readContract<string>("get_status", [caseId]);
    },
    async getEvidence(caseId) {
      return readContract<Record<string, unknown>>("get_evidence", [caseId]);
    },
    async getDispute(caseId) {
      return readContract<Record<string, unknown>>("get_dispute", [caseId]);
    },
    async getLastDecision(caseId) {
      return readContract<string>("get_last_decision", [caseId]);
    },
    async createCase(p) {
      const txHash = await writeContract("create_case", [
        p.caseId,
        p.provider,
        p.consumer,
        p.serviceDescription,
        p.windowStart,
        p.windowEnd,
        p.taskCountRequired,
        p.availabilityThresholdPermille,
        p.evidenceMode,
      ]);
      await waitAccepted(txHash);
      return { txHash };
    },
    async lockEscrow(caseId, p) {
      // The SLA amount is attached as transaction value; the contract checks
      // gl.message.value before locking.
      const txHash = await writeContract(
        "lock_escrow",
        [caseId, BigInt(p.feeAmount), BigInt(p.penaltyAmount)],
        BigInt(p.slaAmount)
      );
      await waitAccepted(txHash);
      return { txHash };
    },
    async startExecution(caseId) {
      const txHash = await writeContract("start_execution", [caseId]);
      await waitAccepted(txHash);
      return { txHash };
    },
    async submitEvidence(caseId, p) {
      const txHash = await writeContract("submit_evidence", [
        caseId,
        p.evidenceUrl,
        p.submissionTime,
      ]);
      await waitAccepted(txHash);
      return { txHash };
    },
    async evaluateEvidence(caseId) {
      // The intelligent contract decides through validator consensus on
      // fetched web evidence; consensus latency is expected here.
      const txHash = await writeContract("evaluate_evidence", [caseId]);
      await waitAccepted(txHash);
      const decision = asDecision(await readContract<string>("get_last_decision", [caseId]));
      return { decision, txHash };
    },
    async release(caseId) {
      const txHash = await writeContract("release", [caseId]);
      await waitAccepted(txHash);
      return { txHash };
    },
    async penalize(caseId) {
      const txHash = await writeContract("penalize", [caseId]);
      await waitAccepted(txHash);
      return { txHash };
    },
    async disputeSubmit(caseId, p) {
      const txHash = await writeContract("submit_dispute", [
        caseId,
        p.reasonCode,
        p.counterEvidenceUrl,
      ]);
      await waitAccepted(txHash);
      return { txHash };
    },
    async disputeEvaluate(caseId) {
      const txHash = await writeContract("evaluate_dispute", [caseId]);
      await waitAccepted(txHash);
      const decision = asDecision(await readContract<string>("get_last_decision", [caseId]));
      return { decision, txHash };
    },
  };
}

// ---------------------------------------------------------------------------
// Wallet mode (browser): signs with MetaMask / Rabby through EIP-1193.
// ---------------------------------------------------------------------------

export function createWalletAdapter(options: {
  endpoint: string;
  contractAddress: string;
  provider: Eip1193Provider;
  account?: string;
}): ChainCallAdapter {
  const preset = pickChain(options.endpoint);
  const chain = {
    ...preset,
    rpcUrls: { default: { http: [options.endpoint] } },
  };
  const client = createClient({
    chain,
    endpoint: options.endpoint,
    provider: options.provider,
    ...(options.account ? { account: options.account as `0x${string}` } : {}),
  });
  const chainId = `0x${chain.id.toString(16)}`;
  const matchesChain = (value: unknown): boolean =>
    typeof value === "string" && /^0x[0-9a-f]+$/i.test(value) && BigInt(value) === BigInt(chain.id);

  async function ensureWalletChain(): Promise<Account | undefined> {
    const rpcChainId = await client.request({ method: "eth_chainId" });
    if (!matchesChain(rpcChainId)) {
      throw new Error(`RPC responds on chain ${rpcChainId}; expected ${chainId} (${chain.name}). Check the configured endpoint.`);
    }

    let account: Account | undefined;
    if (options.account) {
      account = parseAccount(options.account as `0x${string}`);
    } else {
      const accounts = await options.provider.request({ method: "eth_accounts" }) as string[];
      account = accounts[0] ? parseAccount(accounts[0] as `0x${string}`) : undefined;
    }

    const walletChainId = await options.provider.request({ method: "eth_chainId" });
    if (matchesChain(walletChainId)) return account;

    try {
      await options.provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId }],
      });
    } catch (error) {
      const rpcError = error as { code?: number; data?: { originalError?: { code?: number } } } | null;
      if (rpcError?.code !== 4902 && rpcError?.data?.originalError?.code !== 4902) throw error;
      await options.provider.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId,
          chainName: chain.name,
          nativeCurrency: chain.nativeCurrency,
          rpcUrls: [options.endpoint],
        }],
      });
      await options.provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId }],
      });
    }

    if (!matchesChain(await options.provider.request({ method: "eth_chainId" }))) {
      throw new Error(`Switch your wallet to ${chain.name} (chain ${chain.id}) before sending transactions.`);
    }

    return account;
  }

  return makeAdapter({
    client,
    contractAddress: options.contractAddress,
    beforeWrite: ensureWalletChain,
  });
}

// ---------------------------------------------------------------------------
// Account mode (CLI/scripts): env-configured private key.
// ---------------------------------------------------------------------------

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(
      `Missing required env var ${name}. Real-chain mode has no fallback: ` +
        `set GENLAYER_ENDPOINT, GENLAYER_PRIVATE_KEY and GENLAYER_CONTRACT ` +
        `(see .env.example).`
    );
  }
  return value.trim();
}

let cachedClient: GenLayerClient<any> | null = null;

export function getGenLayerClient(): GenLayerClient<any> {
  if (cachedClient) return cachedClient;
  const endpoint = requireEnv("GENLAYER_ENDPOINT");
  const privateKey = requireEnv("GENLAYER_PRIVATE_KEY");
  cachedClient = createClient({
    chain: pickChain(endpoint),
    endpoint,
    account: createAccount(privateKey as `0x${string}`),
  });
  return cachedClient;
}

export function getContractAddress(): string {
  return requireEnv("GENLAYER_CONTRACT");
}

export function createRealAdapter(): ChainCallAdapter {
  return makeAdapter({
    client: getGenLayerClient(),
    contractAddress: getContractAddress(),
  });
}
