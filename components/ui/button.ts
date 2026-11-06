const BASE =
  "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-[background-color,border-color,transform] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-1 disabled:opacity-50";

const VARIANTS = {
  primary: "bg-brand-600 text-white hover:bg-brand-700",
  secondary: "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
  ghost: "text-slate-600 hover:bg-slate-100",
};

const SIZES = { sm: "px-2.5 py-1.5 text-xs", md: "px-3.5 py-2 text-sm" };

/** Classes for a button or a link styled as one. */
export function buttonClass(variant: keyof typeof VARIANTS = "primary", size: keyof typeof SIZES = "md"): string {
  return `${BASE} ${VARIANTS[variant]} ${SIZES[size]}`;
}
