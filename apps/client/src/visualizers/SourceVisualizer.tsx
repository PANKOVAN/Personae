import type { AppStore } from "../store/appStore";
import { observer } from "mobx-react-lite";

type Props = { store: AppStore };

export const SourceVisualizer = observer(function SourceVisualizer({ store }: Props) {
    return <div className="personae-source-visualizer" dangerouslySetInnerHTML={{ __html: store.sourceHtml ?? "" }} />;
});
