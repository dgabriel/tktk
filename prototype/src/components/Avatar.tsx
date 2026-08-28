interface AvatarProps {
  initials: string;
  size?: "small" | "large";
}

export function Avatar({ initials, size = "small" }: AvatarProps) {
  return <div className={`avatar avatar--${size}`}>{initials}</div>;
}
