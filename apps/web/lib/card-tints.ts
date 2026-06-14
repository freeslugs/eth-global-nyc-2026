// Soft pastel card tints, shared by the skill registry and the companies grid so
// the two sibling "App" pages rotate through the exact same palette. Each entry
// carries its border + hover variants; non-link cards just use bg + border.
export interface CardTint {
  bg: string;
  border: string;
  hoverBorder: string;
  hoverBg: string;
}

export const CARD_TINTS: CardTint[] = [
  { bg: "bg-[#eafaf2]", border: "border-[#c3ecd7]", hoverBorder: "hover:border-[#a9e3c5]", hoverBg: "hover:bg-[#e0f6ea]" }, // mint green
  { bg: "bg-[#fdeef4]", border: "border-[#f6cfdf]", hoverBorder: "hover:border-[#f0bad1]", hoverBg: "hover:bg-[#fbe4ee]" }, // light pink
  { bg: "bg-[#eaf3fd]", border: "border-[#c5dcf5]", hoverBorder: "hover:border-[#aacef0]", hoverBg: "hover:bg-[#e0ecfb]" }, // light blue
  { bg: "bg-[#fff6e6]", border: "border-[#f6e3bd]", hoverBorder: "hover:border-[#f0d8a3]", hoverBg: "hover:bg-[#fdefd6]" }, // light amber
  { bg: "bg-[#f2edfc]", border: "border-[#d9cdf3]", hoverBorder: "hover:border-[#cabaee]", hoverBg: "hover:bg-[#eae1fa]" }, // light lavender
  { bg: "bg-[#e7f8f8]", border: "border-[#bfe9e9]", hoverBorder: "hover:border-[#a5e0e0]", hoverBg: "hover:bg-[#dbf3f3]" }, // light teal
];
