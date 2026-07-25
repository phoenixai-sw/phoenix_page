export const RATIOS = { "9:16": 9 / 16, "4:5": 4 / 5, "1:1": 1 } as const;
export type RatioKey = keyof typeof RATIOS;

// gpt-image-2 지원 size 실측 전 기본값(1024x1792 미지원 가정). 실측 후 갱신.
export function openAIImageSizeForRatio(ratio: string): string {
  if (ratio === "1:1") return "1024x1024";
  return process.env.OPENAI_IMAGE_SIZE || "1024x1536";
}

// 캔버스 대비 목표 비율의 안전 영역 비율 계산 (size가 바뀌어도 자동 대응)
export function safeAreaForRatio(ratio: string, canvas = openAIImageSizeForRatio(ratio)) {
  const [w, h] = canvas.split("x").map(Number);
  const canvasRatio = w / h;
  const target = RATIOS[ratio as RatioKey] ?? 9 / 16;
  if (canvasRatio > target) {
    const widthPct = Math.floor((target / canvasRatio) * 100); // 9:16@2:3 → 84
    return { axis: "horizontal" as const, pct: widthPct };
  }
  if (canvasRatio < target) {
    const heightPct = Math.floor((canvasRatio / target) * 100); // 4:5@2:3 → 83
    return { axis: "vertical" as const, pct: heightPct };
  }
  return { axis: "none" as const, pct: 100 };
}

function bleedRule(ratio: string): string {
  const sa = safeAreaForRatio(ratio);
  if (sa.axis === "horizontal") {
    const edgePct = Math.ceil((100 - sa.pct) / 2);
    return [
      `[중요-레이아웃 규칙] 최종 출력은 캔버스 중앙 세로 기준 폭 ${sa.pct}% 영역만 사용된다(좌우 각 ${edgePct}%는 잘려나감).`,
      `텍스트·로고·번호·배지·아이콘은 물론 캐릭터, 일러스트, 다이어그램, 리본, 장식 요소까지 모든 시각 요소를 반드시 중앙 ${sa.pct}% 폭 안에 배치하라.`,
      "좌우 가장자리 영역에는 배경색·배경 패턴·그라데이션만 자연스럽게 연장하라(bleed). 어떤 글자나 그래픽도 이 여백에 걸치면 안 된다.",
      `[여백 일관성 규칙] 콘텐츠 블록은 중앙 ${sa.pct}% 영역 안에서도 좌우에 일정한 안쪽 여백을 확보해, 같은 시리즈의 다른 페이지들과 동일한 콘텐츠 폭으로 정돈되어 보이게 하라. 콘텐츠를 안전 영역 경계까지 꽉 채우지 마라.`
    ].join(" ");
  }
  if (sa.axis === "vertical") {
    const edgePct = Math.ceil((100 - sa.pct) / 2);
    return [
      `[중요-레이아웃 규칙] 최종 출력은 캔버스 중앙 가로 기준 높이 ${sa.pct}% 영역만 사용된다(상하 각 ${edgePct}%는 잘려나감).`,
      `텍스트는 물론 캐릭터, 일러스트, 다이어그램, 장식 요소까지 모든 시각 요소를 중앙 ${sa.pct}% 높이 안에 배치하고, 상하 가장자리에는 배경만 연장하라(bleed).`,
      "[여백 일관성 규칙] 콘텐츠 블록은 안전 영역 안에서도 상하에 일정한 안쪽 여백을 확보해, 같은 시리즈의 다른 페이지들과 동일하게 정돈되어 보이게 하라."
    ].join(" ");
  }
  return "";
}

// generate(신규 생성) 경로용 비율 지시문
export function ratioPromptInstruction(ratio: string): string {
  if (ratio === "1:1") {
    return "1:1 정사각형 이미지 1장을 생성한다. 썸네일, 카드뉴스, 보조 이미지에 맞게 제품과 핵심 혜택 1개가 중앙에서 빠르게 읽히도록 구성한다.";
  }
  if (ratio === "4:5") {
    return "4:5 세로 피드형 이미지 1장을 생성한다. 광고/SNS 피드 소재에 맞게 제품 이미지와 짧은 카피를 여유 있게 배치하고, 9:16 상세페이지처럼 너무 길게 만들지 않는다.\n" + bleedRule(ratio);
  }
  return "9:16 세로형 상세페이지 섹션 이미지 1장을 생성한다. 모바일 상세페이지 본문에 맞게 위에서 아래로 읽히는 정보 흐름을 구성한다.\n" + bleedRule(ratio);
}

// edit-section(개별 수정) 경로용 비율 지시문
export function ratioEditPromptInstruction(ratio: string): string {
  if (ratio === "1:1") {
    return "RATIO_RULE: keep the edited image as a 1:1 square composition for thumbnails, card news, and supporting product images.";
  }
  if (ratio === "4:5") {
    return "RATIO_RULE: keep the edited image as a 4:5 vertical feed composition for ads and social feed assets, not a long 9:16 detail page.\n" + bleedRule(ratio);
  }
  return "RATIO_RULE: keep the edited image as a 9:16 vertical detail-page section for mobile commerce detail pages.\n" + bleedRule(ratio);
}
