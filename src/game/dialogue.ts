import type { DialogueChoice, DialoguePage, DialogueScript } from './bus';
import { npcName, questGoalText, type GameState } from './state';
import { NPCS } from './map';
import type { QuestDef } from '../data/quests';

export interface DialogueHooks {
  openShop: (shopId: 'general' | 'weapon' | 'cloth', mode: 'buy' | 'sell') => void;
  reopen: (npcId: string) => void;
}

const IDLE: Record<string, string[]> = {
  chief: ['신단수는 천 년 동안 이 마을을 지켜 왔지. 부디 균형을 되찾아 주거라.'],
  grocer: ['약초는 체력을, 영약은 마력을 채워 준다오. 넉넉히 챙겨 가시구려.'],
  smith: ['무기는 제 오행이 있지. 자네 보완 오행과 맞는 무기를 들면 힘이 공명한다네.'],
  tailor: ['옷도 오행을 타요. 보완 오행 빛깔의 옷을 입으면 한결 몸이 가벼울 거예요.'],
  cheongsol: [
    '나는 청솔. 갑오 일주, 푸른 소나무 같은 목 기운을 타고났지.',
    '언젠가 북쪽 바다의 흑룡을 만나게 되면... 그때 내가 꼭 필요할 거다.',
    '(청솔은 나중에 동료가 될 것 같다.)',
  ],
  kid: ['형아 누나, 딱따구리는 도깨비를 싫어한대! 둘이 붙여 놓으면 저희끼리 싸운대요!'],
  guard: ['이 너머는 신단수 숲이오. 촌장님 허락 없이는 봉인을 풀 수 없소.'],
};

const SHOP_GREETING: Record<string, string> = {
  grocer: '어서 오시오. 복순네 잡화점이라오. 약초, 영약, 부적 다 있다오.',
  smith: '쇠돌 대장간일세! 쓸 만한 무기가 필요한가?',
  tailor: '비단 포목점이에요. 옷, 신발, 장신구 모두 있답니다.',
};

function frameOf(npcId: string): number {
  return NPCS.find((n) => n.id === npcId)?.frame ?? 85;
}

function pages(npcId: string, lines: string[]): DialoguePage[] {
  return lines.map((text) => ({ speaker: npcName(npcId), portrait: frameOf(npcId), text }));
}

function questChoices(state: GameState, npcId: string, hooks: DialogueHooks): { pages: DialoguePage[]; choices?: DialogueChoice[] } | null {
  const active = state.activeQuestAt(npcId);
  if (active?.state.status === 'ready') {
    const def: QuestDef = active.def;
    return {
      pages: pages(npcId, def.complete),
      choices: [
        {
          label: '보상 받기',
          action: () => {
            const err = state.turnIn(def.id);
            if (err) state.log(err, '#ff9a8a');
            hooks.reopen(npcId);
          },
        },
      ],
    };
  }
  if (active) {
    return { pages: pages(npcId, [`[${active.def.title}] ${questGoalText(active.def, active.state)}`, active.def.progressLine]) };
  }
  const offer = state.offerableQuest(npcId);
  if (offer) {
    return {
      pages: pages(npcId, offer.offer),
      choices: [
        { label: `수락한다 (${offer.main ? '메인' : '서브'})`, action: () => state.accept(offer.id) },
        { label: '나중에', action: () => undefined },
      ],
    };
  }
  return null;
}

export function npcDialogue(npcId: string, state: GameState, hooks: DialogueHooks): DialogueScript {
  const npc = NPCS.find((n) => n.id === npcId);
  if (npc?.shop) {
    const shop = npc.shop;
    const quest = questChoices(state, npcId, hooks);
    if (quest?.choices) return quest;
    const lines = [SHOP_GREETING[npcId] ?? '어서 오세요.'];
    const extra = quest ? quest.pages : [];
    return {
      pages: [...pages(npcId, lines), ...extra],
      choices: [
        { label: '물건을 산다', action: () => hooks.openShop(shop, 'buy') },
        { label: '물건을 판다', action: () => hooks.openShop(shop, 'sell') },
        { label: '그만둔다', action: () => undefined },
      ],
    };
  }

  if (npcId === 'guard' && state.data.flags.gateOpen) {
    return { pages: pages(npcId, ['봉인은 풀렸소. 신단수 숲은 위험하니 약초를 넉넉히 챙기시오.']) };
  }

  const quest = questChoices(state, npcId, hooks);
  if (quest) return quest;

  if (npcId === 'chief' && state.data.flags.bossCleared) {
    return { pages: pages(npcId, ['동방에 봄이 돌아왔다. 남방 적염으로 가는 절기문은 다음에 열릴 게다.', '(다음 업데이트에서 이야기가 이어집니다.)']) };
  }
  return { pages: pages(npcId, IDLE[npcId] ?? ['...']) };
}

export const BARKS: Record<string, string[]> = {
  kid: ['헤헤!', '도깨비 무서워~', '오늘 일진이 좋대요!'],
  grocer: ['약초 사시오~', '영약 있소~'],
  smith: ['땅! 땅!', '좋은 쇠가 들어왔네'],
  tailor: ['새 비단 들어왔어요~'],
  chief: ['흠...', '신단수가 걱정이로구나'],
  cheongsol: ['...', '바람이 목 기운을 품었군'],
  guard: ['숲은 위험하오'],
};
