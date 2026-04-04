const BOOK_KEY_SEP = "\u001e";
/** Префикс значения узла-полки в общем дереве. */
const SHELF_FOLDER_PREFIX = "folder:";

/** Псевдо-узел дерева: создать полку (режим правки). */
export const NEW_SHELF = "action:new-shelf";
export const NEW_BOOK = "action:new-book:";

/** Псевдо-узел: создать книгу на полке (shelfPath — сегмент path полки). */
export function treeNewBookItem(shelfPath: string): string {
    return `${NEW_BOOK}${encodeURIComponent(shelfPath)}`;
}

/** Разбор псевдо-узла «новая книга» → сегмент path полки. */
export function parseTreeNewBookItem(val: string): string | null {
    if (!val.startsWith(NEW_BOOK)) {
        return null;
    }
    try {
        return decodeURIComponent(val.slice(NEW_BOOK.length));
    } catch {
        return null;
    }
}

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
