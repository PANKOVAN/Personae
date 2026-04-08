import { Body, Controller, Delete, Get, Header, Param, Patch, Post } from "@nestjs/common";
import type { Book, IStorage, Shelf } from "@personae/shared";
import { StorageService } from "./service";

@Controller("api")
export class StorageController {
    constructor(private readonly storage: StorageService) {}

    @Get("health")
    getHealth(): { ok: boolean } {
        return { ok: true };
    }

    @Post("storage/save")
    save(): Promise<void> {
        return this.storage.save();
    }

    @Get("storage/getShelves")
    getShelves(): Promise<Shelf[]> {
        return this.storage.getShelves();
    }

    @Post("storage/addShelf")
    addShelf(): Promise<Shelf> {
        return this.storage.addShelf();
    }

    @Post("storage/updShelf/:shelfId")
    updShelf(@Param("shelfId") shelfId: string, @Body("name") name: string): Promise<Shelf> {
        return this.storage.updShelf(shelfId, name);
    }

    @Delete("storage/delShelf/:shelfId")
    delShelf(@Param("shelfId") shelfId: string): Promise<void> {
        return this.storage.delShelf(shelfId);
    }

    @Get("storage/getBooks")
    getBooks(): Promise<Book[]> {
        return this.storage.getBooks(undefined);
    }

    @Post("storage/addBook/:shelfPath")
    addBook(@Param("shelfPath") shelfId: string): Promise<Book> {
        return this.storage.addBook(shelfId);
    }

    @Post("storage/updBook/:bookId")
    updBook(
        @Param("bookId") bookId: string,
        @Body("name") name: string,
        @Body("author") author: string,
        @Body("annotation") annotation: string,
        @Body("shelfId") shelfId: string,
    ): Promise<Book> {
        return this.storage.updBook(bookId, name, author, annotation, shelfId);
    }

    @Delete("storage/delBook/:bookId")
    delBook(@Param("bookId") bookId: string): Promise<void> {
        return this.storage.delBook(bookId);
    }

    @Get("storage/getSource/:bookId")
    @Header("Content-Type", "application/xhtml+xml; charset=utf-8")
    getSource(@Param("bookId") bookId: string): Promise<string> {
        return this.storage.getSource(bookId);
    }

    @Post("storage/setSource/:bookId")
    setSource(@Param("bookId") bookId: string, @Body("source") source: string): Promise<void> {
        return this.storage.setSource(bookId, source);
    }

    @Get("storage/getResult/:bookId")
    @Header("Content-Type", "application/json; charset=utf-8")
    getResult(@Param("bookId") bookId: string): Promise<string> {
        return this.storage.getResult(bookId, "html");
    }

    @Post("storage/setResult/:bookId")
    setResult(
        @Param("bookId") bookId: string,
        @Body("result") result: string | any | undefined,
        @Body("mode") mode: "json" | "refresh" | "continue",
    ): Promise<void> {
        return this.storage.setResult(bookId, result, mode);
    }
}
