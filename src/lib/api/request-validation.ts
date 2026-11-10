/** Validation shared by public read-only Ethereum endpoints. */
export function isEthereumAddress(value: unknown): value is string {
  return typeof value === 'string' && /^0x[0-9a-fA-F]{40}$/.test(value);
}

const READ_ONLY_RPC_METHODS = new Set([
  'eth_chainId', 'eth_blockNumber', 'eth_call', 'eth_getBalance', 'eth_getCode',
  'eth_getTransactionCount', 'eth_getTransactionByHash', 'eth_getTransactionReceipt',
  'eth_getBlockByNumber', 'eth_getBlockByHash', 'eth_gasPrice', 'eth_maxPriorityFeePerGas',
  'eth_feeHistory', 'eth_estimateGas', 'net_version',
]);

export interface ReadOnlyRpcRequest {
  jsonrpc: '2.0';
  id: string | number | null;
  method: string;
  params?: unknown[];
}

export function isReadOnlyRpcRequest(value: unknown): value is ReadOnlyRpcRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const request = value as Record<string, unknown>;
  return request.jsonrpc === '2.0' &&
    (request.id === null || typeof request.id === 'string' || (typeof request.id === 'number' && Number.isFinite(request.id))) &&
    typeof request.method === 'string' && READ_ONLY_RPC_METHODS.has(request.method) &&
    (request.params === undefined || (Array.isArray(request.params) && request.params.length <= 32));
}

export function isReadOnlyRpcPayload(value: unknown): value is ReadOnlyRpcRequest | ReadOnlyRpcRequest[] {
  return Array.isArray(value)
    ? value.length > 0 && value.length <= 50 && value.every(isReadOnlyRpcRequest)
    : isReadOnlyRpcRequest(value);
}

export function normalizeTokenDecimals(value: unknown): number {
  const number = typeof value === 'number' ? value : (typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : NaN);
  return Number.isInteger(number) && number >= 0 && number <= 255 ? number : 18;
}
