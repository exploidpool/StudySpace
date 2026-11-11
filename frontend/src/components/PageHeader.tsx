export function PageHeader({ title, subtitle, eyebrow }: { title: string; subtitle?: string; eyebrow?: string }) {
  return (
    <header className="mb-6">
      {eyebrow && <p className="mb-1 text-xs font-medium tracking-[0.02em] text-dim">{eyebrow}</p>}
      <h1 className="page-title font-semibold tracking-[-0.035em]">{title}</h1>
      {subtitle && <p className="mt-1.5 text-sm text-dim">{subtitle}</p>}
    </header>
  )
}
