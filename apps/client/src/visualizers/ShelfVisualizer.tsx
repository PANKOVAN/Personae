import type { AppStore } from "../store/appStore";
import {
    parseShelfBookTreeValue,
    parseShelfFolderTreeValue,
    shelfBookTreeValue,
    shelfFolderTreeValue,
} from "./shelfBookTree";
import { observer } from "mobx-react-lite";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { IconButton, Tree } from "rsuite";

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

export const ShelfVisualizer = observer(function ShelfVisualizer({ store }: Props) {
    const data: TreeNodeData[] = useMemo(() => {
        const shelves = store.shelves.map((shelf) => {
            const books = store.booksByShelfPath[shelf.id] ?? [];
            const shelfRowIsCurrent = store.selectedShelfPath === shelf.id && store.selectedBookPath === null;
            const children: TreeNodeData[] = books.map((b) => {
                const bookIsCurrent = store.selectedShelfPath === shelf.id && store.selectedBookPath === b.id;
                return {
                    value: shelfBookTreeValue(shelf.id, b.id),
                    label: (
                        <div className="personae-book-row">
                            <span className="personae-book-row-name">
                                {b.name || b.id}
                                {b.author ? <span className="personae-book-author">— {b.author}</span> : null}
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
                    ),
                };
            });
            return {
                value: shelfFolderTreeValue(shelf.id),
                label: (
                    <div className="personae-shelf-row">
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
                ),
                children,
            };
        });
        return shelves;
    }, [store.shelves, store.booksByShelfPath, store.selectedShelfPath, store.selectedBookPath]);

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
