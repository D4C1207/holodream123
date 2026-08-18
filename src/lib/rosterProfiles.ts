import type { GameData } from "../types";

export type RosterProfile = {
  id: string;
  name: string;
};

export type RosterInventory = {
  members: string[];
  cardsByMember: Record<string, string[]>;
  costumeIds: string[];
  /** ★5 Bloom stage (0–5) per owned card. */
  bloomByCardId: Record<string, number>;
};

const STORAGE_PROFILES = "holodream-roster-profiles-v1";
const STORAGE_ACTIVE_PROFILE = "holodream-roster-active-profile-v1";
const STORAGE_PROFILE_PREFIX = "holodream-roster-profile-v1:";

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
    out[member] = uniqueStrings(Array.isArray(ids) ? ids : [ids]);
  }
  return out;
}

function normalizeBloomByCardId(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, number> = {};
  for (const [cardId, raw] of Object.entries(value as Record<string, unknown>)) {
    const n = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isFinite(n)) continue;
    out[cardId] = Math.max(0, Math.min(5, Math.floor(n)));
  }
  return out;
}

function selectedCardIds(cardsByMember: Record<string, string[]>): string[] {
  return [...new Set(Object.values(cardsByMember).flat())];
}

/** Old D4C calculations assumed every stored ★5 was max-Bloom; preserve that on migration. */
function maxBloomDefaults(cardsByMember: Record<string, string[]>, data?: GameData): Record<string, number> {
  if (!data) return {};
  const cardById = new Map(data.cards.map((card) => [card.id, card] as const));
  const out: Record<string, number> = {};
  for (const id of selectedCardIds(cardsByMember)) {
    if (cardById.get(id)?.rarity === 5) out[id] = 5;
  }
  return out;
}

function cleanBloomMap(
  bloom: Record<string, number>,
  data?: GameData,
): Record<string, number> {
  if (!data) return bloom;
  const valid = new Map(data.cards.map((card) => [card.id, card] as const));
  return Object.fromEntries(
    Object.entries(bloom).filter(([id]) => valid.get(id)?.rarity === 5),
  );
}

function makeProfileId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
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

    saveRosterInventory(profile.id, {
      members: legacyMembers,
      cardsByMember: legacyCards,
      costumeIds: hadLegacyData ? data.costumes.map((c) => c.id) : [],
      bloomByCardId: maxBloomDefaults(legacyCards, data),
    });
  }

  const storedActive = localStorage.getItem(STORAGE_ACTIVE_PROFILE) ?? "";
  const activeId = profiles.some((p) => p.id === storedActive) ? storedActive : profiles[0].id;
  localStorage.setItem(STORAGE_ACTIVE_PROFILE, activeId);

  const inventory = loadRosterInventory(activeId, data);
  // Persist migration from pre-Bloom inventory schema immediately.
  saveRosterInventory(activeId, inventory);
  return { profiles, activeId, inventory };
}

export function loadRosterInventory(profileId: string, data?: GameData): RosterInventory {
  const raw = readJson<Partial<RosterInventory>>(profileKey(profileId), {});
  const cardsByMember = normalizeCardsByMember(raw.cardsByMember);
  const hasStoredBloom = Object.prototype.hasOwnProperty.call(raw, "bloomByCardId");
  const bloomByCardId = hasStoredBloom
    ? cleanBloomMap(normalizeBloomByCardId(raw.bloomByCardId), data)
    : maxBloomDefaults(cardsByMember, data);
  return {
    members: uniqueStrings(raw.members),
    cardsByMember,
    costumeIds: uniqueStrings(raw.costumeIds),
    bloomByCardId,
  };
}

export function saveRosterInventory(profileId: string, inventory: RosterInventory): void {
  localStorage.setItem(
    profileKey(profileId),
    JSON.stringify({
      members: uniqueStrings(inventory.members),
      cardsByMember: normalizeCardsByMember(inventory.cardsByMember),
      costumeIds: uniqueStrings(inventory.costumeIds),
      bloomByCardId: normalizeBloomByCardId(inventory.bloomByCardId),
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
  return { id: makeProfileId(), name: name.trim() || "新帳號" };
}

export function deleteRosterInventory(profileId: string): void {
  localStorage.removeItem(profileKey(profileId));
}

export function exportRosterInventory(profile: RosterProfile, inventory: RosterInventory): string {
  return JSON.stringify(
    {
      schema: "holodream-roster-v2",
      profileName: profile.name,
      members: inventory.members,
      cardsByMember: inventory.cardsByMember,
      costumeIds: inventory.costumeIds,
      bloomByCardId: inventory.bloomByCardId,
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
  const providedBloom = parsed.bloomByCardId ?? parsed.cardBloomById;
  const bloomByCardId = providedBloom && typeof providedBloom === "object"
    ? cleanBloomMap(normalizeBloomByCardId(providedBloom), data)
    : maxBloomDefaults(cardsByMember, data);

  return { members, cardsByMember, costumeIds, bloomByCardId };
}
