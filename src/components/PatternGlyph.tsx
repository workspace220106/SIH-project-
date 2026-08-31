import type { PatternId } from '@/types'

/**
 * Schematic of each detector's shape. These are diagrams, not icons: node
 * counts and spacing match what the detector actually looks for.
 */
export function PatternGlyph({ id, active }: { id: PatternId; active?: boolean }) {
  const stroke = active ? '#E3BE5C' : '#3A4046'
  const node = active ? '#E3BE5C' : '#6C767E'
  const faint = active ? 'rgba(227,190,92,0.4)' : '#2B3238'

  return (
    <svg viewBox="0 0 132 60" className="h-[58px] w-full" role="img" aria-label={id}>
      {id === 'FAN_OUT' && (
        <>
          {Array.from({ length: 7 }).map((_, i) => (
            <g key={i}>
              <line x1={26} y1={30} x2={104} y2={6 + i * 8} stroke={faint} strokeWidth={0.8} />
              <rect x={102} y={4 + i * 8} width={4} height={4} fill={node} />
            </g>
          ))}
          <circle cx={24} cy={30} r={5} fill={node} />
        </>
      )}

      {id === 'FAN_IN' && (
        <>
          {Array.from({ length: 7 }).map((_, i) => (
            <g key={i}>
              <line x1={28} y1={6 + i * 8} x2={106} y2={30} stroke={faint} strokeWidth={0.8} />
              <rect x={24} y={4 + i * 8} width={4} height={4} fill={node} />
            </g>
          ))}
          <circle cx={108} cy={30} r={5} fill={node} />
        </>
      )}

      {id === 'RAPID_MOVEMENT' && (
        <>
          <line x1={18} y1={30} x2={114} y2={30} stroke={faint} strokeWidth={0.8} />
          {[18, 42, 66, 90, 114].map((x, i) => (
            <g key={x}>
              <circle cx={x} cy={30} r={i === 0 ? 4.5 : 3.5} fill={node} />
              <line x1={x} y1={36} x2={x} y2={42} stroke={stroke} strokeWidth={0.8} />
              <text
                x={x}
                y={52}
                fill={active ? '#8B9299' : '#4A5259'}
                fontSize={6}
                fontFamily="IBM Plex Mono, monospace"
                textAnchor="middle"
              >
                {i === 0 ? '0s' : (i * 47) + 's'}
              </text>
            </g>
          ))}
        </>
      )}

      {id === 'BURST_ACTIVITY' && (
        <>
          {Array.from({ length: 26 }).map((_, i) => {
            const inBurst = i > 8 && i < 19
            const h = inBurst ? 8 + ((i * 13) % 22) : 2 + ((i * 7) % 5)
            return (
              <rect
                key={i}
                x={12 + i * 4.4}
                y={44 - h}
                width={2.4}
                height={h}
                fill={inBurst ? node : faint}
              />
            )
          })}
          <line x1={10} y1={45} x2={124} y2={45} stroke={faint} strokeWidth={0.8} />
          <line x1={51} y1={8} x2={51} y2={45} stroke={stroke} strokeWidth={0.6} strokeDasharray="2 2" />
          <line x1={95} y1={8} x2={95} y2={45} stroke={stroke} strokeWidth={0.6} strokeDasharray="2 2" />
        </>
      )}

      {id === 'PEELING' && (
        <>
          {[14, 42, 70, 98].map((x, i) => (
            <g key={x}>
              <circle cx={x} cy={22} r={6 - i * 0.9} fill={node} />
              {i < 3 && <line x1={x + 7} y1={22} x2={x + 21} y2={22} stroke={stroke} strokeWidth={1} />}
              <line x1={x} y1={29} x2={x + 6} y2={44} stroke={faint} strokeWidth={0.8} />
              <rect x={x + 4} y={44} width={4} height={4} fill={faint} />
            </g>
          ))}
          <circle cx={120} cy={22} r={2.6} fill={node} />
          <line x1={105} y1={22} x2={117} y2={22} stroke={stroke} strokeWidth={1} />
        </>
      )}
    </svg>
  )
}
