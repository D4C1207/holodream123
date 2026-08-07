import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useI18n } from "../i18n/LocaleContext";
import {
  COMMENT_BODY_MAX,
  COMMENT_NICKNAME_KEY,
  COMMENT_NICKNAME_MAX,
  commentsEnabled,
  fetchComments,
  postComment,
  type GuestComment,
} from "../lib/commentStore";

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

  if (!open) return null;

  return (
    <div className="comment-overlay" role="presentation" onClick={onClose}>
      <section
        className="panel comment-board comment-modal"
        aria-label={t.commentBoardTitle}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="panel-head comment-board-head">
          <h2>{t.commentBoardTitle}</h2>
          <div className="comment-board-actions">
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
            <button type="button" className="comment-close" onClick={onClose} aria-label={t.commentBoardClose}>
              ×
            </button>
          </div>
        </div>

        {!enabled ? (
          <p className="panel-note">{t.commentBoardUnavailable}</p>
        ) : (
          <>
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
                    <time className="comment-time" dateTime={c.createdAt}>
                      {formatWhen(c.createdAt, localeTag)}
                    </time>
                  </header>
                  <p className="comment-body">{c.body}</p>
                </article>
              ))}
            </div>

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
          </>
        )}
      </section>
    </div>
  );
}
