export function signMessageFor(hash: string): string {
  return `ThankWall donation confirmation\nTx: ${hash}`
}
