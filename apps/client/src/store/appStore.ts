import { Book, Shelf } from "@personae/shared";
import { makeAutoObservable, runInAction } from "mobx";
import { settings } from "../settings";

function parseBookRow(b: { id?: string; name?: string; author?: string; description?: string; shelfId?: string }): Book {
    return new Book(
        String(b.id ?? ""),
        String(b.name ?? ""),
        String(b.author ?? ""),
        String(b.description ?? ""),
        String(b.shelfId ?? ""),
    );
}

export class AppStore {
    health: boolean = false;
    shelves: Shelf[] = [];
    books: Book[] = [];
    /** Книги по id полки. */
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

    private api(path: string): string {
        const p = path.replace(/^\//, "");
        return `${settings.serverURL}/api/${p}`;
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

    /** Первичная загрузка и после смены настроек. */
    async init(): Promise<void> {
        await this.getHealth();
        await this.getShelves();
        await this.getBooks();
    }

    //#region IStorage HTTP (StorageController)
    async getHealth(): Promise<void> {
        try {
            const r = await fetch(this.api("health"));
            const j = await r.json();
            const v = j === true || (typeof j === "object" && j !== null && Boolean((j as { ok?: unknown }).ok));
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
        const r = await fetch(this.api("storage/getShelves"));
        const raw = await r.json();
        const shelves: Shelf[] = Array.isArray(raw)
            ? raw.map((s: { id?: string; name?: string }) => new Shelf(String(s.id ?? ""), String(s.name ?? "")))
            : [];
        runInAction(() => {
            this.shelves = shelves;
        });
    }

    async getBooks(): Promise<void> {
        const r = await fetch(this.api("storage/getBooks"));
        const raw = await r.json();
        const books: Book[] = Array.isArray(raw) ? raw.map((b) => parseBookRow(b)) : [];
        runInAction(() => {
            this.books = books;
            const next: Record<string, Book[]> = {};
            for (const s of this.shelves) {
                next[s.id] = [];
            }
            for (const b of books) {
                if (!next[b.shelfId]) {
                    next[b.shelfId] = [];
                }
                next[b.shelfId].push(b);
            }
            this.booksByShelfPath = next;
        });
    }
    //#endregion

    async testResponse(r: Response) {
        if (!r.ok) {
            let msg = `${r.status} ${r.statusText}`;
            try {
                const j = await r.json();
                if (typeof j === "object" && j !== null && "message" in j) {
                    msg = String((j as { message: unknown }).message);
                }
            } catch {
                /* ignore */
            }
            throw new Error(msg);
        }
    }

    async createShelf() {
        try {
            const r = await fetch(this.api("storage/addShelf"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({}),
            });
            await this.testResponse(r);
            await this.getShelves();
            await this.getBooks();
            runInAction(() => {
                this.error = null;
            });
        } catch (e) {
            runInAction(() => {
                this.error = e instanceof Error ? e.message : String(e);
            });
        }
    }

    async createBook(shelfPath: string) {
        try {
            const r = await fetch(this.api(`storage/addBook/${encodeURIComponent(shelfPath)}`), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({}),
            });
            await this.testResponse(r);
            const c = await r.json();
            const created = parseBookRow(c);
            await this.getBooks();
            await this.selectBook(created.shelfId, created.id);
        } catch (e) {
            runInAction(() => {
                this.error = e instanceof Error ? e.message : String(e);
            });
        }
    }

    async deleteShelf(shelfId: string) {
        try {
            const clearsSelection = this.selectedShelfPath === shelfId;
            const r = await fetch(this.api(`storage/delShelf/${encodeURIComponent(shelfId)}`), {
                method: "DELETE",
            });
            await this.testResponse(r);
            await this.getShelves();
            await this.getBooks();
            runInAction(() => {
                if (clearsSelection) {
                    this.selectedShelfPath = null;
                    this.selectedBookPath = null;
                    this.sourceText = null;
                    this.resultText = null;
                }
                this.error = null;
            });
        } catch (e) {
            runInAction(() => {
                this.error = e instanceof Error ? e.message : String(e);
            });
        }
    }

    async deleteBook(bookId: string) {
        try {
            const clearsSelection = this.selectedBookPath === bookId;
            const r = await fetch(this.api(`storage/delBook/${encodeURIComponent(bookId)}`), {
                method: "DELETE",
            });
            await this.testResponse(r);
            await this.getBooks();
            runInAction(() => {
                if (clearsSelection) {
                    this.selectedShelfPath = null;
                    this.selectedBookPath = null;
                    this.sourceText = null;
                    this.resultText = null;
                }
                this.error = null;
            });
        } catch (e) {
            runInAction(() => {
                this.error = e instanceof Error ? e.message : String(e);
            });
        }
    }

    async updateShelf(shelfId: string, name: string): Promise<boolean> {
        try {
            const r = await fetch(this.api(`storage/updShelf/${encodeURIComponent(shelfId)}`), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name }),
            });
            await this.testResponse(r);
            await this.getShelves();
            await this.getBooks();
            runInAction(() => {
                this.error = null;
            });
            return true;
        } catch (e) {
            runInAction(() => {
                this.error = e instanceof Error ? e.message : String(e);
            });
            return false;
        }
    }

    async updateBook(bookId: string, name: string, author: string, description: string, shelfId: string): Promise<boolean> {
        try {
            const r = await fetch(this.api(`storage/updBook/${encodeURIComponent(bookId)}`), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, author, description, shelfId }),
            });
            await this.testResponse(r);
            await this.getBooks();
            runInAction(() => {
                this.error = null;
            });
            return true;
        } catch (e) {
            runInAction(() => {
                this.error = e instanceof Error ? e.message : String(e);
            });
            return false;
        }
    }

    /** Выбрана только полка (без книги). */
    selectShelf(shelfPath: string): void {
        this.selectedShelfPath = shelfPath;
        this.selectedBookPath = null;
        this.sourceText = null;
        this.resultText = null;
    }

    async selectBook(shelfPath: string, bookPath: string) {
        this.selectedShelfPath = shelfPath;
        this.selectedBookPath = bookPath;
        this.sourceText = null;
        this.resultText = null;
        await Promise.all([this.loadSource(bookPath), this.loadResult(bookPath)]);
    }

    private async loadSource(bookId: string) {
        try {
            const r = await fetch(this.api(`storage/getSource/${encodeURIComponent(bookId)}`));
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

    private async loadResult(bookId: string) {
        try {
            const r = await fetch(this.api(`storage/getResult/${encodeURIComponent(bookId)}`));
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
