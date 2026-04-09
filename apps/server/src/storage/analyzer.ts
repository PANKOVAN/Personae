import { OpenAI } from "openai";
import { JSDOM } from "jsdom";
import { StorageService } from "./service";

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
                required: ["name", "aliases", "description", "relations"],
                properties: {
                    name: { type: "string" },
                    aliases: { type: "array", items: { type: "string" } },
                    description: { type: "string" },
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
function hashCode(s: string): string {
    return (s || "")
        .trim()
        .toLowerCase()
        .replace(/ё/g, "е")
        .replaceAll(/[^a-zа-я0-1]+/g, "_");
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
            - Сделай описание персонажа по тексту до 100 слов.
            - Обязательно сформируй список связанных персонажей. Нужно понять тип отношений между персонажами: жена, любовник, вместе пьют кофе, вместе учатся, вместе работают и т.д. 
            - Соседство имён в тексте не означает связи между персонажами.
            - Связи добавляй только если они явно следуют из текста.
            - Дай описание связи между персонажами по тексту до 100 слов.

            Вот расшифровка свойств в JSON схеме:
            - entities - массив объектов персонажей.
            - name - каноническое имя персонажа в именительном падеже.
            - aliases - упоминания персонажей как в тексте имён.
            - description - характеристика персонажа между персонажами по тексту  до 100 слов.
            - relations - список связанных персонажей.
            - relations[].name - каноническое имя персонажа с которым есть связь
            - relations[].description - характеристика связи между персонажами по тексту до 100 слов, характеристика не должна содержать имени персонажа с которым есть связь.

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
                for (const alias of entity.aliases) {
                    if (
                        !existingEntity.aliases.find(
                            (a: any) => hashCode(a.alias) === hashCode(alias.alias) && a.minChunk === minChunk && a.maxChunk === maxChunk,
                        )
                    ) {
                        existingEntity.aliases.push({ alias: alias, minChunk, maxChunk });
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
                    if (!aliases.find((a: any) => hashCode(a.alias) === hashCode(alias) && a.minChunk === minChunk && a.maxChunk === maxChunk)) {
                        aliases.push({ alias: alias, minChunk, maxChunk });
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

        const debugMode = process.env.DEBUG_MODE === "true";

        // Analyze text
        if (!result.analyze) {
            const start = new Date();
            console.log(`Start analyze: ${source.length} characters`);
            for (const chunk of this.getChunks(source)) {
                if (result.chunks.includes(chunk.minChunk)) continue;

                let text: string | undefined = undefined;
                if (debugMode) {
                    text = await storageService.getDebugData(bookId, `chunk_${chunk.index}.json`);
                }
                if (!text) {
                    const response = await this.openai.responses.create({
                        model: process.env.OPENAI_API_MODEL,
                        instructions: this.getInstructions(),
                        input: [
                            {
                                role: "user",
                                content: [{ type: "input_text", text: this.getPrompt(chunk.text) }],
                            },
                        ],
                        temperature: 0.0,
                        text: {
                            format: {
                                type: "json_schema",
                                name: "personae_characters",
                                strict: true,
                                schema: PERSONAE_RESULT_JSON_SCHEMA,
                            },
                        },
                    });
                    text = response.output_text.replaceAll("```json", "").replaceAll("```", "").trim();
                    if (debugMode) {
                        await storageService.setDebugData(bookId, `chunk_${chunk.index}.json`, text);
                    }
                }
                try {
                    const promptResult = JSON.parse(text || "{}");
                    console.log(`${chunk.index}(${chunk.count})`);
                    this.mergeResult(result, promptResult, chunk.minChunk, chunk.maxChunk);
                } catch (error) {
                    console.error(error.message);
                    throw new Error(error.message);
                }
                result.chunks.push(chunk.minChunk);
            }

            result.entities.forEach((entity: any, index: number) => {
                entity.id = index;
            });

            result.model = process.env.OPENAI_API_MODEL;
            result.duration = new Date().getTime() - start.getTime();
            result.analyze = true;
            await storageService.setResult(bookId, result, "json");
            console.log(`${result.entities.length} entities found`);
            console.log(`End analyze ${formatDurationForLog(result.duration)}`);
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

            for (const candidate of candidates) {
                let mainIndex: number = candidate.shift() ?? -1;
                if (candidate.length > 1) {
                    candidates.push(candidate.slice(0));
                }
                while (candidate.length > 0) {
                    let altIndex: number = candidate.shift() ?? -1;
                    const response = await this.openai.responses.create({
                        model: process.env.OPENAI_API_MODEL,
                        instructions: this.getMergeInstructions(),
                        input: [
                            {
                                role: "user",
                                content: [{ type: "input_text", text: this.getMergePrompt(result.entities[mainIndex], result.entities[altIndex]) }],
                            },
                        ],
                        temperature: 0.0,
                    });
                    const probability = parseInt(response.output_text);
                    if (probability > 50) {
                        console.log(`${result.entities[mainIndex].name} and ${result.entities[altIndex].name} are merged`);
                    } else {
                        console.log(`${result.entities[mainIndex].name} and ${result.entities[altIndex].name} are not merged`);
                    }
                }
            }

            await storageService.setResult(bookId, result, "json");
            console.log(`End merge`);
        }
        return Promise.resolve(result);
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
}
