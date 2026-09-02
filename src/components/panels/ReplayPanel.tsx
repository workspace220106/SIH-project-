import clsx from 'clsx'
import { useNexus } from '@/state/store'
import { fmtBtc, fmtDateTime, fmtTime, shortAddr, shortTxid } from '@/lib/graph'
import { Field, Label } from '@/components/ui'

const SPEEDS = [0.5, 1, 2, 4]

/**
 * Forensic replay. Events accumulate rather than replace: what has already
 * happened stays lit, what has not yet happened stays dark. That is the
 * difference between a reconstruction and an animation.
 */
export function ReplayPanel() {
  const replay = useNexus((s) => s.replay)
  const track = useNexus((s) => s.replayTrack)
  const setReplay = useNexus((s) => s.setReplay)
  const step = useNexus((s) => s.stepReplay)
  const start = useNexus((s) => s.startReplay)
  const analysis = useNexus((s) => s.analysis)
  const select = useNexus((s) => s.select)

  const current = replay.cursor > 0 ? track[Math.min(replay.cursor, track.length) - 1] : null
  const pct = track.length ? (replay.cursor / track.length) * 100 : 0
  const label = (id: string) => shortAddr(analysis?.index.walletById.get(id)?.address ?? id)
  const sourceLabel = current ? current.inputs.map((s) => label(s.wallet)).join(' · ') : ''
  const destLabel = current ? current.outputs.map((s) => label(s.wallet)).join(' · ') : ''

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="border-b border-line px-4 py-3">
        <div className="flex items-baseline justify-between">
          <Label>Replay</Label>
          <span className="font-mono text-3xs tabular-nums text-muted">
            {replay.cursor} / {track.length}
          </span>
        </div>
        <p className="mt-1.5 text-[11px] leading-snug text-faint">
          Every transaction touching the subject's pattern set, in the order it was observed.
        </p>
      </header>

      {/* Transport */}
      <div className="border-b border-line px-4 py-3">
        <div className="flex gap-1">
          <button
            type="button"
            className={clsx('btn flex-1 justify-center', replay.playing && 'btn-active')}
            onClick={() => (replay.active ? setReplay({ playing: !replay.playing }) : start())}
          >
            {replay.playing ? 'Pause' : 'Play'}
          </button>
          <button type="button" className="btn px-2" onClick={() => step(-1)} aria-label="Step back">
            ‹
          </button>
          <button type="button" className="btn px-2" onClick={() => step(1)} aria-label="Step forward">
            ›
          </button>
          <button
            type="button"
            className="btn px-2"
            onClick={() => setReplay({ cursor: 0, playing: false })}
          >
            Reset
          </button>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <Label>Speed</Label>
          <div className="flex flex-1 gap-1">
            {SPEEDS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setReplay({ speed: s })}
                className={clsx(
                  'flex-1 border py-[4px] rounded-full font-mono text-3xs tabular-nums transition-colors',
                  replay.speed === s
                    ? 'border-accent/60 bg-accent/[0.08] text-accent font-medium'
                    : 'border-line-strong text-faint hover:text-ink',
                )}
              >
                {s}×
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3">
          <input
            type="range"
            className="slider"
            min={0}
            max={track.length}
            value={replay.cursor}
            aria-label="Replay position"
            onChange={(e) => setReplay({ cursor: Number(e.target.value), playing: false })}
          />
          <div className="relative h-[4px] rounded-full overflow-hidden bg-line">
            <div className="h-full rounded-full bg-accent" style={{ width: pct + '%' }} />
          </div>
          <div className="mt-1 flex justify-between font-mono text-3xs text-ghost">
            <span>{track.length ? fmtTime(track[0].timestamp) : '—'}</span>
            <span>{track.length ? fmtTime(track[track.length - 1].timestamp) : '—'}</span>
          </div>
        </div>
      </div>

      {/* Current event */}
      <div className="border-b border-line px-4 py-3">
        {current ? (
          <>
            <div className="flex items-baseline justify-between">
              <span className="font-mono text-[13px] tabular-nums text-accent">
                {fmtDateTime(current.timestamp)}
              </span>
              <span className="font-mono text-3xs uppercase tracking-[0.14em] text-faint">
                T{replay.cursor}
              </span>
            </div>
            <div className="mt-2">
              <Field k="TXID" v={shortTxid(current.txid)} />
              <Field k="AMOUNT" v={fmtBtc(current.amount) + ' BTC'} tone="accent" />
              <Field k="FEE" v={fmtBtc(current.fee, 8)} tone="muted" />
              <Field k="INPUTS" v={sourceLabel} />
              <Field k="OUTPUTS" v={destLabel} />
              <Field k="SOURCE HOST" v={current.srcIp + ':' + current.srcPort} tone="muted" />
              <Field k="DEST HOST" v={current.dstIp + ':' + current.dstPort} tone="muted" />
              <Field k="SCRIPT" v={current.scriptType} tone="muted" />
            </div>
            <button
              type="button"
              className="btn mt-3 w-full justify-center"
              onClick={() => select(current.id, { fly: true })}
            >
              Select this transaction
            </button>
          </>
        ) : (
          <p className="py-4 text-[12px] leading-relaxed text-muted">
            Press play. The field stays dark until the first event, then lights up in sequence.
          </p>
        )}
      </div>

      {/* Log */}
      <ol className="flex-1 overflow-y-auto px-4 py-2">
        {track.slice(0, Math.max(0, replay.cursor)).reverse().slice(0, 40).map((t, i) => (
          <li key={t.id} className="grid grid-cols-[58px_1fr_auto] items-baseline gap-2 py-[3px]">
            <span className="font-mono text-3xs tabular-nums text-ghost">{fmtTime(t.timestamp)}</span>
            <span className="truncate font-mono text-3xs text-faint">{shortTxid(t.txid)}</span>
            <span
              className={clsx(
                'font-mono text-3xs tabular-nums',
                i === 0 ? 'text-accent' : 'text-muted',
              )}
            >
              {fmtBtc(t.amount, 3)}
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}
