export type TeamFavorite = {
  id: string;
  accountId: string;
  accountName: string;
  savedAt: string;
  cardIds: string[];
  costumeId: string;
  leaderIndex: number;
  powerRating: number | null;
  d4cIndex: number | null;
  effectiveStatTotal: number;
  coverage: number;
  avgScoreUp: number;
  tags: string[];
};

export type NewTeamFavorite = Omit<TeamFavorite, "id" | "savedAt" | "tags"> & {
  tags?: string[];
};

const STORAGE_TEAM_FAVORITES = "holodream-team-favorites-v1";

function makeId(): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID();
    }
  } catch {
    /* ignore */
  }
  return `fav-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((tag): tag is string => typeof tag === "string").map((tag) => tag.trim()).filter(Boolean))].slice(0, 8);
}

function parseFavorite(value: unknown): TeamFavorite | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<TeamFavorite>;
  const valid =
    typeof item.id === "string" &&
    typeof item.accountId === "string" &&
    typeof item.accountName === "string" &&
    typeof item.savedAt === "string" &&
    Array.isArray(item.cardIds) &&
    item.cardIds.every((id) => typeof id === "string") &&
    typeof item.costumeId === "string" &&
    typeof item.leaderIndex === "number" &&
    (item.powerRating === null || typeof item.powerRating === "number") &&
    (item.d4cIndex === undefined || item.d4cIndex === null || typeof item.d4cIndex === "number") &&
    typeof item.effectiveStatTotal === "number" &&
    typeof item.coverage === "number" &&
    typeof item.avgScoreUp === "number";
  if (!valid) return null;
  return {
    id: item.id,
    accountId: item.accountId,
    accountName: item.accountName,
    savedAt: item.savedAt,
    cardIds: [...item.cardIds],
    costumeId: item.costumeId,
    leaderIndex: item.leaderIndex,
    powerRating: item.powerRating ?? null,
    d4cIndex: item.d4cIndex ?? null,
    effectiveStatTotal: item.effectiveStatTotal,
    coverage: item.coverage,
    avgScoreUp: item.avgScoreUp,
    tags: normalizeTags(item.tags),
  };
}

export function loadTeamFavorites(): TeamFavorite[] {
  try {
    const raw = localStorage.getItem(STORAGE_TEAM_FAVORITES);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(parseFavorite)
      .filter((item): item is TeamFavorite => item !== null)
      .sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  } catch {
    return [];
  }
}

export function persistTeamFavorites(favorites: TeamFavorite[]): TeamFavorite[] {
  const next = [...favorites].sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  try {
    localStorage.setItem(STORAGE_TEAM_FAVORITES, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}

export function addTeamFavorite(
  favorites: TeamFavorite[],
  input: NewTeamFavorite,
): TeamFavorite[] {
  const key = `${input.accountId}|${input.costumeId}|${input.leaderIndex}|${input.cardIds.join(",")}`;
  const previous = favorites.find(
    (item) =>
      `${item.accountId}|${item.costumeId}|${item.leaderIndex}|${item.cardIds.join(",")}` === key,
  );
  const withoutSame = favorites.filter(
    (item) =>
      `${item.accountId}|${item.costumeId}|${item.leaderIndex}|${item.cardIds.join(",")}` !== key,
  );
  return persistTeamFavorites([
    {
      ...input,
      tags: normalizeTags(input.tags ?? previous?.tags ?? []),
      id: makeId(),
      savedAt: new Date().toISOString(),
    },
    ...withoutSame,
  ]);
}

export function removeTeamFavorite(
  favorites: TeamFavorite[],
  favoriteId: string,
): TeamFavorite[] {
  return persistTeamFavorites(favorites.filter((item) => item.id !== favoriteId));
}

export function updateTeamFavoriteTags(
  favorites: TeamFavorite[],
  favoriteId: string,
  tags: string[],
): TeamFavorite[] {
  return persistTeamFavorites(
    favorites.map((item) =>
      item.id === favoriteId ? { ...item, tags: normalizeTags(tags) } : item,
    ),
  );
}
