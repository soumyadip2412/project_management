import { FcGoogle } from "react-icons/fc";
import { FaGithub } from "react-icons/fa";

const API = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1";

// OAuth needs provider credentials on the API (GOOGLE_* / GITHUB_* in
// backend/.env). Without them the buttons lead to an error, so they are only
// shown when the deployment opts in with VITE_OAUTH_ENABLED=true.
const OAUTH_ENABLED = import.meta.env.VITE_OAUTH_ENABLED === "true";

/** OAuth sign-in. Each button hands off to the API, which redirects to the provider. */
export default function SocialButtons({ divider }) {
  if (!OAUTH_ENABLED) return null;

  const go = (provider) => {
    window.location.href = `${API}/auth/${provider}`;
  };

  const cls =
    "flex h-9 w-full items-center justify-center gap-2 rounded-md border border-line bg-surface text-[13px] font-medium text-text transition-colors hover:bg-surface-hover pointer-coarse:h-10";

  return (
    <>
      <div className="my-5 flex items-center gap-3 text-xs text-subtlest">
        <span className="h-px flex-1 bg-line" />
        {divider}
        <span className="h-px flex-1 bg-line" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => go("google")} className={cls}>
          <FcGoogle size={16} aria-hidden="true" /> Google
        </button>
        <button type="button" onClick={() => go("github")} className={cls}>
          <FaGithub size={16} aria-hidden="true" /> GitHub
        </button>
      </div>
    </>
  );
}
