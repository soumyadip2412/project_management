/**
 * FILE: frontend/src/lib/utils.js
 *
 * cn(...) is the className helper used by every component:
 *   cn("px-4 py-2", isActive && "bg-primary", className)
 *
 *   clsx      joins its arguments, dropping falsy ones (false, null, undefined),
 *             so conditional classes can be written inline.
 *   twMerge   resolves Tailwind conflicts so the LAST one wins:
 *             cn("p-2", "p-4") → "p-4" (not "p-2 p-4", where the CSS order decides).
 * This lets a caller override a component's default classes with its own
 * `className` prop.
 */
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
    return twMerge(clsx(inputs));
}