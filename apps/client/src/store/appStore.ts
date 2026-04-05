import { Book, Shelf } from "@personae/shared";
import { makeAutoObservable, runInAction } from "mobx";
import { settings } from "../settings";

export class AppStore {
    health: boolean = false;
    shelves: Shelf[] = [];
    books: Book[] = [];
    /** Книги по id полки (сегмент в URL /api/shelves/:id/...). */
    booksByShelfPath: Record<string, Book[]> = {};
    selectedShelfPath: string | null = null;
    selectedBookPath: string | null = null;
    sourceText: string | null = null;
    resultText: string | null = null;
    loading = false;
    error: string | null = null;

    /** Панель «содержание» (полки и книги). */
    showContents = true;
    /** Колонка результата анализа. */
    showResult = true;
    settingsOpen = false;

    constructor() {
        makeAutoObservable(this);
    }

    toggleContents(): void {
        this.showContents = !this.showContents;
    }

    toggleResult(): void {
        this.showResult = !this.showResult;
    }

    openSettings(): void {
        this.settingsOpen = true;
    }

    closeSettings(): void {
        this.settingsOpen = false;
    }

    //#region IStorage
    async getHealth(): Promise<void> {
        try {
            const r = await fetch(`${settings.serverURL}/api/health`);
            const v: boolean = Boolean((await r.json()).ok);
            runInAction(() => {
                this.health = v;
            });
        } catch {
            runInAction(() => {
                this.health = false;
            });
        }
    }

    async getShelves(): Promise<void> {
        const r = await fetch(`${settings.serverURL}/api/shelves`);
        const raw = await r.json();
        const shelves: Shelf[] = Array.isArray(raw) ? raw.map((s: { id?: string; name?: string }) => new Shelf(String(s.id ?? ""), String(s.name ?? ""))) : [];
        runInAction(() => {
            this.shelves = shelves;
        });
    }
    async getBooks(): Promise<void> {
        const r = await fetch(`${settings.serverURL}/api/books`);
        const raw = await r.json();
        const books: Book[] = Array.isArray(raw)
            ? raw.map(
                  (b: { id?: string; name?: string; author?: string; description?: string; shelfId?: string }) =>
                      new Book(String(b.id ?? ""), String(b.name ?? ""), String(b.author ?? ""), String(b.description ?? ""), String(b.shelfId ?? "")),
              )
            : [];
        runInAction(() => {
            this.books = books;
        });
    }
    //#endregion

    async testResponse(r: Response) {
        if (!r.ok) {
            throw new Error((await r.json()).message);
        }
    }
    async createShelf() {
        try {
            const r = await fetch("/api/shelves", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({}),
            });
            await this.testResponse(r);
            await this.getShelves();
        } catch (e) {
            runInAction(() => {
                this.error = e instanceof Error ? e.message : String(e);
            });
        }
    }

    async createBook(shelfPath: string) {
        try {
            const r = await fetch(`/api/shelves/${encodeURIComponent(shelfPath)}/books`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({}),
            });
            await this.testResponse(r);
            const c = await r.json();
            const created = new Book(String(c.id ?? ""), String(c.name ?? ""), String(c.author ?? ""), String(c.description ?? ""), String(c.shelfId ?? ""));
            await this.reloadBooksForShelf(shelfPath);
            await this.selectBook(created.shelfId, created.id);
        } catch (e) {
            runInAction(() => {
                this.error = e instanceof Error ? e.message : String(e);
            });
        }
    }

    private async reloadBooksForShelf(shelfPath: string) {
        try {
            const r = await fetch(`/api/shelves/${encodeURIComponent(shelfPath)}/books`);
            await this.testResponse(r);
            const booksRaw = await r.json();
            const books: Book[] = Array.isArray(booksRaw)
                ? booksRaw.map(
                      (b: { id?: string; name?: string; author?: string; description?: string; shelfId?: string }) =>
                          new Book(String(b.id ?? ""), String(b.name ?? ""), String(b.author ?? ""), String(b.description ?? ""), String(b.shelfId ?? "")),
                  )
                : [];
            runInAction(() => {
                this.booksByShelfPath = { ...this.booksByShelfPath, [shelfPath]: books };
            });
        } catch {
            /* ignore */
        }
    }

    async selectBook(shelfPath: string, bookPath: string) {
        this.selectedShelfPath = shelfPath;
        this.selectedBookPath = bookPath;
        this.sourceText = null;
        this.resultText = null;
        await Promise.all([this.loadSource(shelfPath, bookPath), this.loadResult(shelfPath, bookPath)]);
    }

    private async loadSource(shelfPath: string, bookPath: string) {
        try {
            const r = await fetch(`/api/shelves/${encodeURIComponent(shelfPath)}/books/${encodeURIComponent(bookPath)}/source`);
            if (!r.ok) {
                runInAction(() => {
                    this.sourceText = `Ошибка загрузки source: ${r.status}`;
                });
                return;
            }
            const t = await r.text();
            runInAction(() => {
                this.sourceText = t;
            });
        } catch (e) {
            runInAction(() => {
                this.sourceText = `Ошибка: ${e}`;
            });
        }
    }

    private async loadResult(shelfPath: string, bookPath: string) {
        try {
            const r = await fetch(`/api/shelves/${encodeURIComponent(shelfPath)}/books/${encodeURIComponent(bookPath)}/result`);
            if (!r.ok) {
                runInAction(() => {
                    this.resultText = `result.json недоступен (${r.status})`;
                });
                return;
            }
            const t = await r.text();
            runInAction(() => {
                this.resultText = t;
            });
        } catch (e) {
            runInAction(() => {
                this.resultText = `Ошибка: ${e}`;
            });
        }
    }
}

export const appStore = new AppStore();
