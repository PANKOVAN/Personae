import type { AppStore } from "../store/appStore";
import { parseShelfBookTreeValue, shelfBookTreeValue, shelfFolderTreeValue } from "./shelfBookTree";
import { observer } from "mobx-react-lite";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { Button, Tree } from "rsuite";

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
            return {
                value: shelfFolderTreeValue(shelf.id),
                label: (
                    <div className="personae-shelf-row">
                        <span className="personae-shelf-row-name" title={shelf.name || shelf.id}>
                            {shelf.name || shelf.id}
                        </span>
                        <Button
                            appearance="link"
                            size="xs"
                            className="personae-shelf-row-add"
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                                e.stopPropagation();
                                void store.createBook(shelf.id);
                            }}
                        >
                            Добавить книгу
                        </Button>
                    </div>
                ),
                children,
            };
        });
        return shelves;
    }, [store.shelves, store.booksByShelfPath]);

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
                const { shelfPath, bookPath } = parseShelfBookTreeValue(key);
                if (shelfPath && bookPath) {
                    void store.selectBook(shelfPath, bookPath);
                }
            }}
        />
    );
});
