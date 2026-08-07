export type GuestComment = {
  id: string;
  nickname: string;
  body: string;
  createdAt: string;
};

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const COMMENT_NICKNAME_KEY = "holodream-comment-nickname";
export const COMMENT_BODY_MAX = 500;
export const COMMENT_NICKNAME_MAX = 24;

export function commentsEnabled(): boolean {
  return !!(SUPABASE_URL && SUPABASE_ANON_KEY);
}

function headers(): HeadersInit | null {
  if (!commentsEnabled()) return null;
  return {
    apikey: SUPABASE_ANON_KEY!,
    Authorization: `Bearer ${SUPABASE_ANON_KEY!}`,
    "Content-Type": "application/json",
  };
}

function rowToComment(row: Record<string, unknown>): GuestComment | null {
  const id = row.id;
  const body = row.body;
  if (typeof id !== "string" || typeof body !== "string") return null;
  const created = row.created_at ?? row.createdAt;
  return {
    id,
    nickname: String(row.nickname ?? "").trim(),
    body: body.trim(),
    createdAt: typeof created === "string" ? created : new Date().toISOString(),
  };
}

export async function fetchComments(limit = 100): Promise<{ ok: boolean; comments: GuestComment[] }> {
  const h = headers();
  if (!h) return { ok: false, comments: [] };

  const url = `${SUPABASE_URL!.replace(/\/$/, "")}/rest/v1/comments?select=id,nickname,body,created_at&order=created_at.asc&limit=${limit}`;

  try {
    const res = await fetch(url, { headers: h });
    if (!res.ok) return { ok: false, comments: [] };
    const rows = (await res.json()) as Record<string, unknown>[];
    const comments = rows.map(rowToComment).filter((c): c is GuestComment => !!c && !!c.body);
    return { ok: true, comments };
  } catch {
    return { ok: false, comments: [] };
  }
}

export async function postComment(nickname: string, body: string): Promise<GuestComment | null> {
  const h = headers();
  if (!h) return null;

  const trimmedBody = body.trim();
  const trimmedNick = nickname.trim().slice(0, COMMENT_NICKNAME_MAX);
  if (!trimmedBody || trimmedBody.length > COMMENT_BODY_MAX) return null;

  const url = `${SUPABASE_URL!.replace(/\/$/, "")}/rest/v1/comments?select=id,nickname,body,created_at`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { ...h, Prefer: "return=representation" },
      body: JSON.stringify({
        nickname: trimmedNick,
        body: trimmedBody,
      }),
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as Record<string, unknown>[];
    return rows.length ? rowToComment(rows[0]) : null;
  } catch {
    return null;
  }
}
