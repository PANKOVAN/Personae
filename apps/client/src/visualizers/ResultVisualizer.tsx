import type { AppStore } from "../store/appStore";
import { observer } from "mobx-react-lite";

type Props = { store: AppStore };

export const ResultVisualizer = observer(function ResultVisualizer({ store }: Props) {
    return <div className="personae-source-visualizer" dangerouslySetInnerHTML={{ __html: store.resultHtml ?? "" }} />;
});
