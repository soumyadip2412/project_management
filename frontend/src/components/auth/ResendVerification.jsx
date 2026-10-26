import { useState } from "react";
import { api } from "../../lib/api";

/**
 * "Resend the verification email" link for someone who cannot sign in yet
 * (Register's "check your inbox" screen, and Login after a 403
 * EMAIL_NOT_VERIFIED). The server answers the same way whether or not the
 * account exists, so this always ends in "sent".
 */
export default function ResendVerification({ email }) {
  const [state, setState] = useState("idle"); // idle | sending | sent

  const resend = async () => {
    setState("sending");
    try {
      await api.post("/auth/resend-verification", { email });
    } catch {
      // Same answer either way; a rate-limit error still leaves the old link valid.
    }
    setState("sent");
  };

  if (state === "sent") {
    return <span className="text-[13px] text-subtle">A new link is on its way. Check spam too.</span>;
  }
  return (
    <button
      type="button"
      onClick={resend}
      disabled={state === "sending"}
      className="rounded text-[13px] font-medium text-primary hover:underline disabled:opacity-60"
    >
      {state === "sending" ? "Sending…" : "Resend the verification email"}
    </button>
  );
}
