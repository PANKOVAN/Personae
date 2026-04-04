import type { AppStore } from "../store/appStore";
import { observer } from "mobx-react-lite";
import { Panel } from "rsuite";

type Props = { store: AppStore };

function formatJson(text: string): string {
    try {
        return JSON.stringify(JSON.parse(text) as unknown, null, 2);
    } catch {
        return text;
    }
}

export const ResultVisualizer = observer(function ResultVisualizer({ store }: Props) {
    const body =
        store.selectedBookPath && store.resultText != null ? formatJson(store.resultText) : store.resultText;

    return (
        <Panel header="Результат анализа (result.json)" bordered className="personae-panel-stretch">
            <pre className="personae-panel-scroll personae-pre-block">
                {store.selectedBookPath ? body ?? "Загрузка…" : "Выберите книгу, чтобы показать результат."}
            </pre>
        </Panel>
    );
});
