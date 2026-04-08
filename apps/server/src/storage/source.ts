/// Преобразование импортируемых файлов в source.html

import { JSDOM } from "jsdom";

export type ParsedSource = {
    sourceHtml: string;
    name?: string;
    author?: string;
    annotation?: string;
};

function replaceTag(node: Element, oldTag: string, newTag: string): void {
    const nodes = [...node.querySelectorAll(oldTag)] as Element[];
    for (const node of nodes) {
        const newNode = node.ownerDocument.createElement(newTag);
        newNode.innerHTML = node.innerHTML;
        node.replaceWith(newNode);
    }
}
let chunkIndex = 0;
function createChunkSpan(node: Element): void {
    for (const child of node.childNodes) {
        if (child.nodeType === 3) {
            let text = child.textContent?.trim() ?? "";
            if (text.length > 0) {
                try {
                    const chunkSpan = node.ownerDocument.createElement("span");
                    chunkSpan.setAttribute("chunk", chunkIndex.toString());
                    text = text.replaceAll("<", "&lt;").replaceAll(">", "&gt;");
                    chunkSpan.innerHTML = text;
                    chunkIndex += text.length;
                    child.replaceWith(chunkSpan);
                } catch (e) {
                    console.error(e);
                }
            }
        } else if (child.nodeType === 1) {
            createChunkSpan(child as Element);
        }
    }
}

export function parseImportedSource(source: string): ParsedSource {
    // FB2 файл
    if (/<\s*FictionBook\b/i.test(source)) {
        chunkIndex = 0;
        const dom = new JSDOM(source, { contentType: "text/xml" });
        const doc = dom.window.document;

        const name = doc.querySelector("description > title-info > book-title")?.textContent?.trim() ?? "";
        const firstName = doc.querySelector("description > title-info > author > first-name")?.textContent?.trim() ?? "";
        const lastName = doc.querySelector("description > title-info > author > last-name")?.textContent?.trim() ?? "";
        const annotation = doc.querySelector("description > title-info > annotation")?.textContent?.trim() ?? "";

        const author = [firstName, lastName].filter(Boolean).join(" ").trim();
        const bodyNodes = [...doc.querySelectorAll("body")] as Element[];
        const bodyHtml = bodyNodes
            .map((node) => {
                replaceTag(node, "title", "h4");
                replaceTag(node, "subtitle", "h5");
                createChunkSpan(node);
                return node.innerHTML;
            })
            .join("\n");

        return {
            sourceHtml: bodyHtml,
            name: name || undefined,
            author: author || undefined,
            annotation: annotation || undefined,
        };
    }
    return { sourceHtml: source };
}

export function convertToSourceHtml(source: string): ParsedSource {
    return parseImportedSource(source);
}
