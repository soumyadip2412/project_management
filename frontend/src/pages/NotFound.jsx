import { Link } from "react-router-dom";

/**
 * Unknown URL. Inside the app shell it keeps the navigation around it;
 * outside, it stands alone. Either way it says what happened and offers a way on.
 */
export default function NotFound({ inApp = false }) {
  const content = (
    <div className="flex flex-col items-start">
      <p className="text-[13px] text-subtle">404</p>
      <h1 className="mt-1 text-xl font-semibold text-text">This page does not exist</h1>
      <p className="mt-1 text-[13px] text-subtle">The link may be out of date, or the address was mistyped.</p>
      <Link
        to={inApp ? "/dashboard" : "/"}
        className="mt-4 inline-flex h-8 items-center rounded-md border border-line bg-surface px-3 text-[13px] font-medium text-text hover:bg-surface-hover"
      >
        {inApp ? "Go to dashboard" : "Go to the home page"}
      </Link>
    </div>
  );

  if (inApp) return <div className="py-12">{content}</div>;
  return <main className="mx-auto flex min-h-screen max-w-md items-center px-6">{content}</main>;
}
