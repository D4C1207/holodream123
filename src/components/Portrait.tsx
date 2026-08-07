import { withBase } from "./CardArt";
import portraitsCut from "../data/portraitsCut.json";
import portraits from "../data/portraits.json";

const CUT = portraitsCut as Record<string, string>;
const RAW = portraits as Record<string, string>;

const PORTRAIT_MEMBER_ALIASES: Record<string, string> = {
  星街彗星: "星街すいせい",
};

export function portraitUrl(member: string, preferCut = true): string | undefined {
  const key = PORTRAIT_MEMBER_ALIASES[member] ?? member;
  if (preferCut && CUT[key]) return withBase(CUT[key]);
  return withBase(RAW[key]);
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
