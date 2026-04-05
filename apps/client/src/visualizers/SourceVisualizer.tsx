import type { AppStore } from "../store/appStore";
import { observer } from "mobx-react-lite";
import { Panel } from "rsuite";

type Props = { store: AppStore };

export const SourceVisualizer = observer(function SourceVisualizer({ store }: Props) {
    const emptyHint = "Выберите книгу, чтобы показать исходник.";
    const body = store.selectedBookPath ? (store.sourceText ?? "Загрузка…") : emptyHint;

    return (
        <Panel header="Исходный текст (source.html)" bordered className="personae-panel-stretch">
            <pre className="personae-panel-scroll personae-pre-block">{body}</pre>
        </Panel>
    );
});
