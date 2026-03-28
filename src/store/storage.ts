import { newEntityId } from "../ids";
import LocalSettings from "../settings";

export class BookShelf {
  constructor(
    private readonly bookStorage: IStorage,
    public readonly id: string,
    public readonly name: string
  ) {}
  getBooks(): Promise<Book[]> {
    return this.bookStorage.getBooks(this.id);
  }
}

export class Book {
  constructor(
    _storage: IStorage,
    public readonly id: string,
    public readonly name: string
  ) {}
}

export class BookContent {
  public source = "";
  public result: unknown = null;
  constructor(_storage: IStorage) {}
}

export class BookStorage {
  private readonly storage: IStorage;

  constructor() {
    const settings = LocalSettings.getSettings();
    if (settings.storageType !== "local") {
      throw new Error("Storage not found");
    }
    this.storage = new BrowserJsonStorage();
  }

  open(): Promise<void> {
    return this.storage.open();
  }
  /** Повторное чтение из носителя без нового экземпляра (тот же `IStorage`). */
  reload(): Promise<void> {
    return this.storage.reload();
  }
  close(): Promise<void> {
    return this.storage.close();
  }
  getShelves(): Promise<BookShelf[]> {
    return this.storage.getShelves();
  }
  addShelf(name: string): Promise<string> {
    return this.storage.addShelf(name);
  }
  getBooks(shelfId: string): Promise<Book[]> {
    return this.storage.getBooks(shelfId);
  }
  updateShelf(id: string, name: string): Promise<void> {
    return this.storage.updateShelf(id, name);
  }
  removeShelf(id: string): Promise<void> {
    return this.storage.removeShelf(id);
  }
}

type PersistShelf = {
  id?: string;
  name?: string;
  books?: unknown[];
};

interface IStorage {
  open(): Promise<void>;
  /** Снова подтянуть данные с persist-слоя (localStorage и т.д.). */
  reload(): Promise<void>;
  close(): Promise<void>;
  getShelves(): Promise<BookShelf[]>;
  addShelf(name: string): Promise<string>;
  removeShelf(id: string): Promise<void>;
  updateShelf(id: string, name: string): Promise<void>;
  getBooks(shelfId: string): Promise<Book[]>;
}

class BrowserJsonStorage implements IStorage {
  static readonly DATA_STORAGE_KEY = "personae-storage";

  private data: { shelves?: PersistShelf[] } = {};

  private persist(): void {
    try {
      window.localStorage.setItem(
        BrowserJsonStorage.DATA_STORAGE_KEY,
        JSON.stringify(this.data),
      );
    } catch (e) {
      console.error("Error saving personae-storage", e);
    }
  }

  open(): Promise<void> {
    this.load();
    return Promise.resolve();
  }

  private load(): void {
    try {
      const raw = JSON.parse(
        window.localStorage.getItem(BrowserJsonStorage.DATA_STORAGE_KEY) || "{}",
      );
      this.data =
        raw && typeof raw === "object"
          ? (raw as { shelves?: PersistShelf[] })
          : {};
    } catch (error) {
      console.error("Error opening local storage", error);
      this.data = {};
    }
  }
  reload(): Promise<void> {
    this.load();
    return Promise.resolve();
  }

  close(): Promise<void> {
    return Promise.resolve();
  }

  getShelves(): Promise<BookShelf[]> {
    this.data.shelves = this.data.shelves || [];
    const shelves = (this.data.shelves ?? [])
      .filter((row) => typeof row.id === "string" && row.id.length > 0)
      .map((row) => new BookShelf(this, row.id as string, row.name || ""));
    return Promise.resolve(shelves);
  }
  addShelf(name: string): Promise<string> {
    this.data.shelves = this.data.shelves || [];
    const id = newEntityId();
    const label = name.trim() || "Новая полка";
    this.data.shelves.push({
      id,
      name: label,
      books: [],
    });
    this.persist();
    return Promise.resolve(id);
  }
  removeShelf(id: string): Promise<void> {
    this.data.shelves = (this.data.shelves ?? []).filter((row) => row.id !== id);
    this.persist();
    return Promise.resolve();
  }
  updateShelf(id: string, name: string): Promise<void> {
    const shelf = (this.data.shelves ?? []).find((row) => row.id === id);
    if (shelf) {
      shelf.name = name;
      this.persist();
    }
    return Promise.resolve();
  }
  getBooks(shelfId: string): Promise<Book[]> {
    const books: Book[] = [];
    this.data.shelves = this.data.shelves || [];
    const shelf = (this.data.shelves ?? []).find((row) => row.id === shelfId);
    if (shelf?.books && Array.isArray(shelf.books)) {
      for (const raw of shelf.books) {
        if (!raw || typeof raw !== "object") continue;
        const b = raw as { id?: unknown; name?: unknown };
        const id = typeof b.id === "string" ? b.id : "";
        if (!id) continue;
        const name = typeof b.name === "string" ? b.name : "";
        books.push(new Book(this, id, name));
      }
    }
    return Promise.resolve(books);
  }
}
