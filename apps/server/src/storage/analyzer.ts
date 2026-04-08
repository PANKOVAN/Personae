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

/** Формы без ё — сравнение через norm(). */
const PRONOUN_OR_ANAPHORA = new Set<string>(
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
        .split(/\s+/),
);

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
            Твоя задача: извлечь всех персонажей-людей, сгруппировать алиасы и описать связи.

            Правила:

            - Работай только по переданному фрагменту текста.
            - Ничего не выдумывай; если не уверен, не добавляй.
            - Верни ответ строго по заданной JSON-схеме.

            - Персонажи это люди, которые упоминаются в тексте по именам, отчествам, фамилиям, прозвищам.
            - Прозвище должно однозначно соответствовать человеку, которого оно обозначает. При сомнении такое обозначение не используй.

            Местоимения и подстановки (запрет в структурированных полях):
            - В полях name, aliases и relations[].name НЕЛЬЗЯ указывать местоимения и формы местоимений: он, она, оно, они; я, ты, мы, вы; мой, моя, моё, мои, твой, ваш, наш, свой и т.п.; его, её/ее, их; ему, ей, им, них, нём, ней; кто, что, кого, чего (как замена имени); себя, себе, собой, собою; никто/ничто в роли «безымянного персонажа».
            - Не путай с именами: «ничто» как прозвище в кавычках в тексте может быть алиасом только если в тексте этот персонаж явно так назван; обычная анонимность через «он» в повествовании не считается упоминанием.
            - Если в абзаце фигурирует только местоимение без имени или прозвища, не создавай из этого отдельного персонажа и не добавляй местоимение в aliases.
            - В relations[].name указывай всегда имя/прозвище второго лица так же, как в поле name у соответствующей карточки (канон или повтор из текста), но не местоимение.

            - Сгруппируй разные именные упоминания одного и того же человека в один объект.
            - Упоминания персонажей могут иметь разные падежи, склонения, род, число — включай все именные формы из фрагмента.
            - Из именных форм определи каноническое имя в именительном падеже, по возможности максимально полное, по правилам русского языка.
            - В aliases перечисли все варианты имени, отчества, фамилии и устойчивого прозвища в том виде, как они встречаются в исходном фрагменте (без местоимений).
            - Для канонического имени используй все такие именные формы из фрагмента.
            - В aliases не должно быть дубликатов одной и той же строки (одинаковый вариант имени или прозвища).
            - Сделай описание персонажа по тексту до 100 слов.
            - Обязательно сформируй список связанных персонажей. Нужно понять тип отношений между персонажами: жена, любовник, вместе пьют кофе, вместе учатся, вместе работают и т.д. 
            - Соседство имён в тексте не означает связи между персонажами.
            - Связи добавляй только если они явно следуют из текста.
            - Дай описание связи между персонажами по тексту до 100 слов.

            Вот расшифровка свойств в JSON схеме:
            - entities - массив объектов персонажей.
            - name - каноническое имя персонажа в именительном падеже.
            - aliases - только варианты имён, отчеств, фамилий и устойчивых прозвищ из текста (без местоимений), как в исходном фрагменте.
            - description - характеристика персонажа или связи между персонажами по тексту  до 100 слов.
            - relations - список связанных персонажей.

            Исходный текст на русском языке. В ответе используй только русский язык.
        `;
    }
    private getPrompt(source: string): string {
        return `
            Проанализируй текст в соответствии с инструкциями. Не включай в name, aliases и relations[].name местоимения (он, она, они и т.д.).

            Текст:
            ${source}
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
    norm(s: string): string {
        return s.trim().toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ");
    }
    mergeResult(result: any, promptResult: any, minChunk: number, maxChunk: number): any {
        for (const entity of promptResult.entities) {
            entity.aliases = entity.aliases.filter((a: any) => !PRONOUN_OR_ANAPHORA.has(this.norm(a)));
            const existingEntity = result.entities.find((e: any) => e.name === entity.name);
            if (existingEntity) {
                if (!existingEntity.description.includes(entity.description)) existingEntity.description += "\n" + entity.description;
                for (const alias of entity.aliases) {
                    if (!existingEntity.aliases.find((a: any) => a.alias === alias.alias && a.minChunk === minChunk && a.maxChunk === maxChunk)) {
                        existingEntity.aliases.push({
                            alias: alias,
                            minChunk,
                            maxChunk,
                        });
                    }
                }
                for (const relation of entity.relations) {
                    const existingRelation = existingEntity.relations.find((r: any) => r.name === relation.name);
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
                entity.aliases = entity.aliases.map((a: any) => ({
                    alias: a,
                    minChunk,
                    maxChunk,
                }));
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

        if (!result.analyze) {
            console.log(`Start analyze: ${source.length} characters`);
            for (const chunk of this.getChunks(source)) {
                if (result.chunks.includes(chunk.minChunk)) continue;

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
                const text = response.output_text.replaceAll("```json", "").replaceAll("```", "").trim();
                try {
                    const promptResult = JSON.parse(text);
                    console.log(`${chunk.index}(${chunk.count})`);
                    this.mergeResult(result, promptResult, chunk.minChunk, chunk.maxChunk);
                } catch (error) {
                    console.error(error.message);
                    throw new Error(error.message);
                }
                result.chunks.push(chunk.minChunk);
            }
            result.analyze = true;
            await storageService.setResult(bookId, result, "json");
            console.log(`End analyze`);
        }
        if (!result.merged) {
            console.log(`Start merge`);
            const candidates = this.getMergeCandidates(result);
            await storageService.setResult(bookId, result, "json");
            console.log(`End merge`);
        }
        return Promise.resolve(result);
    }
    getMergeCandidates(result: any): number[][] {
        const candidates: number[][] = [];
        result.entities.forEach((entity: any, index: number) => {
            entity.id = index;
        });
        result.entities.forEach((a: any, i: number) => {
            const group = new Set<number>();
            const aNames = a.aliases.map((a: any) => a.alias);
            aNames.push(a.name);
            result.entities.slice(i + 1).forEach((b: any) => {
                if (a.name.includes(b.name) || b.name.includes(a.name)) {
                    const bNames = b.aliases.map((b: any) => b.alias);
                    bNames.push(b.name);
                    const commonNames = aNames.filter((name: string) => bNames.includes(name));
                    if (commonNames.length > 0) {
                        group.add(a.id);
                        group.add(b.id);
                        console.log(`${a.name} and ${b.name} are merged`);
                    }
                }
            });
            if (group.size > 0) {
                candidates.push([...group.values()]);
            }
        });
        return candidates;
    }
}
