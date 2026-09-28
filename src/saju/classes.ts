import type { Element } from './ganji';

export interface JobClass {
  stem: string; // 일간 (한글)
  name: string;
  element: Element;
  description: string;
}

// 60갑자 일주 클래스 체계 초안의 천간(일간) 기준 직업 — design/60gapja_ilju_classes.xlsx
export const JOB_CLASSES: Record<string, JobClass> = {
  갑: { stem: '갑', name: '청림기사', element: '목', description: '돌격 탱커' },
  을: { stem: '을', name: '덩굴술사', element: '목', description: '제어' },
  병: { stem: '병', name: '태양술사', element: '화', description: '광역딜' },
  정: { stem: '정', name: '등불궁사', element: '화', description: '원거리 단일딜' },
  무: { stem: '무', name: '산악수호자', element: '토', description: '방벽 탱커' },
  기: { stem: '기', name: '대지치유사', element: '토', description: '힐러' },
  경: { stem: '경', name: '무쇠무사', element: '금', description: '브루저' },
  신: { stem: '신', name: '백은검객', element: '금', description: '암살' },
  임: { stem: '임', name: '해류도사', element: '수', description: '광역 제어' },
  계: { stem: '계', name: '안개무녀', element: '수', description: '버퍼·은신' },
};

export function jobClassFor(dayStemHangul: string): JobClass {
  const c = JOB_CLASSES[dayStemHangul];
  if (!c) throw new Error(`알 수 없는 일간: ${dayStemHangul}`);
  return c;
}
