export function decorateResult(result: any): string {
    let html = `
    <div>
    ${result.entities
        .map((entity: any) => {
            entity.webSearch = entity.webSearch || {};
            entity.webSearch.summary = entity.webSearch.summary || "";
            entity.webSearch.sources = entity.webSearch.sources || [];
            entity.webSearch.imageUrls = entity.webSearch.imageUrls || [];
            const hist =
                entity.historicalLikelihood != null ? `<div><small>Вероятность исторического прототипа: ${entity.historicalLikelihood}%</small></div>` : "";
            return `<h5>${entity.name}</h5>
            ${hist}
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
            ${entity.webSearch.imageUrls.map((imageUrl: any) => `<img style="width: 300px; max-width: 100%; margin: 4px" src="https://upload.wikimedia.org/wikipedia/commons/5/5e/Florian-illies-pinakothek-der-moderne-2022.jpg" alt="${entity.name}" />`).join(", ")}
            </div>
            <div>

            <div style="color: red">${entity.aliases.map((alias: any) => `${alias.alias}`).join(", ")}</div>
            `;
        })
        .join("\n<hr />\n")}
    </div>`;
    return html;
}
