import { withBase } from "./CardArt";
import portraitsCut from "../data/portraitsCut.json";
import portraits from "../data/portraits.json";

const CUT = portraitsCut as Record<string, string>;
const RAW = portraits as Record<string, string>;

export function portraitUrl(member: string, preferCut = true): string | undefined {
  if (preferCut && CUT[member]) return withBase(CUT[member]);
  return withBase(RAW[member]);
}

type Props = {
  member: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  /** Prefer background-removed cutout when available. */
  cut?: boolean;
};

export function Portrait({ member, size = "md", className = "", cut = false }: Props) {
  const src = portraitUrl(member, cut);
  if (!src) {
    return <div className={`portrait portrait-${size} portrait-empty ${className}`} aria-hidden />;
  }
  return (
    <img
      className={`portrait portrait-${size} ${cut ? "portrait-cut" : ""} ${className}`}
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
    />
  );
}
