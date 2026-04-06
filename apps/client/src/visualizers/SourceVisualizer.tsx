import type { AppStore } from "../store/appStore";
import { observer } from "mobx-react-lite";
import { Panel } from "rsuite";

type Props = { store: AppStore };

export const SourceVisualizer = observer(function SourceVisualizer({ store }: Props) {
    return <pre className="personae-panel-scroll personae-pre-block">{store.sourceHtml}</pre>;
});
