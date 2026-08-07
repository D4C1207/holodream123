export type TeamFavorite = {
  id: string;
  accountId: string;
  accountName: string;
  savedAt: string;
  cardIds: string[];
  costumeId: string;
  leaderIndex: number;
  powerRating: number | null;
  effectiveStatTotal: number;
  coverage: number;
  avgScoreUp: number;
};

export type NewTeamFavorite = Omit<TeamFavorite, "id" | "savedAt">;

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

function isFavorite(value: unknown): value is TeamFavorite {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<TeamFavorite>;
  return (
    typeof item.id === "string" &&
    typeof item.accountId === "string" &&
    typeof item.accountName === "string" &&
    typeof item.savedAt === "string" &&
    Array.isArray(item.cardIds) &&
    item.cardIds.every((id) => typeof id === "string") &&
    typeof item.costumeId === "string" &&
    typeof item.leaderIndex === "number" &&
    (item.powerRating === null || typeof item.powerRating === "number") &&
    typeof item.effectiveStatTotal === "number" &&
    typeof item.coverage === "number" &&
    typeof item.avgScoreUp === "number"
  );
}

export function loadTeamFavorites(): TeamFavorite[] {
  try {
    const raw = localStorage.getItem(STORAGE_TEAM_FAVORITES);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isFavorite).sort((a, b) => b.savedAt.localeCompare(a.savedAt));
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
  const withoutSame = favorites.filter(
    (item) =>
      `${item.accountId}|${item.costumeId}|${item.leaderIndex}|${item.cardIds.join(",")}` !== key,
  );
  return persistTeamFavorites([
    {
      ...input,
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
