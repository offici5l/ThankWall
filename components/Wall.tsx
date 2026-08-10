'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAppKit, useAppKitAccount } from '@reown/appkit/react'
import {
  sendTransaction, switchChain,
  writeContract, signMessage,
} from '@wagmi/core'
import { parseEther, parseUnits, erc20Abi } from 'viem'
import { mainnet, bsc } from '@reown/appkit/networks'
import { getWagmiAdapter } from '@/components/AppKitProvider'
import { signMessageFor } from '@/lib/message'
import type { Entry } from '@/lib/types'

type StatusType = 'error' | 'success' | 'loading' | ''

const STORAGE_KEY         = 'tw_pending'
const USDT_BSC_CONTRACT   = '0x55d398326f99059fF775485246999027B3197955' as const
const USDT_ETH_CONTRACT   = '0xdAC17F958D2ee523a2206206994597C13D831ec7' as const

const CURRENCY_META: Record<string, { label: string; symbol: string; network: string; networkShort: string; decimals: number; color: string }> = {
  ETH:        { label: 'Ethereum',       symbol: 'ETH',  network: 'Ethereum Mainnet',  networkShort: 'Ethereum',  decimals: 18, color: '#627EEA' },
  BNB:        { label: 'BNB',            symbol: 'BNB',  network: 'BNB Smart Chain',   networkShort: 'BNB Chain', decimals: 18, color: '#F3BA2F' },
  USDT:       { label: 'USDT (BEP-20)', symbol: 'USDT', network: 'BNB Smart Chain',   networkShort: 'BNB Chain', decimals: 18, color: '#26A17B' },
  'USDT-ETH': { label: 'USDT (ERC-20)', symbol: 'USDT', network: 'Ethereum Mainnet',  networkShort: 'Ethereum',  decimals: 6,  color: '#26A17B' },
}

interface PendingTx { hash: string | null; signature: string | null; currency: string; name: string; message: string | null }

function isUnrecoverable(msg: string) {
  const m = msg.toLowerCase()
  return m.includes('recipient does not match') || m.includes('no value data') || m.includes('does not match the wallet')
}

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60)     return 'just now'
  if (s < 3600)   return `${Math.floor(s / 60)}m ago`
  if (s < 86400)  return `${Math.floor(s / 3600)}h ago`
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function exceedsDecimals(value: string, currency: string) {
  const d = CURRENCY_META[currency]?.decimals ?? 18
  const parts = value.split('.')
  return parts.length >= 2 && parts[1].length > d
}

function shortAddress(addr: string) { return addr.slice(0, 6) + '…' + addr.slice(-4) }

function savePending(p: PendingTx)  { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)) } catch {} }
function clearPending()             { try { localStorage.removeItem(STORAGE_KEY) } catch {} }
function loadPending(): PendingTx | null { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') } catch { return null } }

function getChain(currency: string) { return (currency === 'ETH' || currency === 'USDT-ETH') ? mainnet : bsc }
function isToken(currency: string)  { return currency === 'USDT' || currency === 'USDT-ETH' }
function getTokenContract(currency: string): `0x${string}` {
  return currency === 'USDT-ETH' ? USDT_ETH_CONTRACT : USDT_BSC_CONTRACT
}

const STEPS = ['Currency', 'Amount', 'Info', 'Confirm']

export function Wall({ description }: { description?: string }) {
  const { open } = useAppKit()
  const { address, isConnected } = useAppKitAccount()

  const [entries,    setEntries]    = useState<Entry[]>([])
  const [currencies, setCurrencies] = useState<string[]>([])
  const [mins,       setMins]       = useState<Record<string, string>>({})
  const [currency,   setCurrency]   = useState('')
  const [amount,     setAmount]     = useState('')
  const [name,       setName]       = useState('')
  const [message,    setMessage]    = useState('')
  const [step,       setStep]       = useState(0)
  const [loading,    setLoading]    = useState(false)
  const [modalOpen,  setModalOpen]  = useState(false)
  const [hasPending, setHasPending] = useState(false)
  const [statusMsg,  setStatusMsg]  = useState('')
  const [statusType, setStatusType] = useState<StatusType>('')
  const [toast,      setToast]      = useState('')
  const [wallLoaded, setWallLoaded] = useState(false)
  const [pendingTx,  setPendingTx]  = useState<PendingTx | null>(null)

  const overlayRef      = useRef<HTMLDivElement>(null)
  const verifyingRef    = useRef(false)
  const toastTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (toastTimerRef.current !== null) clearTimeout(toastTimerRef.current)
    }
  }, [])

  const setStatus = useCallback((msg: string, type: StatusType = '') => {
    setStatusMsg(msg); setStatusType(type)
  }, [])

  const showToast = useCallback((msg: string) => {
    if (toastTimerRef.current !== null) clearTimeout(toastTimerRef.current)
    setToast(msg)
    toastTimerRef.current = setTimeout(() => { setToast(''); toastTimerRef.current = null }, 3500)
  }, [])

  const resetForm = useCallback(() => {
    setAmount(''); setName(''); setMessage(''); setStep(0); setStatus('')
  }, [setStatus])

  const closeModal = useCallback(() => {
    verifyingRef.current = false
    setModalOpen(false)
    setLoading(false)
    setStatus('')
  }, [setStatus])

  useEffect(() => {
    fetch('/api/currencies')
      .then(r => r.json())
      .then((d: { currencies: string[] }) => {
        setCurrencies(d.currencies)
        if (d.currencies.length) setCurrency(d.currencies[0])
      })
      .catch(() => {})
    fetch('/api/config')
      .then(r => r.json())
      .then((d: { mins: Record<string, string> }) => setMins(d.mins))
      .catch(() => {})
    fetch('/api/wall')
      .then(r => r.json())
      .then((d: { data: Entry[] }) => {
        setEntries(d.data ?? [])
        setWallLoaded(true)
      })
      .catch(() => setWallLoaded(true))
  }, [])

  const submitToBackend = useCallback(async (p: PendingTx): Promise<Entry | 'duplicate' | 'pending'> => {
    const res = await fetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: p.name, message: p.message, type: p.currency, hash: p.hash, signature: p.signature }),
    })
    if (res.status === 409) return 'duplicate'
    if (res.status === 202) return 'pending'
    const data = await res.json() as { error?: string; entry?: Entry }
    if (!res.ok) throw new Error(data.error ?? 'Verification failed')
    return data.entry!
  }, [])

  const onSuccess = useCallback((entry?: Entry) => {
    clearPending()
    verifyingRef.current = false
    setHasPending(false)
    setPendingTx(null)
    setLoading(false)
    setStatus('Done.', 'success')
    if (entry) setEntries(prev => [entry, ...prev])
    showToast('Done ✦')
    setTimeout(() => { setModalOpen(false); setStatus(''); resetForm() }, 1800)
  }, [setStatus, showToast, resetForm])

  const runVerify = useCallback(async (pending: PendingTx) => {
    if (verifyingRef.current) return

    if (!pending.hash) {
      clearPending()
      return
    }
    const hash = pending.hash

    verifyingRef.current = true
    setLoading(true)
    setHasPending(true)
    setPendingTx(pending)
    setModalOpen(true)

    if (!pending.signature) {
      setStatus('Sign to verify you own this transaction…', 'loading')
      try {
        const adapter = getWagmiAdapter()
        const signature = await signMessage(adapter.wagmiConfig, { message: signMessageFor(hash) })
        pending = { ...pending, signature }
        savePending(pending)
        setPendingTx(pending)
      } catch (e: unknown) {
        if (!verifyingRef.current) return
        const err = e as { code?: number | string; shortMessage?: string; message?: string }
        const m = (err.shortMessage ?? err.message ?? '').toLowerCase()
        const rejected = err.code === 4001 || m.includes('rejected') || m.includes('denied')
        verifyingRef.current = false
        setLoading(false)
        setStatus(rejected ? 'Signature required to verify your donation.' : 'Could not sign the verification message.', 'error')
        return
      }
    }

    setStatus('Verifying…', 'loading')

    const MAX_ATTEMPTS = 30
    const RETRY_MS     = 5000

    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      if (!verifyingRef.current) return
      try {
        const result = await submitToBackend(pending)
        if (!verifyingRef.current) return
        if (result === 'pending') {
          await new Promise(r => setTimeout(r, RETRY_MS))
          continue
        }
        if (result === 'duplicate') {
          clearPending()
          verifyingRef.current = false
          setHasPending(false)
          setPendingTx(null)
          setLoading(false)
          setStatus('This transaction was already recorded on the wall.', 'error')
          return
        }
        onSuccess(result)
        return
      } catch (e: unknown) {
        if (!verifyingRef.current) return
        const msg = (e as Error).message ?? ''
        if (isUnrecoverable(msg)) {
          clearPending()
          verifyingRef.current = false
          setHasPending(false)
          setPendingTx(null)
          setLoading(false)
          setStatus(msg, 'error')
          return
        }
        if (i < MAX_ATTEMPTS - 1) {
          await new Promise(r => setTimeout(r, RETRY_MS))
          continue
        }
        verifyingRef.current = false
        setLoading(false)
        setStatus(msg || 'Verification failed.', 'error')
        return
      }
    }

    verifyingRef.current = false
    setLoading(false)
    setStatus('Verification timed out. Your transaction may still be pending on-chain. You can retry below or check back later.', 'error')
  }, [submitToBackend, onSuccess, setStatus])

  useEffect(() => {
    const pending = loadPending()
    if (!pending) return
    setCurrency(pending.currency)
    setName(pending.name)
    setMessage(pending.message ?? '')
    runVerify(pending)
  }, [runVerify])

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      const pending = loadPending()
      if (!pending) return
      if (verifyingRef.current) return
      runVerify(pending)
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [runVerify])

  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (!e.persisted) return
      verifyingRef.current = false
      const pending = loadPending()
      if (!pending) return
      runVerify(pending)
    }
    window.addEventListener('pageshow', onPageShow)
    return () => window.removeEventListener('pageshow', onPageShow)
  }, [runVerify])

  useEffect(() => {
    document.body.style.overflow = modalOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [modalOpen])

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') closeModal() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [closeModal])

  const handleNextStep = () => {
    setStatus('')
    if (step === 0) {
      if (!currency) return setStatus('Select a currency.', 'error')
      setStep(1)
    } else if (step === 1) {
      const amt = parseFloat(amount)
      if (!amount || isNaN(amt) || amt <= 0) return setStatus('Enter a valid amount.', 'error')
      const minStr = mins[currency] ?? '0'
      const minAmt = parseFloat(minStr)
      if (minAmt > 0 && amt < minAmt)
        return setStatus(`Minimum is ${minStr} ${CURRENCY_META[currency]?.symbol}.`, 'error')
      if (exceedsDecimals(amount, currency)) {
        const dec = CURRENCY_META[currency]?.decimals ?? 18
        return setStatus(`Max ${dec} decimal places.`, 'error')
      }
      setStep(2)
    } else if (step === 2) {
      const nm = name.trim()
      if (nm.length > 30) return setStatus('Name max 30 characters.', 'error')
      if (message.trim().length > 200) return setStatus('Message max 200 characters.', 'error')
      setStep(3)
    }
  }

  const handleSend = async () => {
    if (!isConnected || !address) return setStatus('Connect your wallet first.', 'error')

    const nm  = name.trim() || 'Anonymous'
    const msg = message.trim() || null

    setLoading(true)
    setStatus('')

    try {
      const adapter     = getWagmiAdapter()
      const targetChain = getChain(currency)
      const networkName = CURRENCY_META[currency]?.network ?? currency
      const meta        = CURRENCY_META[currency]

      if (!meta) throw new Error(`Unknown currency: ${currency}`)

      setStatus(`Switching to ${networkName}…`, 'loading')
      try {
        await switchChain(adapter.wagmiConfig, { chainId: targetChain.id })
      } catch (switchErr: unknown) {
        const se = switchErr as { code?: number | string; message?: string }
        const sc = se.code
        if (sc === 4001 || String(sc) === 'ACTION_REJECTED' || se.message?.toLowerCase().includes('rejected') || se.message?.toLowerCase().includes('denied')) {
          throw new Error('Network switch rejected.')
        }
        throw new Error(`Please switch your wallet to ${networkName} and try again.`)
      }

      const addrRes = await fetch(`/api/addr/${encodeURIComponent(currency)}`)
      if (!addrRes.ok) throw new Error(`${currency} not configured`)
      const { address: toAddr } = await addrRes.json() as { address: string }

      setStatus('Confirm in your wallet…', 'loading')

      const isBsc = targetChain.id === bsc.id

      const preSend: PendingTx = { hash: null, signature: null, currency, name: nm, message: msg }
      savePending(preSend)

      let txHash: string
      if (isToken(currency)) {
        txHash = await writeContract(adapter.wagmiConfig, {
          address: getTokenContract(currency), abi: erc20Abi,
          functionName: 'transfer',
          args: [toAddr as `0x${string}`, parseUnits(amount, meta.decimals)],
          chainId: targetChain.id,
          gas: BigInt(100000),
          ...(isBsc ? { type: 'legacy' as const } : {}),
        })
      } else {
        txHash = await sendTransaction(adapter.wagmiConfig, {
          to: toAddr as `0x${string}`, value: parseEther(amount),
          chainId: targetChain.id,
          gas: BigInt(21000),
          ...(isBsc ? { type: 'legacy' as const } : {}),
        })
      }

      const pending: PendingTx = { hash: txHash, signature: null, currency, name: nm, message: msg }
      savePending(pending)
      setLoading(false)
      setStatus('')
      runVerify(pending)

    } catch (e: unknown) {
      const err = e as { shortMessage?: string; message?: string; code?: number | string; cause?: { code?: number | string; message?: string } }
      const code = err.code ?? err.cause?.code
      const m = (err.shortMessage ?? err.message ?? '').toLowerCase()
      const cm = (err.cause?.message ?? '').toLowerCase()
      if (code === 4001 || String(code) === 'ACTION_REJECTED' || m.includes('rejected') || m.includes('denied') || cm.includes('rejected') || cm.includes('denied')) {
        setStatus('Transaction rejected.', 'error')
      } else if (m.includes('insufficient') || cm.includes('insufficient')) {
        setStatus('Insufficient balance to cover the amount and gas fee.', 'error')
      } else if (m.includes('feopcode') || m.includes('-32003') || cm.includes('feopcode') || cm.includes('-32003')) {
        setStatus('Transaction failed: unsupported tx type. Please try again.', 'error')
      } else {
        setStatus(err.shortMessage ?? err.message ?? 'Something went wrong.', 'error')
      }
      setLoading(false)
    }
  }

  const openModal = () => { setStep(0); setModalOpen(true) }
  const currencyMeta = CURRENCY_META[currency]

  return (
    <div>
      <nav className="nav">
        <div className="nav-left">
        </div>
        <div className="nav-right">
          {isConnected
            ? <appkit-button size="sm" />
            : <button className="btn-connect" onClick={() => open({ view: 'Connect' })}>Connect</button>
          }
        </div>
      </nav>

      <section className="hero">
        {description && <p className="hero-text">{description}</p>}
        <div className="hero-action">
          <button className="btn-main" onClick={openModal} disabled={!isConnected}>
            Join the Wall
          </button>
          {!isConnected && (
            <span className="hero-hint">Connect the wallet first</span>
          )}
        </div>
      </section>

      <main className="wall">
        <div className="wall-bar">
          <span className="wall-title">Wall</span>
        </div>
        {!wallLoaded && <div className="wall-state"><span className="spinner" /></div>}
        {wallLoaded && entries.length === 0 && (
          <div className="wall-state">
            <div className="wall-state-lines"><span /><span /><span /></div>
            <p className="wall-state-text">wall is empty</p>
          </div>
        )}
        {entries.length > 0 && (
          <div className="entries">
            {entries.map((e, i) => (
              <article key={e.id} className="entry" style={{ animationDelay: `${Math.min(i * 40, 500)}ms` }}>
                <div className="entry-top">
                  <div className="entry-name">{e.name || 'Anonymous'}</div>
                  <span className="entry-badge">{e.type}</span>
                </div>
                {e.message && (
                  <div className="entry-msg">&ldquo;{e.message}&rdquo;</div>
                )}
                <div className="entry-foot">
                  <span className="entry-amount">{e.amount}</span>
                  <span className="entry-date">{timeAgo(e.date)}</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>

      <footer className="site-footer">
        <a href="https://github.com/offici5l/thankwall" target="_blank" rel="noopener noreferrer" className="footer-link">
          <span className="footer-name">ThankWall</span>
          <span className="footer-sub">Open Source</span>
        </a>
      </footer>

      {modalOpen && (
        <div
          ref={overlayRef}
          className="overlay"
          onClick={e => { if (e.target === overlayRef.current) closeModal() }}
        >
          <div className="modal" role="dialog" aria-modal="true">

            <div className="modal-header">
              <div className="modal-header-top">
                <span className="modal-title">
                  {hasPending ? 'Pending Transaction' : 'Join the Wall'}
                </span>
                <button className="modal-close" onClick={closeModal} aria-label="Close">✕</button>
              </div>

              {!hasPending && (
                <div className="modal-steps">
                  {STEPS.map((s, i) => (
                    <div key={s} className={`modal-step ${i < step ? 'done' : i === step ? 'active' : ''}`}>
                      <div className="modal-step-dot">{i < step ? '✓' : i + 1}</div>
                      <span className="modal-step-label">{s}</span>
                    </div>
                  ))}
                </div>
              )}

              {isConnected && address && (
                <div className="modal-wallet">
                  <span className="modal-wallet-dot" />
                  {shortAddress(address)}
                </div>
              )}
            </div>

            <div className="modal-body">

              {hasPending ? (
                <>
                  {pendingTx && (
                    <div className="pending-info">
                      <div className="pending-info-row">
                        <span className="pending-info-k">Name</span>
                        <span className="pending-info-v">{pendingTx.name}</span>
                      </div>
                      {pendingTx.message && (
                        <div className="pending-info-row">
                          <span className="pending-info-k">Message</span>
                          <span className="pending-info-v pending-info-msg">&ldquo;{pendingTx.message}&rdquo;</span>
                        </div>
                      )}
                      {pendingTx.hash && (
                        <div className="pending-info-row">
                          <span className="pending-info-k">Tx Hash</span>
                          <span className="pending-info-v pending-info-hash">{pendingTx.hash.slice(0, 10)}…{pendingTx.hash.slice(-8)}</span>
                        </div>
                      )}
                    </div>
                  )}
                  {statusMsg && <div className={`s-box s-${statusType}`}>{statusMsg}</div>}
                  {loading && (
                    <div className="pending-loading">
                      <span className="spinner" />
                    </div>
                  )}
                  {!loading && statusType === 'error' && pendingTx && (
                    <div className="pending-actions">
                      {pendingTx.hash && (
                        <button
                          className="btn-send"
                          style={{ marginTop: 16 }}
                          onClick={() => { setStatus(''); runVerify(pendingTx) }}
                        >
                          {pendingTx.signature ? 'Retry Verification' : 'Sign to Verify'}
                        </button>
                      )}
                      <button
                        className="btn-dismiss"
                        onClick={() => {
                          clearPending()
                          setHasPending(false)
                          setPendingTx(null)
                          setStatus('')
                          closeModal()
                          resetForm()
                        }}
                      >
                        Dismiss
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {step === 0 && (
                    <div className="step-block">
                      <p className="step-heading">Choose currency</p>
                      <div className="currency-grid">
                        {currencies.map(c => {
                          const m = CURRENCY_META[c]
                          return (
                            <button
                              key={c}
                              className={`currency-card ${c === currency ? 'selected' : ''}`}
                              onClick={() => { setCurrency(c); setAmount(''); setStatus('') }}
                            >
                              <span className="currency-card-dot" style={{ background: m?.color }} />
                              <span className="currency-card-symbol">{m?.symbol ?? c}</span>
                              <span className="currency-card-network">{m?.networkShort}</span>
                            </button>
                          )
                        })}
                      </div>
                      {statusMsg && <div className={`s-box s-${statusType}`}>{statusMsg}</div>}
                      <button className="btn-send" onClick={handleNextStep} style={{ marginTop: 24 }}>
                        Continue →
                      </button>
                    </div>
                  )}

                  {step === 1 && (
                    <div className="step-block">
                      <p className="step-heading">Enter amount</p>
                      {currencyMeta && (
                        <div className="selected-currency-badge">
                          <span className="badge-dot" style={{ background: currencyMeta.color }} />
                          <span className="badge-label">{currencyMeta.label}</span>
                          <span className="badge-network">· {currencyMeta.networkShort}</span>
                        </div>
                      )}
                      <div className="amount-wrap">
                        <input
                          className="amount-input"
                          type="number" min="0" step="any" placeholder="0.00"
                          value={amount}
                          autoFocus
                          onChange={e => setAmount(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleNextStep() }}
                        />
                        <span className="amount-symbol">{currencyMeta?.symbol ?? currency}</span>
                      </div>
                      {statusMsg && <div className={`s-box s-${statusType}`}>{statusMsg}</div>}
                      <div className="step-nav">
                        <button className="btn-back" onClick={() => { setStep(0); setStatus('') }}>← Back</button>
                        <button className="btn-send btn-send-half" onClick={handleNextStep}>Continue →</button>
                      </div>
                    </div>
                  )}

                  {step === 2 && (
                    <div className="step-block">
                      <p className="step-heading">Your info</p>
                      <div className="field">
                        <label className="field-lbl">Name <span className="field-note">(shown on wall)</span></label>
                        <input
                          className="f-input" type="text" maxLength={30}
                          placeholder="Anonymous" value={name} autoFocus
                          onChange={e => setName(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleNextStep() }}
                        />
                        <p className="char-c">{name.length} / 30</p>
                      </div>
                      <div className="field">
                        <label className="field-lbl">Message <span className="field-note">(optional)</span></label>
                        <textarea
                          className="f-input f-textarea" maxLength={200}
                          placeholder="Say something…" value={message}
                          onChange={e => setMessage(e.target.value)}
                        />
                        <p className="char-c">{message.length} / 200</p>
                      </div>
                      {statusMsg && <div className={`s-box s-${statusType}`}>{statusMsg}</div>}
                      <div className="step-nav">
                        <button className="btn-back" onClick={() => { setStep(1); setStatus('') }}>← Back</button>
                        <button className="btn-send btn-send-half" onClick={handleNextStep}>Continue →</button>
                      </div>
                    </div>
                  )}

                  {step === 3 && (
                    <div className="step-block">
                      <p className="step-heading">Review & send</p>
                      <div className="review-card">
                        <div className="review-row">
                          <span className="review-k">Currency</span>
                          <span className="review-v">
                            <span className="badge-dot-sm" style={{ background: currencyMeta?.color }} />
                            {currencyMeta?.label}
                          </span>
                        </div>
                        <div className="review-row">
                          <span className="review-k">Network</span>
                          <span className="review-v">{currencyMeta?.networkShort}</span>
                        </div>
                        <div className="review-row">
                          <span className="review-k">Amount</span>
                          <span className="review-v review-amount">{amount} {currencyMeta?.symbol}</span>
                        </div>
                        <div className="review-row">
                          <span className="review-k">Name</span>
                          <span className="review-v">{name.trim() || 'Anonymous'}</span>
                        </div>
                        {message.trim() && (
                          <div className="review-row">
                            <span className="review-k">Message</span>
                            <span className="review-v review-msg">&ldquo;{message.trim()}&rdquo;</span>
                          </div>
                        )}
                        <div className="review-row review-gas-row">
                          <span className="review-k">Gas fee</span>
                          <span className="review-v review-gas">Estimated by wallet</span>
                        </div>
                      </div>

                      {statusMsg && !loading && <div className={`s-box s-${statusType}`}>{statusMsg}</div>}

                      <button className="btn-send" onClick={handleSend} disabled={loading} style={{ marginTop: 20 }}>
                        {loading
                          ? <><span className="btn-spinner" /> {statusMsg || 'Processing…'}</>
                          : `Send ${amount} ${currencyMeta?.symbol ?? ''}`}
                      </button>

                      {!loading && (
                        <div className="step-nav" style={{ marginTop: 10 }}>
                          <button className="btn-back" onClick={() => { setStep(2); setStatus('') }}>← Back</button>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
