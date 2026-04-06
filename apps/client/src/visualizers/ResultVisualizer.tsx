import type { AppStore } from "../store/appStore";
import { observer } from "mobx-react-lite";

type Props = { store: AppStore };

export const ResultVisualizer = observer(function ResultVisualizer({ store }: Props) {
    return <pre className="personae-panel-scroll personae-pre-block">{store.resultHtml}</pre>;
});
