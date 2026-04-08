import type { AppStore } from "../store/appStore";
import { observer } from "mobx-react-lite";
import type { ChangeEvent, ReactElement } from "react";
import { useRef } from "react";
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
    void toaster.push(
        <Message type="info" showIcon>
            {text}
        </Message>,
        { placement: "topEnd", duration: 4000 },
    );
}

export const AppToolbar = observer(function AppToolbar({ store }: Props) {
    const importInputRef = useRef<HTMLInputElement | null>(null);

    const onImportClick = (): void => {
        if (!store.selectedBookId) {
            stubToast("Сначала выберите книгу для импорта.");
            return;
        }
        if (importInputRef.current) {
            importInputRef.current.value = "";
            importInputRef.current.click();
        }
    };
    const onAnalyzeClick = async (): Promise<void> => {
        if (!store.selectedBookId) {
            stubToast("Сначала выберите книгу для анализа.");
            return;
        }
        const ok = await store.analyzeBook(store.selectedBookId);
        if (ok) {
            void toaster.push(
                <Message type="success" showIcon>
                    Анализ завершен.
                </Message>,
                { placement: "topEnd", duration: 3000 },
            );
        }
    };

    const onImportFileChange = async (e: ChangeEvent<HTMLInputElement>): Promise<void> => {
        const bookId = store.selectedBookId;
        const file = e.target.files?.[0];
        if (!file || !bookId) {
            return;
        }
        try {
            const sourceText = await file.text();
            const ok = await store.importBookFromFile(bookId, file.name, sourceText);
            if (ok) {
                void toaster.push(
                    <Message type="success" showIcon>
                        Книга импортирована.
                    </Message>,
                    { placement: "topEnd", duration: 3000 },
                );
            }
        } catch {
            stubToast("Не удалось прочитать файл.");
        }
    };

    return (
        <aside className="personae-toolbar" aria-label="Действия">
            <input
                ref={importInputRef}
                type="file"
                accept=".htm,.html,.txt,.fb2,text/html,text/plain,application/x-fictionbook+xml,application/xml"
                className="personae-hidden-file-input"
                onChange={(e) => {
                    void onImportFileChange(e);
                }}
            />
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
                <IconButton appearance="ghost" size="sm" icon={<i className="codicon codicon-cloud-upload" aria-hidden />} onClick={onImportClick} />
            </ToolbarTip>
            <ToolbarTip label="Анализ текста">
                <IconButton
                    appearance="ghost"
                    size="sm"
                    icon={<i className="codicon codicon-run" aria-hidden />}
                    onClick={() => {
                        void onAnalyzeClick();
                    }}
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
