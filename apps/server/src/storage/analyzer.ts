import { OpenAI } from "openai";
import { JSDOM } from "jsdom";
import { StorageService } from "./service";
import * as path from "node:path";

/** Wikimedia и др. блокируют анонимные/дефолтные клиенты; см. meta.wikimedia.org/wiki/User-Agent_policy */
function imageFetchUserAgent(): string {
    const custom = process.env.HTTP_IMAGE_USER_AGENT?.trim();
    if (custom) {
        return custom;
    }
    return `Personae/1.0 (Node.js ${process.version}; local book analysis)`;
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryAfterMs(res: Response): number {
    const h = res.headers.get("retry-after");
    if (h) {
        const sec = parseInt(h, 10);
        if (!Number.isNaN(sec)) {
            return Math.min(sec * 1000, 120_000);
        }
    }
    return 2000 + Math.floor(Math.random() * 1500);
}

function isWikimediaUploadUrl(url: string): boolean {
    try {
        const h = new URL(url).hostname;
        return h === "upload.wikimedia.org" || h.endsWith(".wikimedia.org");
    } catch {
        return false;
    }
}

/** При 404 на upload.wikimedia.org запрашиваем канонический URL файла через API Commons. */
async function resolveCommonsImageUrlFromUpload404(uploadUrl: string): Promise<string | null> {
    try {
        if (!isWikimediaUploadUrl(uploadUrl)) {
            return null;
        }
        const u = new URL(uploadUrl);
        const base = decodeURIComponent(path.basename(u.pathname));
        if (!base || !/\.(jpe?g|png|gif|webp|svg)$/i.test(base)) {
            return null;
        }
        const title = `File:${base}`;
        const api = new URL("https://commons.wikimedia.org/w/api.php");
        api.searchParams.set("action", "query");
        api.searchParams.set("format", "json");
        api.searchParams.set("prop", "imageinfo");
        api.searchParams.set("iiprop", "url");
        api.searchParams.set("titles", title);
        const r = await fetch(api.toString(), {
            headers: { "User-Agent": imageFetchUserAgent(), Accept: "application/json" },
        });
        if (!r.ok) {
            return null;
        }
        const j = (await r.json()) as {
            query?: { pages?: Record<string, { missing?: string; imageinfo?: { url?: string }[] }> };
        };
        const pages = j.query?.pages;
        if (!pages) {
            return null;
        }
        const page = Object.values(pages)[0];
        if (!page || page.missing !== undefined || !page.imageinfo?.[0]?.url) {
            return null;
        }
        const direct = page.imageinfo[0].url;
        return typeof direct === "string" ? direct : null;
    } catch {
        return null;
    }
}

/**
 * Загрузка с учётом 429/503 и 404 (Commons API). Не читает тело ответа — только метаданные до успешного ответа.
 */
async function fetchRemoteImageResponse(imageUrl: string, timeoutMs: number): Promise<{ res: Response; urlUsed: string } | null> {
    let url = imageUrl.trim();
    let triedCommonsResolve = false;
    const maxRounds = 10;

    for (let i = 0; i < maxRounds; i++) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        let res: Response;
        try {
            res = await fetch(url, {
                method: "GET",
                redirect: "follow",
                signal: controller.signal,
                headers: {
                    Accept: "*/*",
                    "User-Agent": imageFetchUserAgent(),
                },
            });
        } catch {
            clearTimeout(timer);
            await sleep(1200 + i * 400);
            continue;
        } finally {
            clearTimeout(timer);
        }

        if (res.ok) {
            return { res, urlUsed: url };
        }

        const status = res.status;
        await res.arrayBuffer().catch(() => {});

        if (status === 429 || status === 503 || status === 502) {
            await sleep(parseRetryAfterMs(res) + i * 400);
            continue;
        }

        if (status === 404 && isWikimediaUploadUrl(url) && !triedCommonsResolve) {
            triedCommonsResolve = true;
            const alt = await resolveCommonsImageUrlFromUpload404(url);
            if (alt) {
                const same = alt === url;
                url = alt;
                await sleep(same ? 2000 : 500);
                continue;
            }
        }

        return null;
    }
    return null;
}

/** JSON Schema для Structured Outputs (Responses API: text.format). */
const PERSONAE_RESULT_JSON_SCHEMA = {
    type: "object",
    additionalProperties: false,
    required: ["entities"],
    properties: {
        entities: {
            type: "array",
            items: {
                type: "object",
                additionalProperties: false,
                required: ["name", "aliases", "description", "relations", "historicalLikelihood"],
                properties: {
                    name: { type: "string" },
                    aliases: { type: "array", items: { type: "string" } },
                    description: { type: "string" },
                    historicalLikelihood: {
                        type: "integer",
                        minimum: 0,
                        maximum: 100,
                    },
                    relations: {
                        type: "array",
                        items: {
                            type: "object",
                            additionalProperties: false,
                            required: ["name", "description"],
                            properties: {
                                name: { type: "string" },
                                description: { type: "string" },
                            },
                        },
                    },
                },
            },
        },
    },
} as const;

/** Схема ответа веб-поиска: только корневой object + поля в properties (без вложенной «схемы внутри properties»). */
const WEB_SEARCH_RESULT_JSON_SCHEMA = {
    type: "object",
    additionalProperties: false,
    required: ["summary", "sources", "imageUrls"],
    properties: {
        summary: { type: "string" },
        sources: {
            type: "array",
            items: {
                type: "object",
                additionalProperties: false,
                required: ["title", "url"],
                properties: {
                    title: { type: "string" },
                    url: { type: "string" },
                },
            },
        },
        imageUrls: { type: "array", items: { type: "string" } },
    },
} as const;
type Chunk = {
    text: string;
    minChunk: number;
    maxChunk: number;
    index: number;
    count: number;
};

/** Длительность для лога: hh.mm.ss (по целым секундам). */
function formatDurationForLog(ms: number): string {
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    const s = totalSec % 60;
    const totalMin = Math.floor(totalSec / 60);
    const m = totalMin % 60;
    const h = Math.floor(totalMin / 60);
    const p = (n: number) => n.toString().padStart(2, "0");
    return `${p(h)}.${p(m)}.${p(s)}`;
}

/** Строчные русские буквы → латиница (для стабильных ключей). */
const CYR_TO_LAT: Record<string, string> = {
    а: "a",
    б: "b",
    в: "v",
    г: "g",
    д: "d",
    е: "e",
    ё: "e",
    ж: "zh",
    з: "z",
    и: "i",
    й: "y",
    к: "k",
    л: "l",
    м: "m",
    н: "n",
    о: "o",
    п: "p",
    р: "r",
    с: "s",
    т: "t",
    у: "u",
    ф: "f",
    х: "h",
    ц: "ts",
    ч: "ch",
    ш: "sh",
    щ: "shch",
    ъ: "",
    ы: "y",
    ь: "",
    э: "e",
    ю: "yu",
    я: "ya",
};

function hashCode(s: string): string {
    const lower = (s || "").trim().toLowerCase();
    let t = "";
    for (const ch of lower) {
        const lat = CYR_TO_LAT[ch];
        if (lat !== undefined) {
            t += lat;
        } else if (/[a-z0-9]/.test(ch)) {
            t += ch;
        } else {
            t += "_";
        }
    }
    return t.replace(/_+/g, "_").replace(/^_|_$/g, "");
}

const WRONG_ALIASES = new Set<string>(
    `
    он она оно они
    его ее их ему ей им ею
    нем ней них ним ними
    него нее него ней
    меня мне мной мною
    тебя тебе тобой тобою
    нас нам нами
    вас вам вами
    мы вы ты я
    мой моя мое мои мою моим моими моем моему
    твой твоя твое твои твою твоим твоими твоем твоему
    наш наша наше наши нашу нашим нашими нашем нашему
    ваш ваша ваше ваши вашу вашим вашими вашем вашему
    свой своя свое свои свою своим своими своем своему своего своей
    себя себе собой собою
    кто что кого чего кому чем кем чем ком чем
    который которая которое которые которого которой которому которым которых
    какой какая какое какие
    чей чья чье чьи
    никто ничто никого ничего
    ктото что-то кое-кто кое-что
    это эта этот эти
    тот та то те
    такой такая такое такие
    столько сколько
    сам сама сами само саму самим самих самом
    весь вся все всего всей всем всеми
    иной иная иное иные
    другой другая другое другие
    один одна одно одни одну одним одних
    какойто какаято какоето какието
    ктото чтото
    лишь
    тут там туто
    здесь
    куда
    откуда
    где
    туда
    сюда
    оттуд
    отиуд
    почему
    зачем
    отчего
    `
        .trim()
        .split(/\s+/)
        .map((s) => hashCode(s)),
);

function mergeHistoricalLikelihood(target: any, incoming: any): void {
    target.historicalLikelihood = Math.max(target.historicalLikelihood, incoming.historicalLikelihood);
}

export class Analyzer {
    private openai: OpenAI;
    constructor() {
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
            baseURL: process.env.OPENAI_API_BASE,
            defaultHeaders: {
                "OpenAI-Project": process.env.OPENAI_API_PROJECT,
            },
        });
    }
    private getInstructions(): string {
        return `
            Ты анализатор художественного текста.
            Твоя задача: извлечь всех персонажей-людей, сгруппировать все упоминания одного и того же человека в один объект и описать связи.

            Правила:
            - Работай только по переданному фрагменту текста.
            - Ничего не выдумывай; если не уверен, не добавляй.
            - Верни ответ строго по заданной JSON-схеме.

            - Персонажи это люди, которые упоминаются в тексте по именам, отчествам, фамилиям, прозвищам. 
            - Персонажи могут быть упомянуты в разных падежах, склонениях, родах, числах. Обязательно нужно запомнить все варианты упоминания одного и того же персонажа.
            - Прозвище должно однозначно соответствовать человеку, которого оно обозначает. При сомнении такое обозначение не используй.
            - Упоминание персонажей сделанные через местоимения не являются не нужно запоминать.
            - Из всех упоминаний одного и того же персонажа определи каноническое имя в именительном падеже, по возможности максимально полное, по правилам русского языка.
                        
            - Сгруппируй разные именные упоминания одного и того же человека в один объект.
            - Упоминания персонажей могут иметь разные падежи, склонения, род, число — включай все именные формы из фрагмента.
            - В aliases перечисли все варианты имени, отчества, фамилии и устойчивого прозвища в том виде, именно так как они встречаются в исходном фрагменте.
            - В aliases не должно быть дубликатов одной и той же строки (одинаковый вариант имени или прозвища).
            - Сделай литературное описание персонажа по тексту до 100 слов.
            - Обязательно сформируй список связанных персонажей. Нужно понять тип отношений между персонажами: жена, любовник, вместе пьют кофе, вместе учатся, вместе работают и т.д. 
            - Соседство имён в тексте не означает связи между персонажами.
            - Связи добавляй только если они явно следуют из текста.
            - Дай литературное описание связи между персонажами по тексту до 100 слов.

            Вот расшифровка свойств в JSON схеме:
            - entities - массив объектов персонажей.
            - name - каноническое имя персонажа в именительном падеже.
            - aliases - упоминания персонажей как в тексте имён.
            - description - характеристика персонажа между персонажами по тексту  до 100 слов.
            - relations - список связанных персонажей.
            - relations[].name - каноническое имя персонажа с которым есть связь
            - relations[].description - характеристика связи между персонажами по тексту до 100 слов, характеристика не должна содержать имени персонажа с которым есть связь.
            - historicalLikelihood - целое 0..100: по смыслу «насколько вероятно, что персонаж — реальная историческая личность или явно на такой основан». Смотри только на этот фрагмент; не требуй доказательств извне текста.
                - Ориентиры (ничего строгого): типичный вымышленный герой без исторической отсылки — примерно 0–30. Обычный персонаж в историческом или бытовом контексте без явного имени из учебника — 25–55. Есть опора на эпоху, должности, известные события или фамилии того времени — 45–75. Текст прямо или однозначно указывает на реального исторического деятеля — 70–100. Не занижай без оснований: в художественном тексте история и вымысел часто смешаны, умеренные и средние значения нормальны.
                - Смотри на связи если персонажи связаны семейными отношениями или любовными отношениями, то вероятность исторического персонажа берется по максимуму для обоих персонажей.


            Исходный текст на русском языке. В ответе используй только русский язык.
        `;
    }
    private getPrompt(source: string): string {
        return `
            Проанализируй текст в соответствии с инструкциями. 

            Текст:
            ${source}
        `;
    }
    private getMergeInstructions(): string {
        return `
            Ты анализатор художественного текста.
            Твоя задача: по описанию двух персонажей определить являются ли они одним и тем же персонажем.
            Правила:
            - Работай только по переданному фрагменту текста.
            - Ничего не выдумывай; если не уверен, не добавляй.
            - Персонажи могут иметь разные имена. Но это не значит что они являются разными персонажами.
            - Проанализируй варианты упоминаний персонажей и их характеристик.
            - Верни ответ строго как число от 0 до 100, соответствующее вероятности того, что это один и тот же персонаж, где 0 - это точно разные персонажи, 100 - это точно один и тот же персонаж.
        `;
    }
    private getMergePrompt(entity1: any, entity2: any): string {
        return `
        Проанализируй текст в соответствии с инструкциями. 

        Персонаж 1:
            Имя: ${entity1.name}
            Упомянут как: ${entity1.aliases.map((a: any) => a.alias).join(", ")}
            Характеристика: ${entity1.description}
        Персонаж 2:
            Имя: ${entity2.name}
            Упомянут как: ${entity2.aliases.map((a: any) => a.alias).join(", ")}
            Характеристика: ${entity2.description}
        `;
    }
    private getMergeDescriptionInstructions(): string {
        return `
            Ты анализатор художественного текста.
            Твоя задача: литературно переформулировать представленное описание.
            Правила:
            - Работай только по переданному фрагменту текста.
            - Ничего не выдумывай; если не уверен, не добавляй.
            - Описание может содержать повторы слов и фраз. Убери повторы.
            - Верни ответ строго как текст.
        `;
    }
    private getMergeDescriptionPrompt(description: string): string {
        return `
            Проанализируй текст в соответствии с инструкциями. 

            Текст:
            ${description}
        `;
    }
    private getWebSearchInstructions(): string {
        return `
        Ищи в интернете только проверяемые факты.
        Не придумывай ссылки и URL картинок — только то, что реально встретилось в результатах поиска.
        Если не уверен — пиши осторожно и указывай источники.

        Поиск картинок (imageUrls) — отдельная задача:
        - Сделай минимум один явный поиск, ориентированный на изображения: запросы вроде
          «имя + portrait», «имя + photo», «имя фото портрет», для исторических лиц — также
          запрос по англоязычному имени и словам wikipedia, wikimedia, commons.
        - Предпочитай стабильные прямые ссылки на файлы изображений (https, часто .jpg / .jpeg / .png / .webp)
          и материалы Wikimedia Commons / иллюстрации из Википедии; избегай главных страниц поисковиков и голых HTML-страниц без картинки.
        - В imageUrls попадают только URL, по которым в браузере открывается именно файл или явная картинка; не дублируй один и тот же снимок.
        - До 3 разных изображений из разных источников, если находятся.

        Верни ответ строго как JSON-объект с полями:
        - summary — краткое описание персонажа по материалам в интернете
        - sources — массив источников, не больше 3 пунктов (title + url)
        - imageUrls — массив URL изображений, не больше 3
        - Дополнительное описание персонажа используй только как подсказку для формулировки поисковых запросов, не копируй его в summary дословно.
        - Текст в summary и в полях sources (title) — на русском языке.
        `;
    }
    /** Ограничение длины описания в запросе web search: иначе вход переполняет контекст и API даёт max_tokens < 1. */
    private truncateTextForWebSearchContext(text: string): string {
        const raw = process.env.WEB_SEARCH_DESCRIPTION_MAX_CHARS ?? "8000";
        const maxChars = Math.max(1000, parseInt(raw, 10) || 8000);
        const t = String(text ?? "").trim();
        if (t.length <= maxChars) {
            return t;
        }
        return `${t.slice(0, maxChars)}\n\n[… фрагмент обрезан: полное описание слишком длинное для запроса поиска]`;
    }

    private getWebSearchPrompt(entity: any): string {
        const desc = this.truncateTextForWebSearchContext(entity.description ?? "");
        return `
        Произведи поиск в интернете в соответствии с инструкциями.

        Персонаж: ${entity.name}
        Дополнительное описание (для контекста запросов): ${desc}

        Шаги: (1) факты и статьи для summary и sources; (2) отдельно — поиск иллюстраций
        (портрет, фото, гравюра, Wikimedia Commons / Википедия, при необходимости запрос на английском).
        `;
    }

    /** Параметры встроенного web_search: меньше объём выдачи — иначе API режет ответ (лимит ~640k символов на генерацию). */
    private getWebSearchToolSpec(): { type: "web_search"; search_context_size: "low" | "medium" | "high" } {
        const raw = (process.env.WEB_SEARCH_CONTEXT_SIZE ?? "low").toLowerCase();
        const search_context_size = raw === "medium" || raw === "high" ? raw : "low";
        return { type: "web_search", search_context_size };
    }
    private *getChunks(source: string): Generator<Chunk> {
        let chunkSize = parseInt(process.env.CHUNK_SIZE ?? "20000");
        let chunkOverlap = parseInt(process.env.CHUNK_OVERLAP ?? "2000");
        let chunkStart = 0;
        let maxIndex = 0;

        const dom = new JSDOM(source);
        const chunks = [...dom.window.document.querySelectorAll("span[chunk]")] as Element[];
        while (maxIndex < chunks.length - 1) {
            let minChunk = Number.MAX_SAFE_INTEGER;
            let maxChunk = 0;
            let result = chunks
                .filter((c, i) => {
                    const l = parseInt(c.getAttribute("chunk") ?? "0");
                    const s = Math.max(chunkStart - chunkOverlap, 0);
                    const e = s + chunkSize;
                    const f = l >= s && l < e;
                    if (f) {
                        maxIndex = i;
                        minChunk = Math.min(minChunk, l);
                        maxChunk = Math.max(maxChunk, l);
                    }
                    return f;
                })
                .map((c) => {
                    chunkStart = Math.max(parseInt(c.getAttribute("chunk") ?? "0") + 1, chunkStart);
                    return c.textContent;
                })
                .join("\n");
            yield { text: result, minChunk, maxChunk, index: maxIndex + 1, count: chunks.length };
        }
        return;
    }
    mergeResult(result: any, promptResult: any, minChunk: number, maxChunk: number): any {
        for (const entity of promptResult.entities) {
            const existingEntity = result.entities.find((e: any) => hashCode(e.name) === hashCode(entity.name));
            if (existingEntity) {
                if (!existingEntity.description.includes(entity.description)) existingEntity.description += "\n" + entity.description;
                mergeHistoricalLikelihood(existingEntity, entity);
                for (const alias of entity.aliases) {
                    const aliasStr = typeof alias === "string" ? alias : alias.alias;
                    if (
                        !existingEntity.aliases.find((a: any) => hashCode(a.alias) === hashCode(aliasStr) && a.minChunk === minChunk && a.maxChunk === maxChunk)
                    ) {
                        existingEntity.aliases.push({ alias: aliasStr, minChunk, maxChunk });
                    }
                }
                for (const relation of entity.relations) {
                    const existingRelation = existingEntity.relations.find((r: any) => hashCode(r.name) === hashCode(relation.name));
                    if (existingRelation) {
                        if (!existingRelation.description.includes(relation.description)) existingRelation.description += "\n" + relation.description;
                    } else {
                        existingEntity.relations.push({
                            name: relation.name,
                            description: relation.description,
                        });
                    }
                }
            } else {
                const aliases: any[] = [];
                for (const alias of entity.aliases) {
                    const aliasStr = typeof alias === "string" ? alias : alias.alias;
                    if (!aliases.find((a: any) => hashCode(a.alias) === hashCode(aliasStr) && a.minChunk === minChunk && a.maxChunk === maxChunk)) {
                        aliases.push({ alias: aliasStr, minChunk, maxChunk });
                    }
                }
                entity.aliases = aliases;
                result.entities.push(entity);
            }
        }
        return result;
    }

    async analyze(storageService: StorageService, bookId: string, source: string, result: any): Promise<any> {
        //result = {};
        result = result ?? {};
        result.entities = result.entities ?? [];
        result.chunks = result.chunks ?? [];

        // Analyze text
        if (!result.analyze) {
            console.log(`Start analyze: ${source.length} characters`);
            for (const chunk of this.getChunks(source)) {
                if (result.chunks.includes(chunk.minChunk)) continue;

                const response = await this.responseAI({
                    name: "Analyze chunk",
                    storageService,
                    bookId,
                    instructions: this.getInstructions(),
                    prompt: this.getPrompt(chunk.text),
                    debugResultName: `chunk_${chunk.index}.json`,
                    jsonSchema: PERSONAE_RESULT_JSON_SCHEMA,
                    jsonSchemaFormatName: "personae_characters",
                });
                console.log(`${chunk.index}(${chunk.count})`);
                this.mergeResult(result, response, chunk.minChunk, chunk.maxChunk);
                result.chunks.push(chunk.minChunk);
            }

            result.entities.forEach((entity: any, index: number) => {
                entity.id = index;
            });

            result.model = process.env.OPENAI_API_MODEL;
            result.analyze = true;
            await storageService.setResult(bookId, result, "json");
            console.log(`${result.entities.length} entities found`);
            console.log(`End analyze`);
        }
        // Merge entities
        if (!result.merged) {
            console.log(`Start merge`);

            const wrongAliases = new Set<string>();
            result.entities.forEach((entity: any) => {
                const goodAliases: any[] = [];
                entity.aliases.forEach((alias: any) => {
                    if (WRONG_ALIASES.has(hashCode(alias.alias))) {
                        wrongAliases.add(alias.alias);
                    } else {
                        if (!goodAliases.find((a: any) => a.alias === alias.alias && a.minChunk === alias.minChunk && a.maxChunk === alias.maxChunk)) {
                            goodAliases.push({ alias: alias.alias, minChunk: alias.minChunk, maxChunk: alias.maxChunk });
                        }
                    }
                });
                entity.aliases = goodAliases;
            });
            if (wrongAliases.size > 0) {
                console.log(`${wrongAliases.size} wrong aliases found`);
                console.log(Array.from(wrongAliases).join(", "));
            }

            const candidates = this.getMergeCandidates(result);

            if (candidates.length > 0) {
                for (const candidate of candidates) {
                    let mainIndex: number = candidate.shift() ?? -1;
                    if (candidate.length > 1) {
                        candidates.push(candidate.slice(0));
                    }
                    while (candidate.length > 0) {
                        let altIndex: number = candidate.shift() ?? -1;
                        const response = await this.responseAI({
                            name: "Merge entities",
                            storageService,
                            bookId,
                            instructions: this.getMergeInstructions(),
                            prompt: this.getMergePrompt(result.entities[mainIndex], result.entities[altIndex]),
                            debugResultName: `merge_${mainIndex}_${altIndex}.json`,
                        });
                        if (parseInt(response) > 50) {
                            console.log(`${result.entities[mainIndex].name} and ${result.entities[altIndex].name} are merged`);
                            this.mergeEntities(result, mainIndex, altIndex);
                        } else {
                            console.log(`${result.entities[mainIndex].name} and ${result.entities[altIndex].name} are not merged`);
                        }
                    }
                }
                const entities: any[] = [];
                result.entities.forEach((entity: any) => {
                    if (!entities.find((e: any) => e.id === entity.id)) {
                        entities.push(entity);
                    }
                });
                result.entities = entities;
            }
            result.merged = true;
            await storageService.setResult(bookId, result, "json");
            console.log(`End merge`);
        }
        // Merge description
        if (!result.description) {
            console.log(`Start merge description`);
            for (const entity of result.entities) {
                if (entity.description.split("\n").length > 1) {
                    const response = await this.responseAI({
                        name: "Merge description",
                        storageService,
                        bookId,
                        instructions: this.getMergeDescriptionInstructions(),
                        prompt: this.getMergeDescriptionPrompt(entity.description),
                        debugResultName: `merge_description_${entity.id}.json`,
                    });
                    entity.description = response;
                    console.log(`${entity.name} description merged`);
                    for (const relation of entity.relations) {
                        if (relation.description.split("\n").length > 1) {
                            const response = await this.responseAI({
                                name: "Merge relation description",
                                storageService,
                                bookId,
                                instructions: this.getMergeDescriptionInstructions(),
                                prompt: this.getMergeDescriptionPrompt(relation.description),
                                debugResultName: `merge_relation_description_${entity.id}_${hashCode(relation.name)}.json`,
                            });
                            relation.description = response;
                            console.log(`${entity.name} relation ${relation.name} description merged`);
                        }
                    }
                }
            }
            result.description = true;
            await storageService.setResult(bookId, result, "json");
            console.log(`End merge description`);
        }
        //Web search
        if (!result.webSearch) {
            console.log(`Start web search`);
            for (const entity of result.entities.slice(0, 10)) {
                if (entity.historicalLikelihood > 0) {
                    const response = await this.responseAI({
                        name: "Web search",
                        storageService,
                        bookId,
                        instructions: this.getWebSearchInstructions(),
                        prompt: this.getWebSearchPrompt(entity),
                        debugResultName: `web_search_${hashCode(entity.name)}.json`,
                        jsonSchema: WEB_SEARCH_RESULT_JSON_SCHEMA,
                        jsonSchemaFormatName: "personae_web_search",
                        tools: [this.getWebSearchToolSpec()],
                    });
                    entity.webSearch = response;
                }
                console.log(`${entity.name} web search completed`);
            }
            result.webSearch = true;
            await storageService.setResult(bookId, result, "json");
            console.log(`End web search`);
        }
        // Download images
        //if (!result.downloadImages) {
        console.log(`Start download images`);
        for (const entity of result.entities) {
            await this.downloadImage(bookId, storageService, entity);
            console.log(`${entity.name} image downloaded`);
        }
        result.downloadImages = true;
        await storageService.setResult(bookId, result, "json");
        console.log(`End download images`);
        //}
        return Promise.resolve(result);
    }
    async responseAI({
        name,
        storageService,
        bookId,
        instructions,
        prompt,
        debugResultName,
        jsonSchema = null,
        jsonSchemaFormatName = "personae_json",
        tools = null,
    }: {
        name: string;
        storageService: StorageService;
        bookId: string;
        instructions: string;
        prompt: string;
        debugResultName: string;
        jsonSchema?: any;
        jsonSchemaFormatName?: string;
        tools?: any;
    }): Promise<string | any> {
        const moneySavingMode = process.env.MONEY_SAVING_MODE === "true";
        let text: string | undefined = undefined;
        if (moneySavingMode) {
            text = await storageService.getDebugData(bookId, debugResultName);
        }
        if (!text) {
            try {
                const maxOutRaw = process.env.OPENAI_MAX_OUTPUT_TOKENS ?? "8192";
                const maxOutputTokens = Math.max(1, parseInt(maxOutRaw, 10) || 8192);
                const req: any = {
                    model: process.env.OPENAI_API_MODEL,
                    instructions: instructions,
                    input: [{ role: "user" as const, content: [{ type: "input_text" as const, text: prompt }] }],
                    temperature: 0.0,
                    max_output_tokens: maxOutputTokens,
                };
                if (jsonSchema) {
                    req.text = {
                        format: {
                            type: "json_schema" as const,
                            name: jsonSchemaFormatName,
                            strict: true,
                            schema: jsonSchema,
                        },
                    };
                }
                if (tools) {
                    req.tools = tools;
                    const mtc = parseInt(process.env.WEB_SEARCH_MAX_TOOL_CALLS ?? "5", 10);
                    const cap = Number.isFinite(mtc) && mtc > 0 ? Math.min(mtc, 12) : 5;
                    req.max_tool_calls = cap;
                    req.parallel_tool_calls = false;
                }
                const response = await this.openai.responses.create(req);
                if (response.error) {
                    console.error(`${name} (response error): ${response.error.message}`);
                    throw new Error(`${name} (response error): ${response.error.message}`);
                }
                text = response.output_text.replaceAll("```json", "").replaceAll("```", "").trim();
            } catch (error) {
                console.error(`${name} (response error): ${error.message}`);
                throw new Error(`${name} (response error): ${error.message}`);
            }
            if (moneySavingMode && text !== undefined) {
                await storageService.setDebugData(bookId, debugResultName, text);
            }
        }
        if (text && jsonSchema) {
            try {
                return JSON.parse(text);
            } catch (error) {
                console.error(`${name} (parse error): ${error.message}`);
                throw new Error(`${name} (parse error): ${error.message}`);
            }
        }
        return text;
    }
    getMergeCandidates(result: any): number[][] {
        const candidates: number[][] = [];
        result.entities.forEach((a: any, i: number) => {
            const group = new Set<number>();
            const aNames = a.aliases.map((a: any) => hashCode(a.alias));
            aNames.push(hashCode(a.name));
            result.entities.slice(i + 1).forEach((b: any) => {
                //if (a.name.includes(b.name) || b.name.includes(a.name)) {
                const bNames = b.aliases.map((b: any) => hashCode(b.alias));
                bNames.push(hashCode(b.name));
                const commonNames = aNames.filter((name: string) => bNames.includes(name));
                if (commonNames.length > 0) {
                    group.add(a.id);
                    group.add(b.id);
                    console.log(`${a.name} and ${b.name} will be merged`);
                } else if (hashCode(a.name).split("_").includes(hashCode(b.name)) || hashCode(b.name).split("_").includes(hashCode(a.name))) {
                    group.add(a.id);
                    group.add(b.id);
                    console.log(`${a.name} and ${b.name} will be merged`);
                }
                //}
            });
            if (group.size > 0) {
                candidates.push([...group.values()]);
            }
        });
        return candidates;
    }
    mergeEntities(result: any, mainIndex: number, altIndex: number): void {
        const mainEntity = result.entities[mainIndex];
        const altEntity = result.entities[altIndex];

        // Merge entity
        if (altEntity.name.length > mainEntity.name.length) mainEntity.name = altEntity.name;
        for (const alias of altEntity.aliases) {
            if (
                !mainEntity.aliases.find(
                    (a: any) => hashCode(a.alias) === hashCode(alias.alias) && a.minChunk === alias.minChunk && a.maxChunk === alias.maxChunk,
                )
            ) {
                mainEntity.aliases.push(alias);
            }
        }
        for (const altRelation of altEntity.relations) {
            const existingRelation = mainEntity.relations.find((r: any) => hashCode(r.name) === hashCode(altRelation.name));
            if (existingRelation) {
                if (!existingRelation.description.includes(altRelation.description)) existingRelation.description += "\n" + altRelation.description;
            } else {
                mainEntity.relations.push(altRelation);
            }
        }
        if (!mainEntity.description.includes(altEntity.description)) mainEntity.description += "\n" + altEntity.description;
        mergeHistoricalLikelihood(mainEntity, altEntity);

        // Merge relation rows
        const mainName = mainEntity.name;
        const altName = altEntity.name;
        for (const entity of result.entities) {
            const mainRelationIndex = entity.relations.findIndex((r: any) => hashCode(r.name) === hashCode(mainName));
            const altRelationIndex = entity.relations.findIndex((r: any) => hashCode(r.name) === hashCode(altName));
            if (mainRelationIndex !== -1 && altRelationIndex !== -1) {
                if (altName.length > mainName.length) entity.relations[mainRelationIndex].name = altName;
                if (!entity.relations[mainRelationIndex].description.includes(entity.relations[altRelationIndex].description)) {
                    entity.relations[mainRelationIndex].description += "\n" + entity.relations[altRelationIndex].description;
                }
                entity.relations.splice(altRelationIndex, 1);
            }
        }

        // Replace entity
        result.entities[altIndex] = result.entities[mainIndex];
    }
    async downloadImage(bookId: string, storageService: StorageService, entity: any): Promise<void> {
        const maxBytes = 5 * 1024 * 1024;
        const timeoutMs = 30_000;
        const delayMs = Math.max(0, parseInt(process.env.IMAGE_DOWNLOAD_DELAY_MS ?? "1200", 10) || 1200);
        const ws = entity.webSearch;
        if (ws && ws.imageUrls) {
            ws.download = [];
            const urls = [...ws.imageUrls];
            let first = true;
            for (const imageUrl of urls) {
                if (!first) {
                    await sleep(delayMs);
                }
                first = false;
                try {
                    const got = await fetchRemoteImageResponse(imageUrl, timeoutMs);
                    if (!got) {
                        //console.warn(`download image failed (after retries): ${imageUrl.slice(0, 100)}`);
                        continue;
                    }
                    const { res, urlUsed } = got;
                    const ct = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
                    if (ct === "text/html") {
                        const html = await res.text();
                        const dom = new JSDOM(html);
                        let fn = path.basename(new URL(urlUsed).pathname);
                        if (fn.startsWith("File:")) fn = fn.slice(5);
                        const sources = [...dom.window.document.querySelectorAll("body img")]
                            .map((img: any) => img.src)
                            .filter((s: string) => s.startsWith("http"));
                        const source = sources.find((s: string) => s.includes(fn)) ?? sources[0];
                        if (source) {
                            urls.push(source);
                        }
                        continue;
                    }
                    if (!ct.startsWith("image/")) {
                        //console.warn(`download image skip non-image ${ct}: ${imageUrl.slice(0, 80)}`);
                        continue;
                    }
                    const len = res.headers.get("content-length");
                    if (len && parseInt(len, 10) > maxBytes) {
                        continue;
                    }
                    const ab = await res.arrayBuffer();
                    if (ab.byteLength > maxBytes) {
                        continue;
                    }
                    const buffer = Buffer.from(ab);
                    let extName = path.extname(new URL(urlUsed).pathname).split("?")[0];
                    const fileName = `${ws.download.length + 1}${extName}`;
                    ws.download.push(await storageService.saveDownloadedWebImage(bookId, hashCode(entity.name), fileName, buffer));
                } catch (e: any) {
                    console.warn(`download image skip: ${imageUrl?.slice?.(0, 80) ?? ""} — ${e?.message ?? e}`);
                }
            }
        }
        return Promise.resolve();
    }
}
