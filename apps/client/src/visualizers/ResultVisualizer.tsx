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
    return <pre className="personae-panel-scroll personae-pre-block">{store.resultHtml}</pre>;
});
