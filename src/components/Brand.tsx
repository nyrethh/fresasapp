type BrandProps = {
  compact?: boolean
  className?: string
}

export function Brand({ compact = false, className = '' }: BrandProps) {
  return (
    <div className={`brand ${compact ? 'brand--compact' : ''} ${className}`.trim()}>
      
      <img className="brand__logo" src="/images/LOGO002.webp" alt="Fruity Fresh" />
      {!compact && <span className="brand__caption">gestión del negocio</span>}
    </div>
  )
}
