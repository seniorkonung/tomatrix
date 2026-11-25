import { projectColors, type Project } from './db'

export function ProjectChip({ project, onClick }: { project: Project; onClick?: () => void }) {
  const color = projectColors[project.color % projectColors.length]
  const Tag = onClick ? 'button' : 'span'
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className="inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-0.5 text-sm font-medium"
      style={{ background: color.bg, color: color.text }}
    >
      <span className="size-1.5 shrink-0 rounded-full" style={{ background: color.dot }} />
      <span className="truncate">{project.name}</span>
    </Tag>
  )
}
