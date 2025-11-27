import { Interface, JsonRpcProvider, formatUnits } from 'ethers'

let mcCooldownUntil = 0
let mcFailCount = 0

const MULTICALL2_ADDRESS = '0x5ba1e1260d7df9f0f4b4a5863c5d2c00b4e5edb1'

const MULTICALL2_ABI = [
  'function aggregate(tuple(address target, bytes callData)[] calls) public returns (uint256 blockNumber, bytes[] returnData)'
]

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)'
]

export async function batchBalanceOf(wallet: string, contracts: Array<{ address: string, decimals: number }>): Promise<Record<string, string>> {
  if (!contracts || contracts.length === 0) return {}
  if (Date.now() < mcCooldownUntil) return {}
  if (!process.env.ALCHEMY_API_KEY) return {}
  const erc20Iface = new Interface(ERC20_ABI)
  const mcIface = new Interface(MULTICALL2_ABI)
  const chunkSize = 125
  const out: Record<string, string> = {}
  for (let i = 0; i < contracts.length; i += chunkSize) {
    const chunk = contracts.slice(i, i + chunkSize)
    const calls = chunk.map(c => ({ target: c.address, callData: erc20Iface.encodeFunctionData('balanceOf', [wallet]) }))
    const data = mcIface.encodeFunctionData('aggregate', [calls])
    const urls: string[] = []
    const key = process.env.ALCHEMY_API_KEY || ''
    if (key) urls.push(`https://eth-mainnet.g.alchemy.com/v2/${key}`)
    urls.push('https://rpc.ankr.com/eth', 'https://ethereum.publicnode.com', 'https://cloudflare-eth.com', 'https://eth.llamarpc.com')
    let success = false
    for (const url of urls) {
      try {
        const provider = new JsonRpcProvider(url)
        const ret = await provider.call({ to: MULTICALL2_ADDRESS, data })
        const decodedAgg = mcIface.decodeFunctionResult('aggregate', ret)
        const returnData = decodedAgg[1] as string[]
        returnData.forEach((raw, idx) => {
          try {
            const decoded = erc20Iface.decodeFunctionResult('balanceOf', raw)
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
      } catch {}
    }
    if (!success) {
      chunk.forEach(c => { out[c.address.toLowerCase()] = '0' })
      mcFailCount++
      if (mcFailCount >= 2) {
        mcCooldownUntil = Date.now() + 60_000
      }
    }
  }
  return out
}
