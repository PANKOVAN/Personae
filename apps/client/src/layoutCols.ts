import type { AppStore } from "./store/appStore";

/** Ширины колонок визуализаторов (md, из 24 вместе с колонкой панели `md={1}`). Сумма = 24. */
export function visualizerColWidths(store: AppStore): { shelf: number; source: number; result: number } {
    const c = store.showContents;
    const r = store.showResult;
    if (c && r) {
        return { shelf: 7, source: 8, result: 8 };
    }
    if (c && !r) {
        return { shelf: 7, source: 16, result: 0 };
    }
    if (!c && r) {
        return { shelf: 0, source: 12, result: 11 };
    }
    return { shelf: 0, source: 23, result: 0 };
}
