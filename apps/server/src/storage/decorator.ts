export function decorateResult(result: any): string {
    let html = `
    <div>
    ${result.entities
        .map((entity: any) => {
            return `<h5>${entity.name}</h5>
            <div><i>${entity.description}</i></div>
            <ul>
            ${entity.relations.map((relation: any) => `<li><b>${relation.name}</b> - ${relation.description}</li>`).join("\n")}
            </ul>
            <div style="color: red">${entity.aliases.map((alias: any) => `${alias.alias}`).join(", ")}</div>
            `;
        })
        .join("\n<hr />\n")}
    </div>`;
    return html;
}
