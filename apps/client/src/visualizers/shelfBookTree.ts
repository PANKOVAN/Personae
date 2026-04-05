const BOOK_KEY_SEP = "\u001e";
/** Префикс значения узла-полки в общем дереве. */
const SHELF_FOLDER_PREFIX = "folder:";

export function shelfBookTreeValue(shelfPath: string, bookPath: string): string {
    return `${shelfPath}${BOOK_KEY_SEP}${bookPath}`;
}

export function parseShelfBookTreeValue(key: string): { shelfPath: string; bookPath: string } {
    const i = key.indexOf(BOOK_KEY_SEP);
    if (i < 0) {
        return { shelfPath: "", bookPath: "" };
    }
    return { shelfPath: key.slice(0, i), bookPath: key.slice(i + BOOK_KEY_SEP.length) };
}

export function shelfFolderTreeValue(shelfPath: string): string {
    return `${SHELF_FOLDER_PREFIX}${shelfPath}`;
}
