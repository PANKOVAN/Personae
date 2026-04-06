import type { AppStore } from "../store/appStore";
import type { Book, Shelf } from "@personae/shared";
import {
    parseShelfBookTreeValue,
    parseShelfFolderTreeValue,
    shelfBookTreeValue,
    shelfFolderTreeValue,
} from "./shelfBookTree";
import { observer } from "mobx-react-lite";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { Button, Form, IconButton, Input, Popover, Textarea, Tree, Whisper } from "rsuite";

type Props = { store: AppStore };

type TreeNodeData = {
    value: string;
    label: ReactNode;
    children?: TreeNodeData[];
};

function treeContainsValue(nodes: TreeNodeData[], value: string): boolean {
    for (const n of nodes) {
        if (n.value === value) {
            return true;
        }
        if (n.children?.length && treeContainsValue(n.children, value)) {
            return true;
        }
    }
    return false;
}

function ShelfEditBody({ shelf, store, onDone }: { shelf: Shelf; store: AppStore; onDone: () => void }) {
    const [name, setName] = useState(shelf.name);
    useEffect(() => {
        setName(shelf.name);
    }, [shelf.id, shelf.name]);

    return (
        <div className="personae-tree-edit-popover">
            <Form layout="vertical">
                <Form.Group>
                    <Form.ControlLabel>Название</Form.ControlLabel>
                    <Input value={name} onChange={setName} />
                </Form.Group>
            </Form>
            <div className="personae-tree-edit-popover-actions">
                <Button
                    appearance="primary"
                    size="sm"
                    onClick={() => {
                        void store.updateShelf(shelf.id, name).then((ok) => {
                            if (ok) {
                                onDone();
                            }
                        });
                    }}
                >
                    Сохранить
                </Button>
                <Button size="sm" onClick={onDone}>
                    Отмена
                </Button>
            </div>
        </div>
    );
}

function BookEditBody({ book, store, onDone }: { book: Book; store: AppStore; onDone: () => void }) {
    const [name, setName] = useState(book.name);
    const [author, setAuthor] = useState(book.author);
    const [description, setDescription] = useState(book.description);
    useEffect(() => {
        setName(book.name);
        setAuthor(book.author);
        setDescription(book.description);
    }, [book.id, book.name, book.author, book.description]);

    return (
        <div className="personae-tree-edit-popover">
            <Form layout="vertical">
                <Form.Group>
                    <Form.ControlLabel>Название</Form.ControlLabel>
                    <Input value={name} onChange={setName} />
                </Form.Group>
                <Form.Group>
                    <Form.ControlLabel>Автор</Form.ControlLabel>
                    <Input value={author} onChange={setAuthor} />
                </Form.Group>
                <Form.Group>
                    <Form.ControlLabel>Описание</Form.ControlLabel>
                    <Textarea rows={3} value={description} onChange={setDescription} />
                </Form.Group>
            </Form>
            <div className="personae-tree-edit-popover-actions">
                <Button
                    appearance="primary"
                    size="sm"
                    onClick={() => {
                        void store.updateBook(book.id, name, author, description, book.shelfId).then((ok) => {
                            if (ok) {
                                onDone();
                            }
                        });
                    }}
                >
                    Сохранить
                </Button>
                <Button size="sm" onClick={onDone}>
                    Отмена
                </Button>
            </div>
        </div>
    );
}

export const ShelfVisualizer = observer(function ShelfVisualizer({ store }: Props) {
    const [shelfEditId, setShelfEditId] = useState<string | null>(null);
    const [bookEditKey, setBookEditKey] = useState<string | null>(null);

    const data: TreeNodeData[] = useMemo(() => {
        const shelves = store.shelves.map((shelf) => {
            const books = store.booksByShelfPath[shelf.id] ?? [];
            const shelfRowIsCurrent = store.selectedShelfPath === shelf.id && store.selectedBookPath === null;
            const children: TreeNodeData[] = books.map((b) => {
                const bookIsCurrent = store.selectedShelfPath === shelf.id && store.selectedBookPath === b.id;
                const bookKey = shelfBookTreeValue(shelf.id, b.id);
                return {
                    value: bookKey,
                    label: (
                        <Whisper
                            trigger="none"
                            open={bookEditKey === bookKey}
                            onClose={() => setBookEditKey(null)}
                            placement="autoVertical"
                            enterable
                            speaker={
                                <Popover title="Редактировать книгу">
                                    <BookEditBody book={b} store={store} onDone={() => setBookEditKey(null)} />
                                </Popover>
                            }
                        >
                            <div
                                className="personae-book-row"
                                onDoubleClick={(e) => {
                                    if (e.target instanceof Element && e.target.closest(".personae-tree-row-action")) {
                                        return;
                                    }
                                    e.stopPropagation();
                                    setShelfEditId(null);
                                    setBookEditKey(bookKey);
                                }}
                            >
                                <span className="personae-book-row-icon" aria-hidden>
                                    <i className="codicon codicon-book" />
                                </span>
                                <span className="personae-book-row-text">
                                    <span className="personae-book-row-title">{b.name || b.id}</span>
                                    {b.author ? <span className="personae-book-author">{b.author}</span> : null}
                                </span>
                                {bookIsCurrent ? (
                                    <span className="personae-book-row-actions personae-tree-row-action">
                                        <IconButton
                                            appearance="subtle"
                                            size="xs"
                                            className="personae-book-row-del"
                                            aria-label="Удалить книгу"
                                            title="Удалить книгу"
                                            type="button"
                                            icon={<i className="codicon codicon-trash" aria-hidden />}
                                            onMouseDown={(e) => e.stopPropagation()}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                void store.deleteBook(b.id);
                                            }}
                                        />
                                    </span>
                                ) : null}
                            </div>
                        </Whisper>
                    ),
                };
            });
            return {
                value: shelfFolderTreeValue(shelf.id),
                label: (
                    <Whisper
                        trigger="none"
                        open={shelfEditId === shelf.id}
                        onClose={() => setShelfEditId(null)}
                        placement="autoVertical"
                        enterable
                        speaker={
                            <Popover title="Редактировать полку">
                                <ShelfEditBody shelf={shelf} store={store} onDone={() => setShelfEditId(null)} />
                            </Popover>
                        }
                    >
                        <div
                            className="personae-shelf-row"
                            onDoubleClick={(e) => {
                                if (e.target instanceof Element && e.target.closest(".personae-tree-row-action")) {
                                    return;
                                }
                                e.stopPropagation();
                                setBookEditKey(null);
                                setShelfEditId(shelf.id);
                            }}
                        >
                            <span className="personae-shelf-row-icon" aria-hidden>
                                <i className="codicon codicon-folder" />
                            </span>
                            <span className="personae-shelf-row-name" title={shelf.name || shelf.id}>
                                {shelf.name || shelf.id}
                            </span>
                            {shelfRowIsCurrent ? (
                                <span className="personae-shelf-row-actions">
                                    <IconButton
                                        appearance="subtle"
                                        size="xs"
                                        className="personae-tree-row-action personae-shelf-row-add"
                                        aria-label="Добавить книгу"
                                        title="Добавить книгу"
                                        type="button"
                                        icon={<i className="codicon codicon-add" aria-hidden />}
                                        onMouseDown={(e) => e.stopPropagation()}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            void store.createBook(shelf.id);
                                        }}
                                    />
                                    <IconButton
                                        appearance="subtle"
                                        size="xs"
                                        className="personae-tree-row-action personae-shelf-row-del"
                                        aria-label="Удалить полку"
                                        title="Удалить полку"
                                        type="button"
                                        icon={<i className="codicon codicon-trash" aria-hidden />}
                                        onMouseDown={(e) => e.stopPropagation()}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            void store.deleteShelf(shelf.id);
                                        }}
                                    />
                                </span>
                            ) : null}
                        </div>
                    </Whisper>
                ),
                children,
            };
        });
        return shelves;
    }, [store.shelves, store.booksByShelfPath, store.selectedShelfPath, store.selectedBookPath, shelfEditId, bookEditKey]);

    const selectedKey =
        store.selectedShelfPath == null
            ? undefined
            : store.selectedBookPath != null
              ? shelfBookTreeValue(store.selectedShelfPath, store.selectedBookPath)
              : shelfFolderTreeValue(store.selectedShelfPath);

    const treeValue = selectedKey != null && treeContainsValue(data, selectedKey) ? selectedKey : undefined;

    return (
        <Tree
            className="personae-shelf-tree"
            data={data}
            value={treeValue}
            defaultExpandAll
            showIndentLine={false}
            onSelect={(_node, val, event) => {
                const t = event?.target;
                if (
                    t instanceof Element &&
                    (t.closest(".personae-tree-row-action") || t.closest(".personae-book-row-actions"))
                ) {
                    return;
                }
                const key = typeof val === "string" ? val : val != null ? String(val) : "";
                if (!key) {
                    return;
                }
                const folderShelfId = parseShelfFolderTreeValue(key);
                if (folderShelfId !== null) {
                    store.selectShelf(folderShelfId);
                    return;
                }
                const { shelfPath, bookPath } = parseShelfBookTreeValue(key);
                if (shelfPath && bookPath) {
                    void store.selectBook(shelfPath, bookPath);
                }
            }}
        />
    );
});
