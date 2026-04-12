export function decorateResult(result: any): string {
    let html = `
    <div>
    ${result.entities
        .map((entity: any) => {
            entity.webSearch = entity.webSearch || {};
            entity.webSearch.summary = entity.webSearch.summary || "";
            entity.webSearch.sources = entity.webSearch.sources || [];
            entity.webSearch.imageUrls = entity.webSearch.imageUrls || [];
            entity.webSearch.download = entity.webSearch.download || [];
            let image = "";
            if (entity.webSearch.download.length > 0) {
                image = `<img style="width: 300px; max-width: 100%; margin: 4px" src="/data/${entity.webSearch.download[0]}" alt="${entity.name}" />`;
            }

            return `<h5>${entity.name}</h5>
            ${image}
            <div><i>${entity.description}</i></div>
            <ul>
            ${entity.relations.map((relation: any) => `<li><i><b>${relation.name}</b> - ${relation.description}</i></li>`).join("\n")}
            </ul>
            <br/>
            <div>
            ${entity.webSearch.summary}
            </div>
            <div>
            ${entity.webSearch.sources.map((source: any) => `<a href="${source.url}" target="_blank" rel="noopener noreferrer">${source.title}</a>`).join(", ")}
            </div>
            <div>

            <div style="color: red">${entity.aliases.map((alias: any) => `${alias.alias}`).join(", ")}</div>
            `;
        })
        .join("\n<hr />\n")}
    </div>`;
    return html;
}
