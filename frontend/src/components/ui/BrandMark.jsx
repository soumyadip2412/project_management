import { cn } from "../../lib/utils";

/**
 * FILE: frontend/src/components/ui/BrandMark.jsx
 * The Setu symbol (people, board and arrow) on a white rounded tile. The tile
 * is required: the logo's navy shapes disappear on the navy top bar, hero and
 * footer. The image is decorative; put the visible "Setu" wordmark beside it
 * so links get their accessible name from the text.
 *
 * Source: public/brand/setu-mark-64.png, cut from public/brand/logo.png.
 */
const SIZES = {
  sm: "h-5 w-5 p-px",
  md: "h-6 w-6 p-px",
  lg: "h-7 w-7 p-0.5",
};

export default function BrandMark({ size = "md", className }) {
  return (
    <span
      aria-hidden="true"
      className={cn("inline-flex shrink-0 items-center justify-center rounded bg-white ring-1 ring-black/10", SIZES[size], className)}
    >
      <img src="/brand/setu-mark-64.png" alt="" width={64} height={64} decoding="async" className="h-full w-full" />
    </span>
  );
}
