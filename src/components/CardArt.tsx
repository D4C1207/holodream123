import cardImages from "../data/cardImages.json";

const CARD_MAP = cardImages as Record<string, string>;

export function cardArtUrl(cardId: string): string | undefined {
  return CARD_MAP[cardId];
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
