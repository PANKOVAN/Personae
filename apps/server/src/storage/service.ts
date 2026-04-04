import { Injectable, InternalServerErrorException, NotFoundException } from "@nestjs/common";
import { BOOK_FILES, Shelf, Book, IStorage } from "@personae/shared";
import * as fs from "node:fs/promises";
import * as path from "node:path";

const EMPTY_SOURCE_HTML = `<?xml version="1.0" encoding="UTF-8"?>
<personae>
  <body></body>
</personae>
`;

@Injectable()
/// Cервис для работы с хранилищем.
export class StorageService implements IStorage {
    private root: string;
    private shelves: Shelf[] = [];
    private books: Book[] = [];
    private isOpen = false;

    constructor() {
        this.root = process.env.PERSONAE_STORAGE_ROOT ?? path.resolve(__dirname, "..", "..", "..", "..", "data");
    }

    async open(): Promise<void> {
        if (!this.isOpen) {
            this.isOpen = true;
            try {
                let data = JSON.parse(await fs.readFile(path.join(this.root, "data.json"), "utf8"));
                this.shelves = data.shelves.map((s: any) => new Shelf(s.id, s.name));
                this.books = data.books.map((b: any) => new Book(b.id, b.name, b.author, b.description, b.shelfId));
            } catch {
                this.shelves = [];
                this.books = [];
            }
        }
        return Promise.resolve();
    }
    async close(): Promise<void> {
        if (this.isOpen) {
            this.shelves = [];
            this.books = [];
            this.isOpen = false;
        }
        return Promise.resolve();
    }
    async save(): Promise<void> {
        if (!this.isOpen) throw new Error("Storage is not open");
        await fs.mkdir(this.root, { recursive: true });
        try {
            let data = JSON.stringify({ shelves: this.shelves, books: this.books }, null, 2);
            await fs.writeFile(path.join(this.root, "data.json"), data, "utf8");
        } catch {
            throw new InternalServerErrorException("Cannot write storage data");
        }
        return Promise.resolve();
    }

    async getShelves(): Promise<Shelf[]> {
        if (!this.isOpen) throw new Error("Storage is not open");
        return Promise.resolve(this.shelves);
    }

    /**
     * Создаёт каталог полки. `requestedSegment` — последний сегмент path от корня хранилища; иначе UUID v7.
     */
    async addShelf(): Promise<Shelf> {
        if (!this.isOpen) throw new Error("Storage is not open");
        const shelf = new Shelf(crypto.randomUUID(), "Новая полка");
        this.shelves.push(shelf);
        return Promise.resolve(shelf);
    }
    async updShelf(shelfId: string, name: string): Promise<Shelf> {
        await this.open();
        let shelf = this.shelves.find((s) => s.id === shelfId);
        if (!shelf) {
            shelf = new Shelf(shelfId, name);
            this.shelves.push(shelf);
        } else {
            shelf.name = name;
        }
        await this.save();
        return Promise.resolve(shelf);
    }
    async delShelf(shelfId: string): Promise<void> {
        await this.open();
        let index = this.shelves.findIndex((s) => s.id === shelfId);
        if (index !== -1) {
            this.shelves.splice(index, 1);
        }
        for (let book of this.books.filter((b) => b.shelfId === shelfId)) {
            await this.delBook(book.id);
        }
        await this.save();
        return Promise.resolve();
    }
    async getBooks(shelfId: string | undefined): Promise<Book[]> {
        if (!this.isOpen) throw new Error("Storage is not open");
        return Promise.resolve(this.books.filter((b) => (shelfId ? b.shelfId === shelfId : true)));
    }

    /**
     * Создаёт каталог книги и пустой source.html.
     */
    async addBook(shelfId: string): Promise<Book> {
        await this.open();
        const book = new Book(crypto.randomUUID(), "Новая книга", "", "", shelfId);
        this.books.push(book);
        return Promise.resolve(book);
    }
    async updBook(bookId: string, name: string, author: string, description: string, shelfId: string): Promise<Book> {
        await this.open();
        let book = this.books.find((b) => b.id === bookId);
        if (!book) {
            book = new Book(bookId, name, author, description, shelfId);
            this.books.push(book);
        } else {
            book.name = name;
            book.author = author;
            book.description = description;
        }
        await this.save();
        return Promise.resolve(book);
    }
    async delBook(bookId: string): Promise<void> {
        await this.open();
        let index = this.books.findIndex((b) => b.id === bookId);
        if (index !== -1) {
            this.books.splice(index, 1);
        }
        await this.save();
        this.books = this.books.filter((b) => b.id !== bookId);
        if (
            await fs
                .access(path.join(this.root, bookId, BOOK_FILES.source))
                .then(() => true)
                .catch(() => false)
        ) {
            await fs.rm(path.join(this.root, bookId, BOOK_FILES.source), { recursive: true });
        }
        if (
            await fs
                .access(path.join(this.root, bookId, BOOK_FILES.result))
                .then(() => true)
                .catch(() => false)
        ) {
            await fs.rm(path.join(this.root, bookId, BOOK_FILES.result), { recursive: true });
        }
        return Promise.resolve();
    }

    async getSource(bookId: string): Promise<string> {
        await this.open();
        try {
            let source = await fs.readFile(path.join(this.root, bookId, BOOK_FILES.source), "utf8");
            return Promise.resolve(source);
        } catch {
            throw new NotFoundException("Source not found");
        }
        return Promise.resolve("");
    }

    async setSource(bookId: string, source: string): Promise<void> {
        await this.open();
        try {
            await fs.mkdir(this.root, { recursive: true });
            await fs.writeFile(path.join(this.root, bookId, BOOK_FILES.source), source, "utf8");
        } catch {
            throw new InternalServerErrorException("Cannot write source");
        }
        return Promise.resolve();
    }
    async getResult(bookId: string): Promise<string> {
        await this.open();
        try {
            let result = await fs.readFile(path.join(this.root, bookId, BOOK_FILES.result), "utf8");
            return Promise.resolve(result);
        } catch {
            return Promise.resolve("{}");
        }
    }
    async setResult(bookId: string, result: string): Promise<void> {
        await this.open();
        try {
            await fs.writeFile(path.join(this.root, bookId, BOOK_FILES.result), result, "utf8");
        } catch {
            throw new InternalServerErrorException("Cannot write result");
        }
        return Promise.resolve();
    }
}
