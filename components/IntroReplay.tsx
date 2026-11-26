"use client";

import { showIntro } from "@/lib/intro";

export default function IntroReplay() {
  return (
    <button
      type="button"
      onClick={showIntro}
      className="underline decoration-line underline-offset-2 transition hover:text-ink"
    >
      重看封面
    </button>
  );
}