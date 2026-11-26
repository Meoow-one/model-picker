export const INTRO_KEY = "mp-entered";
export const INTRO_EVENT = "mp:show-intro";

export function showIntro() {
  window.dispatchEvent(new Event(INTRO_EVENT));
}

export function markIntroDone() {
  try {
    localStorage.setItem(INTRO_KEY, "1");
  } catch {
    // 隐私模式下写不进去，下次仍会显示封面
  }
}