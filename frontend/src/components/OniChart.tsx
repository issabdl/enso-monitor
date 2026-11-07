import { useId } from 'react'
import {
  Area,
  CartesianGrid,
  ComposedChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { Observation } from '../api/types'
import { COLORS } from '../colors'
import { formatAnomaly } from '../format'

interface Props {
  observations: Observation[]
  unit: string
}

const { warm: WARM, cold: COLD } = COLORS

interface TooltipProps {
  active?: boolean
  payload?: { payload: Observation }[]
  unit: string
}

function ChartTooltip({ active, payload, unit }: TooltipProps) {
  if (!active || !payload?.length) return null
  const obs = payload[0].payload
  return (
    <div className="chart-tooltip">
      <strong>
        {obs.season} {obs.year}
      </strong>
      <span>
        {formatAnomaly(obs.anomaly)} {unit}
      </span>
    </div>
  )
}

export function OniChart({ observations, unit }: Props) {
  // useId peut contenir des caractères invalides dans url(#...) : on les retire.
  const gradientId = `oni-gradient-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const values = observations.map((o) => o.anomaly)
  const max = Math.max(...values, 0)
  const min = Math.min(...values, 0)
  // Position du zéro dans le dégradé (boîte englobante de l'aire) : rouge au-dessus, bleu en dessous.
  const zero = max === min ? 0.5 : max / (max - min)
  const domain = [Math.floor(Math.min(min, -0.5) * 2) / 2, Math.ceil(Math.max(max, 0.5) * 2) / 2]
  // Graduations régulières (pas de 0,5 sur une courte plage, sinon 1) incluant toujours le zéro.
  const step = domain[1] - domain[0] > 3 ? 1 : 0.5
  const ticks: number[] = []
  for (let t = Math.ceil(domain[0] / step) * step; t <= domain[1]; t += step) ticks.push(Math.round(t * 10) / 10)

  return (
    <div className="chart" aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={observations} margin={{ top: 8, right: 40, bottom: 8, left: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset={0} stopColor={WARM} stopOpacity={0.85} />
              <stop offset={zero} stopColor={WARM} stopOpacity={0.15} />
              <stop offset={zero} stopColor={COLD} stopOpacity={0.15} />
              <stop offset={1} stopColor={COLD} stopOpacity={0.85} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={COLORS.grid} vertical={false} />
          <XAxis
            dataKey="period"
            tickFormatter={(p: string) => p.slice(0, 4)}
            minTickGap={32}
            tick={{ fill: COLORS.muted, fontSize: 12 }}
          />
          <YAxis
            domain={domain}
            ticks={ticks}
            tickFormatter={(v: number) => formatAnomaly(v)}
            tick={{ fill: COLORS.muted, fontSize: 12 }}
            width={52}
            label={{ value: `ONI (${unit})`, angle: -90, position: 'insideLeft', fill: COLORS.muted, fontSize: 12 }}
          />
          <ReferenceLine y={0} stroke={COLORS.muted} />
          <ReferenceLine y={0.5} stroke={WARM} strokeDasharray="4 4" label={{ value: '+0,5', position: 'right', fill: WARM, fontSize: 11 }} />
          <ReferenceLine y={-0.5} stroke={COLD} strokeDasharray="4 4" label={{ value: '−0,5', position: 'right', fill: COLD, fontSize: 11 }} />
          <Tooltip content={<ChartTooltip unit={unit} />} />
          <Area
            type="monotone"
            dataKey="anomaly"
            stroke={COLORS.ink}
            strokeWidth={1.25}
            fill={`url(#${gradientId})`}
            baseValue={0}
            isAnimationActive={false}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
