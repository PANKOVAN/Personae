import type { AppStore } from "../store/appStore";
import { observer } from "mobx-react-lite";
import type { ReactElement } from "react";
import { IconButton, Message, toaster, Tooltip, Whisper } from "rsuite";

type Props = { store: AppStore };

function ToolbarTip({ label, children }: { label: string; children: ReactElement }) {
    return (
        <Whisper placement="right" trigger="hover" speaker={<Tooltip>{label}</Tooltip>}>
            {children}
        </Whisper>
    );
}

function stubToast(text: string): void {
    void toaster.push(<Message type="info" showIcon>{text}</Message>, { placement: "topEnd", duration: 4000 });
}

export const AppToolbar = observer(function AppToolbar({ store }: Props) {
    return (
        <aside className="personae-toolbar" aria-label="Действия">
            <ToolbarTip label={store.showContents ? "Скрыть содержание" : "Показать содержание"}>
                <IconButton
                    appearance={store.showContents ? "primary" : "ghost"}
                    size="sm"
                    icon={<i className="codicon codicon-list-tree" aria-hidden />}
                    onClick={() => store.toggleContents()}
                />
            </ToolbarTip>
            <ToolbarTip label={store.showResult ? "Скрыть результат" : "Показать результат"}>
                <IconButton
                    appearance={store.showResult ? "primary" : "ghost"}
                    size="sm"
                    icon={<i className="codicon codicon-output" aria-hidden />}
                    onClick={() => store.toggleResult()}
                />
            </ToolbarTip>
            <div className="personae-toolbar-divider" role="separator" />
            <ToolbarTip label="Новая полка">
                <IconButton
                    appearance="ghost"
                    size="sm"
                    icon={<i className="codicon codicon-new-folder" aria-hidden />}
                    onClick={() => void store.createShelf()}
                />
            </ToolbarTip>
            <ToolbarTip label="Импорт книги">
                <IconButton
                    appearance="ghost"
                    size="sm"
                    icon={<i className="codicon codicon-cloud-upload" aria-hidden />}
                    onClick={() => stubToast("Импорт будет подключён позже.")}
                />
            </ToolbarTip>
            <ToolbarTip label="Анализ текста">
                <IconButton
                    appearance="ghost"
                    size="sm"
                    icon={<i className="codicon codicon-run" aria-hidden />}
                    onClick={() => stubToast("Запуск анализа будет подключён позже.")}
                />
            </ToolbarTip>
            <div className="personae-toolbar-footer">
                <ToolbarTip label="Настройки">
                    <IconButton appearance="ghost" size="sm" icon={<i className="codicon codicon-gear" aria-hidden />} onClick={() => store.openSettings()} />
                </ToolbarTip>
            </div>
        </aside>
    );
});
