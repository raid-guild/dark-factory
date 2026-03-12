type Props = {
  label: string;
  className: string;
};

export function StatusPill({ label, className }: Props) {
  return <span className={`status-pill ${className}`}>{label}</span>;
}
