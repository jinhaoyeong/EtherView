import { Interface, JsonRpcProvider, formatUnits, Contract } from 'ethers'

let mcCooldownUntil = 0
let mcFailCount = 0

const MULTICALL2_ADDRESS = '0x5ba1e1260d7df9f0f4b4a5863c5d2c00b4e5edb1'

const MULTICALL2_ABI = [
  'function tryAggregate(bool requireSuccess, tuple(address target, bytes callData)[] calls) public returns (tuple(bool success, bytes returnData)[] returnData)'
]

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)'
]

export async function batchBalanceOf(wallet: string, contracts: Array<{ address: string, decimals: number }>): Promise<Record<string, string>> {
  if (!contracts || contracts.length === 0) return {}
  if (Date.now() < mcCooldownUntil) return {}
  const erc20Iface = new Interface(ERC20_ABI)
  const mcIface = new Interface(MULTICALL2_ABI)
  const chunkSize = 30 // Reduced from 125 to 30 to prevent RPC timeouts/limits
  const out: Record<string, string> = {}
  for (let i = 0; i < contracts.length; i += chunkSize) {
    const chunk = contracts.slice(i, i + chunkSize)
    const calls = chunk.map(c => ({ target: c.address, callData: erc20Iface.encodeFunctionData('balanceOf', [wallet]) }))
    // Use tryAggregate with requireSuccess=false to prevent one failure from breaking the batch
    const data = mcIface.encodeFunctionData('tryAggregate', [false, calls])
    const urls: string[] = []
    
    // Add local proxy as primary option to avoid CORS
    if (typeof window !== 'undefined') {
      urls.push(`${window.location.origin}/api/rpc-proxy`)
    }
    
    const key = process.env.ALCHEMY_API_KEY || ''
    if (key) urls.push(`https://eth-mainnet.g.alchemy.com/v2/${key}`)
    urls.push('https://rpc.ankr.com/eth', 'https://ethereum.publicnode.com', 'https://cloudflare-eth.com', 'https://eth.llamarpc.com')
    let success = false
    for (const url of urls) {
      try {
        console.log(`🔌 MULTICALL: Trying ${url}...`);
        // Use static network to avoid auto-detection requests which might fail
        const provider = new JsonRpcProvider(url, 1, { staticNetwork: true })
        const ret = await provider.call({ to: MULTICALL2_ADDRESS, data })
        console.log(`✅ MULTICALL: Connected to ${url}, decoding results...`);
        const decodedAgg = mcIface.decodeFunctionResult('tryAggregate', ret)
        // tryAggregate returns array of { success, returnData }
        const results = decodedAgg[0] as Array<{ success: boolean, returnData: string }>
        
        results.forEach((res, idx) => {
          if (!res.success) {
             out[chunk[idx].address.toLowerCase()] = '0'
             return
          }
          try {
            const decoded = erc20Iface.decodeFunctionResult('balanceOf', res.returnData)
            const bn = decoded[0] as bigint
            const decimals = chunk[idx].decimals || 18
            const balanceStr = formatUnits(bn, decimals)
            out[chunk[idx].address.toLowerCase()] = balanceStr
          } catch {
            out[chunk[idx].address.toLowerCase()] = '0'
          }
        })
        success = true
        break
      } catch (error) {
        console.warn(`❌ MULTICALL: Failed ${url}:`, error instanceof Error ? error.message : 'Unknown error');
      }
    }
    if (!success) {
      console.warn(`⚠️ MULTICALL: Batch failed, falling back to sequential requests for ${chunk.length} tokens`);
      // Fallback to sequential requests
      for (const token of chunk) {
        try {
          // Use proxy URL for individual calls too
          const proxyUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/rpc-proxy` : urls[0];
          const provider = new JsonRpcProvider(proxyUrl, 1, { staticNetwork: true });
          const contract = new Contract(token.address, ERC20_ABI, provider);
          const bal = await contract.balanceOf(wallet);
          const decimals = token.decimals || 18;
          out[token.address.toLowerCase()] = formatUnits(bal, decimals);
        } catch {
          out[token.address.toLowerCase()] = '0';
        }
      }
    }
  }
  return out
}
