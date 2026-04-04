import type { AppStore } from "../store/appStore";
import { observer } from "mobx-react-lite";
import { Panel } from "rsuite";

type Props = { store: AppStore };

export const SourceVisualizer = observer(function SourceVisualizer({ store }: Props) {
    const header = store.editMode ? "Исходный текст (режим правки)" : "Исходный текст (source.html)";
    const emptyHint = "Выберите книгу, чтобы показать исходник.";
    const body = store.selectedBookPath ? (store.sourceText ?? "Загрузка…") : emptyHint;

    return (
        <Panel header={header} bordered className="personae-panel-stretch">
            {store.editMode && store.selectedBookPath ? (
                <textarea
                    className="personae-panel-scroll personae-pre-block personae-source-edit"
                    value={store.sourceText ?? ""}
                    onChange={(e) => store.setSourceText(e.target.value)}
                    spellCheck={false}
                    aria-label="Исходный текст книги"
                />
            ) : (
                <pre className="personae-panel-scroll personae-pre-block">{body}</pre>
            )}
        </Panel>
    );
});
