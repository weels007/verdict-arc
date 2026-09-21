import assert from 'node:assert/strict';
import { createWalletAdapter, type ChainCallAdapter } from './src/real/adapter.js';
import { evaluateSLAFromEvidence } from './src/evidence.js';
import { createRepo, createOffer } from './src/contract.js';
import { makeTaskCompletionEvidenceDoc, makeAvailabilityEvidenceDoc, serializeEvidenceDoc } from './src/real/evidence.js';
import { Bytes32 } from './src/types.js';

function bytes32FromInt(value: number): Bytes32 {
  return '0x' + String(value).padStart(64, '0');
}

function assertCondition(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error('Real smoke assertion failed: ' + message);
  }
}

function runRealEvidenceSmoke(): void {
  console.log('Running real-evidence smoke checks...');

  const taskDoc = makeTaskCompletionEvidenceDoc({
    batchId: 'batch-real-001',
    completedTaskCount: 5,
    completionTimestamps: [1500, 2000, 2500, 3000, 3500],
    allTasksSuccessful: true,
    workerBinding: 'sig:worker-real-001',
  });
  assertCondition(taskDoc.evidence_format === 'task_completion_v1', 'task doc has canonical format');
  assertCondition(taskDoc.completed_task_count === 5, 'task doc preserves count');
  assertCondition(JSON.parse(serializeEvidenceDoc(taskDoc)).batch_id === 'batch-real-001', 'task doc round-trips');

  const availDoc = makeAvailabilityEvidenceDoc({
    endpointId: 'https://svc.example/health',
    observationWindowStart: 1200,
    observationWindowEnd: 4800,
    successfulResponses: 98,
    totalResponses: 100,
    monitorRef: 'monitor-real-002',
  });
  assertCondition(availDoc.evidence_format === 'availability_v1', 'availability doc has canonical format');
  assertCondition(availDoc.total_responses === 100, 'availability doc preserves total');

  let rejectedBadCount = false;
  try {
    makeTaskCompletionEvidenceDoc({
      batchId: 'x',
      completedTaskCount: 4,
      completionTimestamps: [1500, 2000, 2500],
      allTasksSuccessful: true,
      workerBinding: 's',
    });
  } catch {
    rejectedBadCount = true;
  }
  assertCondition(rejectedBadCount, 'task doc rejects mismatched timestamps');

  let rejectedBadRatio = false;
  try {
    makeAvailabilityEvidenceDoc({
      endpointId: 'x',
      observationWindowStart: 1200,
      observationWindowEnd: 4800,
      successfulResponses: 120,
      totalResponses: 100,
      monitorRef: 'm',
    });
  } catch {
    rejectedBadRatio = true;
  }
  assertCondition(rejectedBadRatio, 'availability doc rejects out-of-range ratio');

  const taskRepo = createRepo();
  createOffer(
    taskRepo,
    bytes32FromInt(101),
    'provider-real',
    'consumer-real',
    'task service',
    '100',
    '0',
    '25',
    1000,
    5000,
    5,
    false,
    'task_completion_v1'
  );
  const taskOffer = taskRepo.offers.get(bytes32FromInt(101))!;
  assertCondition(taskOffer.status === 'Offering', 'offer should be created');

  const taskSubmission = {
    contractId: bytes32FromInt(101),
    submissionId: bytes32FromInt(11),
    submissionTime: 3600,
    provider: 'provider-real',
    submissionType: 'task_completion_v1',
    evidencePayload: {
      batchId: taskDoc.batch_id,
      completedTaskCount: taskDoc.completed_task_count,
      completionTimestamps: taskDoc.completion_timestamps,
      statuses: taskDoc.all_tasks_successful ? taskDoc.completion_timestamps.map(() => true) : taskDoc.completion_timestamps.map(() => false),
      workerBinding: taskDoc.worker_binding,
    },
    fingerprintRef: 'fp:abc123:provider-real',
    source: {
      sourceId: 'real-evidence-doc',
      kind: 'real' as const,
    },
  };

  const taskDecision = evaluateSLAFromEvidence(taskOffer, taskSubmission);
  assertCondition(taskDecision === 'Satisfied', 'valid task evidence should satisfy SLA');

  const failSubmission = {
    contractId: bytes32FromInt(102),
    submissionId: bytes32FromInt(12),
    submissionTime: 3600,
    provider: 'provider-real',
    submissionType: 'task_completion_v1',
    evidencePayload: {
      batchId: 'batch-real-fail',
      completedTaskCount: 3,
      completionTimestamps: [2000, 2500, 3000],
      statuses: [true, true, true],
      workerBinding: 'sig:worker-real-fail',
    },
    fingerprintRef: 'fp:abc123:provider-real',
    source: {
      sourceId: 'real-evidence-doc',
      kind: 'real' as const,
    },
  };
  createOffer(
    taskRepo,
    bytes32FromInt(102),
    'provider-real',
    'consumer-real',
    'task service',
    '100',
    '0',
    '25',
    1000,
    5000,
    5,
    false,
    'task_completion_v1'
  );
  const failOffer = taskRepo.offers.get(bytes32FromInt(102))!;
  const failDecision = evaluateSLAFromEvidence(failOffer, failSubmission);
  assertCondition(failDecision === 'NotSatisfied', 'insufficient tasks should not satisfy SLA');

  const availRepo = createRepo();
  createOffer(
    availRepo,
    bytes32FromInt(103),
    'provider-real',
    'consumer-real',
    'availability service',
    '100',
    '0',
    '25',
    1000,
    5000,
    3,
    false,
    'availability_v1'
  );
  const availOffer = availRepo.offers.get(bytes32FromInt(103))!;
  assertCondition(availOffer.status === 'Offering', 'availability offer should be created');

  const availSubmission = {
    contractId: bytes32FromInt(103),
    submissionId: bytes32FromInt(13),
    submissionTime: 3600,
    provider: 'provider-real',
    submissionType: 'availability_v1',
    evidencePayload: {
      endpointId: availDoc.endpoint_id,
      windowStart: availDoc.observation_window_start,
      windowEnd: availDoc.observation_window_end,
      successfulResponses: availDoc.successful_responses,
      totalResponses: availDoc.total_responses,
      verifierBinding: availDoc.monitor_ref,
    },
    fingerprintRef: 'fp:abc123:provider-real',
    source: {
      sourceId: 'real-evidence-doc',
      kind: 'real' as const,
    },
  };

  const availDecision = evaluateSLAFromEvidence(availOffer, availSubmission);
  assertCondition(availDecision === 'Satisfied', 'high availability should satisfy SLA');

  const lowAvailDoc = makeAvailabilityEvidenceDoc({
    endpointId: 'https://svc.example/health',
    observationWindowStart: 1200,
    observationWindowEnd: 4800,
    successfulResponses: 94,
    totalResponses: 100,
    monitorRef: 'monitor-real-low',
  });
  const lowAvailSubmission = {
    ...availSubmission,
    contractId: bytes32FromInt(104),
    submissionId: bytes32FromInt(14),
    evidencePayload: {
      endpointId: lowAvailDoc.endpoint_id,
      windowStart: lowAvailDoc.observation_window_start,
      windowEnd: lowAvailDoc.observation_window_end,
      successfulResponses: lowAvailDoc.successful_responses,
      totalResponses: lowAvailDoc.total_responses,
      verifierBinding: lowAvailDoc.monitor_ref,
    },
    fingerprintRef: 'fp:abc123:provider-real',
    source: {
      sourceId: 'real-evidence-doc',
      kind: 'real' as const,
    },
  };

  const lowAvailDecision = evaluateSLAFromEvidence(availOffer, lowAvailSubmission);
  assertCondition(lowAvailDecision === 'NotSatisfied', 'low availability should not satisfy SLA');

  console.log('Real-evidence smoke checks passed.');
}

const ACCOUNT = '0x1111111111111111111111111111111111111111';
const CONTRACT = '0x2222222222222222222222222222222222222222';
const LOCALNET_CHAIN_ID_HEX = '0xeec7';

interface RpcRequest {
  method: string;
  params?: unknown[];
  id?: number | string;
}

type CallLog = { wallet: string[]; rpc: string[] };

function mockFetchChainId(walletChainIdHex: string): typeof fetch {
  return async (_input: unknown, init?: RequestInit) => {
    const body = init?.body;
    if (typeof body !== 'string') {
      throw new Error('Missing RPC request body');
    }
    const request = JSON.parse(body) as RpcRequest;
    const results: Record<string, string> = {
      eth_chainId: walletChainIdHex,
    };
    assert.ok(request.method in results, `Unexpected RPC: ${request.method}`);
    return new Response(JSON.stringify({ jsonrpc: '2.0', id: request.id, result: results[request.method] }));
  };
}

function mockFetchTransaction(): { fetch: typeof fetch; calls: RpcRequest[] } {
  const calls: RpcRequest[] = [];
  const fetch = async (_input: unknown, init?: RequestInit) => {
    const body = init?.body;
    if (typeof body !== 'string') {
      throw new Error('Missing RPC request body');
    }
    const request = JSON.parse(body) as RpcRequest;
    calls.push(request);
    const result = typeof results[request.method] === "function"
      ? (results[request.method] as (request: RpcRequest) => unknown)(request)
      : results[request.method];
    assert.ok(request.method in results, `Unexpected RPC: ${request.method}`);
    return new Response(JSON.stringify({ jsonrpc: '2.0', id: request.id, result }));
  };
  return { fetch, calls };
}

function createMockProvider(log: CallLog, options: {
  walletChainId: string;
  supportsAdd?: boolean;
  switchSucceeds?: boolean;
}): { request: (args: RpcRequest) => Promise<unknown> } {
  const switchSucceeds = options.switchSucceeds ?? true;
  let currentWalletChainId = options.walletChainId;
  return {
    request: async (args) => {
      const { method, params } = args;
      log.wallet.push(method);
      switch (method) {
        case 'eth_chainId':
          return currentWalletChainId;
        case 'eth_sendTransaction': {
          const [transaction] = params as { from: string; data: string }[];
          assert.equal(transaction.from, ACCOUNT);
          assert.ok(transaction.data.includes(ACCOUNT.slice(2)));
          assert.ok(transaction.data.includes(CONTRACT.slice(2)));
          return '0xwallettransaction';
        }
        case 'wallet_switchEthereumChain': {
          const [arg] = params as [{ chainId: string }];
          assert.equal(arg.chainId, LOCALNET_CHAIN_ID_HEX);
          if (!switchSucceeds) throw Object.assign(new Error('User rejected'), { code: 4001 });
          if (!options.supportsAdd) throw Object.assign(new Error('Not added'), { code: 4902 });
          currentWalletChainId = LOCALNET_CHAIN_ID_HEX;
          return null;
        }
        case 'wallet_addEthereumChain': {
          assert.ok(options.supportsAdd, 'wallet_addEthereumChain should not be called when unsupported');
          currentWalletChainId = LOCALNET_CHAIN_ID_HEX;
          return null;
        }
        default:
          throw new Error(`Unexpected wallet method ${method}`);
      }
    },
  };
}

async function createCaseThroughAdapter(adapter: ChainCallAdapter): Promise<Error | undefined> {
  try {
    await adapter.createCase({
      caseId: 'wallet-regression',
      provider: ACCOUNT,
      consumer: ACCOUNT,
      serviceDescription: 'test service',
      windowStart: 100,
      windowEnd: 200,
      taskCountRequired: 1,
      availabilityThresholdPermille: 950,
      evidenceMode: 'task_completion_v1',
    });
    return undefined;
  } catch (error) {
    return error as Error;
  }
}

async function runWalletAdapterSmoke(): Promise<void> {
  const originalFetch = globalThis.fetch;

  try {
    // 1. Wallet already on the correct chain -> createCase proceeds to signing.
    {
      const log: CallLog = { wallet: [], rpc: [] };
      const provider = createMockProvider(log, { walletChainId: LOCALNET_CHAIN_ID_HEX, switchSucceeds: true });
      const adapter = createWalletAdapter({
        endpoint: 'http://127.0.0.1:8080/api',
        contractAddress: CONTRACT,
        account: ACCOUNT,
        provider,
      });
      globalThis.fetch = mockFetchTransaction().fetch;
      const error = await createCaseThroughAdapter(adapter);
      assert.equal(error, undefined, 'createCase should proceed after chain check');
      assert.ok(!log.wallet.includes('wallet_switchEthereumChain'), 'switch should not be called on correct chain');
      assert.ok(!log.wallet.includes('wallet_addEthereumChain'), 'add chain should not be requested');
      console.log('Wallet correct-chain smoke check passed.');
    }

    // 2. Wallet on a different chain that can be switched -> createCase proceeds to signing.
    {
      const log: CallLog = { wallet: [], rpc: [] };
      const provider = createMockProvider(log, { walletChainId: '0x1', switchSucceeds: true });
      const adapter = createWalletAdapter({
        endpoint: 'http://127.0.0.1:8080/api',
        contractAddress: CONTRACT,
        account: ACCOUNT,
        provider,
      });
      globalThis.fetch = mockFetchTransaction().fetch;
      const error = await createCaseThroughAdapter(adapter);
      assert.equal(error, undefined, 'createCase should proceed after switch');
      assert.ok(log.wallet.includes('wallet_switchEthereumChain'), 'expected wallet_switchEthereumChain');
      assert.ok(!log.wallet.includes('wallet_addEthereumChain'), 'add chain should not be requested after successful switch');
      console.log('Wallet switch smoke check passed.');
    }

    // 3. Wallet on a different chain that is not yet added -> addEthereumChain is called.
    {
      const log: CallLog = { wallet: [], rpc: [] };
      const provider = createMockProvider(log, { walletChainId: '0x1', switchSucceeds: false, supportsAdd: true });
      const adapter = createWalletAdapter({
        endpoint: 'http://127.0.0.1:8080/api',
        contractAddress: CONTRACT,
        account: ACCOUNT,
        provider,
      });
      globalThis.fetch = mockFetchTransaction().fetch;
      const error = await createCaseThroughAdapter(adapter);
      assert.equal(error, undefined, 'createCase should proceed after add');
      assert.ok(log.wallet.includes('wallet_switchEthereumChain'), 'expected first switch attempt');
      assert.ok(log.wallet.includes('wallet_addEthereumChain'), 'expected wallet_addEthereumChain on 4902');
      console.log('Wallet add chain smoke check passed.');
    }

    // 4. User rejects the network switch -> friendly error.
    {
      const log: CallLog = { wallet: [], rpc: [] };
      const provider = createMockProvider(log, { walletChainId: '0x1', switchSucceeds: false, supportsAdd: true });
      const adapter = createWalletAdapter({
        endpoint: 'http://127.0.0.1:8080/api',
        contractAddress: CONTRACT,
        account: ACCOUNT,
        provider,
      });
      globalThis.fetch = mockFetchTransaction().fetch;
      const error = await createCaseThroughAdapter(adapter);
      assert.ok(error instanceof Error, 'user rejection should throw');
      assert.match(error.message, /User rejected/, 'error should guide user to switch network');
      console.log('Wallet rejection smoke check passed.');
    }

    // 5. RPC returns a mismatched chain ID -> configuration error.
    {
      const log: CallLog = { wallet: [], rpc: [] };
      const provider = createMockProvider(log, { walletChainId: LOCALNET_CHAIN_ID_HEX, switchSucceeds: true, supportsAdd: true });
      const adapter = createWalletAdapter({
        endpoint: 'http://127.0.0.1:8080/api',
        contractAddress: CONTRACT,
        account: ACCOUNT,
        provider,
      });
      globalThis.fetch = mockFetchChainId('0x1');
      const error = await createCaseThroughAdapter(adapter);
      assert.ok(error instanceof Error, 'RPC mismatch should throw');
      assert.match(error.message, /expected.*chain/, 'error should mention expected chain');
      assert.deepEqual(log.wallet, [], 'no wallet calls expected when RPC is on the wrong chain');
      console.log('RPC mismatch smoke check passed.');
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
}

runRealEvidenceSmoke();
await runWalletAdapterSmoke();
