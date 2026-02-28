async function reownRpc(method: string, params: unknown[], chainId: number) {
  const url = `https://rpc.walletconnect.org/v1?chainId=eip155:${chainId}&projectId=${process.env.REOWN_PROJECT_ID!}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    cache: 'no-store',
  })
  const data = await res.json() as { result?: unknown; error?: { message: string } }
  if (data.error) throw new Error(data.error.message)
  return data.result
}

function formatWei(wei: bigint, symbol: string, decimals: number): string {
  const str = wei.toString().padStart(decimals + 1, '0')
  const intPart = str.slice(0, -decimals) || '0'
  const decPart = str.slice(-decimals).replace(/0+$/, '')
  const amount = decPart.length > 0 ? `${intPart}.${decPart}` : intPart
  return `${amount} ${symbol}`
}

export class PendingError extends Error {
  constructor(msg: string) { super(msg); this.name = 'PendingError' }
}

export async function verifyEVM(
  hash: string,
  ourAddr: string,
  chainId: number,
  symbol: string
): Promise<string> {
  const tx = await reownRpc('eth_getTransactionByHash', [hash], chainId) as Record<string, string> | null

  if (!tx) throw new PendingError('Transaction not found yet. Retrying…')
  if (!tx.blockNumber) throw new PendingError('Transaction is pending confirmation. Retrying…')

  if (!tx.to || tx.to.toLowerCase() !== ourAddr.toLowerCase())
    throw new Error('Transaction recipient does not match the expected address.')

  return formatWei(BigInt(tx.value), symbol, 18)
}

const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'

export async function verifyERC20(
  hash: string,
  ourAddr: string,
  tokenAddr: string,
  chainId: number,
  symbol: string,
  decimals: number
): Promise<string> {
  const receipt = await reownRpc('eth_getTransactionReceipt', [hash], chainId) as {
    blockNumber: string | null
    logs: { address: string; topics: string[]; data: string }[]
  } | null

  if (!receipt) throw new PendingError('Transaction not found yet. Retrying…')
  if (!receipt.blockNumber) throw new PendingError('Transaction is pending confirmation. Retrying…')

  const log = receipt.logs.find(l =>
    l.address.toLowerCase() === tokenAddr.toLowerCase() &&
    l.topics[0]?.toLowerCase() === TRANSFER_TOPIC &&
    l.topics[2] &&
    '0x' + l.topics[2].slice(26).toLowerCase() === ourAddr.toLowerCase()
  )

  if (!log) throw new Error('Transaction recipient does not match the expected address.')

  if (!log.data || log.data === '0x') throw new Error('Transfer log has no value data.')
  const amount = BigInt(log.data)
  return formatWei(amount, symbol, decimals)
}
