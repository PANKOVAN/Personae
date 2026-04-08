export function decorateResult(result: any): string {
    let html = `
    <div>
    ${result.entities
        .map((entity: any) => {
            return `<h5>${entity.name}</h5>
            <div><i>${entity.description}</i></div>
            ${entity.relations.map((relation: any) => `<li><b>${relation.name}</b> - ${relation.description}</li>`).join("\n")}
            `;
        })
        .join("\n<hr />\n")}
    </div>`;
    return html;
}
