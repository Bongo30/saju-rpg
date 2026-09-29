import { GameState } from './state';

const KEY = 'saju-rpg-save-v1';

export function hasSave(): boolean {
  try {
    return !!localStorage.getItem(KEY);
  } catch {
    return false;
  }
}

export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? GameState.fromJSON(raw) : null;
  } catch {
    return null;
  }
}

export function saveGame(state: GameState): boolean {
  try {
    localStorage.setItem(KEY, state.toJSON());
    return true;
  } catch {
    return false;
  }
}

export function deleteSave() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // 저장소를 못 쓰는 브라우저면 지울 것도 없다
  }
}
