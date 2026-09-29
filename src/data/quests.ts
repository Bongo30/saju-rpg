export interface QuestDef {
  id: string;
  title: string;
  main: boolean;
  giver: string;
  /** 앞 퀘스트를 끝내야 받을 수 있다 */
  requires?: string;
  goal: { kind: 'kill'; species: string; count: number } | { kind: 'collect'; itemId: string; count: number };
  summary: string;
  offer: string[];
  progressLine: string;
  complete: string[];
  reward: { gold: number; exp: number; items?: Array<{ itemId: string; count: number }>; flag?: string };
}

export const QUESTS: QuestDef[] = [
  {
    id: 'q1',
    title: '들판의 새순 도깨비',
    main: true,
    giver: 'chief',
    goal: { kind: 'kill', species: 'dokkaebi', count: 3 },
    summary: '마을 남쪽 들판의 새순 도깨비 3마리를 물리치자.',
    offer: [
      '오, 네가 오늘 이 세상에 태어났다는 그 아이로구나. 태어난 시각이 곧 너의 운명이니라.',
      '요즘 봄기운이 멈추고 목 기운만 넘쳐서, 들판에 새순 도깨비가 들끓고 있다.',
      '몸도 풀 겸 새순 도깨비 세 마리만 혼내 주겠느냐? 약초 몇 뿌리를 챙겨 주마.',
    ],
    progressLine: '새순 도깨비는 마을 남쪽 들판에 있다. 공격 버튼이나 Space로 싸우거라.',
    complete: ['잘했다! 몸놀림이 제법이구나.', '받거라. 다친 데는 약초로 다스리고, 잡화점에서 더 살 수도 있다.'],
    reward: { gold: 60, exp: 30, items: [{ itemId: 'herb', count: 3 }] },
  },
  {
    id: 'q2',
    title: '가시멧돼지 퇴치',
    main: true,
    giver: 'chief',
    requires: 'q1',
    goal: { kind: 'kill', species: 'boar', count: 3 },
    summary: '들판 깊은 곳의 가시멧돼지 3마리를 물리치면 숲의 봉인을 풀어 준다.',
    offer: [
      '신단수 숲 앞 들판에 가시멧돼지가 날뛰고 있다.',
      '목 기운이 센 놈은 약한 금 공격을 튕겨 낸다더구나. 신단수도 그렇다지.',
      '세 마리를 물리치면 수문장에게 말해 숲의 봉인을 풀어 주마.',
    ],
    progressLine: '가시멧돼지는 들판 한가운데에 있다. 무기점에서 무기를 사 두면 든든할 게다.',
    complete: ['과연! 이제 숲의 봉인을 풀어 주마.', '신단수를 만나거든 기억하거라. 먼저 불로 기운을 빼고, 그다음에 쇠로 쳐라.'],
    reward: { gold: 120, exp: 60, items: [{ itemId: 'fireCharm', count: 1 }], flag: 'gateOpen' },
  },
  {
    id: 'q3',
    title: '신단수의 이변',
    main: true,
    giver: 'chief',
    requires: 'q2',
    goal: { kind: 'kill', species: 'sindansu', count: 1 },
    summary: '숲 깊은 곳의 천년 신단수를 진정시켜 동방의 봄을 되찾자.',
    offer: [
      '천 년 동안 마을을 지켜 준 신단수가 목 기운에 휩쓸려 폭주하고 있다.',
      '신단수를 쓰러뜨리는 것이 아니라, 넘친 기운을 빼서 균형을 되찾아 주는 것이다.',
      '화 기운으로 두 번 설기한 뒤 금 기운으로 쳐라. 부디 조심하거라.',
    ],
    progressLine: '신단수는 숲 가장 깊은 곳에 있다. 화 공격 두 번 → 금 공격!',
    complete: ['봄바람이 다시 부는구나! 네 덕분이다.', '동방의 절기문이 열렸다. 다음 여정은 남방 적염이 될 게다. (다음 업데이트에서 계속)'],
    reward: { gold: 300, exp: 200, flag: 'bossCleared' },
  },
  {
    id: 's1',
    title: '할멈의 이슬 주머니',
    main: false,
    giver: 'grocer',
    goal: { kind: 'collect', itemId: 'dewPouch', count: 2 },
    summary: '이끼 두꺼비에게서 이슬 주머니 2개를 모아 복순 할멈에게 가져가자.',
    offer: [
      '영약을 달이려면 이슬 주머니가 필요한데, 이 늙은이 다리로는 두꺼비를 못 잡는구먼.',
      '들판의 이끼 두꺼비가 이슬 주머니를 품고 있다오. 두 개만 구해 주겠소?',
      '참, 두꺼비는 옆에 있는 나무 기운 몬스터를 치료해 주니 먼저 잡는 게 좋다오.',
    ],
    progressLine: '이끼 두꺼비는 들판 연못가에 있다오.',
    complete: ['아이고, 고맙구먼! 갓 달인 영약을 가져가오.'],
    reward: { gold: 50, exp: 40, items: [{ itemId: 'elixir', count: 4 }] },
  },
  {
    id: 's2',
    title: '대장장이의 쇠깃털',
    main: false,
    giver: 'smith',
    goal: { kind: 'collect', itemId: 'ironFeather', count: 3 },
    summary: '쇠부리 딱따구리의 쇠깃털 3개를 대장장이 쇠돌에게 가져가자.',
    offer: [
      '쇠부리 딱따구리 깃털은 쇠만큼 단단해서 담금질에 쓰기 딱 좋지.',
      '세 개만 가져다주면 내 솜씨로 만든 창을 하나 주겠네.',
      '그놈들은 나무 기운 몬스터를 보면 먼저 쪼아 대니, 싸움을 붙여 보는 것도 방법이지.',
    ],
    progressLine: '딱따구리는 들판 동쪽 숲가에 모여 있네.',
    complete: ['좋은 깃털이군! 약속한 무쇠 창일세.'],
    reward: { gold: 40, exp: 50, items: [{ itemId: 'ironSpear', count: 1 }] },
  },
];

export const QUEST_BY_ID: Record<string, QuestDef> = Object.fromEntries(QUESTS.map((q) => [q.id, q]));
