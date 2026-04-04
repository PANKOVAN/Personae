import type { AppStore } from "../store/appStore";
import { NEW_SHELF, parseShelfBookTreeValue, parseTreeNewBookItem, shelfBookTreeValue, shelfFolderTreeValue, treeNewBookItem } from "./shelfBookTree";
import { observer } from "mobx-react-lite";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { Tree } from "rsuite";

type Props = { store: AppStore };

type TreeNodeData = {
    value: string;
    label: ReactNode;
    children?: TreeNodeData[];
};

export const ShelfVisualizer = observer(function ShelfVisualizer({ store }: Props) {
    const data: TreeNodeData[] = useMemo(() => {
        const shelves = store.shelves.map((shelf) => {
            const books = store.booksByShelfPath[shelf.id] ?? [];
            const children: TreeNodeData[] = books.map((b) => ({
                value: shelfBookTreeValue(shelf.id, b.id),
                label: (
                    <>
                        {b.name || b.id}
                        {b.author ? <span className="personae-book-author">— {b.author}</span> : null}
                    </>
                ),
            }));
            if (store.editMode) {
                children.push({
                    value: treeNewBookItem(shelf.id),
                    label: "[Новая книга]",
                });
            }
            return { value: shelfFolderTreeValue(shelf.id), label: shelf.name || shelf.id, children };
        });
        if (store.editMode) {
            shelves.push({ value: NEW_SHELF, label: "[Новая полка]", children: [] });
        }
        return shelves;
    }, [store.shelves, store.booksByShelfPath, store.editMode]);

    const selectedValue =
        store.selectedShelfPath && store.selectedBookPath
            ? shelfBookTreeValue(store.selectedShelfPath, store.selectedBookPath)
            : undefined;

    return (
        <Tree
            className="personae-shelf-tree"
            data={data}
            value={selectedValue}
            defaultExpandAll
            showIndentLine={false}
            onSelect={(_node, val) => {
                const key = typeof val === "string" ? val : val != null ? String(val) : "";
                if (!key) {
                    return;
                }
                if (key === NEW_SHELF) {
                    void store.createShelf();
                    return;
                }
                const newBookShelfPath = parseTreeNewBookItem(key);
                if (newBookShelfPath) {
                    void store.createBook(newBookShelfPath);
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
