interface Props {
  percent: number
  size?: number
  strokeWidth?: number
  color?: string
  trackColor?: string
  showLabel?: boolean
  labelSize?: string
}

export function ProgressCircle({
  percent, size = 48, strokeWidth = 4,
  color = '#4F46E5', trackColor = '#E0E7FF',
  showLabel = true, labelSize = 'text-[11px]',
}: Props) {
  const r = (size - strokeWidth * 2) / 2
  const circ = 2 * Math.PI * r
  const dash = (percent / 100) * circ

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={trackColor} strokeWidth={strokeWidth} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
        />
      </svg>
      {showLabel && (
        <span className={`absolute font-bold ${labelSize}`} style={{ color: '#ffffff' }}>
          {percent}%
        </span>
      )}
    </div>
  )
}
