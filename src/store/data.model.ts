import { makeAutoObservable, runInAction } from "mobx";

import { BookStorage, type Book, type BookShelf } from "./storage";

/** Псевдо-пункт дерева в режиме правки: создать полку */
export const NEW_SHELF_TREE_ITEM_VALUE = "__personae_new_shelf__";

/** Ключ пункта Nav для книги: `shelfId/bookId` */
export function makeBookNavKey(shelfId: string, bookId: string): string {
    return `${shelfId}/${bookId}`;
}

export function parseBookNavKey(key: string): { shelfId: string; bookId: string } | null {
    const i = key.indexOf("/");
    if (i <= 0 || i === key.length - 1) {
        return null;
    }
    return { shelfId: key.slice(0, i), bookId: key.slice(i + 1) };
}

function resolveActiveNavKey(
    prev: string,
    shelves: BookShelf[],
    byShelf: Record<string, Book[]>,
): string {
    if (prev) {
        const parsed = parseBookNavKey(prev);
        if (parsed) {
            const books = byShelf[parsed.shelfId] ?? [];
            if (books.some((b) => b.id === parsed.bookId)) {
                return prev;
            }
        } else {
            const shelf = shelves.find((x) => x.id === prev);
            if (shelf) {
                const books = byShelf[shelf.id] ?? [];
                if (books.length > 0) {
                    return makeBookNavKey(shelf.id, books[0].id);
                }
                return prev;
            }
        }
    }
    for (const s of shelves) {
        const books = byShelf[s.id] ?? [];
        if (books.length > 0) {
            return makeBookNavKey(s.id, books[0].id);
        }
    }
    return "";
}

export class ShelvesStore {
    shelves: BookShelf[] = [];
    booksByShelfId: Record<string, Book[]> = {};
    activeNavKey = "";
    navOpenKeys: string[] = [];
    isLoading = false;
    loadError: unknown | null = null;

    constructor() {
        makeAutoObservable(this);
    }

    setActiveNavKey(id: string | null | undefined): void {
        this.activeNavKey = id ?? "";
    }

    setNavOpenKeys(keys: string[]): void {
        this.navOpenKeys = [...keys];
    }

    async loadShelves(): Promise<void> {
        runInAction(() => {
            this.isLoading = true;
            this.loadError = null;
        });
        try {
            const bookStorage = new BookStorage();
            await bookStorage.reload();
            const list = await bookStorage.getShelves();
            const entries = await Promise.all(
                list.map(async (s) => [s.id, await s.getBooks()] as const),
            );
            const booksByShelfId = Object.fromEntries(entries) as Record<string, Book[]>;
            runInAction(() => {
                this.shelves = list;
                this.booksByShelfId = booksByShelfId;
                this.activeNavKey = resolveActiveNavKey(this.activeNavKey, list, booksByShelfId);
                this.navOpenKeys = list.map((s) => s.id);
                this.isLoading = false;
            });
        } catch (e) {
            console.error(e);
            runInAction(() => {
                this.loadError = e;
                this.isLoading = false;
            });
        }
    }

    /**
     * Имя может быть пустым — тогда в хранилище подставится «Новая полка».
     * @param selectNew выделить созданную полку (в т.ч. пустую)
     */
    async addShelf(name: string, selectNew = false): Promise<string | undefined> {
        try {
            const bookStorage = new BookStorage();
            await bookStorage.reload();
            const newId = await bookStorage.addShelf(name);
            const list = await bookStorage.getShelves();
            const entries = await Promise.all(
                list.map(async (s) => [s.id, await s.getBooks()] as const),
            );
            const booksByShelfId = Object.fromEntries(entries) as Record<string, Book[]>;
            runInAction(() => {
                this.shelves = list;
                this.booksByShelfId = booksByShelfId;
                this.activeNavKey =
                    selectNew && newId
                        ? newId
                        : resolveActiveNavKey(this.activeNavKey, list, booksByShelfId);
                this.navOpenKeys = [...new Set([...this.navOpenKeys, newId])];
            });
            return newId;
        } catch (e) {
            console.error(e);
            return undefined;
        }
    }

    async updateShelfName(shelfId: string, name: string): Promise<void> {
        if (!shelfId) return;
        try {
            const bookStorage = new BookStorage();
            await bookStorage.reload();
            const label = name.trim() || "Новая полка";
            await bookStorage.updateShelf(shelfId, label);
            const list = await bookStorage.getShelves();
            const entries = await Promise.all(
                list.map(async (s) => [s.id, await s.getBooks()] as const),
            );
            const booksByShelfId = Object.fromEntries(entries) as Record<string, Book[]>;
            runInAction(() => {
                this.shelves = list;
                this.booksByShelfId = booksByShelfId;
            });
        } catch (e) {
            console.error(e);
        }
    }

    async removeShelf(shelfId: string): Promise<void> {
        if (!shelfId) return;
        try {
            const bookStorage = new BookStorage();
            await bookStorage.reload();
            await bookStorage.removeShelf(shelfId);
            const list = await bookStorage.getShelves();
            const entries = await Promise.all(
                list.map(async (s) => [s.id, await s.getBooks()] as const),
            );
            const booksByShelfId = Object.fromEntries(entries) as Record<string, Book[]>;
            runInAction(() => {
                this.shelves = list;
                this.booksByShelfId = booksByShelfId;
                this.activeNavKey = resolveActiveNavKey(this.activeNavKey, list, booksByShelfId);
                this.navOpenKeys = this.navOpenKeys.filter((k) => k !== shelfId);
            });
        } catch (e) {
            console.error(e);
        }
    }
}

export const dataModel = new ShelvesStore();
