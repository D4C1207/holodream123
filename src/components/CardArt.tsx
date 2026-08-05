import cardImages from "../data/cardImages.json";

const CARD_MAP = cardImages as Record<string, string>;
const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

/** Resolve public asset paths under Vite base (e.g. /holodream on GitHub Pages). */
export function withBase(path: string | undefined): string | undefined {
  if (!path) return undefined;
  if (/^https?:\/\//i.test(path)) return path;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${BASE}${normalized}`;
}

export function cardArtUrl(cardId: string): string | undefined {
  return withBase(CARD_MAP[cardId]);
}

type Props = {
  cardId?: string;
  /** Fallback when card art missing */
  alt?: string;
  className?: string;
};

export function CardArt({ cardId, alt = "", className = "" }: Props) {
  const src = cardId ? cardArtUrl(cardId) : undefined;
  if (!src) {
    return <div className={`card-art card-art-empty ${className}`} aria-hidden />;
  }
  return (
    <img
      className={`card-art ${className}`}
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
    />
  );
}
