/** Файлы в папке книги (правила хранилища). */
export const BOOK_FILES = {
    source: "source.html",
    result: "result.json",
} as const;

/// Полка
export class Shelf {
    constructor(
        public id: string,
        public name: string,
    ) {}
}

/// Книга
export class Book {
    constructor(
        public id: string,
        public name: string,
        public author: string,
        public description: string,
        public shelfId: string,
    ) {}
}

/// Сервис для работы с хранилищем.
export interface IStorage {
    open(): Promise<void>;
    close(): Promise<void>;
    save(): Promise<void>;
    getShelves(): Promise<Shelf[]>;
    addShelf(): Promise<Shelf>;
    updShelf(shelfId: string, name: string): Promise<Shelf>;
    delShelf(shelfId: string): Promise<void>;
    getBooks(shelfId: string | undefined): Promise<Book[]>;
    addBook(shelfId: string): Promise<Book>;
    updBook(bookId: string, name: string, author: string, description: string, shelfId: string): Promise<Book>;
    delBook(bookId: string): Promise<void>;
    getSource(bookId: string): Promise<string>;
    setSource(bookId: string, source: string): Promise<void>;
    getResult(bookId: string): Promise<string>;
    setResult(bookId: string, result: string): Promise<void>;
    importSource(bookId: string, source: string, fileExtension: string): Promise<void>;
}
