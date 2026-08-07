import type { GameData } from "../types";

export type RosterProfile = {
  id: string;
  name: string;
};

export type RosterInventory = {
  members: string[];
  cardsByMember: Record<string, string[]>;
  costumeIds: string[];
};

const STORAGE_PROFILES = "holodream-roster-profiles-v1";
const STORAGE_ACTIVE_PROFILE = "holodream-roster-active-profile-v1";
const STORAGE_PROFILE_PREFIX = "holodream-roster-profile-v1:";

// Legacy single-account keys from the current site.
const LEGACY_ROSTER = "holodream-owned-roster";
const LEGACY_ROSTER_CARDS = "holodream-roster-preferred-cards";

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function profileKey(profileId: string): string {
  return `${STORAGE_PROFILE_PREFIX}${profileId}`;
}

function uniqueStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((x): x is string => typeof x === "string" && x.length > 0))];
}

function normalizeCardsByMember(value: unknown): Record<string, string[]> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, string[]> = {};
  for (const [member, ids] of Object.entries(value as Record<string, unknown>)) {
    const normalized = uniqueStrings(Array.isArray(ids) ? ids : [ids]);
    out[member] = normalized;
  }
  return out;
}

function makeProfileId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `profile-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function bootstrapRosterProfiles(data: GameData): {
  profiles: RosterProfile[];
  activeId: string;
  inventory: RosterInventory;
} {
  let profiles = readJson<RosterProfile[]>(STORAGE_PROFILES, []).filter(
    (p) => p && typeof p.id === "string" && typeof p.name === "string",
  );

  if (!profiles.length) {
    const profile: RosterProfile = { id: "default", name: "帳號 1" };
    profiles = [profile];
    localStorage.setItem(STORAGE_PROFILES, JSON.stringify(profiles));

    const legacyMembers = uniqueStrings(readJson<unknown>(LEGACY_ROSTER, []));
    const legacyCards = normalizeCardsByMember(readJson<unknown>(LEGACY_ROSTER_CARDS, {}));
    const hadLegacyData = legacyMembers.length > 0 || Object.keys(legacyCards).length > 0;

    // Preserve old behavior for an existing user: the old site assumed every costume was owned.
    // Fresh users start with no costumes selected and explicitly choose/import them.
    saveRosterInventory(profile.id, {
      members: legacyMembers,
      cardsByMember: legacyCards,
      costumeIds: hadLegacyData ? data.costumes.map((c) => c.id) : [],
    });
  }

  const storedActive = localStorage.getItem(STORAGE_ACTIVE_PROFILE) ?? "";
  const activeId = profiles.some((p) => p.id === storedActive) ? storedActive : profiles[0].id;
  localStorage.setItem(STORAGE_ACTIVE_PROFILE, activeId);

  return {
    profiles,
    activeId,
    inventory: loadRosterInventory(activeId),
  };
}

export function loadRosterInventory(profileId: string): RosterInventory {
  const raw = readJson<Partial<RosterInventory>>(profileKey(profileId), {});
  return {
    members: uniqueStrings(raw.members),
    cardsByMember: normalizeCardsByMember(raw.cardsByMember),
    costumeIds: uniqueStrings(raw.costumeIds),
  };
}

export function saveRosterInventory(profileId: string, inventory: RosterInventory): void {
  localStorage.setItem(
    profileKey(profileId),
    JSON.stringify({
      members: uniqueStrings(inventory.members),
      cardsByMember: normalizeCardsByMember(inventory.cardsByMember),
      costumeIds: uniqueStrings(inventory.costumeIds),
    }),
  );
}

export function saveRosterProfiles(profiles: RosterProfile[]): void {
  localStorage.setItem(STORAGE_PROFILES, JSON.stringify(profiles));
}

export function setActiveRosterProfile(profileId: string): void {
  localStorage.setItem(STORAGE_ACTIVE_PROFILE, profileId);
}

export function createRosterProfile(name: string): RosterProfile {
  return {
    id: makeProfileId(),
    name: name.trim() || "新帳號",
  };
}

export function deleteRosterInventory(profileId: string): void {
  localStorage.removeItem(profileKey(profileId));
}

export function exportRosterInventory(
  profile: RosterProfile,
  inventory: RosterInventory,
): string {
  return JSON.stringify(
    {
      schema: "holodream-roster-v1",
      profileName: profile.name,
      members: inventory.members,
      cardsByMember: inventory.cardsByMember,
      costumeIds: inventory.costumeIds,
    },
    null,
    2,
  );
}

export function parseRosterImport(text: string, data: GameData): RosterInventory {
  const parsed = JSON.parse(text) as Record<string, unknown>;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Invalid inventory JSON");
  }

  const validMembers = new Set(Object.keys(data.members));
  const cardById = new Map(data.cards.map((c) => [c.id, c] as const));
  const validCostumes = new Set(data.costumes.map((c) => c.id));

  const members = uniqueStrings(parsed.members ?? parsed.ownedMembers).filter((m) => validMembers.has(m));
  const cardsByMember = normalizeCardsByMember(parsed.cardsByMember ?? parsed.rosterOwnedCards);
  const flatCardIds = uniqueStrings(parsed.cardIds ?? parsed.ownedCardIds);

  for (const cardId of flatCardIds) {
    const card = cardById.get(cardId);
    if (!card) continue;
    const list = cardsByMember[card.member] ?? [];
    if (!list.includes(card.id)) list.push(card.id);
    cardsByMember[card.member] = list;
  }

  for (const [member, ids] of Object.entries(cardsByMember)) {
    const validIds = ids.filter((id) => cardById.get(id)?.member === member);
    if (validIds.length) {
      cardsByMember[member] = validIds;
      if (!members.includes(member) && validMembers.has(member)) members.push(member);
    } else {
      delete cardsByMember[member];
    }
  }

  const costumeIds = uniqueStrings(parsed.costumeIds ?? parsed.ownedCostumeIds).filter((id) =>
    validCostumes.has(id),
  );

  return { members, cardsByMember, costumeIds };
}
