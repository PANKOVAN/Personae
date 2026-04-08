/**
 * Удаление местоимений и типичной анафоры из имён/алиасов после ответа модели
 * (поля name, aliases, relations[].name в одном чанке извлечения).
 */

const PARTICLES = new Set([
    "и",
    "да",
    "же",
    "ли",
    "не",
    "ни",
    "ль",
    "б",
    "бы",
    "а",
    "но",
]);

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
`.trim()
        .split(/\s+/),
);

function norm(s: string): string {
    return s
        .trim()
        .toLowerCase()
        .replace(/ё/g, "е")
        .replace(/\s+/g, " ");
}

export function isBannedRussianMention(label: string): boolean {
    const n = norm(label);
    if (!n.length) return true;
    if (PRONOUN_OR_ANAPHORA.has(n)) return true;

    const tokens = n.split(" ").filter(Boolean);
    if (tokens.length >= 2 && tokens.length <= 5) {
        const meaningful = tokens.filter((t) => !PARTICLES.has(t));
        if (meaningful.length > 0 && meaningful.every((t) => PRONOUN_OR_ANAPHORA.has(t))) return true;
    }
    return false;
}

export function sanitizePersonaeExtraction(parsed: { entities?: any[] }): void {
    if (!parsed.entities?.length) return;

    const out: any[] = [];
    for (const e of parsed.entities) {
        const aliasesIn = [...(e.aliases ?? [])].map((a) => String(a));
        const aliases = aliasesIn.filter((a) => !isBannedRussianMention(a));

        let name = String(e.name ?? "").trim();
        if (isBannedRussianMention(name)) {
            const fb = aliases.find((a) => !isBannedRussianMention(a));
            if (!fb) continue;
            name = fb.trim();
        }

        const relations = (e.relations ?? []).filter(
            (r: any) => r && typeof r.name === "string" && !isBannedRussianMention(r.name),
        );

        if (!name.length && aliases.length === 0) continue;
        if (!name.length) name = String(aliases[0]).trim();

        out.push({ ...e, name, aliases, relations });
    }

    parsed.entities = out;
}
