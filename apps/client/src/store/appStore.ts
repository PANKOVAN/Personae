import { Book, Shelf } from "@personae/shared";
import { makeAutoObservable, runInAction } from "mobx";
import { settings } from "../settings";

function parseBookRow(b: { id?: string; name?: string; author?: string; annotation?: string; description?: string; shelfId?: string }): Book {
    const ann = b.annotation ?? b.description ?? "";
    return new Book(String(b.id ?? ""), String(b.name ?? ""), String(b.author ?? ""), String(ann), String(b.shelfId ?? ""));
}

export class AppStore {
    health: boolean = false;
    shelves: Shelf[] = [];
    books: Book[] = [];
    /** Книги по id полки. */
    booksByShelfPath: Record<string, Book[]> = {};
    selectedShelfId: string | null = null;
    selectedBookId: string | null = null;
    sourceHtml: string | null = null;
    resultHtml: string | null = null;
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
        const shelves: Shelf[] = Array.isArray(raw) ? raw.map((s: { id?: string; name?: string }) => new Shelf(String(s.id ?? ""), String(s.name ?? ""))) : [];
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
            await this.selectBook(created.id);
        } catch (e) {
            runInAction(() => {
                this.error = e instanceof Error ? e.message : String(e);
            });
        }
    }

    async deleteShelf(shelfId: string) {
        try {
            const r = await fetch(this.api(`storage/delShelf/${encodeURIComponent(shelfId)}`), {
                method: "DELETE",
            });
            await this.testResponse(r);
            await this.getShelves();
            await this.getBooks();
            await Promise.all([this.loadSource(null), this.loadResult(null)]);
        } catch (e) {
            runInAction(() => {
                this.error = e instanceof Error ? e.message : String(e);
            });
        }
    }

    async deleteBook(bookId: string) {
        try {
            const r = await fetch(this.api(`storage/delBook/${encodeURIComponent(bookId)}`), {
                method: "DELETE",
            });
            await this.testResponse(r);
            await this.getBooks();
            await Promise.all([this.loadSource(null), this.loadResult(null)]);
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

    async updateBook(bookId: string, name: string, author: string, annotation: string, shelfId: string): Promise<boolean> {
        try {
            const r = await fetch(this.api(`storage/updBook/${encodeURIComponent(bookId)}`), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, author, annotation, shelfId }),
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

    async importBookFromFile(bookId: string, fileName: string, sourceText: string): Promise<boolean> {
        try {
            const fileExtension = fileName.split(".").pop();
            const book = this.books.find((b) => b.id === bookId);
            if (!book) {
                throw new Error("Книга не найдена");
            }
            if (fileExtension === "fb2") {
                const parser = new DOMParser();
                const doc = parser.parseFromString(sourceText, "application/xml");
                const name = doc.querySelector("description>title-info>book-title")?.textContent || book.name;
                const firstName = doc.querySelector("description>title-info>author>first-name")?.textContent || book.author;
                const lastName = doc.querySelector("description>title-info>author>last-name")?.textContent || book.author;
                const author = firstName || lastName ? firstName + " " + lastName : book.author;
                const annotation = doc.querySelector("description>title-info>annotation")?.textContent || book.annotation;
                const source = [...doc.querySelectorAll("body")]
                    .map((b) => {
                        return b.innerHTML
                            .replaceAll("<title", "<h3")
                            .replaceAll("</title>", "</h3>")
                            .replaceAll("<subtitle", "<h4")
                            .replaceAll("</subtitle>", "</h4>");
                    })
                    .join("\n");
                await this.updateBook(bookId, name, author, annotation, book.shelfId);

                const res = await fetch(this.api(`storage/setSource/${encodeURIComponent(bookId)}`), {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ source }),
                });
                await this.testResponse(res);

                await this.getBooks();
                await this.selectBook(bookId);
                runInAction(() => {
                    this.error = null;
                });
                return true;
            } else {
                throw new Error("Неподдерживаемый формат файла");
            }
        } catch (e) {
            runInAction(() => {
                this.error = e instanceof Error ? e.message : String(e);
            });
            return false;
        }
    }

    /** Выбрана только полка (без книги). */
    async selectShelf(shelfPath: string): Promise<void> {
        this.selectedShelfId = shelfPath;
        this.selectedBookId = null;
        await Promise.all([this.loadSource(null), this.loadResult(null)]);
    }

    async selectBook(bookId: string) {
        const book = this.books.find((b) => b.id === bookId);
        if (book) {
            this.selectedShelfId = book.shelfId;
            this.selectedBookId = bookId;
            await Promise.all([this.loadSource(bookId), this.loadResult(bookId)]);
        }
    }

    private async loadSource(bookId: string | null) {
        try {
            const r = await fetch(this.api(`storage/getSource/${encodeURIComponent(bookId ?? "")}`));
            if (!r.ok) {
                runInAction(() => {
                    this.sourceHtml = `Ошибка загрузки source: ${r.status}`;
                });
                return;
            }
            const t = await r.text();
            runInAction(() => {
                this.sourceHtml = t;
            });
        } catch (e) {
            runInAction(() => {
                this.sourceHtml = `Ошибка: ${e}`;
            });
        }
    }

    private async loadResult(bookId: string | null) {
        try {
            const r = await fetch(this.api(`storage/getResult/${encodeURIComponent(bookId ?? "")}`));
            if (!r.ok) {
                runInAction(() => {
                    this.resultHtml = `result.json недоступен (${r.status})`;
                });
                return;
            }
            const t = await r.text();
            runInAction(() => {
                this.resultHtml = t;
            });
        } catch (e) {
            runInAction(() => {
                this.resultHtml = `Ошибка: ${e}`;
            });
        }
    }
}

export const appStore = new AppStore();
