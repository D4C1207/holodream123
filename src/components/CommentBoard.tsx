import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useI18n } from "../i18n/LocaleContext";
import {
  COMMENT_ADMIN_KEY,
  COMMENT_BODY_MAX,
  COMMENT_NICKNAME_KEY,
  COMMENT_NICKNAME_MAX,
  commentsEnabled,
  deleteCommentAsAdmin,
  fetchComments,
  postComment,
  verifyCommentAdminKey,
  type GuestComment,
} from "../lib/commentStore";

const GUESTBOOK_HASH = "#guestbook";

function formatWhen(iso: string, locale: string): string {
  try {
    return new Date(iso).toLocaleString(locale, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

type CommentBoardProps = {
  open: boolean;
  onClose: () => void;
};

export function guestbookHashActive(): boolean {
  return window.location.hash === GUESTBOOK_HASH;
}

export function openGuestbookHash(): void {
  if (window.location.hash !== GUESTBOOK_HASH) {
    window.history.pushState({ guestbook: true }, "", GUESTBOOK_HASH);
  }
}

export function closeGuestbookHash(): void {
  if (window.location.hash === GUESTBOOK_HASH) {
    const url = `${window.location.pathname}${window.location.search}`;
    window.history.replaceState(null, "", url);
  }
}

export function CommentBoard({ open, onClose }: CommentBoardProps) {
  const { t, locale } = useI18n();
  const enabled = commentsEnabled();
  const [comments, setComments] = useState<GuestComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [nickname, setNickname] = useState(
    () => localStorage.getItem(COMMENT_NICKNAME_KEY) ?? "",
  );
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [postError, setPostError] = useState(false);
  const [adminKey, setAdminKey] = useState(() => localStorage.getItem(COMMENT_ADMIN_KEY) ?? "");
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [adminPanelOpen, setAdminPanelOpen] = useState(false);
  const [adminKeyInput, setAdminKeyInput] = useState("");
  const [adminKeyError, setAdminKeyError] = useState(false);
  const [adminChecking, setAdminChecking] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const localeTag = locale === "zh" ? "zh-TW" : locale === "ja" ? "ja-JP" : "en-US";

  const reload = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setLoadError(false);
    const { ok, comments: list } = await fetchComments();
    setComments(list);
    setLoadError(!ok);
    setLoading(false);
  }, [enabled]);

  useEffect(() => {
    if (!open) return;
    void reload();
  }, [open, reload]);

  useEffect(() => {
    if (!open || !enabled || !adminKey) {
      setAdminUnlocked(false);
      return;
    }
    let cancelled = false;
    void verifyCommentAdminKey(adminKey).then((ok) => {
      if (!cancelled) setAdminUnlocked(ok);
    });
    return () => {
      cancelled = true;
    };
  }, [open, enabled, adminKey]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text) return;
    if (text.length > COMMENT_BODY_MAX) return;

    setSubmitting(true);
    setPostError(false);
    const nick = nickname.trim().slice(0, COMMENT_NICKNAME_MAX);
    localStorage.setItem(COMMENT_NICKNAME_KEY, nick);

    const created = await postComment(nick, text);
    setSubmitting(false);

    if (!created) {
      setPostError(true);
      return;
    }

    setBody("");
    setComments((prev) => [...prev, created]);
  }

  async function unlockAdmin(e: FormEvent) {
    e.preventDefault();
    const key = adminKeyInput.trim();
    if (!key) return;
    setAdminChecking(true);
    setAdminKeyError(false);
    const ok = await verifyCommentAdminKey(key);
    setAdminChecking(false);
    if (!ok) {
      setAdminKeyError(true);
      return;
    }
    localStorage.setItem(COMMENT_ADMIN_KEY, key);
    setAdminKey(key);
    setAdminUnlocked(true);
    setAdminPanelOpen(false);
    setAdminKeyInput("");
  }

  function logoutAdmin() {
    localStorage.removeItem(COMMENT_ADMIN_KEY);
    setAdminKey("");
    setAdminUnlocked(false);
    setAdminPanelOpen(false);
    setAdminKeyInput("");
    setAdminKeyError(false);
  }

  async function removeComment(commentId: string) {
    if (!adminUnlocked || !adminKey) return;
    if (!window.confirm(t.commentBoardDeleteConfirm)) return;

    setDeletingId(commentId);
    const ok = await deleteCommentAsAdmin(commentId, adminKey);
    setDeletingId(null);

    if (!ok) {
      alert(t.commentBoardDeleteError);
      logoutAdmin();
      return;
    }
    setComments((prev) => prev.filter((c) => c.id !== commentId));
  }

  if (!open) return null;

  return (
    <div className="comment-page" role="dialog" aria-modal="true" aria-label={t.commentBoardTitle}>
      <header className="comment-page-toolbar">
        <button type="button" className="comment-back" onClick={onClose}>
          {t.commentBoardBack}
        </button>
        <h1 className="comment-page-title">{t.commentBoardTitle}</h1>
        <div className="comment-toolbar-right">
          {enabled && (
            <button
              type="button"
              className={`comment-admin-toggle ${adminUnlocked ? "is-active" : ""}`}
              onClick={() => setAdminPanelOpen((v) => !v)}
              aria-expanded={adminPanelOpen}
            >
              {t.commentBoardAdminUnlock}
            </button>
          )}
          {enabled && (
            <button
              type="button"
              className="comment-refresh"
              onClick={() => void reload()}
              disabled={loading}
            >
              {t.commentBoardRefresh}
            </button>
          )}
          {!enabled && <span className="comment-toolbar-spacer" aria-hidden />}
        </div>
      </header>

      {adminPanelOpen && enabled && (
        <div className="comment-admin-panel">
          {adminUnlocked ? (
            <button type="button" className="comment-admin-logout" onClick={logoutAdmin}>
              {t.commentBoardAdminLogout}
            </button>
          ) : (
            <form className="comment-admin-form" onSubmit={(e) => void unlockAdmin(e)}>
              <label className="comment-field">
                <span>{t.commentBoardAdminKey}</span>
                <input
                  type="password"
                  value={adminKeyInput}
                  placeholder={t.commentBoardAdminKeyPlaceholder}
                  onChange={(e) => setAdminKeyInput(e.target.value)}
                  autoComplete="current-password"
                />
              </label>
              {adminKeyError && <p className="comment-error">{t.commentBoardAdminBadKey}</p>}
              <button type="submit" className="comment-submit" disabled={adminChecking || !adminKeyInput.trim()}>
                {t.commentBoardAdminUnlockBtn}
              </button>
            </form>
          )}
        </div>
      )}

      {!enabled ? (
        <div className="comment-page-main">
          <p className="panel-note">{t.commentBoardUnavailable}</p>
        </div>
      ) : (
        <>
          <div className="comment-page-main">
            <p className="panel-note">{t.commentBoardNote}</p>

            <div className="comment-list" aria-live="polite">
              {loading && <p className="comment-status">{t.commentBoardLoading}</p>}
              {!loading && loadError && (
                <p className="comment-status comment-error">{t.commentBoardLoadError}</p>
              )}
              {!loading && !comments.length && !loadError && (
                <p className="comment-status">{t.commentBoardEmpty}</p>
              )}
              {comments.map((c) => (
                <article key={c.id} className="comment-item">
                  <header className="comment-meta">
                    <span className="comment-author">{c.nickname || t.commentBoardAnonymous}</span>
                    <div className="comment-meta-actions">
                      <time className="comment-time" dateTime={c.createdAt}>
                        {formatWhen(c.createdAt, localeTag)}
                      </time>
                      {adminUnlocked && (
                        <button
                          type="button"
                          className="comment-delete"
                          disabled={deletingId === c.id}
                          onClick={() => void removeComment(c.id)}
                        >
                          {t.commentBoardDelete}
                        </button>
                      )}
                    </div>
                  </header>
                  <p className="comment-body">{c.body}</p>
                </article>
              ))}
            </div>
          </div>

          <footer className="comment-page-compose">
            <form className="comment-form" onSubmit={(e) => void onSubmit(e)}>
              <label className="comment-field">
                <span>{t.commentBoardNickname}</span>
                <input
                  type="text"
                  value={nickname}
                  maxLength={COMMENT_NICKNAME_MAX}
                  placeholder={t.commentBoardNicknamePlaceholder}
                  onChange={(e) => setNickname(e.target.value)}
                  autoComplete="nickname"
                />
              </label>
              <label className="comment-field">
                <span>{t.commentBoardBody}</span>
                <textarea
                  value={body}
                  maxLength={COMMENT_BODY_MAX}
                  rows={3}
                  placeholder={t.commentBoardBodyPlaceholder}
                  onChange={(e) => setBody(e.target.value)}
                  required
                />
                <span className="comment-counter">
                  {body.length}/{COMMENT_BODY_MAX}
                </span>
              </label>
              {postError && <p className="comment-error">{t.commentBoardPostError}</p>}
              <button type="submit" className="comment-submit" disabled={submitting || !body.trim()}>
                {submitting ? t.commentBoardSubmitting : t.commentBoardSubmit}
              </button>
            </form>
          </footer>
        </>
      )}
    </div>
  );
}
