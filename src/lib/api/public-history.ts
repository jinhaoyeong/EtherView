import { isEthereumAddress } from './request-validation';

/**
 * Public Ethereum history fallback. The host is fixed and only read-only,
 * validated account queries enter this adapter. Cursor fields come from the
 * provider response, never a caller-supplied URL.
 *
 * https://github.com/blockscout/blockscout-api-v2-swagger/blob/main/swagger.yaml
 */
const ORIGIN = 'https://eth.blockscout.com';
const MAX_RECORDS = 300;
const MAX_PAGES = 6;
const TOTAL_TIMEOUT_MS = 20_000;
const PAGE_TIMEOUT_MS = 8_000;
const CURSOR_KEYS = new Set(['block_number', 'index', 'items_count', 'batch_log_index', 'batch_block_hash', 'batch_transaction_hash', 'index_in_batch']);
type RecordData = Record<string, unknown>;

export interface ExplorerHistoryRecord {
  hash: string;
  blockNumber: string;
  timeStamp: string;
  from: string;
  to: string;
  value: string;
  gasUsed?: string;
  gasPrice?: string;
  isError?: string;
  status?: string;
  contractAddress?: string;
  tokenSymbol?: string;
  tokenName?: string;
  tokenDecimal?: string;
  logIndex?: string;
}
export interface ExplorerHistoryResponse {
  status: '1';
  message: 'OK';
  result: ExplorerHistoryRecord[];
  source: 'blockscout';
  partial: boolean;
  limit: number;
}
const asRecord = (value: unknown): RecordData | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as RecordData : null;
function tokenOutcome(item: RecordData): Pick<ExplorerHistoryRecord, 'isError' | 'status'> {
  if (item.status === 'error' || item.status === 'reverted' || item.result === 'reverted') return { isError: '1', status: 'error' };
  if (item.status === 'pending' || item.status === null) return { status: 'pending' };
  if (item.status === 'ok' || item.status === 'success' || item.result === 'success') return { isError: '0', status: 'confirmed' };
  return {};
}
const digits = (value: unknown): string | undefined => (typeof value === 'string' && /^\d+$/.test(value)) || (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) ? String(value) : undefined;
const account = (value: unknown): string => {
  const hash = asRecord(value)?.hash;
  return isEthereumAddress(hash) ? hash : '';
};

export function normalizePublicHistoryRecord(value: unknown, action: 'txlist' | 'tokentx'): ExplorerHistoryRecord | null {
  const item = asRecord(value);
  if (!item) return null;
  const hash = action === 'txlist' ? item.hash : item.transaction_hash;
  const timestamp = typeof item.timestamp === 'string' ? Date.parse(item.timestamp) : NaN;
  const from = account(item.from);
  const to = account(item.to);
  if (typeof hash !== 'string' || !/^0x[\da-f]{64}$/i.test(hash) || !Number.isFinite(timestamp) || !from) return null;
  const blockNumber = digits(item.block_number) ?? '';
  const common = { hash, blockNumber, timeStamp: String(Math.floor(timestamp / 1000)), from, to };
  if (action === 'txlist') {
    const amount = digits(item.value);
    if (amount === undefined) return null;
    return {
      ...common,
      value: amount,
      gasUsed: digits(item.gas_used),
      gasPrice: digits(item.gas_price),
      isError: item.status === 'error' || item.result === 'reverted' ? '1' : '0',
      status: item.status === 'pending' || item.status === null ? 'pending' : 'confirmed',
    };
  }
  const token = asRecord(item.token);
  const total = asRecord(item.total);
  const contract = token?.address_hash;
  const amount = digits(total?.value);
  const decimals = digits(total?.decimals ?? token?.decimals);
  if (!token || !isEthereumAddress(contract) || amount === undefined || decimals === undefined || Number(decimals) > 255) return null;
  return {
    ...common,
    value: amount,
    contractAddress: contract,
    tokenSymbol: typeof token.symbol === 'string' ? token.symbol : 'TOKEN',
    tokenName: typeof token.name === 'string' ? token.name : 'Unknown token',
    tokenDecimal: decimals,
    logIndex: digits(item.log_index),
    ...tokenOutcome(item),
    // Transfer responses do not include the transaction fee. Leave it unknown.
  };
}

type Snapshot = {
  records: ExplorerHistoryRecord[];
  seenRecords: Set<string>;
  seenCursors: Set<string>;
  next: URLSearchParams | null;
  pages: number;
  exhausted: boolean;
  truncated: boolean;
  expires: number;
  retryAt: number;
  inflight?: Promise<void>;
};
const snapshots = new Map<string, Snapshot>();

async function loadSnapshotPage(baseUrl: URL, snapshot: Snapshot, timeout: number): Promise<void> {
  const url = new URL(baseUrl);
  for (const [key, value] of snapshot.next ?? []) url.searchParams.set(key, value);
  try {
    const response = await fetch(url, {
      headers: typeof window === 'undefined'
        ? { Accept: 'application/json', 'User-Agent': 'EtherView/1.0' }
        : { Accept: 'application/json' },
      signal: AbortSignal.timeout(Math.min(PAGE_TIMEOUT_MS, timeout)),
      cache: 'no-store',
    });
    if (!response.ok) throw new Error('Public history provider unavailable');
    const body = asRecord(await response.json());
    if (!body || !Array.isArray(body.items)) throw new Error('Invalid public history response');
    const action = url.pathname.endsWith('token-transfers') ? 'tokentx' : 'txlist';
    let validRows = 0;
    for (const item of body.items) {
      const record = normalizePublicHistoryRecord(item, action);
      if (!record) continue;
      validRows++;
      const identity = record.logIndex ?? (action === 'tokentx' ? [record.contractAddress, record.from, record.to, record.value].join(':') : 'eth');
      const key = `${record.hash}:${identity}`;
      if (!snapshot.seenRecords.has(key) && snapshot.records.length < MAX_RECORDS) {
        snapshot.seenRecords.add(key);
        snapshot.records.push(record);
      }
    }
    if (body.items.length > 0 && validRows === 0) throw new Error('Invalid public history records');
    snapshot.pages++;
    snapshot.retryAt = 0;
    const cursor = asRecord(body.next_page_params);
    const hasNext = !!cursor && Object.keys(cursor).length > 0;
    if (!hasNext || body.items.length === 0) { snapshot.exhausted = true; snapshot.next = null; return; }
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(cursor!)) {
      if (!CURSOR_KEYS.has(key)) continue;
      if ((typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) || (typeof value === 'string' && value.length <= 128 && /^(?:\d+|0x[\da-f]+)$/i.test(value))) next.set(key, String(value));
    }
    const signature = next.toString();
    if (!signature || snapshot.seenCursors.has(signature) || snapshot.pages >= MAX_PAGES || snapshot.records.length >= MAX_RECORDS) {
      snapshot.exhausted = true;
      snapshot.truncated = true;
      snapshot.next = null;
      return;
    }
    snapshot.seenCursors.add(signature);
    snapshot.next = next;
  } catch {
    // Share a short cooldown across concurrent wallet discovery/history requests.
    snapshot.retryAt = Date.now() + 5_000;
    throw new Error('Public history provider unavailable');
  }
}

export async function fetchPublicHistory(params: URLSearchParams): Promise<ExplorerHistoryResponse> {
  const address = params.get('address');
  const action = params.get('action');
  if (!isEthereumAddress(address) || (action !== 'txlist' && action !== 'tokentx')) throw new Error('Unsupported public history query');
  // Blockscout's address history is newest first. Never mislabel it as ascending.
  if (params.get('sort') === 'asc') throw new Error('Ascending public history is unavailable');
  const page = Number(params.get('page') || 1);
  const offset = Number(params.get('offset') || 50);
  const start = (page - 1) * offset;
  if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(offset) || offset < 1 || start >= MAX_RECORDS) throw new Error('Public history window exceeded');
  const wanted = Math.min(page * offset, MAX_RECORDS);
  const url = new URL(`/api/v2/addresses/${address.toLowerCase()}/${action === 'txlist' ? 'transactions' : 'token-transfers'}`, ORIGIN);
  if (action === 'tokentx') {
    url.searchParams.set('type', 'ERC-20');
    const contract = params.get('contractaddress');
    if (contract) {
      if (!isEthereumAddress(contract)) throw new Error('Invalid token contract');
      url.searchParams.set('token', contract.toLowerCase());
    }
  }
  // Different consumers and page sizes share one recent-history snapshot and
  // cursor sequence instead of multiplying requests to the public service.
  const snapshotKey = url.toString();
  let snapshot = snapshots.get(snapshotKey);
  if (!snapshot || Date.now() > snapshot.expires) {
    snapshot = { records: [], seenRecords: new Set(), seenCursors: new Set(), next: null, pages: 0, exhausted: false, truncated: false, expires: Date.now() + 30_000, retryAt: 0 };
    if (snapshots.size >= 200) snapshots.delete(snapshots.keys().next().value!);
    snapshots.set(snapshotKey, snapshot);
  }
  const started = Date.now();
  let failedAfterPartial = false;
  while (snapshot.records.length < wanted && !snapshot.exhausted) {
    const remaining = TOTAL_TIMEOUT_MS - (Date.now() - started);
    if (remaining <= 0 || snapshot.retryAt > Date.now()) { failedAfterPartial = true; break; }
    if (!snapshot.inflight) {
      const current = snapshot;
      current.inflight = loadSnapshotPage(url, current, remaining).finally(() => { current.inflight = undefined; });
    }
    try { await snapshot.inflight; }
    catch { failedAfterPartial = true; break; }
  }
  if (snapshot.records.length === 0 && failedAfterPartial) throw new Error('Public history provider unavailable');
  const minBlock = params.get('startblock');
  const maxBlock = params.get('endblock');
  const filtered = snapshot.records.filter(record => (!minBlock || Number(record.blockNumber) >= Number(minBlock)) && (!maxBlock || Number(record.blockNumber) <= Number(maxBlock)));
  return { status: '1', message: 'OK', result: filtered.slice(start, page * offset), source: 'blockscout', partial: failedAfterPartial || snapshot.truncated, limit: MAX_RECORDS };
}
